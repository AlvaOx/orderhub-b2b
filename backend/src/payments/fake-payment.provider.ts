import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.schema.js';
import {
  FAKE_PAY_SIGNATURE_HEADER,
  fakePayEventSchema,
  isValidFakePaySignature,
} from './fake-pay.protocol.js';
import type { CreatedCheckout, PaymentEvent, PaymentProvider } from './payment-provider.js';

/**
 * Nuestro adaptador para la pasarela simulada. Es el código que se QUEDA en la app:
 * si mañana llega Mercado Pago, se escribe MercadoPagoProvider con esta misma interfaz.
 */
@Injectable()
export class FakePaymentProvider implements PaymentProvider {
  readonly name = 'simulado' as const;
  private readonly secret: string;

  constructor(config: ConfigService<Env, true>) {
    this.secret = config.get('FAKE_PAY_WEBHOOK_SECRET', { infer: true });
  }

  // Una pasarela real crearía la sesión en SU servidor (una llamada HTTP) y respondería
  // con su id y su URL. Aquí el id es un UUID aleatorio: imposible de adivinar.
  createCheckout(): Promise<CreatedCheckout> {
    const externalId = randomUUID();
    return Promise.resolve({ externalId, checkoutUrl: `/pago-simulado/${externalId}` });
  }

  parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): PaymentEvent {
    // 1) Firma primero, ANTES de mirar el contenido: lo no firmado no se lee.
    const header = headers[FAKE_PAY_SIGNATURE_HEADER];
    const signature = typeof header === 'string' ? header : undefined;
    if (!isValidFakePaySignature(this.secret, signature, rawBody)) {
      throw new UnauthorizedException('Firma de webhook inválida');
    }

    // 2) Recién ahora se interpreta el mensaje.
    let json: unknown;
    try {
      json = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Webhook mal formado');
    }
    const parsed = fakePayEventSchema.safeParse(json);
    if (!parsed.success) {
      throw new BadRequestException('Webhook mal formado');
    }

    // 3) Se traduce a nuestro idioma: el resto de la app no conoce el formato de la pasarela.
    const event = parsed.data;
    return {
      eventId: event.id,
      externalId: event.data.externalId,
      outcome: event.data.status,
      amount: event.data.amount,
      payload: event,
    };
  }
}
