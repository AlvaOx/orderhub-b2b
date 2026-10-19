import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module.js';
import type { Env } from './config/env.schema.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Todas las rutas quedan bajo /api (ej: /api/auth/login).
  app.setGlobalPrefix('api');

  // Permite leer las cookies de sesión en request.cookies.
  app.use(cookieParser());

  // Solo el frontend puede llamar a esta API desde el navegador.
  app.enableCors({
    origin: config.get('FRONTEND_URL', { infer: true }),
    credentials: true,
  });

  await app.listen(config.get('API_PORT', { infer: true }));
}
await bootstrap();
