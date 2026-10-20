import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { can, type Permission } from '@orderhub/shared';
import type { Request } from 'express';

import { IS_AUTHENTICATED_KEY } from './authenticated.decorator.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { PERMISSIONS_KEY } from './require-permissions.decorator.js';

// Corre después del JwtAuthGuard: ya sabemos quién es, ahora vemos qué puede hacer.
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // El decorador del método reemplaza al de la clase (no se suman).
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<Request>();
    if (!user) {
      throw new UnauthorizedException('No autenticado');
    }

    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(
      PERMISSIONS_KEY,
      targets,
    );
    if (required) {
      if (required.every((permission) => can(user.role, permission))) {
        return true;
      }
      throw new ForbiddenException('No tienes permiso para esta acción');
    }

    if (this.reflector.getAllAndOverride<boolean>(IS_AUTHENTICATED_KEY, targets)) {
      return true;
    }

    // Falla cerrada: la ruta no declaró @Public, @Authenticated ni @RequirePermissions.
    this.logger.warn(
      `Ruta sin permisos declarados: ${context.getClass().name}.${context.getHandler().name}`,
    );
    throw new ForbiddenException('Acceso denegado');
  }
}
