import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Carga el .env de la raíz del monorepo.
config({ path: '../.env' });

// Migraciones y seed usan el superusuario: crean tablas, roles y políticas RLS.
// La app NestJS usa DATABASE_URL, un rol sin privilegios que sí obedece RLS.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_ADMIN_URL'),
  },
});
