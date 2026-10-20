import { z } from 'zod';

import { type OrderStatus, orderStatusSchema } from './order-status.js';

export const ORDERS_PAGE_SIZE = 25;
export const ORDERS_MAX_PAGE_SIZE = 100;

// Límites de un pedido nuevo.
export const MAX_ORDER_LINES = 50;
export const MAX_LINE_QUANTITY = 9_999;
// Máximo de una columna INTEGER en Postgres (el total del pedido se guarda ahí).
export const MAX_ORDER_TOTAL = 2_147_483_647;

// Estados que ve bodega: desde que el pedido está pagado en adelante.
export const WAREHOUSE_VISIBLE_STATUSES = [
  'pagado',
  'preparando',
  'despachado',
  'entregado',
] as const satisfies readonly OrderStatus[];

// ---------- Listado ----------

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

// ---------- Crear pedido ----------

// Una línea: qué producto y cuántas unidades. El precio NUNCA viene del navegador:
// el backend lo lee de la base.
export const createOrderItemSchema = z.object({
  productId: z.uuid('Producto inválido'),
  quantity: z
    .number('La cantidad debe ser un número')
    .int('La cantidad debe ser un número entero')
    .min(1, 'La cantidad mínima es 1')
    .max(MAX_LINE_QUANTITY, `La cantidad máxima por línea es ${MAX_LINE_QUANTITY}`),
});

export const createOrderSchema = z.object({
  items: z
    .array(createOrderItemSchema)
    .min(1, 'Agrega al menos un producto')
    .max(MAX_ORDER_LINES, `Un pedido puede tener hasta ${MAX_ORDER_LINES} líneas`)
    // Cada producto una sola vez: dos líneas iguales descontarían stock por separado.
    .refine(
      (items) => new Set(items.map((item) => item.productId)).size === items.length,
      'Hay productos repetidos: suma las cantidades en una sola línea',
    ),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// Lo que responde el backend al crear un pedido.
export type CreatedOrder = { id: string; number: number };
