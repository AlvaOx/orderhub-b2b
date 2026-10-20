import { can } from '@orderhub/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { OrdersTable } from '@/components/orders/orders-table';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Pedidos' };

export default function PedidosPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pedidos</h1>
          <p className="text-sm text-slate-500">Del más reciente al más antiguo.</p>
        </div>
        {/* Depende del rol (lee la sesión). Mientras carga no muestra nada. */}
        <Suspense fallback={null}>
          <NewOrderButton />
        </Suspense>
      </div>

      {/* Lee la sesión (cookie) y los filtros (URL), así que va dentro de Suspense. */}
      <Suspense fallback={<OrdersTableFallback />}>
        <Orders />
      </Suspense>
    </div>
  );
}

// Solo para roles con orders:create (admin y vendedor). Bodega no lo ve.
async function NewOrderButton() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, 'orders:create')) return null;

  return (
    <Link
      href="/pedidos/nuevo"
      className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-500"
    >
      Nuevo pedido
    </Link>
  );
}

// El rol decide qué estados ofrece el filtro; el id separa el caché entre usuarios.
async function Orders() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return <OrdersTable userId={user.id} role={user.role} />;
}

function OrdersTableFallback() {
  return (
    <div
      className="mt-8 h-96 animate-pulse rounded-2xl border border-slate-200 bg-white"
      aria-hidden="true"
    />
  );
}
