// =============================================
// Aislamiento multi-tenant con RLS (test de integración)
// Requiere Postgres con las migraciones aplicadas (usa DATABASE_ADMIN_URL).
// Cada caso corre en una transacción que termina en ROLLBACK: no deja datos.
// Ejecutar: pnpm --filter @orderhub/backend test:integration
// =============================================
import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { afterAll, describe, expect, it } from 'vitest';

import { type Prisma, PrismaClient } from '../src/generated/prisma/client.js';

config({ path: '../.env', quiet: true });

const adminUrl = process.env.DATABASE_ADMIN_URL;
if (!adminUrl) {
  throw new Error('Falta DATABASE_ADMIN_URL para los tests de integración');
}

// Conexión de admin: crea los datos de prueba y luego se "disfraza" de la app.
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: adminUrl }) });

type Tx = Prisma.TransactionClient;

type TestTenant = { id: string; firstOrderId: string };

// Error lanzado a propósito para que Prisma haga ROLLBACK al final de cada caso.
class Rollback extends Error {}

async function inRollback(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

// Crea una empresa con un vendedor y `orders` pedidos (como admin, sin RLS).
async function createTenant(tx: Tx, label: string, orders: number): Promise<TestTenant> {
  const unique = randomUUID();
  const tenant = await tx.tenant.create({
    data: { name: `Empresa ${label}`, slug: `rls-${label}-${unique}` },
  });
  const seller = await tx.user.create({
    data: {
      tenantId: tenant.id,
      name: `Vendedor ${label}`,
      email: `rls-${label}-${unique}@test.local`,
      passwordHash: 'no-se-usa',
      role: 'vendedor',
    },
  });
  const created = await tx.order.createManyAndReturn({
    data: Array.from({ length: orders }, () => ({
      tenantId: tenant.id,
      sellerId: seller.id,
      total: 10_000,
    })),
    select: { id: true },
  });

  const [first] = created;
  if (!first) {
    throw new Error('No se crearon pedidos de prueba');
  }
  return { id: tenant.id, firstOrderId: first.id };
}

// Desde aquí la transacción actúa como la app: rol sin privilegios y sujeto a RLS.
async function actAsApp(tx: Tx, tenantId?: string): Promise<void> {
  await tx.$executeRaw`SET LOCAL ROLE orderhub_app`;
  if (tenantId) {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
  }
}

const RLS_ERROR = /row-level security/i;

describe('Aislamiento multi-tenant (RLS)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('sin tenant definido no ve ninguna fila (falla cerrada)', async () => {
    await inRollback(async (tx) => {
      await createTenant(tx, 'a', 3);
      await actAsApp(tx);

      expect(await tx.order.count()).toBe(0);
      expect(await tx.tenant.count()).toBe(0);
    });
  });

  it('solo ve las filas de su empresa, incluso sin WHERE', async () => {
    await inRollback(async (tx) => {
      const a = await createTenant(tx, 'a', 3);
      await createTenant(tx, 'b', 2);
      await actAsApp(tx, a.id);

      const orders = await tx.order.findMany({ select: { tenantId: true } });

      expect(orders).toHaveLength(3);
      expect(orders.every((order) => order.tenantId === a.id)).toBe(true);
    });
  });

  it('no puede insertar filas a nombre de otra empresa', async () => {
    await inRollback(async (tx) => {
      const a = await createTenant(tx, 'a', 1);
      const b = await createTenant(tx, 'b', 1);
      await actAsApp(tx, a.id);

      await expect(
        tx.product.create({
          data: { tenantId: b.id, sku: 'HACK-0001', name: 'Producto intruso', price: 1_000 },
        }),
      ).rejects.toThrow(RLS_ERROR);
    });
  });

  it('no puede mover un pedido propio a otra empresa', async () => {
    await inRollback(async (tx) => {
      const a = await createTenant(tx, 'a', 1);
      const b = await createTenant(tx, 'b', 1);
      await actAsApp(tx, a.id);

      await expect(
        tx.order.update({ where: { id: a.firstOrderId }, data: { tenantId: b.id } }),
      ).rejects.toThrow(RLS_ERROR);
    });
  });

  it('no puede modificar pedidos de otra empresa (le son invisibles)', async () => {
    await inRollback(async (tx) => {
      const a = await createTenant(tx, 'a', 1);
      const b = await createTenant(tx, 'b', 2);
      await actAsApp(tx, a.id);

      const { count } = await tx.order.updateMany({
        where: { tenantId: b.id },
        data: { status: 'cancelado' },
      });

      expect(count).toBe(0);
    });
  });

  it('el rol de la app no es superusuario ni puede saltarse RLS', async () => {
    const [role] = await prisma.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'orderhub_app'
    `;

    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it('toda tabla con tenant_id tiene RLS activado y forzado', async () => {
    const tables = await prisma.$queryRaw<{ name: string; enabled: boolean; forced: boolean }[]>`
      SELECT c.relname AS name, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND (
          c.relname = 'tenants'
          OR EXISTS (
            SELECT 1 FROM pg_attribute a
            WHERE a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
          )
        )
      ORDER BY c.relname
    `;

    const unprotected = tables.filter((t) => !t.enabled || !t.forced).map((t) => t.name);

    expect(tables.length).toBeGreaterThan(0);
    expect(unprotected).toEqual([]);
  });
});
