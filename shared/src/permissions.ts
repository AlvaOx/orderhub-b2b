import type { Role } from './auth.js';

// Acciones que se pueden permitir o negar. Formato: recurso:acción.
export const PERMISSIONS = [
  'orders:read',
  'orders:create',
  'orders:update_status',
  'products:read',
  'products:manage',
  'users:manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// Matriz de permisos por rol: única fuente de verdad para el backend (guard)
// y el frontend (qué se muestra). Si se agrega un rol sin su fila, o un
// permiso que no existe, TypeScript no compila.
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  // El admin es dueño de su empresa: recibe todos los permisos, incluidos los futuros.
  admin: PERMISSIONS,
  vendedor: ['orders:read', 'orders:create', 'products:read'],
  bodega: ['orders:read', 'orders:update_status'],
};

// ¿Este rol tiene este permiso?
export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
