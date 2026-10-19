import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import type { AuthUser, LoginInput } from '@orderhub/shared';

import type { Env } from '../config/env.schema.js';
import { PrismaService } from '../database/prisma.service.js';
import type { AccessTokenPayload, SessionTokens } from './auth.types.js';

// SHA-256 basta para el refresh token: son 48 bytes al azar, imposibles de adivinar.
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

// Deja solo los campos públicos (nunca el passwordHash).
const toAuthUser = ({ id, name, email, role, tenant }: AuthUser): AuthUser => ({
  id,
  name,
  email,
  role,
  tenant: { id: tenant.id, name: tenant.name },
});

const tenantSelect = { tenant: { select: { id: true, name: true } } } as const;

@Injectable()
export class AuthService {
  // Hash falso para comparar cuando el correo no existe (ver login).
  private readonly dummyHash = hash('usuario-inexistente');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login({ email, password }: LoginInput): Promise<SessionTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: tenantSelect,
    });

    // Siempre se ejecuta Argon2, exista o no el correo: así el tiempo de
    // respuesta no revela qué correos están registrados.
    const passwordOk = await verify(user?.passwordHash ?? (await this.dummyHash), password);

    if (!user || !passwordOk) {
      throw new UnauthorizedException('Correo o clave incorrectos');
    }

    return this.issueSession(toAuthUser(user), randomUUID());
  }

  async refresh(refreshToken: string): Promise<SessionTokens> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: { include: tenantSelect } },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Sesión expirada');
    }

    // Un token ya rotado se volvió a usar: posible robo. Se cierra toda la familia.
    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Sesión inválida');
    }

    // Rotación: el token actual se revoca y se entrega uno nuevo de la misma familia.
    // El filtro revokedAt: null asegura que solo una petición pueda usarlo.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      throw new UnauthorizedException('Sesión inválida');
    }

    return this.issueSession(toAuthUser(stored.user), stored.familyId);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: tenantSelect,
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return toAuthUser(user);
  }

  private async issueSession(user: AuthUser, familyId: string): Promise<SessionTokens> {
    const payload: AccessTokenPayload = { sub: user.id, tenantId: user.tenant.id, role: user.role };
    const accessToken = await this.jwt.signAsync(payload);

    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.config.get('JWT_REFRESH_TTL', { infer: true })),
      },
    });

    return { accessToken, refreshToken, user };
  }
}
