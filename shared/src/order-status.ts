import { z } from 'zod';

export const orderStatusSchema = z.enum([
  'pendiente_pago',
  'pagado',
  'preparando',
  'despachado',
  'entregado',
  'cancelado',
]);

export type OrderStatus = z.infer<typeof orderStatusSchema>;

// Flujo de bodega: cada estado avanza solo al siguiente (no se salta ni se retrocede).
// pendiente_pago -> pagado NO está aquí: lo hace solo el webhook de Mercado Pago (Fase 2).
export const NEXT_FULFILLMENT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pagado: 'preparando',
  preparando: 'despachado',
  despachado: 'entregado',
};

// Por ahora solo se cancela lo que no está pagado: cancelar un pagado exige reembolso (Fase 2).
export const CANCELLABLE_STATUSES: readonly OrderStatus[] = ['pendiente_pago'];

// Avanzar el estado: el cliente dice A QUÉ estado quiere pasar (lo que vio en pantalla).
// Si el pedido cambió mientras tanto, la transición no calza y el backend responde 409.
export const advanceOrderStatusSchema = z.object({
  status: orderStatusSchema,
});
export type AdvanceOrderStatusInput = z.infer<typeof advanceOrderStatusSchema>;
