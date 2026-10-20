// Formatos de Chile, iguales sin importar la zona horaria o el idioma del navegador.
const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });
const dateTime = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Santiago',
});

// 170740 -> "$170.740"
export const formatClp = (amount: number): string => clp.format(amount);

// "2026-10-20T18:01:13.540Z" -> "20-10-2026, 3:01 p. m." (hora de Chile)
export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));
