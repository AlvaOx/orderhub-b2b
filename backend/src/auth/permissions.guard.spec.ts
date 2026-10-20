import {
  type ExecutionContext,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Role, roleSchema } from '@orderhub/shared';
import { beforeAll, describe, expect, it } from 'vitest';

import type { AccessTokenPayload } from './auth.types.js';
import { Authenticated } from './authenticated.decorator.js';
import { PermissionsGuard } from './permissions.guard.js';
import { Public } from './public.decorator.js';
import { RequirePermissions } from './require-permissions.decorator.js';

// ---------- Controladores falsos: solo importan sus decoradores ----------
class FakeController {
  @Public()
  publicRoute(): void {}

  @Authenticated()
  meRoute(): void {}

  @RequirePermissions('orders:create')
  createOrder(): void {}

  @RequirePermissions('orders:read', 'orders:update_status')
  updateStatus(): void {}

  // Sin decorador: debe bloquearse (falla cerrada).
  undeclared(): void {}
}

@RequirePermissions('users:manage')
class ClassLevelController {
  // El permiso del método reemplaza al de la clase.
  @RequirePermissions('orders:read')
  readOrders(): void {}

  // Hereda el permiso de la clase.
  manageUsers(): void {}
}

type Controller = new () => object;

// Arma el contexto que Nest le pasaría al guard, con el rol que queremos probar.
function contextFor(controller: Controller, handler: string, role?: Role): ExecutionContext {
  const method = (controller.prototype as Record<string, unknown>)[handler];
  if (typeof method !== 'function') {
    throw new Error(`El controlador no tiene el método ${handler}`);
  }

  const user: AccessTokenPayload | undefined = role
    ? { sub: 'user-1', tenantId: 'tenant-1', role }
    : undefined;
  const request = { user };

  return {
    getHandler: () => method,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());
  const roles = roleSchema.options;

  beforeAll(() => {
    // Silencia el aviso de "ruta sin permisos" en la salida de los tests.
    Logger.overrideLogger(false);
  });

  it('deja pasar una ruta pública sin sesión', () => {
    expect(guard.canActivate(contextFor(FakeController, 'publicRoute'))).toBe(true);
  });

  it('responde 401 en una ruta privada sin usuario', () => {
    expect(() => guard.canActivate(contextFor(FakeController, 'meRoute'))).toThrow(
      UnauthorizedException,
    );
  });

  it.each(roles)('@Authenticated deja pasar a cualquier rol (%s)', (role) => {
    expect(guard.canActivate(contextFor(FakeController, 'meRoute', role))).toBe(true);
  });

  it.each(['admin', 'vendedor'] as const)('%s puede crear pedidos', (role) => {
    expect(guard.canActivate(contextFor(FakeController, 'createOrder', role))).toBe(true);
  });

  it('bodega no puede crear pedidos (403)', () => {
    expect(() => guard.canActivate(contextFor(FakeController, 'createOrder', 'bodega'))).toThrow(
      ForbiddenException,
    );
  });

  it('exige TODOS los permisos declarados', () => {
    expect(guard.canActivate(contextFor(FakeController, 'updateStatus', 'bodega'))).toBe(true);
    expect(() => guard.canActivate(contextFor(FakeController, 'updateStatus', 'vendedor'))).toThrow(
      ForbiddenException,
    );
  });

  it('el permiso del método reemplaza al de la clase', () => {
    expect(guard.canActivate(contextFor(ClassLevelController, 'readOrders', 'vendedor'))).toBe(
      true,
    );
    expect(() =>
      guard.canActivate(contextFor(ClassLevelController, 'manageUsers', 'vendedor')),
    ).toThrow(ForbiddenException);
    expect(guard.canActivate(contextFor(ClassLevelController, 'manageUsers', 'admin'))).toBe(true);
  });

  it.each(roles)('falla cerrada: una ruta sin declarar se bloquea (%s)', (role) => {
    expect(() => guard.canActivate(contextFor(FakeController, 'undeclared', role))).toThrow(
      ForbiddenException,
    );
  });
});
