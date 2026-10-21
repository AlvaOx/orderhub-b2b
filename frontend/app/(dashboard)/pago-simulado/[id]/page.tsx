import { checkoutIdParamSchema } from '@orderhub/shared';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

import { SimulatedCheckoutView } from '@/components/payments/simulated-checkout';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Pago simulado' };

export default function PagoSimuladoPage({ params }: PageProps<'/pago-simulado/[id]'>) {
  return (
    <div className="mx-auto max-w-md">
      {/* Lee la URL (params) y la sesión (cookie), así que va dentro de Suspense. */}
      <Suspense fallback={<CheckoutFallback />}>
        <Checkout params={params} />
      </Suspense>
    </div>
  );
}

async function Checkout({ params }: { params: Promise<{ id: string }> }) {
  // Mismo esquema que el backend: un id que no es UUID ni siquiera llega a la API.
  const parsed = checkoutIdParamSchema.safeParse((await params).id);
  if (!parsed.success) notFound();

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return <SimulatedCheckoutView userId={user.id} externalId={parsed.data} />;
}

function CheckoutFallback() {
  return (
    <div
      className="mt-10 h-80 animate-pulse rounded-2xl border border-slate-200 bg-white"
      aria-hidden="true"
    />
  );
}
