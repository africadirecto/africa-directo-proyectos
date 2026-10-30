// API del formulario público de la contraparte (sin cuenta, con el token del enlace).
//
//   POST borrador        guarda el borrador (guardado automático)
//   POST subida          abre una sesión de subida reanudable en Drive
//   PUT  trozo           reenvía un trozo a Drive (si el navegador no puede subir directo)
//   POST estado-subida   pregunta a Drive cuántos bytes tiene ya
//   POST confirmar       registra un archivo que el navegador subió directo a Drive
//   POST quitar          quita un archivo del borrador
//   POST enviar          envía la solicitud (nueva versión)

import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { drive, conFecha } from '@/lib/drive';
import { comprobarFirmaSubida, firmaSubida } from '@/lib/enlaces';
import { dentroDelLimite, ipDe } from '@/lib/limites';
import { camposQueFaltan, normalizar } from '@/lib/formulario/respuestas';
import { esIdioma } from '@/lib/formulario/textos';
import {
  abrirEnlace,
  anadirArchivoBorrador,
  enviarSolicitud,
  formularioEditable,
  guardarBorrador,
  leerBorrador,
  listarVersiones,
  MAX_ARCHIVOS,
  procesarSolicitud,
  quitarArchivoBorrador,
  type AccesoEnlace,
} from '@/lib/dominio/solicitudes';
import type { ArchivoDrive } from '@/lib/drive';
import type { ArchivoSubido } from '@/lib/tipos';

export const maxDuration = 60;

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_TROZO = 4 * 1024 * 1024;
const EXTENSIONES = /\.(jpe?g|png|webp|heic|heif|gif|pdf|docx?|xlsx?|odt|ods|pptx?|txt|csv)$/i;

const error = (mensaje: string, status = 400) => NextResponse.json({ error: mensaje }, { status });

async function registrar(acceso: AccesoEnlace, a: ArchivoDrive): Promise<ArchivoSubido[]> {
  if (a.carpetaId !== acceso.proyecto.drive?.subcarpetas.solicitud) throw new Error('Archivo fuera de la carpeta del proyecto');
  return anadirArchivoBorrador(acceso.proyecto.codigo, { id: a.id, nombre: a.nombre, mime: a.mime, tamano: a.tamano, subido: a.creado });
}

async function manejar(req: Request, token: string, accion: string): Promise<Response> {
  const ip = ipDe(req);
  if (!dentroDelLimite(`f:${ip}`, 400) || !dentroDelLimite(`t:${token}`, 600)) return error('Demasiadas peticiones', 429);

  const acceso = await abrirEnlace(token);
  if (!acceso) return error('Enlace no válido', 404);
  const p = acceso.proyecto;
  if (!formularioEditable(p)) return error('El formulario está cerrado', 409);
  const d = await drive();

  if (req.method === 'PUT' && accion === 'trozo') {
    const url = req.headers.get('x-subida-url') ?? '';
    if (!comprobarFirmaSubida(acceso.enlaceId, url, req.headers.get('x-subida-firma') ?? '')) return error('Subida no válida', 403);
    const inicio = Number(req.headers.get('x-inicio'));
    const total = Number(req.headers.get('x-total'));
    const trozo = new Uint8Array(await req.arrayBuffer());
    if (!Number.isSafeInteger(inicio) || !Number.isSafeInteger(total) || trozo.byteLength > MAX_TROZO || total > MAX_BYTES) {
      return error('Trozo no válido');
    }
    const estado = await d.enviarTrozo(url, trozo, inicio, total);
    return NextResponse.json({ recibido: estado.recibido, resultado: estado.archivo ? { archivos: await registrar(acceso, estado.archivo) } : undefined });
  }

  if (req.method !== 'POST') return error('Método no permitido', 405);
  const cuerpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  switch (accion) {
    case 'borrador': {
      const idioma = esIdioma(cuerpo.idioma) ? cuerpo.idioma : p.contraparte.idioma;
      const actualizado = await guardarBorrador(p.codigo, normalizar(cuerpo.respuestas), idioma);
      return NextResponse.json({ actualizado });
    }

    case 'subida': {
      if (!p.drive) return error('El proyecto no tiene carpeta todavía. Inténtalo más tarde.', 503);
      const nombre = String(cuerpo.nombre ?? '').slice(0, 150);
      const mime = String(cuerpo.mime ?? '') || 'application/octet-stream';
      const tamano = Number(cuerpo.tamano);
      if (!EXTENSIONES.test(nombre)) return error('Tipo de archivo no admitido');
      if (!Number.isSafeInteger(tamano) || tamano <= 0 || tamano > MAX_BYTES) return error('Tamaño no válido');
      if (((await leerBorrador(p.codigo))?.archivos?.length ?? 0) >= MAX_ARCHIVOS) return error('Demasiados archivos');
      const url = await d.iniciarSubida({
        carpetaId: p.drive.subcarpetas.solicitud,
        nombre: conFecha(nombre),
        mime,
        tamano,
        origen: new URL(req.url).origin,
      });
      return NextResponse.json({ url, firma: firmaSubida(acceso.enlaceId, url) });
    }

    case 'estado-subida': {
      const url = String(cuerpo.url ?? '');
      if (!comprobarFirmaSubida(acceso.enlaceId, url, String(cuerpo.firma ?? ''))) return error('Subida no válida', 403);
      const estado = await d.estadoSubida(url, Number(cuerpo.total));
      return NextResponse.json({ recibido: estado.recibido, resultado: estado.archivo ? { archivos: await registrar(acceso, estado.archivo) } : undefined });
    }

    case 'confirmar': {
      const a = await d.metadatos(String(cuerpo.id ?? '').slice(0, 100));
      if (!a) return error('Archivo no encontrado', 404);
      return NextResponse.json({ resultado: { archivos: await registrar(acceso, a) } });
    }

    case 'quitar': {
      const archivos = await quitarArchivoBorrador(p.codigo, String(cuerpo.id ?? ''), await listarVersiones(p.codigo));
      return NextResponse.json({ archivos });
    }

    case 'enviar': {
      const respuestas = normalizar(cuerpo.respuestas);
      const idioma = esIdioma(cuerpo.idioma) ? cuerpo.idioma : p.contraparte.idioma;
      const faltan = camposQueFaltan(respuestas);
      if (faltan.length) return NextResponse.json({ error: 'Faltan datos', faltan }, { status: 422 });
      const version = await enviarSolicitud(p.codigo, respuestas, idioma);
      after(() => procesarSolicitud(p.codigo, version));
      return NextResponse.json({ version });
    }
  }
  return error('Acción desconocida', 404);
}

async function ruta(req: Request, { params }: { params: Promise<{ token: string; accion: string }> }) {
  const { token, accion } = await params;
  try {
    return await manejar(req, token, accion);
  } catch (e) {
    console.error(`Formulario (${accion})`, e);
    return error('Error del servidor', 500);
  }
}

export { ruta as POST, ruta as PUT };
