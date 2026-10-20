import { Injectable } from '@nestjs/common';
import type { ProductListItem } from '@orderhub/shared';

import type { AccessTokenPayload } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';

// Tope de seguridad: un catálogo enorme nunca se trae entero por accidente.
const MAX_PRODUCTS = 500;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AccessTokenPayload): Promise<ProductListItem[]> {
    return this.prisma.forTenant(user.tenantId, (tx) =>
      tx.product.findMany({
        // Dos capas: where por empresa + RLS en la base.
        where: { tenantId: user.tenantId },
        orderBy: { sku: 'asc' },
        take: MAX_PRODUCTS,
        select: { id: true, sku: true, name: true, price: true, stock: true },
      }),
    );
  }
}
