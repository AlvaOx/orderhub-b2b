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
