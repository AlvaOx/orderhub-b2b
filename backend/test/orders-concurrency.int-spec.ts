// =============================================
// Crear pedidos en paralelo (test de integración)
// Muchos pedidos AL MISMO TIEMPO contra Postgres real, con el rol de la app y RLS.
// Prueba que el stock nunca queda negativo, que el talonario no repite ni salta
// números y que no hay deadlocks cuando dos pedidos tocan los mismos productos.
// A diferencia de rls.int-spec, aquí las transacciones SÍ se confirman (son paralelas),
// así que el test crea su propia empresa y la borra al final.
// Ejecutar: pnpm --filter @orderhub/backend test:integration
// =============================================
import { randomUUID } from 'node:crypto';

import { ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AccessTokenPayload } from '../src/auth/auth.types.js';
import type { Env } from '../src/config/env.schema.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { OrdersService } from '../src/orders/orders.service.js';

config({ path: '../.env', quiet: true });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta ${name} para los tests de integración`);
  }
  return value;
}

const appUrl = requireEnv('DATABASE_URL');

// Admin: prepara y limpia los datos de prueba (sin RLS).
const admin = new PrismaClient({
  adapter: new PrismaPg({ connectionString: requireEnv('DATABASE_ADMIN_URL') }),
});

// App: el mismo PrismaService y OrdersService del backend, con el rol sin privilegios y RLS.
const appConfig = {
  get: (key: string) => (key === 'DATABASE_URL' ? appUrl : false),
} as unknown as ConfigService<Env, true>;
const prisma = new PrismaService(appConfig);
const orders = new OrdersService(prisma);

let tenantId = '';
let seller: AccessTokenPayload;

const isRejected = (result: PromiseSettledResult<unknown>): result is PromiseRejectedResult =>
  result.status === 'rejected';

function createProduct(stock: number) {
  return admin.product.create({
    data: {
      tenantId,
      sku: `CONC-${randomUUID().slice(0, 8)}`,
      name: 'Producto de prueba',
      price: 1_000,
      stock,
    },
  });
}

describe('Crear pedidos en paralelo', () => {
  beforeAll(async () => {
    const unique = randomUUID();
    const tenant = await admin.tenant.create({
      data: { name: 'Empresa concurrencia', slug: `conc-${unique}` },
    });
    tenantId = tenant.id;

    const user = await admin.user.create({
      data: {
        tenantId,
        name: 'Vendedor concurrencia',
        email: `conc-${unique}@test.local`,
        passwordHash: 'no-se-usa',
        role: 'vendedor',
      },
    });
    seller = { sub: user.id, tenantId, role: 'vendedor' };
  });

  afterAll(async () => {
    // Borra todo lo de la empresa de prueba (los ítems caen en cascada con los pedidos).
    if (tenantId) {
      await admin.$transaction([
        admin.order.deleteMany({ where: { tenantId } }),
        admin.product.deleteMany({ where: { tenantId } }),
        admin.user.deleteMany({ where: { tenantId } }),
        admin.tenant.delete({ where: { id: tenantId } }),
      ]);
    }
    await Promise.all([admin.$disconnect(), prisma.$disconnect()]);
  });

  it('20 pedidos por las últimas 5 unidades: pasan 5, stock en 0 y talonario #1 a #5', async () => {
    const product = await createProduct(5);

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        orders.create(seller, { items: [{ productId: product.id, quantity: 1 }] }),
      ),
    );

    const created = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    const rejected = results.filter(isRejected);

    // Exactamente 5 pasan; los otros 15 reciben "sin stock" (409), no otro error.
    expect(created).toHaveLength(5);
    expect(rejected).toHaveLength(15);
    expect(rejected.every((r) => r.reason instanceof ConflictException)).toBe(true);

    // El stock nunca queda negativo.
    const after = await admin.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.stock).toBe(0);

    // Talonario: 1 a 5, sin repetir ni saltar (los pedidos fallidos no gastan número).
    const numbers = created.map((order) => order.number).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5]);
    const tenant = await admin.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    expect(tenant.orderSeq).toBe(5);
  });

  it('pedidos con los mismos productos en orden inverso no se bloquean en cruz (sin deadlock)', async () => {
    const a = await createProduct(100);
    const b = await createProduct(100);

    // La mitad pide A+B y la otra mitad B+A, todos al mismo tiempo.
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        orders.create(seller, {
          items:
            i % 2 === 0
              ? [
                  { productId: a.id, quantity: 1 },
                  { productId: b.id, quantity: 1 },
                ]
              : [
                  { productId: b.id, quantity: 1 },
                  { productId: a.id, quantity: 1 },
                ],
        }),
      ),
    );

    // Ningún error (un deadlock aparecería aquí como "deadlock detected").
    const failures = results.filter(isRejected).map((r) => String(r.reason));
    expect(failures).toEqual([]);

    const [afterA, afterB] = await Promise.all([
      admin.product.findUniqueOrThrow({ where: { id: a.id } }),
      admin.product.findUniqueOrThrow({ where: { id: b.id } }),
    ]);
    expect(afterA.stock).toBe(80);
    expect(afterB.stock).toBe(80);
  });
});
