import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  CheckoutSession,
  OrderStatus,
  SimulatedCheckout,
  SimulatedDecisionInput,
  SimulatedDecisionResult,
} from '@orderhub/shared';

import type { AccessTokenPayload } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import { scopeForRole } from '../orders/order-scope.js';
import { FakePayGateway } from './fake-pay.gateway.js';
import { PAYMENT_PROVIDER, type PaymentOutcome, type PaymentProvider } from './payment-provider.js';

// Fila que devuelve la función SECURITY DEFINER payment_find_by_external_id.
type PaymentTarget = { id: string; tenant_id: string; order_id: string };

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    // Se pide "un PaymentProvider", no FakePaymentProvider: el módulo decide cuál.
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly gateway: FakePayGateway,
  ) {}

  // ---------------------------------------------------------------------------
  // Lado TIENDA (con sesión)
  // ---------------------------------------------------------------------------

  /**
   * Abre un checkout para un pedido pendiente de pago. Si el pedido ya tenía un
   * checkout pendiente, ese se anula: solo vale el último link.
   */
  async startPayment(user: AccessTokenPayload, number: number): Promise<CheckoutSession> {
    return this.prisma.forTenant(user.tenantId, async (tx) => {
      // Misma regla por rol que pedidos: el vendedor solo paga SUS pedidos.
      const order = await tx.order.findUnique({
        where: { tenantId_number: { tenantId: user.tenantId, number }, AND: [scopeForRole(user)] },
        select: { id: true, number: true, total: true },
      });
      if (!order) {
        throw new NotFoundException('Pedido no encontrado');
      }

      // Bloquea la fila del pedido hasta el COMMIT y relee su estado: dos clics en
      // "Pagar" (o un webhook llegando justo ahora) esperan en fila, no se pisan.
      const [locked] = await tx.$queryRaw<{ status: OrderStatus }[]>`
        SELECT status FROM orders WHERE id = ${order.id}::uuid FOR UPDATE`;
      if (locked?.status !== 'pendiente_pago') {
        throw new ConflictException('Solo se pueden pagar pedidos pendientes de pago');
      }

      // Un solo checkout vivo por pedido: los anteriores quedan anulados.
      await tx.payment.updateMany({
        where: { orderId: order.id, status: 'pendiente' },
        data: { status: 'cancelado' },
      });

      // Con una pasarela real esto es una llamada HTTP: convendría hacerla fuera de la
      // transacción para no tener la fila bloqueada mientras responde un tercero.
      const checkout = await this.provider.createCheckout({
        amount: order.total,
        orderNumber: order.number,
      });

      // El monto sale del pedido (de la base), nunca del navegador.
      await tx.payment.create({
        data: {
          tenantId: user.tenantId,
          orderId: order.id,
          provider: this.provider.name,
          externalId: checkout.externalId,
          amount: order.total,
        },
      });

      return { checkoutUrl: checkout.checkoutUrl };
    });
  }

  // ---------------------------------------------------------------------------
  // Lado PASARELA SIMULADA (con sesión, decisión A)
  // ---------------------------------------------------------------------------

  // Lo que muestra la página de checkout. 404 si no existe o no te corresponde.
  async getCheckout(user: AccessTokenPayload, externalId: string): Promise<SimulatedCheckout> {
    const payment = await this.prisma.forTenant(user.tenantId, (tx) =>
      tx.payment.findFirst({
        where: {
          tenantId: user.tenantId,
          provider: 'simulado',
          externalId,
          order: scopeForRole(user),
        },
        select: {
          externalId: true,
          amount: true,
          status: true,
          order: { select: { number: true } },
        },
      }),
    );
    if (!payment?.externalId) {
      throw new NotFoundException('Pago no encontrado');
    }

    return {
      externalId: payment.externalId,
      orderNumber: payment.order.number,
      amount: payment.amount,
      status: payment.status,
    };
  }

  /**
   * El usuario aprieta "Aprobar" o "Rechazar". La pasarela NO toca nuestra base:
   * solo nos avisa por webhook firmado, y el webhook es quien cambia el pedido.
   * Sin transacción aquí a propósito: si tuviéramos el pedido bloqueado mientras
   * esperamos al webhook (que necesita ese mismo bloqueo), nos esperaríamos a nosotros mismos.
   */
  async decide(
    user: AccessTokenPayload,
    externalId: string,
    decision: SimulatedDecisionInput['decision'],
  ): Promise<SimulatedDecisionResult> {
    const checkout = await this.getCheckout(user, externalId);
    if (checkout.status !== 'pendiente') {
      throw new ConflictException('Este pago ya fue procesado o fue reemplazado por uno nuevo');
    }

    const outcome: PaymentOutcome = decision === 'aprobar' ? 'aprobado' : 'rechazado';
    try {
      await this.gateway.notifyPayment(externalId, outcome, checkout.amount);
    } catch (error) {
      this.logger.error(`[fake-pay] no se pudo entregar el webhook: ${String(error)}`);
      throw new BadGatewayException('La pasarela no pudo confirmar el pago. Intenta de nuevo.');
    }

    // Se relee: lo que manda es lo que dejó el webhook en la base.
    const updated = await this.getCheckout(user, externalId);
    return { orderNumber: updated.orderNumber, status: updated.status };
  }

  // ---------------------------------------------------------------------------
  // WEBHOOK (público, sin JWT, con firma)
  // ---------------------------------------------------------------------------

  /**
   * Procesa un webhook de la pasarela. Idempotente: el mismo evento dos veces
   * deja la base igual que una vez.
   */
  async handleWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<void> {
    // 1) Firma y formato (401 / 400). Antes de esto no se toca la base.
    const event = this.provider.parseWebhook(rawBody, headers);

    // 2) Sin JWT no sabemos la empresa: la "ventanilla" SECURITY DEFINER responde
    //    solo de qué empresa y pedido es este pago.
    const [target] = await this.prisma.$queryRaw<PaymentTarget[]>`
      SELECT id, tenant_id, order_id
      FROM payment_find_by_external_id(${this.provider.name}::payment_provider, ${event.externalId})`;
    if (!target) {
      // 200 igual: si respondiéramos error, la pasarela reintentaría para siempre.
      this.logger.warn(`[webhook] pago desconocido: ${event.externalId}`);
      return;
    }

    // 3) Todo lo demás, en UNA transacción de esa empresa (RLS activo).
    await this.prisma.forTenant(target.tenant_id, async (tx) => {
      // 3a) Idempotencia: ON CONFLICT DO NOTHING. No se captura el error de UNIQUE
      //     porque en Postgres un error deja la transacción abortada.
      const { count: isNew } = await tx.webhookEvent.createMany({
        data: [{ provider: this.provider.name, eventId: event.eventId, payload: event.payload }],
        skipDuplicates: true,
      });
      if (isNew === 0) {
        this.logger.log(`[webhook] evento repetido, se ignora: ${event.eventId}`);
        return;
      }

      // 3b) Mismo orden de bloqueo que startPayment (primero el pedido, después el pago):
      //     así un clic en "Pagar" y este webhook no se bloquean en cruz (deadlock).
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${target.order_id}::uuid FOR UPDATE`;

      const payment = await tx.payment.findUnique({
        where: { id: target.id },
        select: { status: true, amount: true },
      });

      if (payment && payment.amount !== event.amount) {
        // Monto distinto al cobrado: no se confía en el evento.
        this.logger.error(`[webhook] monto no calza en el pago ${target.id}: se ignora`);
      } else if (payment) {
        // Bloqueo optimista: solo un pago pendiente puede cambiar.
        const { count: paymentUpdated } = await tx.payment.updateMany({
          where: { id: target.id, status: 'pendiente' },
          data: { status: event.outcome },
        });

        if (paymentUpdated === 0) {
          this.logger.warn(
            `[webhook] el pago ${target.id} ya no estaba pendiente (${payment.status})` +
              (event.outcome === 'aprobado'
                ? ': cobro aprobado sin pedido, requiere reembolso'
                : ''),
          );
        } else if (event.outcome === 'aprobado') {
          await this.markOrderAsPaid(tx, target);
        }
      }

      // 3c) Procesado. Si algo arriba falló, el ROLLBACK borra también el registro del
      //     evento y el reintento de la pasarela lo procesa de nuevo.
      await tx.webhookEvent.update({
        where: { provider_eventId: { provider: this.provider.name, eventId: event.eventId } },
        data: { processedAt: new Date() },
      });
    });
  }

  private async markOrderAsPaid(
    tx: Parameters<Parameters<PrismaService['forTenant']>[1]>[0],
    target: PaymentTarget,
  ): Promise<void> {
    const { count } = await tx.order.updateMany({
      where: { id: target.order_id, status: 'pendiente_pago' },
      data: { status: 'pagado' },
    });

    if (count === 0) {
      // Ej: lo cancelaron mientras se pagaba. El pago queda aprobado: reembolso en el paso 2.
      this.logger.warn(
        `[webhook] pedido ${target.order_id} no estaba pendiente: requiere reembolso`,
      );
      return;
    }

    // changedById null: el cambio lo hizo el sistema, no una persona.
    await tx.orderStatusChange.create({
      data: {
        tenantId: target.tenant_id,
        orderId: target.order_id,
        fromStatus: 'pendiente_pago',
        toStatus: 'pagado',
        changedById: null,
      },
    });
  }
}
