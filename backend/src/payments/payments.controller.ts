import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  type CheckoutSession,
  checkoutIdParamSchema,
  orderNumberParamSchema,
  type SimulatedCheckout,
  type SimulatedDecisionInput,
  type SimulatedDecisionResult,
  simulatedDecisionSchema,
} from '@orderhub/shared';

import type { AccessTokenPayload } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { PaymentsService } from './payments.service.js';

const orderNumberPipe = new ZodValidationPipe(orderNumberParamSchema);
const checkoutIdPipe = new ZodValidationPipe(checkoutIdParamSchema);

// Rutas con sesión: iniciar el pago (tienda) y el checkout simulado (pasarela, decisión A).
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // POST /api/orders/10001/payment  ->  201 { checkoutUrl }
  @RequirePermissions('payments:create')
  @Post('orders/:number/payment')
  start(
    @Param('number', orderNumberPipe) number: number,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<CheckoutSession> {
    return this.payments.startPayment(user, number);
  }

  // GET /api/fake-pay/checkouts/<externalId>  ->  monto, pedido y estado del pago
  @RequirePermissions('payments:create')
  @Get('fake-pay/checkouts/:externalId')
  getCheckout(
    @Param('externalId', checkoutIdPipe) externalId: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<SimulatedCheckout> {
    return this.payments.getCheckout(user, externalId);
  }

  // POST /api/fake-pay/checkouts/<externalId>/decision  { decision: "aprobar" | "rechazar" }
  @RequirePermissions('payments:create')
  @Post('fake-pay/checkouts/:externalId/decision')
  @HttpCode(HttpStatus.OK)
  decide(
    @Param('externalId', checkoutIdPipe) externalId: string,
    @Body(new ZodValidationPipe(simulatedDecisionSchema)) body: SimulatedDecisionInput,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<SimulatedDecisionResult> {
    return this.payments.decide(user, externalId, body.decision);
  }
}
