import { orderStatusSchema } from '@orderhub/shared';

export default function Home() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-bold">OrderHub B2B</h1>
      <p className="mt-2 text-sm text-gray-500">Estados del pedido (desde @orderhub/shared):</p>
      <ul className="mt-4 space-y-2">
        {orderStatusSchema.options.map((estado) => (
          <li key={estado} className="rounded border px-3 py-2 font-mono text-sm">
            {estado}
          </li>
        ))}
      </ul>
    </main>
  );
}
