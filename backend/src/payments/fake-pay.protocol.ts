import { createHmac, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

// =============================================
// Protocolo de la pasarela simulada: lo comparten quien envía (FakePayGateway)
// y quien recibe (FakePaymentProvider). Mismo esquema que usan Stripe y otras:
//   cabecera  x-fakepay-signature: t=<unix>,v1=<hex>
//   firma     HMAC-SHA256(secreto, "<t>.<cuerpo exacto>")
// =============================================

export const FAKE_PAY_SIGNATURE_HEADER = 'x-fakepay-signature';

// Un webhook firmado hace más de 5 minutos se rechaza: si alguien captura uno,
// no puede reenviarlo mañana (ataque de repetición).
const TOLERANCE_SECONDS = 300;

// Forma del evento que manda la pasarela.
export const fakePayEventSchema = z.object({
  id: z.uuid(),
  type: z.literal('payment.updated'),
  data: z.object({
    externalId: z.uuid(),
    status: z.enum(['aprobado', 'rechazado']),
    amount: z.number().int().positive(),
  }),
});
export type FakePayEvent = z.infer<typeof fakePayEventSchema>;

function computeHmac(secret: string, timestamp: number, body: Buffer | string): string {
  return createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex');
}

// La firma incluye el timestamp: así no se puede cambiar la hora sin romper la firma.
export function signFakePayBody(secret: string, body: Buffer | string, now = Date.now()): string {
  const timestamp = Math.floor(now / 1000);
  return `t=${timestamp},v1=${computeHmac(secret, timestamp, body)}`;
}

export function isValidFakePaySignature(
  secret: string,
  header: string | undefined,
  rawBody: Buffer,
  now = Date.now(),
): boolean {
  if (!header) {
    return false;
  }

  const parts = new Map(
    header.split(',').map((part): [string, string] => {
      const index = part.indexOf('=');
      return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
    }),
  );
  const timestamp = Number(parts.get('t'));
  const signature = parts.get('v1');
  if (!Number.isInteger(timestamp) || !signature) {
    return false;
  }

  if (Math.abs(Math.floor(now / 1000) - timestamp) > TOLERANCE_SECONDS) {
    return false;
  }

  const expected = Buffer.from(computeHmac(secret, timestamp, rawBody), 'hex');
  const received = Buffer.from(signature, 'hex');
  // timingSafeEqual tarda lo mismo acierte o no: no deja adivinar la firma byte a byte
  // midiendo tiempos. Exige largos iguales, por eso se compara el largo antes.
  return received.length === expected.length && timingSafeEqual(received, expected);
}
