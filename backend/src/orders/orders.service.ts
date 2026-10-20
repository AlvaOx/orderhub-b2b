import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CANCELLABLE_STATUSES,
  type CreatedOrder,
  type CreateOrderInput,
  type ListOrdersQuery,
  MAX_ORDER_TOTAL,
  NEXT_FULFILLMENT_STATUS,
  type OrderDetail,
  type OrdersPage,
  type OrderStatus,
  WAREHOUSE_VISIBLE_STATUSES,
} from '@orderhub/shared';

import type { AccessTokenPayload } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

// Qué pedidos ve cada rol DENTRO de su empresa (RLS ya limita a la empresa).
// La usan el listado, el detalle y los cambios de estado: lo que no ves, no lo abres ni lo cambias.
// Switch exhaustivo: un rol nuevo sin su regla no compila.
function scopeForRole({ role, sub }: AccessTokenPayload): Prisma.OrderWhereInput {
  switch (role) {
    case 'admin':
      return {};
    case 'vendedor':
      return { sellerId: sub };
    case 'bodega':
      return { status: { in: [...WAREHOUSE_VISIBLE_STATUSES] } };
  }
}

const STALE_ORDER_MESSAGE =
  'El pedido ya no está en un estado que permita este cambio. Recarga para ver su estado actual.';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AccessTokenPayload, query: ListOrdersQuery): Promise<OrdersPage> {
    const where: Prisma.OrderWhereInput = {
      // Capa 1 (app): la empresa del JWT. RLS lo vuelve a exigir en la base.
      tenantId: user.tenantId,
      // AND: la regla del rol se SUMA a los filtros del usuario, nunca se reemplaza.
      AND: [
        scopeForRole(user),
        { status: query.status, sellerId: query.sellerId, number: query.number },
        query.cursor ? { number: { lt: query.cursor } } : {},
      ],
    };

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      // 1) Solo los pedidos de la página. Sin JOIN de conteo, Postgres recorre el
      //    índice (tenant_id, number) hacia atrás y se detiene al llegar a limit + 1.
      const rows = await tx.order.findMany({
        where,
        orderBy: { number: 'desc' },
        // Uno extra para saber si hay otra página, sin hacer COUNT(*).
        take: query.limit + 1,
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          createdAt: true,
          // Sin N+1: Prisma trae todos los vendedores en una sola consulta (WHERE id IN ...).
          seller: { select: { id: true, name: true } },
        },
      });

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page.at(-1);

      // 2) Cantidad de ítems SOLO de los pedidos de esta página (usa el índice
      //    order_items(order_id)). El costo depende del tamaño de la página, no de la tabla.
      //    Antes, el _count de Prisma agrupaba los ítems de TODA la empresa en cada request.
      const counts =
        page.length === 0
          ? []
          : await tx.orderItem.groupBy({
              by: ['orderId'],
              where: { tenantId: user.tenantId, orderId: { in: page.map((order) => order.id) } },
              _count: { _all: true },
            });
      const itemsByOrder = new Map(counts.map((c) => [c.orderId, c._count._all]));

      return {
        items: page.map((order) => ({
          id: order.id,
          number: order.number,
          status: order.status,
          total: order.total,
          itemsCount: itemsByOrder.get(order.id) ?? 0,
          createdAt: order.createdAt.toISOString(),
          seller: order.seller,
        })),
        nextCursor: hasMore && last ? last.number : null,
      };
    });
  }

  async findByNumber(user: AccessTokenPayload, number: number): Promise<OrderDetail> {
    const order = await this.prisma.forTenant(user.tenantId, (tx) =>
      tx.order.findUnique({
        // Índice único (tenant_id, number) + la misma regla por rol que el listado.
        where: { tenantId_number: { tenantId: user.tenantId, number }, AND: [scopeForRole(user)] },
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          createdAt: true,
          updatedAt: true,
          seller: { select: { id: true, name: true } },
          // Sin N+1: ítems y sus productos llegan en una consulta por nivel (WHERE ... IN).
          items: {
            orderBy: { id: 'asc' },
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              product: { select: { id: true, sku: true, name: true } },
            },
          },
          // Línea de tiempo: usa el índice (order_id, changed_at).
          statusHistory: {
            orderBy: { changedAt: 'asc' },
            select: {
              id: true,
              fromStatus: true,
              toStatus: true,
              changedAt: true,
              changedBy: { select: { id: true, name: true } },
            },
          },
        },
      }),
    );

    // 404 y no 403: si no te corresponde verlo, no confirmamos que exista.
    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    return {
      id: order.id,
      number: order.number,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      seller: order.seller,
      items: order.items.map((item) => ({
        ...item,
        subtotal: item.quantity * item.unitPrice,
      })),
      history: order.statusHistory.map((change) => ({
        ...change,
        changedAt: change.changedAt.toISOString(),
      })),
    };
  }

  /**
   * Crea un pedido en UNA transacción: si algo falla (producto inexistente, sin stock,
   * total excesivo), se revierte todo, incluido el stock ya descontado.
   */
  async create(user: AccessTokenPayload, input: CreateOrderInput): Promise<CreatedOrder> {
    // Siempre en el mismo orden (por id): dos pedidos con los mismos productos no pueden
    // bloquearse en cruz (deadlock), porque ambos toman las filas en el mismo orden.
    const lines = [...input.items].sort((a, b) => a.productId.localeCompare(b.productId));

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      // 1) Precios desde la base, NUNCA desde el navegador.
      const products = await tx.product.findMany({
        where: { tenantId: user.tenantId, id: { in: lines.map((line) => line.productId) } },
        select: { id: true, sku: true, price: true },
      });
      const productsById = new Map(products.map((product) => [product.id, product]));

      const priced = lines.map((line) => {
        const product = productsById.get(line.productId);
        if (!product) {
          throw new BadRequestException('Uno o más productos no existen');
        }
        // unitPrice es una foto del precio de hoy: si mañana cambia, el pedido no cambia.
        return { ...line, sku: product.sku, unitPrice: product.price };
      });

      const total = priced.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
      // total se guarda en un INTEGER de Postgres: mejor un mensaje claro que un error de la base.
      if (total > MAX_ORDER_TOTAL) {
        throw new BadRequestException('El total del pedido excede el máximo permitido');
      }

      // 2) Stock: verificar y descontar en UNA sentencia (UPDATE ... WHERE stock >= cantidad).
      //    Si otra transacción tenía la fila bloqueada, Postgres espera y vuelve a evaluar
      //    el WHERE con el stock nuevo. Leer, comparar en Node y restar sería una carrera.
      for (const line of priced) {
        const { count } = await tx.product.updateMany({
          where: { id: line.productId, tenantId: user.tenantId, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (count === 0) {
          throw new ConflictException(`Stock insuficiente para ${line.sku}`);
        }
      }

      // 3) Talonario AL FINAL: su fila queda bloqueada hasta el COMMIT y serializa los
      //    pedidos de toda la empresa. Mientras más tarde se tome, menos esperan los demás.
      const { orderSeq: number } = await tx.tenant.update({
        where: { id: user.tenantId },
        data: { orderSeq: { increment: 1 } },
        select: { orderSeq: true },
      });

      // 4) Pedido e ítems. El vendedor es quien lo crea (sale del JWT, no del body).
      return tx.order.create({
        data: {
          tenantId: user.tenantId,
          number,
          sellerId: user.sub,
          total,
          items: {
            create: priced.map((line) => ({
              tenantId: user.tenantId,
              productId: line.productId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
            })),
          },
        },
        select: { id: true, number: true },
      });
    });
  }

  /**
   * Avanza el pedido al estado SIGUIENTE del flujo de bodega (pagado -> preparando ->
   * despachado -> entregado). `to` es lo que el usuario vio en pantalla: si el pedido
   * cambió mientras tanto, la transición no calza y responde 409.
   */
  async advanceStatus(
    user: AccessTokenPayload,
    number: number,
    to: OrderStatus,
  ): Promise<OrderDetail> {
    await this.prisma.forTenant(user.tenantId, async (tx) => {
      const order = await tx.order.findUnique({
        where: { tenantId_number: { tenantId: user.tenantId, number }, AND: [scopeForRole(user)] },
        select: { id: true, status: true },
      });
      if (!order) {
        throw new NotFoundException('Pedido no encontrado');
      }

      // Solo se avanza al siguiente: no se salta ni se retrocede.
      if (NEXT_FULFILLMENT_STATUS[order.status] !== to) {
        throw new ConflictException(STALE_ORDER_MESSAGE);
      }

      // Bloqueo optimista: cambia solo si sigue en el estado que leímos.
      // Si otra persona se adelantó, actualiza 0 filas y respondemos 409.
      const { count } = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: to },
      });
      if (count === 0) {
        throw new ConflictException(STALE_ORDER_MESSAGE);
      }

      // En la misma transacción: si falla el historial, tampoco cambia el estado.
      await tx.orderStatusChange.create({
        data: {
          tenantId: user.tenantId,
          orderId: order.id,
          fromStatus: order.status,
          toStatus: to,
          changedById: user.sub,
        },
      });
    });

    return this.findByNumber(user, number);
  }

  /**
   * Cancela un pedido pendiente de pago y devuelve su stock, todo en una transacción.
   * Un pedido pagado no se cancela aquí: eso exige reembolso (Fase 2).
   */
  async cancel(user: AccessTokenPayload, number: number): Promise<OrderDetail> {
    await this.prisma.forTenant(user.tenantId, async (tx) => {
      const order = await tx.order.findUnique({
        // El vendedor solo encuentra SUS pedidos: no puede cancelar los de otro.
        where: { tenantId_number: { tenantId: user.tenantId, number }, AND: [scopeForRole(user)] },
        select: {
          id: true,
          status: true,
          items: { select: { productId: true, quantity: true } },
        },
      });
      if (!order) {
        throw new NotFoundException('Pedido no encontrado');
      }

      if (!CANCELLABLE_STATUSES.includes(order.status)) {
        throw new ConflictException('Solo se pueden cancelar pedidos pendientes de pago');
      }

      // Bloqueo optimista, igual que al avanzar.
      const { count } = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: 'cancelado' },
      });
      if (count === 0) {
        throw new ConflictException(STALE_ORDER_MESSAGE);
      }

      // Devuelve el stock. Mismo orden por id que al crear: sin deadlocks.
      const items = [...order.items].sort((a, b) => a.productId.localeCompare(b.productId));
      for (const item of items) {
        await tx.product.updateMany({
          where: { id: item.productId, tenantId: user.tenantId },
          data: { stock: { increment: item.quantity } },
        });
      }

      await tx.orderStatusChange.create({
        data: {
          tenantId: user.tenantId,
          orderId: order.id,
          fromStatus: order.status,
          toStatus: 'cancelado',
          changedById: user.sub,
        },
      });
    });

    return this.findByNumber(user, number);
  }
}
