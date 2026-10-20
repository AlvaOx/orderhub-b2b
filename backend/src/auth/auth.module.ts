import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import type { Env } from '../config/env.schema.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PermissionsGuard } from './permissions.guard.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        // JWT usa segundos; la configuración guarda milisegundos.
        signOptions: {
          expiresIn: Math.floor(config.get('JWT_ACCESS_TTL', { infer: true }) / 1000),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Guards globales. El ORDEN importa: Nest los ejecuta en el orden en que se registran.
    // 1) ¿Quién eres? Todas las rutas exigen sesión, salvo @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // 2) ¿Qué puedes hacer? Permisos por rol; una ruta sin declarar se bloquea.
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AuthModule {}
