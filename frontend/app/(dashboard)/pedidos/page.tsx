import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { OrdersTable } from '@/components/orders/orders-table';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Pedidos' };

export default function PedidosPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pedidos</h1>
        <p className="text-sm text-slate-500">Del más reciente al más antiguo.</p>
      </div>

      {/* Lee la sesión (cookie) y los filtros (URL), así que va dentro de Suspense. */}
      <Suspense fallback={<OrdersTableFallback />}>
        <Orders />
      </Suspense>
    </div>
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
