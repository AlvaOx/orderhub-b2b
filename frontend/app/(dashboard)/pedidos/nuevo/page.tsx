import { can } from '@orderhub/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { NewOrderForm } from '@/components/orders/new-order-form';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Nuevo pedido' };

export default function NuevoPedidoPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/pedidos" className="text-sm font-medium text-slate-500 hover:text-slate-900">
        ← Volver a pedidos
      </Link>
      <div className="mt-3 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Nuevo pedido</h1>
        <p className="text-sm text-slate-500">
          El precio y el stock se confirman en el momento de crear el pedido.
        </p>
      </div>

      {/* Lee la sesión (cookie), así que va dentro de Suspense. */}
      <Suspense fallback={<FormFallback />}>
        <NewOrder />
      </Suspense>
    </div>
  );
}

async function NewOrder() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  // Comodidad: quien no puede crear pedidos vuelve al listado. La seguridad real es el 403 del backend.
  if (!can(user.role, 'orders:create')) redirect('/pedidos');

  return <NewOrderForm userId={user.id} />;
}

function FormFallback() {
  return (
    <div
      className="mt-8 h-72 animate-pulse rounded-2xl border border-slate-200 bg-white"
      aria-hidden="true"
    />
  );
}
