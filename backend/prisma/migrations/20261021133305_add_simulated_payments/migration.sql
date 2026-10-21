-- AlterEnum
ALTER TYPE "payment_provider" ADD VALUE 'simulado';

-- AlterTable
ALTER TABLE "order_status_history" ALTER COLUMN "changed_by_id" DROP NOT NULL;

-- =============================================
-- Ventanilla para webhooks de pago (SECURITY DEFINER)
-- El webhook llega sin JWT: todavía no se conoce la empresa y RLS no deja ver nada.
-- Esta función responde una sola pregunta exacta ("¿de qué empresa y pedido es este
-- pago?"), sin permitir listar pagos. Con el tenant_id que devuelve, el backend abre
-- forTenant() normal y todo lo demás pasa por RLS.
-- search_path vacío + nombres completos: nadie puede colarle otra tabla.
-- =============================================

CREATE FUNCTION payment_find_by_external_id(
  p_provider public.payment_provider,
  p_external_id text
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  order_id uuid
)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT p.id, p.tenant_id, p.order_id
  FROM public.payments p
  WHERE p.provider = p_provider
    AND p.external_id = p_external_id
$$;

-- Por defecto cualquier rol puede ejecutar funciones: se cierra y se abre solo a la app.
REVOKE ALL ON FUNCTION payment_find_by_external_id(public.payment_provider, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION payment_find_by_external_id(public.payment_provider, text) TO orderhub_app;