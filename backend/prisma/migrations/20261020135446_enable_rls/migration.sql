-- =============================================
-- Row Level Security por empresa (tenant)
-- La app solo ve y escribe filas de app.tenant_id, que el backend define
-- en cada transacción con set_config('app.tenant_id', ..., true).
-- refresh_tokens y webhook_events no llevan RLS: llegan sin empresa conocida.
-- =============================================

-- Empresa de la transacción actual. Si no se definió, devuelve NULL y
-- ninguna política deja pasar filas (falla cerrada).
CREATE FUNCTION app_current_tenant_id() RETURNS uuid
  LANGUAGE sql
  STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

-- ---------- tenants (la empresa se compara por su propio id) ----------
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenants
  USING (id = app_current_tenant_id())
  WITH CHECK (id = app_current_tenant_id());

-- ---------- users ----------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

-- ---------- products ----------
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON products
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

-- ---------- orders ----------
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

-- ---------- order_items ----------
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON order_items
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

-- ---------- payments ----------
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payments
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

-- =============================================
-- Ventanillas para autenticación (SECURITY DEFINER)
-- En el login y el refresh todavía no se conoce la empresa. Estas funciones
-- corren con los permisos de su dueño (se saltan RLS), pero solo responden
-- una pregunta exacta: no permiten listar usuarios.
-- search_path vacío + nombres completos: nadie puede colarles otra tabla.
-- =============================================

-- Login: busca por correo exacto. Devuelve el hash para que Argon2 lo verifique.
CREATE FUNCTION auth_find_user_by_email(p_email text)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  tenant_name text,
  name text,
  email text,
  password_hash text,
  role public.user_role
)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT u.id, u.tenant_id, t.name, u.name, u.email, u.password_hash, u.role
  FROM public.users u
  JOIN public.tenants t ON t.id = u.tenant_id
  WHERE u.email = p_email
$$;

-- Refresh: busca por id exacto. Sin hash de clave (no se necesita).
CREATE FUNCTION auth_find_user_by_id(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  tenant_name text,
  name text,
  email text,
  role public.user_role
)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT u.id, u.tenant_id, t.name, u.name, u.email, u.role
  FROM public.users u
  JOIN public.tenants t ON t.id = u.tenant_id
  WHERE u.id = p_user_id
$$;

-- Por defecto cualquier rol puede ejecutar funciones: se cierra y se abre solo a la app.
REVOKE ALL ON FUNCTION auth_find_user_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_find_user_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_find_user_by_email(text) TO orderhub_app;
GRANT EXECUTE ON FUNCTION auth_find_user_by_id(uuid) TO orderhub_app;