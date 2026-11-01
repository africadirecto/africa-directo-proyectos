// Foto de un proyecto para que Google la descargue al insertarla en un informe (Docs y Slides
// solo insertan imágenes desde una dirección pública). Es pública pero temporal: el token lo
// firma la app y caduca en minutos (ver urlFoto en lib/enlaces.ts). Solo sirve fotos marcadas
// como publicables, reducidas a 1600 px; las fotos nunca se hacen públicas en Drive.

import { almacen } from '@/lib/almacen';
import { drive } from '@/lib/drive';
import { leerTokenTemporal } from '@/lib/enlaces';
import { dentroDelLimite, ipDe } from '@/lib/limites';
import type { ArchivoProyecto } from '@/lib/tipos';

export const maxDuration = 60;

const NO = () => new Response('No encontrada', { status: 404 });

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dentroDelLimite(`foto:${ipDe(req)}`, 120)) return new Response('Demasiadas peticiones', { status: 429 });
  const datos = leerTokenTemporal((await params).token);
  const [tipo, codigo, archivoId] = datos?.split(':') ?? [];
  if (tipo !== 'foto' || !/^[A-Z0-9-]{1,30}$/.test(codigo ?? '') || !/^[\w-]{1,100}$/.test(archivoId ?? '')) return NO();

  const registro = await (await almacen()).leer<ArchivoProyecto>(`proyectos/${codigo}/archivos/${archivoId}`);
  if (!registro?.esFoto || !registro.publicable) return NO();

  try {
    const { bytes, mime } = await (await drive()).imagen(archivoId, 1600);
    return new Response(new Uint8Array(bytes), {
      headers: { 'Content-Type': mime, 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' },
    });
  } catch (e) {
    console.error('Foto: no se pudo leer de Drive', archivoId, e);
    return new Response('No disponible', { status: 503 });
  }
}
