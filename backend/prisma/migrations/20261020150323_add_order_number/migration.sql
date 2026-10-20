-- =============================================
-- Número de pedido correlativo por empresa
-- Funciona sobre una base con datos: numera los pedidos existentes
-- antes de marcar la columna como obligatoria.
-- =============================================

-- Talonario de cada empresa: último número de pedido usado.
ALTER TABLE "tenants" ADD COLUMN "order_seq" INTEGER NOT NULL DEFAULT 0;

-- 1) Columna opcional, para poder rellenar los pedidos existentes.
ALTER TABLE "orders" ADD COLUMN "number" INTEGER;

-- 2) Numera los pedidos de cada empresa en orden de creación (1, 2, 3...).
UPDATE "orders" o
SET "number" = n.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY tenant_id ORDER BY created_at, id) AS rn
  FROM "orders"
) n
WHERE o.id = n.id;

-- 3) Deja el talonario de cada empresa en su último número usado.
UPDATE "tenants" t
SET "order_seq" = COALESCE(
  (SELECT max(o."number") FROM "orders" o WHERE o.tenant_id = t.id),
  0
);

-- 4) Ya numerados: obligatorio y único por empresa.
ALTER TABLE "orders" ALTER COLUMN "number" SET NOT NULL;
CREATE UNIQUE INDEX "orders_tenant_id_number_key" ON "orders"("tenant_id", "number");