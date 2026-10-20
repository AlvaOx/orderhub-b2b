'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/lib/api-client';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Un caché por pestaña, creado una sola vez. Fuera del componente, el servidor de Next
  // lo compartiría entre usuarios.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Durante 30 s los datos se consideran frescos: volver a una página no la pide de nuevo.
            staleTime: 30_000,
            // Un 4xx (403, 400, 404) no se arregla reintentando; un 5xx o un corte de red, a veces sí.
            retry: (failureCount, error) =>
              !(error instanceof ApiError && error.status < 500) && failureCount < 2,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
