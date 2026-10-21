import { Module } from '@nestjs/common';

import { FakePayGateway } from './fake-pay.gateway.js';
import { FakePaymentProvider } from './fake-payment.provider.js';
import { PAYMENT_PROVIDER } from './payment-provider.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  controllers: [PaymentsController, WebhooksController],
  providers: [
    PaymentsService,
    FakePayGateway,
    // El único lugar que dice QUÉ pasarela se usa. Cambiar a Mercado Pago = cambiar esta línea.
    { provide: PAYMENT_PROVIDER, useClass: FakePaymentProvider },
  ],
})
export class PaymentsModule {}
