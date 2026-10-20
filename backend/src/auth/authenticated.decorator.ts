import { SetMetadata } from '@nestjs/common';

export const IS_AUTHENTICATED_KEY = 'isAuthenticated';

// Basta con tener sesión, sin un permiso específico (ej: /auth/me).
// Se declara a propósito: una ruta sin nada se bloquea (falla cerrada).
export const Authenticated = () => SetMetadata(IS_AUTHENTICATED_KEY, true);
