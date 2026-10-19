import type { Metadata } from 'next';
import { Suspense } from 'react';

import { Logo } from '@/components/logo';

import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Iniciar sesión' };

// Pedidos de muestra para el panel de marca (solo decorativos).
const PREVIEW_ORDERS = [
  {
    id: '#10482',
    detail: '4 productos · M. Rojas',
    total: '$1.284.500',
    status: 'Pagado',
    tone: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30',
  },
  {
    id: '#10481',
    detail: '2 productos · C. Fuentes',
    total: '$342.990',
    status: 'Preparando',
    tone: 'bg-amber-400/10 text-amber-300 ring-amber-400/30',
  },
  {
    id: '#10479',
    detail: '7 productos · M. Rojas',
    total: '$2.910.000',
    status: 'Despachado',
    tone: 'bg-sky-400/10 text-sky-300 ring-sky-400/30',
  },
];

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <BrandPanel />
      <section className="flex items-center justify-center bg-white px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          {/* El formulario lee la URL (?next=), así que va dentro de Suspense. */}
          <Suspense fallback={<FormSkeleton />}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}

function FormSkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-hidden="true">
      <div className="h-7 w-40 rounded bg-slate-200" />
      <div className="h-4 w-56 rounded bg-slate-100" />
      <div className="h-10 rounded-lg bg-slate-100" />
      <div className="h-10 rounded-lg bg-slate-100" />
      <div className="h-10 rounded-lg bg-slate-200" />
    </div>
  );
}

function BrandPanel() {
  return (
    <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
      {/* Fondo: grilla sutil y dos resplandores de color */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)] bg-size-[48px_48px]" />
      <div className="pointer-events-none absolute -top-40 -left-40 h-128 w-128 rounded-full bg-indigo-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 -bottom-48 h-112 w-112 rounded-full bg-emerald-500/15 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <Logo />
        <span className="text-lg font-semibold tracking-tight">
          OrderHub <span className="text-indigo-300">B2B</span>
        </span>
      </div>

      <div className="relative max-w-md">
        <h1 className="text-4xl leading-tight font-semibold tracking-tight">
          Pedidos B2B,
          <br />
          bajo control.
        </h1>
        <p className="mt-4 text-base text-slate-300">
          Cada empresa ve solo lo suyo. Cada rol, solo lo que necesita.
        </p>

        <ul className="mt-10 space-y-3">
          {PREVIEW_ORDERS.map((order) => (
            <li
              key={order.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"
            >
              <div>
                <p className="font-mono text-sm text-slate-200">{order.id}</p>
                <p className="text-xs text-slate-400">{order.detail}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium tabular-nums">{order.total}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${order.tone}`}
                >
                  {order.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-sm text-slate-400">
        Multi-tenant · Tiempo real · Pagos con Mercado Pago
      </p>
    </section>
  );
}
