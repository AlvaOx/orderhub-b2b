import type { NextConfig } from 'next';

// Dirección del backend NestJS. En producción será la URL de Railway o Render.
const API_URL = process.env.API_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  // La raíz lleva directo a pedidos (el proxy manda al login si no hay sesión).
  // Es una regla de ruteo, no una página: se resuelve antes de renderizar nada.
  // permanent: false (307) para que el navegador no la guarde para siempre.
  async redirects() {
    return [{ source: '/', destination: '/pedidos', permanent: false }];
  },
  // El navegador solo habla con Next (un solo dominio) y Next reenvía /api/* al backend.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
