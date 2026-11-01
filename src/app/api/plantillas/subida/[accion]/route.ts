// Subida de un informe de ejemplo para crear una plantilla (voluntarios con permiso de edición).
// Mismo protocolo que la subida de la ficha del proyecto (ver componentes/subida.ts); el archivo
// va a «AD · Plantillas / _Ejemplos» y se queda allí como original.
//
//   POST subida          abre una sesión de subida reanudable
//   PUT  trozo           reenvía un trozo a Drive (si el navegador no puede subir directo)
//   POST estado-subida   pregunta a Drive cuántos bytes tiene ya
//   POST confirmar       comprueba el archivo que el navegador subió directo a Drive

import { NextResponse } from 'next/server';
import { drive, conFecha, type ArchivoDrive } from '@/lib/drive';
import { comprobarFirmaSubida, firmaSubida } from '@/lib/enlaces';
import { permitido, SinPermiso } from '@/lib/sesion';
import { carpetaPlantillas } from '@/lib/dominio/plantillas';
import { MIMES_EJEMPLO } from '@/lib/trabajos/plantilla';

export const maxDuration = 60;

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_TROZO = 4 * 1024 * 1024;
const ID_FIRMA = 'plantillas:ejemplos';

const error = (mensaje: string, status = 400) => NextResponse.json({ error: mensaje }, { status });

async function comprobar(a: ArchivoDrive) {
  if (a.carpetaId !== (await carpetaPlantillas('_Ejemplos'))) throw new Error('Archivo fuera de la carpeta de ejemplos');
  return { id: a.id, nombre: a.nombre };
}

async function manejar(req: Request, accion: string): Promise<Response> {
  await permitido('edicion');
  const d = await drive();

  if (req.method === 'PUT' && accion === 'trozo') {
    const url = req.headers.get('x-subida-url') ?? '';
    if (!comprobarFirmaSubida(ID_FIRMA, url, req.headers.get('x-subida-firma') ?? '')) return error('Subida no válida', 403);
    const inicio = Number(req.headers.get('x-inicio'));
    const total = Number(req.headers.get('x-total'));
    const trozo = new Uint8Array(await req.arrayBuffer());
    if (!Number.isSafeInteger(inicio) || !Number.isSafeInteger(total) || trozo.byteLength > MAX_TROZO || total > MAX_BYTES) return error('Trozo no válido');
    const estado = await d.enviarTrozo(url, trozo, inicio, total);
    return NextResponse.json({ recibido: estado.recibido, resultado: estado.archivo ? await comprobar(estado.archivo) : undefined });
  }

  if (req.method !== 'POST') return error('Método no permitido', 405);
  const cuerpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  switch (accion) {
    case 'subida': {
      const nombre = String(cuerpo.nombre ?? '').slice(0, 180);
      const mime = String(cuerpo.mime ?? '');
      const tamano = Number(cuerpo.tamano);
      if (!nombre) return error('Falta el nombre del archivo');
      if (!MIMES_EJEMPLO[mime] || mime.startsWith('application/vnd.google-apps')) return error('El ejemplo tiene que ser un Word, un PowerPoint o un PDF.');
      if (!Number.isSafeInteger(tamano) || tamano <= 0 || tamano > MAX_BYTES) return error('El archivo es demasiado grande (máximo 50 MB).');
      const url = await d.iniciarSubida({ carpetaId: await carpetaPlantillas('_Ejemplos'), nombre: conFecha(nombre), mime, tamano, origen: new URL(req.url).origin });
      return NextResponse.json({ url, firma: firmaSubida(ID_FIRMA, url) });
    }

    case 'estado-subida': {
      const url = String(cuerpo.url ?? '');
      if (!comprobarFirmaSubida(ID_FIRMA, url, String(cuerpo.firma ?? ''))) return error('Subida no válida', 403);
      const estado = await d.estadoSubida(url, Number(cuerpo.total));
      return NextResponse.json({ recibido: estado.recibido, resultado: estado.archivo ? await comprobar(estado.archivo) : undefined });
    }

    case 'confirmar': {
      const a = await d.metadatos(String(cuerpo.id ?? '').slice(0, 100));
      if (!a) return error('Archivo no encontrado', 404);
      return NextResponse.json({ resultado: await comprobar(a) });
    }
  }
  return error('Acción desconocida', 404);
}

async function ruta(req: Request, { params }: { params: Promise<{ accion: string }> }) {
  const { accion } = await params;
  try {
    return await manejar(req, accion);
  } catch (e) {
    if (e instanceof SinPermiso) return error('No tienes permiso para subir ejemplos.', 403);
    console.error(`Subida de un ejemplo (${accion})`, e);
    return error('Error del servidor', 500);
  }
}

export { ruta as POST, ruta as PUT };
