// Límite de peticiones para los enlaces públicos. Es por instancia del servidor
// (no compartido entre instancias), suficiente para frenar abusos sin coste.

const ventanas = new Map<string, { inicio: number; cuenta: number }>();

export function dentroDelLimite(clave: string, maximo: number, ventanaMs = 60_000): boolean {
  const ahora = Date.now();
  const v = ventanas.get(clave);
  if (!v || ahora - v.inicio > ventanaMs) {
    ventanas.set(clave, { inicio: ahora, cuenta: 1 });
    if (ventanas.size > 5000) {
      for (const [k, x] of ventanas) if (ahora - x.inicio > ventanaMs) ventanas.delete(k);
    }
    return true;
  }
  v.cuenta += 1;
  return v.cuenta <= maximo;
}

export function ipDe(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
}
