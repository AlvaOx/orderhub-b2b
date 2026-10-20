'use client';

import {
  CANCELLABLE_STATUSES,
  can,
  NEXT_FULFILLMENT_STATUS,
  type OrderDetail,
  type OrderStatus,
  type Role,
} from '@orderhub/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ORDER_STATUS_LABELS, OrderStatusBadge } from '@/components/orders/order-status-badge';
import { ApiError, apiFetch } from '@/lib/api-client';
import { formatClp, formatDateTime } from '@/lib/format';

type Props = { userId: string; role: Role; number: number };

export function OrderDetailView({ userId, role, number }: Props) {
  const queryClient = useQueryClient();
  const queryKey = ['order', userId, number];
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useQuery({
    // El usuario va en la llave, igual que en el listado.
    queryKey,
    queryFn: ({ signal }) => apiFetch<OrderDetail>(`/api/orders/${number}`, { signal }),
  });

  // La respuesta de avanzar/cancelar ya trae el detalle actualizado: se guarda directo
  // en el caché (sin otra petición) y se marcan como viejos el listado y el stock.
  function handleUpdated(detail: OrderDetail) {
    setActionError(null);
    queryClient.setQueryData(queryKey, detail);
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
    void queryClient.invalidateQueries({ queryKey: ['products'] });
  }

  // Si el pedido cambió mientras tanto (409), se vuelve a pedir para mostrar su estado real.
  function handleActionError(error: Error) {
    setActionError(error instanceof ApiError ? error.message : 'No pudimos actualizar el pedido.');
    void query.refetch();
  }

  const advance = useMutation({
    mutationFn: (status: OrderStatus) =>
      apiFetch<OrderDetail>(`/api/orders/${number}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }),
    onSuccess: handleUpdated,
    onError: handleActionError,
  });

  const cancel = useMutation({
    mutationFn: () => apiFetch<OrderDetail>(`/api/orders/${number}/cancel`, { method: 'POST' }),
    onSuccess: handleUpdated,
    onError: handleActionError,
  });

  if (query.isPending) {
    return <DetailSkeleton />;
  }

  if (query.isError) {
    // Un 404 no se reintenta (ver QueryProvider) y no confirma si el pedido existe.
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
        <h1 className="text-base font-semibold text-slate-900">
          {notFound ? 'Pedido no encontrado' : 'No pudimos cargar el pedido'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {notFound
            ? 'Puede que no exista o que no tengas acceso a él.'
            : 'Revisa tu conexión e intenta de nuevo.'}
        </p>
        {!notFound && (
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-4 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Reintentar
          </button>
        )}
      </div>
    );
  }

  const order = query.data;

  // Mismas reglas que aplica el backend (@orderhub/shared): solo se muestran acciones válidas.
  const nextStatus = NEXT_FULFILLMENT_STATUS[order.status];
  const canAdvance = Boolean(nextStatus) && can(role, 'orders:update_status');
  const canCancel = CANCELLABLE_STATUSES.includes(order.status) && can(role, 'orders:cancel');
  const busy = advance.isPending || cancel.isPending;

  function handleCancel() {
    if (
      window.confirm(`¿Cancelar el pedido #${order.number}? El stock de sus productos se devuelve.`)
    ) {
      cancel.mutate();
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Pedido #{order.number}
          </h1>
          <OrderStatusBadge status={order.status} />
        </div>

        {(canAdvance || canCancel) && (
          <div className="flex gap-2">
            {canCancel && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={busy}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancel.isPending ? 'Cancelando...' : 'Cancelar pedido'}
              </button>
            )}
            {canAdvance && nextStatus && (
              <button
                type="button"
                onClick={() => advance.mutate(nextStatus)}
                disabled={busy}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {advance.isPending
                  ? 'Guardando...'
                  : `Marcar como ${ORDER_STATUS_LABELS[nextStatus]}`}
              </button>
            )}
          </div>
        )}
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {actionError}
        </div>
      )}

      <dl className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3">
        <Field label="Fecha" value={formatDateTime(order.createdAt)} />
        <Field label="Vendedor" value={order.seller.name} />
        <Field label="Total" value={formatClp(order.total)} />
      </dl>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th scope="col" className="px-4 py-3 text-left">
                  SKU
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Producto
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Cantidad
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Precio unitario
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-slate-500">
                    {item.product.sku}
                  </td>
                  <td className="px-4 py-3 text-slate-900">{item.product.name}</td>
                  <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-slate-600 tabular-nums">
                    {formatClp(item.unitPrice)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-slate-900 tabular-nums">
                    {formatClp(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-slate-500">
                  Total
                </td>
                <td className="px-4 py-3 text-right text-base font-semibold whitespace-nowrap text-slate-900 tabular-nums">
                  {formatClp(order.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <Timeline order={order} />
    </div>
  );
}

// "Pedido creado" + cada cambio de estado, del más antiguo al más reciente.
function Timeline({ order }: { order: OrderDetail }) {
  const entries = [
    { id: 'created', title: 'Pedido creado', who: order.seller.name, at: order.createdAt },
    ...order.history.map((change) => ({
      id: change.id,
      title: `${ORDER_STATUS_LABELS[change.fromStatus]} → ${ORDER_STATUS_LABELS[change.toStatus]}`,
      who: change.changedBy.name,
      at: change.changedAt,
    })),
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Historial</h2>
      <ol className="mt-4 space-y-4 border-l border-slate-200 pl-5">
        {entries.map((entry) => (
          <li key={entry.id} className="relative">
            <span
              className="absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full bg-indigo-500 ring-4 ring-white"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-slate-900">{entry.title}</p>
            <p className="text-xs text-slate-500">
              {entry.who} · {formatDateTime(entry.at)}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mt-6 animate-pulse space-y-6" aria-hidden="true">
      <div className="h-8 w-56 rounded bg-slate-200" />
      <div className="h-20 rounded-2xl border border-slate-200 bg-white" />
      <div className="h-64 rounded-2xl border border-slate-200 bg-white" />
    </div>
  );
}
