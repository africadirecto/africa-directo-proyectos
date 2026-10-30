// Subida de archivos desde la ficha del proyecto (voluntarios con permiso de edición).
// Mismo protocolo que el formulario de la contraparte (ver componentes/subida.ts):
//
//   POST subida          abre una sesión de subida reanudable en la subcarpeta elegida
//   PUT  trozo           reenvía un trozo a Drive (si el navegador no puede subir directo)
//   POST estado-subida   pregunta a Drive cuántos bytes tiene ya
//   POST confirmar       registra un archivo que el navegador subió directo a Drive

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { drive, conFecha, SUBCARPETAS, type ArchivoDrive, type Subcarpeta } from '@/lib/drive';
import { comprobarFirmaSubida, firmaSubida } from '@/lib/enlaces';
import { permitido, persona, SinPermiso } from '@/lib/sesion';
import { leerProyecto } from '@/lib/dominio/proyectos';
import { carpetaDestino, registrarSubida } from '@/lib/dominio/archivos';
import type { Proyecto, Usuario } from '@/lib/tipos';

export const maxDuration = 60;

const MAX_BYTES = 500 * 1024 * 1024;
const MAX_TROZO = 4 * 1024 * 1024;

const error = (mensaje: string, status = 400) => NextResponse.json({ error: mensaje }, { status });
const idFirma = (codigo: string) => `ficha:${codigo}`;

/** Comprueba que el archivo está en una carpeta del proyecto, lo anota y devuelve sus datos. */
async function registrar(p: Proyecto, a: ArchivoDrive, yo: Usuario) {
  const sub = p.drive!.subcarpetas;
  let clave = (Object.keys(sub) as Subcarpeta[]).find((k) => sub[k] === a.carpetaId);
  if (!clave && (await (await drive()).metadatos(a.carpetaId))?.carpetaId === sub.seguimiento) clave = 'seguimiento';
  if (!clave) throw new Error('Archivo fuera de la carpeta del proyecto');
  await registrarSubida(p, a, clave, persona(yo));
  revalidatePath(`/proyectos/${p.codigo}`);
  return { id: a.id, nombre: a.nombre };
}

async function manejar(req: Request, codigo: string, accion: string): Promise<Response> {
  const yo = await permitido('edicion');
  const p = await leerProyecto(codigo);
  if (!p) return error('Proyecto no encontrado', 404);
  if (!p.drive) return error('El proyecto no tiene carpeta en Drive.', 409);
  const d = await drive();

  if (req.method === 'PUT' && accion === 'trozo') {
    const url = req.headers.get('x-subida-url') ?? '';
    if (!comprobarFirmaSubida(idFirma(codigo), url, req.headers.get('x-subida-firma') ?? '')) return error('Subida no válida', 403);
    const inicio = Number(req.headers.get('x-inicio'));
    const total = Number(req.headers.get('x-total'));
    const trozo = new Uint8Array(await req.arrayBuffer());
    if (!Number.isSafeInteger(inicio) || !Number.isSafeInteger(total) || trozo.byteLength > MAX_TROZO || total > MAX_BYTES) {
      return error('Trozo no válido');
    }
    const estado = await d.enviarTrozo(url, trozo, inicio, total);
    return NextResponse.json({ recibido: estado.recibido, resultado: estado.archivo ? await registrar(p, estado.archivo, yo) : undefined });
  }

  if (req.method !== 'POST') return error('Método no permitido', 405);
  const cuerpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  switch (accion) {
    case 'subida': {
      const nombre = String(cuerpo.nombre ?? '').slice(0, 180);
      const mime = String(cuerpo.mime ?? '') || 'application/octet-stream';
      const tamano = Number(cuerpo.tamano);
      const clave = String(cuerpo.carpeta ?? 'seguimiento') as Subcarpeta;
      if (!nombre) return error('Falta el nombre del archivo');
      if (!(clave in SUBCARPETAS)) return error('Carpeta no válida');
      if (!Number.isSafeInteger(tamano) || tamano <= 0 || tamano > MAX_BYTES) return error('El archivo es demasiado grande (máximo 500 MB).');
      const url = await d.iniciarSubida({
        carpetaId: await carpetaDestino(p, clave),
        nombre: conFecha(nombre),
        mime,
        tamano,
        origen: new URL(req.url).origin,
      });
      return NextResponse.json({ url, firma: firmaSubida(idFirma(codigo), url) });
    }

    case 'estado-subida': {
      const url = String(cuerpo.url ?? '');
      if (!comprobarFirmaSubida(idFirma(codigo), url, String(cuerpo.firma ?? ''))) return error('Subida no válida', 403);
      const estado = await d.estadoSubida(url, Number(cuerpo.total));
      return NextResponse.json({ recibido: estado.recibido, resultado: estado.archivo ? await registrar(p, estado.archivo, yo) : undefined });
    }

    case 'confirmar': {
      const a = await d.metadatos(String(cuerpo.id ?? '').slice(0, 100));
      if (!a) return error('Archivo no encontrado', 404);
      return NextResponse.json({ resultado: await registrar(p, a, yo) });
    }
  }
  return error('Acción desconocida', 404);
}

async function ruta(req: Request, { params }: { params: Promise<{ codigo: string; accion: string }> }) {
  const { codigo, accion } = await params;
  try {
    return await manejar(req, codigo, accion);
  } catch (e) {
    if (e instanceof SinPermiso) return error('No tienes permiso para subir archivos.', 403);
    console.error(`Subida de la ficha (${accion})`, e);
    return error('Error del servidor', 500);
  }
}

export { ruta as POST, ruta as PUT };
