import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.schema.js';
import {
  FAKE_PAY_SIGNATURE_HEADER,
  type FakePayEvent,
  signFakePayBody,
} from './fake-pay.protocol.js';
import type { PaymentOutcome } from './payment-provider.js';

// Si el webhook no responde en este tiempo, la pasarela se rinde (una real reintentaría).
const WEBHOOK_TIMEOUT_MS = 5_000;

/**
 * Hace el papel del MUNDO EXTERNO: la pasarela de pagos. En un sistema real esto vive
 * en los servidores de Mercado Pago, no en nuestro código. Aquí firma el evento y lo
 * envía por HTTP a nuestro webhook, exactamente como lo haría una pasarela real.
 */
@Injectable()
export class FakePayGateway {
  private readonly secret: string;
  private readonly webhookUrl: string;

  constructor(config: ConfigService<Env, true>) {
    this.secret = config.get('FAKE_PAY_WEBHOOK_SECRET', { infer: true });
    this.webhookUrl = new URL(
      '/api/webhooks/fake-pay',
      config.get('API_INTERNAL_URL', { infer: true }),
    ).toString();
  }

  // Avisa a la tienda cómo terminó el pago. Lanza si el webhook no respondió 2xx.
  async notifyPayment(externalId: string, outcome: PaymentOutcome, amount: number): Promise<void> {
    const event: FakePayEvent = {
      id: randomUUID(),
      type: 'payment.updated',
      data: { externalId, status: outcome, amount },
    };
    // Se firma el MISMO texto que viaja: un byte distinto y la firma no calza.
    const body = JSON.stringify(event);

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [FAKE_PAY_SIGNATURE_HEADER]: signFakePayBody(this.secret, body),
      },
      body,
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`[fake-pay] el webhook respondió ${response.status}`);
    }
  }
}
