import type { OrderStatus } from '@orderhub/shared';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente_pago: 'Pendiente de pago',
  pagado: 'Pagado',
  preparando: 'Preparando',
  despachado: 'Despachado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  pendiente_pago: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  pagado: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  preparando: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  despachado: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  entregado: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  cancelado: 'bg-red-50 text-red-700 ring-red-600/20',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
