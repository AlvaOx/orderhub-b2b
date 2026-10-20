import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@orderhub/shared';

export const PERMISSIONS_KEY = 'permissions';

// Exige que el rol del usuario tenga TODOS estos permisos.
// Pide al menos uno: un decorador vacío dejaría la ruta abierta.
export const RequirePermissions = (...permissions: [Permission, ...Permission[]]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
