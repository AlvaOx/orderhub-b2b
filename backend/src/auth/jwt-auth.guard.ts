import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { ACCESS_TOKEN_COOKIE } from './auth.constants.js';
import type { AccessTokenPayload } from './auth.types.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Las rutas marcadas con @Public() pasan sin revisar.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token: unknown = request.cookies?.[ACCESS_TOKEN_COOKIE];

    if (typeof token !== 'string') {
      throw new UnauthorizedException('No autenticado');
    }

    try {
      // Verifica la firma y que no esté vencido. Si todo está bien, anota quién es.
      request.user = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    return true;
  }
}
