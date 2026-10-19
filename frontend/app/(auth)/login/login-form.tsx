'use client';

import { type LoginInput, loginSchema } from '@orderhub/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { Logo } from '@/components/logo';

type FieldErrors = Partial<Record<keyof LoginInput, string>>;

// Cuentas del seed, para que cualquiera pueda probar el portal con un clic.
const DEMO_PASSWORD = 'Demo1234!';
const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@andes.test' },
  { label: 'Vendedor', email: 'vendedor@andes.test' },
  { label: 'Bodega', email: 'bodega@andes.test' },
] as const;

const inputBase =
  'block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-4';
const inputOk = 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/15';
const inputError = 'border-red-400 focus:border-red-500 focus:ring-red-500/15';

// Solo se permite volver a rutas internas (evita redirecciones a sitios externos).
function safeRedirect(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/pedidos';
}

export function LoginForm() {
  const router = useRouter();
  const redirectTo = safeRedirect(useSearchParams().get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Si el access token venció pero la sesión sigue viva, se renueva sin pedir la clave.
  useEffect(() => {
    fetch('/api/auth/refresh', { method: 'POST' })
      .then((res) => {
        if (res.ok) router.replace(redirectTo);
      })
      .catch(() => undefined);
  }, [router, redirectTo]);

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setFieldErrors({});
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    // Misma validación que el backend (esquema de @orderhub/shared).
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if ((field === 'email' || field === 'password') && !errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) {
        setFormError(
          res.status === 401
            ? 'Correo o clave incorrectos.'
            : 'No pudimos iniciar sesión. Intenta de nuevo.',
        );
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch {
      setFormError('No hay conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-10 flex items-center gap-3 lg:hidden">
        <Logo />
        <span className="text-lg font-semibold tracking-tight">
          OrderHub <span className="text-indigo-600">B2B</span>
        </span>
      </div>

      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Iniciar sesión</h2>
      <p className="mt-2 text-sm text-slate-500">Ingresa con el correo de tu empresa.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          >
            {formError}
          </div>
        )}

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Correo
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="tu@empresa.cl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            className={`${inputBase} ${fieldErrors.email ? inputError : inputOk}`}
          />
          {fieldErrors.email && <p className="mt-1.5 text-xs text-red-600">{fieldErrors.email}</p>}
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
            Clave
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              className={`${inputBase} pr-20 ${fieldErrors.password ? inputError : inputOk}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-0 px-3.5 text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="mt-1.5 text-xs text-red-600">{fieldErrors.password}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-500 focus-visible:ring-4 focus-visible:ring-indigo-500/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && (
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
              <path
                d="M22 12a10 10 0 0 0-10-10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          )}
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>

      <div className="mt-10">
        <div className="flex items-center gap-3 text-xs font-medium tracking-wider text-slate-400 uppercase">
          <span className="h-px flex-1 bg-slate-200" />
          Cuentas demo
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => fillDemo(account.email)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
            >
              {account.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-slate-400">
          Ferretería Andes · clave {DEMO_PASSWORD}
        </p>
      </div>
    </div>
  );
}
