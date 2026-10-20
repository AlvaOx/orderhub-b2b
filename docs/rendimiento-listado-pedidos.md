# Rendimiento: listado de pedidos

Medición del endpoint `GET /api/orders` (rol bodega, Ferretería Andes: 10.000 pedidos,
25.013 ítems; la base tiene 20.000 pedidos y ~50.000 ítems en total).
Postgres 18, ejecutado como `orderhub_app` con RLS activo, página de 25 (+1).

## Problema

El `_count` de Prisma se traduce en un `LEFT JOIN` contra un `GROUP BY` de **todos** los
ítems de la empresa. Postgres no puede cortar en 26 filas: junta y ordena todo.

```
Limit
  -> Sort (top-N heapsort)                         7.450 filas
     -> Hash Right Join
        -> HashAggregate                          10.000 grupos
           -> Seq Scan on order_items             49.927 leídas, 25.013 tras RLS
        -> Bitmap Heap Scan on orders              7.450 filas
Execution Time: 35.845 ms   Buffers: 774
```

## Solución

1. Pedidos de la página **sin JOIN**: `ORDER BY number DESC LIMIT 26`.
2. Conteo de ítems **solo de esos 25 pedidos** con `groupBy ... WHERE order_id IN (...)`.

```
-- 1) Pedidos
Limit
  -> Index Scan Backward using orders_tenant_id_number_key   39 leídas (26 + 13 filtradas)
Execution Time: 0.120 ms   Buffers: 4

-- 2) Conteo de ítems
GroupAggregate                                             25 grupos
  -> Bitmap Index Scan on order_items_order_id_idx         64 filas
Execution Time: 0.244 ms   Buffers: 26
```

## Resultado

|                       | Antes                 | Después                |
| --------------------- | --------------------- | ---------------------- |
| Consultas por request | 2                     | 3                      |
| Filas leídas          | 7.450 + 49.927        | 39 + 64                |
| Buffers               | 774                   | 30                     |
| Tiempo en la base     | 35,8 ms               | 0,36 ms                |
| Escala con            | el tamaño de la tabla | el tamaño de la página |

El costo de una página ahora depende del tamaño de la página, no del de la tabla.

## Cómo reproducirlo

1. `DB_LOG_QUERIES=true` en el `.env` para ver el SQL que genera Prisma.
2. En una transacción: `SET LOCAL ROLE orderhub_app`, `set_config('app.tenant_id', ..., true)`
   y `EXPLAIN (ANALYZE, BUFFERS)` de cada consulta. Terminar con `ROLLBACK`.
