import type { Role } from '@orderhub/shared';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { Logo } from '@/components/logo';
import { LogoutButton } from '@/components/logout-button';
import { NavLinks } from '@/components/nav-links';
import { getCurrentUser } from '@/lib/session';

const ROLE_STYLES: Record<Role, { label: string; className: string }> = {
  admin: { label: 'Administrador', className: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20' },
  vendedor: { label: 'Vendedor', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  bodega: { label: 'Bodega', className: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-6">
          <Logo />
          <span className="font-semibold tracking-tight">
            OrderHub <span className="text-indigo-600">B2B</span>
          </span>
        </div>

        {/* El menú depende del rol (lee la cookie de sesión), así que va dentro de Suspense. */}
        <Suspense fallback={<NavLinksSkeleton />}>
          <SidebarNav />
        </Suspense>

        <div className="border-t border-slate-200 p-4">
          {/* Depende de la cookie de sesión, así que va dentro de Suspense. */}
          <Suspense fallback={<UserCardSkeleton />}>
            <UserCard />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="font-semibold tracking-tight">OrderHub</span>
          </div>
          <LogoutButton />
        </header>
        <main className="flex-1 px-4 py-8 sm:px-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}

// Menú filtrado por los permisos del rol. getCurrentUser usa cache(): no repite la llamada.
async function SidebarNav() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return <NavLinks role={user.role} />;
}

async function UserCard() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const role = ROLE_STYLES[user.role];
  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('');

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.tenant.name}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${role.className}`}
        >
          {role.label}
        </span>
        <LogoutButton />
      </div>
    </div>
  );
}

// Mismo tamaño que el menú real, para que el sidebar no "salte" al cargar.
function NavLinksSkeleton() {
  return (
    <div className="flex-1 animate-pulse space-y-1 p-4" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <div className="h-5 w-5 rounded bg-slate-200" />
          <div className="h-3 w-24 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function UserCardSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-slate-200" />
        <div className="space-y-2">
          <div className="h-3 w-28 rounded bg-slate-200" />
          <div className="h-3 w-20 rounded bg-slate-100" />
        </div>
      </div>
      <div className="mt-3 h-5 w-24 rounded-full bg-slate-100" />
    </div>
  );
}
