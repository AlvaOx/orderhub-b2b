import type { AccessTokenPayload } from '../auth/auth.types.js';

// Agrega "user" al Request de Express: lo completa el JwtAuthGuard.
declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export {};
