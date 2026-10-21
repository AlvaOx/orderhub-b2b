import { WAREHOUSE_VISIBLE_STATUSES } from '@orderhub/shared';

import type { AccessTokenPayload } from '../auth/auth.types.js';
import type { Prisma } from '../generated/prisma/client.js';

// Qué pedidos ve cada rol DENTRO de su empresa (RLS ya limita a la empresa).
// La usan pedidos (listado, detalle, estados, cancelar) y pagos: lo que no ves,
// no lo abres, no lo cambias y no lo pagas.
// Switch exhaustivo: un rol nuevo sin su regla no compila.
export function scopeForRole({ role, sub }: AccessTokenPayload): Prisma.OrderWhereInput {
  switch (role) {
    case 'admin':
      return {};
    case 'vendedor':
      return { sellerId: sub };
    case 'bodega':
      return { status: { in: [...WAREHOUSE_VISIBLE_STATUSES] } };
  }
}
