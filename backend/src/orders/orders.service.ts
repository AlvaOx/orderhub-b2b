import { Injectable } from '@nestjs/common';
import {
  type ListOrdersQuery,
  type OrdersPage,
  WAREHOUSE_VISIBLE_STATUSES,
} from '@orderhub/shared';

import type { AccessTokenPayload } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

// Qué pedidos ve cada rol DENTRO de su empresa (RLS ya limita a la empresa).
// Switch exhaustivo: un rol nuevo sin su regla no compila.
function scopeForRole({ role, sub }: AccessTokenPayload): Prisma.OrderWhereInput {
  switch (role) {
    case 'admin':
      return {};
    case 'vendedor':
      return { sellerId: sub };
    case 'bodega':
      return { status: { in: [...WAREHOUSE_VISIBLE_STATUSES] } };
  }
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AccessTokenPayload, query: ListOrdersQuery): Promise<OrdersPage> {
    const where: Prisma.OrderWhereInput = {
      // Capa 1 (app): la empresa del JWT. RLS lo vuelve a exigir en la base.
      tenantId: user.tenantId,
      // AND: la regla del rol se SUMA a los filtros del usuario, nunca se reemplaza.
      AND: [
        scopeForRole(user),
        { status: query.status, sellerId: query.sellerId, number: query.number },
        query.cursor ? { number: { lt: query.cursor } } : {},
      ],
    };

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      // 1) Solo los pedidos de la página. Sin JOIN de conteo, Postgres recorre el
      //    índice (tenant_id, number) hacia atrás y se detiene al llegar a limit + 1.
      const rows = await tx.order.findMany({
        where,
        orderBy: { number: 'desc' },
        // Uno extra para saber si hay otra página, sin hacer COUNT(*).
        take: query.limit + 1,
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          createdAt: true,
          // Sin N+1: Prisma trae todos los vendedores en una sola consulta (WHERE id IN ...).
          seller: { select: { id: true, name: true } },
        },
      });

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page.at(-1);

      // 2) Cantidad de ítems SOLO de los pedidos de esta página (usa el índice
      //    order_items(order_id)). El costo depende del tamaño de la página, no de la tabla.
      //    Antes, el _count de Prisma agrupaba los ítems de TODA la empresa en cada request.
      const counts =
        page.length === 0
          ? []
          : await tx.orderItem.groupBy({
              by: ['orderId'],
              where: { tenantId: user.tenantId, orderId: { in: page.map((order) => order.id) } },
              _count: { _all: true },
            });
      const itemsByOrder = new Map(counts.map((c) => [c.orderId, c._count._all]));

      return {
        items: page.map((order) => ({
          id: order.id,
          number: order.number,
          status: order.status,
          total: order.total,
          itemsCount: itemsByOrder.get(order.id) ?? 0,
          createdAt: order.createdAt.toISOString(),
          seller: order.seller,
        })),
        nextCursor: hasMore && last ? last.number : null,
      };
    });
  }
}
