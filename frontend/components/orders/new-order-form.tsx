'use client';

import {
  type CreatedOrder,
  type CreateOrderInput,
  createOrderSchema,
  MAX_LINE_QUANTITY,
  MAX_ORDER_LINES,
  MAX_ORDER_TOTAL,
  type ProductListItem,
} from '@orderhub/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useRef, useState } from 'react';

import { ApiError, apiFetch } from '@/lib/api-client';

const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });
const MAX_QUANTITY_DIGITS = String(MAX_LINE_QUANTITY).length;

// Una línea del formulario. La cantidad es texto mientras se escribe; se valida al enviar.
type Line = { key: number; productId: string; quantity: string };

const cellInput =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 disabled:bg-slate-50';

export function NewOrderForm({ userId }: { userId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const nextKey = useRef(1);
  const [lines, setLines] = useState<Line[]>([{ key: 0, productId: '', quantity: '1' }]);
  const [formError, setFormError] = useState<string | null>(null);

  const productsQuery = useQuery({
    queryKey: ['products', userId],
    queryFn: ({ signal }) => apiFetch<ProductListItem[]>('/api/products', { signal }),
  });
  const products = productsQuery.data ?? [];
  const productsById = new Map(products.map((product) => [product.id, product]));

  const mutation = useMutation({
    mutationFn: (input: CreateOrderInput) =>
      apiFetch<CreatedOrder>('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: (order) => {
      // El listado y el stock cambiaron: se marcan como viejos para que se vuelvan a pedir.
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      router.push(`/pedidos?numero=${order.number}`);
    },
    onError: (error) => {
      // 409 (sin stock) y 400 traen el mensaje del backend.
      setFormError(
        error instanceof ApiError ? error.message : 'No pudimos crear el pedido. Intenta de nuevo.',
      );
    },
  });

  function updateLine(key: number, changes: Partial<Omit<Line, 'key'>>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...changes } : line)),
    );
  }

  function addLine() {
    setLines((current) => [...current, { key: nextKey.current++, productId: '', quantity: '1' }]);
  }

  function removeLine(key: number) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  // Total en vivo. Es solo una vista previa: el backend recalcula con los precios de la base.
  const total = lines.reduce((sum, line) => {
    const product = productsById.get(line.productId);
    return product ? sum + product.price * Number(line.quantity || 0) : sum;
  }, 0);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    // Mismo esquema que el backend (@orderhub/shared). Las líneas sin producto se ignoran.
    const parsed = createOrderSchema.safeParse({
      items: lines
        .filter((line) => line.productId)
        .map((line) => ({ productId: line.productId, quantity: Number(line.quantity) })),
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Revisa el pedido.');
      return;
    }
    if (total > MAX_ORDER_TOTAL) {
      setFormError('El total del pedido excede el máximo permitido.');
      return;
    }

    // Aviso de stock (comodidad). El stock puede cambiar antes de enviar:
    // quien decide es la transacción del backend.
    for (const item of parsed.data.items) {
      const product = productsById.get(item.productId);
      if (product && product.stock < item.quantity) {
        setFormError(`Stock insuficiente para ${product.sku}: quedan ${product.stock}.`);
        return;
      }
    }

    mutation.mutate(parsed.data);
  }

  if (productsQuery.isError) {
    return (
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-slate-600">No pudimos cargar los productos.</p>
        <button
          type="button"
          onClick={() => void productsQuery.refetch()}
          className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-6">
      {formError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {formError}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th scope="col" className="px-4 py-3 text-left">
                  Producto
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Precio
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Cantidad
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Subtotal
                </th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line, index) => {
                const product = productsById.get(line.productId);
                // Productos elegidos en OTRAS líneas: no se pueden repetir.
                const taken = new Set(
                  lines.filter((other) => other.key !== line.key).map((other) => other.productId),
                );

                return (
                  <tr key={line.key}>
                    <td className="min-w-72 px-4 py-3">
                      <label htmlFor={`product-${line.key}`} className="sr-only">
                        Producto de la línea {index + 1}
                      </label>
                      <select
                        id={`product-${line.key}`}
                        value={line.productId}
                        onChange={(e) => updateLine(line.key, { productId: e.target.value })}
                        disabled={productsQuery.isPending}
                        className={cellInput}
                      >
                        <option value="">
                          {productsQuery.isPending ? 'Cargando productos...' : 'Elige un producto'}
                        </option>
                        {products.map((option) => (
                          <option
                            key={option.id}
                            value={option.id}
                            disabled={option.stock === 0 || taken.has(option.id)}
                          >
                            {option.sku} · {option.name} (stock {option.stock})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-slate-600 tabular-nums">
                      {product ? clp.format(product.price) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <label htmlFor={`quantity-${line.key}`} className="sr-only">
                        Cantidad de la línea {index + 1}
                      </label>
                      <input
                        id={`quantity-${line.key}`}
                        inputMode="numeric"
                        autoComplete="off"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.key, {
                            quantity: e.target.value
                              .replace(/\D/g, '')
                              .slice(0, MAX_QUANTITY_DIGITS),
                          })
                        }
                        className={`${cellInput} w-24`}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-slate-900 tabular-nums">
                      {product ? clp.format(product.price * Number(line.quantity || 0)) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        disabled={lines.length === 1}
                        aria-label={`Quitar la línea ${index + 1}`}
                        className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30"
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={addLine}
            disabled={lines.length >= MAX_ORDER_LINES}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
          >
            + Agregar producto
          </button>
          <p className="text-sm text-slate-500">
            Total{' '}
            <span className="ml-2 text-lg font-semibold text-slate-900 tabular-nums">
              {clp.format(total)}
            </span>
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Link
          href="/pedidos"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={mutation.isPending || productsQuery.isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mutation.isPending ? 'Creando...' : 'Crear pedido'}
        </button>
      </div>
    </form>
  );
}
