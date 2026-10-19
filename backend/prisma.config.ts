import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Carga el .env de la raíz del monorepo.
config({ path: '../.env' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
