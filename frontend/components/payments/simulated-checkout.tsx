'use client';

import type {
  PaymentStatus,
  SimulatedCheckout,
  SimulatedDecisionInput,
  SimulatedDecisionResult,
} from '@orderhub/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

import { ApiError, apiFetch } from '@/lib/api-client';
import { formatClp } from '@/lib/format';

type Props = { userId: string; externalId: string };
type Decision = SimulatedDecisionInput['decision'];

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pendiente: 'pendiente',
  aprobado: 'aprobado',
  rechazado: 'rechazado',
  cancelado: 'anulado (se abrió un pago más nuevo)',
  reembolsado: 'reembolsado',
};

/**
 * La "pasarela" simulada. Al decidir, el backend firma un webhook y se lo envía a sí
 * mismo: el pedido cambia por el webhook, no por esta pantalla.
 */
export function SimulatedCheckoutView({ userId, externalId }: Props) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['fake-checkout', userId, externalId],
    queryFn: ({ signal }) =>
      apiFetch<SimulatedCheckout>(`/api/fake-pay/checkouts/${externalId}`, { signal }),
  });

  const decide = useMutation({
    mutationFn: (decision: Decision) =>
      apiFetch<SimulatedDecisionResult>(`/api/fake-pay/checkouts/${externalId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      }),
    // El pedido cambió en la base (por el webhook): detalle y listado quedan viejos.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['order'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  if (query.isPending) {
    return <CheckoutSkeleton />;
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <Card>
        <h1 className="text-base font-semibold text-slate-900">
          {notFound ? 'Pago no encontrado' : 'No pudimos cargar el pago'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {notFound
            ? 'Puede que no exista o que no tengas acceso a él.'
            : 'Revisa tu conexión e intenta de nuevo.'}
        </p>
      </Card>
    );
  }

  const checkout = query.data;
  const backToOrder = (
    <Link
      href={`/pedidos/${checkout.orderNumber}`}
      className="mt-6 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
    >
      Volver al pedido #{checkout.orderNumber}
    </Link>
  );

  // Resultado recién decidido: como las pasarelas reales, se muestra antes de volver.
  if (decide.data) {
    const approved = decide.data.status === 'aprobado';
    return (
      <Card>
        <p
          className={`text-sm font-semibold ${approved ? 'text-emerald-700' : 'text-red-700'}`}
          role="status"
        >
          {approved ? 'Pago aprobado' : 'Pago rechazado'}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {approved
            ? `El pedido #${checkout.orderNumber} quedó pagado.`
            : `El pedido #${checkout.orderNumber} sigue pendiente de pago. Puedes intentarlo de nuevo.`}
        </p>
        {backToOrder}
      </Card>
    );
  }

  // Link viejo o ya usado: no se puede decidir dos veces.
  if (checkout.status !== 'pendiente') {
    return (
      <Card>
        <h1 className="text-base font-semibold text-slate-900">Este pago ya no está disponible</h1>
        <p className="mt-1 text-sm text-slate-500">
          Su estado es: {PAYMENT_STATUS_LABELS[checkout.status]}.
        </p>
        {backToOrder}
      </Card>
    );
  }

  const deciding = decide.isPending ? decide.variables : null;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight text-slate-900">
          Fake<span className="text-emerald-600">Pay</span>
        </span>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          Pasarela simulada
        </span>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Prototipo de portafolio: no se realiza ningún cobro real.
      </p>

      <dl className="mt-6 space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Comercio</dt>
          <dd className="font-medium text-slate-900">OrderHub B2B</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Pedido</dt>
          <dd className="font-medium text-slate-900">#{checkout.orderNumber}</dd>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-3">
          <dt className="text-slate-500">Total a pagar</dt>
          <dd className="text-lg font-semibold text-slate-900 tabular-nums">
            {formatClp(checkout.amount)}
          </dd>
        </div>
      </dl>

      {decide.isError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {decide.error instanceof ApiError
            ? decide.error.message
            : 'No pudimos procesar el pago. Intenta de nuevo.'}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => decide.mutate('rechazar')}
          disabled={decide.isPending}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deciding === 'rechazar' ? 'Rechazando…' : 'Rechazar pago'}
        </button>
        <button
          type="button"
          onClick={() => decide.mutate('aprobar')}
          disabled={decide.isPending}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deciding === 'aprobar' ? 'Aprobando…' : 'Aprobar pago'}
        </button>
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {children}
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div
      className="mt-10 h-80 animate-pulse rounded-2xl border border-slate-200 bg-white"
      aria-hidden="true"
    />
  );
}
