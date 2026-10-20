-- =============================================
-- Rol de la aplicación (orderhub_app)
-- Sin superusuario y sin saltarse RLS. La clave NO va aquí (se sube a Git):
-- se aplica con `pnpm --filter @orderhub/backend db:app-role`.
-- =============================================

-- Los roles son del servidor completo, no de una base. Prisma ejecuta las
-- migraciones también en una base sombra, así que esto debe ser idempotente.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orderhub_app') THEN
    CREATE ROLE orderhub_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

-- Permiso para conectarse a esta base (sea cual sea su nombre).
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO orderhub_app', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO orderhub_app;

-- Solo leer y escribir filas. Sin TRUNCATE, sin DDL y sin acceso a _prisma_migrations.
-- Permisos explícitos por tabla: una tabla nueva sin GRANT falla cerrada.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  tenants,
  users,
  products,
  orders,
  order_items,
  payments,
  webhook_events,
  refresh_tokens
TO orderhub_app;