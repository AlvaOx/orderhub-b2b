'use client';

import { useEffect, useId, useRef } from 'react';

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  // danger: acciones destructivas (rojo). default: acciones normales (índigo).
  tone?: 'default' | 'danger';
  // Mientras se procesa, no se puede cerrar ni volver a confirmar.
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

// Diálogo de confirmación con el <dialog> nativo de HTML: atrapa el foco, cierra con Esc
// y bloquea el fondo, sin librerías.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'default',
  pending = false,
  onConfirm,
  onClose,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // showModal() lo abre como modal (fondo bloqueado y foco atrapado dentro).
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const danger = tone === 'danger';

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      // Esc: el navegador lo cierra y avisa con "close". Mientras procesa, no se permite.
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      onClose={onClose}
      // Clic en el fondo oscuro (fuera de la tarjeta) también cierra.
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 shadow-2xl ring-1 ring-slate-900/5 backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <div className="flex gap-4">
          <div
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
              danger ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'
            }`}
            aria-hidden="true"
          >
            {danger ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                className="h-5 w-5"
              >
                <path
                  d="M12 9v4m0 4h.01M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                className="h-5 w-5"
              >
                <path d="M5 12.5 10 17.5 19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            <p id={descriptionId} className="mt-1.5 text-sm text-slate-500">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
              danger
                ? 'bg-red-600 shadow-red-600/20 hover:bg-red-500'
                : 'bg-indigo-600 shadow-indigo-600/20 hover:bg-indigo-500'
            }`}
          >
            {pending ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
