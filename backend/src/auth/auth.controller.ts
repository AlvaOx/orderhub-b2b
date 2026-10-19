import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type AuthUser, type LoginInput, loginSchema } from '@orderhub/shared';
import type { CookieOptions, Request, Response } from 'express';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import type { Env } from '../config/env.schema.js';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import type { AccessTokenPayload, SessionTokens } from './auth.types.js';
import { CurrentUser } from './current-user.decorator.js';
import { Public } from './public.decorator.js';

// El refresh token solo viaja a las rutas de auth, no a todas las peticiones.
const REFRESH_COOKIE_PATH = '/api/auth';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    const session = await this.auth.login(body);
    this.setSessionCookies(res, session);
    return session.user;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthUser> {
    const token: unknown = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (typeof token !== 'string') {
      throw new UnauthorizedException('No autenticado');
    }

    const session = await this.auth.refresh(token);
    this.setSessionCookies(res, session);
    return session.user;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const token: unknown = req.cookies?.[REFRESH_TOKEN_COOKIE];
    await this.auth.logout(typeof token === 'string' ? token : undefined);

    res.clearCookie(ACCESS_TOKEN_COOKIE, this.cookieOptions('/'));
    res.clearCookie(REFRESH_TOKEN_COOKIE, this.cookieOptions(REFRESH_COOKIE_PATH));
  }

  @Get('me')
  me(@CurrentUser() user: AccessTokenPayload): Promise<AuthUser> {
    return this.auth.me(user.sub);
  }

  private cookieOptions(path: string): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      sameSite: 'lax',
      path,
    };
  }

  private setSessionCookies(res: Response, session: SessionTokens): void {
    res.cookie(ACCESS_TOKEN_COOKIE, session.accessToken, {
      ...this.cookieOptions('/'),
      maxAge: this.config.get('JWT_ACCESS_TTL', { infer: true }),
    });
    res.cookie(REFRESH_TOKEN_COOKIE, session.refreshToken, {
      ...this.cookieOptions(REFRESH_COOKIE_PATH),
      maxAge: this.config.get('JWT_REFRESH_TTL', { infer: true }),
    });
  }
}
