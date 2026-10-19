import type { AuthUser } from '@orderhub/shared';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

// Obtiene el usuario de la sesión desde el servidor de Next, reenviando la cookie al backend.
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token');
  if (!token) return null;

  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: { cookie: `access_token=${token.value}` },
  });
  if (!res.ok) return null;

  return (await res.json()) as AuthUser;
}
