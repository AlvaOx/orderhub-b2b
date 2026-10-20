'use client';

import {
  ORDERS_PAGE_SIZE,
  type OrderListItem,
  type OrdersPage,
  type OrderStatus,
  orderStatusSchema,
  type Role,
  WAREHOUSE_VISIBLE_STATUSES,
} from '@orderhub/shared';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { ORDER_STATUS_LABELS, OrderStatusBadge } from '@/components/orders/order-status-badge';
import { apiFetch } from '@/lib/api-client';

const SEARCH_DEBOUNCE_MS = 300;
// Arreglo vacío estable: un [] nuevo en cada render haría recalcular la tabla sin motivo.
const EMPTY: OrderListItem[] = [];
const NUMERIC_COLUMNS = new Set(['itemsCount', 'total']);

// Montos en pesos chilenos y fechas en hora de Chile, sin importar la zona del navegador.
const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });
const dateTime = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Santiago',
});

// TanStack Table v9: solo el núcleo. Ordenar, filtrar y paginar lo hace el backend (cursor).
const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, OrderListItem>();

const columns = columnHelper.columns([
  columnHelper.accessor('number', {
    header: 'N°',
    cell: (info) => <span className="font-medium text-slate-900">#{info.getValue()}</span>,
  }),
  columnHelper.accessor('createdAt', {
    header: 'Fecha',
    cell: (info) => dateTime.format(new Date(info.getValue())),
  }),
  columnHelper.accessor((order) => order.seller.name, { id: 'seller', header: 'Vendedor' }),
  columnHelper.accessor('itemsCount', { header: 'Ítems' }),
  columnHelper.accessor('total', {
    header: 'Total',
    cell: (info) => clp.format(info.getValue()),
  }),
  columnHelper.accessor('status', {
    header: 'Estado',
    cell: (info) => <OrderStatusBadge status={info.getValue()} />,
  }),
]);

type Filters = { status?: OrderStatus; number?: number };

function parseStatus(value: string | null): OrderStatus | undefined {
  const parsed = orderStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function parseNumber(value: string | null): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function ordersUrl(filters: Filters, cursor: number | undefined): string {
  const params = new URLSearchParams({ limit: String(ORDERS_PAGE_SIZE) });
  if (filters.status) params.set('status', filters.status);
  if (filters.number) params.set('number', String(filters.number));
  if (cursor) params.set('cursor', String(cursor));
  return `/api/orders?${params.toString()}`;
}

type Props = { userId: string; role: Role };

export function OrdersTable({ userId, role }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // La URL es la fuente de verdad de los filtros: se puede compartir y "atrás" funciona.
  const urlNumber = searchParams.get('numero') ?? '';
  const filters: Filters = {
    status: parseStatus(searchParams.get('estado')),
    number: parseNumber(urlNumber),
  };
  const filterKey = JSON.stringify(filters);

  // push agrega una entrada al historial (cambiar estado); replace no (cada tecla del buscador).
  function setFilter(name: 'estado' | 'numero', value: string, mode: 'push' | 'replace') {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(name, value);
    else params.delete(name);
    const query = params.toString();
    router[mode](query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  // ---------- Buscador por número (debounce + sincronía con la URL) ----------
  const [numberInput, setNumberInput] = useState(urlNumber);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Último valor que el PROPIO buscador escribió en la URL. Distingue nuestros cambios
  // de los que vienen de afuera (crear pedido, botón atrás, un link compartido).
  const lastOwnWrite = useRef<string | null>(null);

  useEffect(() => () => clearTimeout(debounceTimer.current), []);

  // Next 16 conserva el estado de la página al navegar (<Activity>), así que el buscador
  // no se vuelve a montar: si la URL cambió desde afuera, hay que reflejarla aquí.
  // Si la cambió el propio buscador, se respeta lo que el usuario siga escribiendo.
  useEffect(() => {
    if (urlNumber !== lastOwnWrite.current) {
      setNumberInput(urlNumber);
    }
    lastOwnWrite.current = null;
  }, [urlNumber]);

  function handleNumberChange(value: string) {
    const digits = value.replace(/\D/g, '');
    setNumberInput(digits);
    clearTimeout(debounceTimer.current);
    // La URL (y la consulta) cambia 300 ms después de la última tecla, no con cada una.
    debounceTimer.current = setTimeout(() => {
      const current = new URLSearchParams(window.location.search).get('numero') ?? '';
      if (digits === current) return;
      lastOwnWrite.current = digits;
      setFilter('numero', digits, 'replace');
    }, SEARCH_DEBOUNCE_MS);
  }

  // ---------- Datos ----------
  const query = useInfiniteQuery({
    // El usuario va en la llave: si otra persona entra en esta pestaña, no ve el caché anterior.
    queryKey: ['orders', userId, filters],
    // signal: si cambias el filtro antes de que responda, la petición vieja se cancela.
    queryFn: ({ pageParam, signal }) =>
      apiFetch<OrdersPage>(ordersUrl(filters, pageParam), { signal }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // Mientras llegan datos de otro filtro, se sigue mostrando la tabla anterior (atenuada).
    placeholderData: keepPreviousData,
  });

  // Página visible. Al cambiar los filtros vuelve sola a la primera (sin useEffect).
  const [pageState, setPageState] = useState({ filterKey, index: 0 });
  const pageIndex = pageState.filterKey === filterKey ? pageState.index : 0;
  const pages = query.data?.pages ?? [];
  const rows = pages[pageIndex]?.items ?? EMPTY;
  const isLastLoaded = pageIndex >= pages.length - 1;
  const canGoNext = !isLastLoaded || query.hasNextPage;
  const busy = query.isPlaceholderData || query.isFetchingNextPage;

  async function goNext() {
    // Solo se pide al backend si esa página no está ya en el caché.
    if (isLastLoaded) {
      const result = await query.fetchNextPage();
      if (result.isError) return;
    }
    setPageState({ filterKey, index: pageIndex + 1 });
  }

  function goPrevious() {
    setPageState({ filterKey, index: Math.max(0, pageIndex - 1) });
  }

  const table = useTable({ features, columns, data: rows, getRowId: (order) => order.id });

  // Bodega solo puede filtrar por los estados que ve.
  const statusOptions: readonly OrderStatus[] =
    role === 'bodega' ? WAREHOUSE_VISIBLE_STATUSES : orderStatusSchema.options;

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="order-number" className="sr-only">
          Buscar por número de pedido
        </label>
        <input
          id="order-number"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Buscar N° de pedido"
          value={numberInput}
          onChange={(e) => handleNumberChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 sm:max-w-xs"
        />

        <label htmlFor="order-status" className="sr-only">
          Filtrar por estado
        </label>
        <select
          id="order-status"
          value={filters.status ?? ''}
          onChange={(e) => setFilter('estado', e.target.value, 'push')}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 sm:w-56"
        >
          <option value="">Todos los estados</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {ORDER_STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        {query.isFetching && !query.isPending && (
          <span className="text-xs text-slate-400" aria-live="polite">
            Actualizando...
          </span>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table
            className={`min-w-full divide-y divide-slate-200 text-sm transition-opacity ${
              query.isPlaceholderData ? 'opacity-60' : ''
            }`}
          >
            <thead className="bg-slate-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      scope="col"
                      className={`px-4 py-3 text-xs font-semibold tracking-wide whitespace-nowrap text-slate-500 uppercase ${
                        NUMERIC_COLUMNS.has(header.column.id) ? 'text-right' : 'text-left'
                      }`}
                    >
                      <table.FlexRender header={header} />
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody className="divide-y divide-slate-100">
              {query.isPending ? (
                <SkeletonRows columns={columns.length} />
              ) : query.isError && pages.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-16 text-center">
                    <p className="text-sm text-slate-600">No pudimos cargar los pedidos.</p>
                    <button
                      type="button"
                      onClick={() => void query.refetch()}
                      className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Reintentar
                    </button>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-16 text-center text-sm text-slate-500"
                  >
                    No hay pedidos con estos filtros.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    {row.getAllCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`px-4 py-3 whitespace-nowrap text-slate-600 ${
                          NUMERIC_COLUMNS.has(cell.column.id) ? 'text-right tabular-nums' : ''
                        }`}
                      >
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <span className="text-sm text-slate-500">Página {pageIndex + 1}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={goPrevious}
              disabled={pageIndex === 0 || busy}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => void goNext()}
              disabled={!canGoNext || busy}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {query.isFetchingNextPage ? 'Cargando...' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 8 }, (_, row) => (
        <tr key={row} className="animate-pulse" aria-hidden="true">
          {Array.from({ length: columns }, (_, col) => (
            <td key={col} className="px-4 py-3.5">
              <div className="h-3.5 rounded bg-slate-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
