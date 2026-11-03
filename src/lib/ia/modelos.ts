// Catálogo de modelos de OpenRouter para elegirlos en Ajustes de IA: solo los que admiten salida
// JSON estructurada (la app la necesita), con su precio y si tienen variante de lotes. La lista es
// pública (no necesita clave) y se guarda un día en la caché de Next.

export interface ModeloIa {
  id: string;
  nombre: string;
  /** Dólares por millón de tokens. */
  entrada: number;
  salida: number;
  imagenes: boolean;
  /** Tiene variante «:batch» (se puede usar en los lotes). */
  lotes: boolean;
}

type Crudo = { id: string; name?: string; pricing?: { prompt?: string; completion?: string }; architecture?: { input_modalities?: string[] } };

export async function catalogoModelos(): Promise<ModeloIa[]> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models?supported_parameters=structured_outputs', {
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    const datos = ((await res.json()) as { data?: Crudo[] }).data ?? [];
    const conLote = new Set(datos.filter((m) => m.id.endsWith(':batch')).map((m) => m.id.slice(0, -6)));
    return datos
      .filter((m) => !m.id.includes(':'))
      .map((m) => ({
        id: m.id,
        nombre: (m.name ?? m.id).replace(/^[^:]+:\s*/, ''),
        entrada: Number(m.pricing?.prompt ?? 0) * 1e6,
        salida: Number(m.pricing?.completion ?? 0) * 1e6,
        imagenes: m.architecture?.input_modalities?.includes('image') ?? false,
        lotes: conLote.has(m.id),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    // Sin conexión con OpenRouter: la pantalla deja escribir el modelo a mano.
    return [];
  }
}
