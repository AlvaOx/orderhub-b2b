import { z } from 'zod';

// Estados de un pago (mismos valores que el enum payment_status de la base).
export const paymentStatusSchema = z.enum([
  'pendiente',
  'aprobado',
  'rechazado',
  'cancelado',
  'reembolsado',
]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

// Respuesta de POST /api/orders/:number/payment: adónde mandar al usuario a pagar.
export type CheckoutSession = { checkoutUrl: string };

// Id del checkout simulado en la URL (/pago-simulado/<externalId>).
export const checkoutIdParamSchema = z.uuid('Pago inválido');

// Lo que muestra la página de checkout simulada.
export type SimulatedCheckout = {
  externalId: string;
  orderNumber: number;
  amount: number;
  status: PaymentStatus;
};

// Lo que el usuario elige en el checkout simulado.
export const simulatedDecisionSchema = z.object({
  decision: z.enum(['aprobar', 'rechazar']),
});
export type SimulatedDecisionInput = z.infer<typeof simulatedDecisionSchema>;

// Respuesta al decidir: a qué pedido volver y cómo quedó el pago.
export type SimulatedDecisionResult = { orderNumber: number; status: PaymentStatus };
