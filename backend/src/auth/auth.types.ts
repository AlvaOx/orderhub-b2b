import type { AuthUser, Role } from '@orderhub/shared';

// Lo que va dentro del access token (JWT). Nada sensible: el JWT se puede leer.
export type AccessTokenPayload = {
  sub: string; // id del usuario
  tenantId: string;
  role: Role;
};

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};
