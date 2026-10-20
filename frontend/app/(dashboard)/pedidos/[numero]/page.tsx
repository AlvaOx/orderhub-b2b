import { orderNumberParamSchema } from '@orderhub/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

import { OrderDetailView } from '@/components/orders/order-detail';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Detalle de pedido' };

export default function PedidoPage({ params }: PageProps<'/pedidos/[numero]'>) {
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/pedidos" className="text-sm font-medium text-slate-500 hover:text-slate-900">
        ← Volver a pedidos
      </Link>

      {/* Lee la URL (params) y la sesión (cookie), así que va dentro de Suspense. */}
      <Suspense fallback={<DetailFallback />}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}

async function Detail({ params }: { params: Promise<{ numero: string }> }) {
  // Mismo esquema que el backend: "abc" o "-5" ni siquiera llegan a la API.
  const parsed = orderNumberParamSchema.safeParse((await params).numero);
  if (!parsed.success) notFound();

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return <OrderDetailView userId={user.id} number={parsed.data} />;
}

function DetailFallback() {
  return (
    <div
      className="mt-6 h-72 animate-pulse rounded-2xl border border-slate-200 bg-white"
      aria-hidden="true"
    />
  );
}
