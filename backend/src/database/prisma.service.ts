import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import type { Env } from '../config/env.schema.js';
import { type Prisma, PrismaClient } from '../generated/prisma/client.js';

// Cliente de Prisma dentro de una transacción (lo que recibe el callback de forTenant).
export type TenantClient = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL', { infer: true }) }),
      // Con DB_LOG_QUERIES=true se ve cada SQL en la consola (solo para desarrollo).
      log: config.get('DB_LOG_QUERIES', { infer: true }) ? ['query', 'warn', 'error'] : ['error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Ejecuta `fn` en una transacción donde RLS solo deja ver y escribir filas de `tenantId`.
   *
   * La transacción amarra todas las consultas a una misma conexión del pool.
   * set_config(..., true) equivale a SET LOCAL (se borra al terminar la
   * transacción), pero acepta parámetros: sin riesgo de inyección SQL.
   * El tenantId siempre viene del JWT, nunca del request.
   */
  forTenant<T>(tenantId: string, fn: (tx: TenantClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    });
  }
}
