import { z } from 'zod';

const MS_PER_UNIT = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

// "15m" -> 900000 (milisegundos). Formato: número + s|m|h|d.
const durationSchema = z
  .string()
  .regex(/^\d+[smhd]$/, 'Formato esperado: número + s, m, h o d (ej: 15m, 7d)')
  .transform((value) => {
    const unit = value.slice(-1) as keyof typeof MS_PER_UNIT;
    return Number(value.slice(0, -1)) * MS_PER_UNIT[unit];
  });

// Lo que el backend necesita para arrancar. Si falta algo, no arranca.
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_URL: z.url(),
  // URL base con la que el backend se llama a sí mismo (sin /api). La pasarela simulada
  // envía sus webhooks aquí, igual que una pasarela real llamaría a nuestro servidor.
  API_INTERNAL_URL: z.url(),
  DATABASE_URL: z.url(),
  // Imprime cada SQL de Prisma en la consola (para revisar N+1 y medir). Apagado por defecto.
  // stringbool entiende "true"/"false"; coerce.boolean convertiría "false" en true.
  DB_LOG_QUERIES: z.stringbool().default(false),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: durationSchema,
  JWT_REFRESH_TTL: durationSchema,
  // Secreto compartido con la pasarela simulada para firmar sus webhooks (HMAC-SHA256).
  FAKE_PAY_WEBHOOK_SECRET: z.string().min(32),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }

  return result.data;
}
