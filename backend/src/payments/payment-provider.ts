import type { Prisma } from '../generated/prisma/client.js';

// Proveedores soportados (mismos valores que el enum payment_provider de la base).
export type PaymentProviderName = 'mercadopago' | 'simulado';

// Resultado final de un pago según la pasarela.
export type PaymentOutcome = 'aprobado' | 'rechazado';

export type CheckoutRequest = { amount: number; orderNumber: number };

// Lo que devuelve la pasarela al abrir un checkout: su id y adónde mandar al usuario.
export type CreatedCheckout = { externalId: string; checkoutUrl: string };

// Un webhook ya verificado y traducido a nuestro idioma, sea cual sea la pasarela.
export type PaymentEvent = {
  // Id del EVENTO (no del pago): la llave de idempotencia en webhook_events.
  eventId: string;
  externalId: string;
  outcome: PaymentOutcome;
  amount: number;
  // El evento tal cual llegó, para guardarlo en webhook_events (auditoría).
  payload: Prisma.InputJsonValue;
};

type WebhookHeaders = Record<string, string | string[] | undefined>;

/**
 * El "enchufe" de pagos (patrón adapter). El resto de la app solo conoce esta interfaz:
 * para usar Mercado Pago se escribe otra implementación y no se toca nada más.
 */
export interface PaymentProvider {
  readonly name: PaymentProviderName;

  // Abre una sesión de pago en la pasarela.
  createCheckout(request: CheckoutRequest): Promise<CreatedCheckout>;

  // Verifica la firma del webhook y lo traduce a PaymentEvent.
  // Lanza 401 si la firma no es válida y 400 si el mensaje no tiene la forma esperada.
  parseWebhook(rawBody: Buffer, headers: WebhookHeaders): PaymentEvent;
}

// Token de inyección: los servicios piden "un PaymentProvider", no una clase concreta.
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
