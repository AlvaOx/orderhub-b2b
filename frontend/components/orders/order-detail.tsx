'use client';

import type { OrderDetail } from '@orderhub/shared';
import { useQuery } from '@tanstack/react-query';

import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { ApiError, apiFetch } from '@/lib/api-client';
import { formatClp, formatDateTime } from '@/lib/format';

type Props = { userId: string; number: number };

export function OrderDetailView({ userId, number }: Props) {
  const query = useQuery({
    // El usuario va en la llave, igual que en el listado.
    queryKey: ['order', userId, number],
    queryFn: ({ signal }) => apiFetch<OrderDetail>(`/api/orders/${number}`, { signal }),
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

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Pedido #{order.number}
        </h1>
        <OrderStatusBadge status={order.status} />
      </div>

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
    </div>
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
