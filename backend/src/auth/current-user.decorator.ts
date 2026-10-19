import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import type { AccessTokenPayload } from './auth.types.js';

// Entrega el usuario autenticado en un controlador: @CurrentUser() user
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessTokenPayload => {
    const request = context.switchToHttp().getRequest<Request>();

    if (!request.user) {
      throw new UnauthorizedException('No autenticado');
    }

    return request.user;
  },
);
