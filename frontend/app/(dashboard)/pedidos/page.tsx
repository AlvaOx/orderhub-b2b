import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Pedidos' };

export default function PedidosPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pedidos</h1>
        <p className="text-sm text-slate-500">Todos los pedidos de tu empresa.</p>
      </div>

      <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M3 6h18M3 12h18M3 18h12" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="mt-4 text-base font-semibold text-slate-900">
          La tabla de pedidos viene en camino
        </h2>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Paginación por cursor, filtros por estado y búsqueda sobre 20.000 pedidos.
        </p>
      </div>
    </div>
  );
}
