import { z } from 'zod';

import { type OrderStatus, orderStatusSchema } from './order-status.js';

export const ORDERS_PAGE_SIZE = 25;
export const ORDERS_MAX_PAGE_SIZE = 100;

// Estados que ve bodega: desde que el pedido está pagado en adelante.
export const WAREHOUSE_VISIBLE_STATUSES = [
  'pagado',
  'preparando',
  'despachado',
  'entregado',
] as const satisfies readonly OrderStatus[];

// Filtros del listado. Llegan en la URL, donde todo es texto: coerce los convierte.
export const listOrdersQuerySchema = z.object({
  // Marcapáginas: devuelve pedidos con número MENOR a este (del más nuevo al más antiguo).
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(ORDERS_MAX_PAGE_SIZE).default(ORDERS_PAGE_SIZE),
  status: orderStatusSchema.optional(),
  sellerId: z.uuid().optional(),
  // Búsqueda exacta por número de pedido.
  number: z.coerce.number().int().positive().optional(),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

// Una fila del listado. Las fechas viajan en JSON como texto ISO.
export type OrderListItem = {
  id: string;
  number: number;
  status: OrderStatus;
  total: number;
  itemsCount: number;
  createdAt: string;
  seller: { id: string; name: string };
};

// Una página del listado. nextCursor es null cuando no hay más pedidos.
export type OrdersPage = {
  items: OrderListItem[];
  nextCursor: number | null;
};
