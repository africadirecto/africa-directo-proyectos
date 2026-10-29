// Formatos de fecha y dinero en español de España.

const ZONA = 'Europe/Madrid';

export function dinero(importe: number | null | undefined, moneda = 'EUR'): string {
  if (importe == null) return '—';
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: moneda,
      maximumFractionDigits: 0,
      useGrouping: 'always',
    }).format(importe);
  } catch {
    return `${importe} ${moneda}`;
  }
}

/** "24 oct" (o "24 oct 2025" si no es del año actual). */
export function fechaCorta(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const mismoAnio = d.getFullYear() === new Date().getFullYear();
  return d
    .toLocaleDateString('es-ES', { day: 'numeric', month: 'short', ...(mismoAnio ? {} : { year: 'numeric' }), timeZone: ZONA })
    .replace('.', '');
}

/** "3 ago 2026". */
export function fechaLarga(iso: string | undefined | null): string {
  if (!iso) return '—';
  return new Date(iso)
    .toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: ZONA })
    .replace('.', '');
}

export function fechaHora(iso: string | undefined | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: ZONA,
  });
}

export function diasDesde(iso: string | undefined | null, ahora = Date.now()): number {
  if (!iso) return Infinity;
  return Math.floor((ahora - new Date(iso).getTime()) / 86_400_000);
}

/** "hoy", "ayer", "hace 5 días". */
export function haceDias(iso: string | undefined | null): string {
  const d = diasDesde(iso);
  if (!isFinite(d)) return '';
  if (d <= 0) return 'hoy';
  if (d === 1) return 'ayer';
  return `hace ${d} días`;
}

export function porcentaje(parte: number, total: number | null): number {
  if (!total) return 0;
  return Math.min(100, Math.round((parte / total) * 100));
}

export function tamanoArchivo(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
