import { type NextRequest, NextResponse } from 'next/server';

// Revisión rápida antes de cada página: ¿hay sesión? La seguridad real está en el backend.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has('access_token');
  const isLoginPage = pathname.startsWith('/login');

  // Sin sesión: al login, recordando a dónde quería ir.
  if (!hasSession && !isLoginPage) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  // Con sesión, el login no tiene sentido: directo a pedidos.
  if (hasSession && isLoginPage) {
    return NextResponse.redirect(new URL('/pedidos', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Todo excepto la API (la protege el backend), los archivos internos de Next y los estáticos.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)'],
};
