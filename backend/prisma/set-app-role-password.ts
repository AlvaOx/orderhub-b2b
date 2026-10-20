// OrderHub B2B — Clave del rol de la aplicación

import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

import { PrismaClient } from '../src/generated/prisma/client.js';

config({ path: '../.env' });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable ${name} en el .env`);
  }
  return value;
}

const appUrl = new URL(requireEnv('DATABASE_URL'));
const adminUrl = new URL(requireEnv('DATABASE_ADMIN_URL'));

const role = decodeURIComponent(appUrl.username);
const password = decodeURIComponent(appUrl.password);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: adminUrl.toString() }),
});

async function main(): Promise<void> {
  if (!role || !password) {
    throw new Error('DATABASE_URL debe incluir usuario y clave');
  }
  // La app nunca debe conectarse con el superusuario (se saltaría RLS).
  if (role === decodeURIComponent(adminUrl.username)) {
    throw new Error('DATABASE_URL y DATABASE_ADMIN_URL no pueden usar el mismo usuario');
  }

  // ALTER ROLE no acepta parámetros ($1). Postgres arma la sentencia con
  // format(%I, %L), que escapa el nombre y la clave: sin inyección SQL.
  const [row] = await prisma.$queryRaw<{ sql: string }[]>`
    SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', ${role}::text, ${password}::text) AS sql
  `;
  if (!row) {
    throw new Error('No se pudo armar la sentencia ALTER ROLE');
  }

  await prisma.$executeRawUnsafe(row.sql);
  console.log(`[db:app-role] Clave aplicada al rol ${role}`);
}

try {
  await main();
} catch (error) {
  console.error('[db:app-role] Error:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
