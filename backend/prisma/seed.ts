// =============================================
// OrderHub B2B — Seed de datos de prueba
// Crea 3 empresas, usuarios demo por rol, productos y 20.000 pedidos.
// Ejecutar: pnpm --filter @orderhub/backend exec prisma db seed
// =============================================
import { fakerES as faker } from '@faker-js/faker';
import { hash } from '@node-rs/argon2';
import type { OrderStatus } from '@orderhub/shared';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { v7 as uuidv7 } from 'uuid';

import { PrismaClient } from '../src/generated/prisma/client.js';

config({ path: '../.env' });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Semilla fija: cada ejecución genera los mismos nombres, montos y fechas.
faker.seed(42);

const DEMO_PASSWORD = 'Demo1234!';
const PRODUCTS_PER_TENANT = 50;
const BATCH_SIZE = 2_000;

const TENANTS = [
  { name: 'Ferretería Andes', slug: 'andes', skuPrefix: 'AND', orders: 10_000 },
  { name: 'Distribuidora Biobío', slug: 'biobio', skuPrefix: 'BIO', orders: 6_000 },
  { name: 'Comercial Pacífico', slug: 'pacifico', skuPrefix: 'PAC', orders: 4_000 },
] as const;

// Proporción realista: la mayoría de los pedidos de un año ya fueron entregados.
const STATUS_WEIGHTS: { weight: number; value: OrderStatus }[] = [
  { weight: 45, value: 'entregado' },
  { weight: 10, value: 'despachado' },
  { weight: 8, value: 'preparando' },
  { weight: 12, value: 'pagado' },
  { weight: 15, value: 'pendiente_pago' },
  { weight: 10, value: 'cancelado' },
];

type OrderRow = {
  id: string;
  tenantId: string;
  sellerId: string;
  status: OrderStatus;
  total: number;
  createdAt: Date;
  updatedAt: Date;
};

type OrderItemRow = {
  tenantId: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
};

async function insertBatch(orders: OrderRow[], items: OrderItemRow[]): Promise<void> {
  // Primero los pedidos y después sus ítems, porque los ítems apuntan al pedido.
  await prisma.order.createMany({ data: orders });
  await prisma.orderItem.createMany({ data: items });
}

async function seedTenant(t: (typeof TENANTS)[number], passwordHash: string): Promise<void> {
  const tenant = await prisma.tenant.create({ data: { name: t.name, slug: t.slug } });
  const domain = `${t.slug}.test`;

  // Usuarios: uno por rol, más 2 vendedores extra para repartir los pedidos.
  const users = await prisma.user.createManyAndReturn({
    data: [
      { email: `admin@${domain}`, role: 'admin' as const },
      { email: `vendedor@${domain}`, role: 'vendedor' as const },
      { email: `vendedor2@${domain}`, role: 'vendedor' as const },
      { email: `vendedor3@${domain}`, role: 'vendedor' as const },
      { email: `bodega@${domain}`, role: 'bodega' as const },
    ].map((u) => ({ ...u, tenantId: tenant.id, name: faker.person.fullName(), passwordHash })),
    select: { id: true, role: true },
  });
  const sellers = users.filter((u) => u.role === 'vendedor');

  // Productos
  const products = await prisma.product.createManyAndReturn({
    data: Array.from({ length: PRODUCTS_PER_TENANT }, (_, i) => ({
      tenantId: tenant.id,
      sku: `${t.skuPrefix}-${String(i + 1).padStart(4, '0')}`,
      name: faker.commerce.productName(),
      price: faker.number.int({ min: 990, max: 199_990, multipleOf: 10 }),
      stock: faker.number.int({ min: 0, max: 500 }),
    })),
    select: { id: true, price: true },
  });

  // Pedidos e ítems, insertados en bloques
  let orders: OrderRow[] = [];
  let items: OrderItemRow[] = [];

  for (let i = 0; i < t.orders; i++) {
    const createdAt = faker.date.past({ years: 1 });
    // UUID v7 con la fecha del pedido: el orden de los IDs coincide con el de las fechas.
    const orderId = uuidv7({ msecs: createdAt.getTime() });
    let total = 0;

    for (const product of faker.helpers.arrayElements(products, { min: 1, max: 4 })) {
      const quantity = faker.number.int({ min: 1, max: 20 });
      total += quantity * product.price;
      items.push({
        tenantId: tenant.id,
        orderId,
        productId: product.id,
        quantity,
        unitPrice: product.price,
      });
    }

    orders.push({
      id: orderId,
      tenantId: tenant.id,
      sellerId: faker.helpers.arrayElement(sellers).id,
      status: faker.helpers.weightedArrayElement(STATUS_WEIGHTS),
      total,
      createdAt,
      updatedAt: createdAt,
    });

    if (orders.length === BATCH_SIZE) {
      await insertBatch(orders, items);
      orders = [];
      items = [];
    }
  }
  if (orders.length > 0) await insertBatch(orders, items);

  console.log(
    `[seed] ${t.name}: ${users.length} usuarios, ${products.length} productos, ${t.orders} pedidos`,
  );
}

async function main(): Promise<void> {
  console.log('[seed] Limpiando datos anteriores');
  await prisma.$executeRaw`TRUNCATE TABLE order_items, payments, orders, products, users, tenants, webhook_events CASCADE`;

  // Se hashea una sola vez: Argon2 es lento a propósito y todos usan la misma clave demo.
  const passwordHash = await hash(DEMO_PASSWORD);

  const start = Date.now();
  for (const t of TENANTS) {
    await seedTenant(t, passwordHash);
  }
  console.log(`[seed] Completado en ${((Date.now() - start) / 1000).toFixed(1)} s`);
}

try {
  await main();
} catch (error) {
  console.error('[seed] Error:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
