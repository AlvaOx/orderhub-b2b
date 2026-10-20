// Cliente HTTP del navegador para la API (/api/* llega al backend por el rewrite de Next).
// Si el access token venció, renueva la sesión UNA vez y reintenta la petición.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Single-flight: si varias peticiones reciben 401 al mismo tiempo, comparten UN solo refresh.
// Sin esto, el segundo refresh usaría un token ya rotado, el backend lo tomaría como robo
// (detección de reuso) y cerraría la sesión.
let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST' })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// Mensaje legible desde la respuesta de error de NestJS ({ message: ... }).
function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
    return body.message;
  }
  return `Error ${status}`;
}

// Nota: el body se reenvía tal cual en el reintento, así que debe ser texto (JSON.stringify).
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await fetch(path, init);

  if (res.status === 401 && (await refreshSession())) {
    res = await fetch(path, init);
  }

  if (res.status === 401) {
    // La sesión terminó de verdad: al login, recordando dónde estaba.
    const next = window.location.pathname + window.location.search;
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    throw new ApiError(401, 'Sesión expirada', null);
  }

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw new ApiError(res.status, errorMessage(body, res.status), body);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
