'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function LogoutButton() {
  const router = useRouter();
  // isPending vuelve a false solo cuando termina la navegación, así nunca queda pegado.
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
      router.replace('/login');
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60"
    >
      {isPending ? 'Saliendo...' : 'Cerrar sesión'}
    </button>
  );
}
