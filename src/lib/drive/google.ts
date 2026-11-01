// Google Drive por su API REST, con la cuenta de servicio del proyecto de Google Cloud.
// La cuenta de servicio debe ser "Gestor de contenido" de las unidades compartidas o, si
// GOOGLE_DRIVE_USUARIO está configurado, actuar en nombre de ese usuario (delegación de dominio).

import { JWT } from 'google-auth-library';
import { config } from '../config';
import { ES_CARPETA, ES_DOC, ES_PRESENTACION, ErrorDrive, type ArchivoDrive, type Drive, type EstadoSubida } from './tipos';

const API = 'https://www.googleapis.com/drive/v3';
const SUBIDA = 'https://www.googleapis.com/upload/drive/v3';
const CAMPOS = 'id,name,mimeType,size,parents,createdTime,modifiedTime,imageMediaMetadata(width,height,rotation)';
const TODAS = 'supportsAllDrives=true';

let jwt: JWT | null = null;

async function token(): Promise<string> {
  jwt ??= new JWT({
    email: config.google.cuentaServicio,
    key: config.google.clavePrivada,
    scopes: ['https://www.googleapis.com/auth/drive'],
    subject: config.drive.usuario || undefined,
  });
  const { token } = await jwt.getAccessToken();
  if (!token) throw new Error('No se pudo obtener acceso a Drive');
  return token;
}

async function api(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await token()}`, ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new ErrorDrive(`Drive ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status);
  return res;
}

type Crudo = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents?: string[];
  createdTime: string;
  modifiedTime?: string;
  imageMediaMetadata?: { width?: number; height?: number; rotation?: number };
};

function aArchivo(f: Crudo): ArchivoDrive {
  const im = f.imageMediaMetadata;
  // `rotation`: cuartos de vuelta aplicados a la foto; con 1 o 3, ancho y alto se intercambian.
  const girada = (im?.rotation ?? 0) % 2 === 1;
  return {
    id: f.id,
    nombre: f.name,
    mime: f.mimeType,
    tamano: Number(f.size ?? 0),
    carpetaId: f.parents?.[0] ?? '',
    creado: f.createdTime,
    ...(f.modifiedTime ? { modificado: f.modifiedTime } : {}),
    ...(im?.width && im.height ? { medidas: girada ? { ancho: im.height, alto: im.width } : { ancho: im.width, alto: im.height } } : {}),
  };
}

/** Lee la respuesta entera sin pasar de `maxBytes`. */
async function bytesDe(res: Response, maxBytes: number): Promise<Buffer> {
  if (Number(res.headers.get('Content-Length') ?? 0) > maxBytes) throw new ErrorDrive(`El archivo pasa de ${Math.round(maxBytes / 1048576)} MB`, 413);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new ErrorDrive(`El archivo pasa de ${Math.round(maxBytes / 1048576)} MB`, 413);
  return bytes;
}

const IMAGEN_DIRECTA = ['image/jpeg', 'image/png', 'image/gif'];

/** Interpreta la respuesta de una sesión reanudable: 308 = a medias, 200/201 = terminada. */
async function leerEstado(res: Response): Promise<EstadoSubida> {
  if (res.status === 308) {
    const rango = res.headers.get('Range'); // "bytes=0-1048575"
    return { recibido: rango ? Number(rango.split('-')[1]) + 1 : 0 };
  }
  if (res.ok) {
    const f = (await res.json()) as Crudo;
    return { recibido: Number(f.size ?? 0), archivo: aArchivo(f) };
  }
  throw new Error(`Subida ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

function comprobarUrlSesion(url: string) {
  if (!url.startsWith(`${SUBIDA}/files?`)) throw new Error('URL de subida no válida');
}

export const driveGoogle: Drive = {
  raizProyectos: config.drive.unidadProyectos,
  raizSistema: config.drive.unidadSistema,

  async crearCarpeta(nombre, padreId) {
    const res = await api(`${API}/files?${TODAS}&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nombre, mimeType: ES_CARPETA, parents: [padreId] }),
    });
    return ((await res.json()) as { id: string }).id;
  },

  async renombrar(id, nombre) {
    await api(`${API}/files/${id}?${TODAS}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nombre }),
    });
  },

  async subir(carpetaId, nombre, mime, contenido) {
    const limite = `limite${Date.now()}`;
    const cuerpo = Buffer.concat([
      Buffer.from(
        `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
          JSON.stringify({ name: nombre, parents: [carpetaId] }) +
          `\r\n--${limite}\r\nContent-Type: ${mime}\r\n\r\n`,
      ),
      contenido,
      Buffer.from(`\r\n--${limite}--`),
    ]);
    const res = await api(`${SUBIDA}/files?uploadType=multipart&${TODAS}&fields=${CAMPOS}`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${limite}` },
      body: cuerpo,
    });
    return aArchivo((await res.json()) as Crudo);
  },

  async iniciarSubida({ carpetaId, nombre, mime, tamano, origen }) {
    const res = await api(`${SUBIDA}/files?uploadType=resumable&${TODAS}&fields=${CAMPOS}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mime,
        'X-Upload-Content-Length': String(tamano),
        // Con el origen de la app, Drive acepta los trozos que envíe el navegador (CORS).
        Origin: origen,
      },
      body: JSON.stringify({ name: nombre, parents: [carpetaId] }),
    });
    const url = res.headers.get('Location');
    if (!url) throw new Error('Drive no devolvió la sesión de subida');
    return url;
  },

  async enviarTrozo(url, trozo, inicio, total) {
    comprobarUrlSesion(url);
    const fin = inicio + trozo.byteLength - 1;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Range': `bytes ${inicio}-${fin}/${total}` },
      body: trozo as BodyInit,
    });
    return leerEstado(res);
  },

  async estadoSubida(url, total) {
    comprobarUrlSesion(url);
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Range': `bytes */${total}` } });
    return leerEstado(res);
  },

  async metadatos(id) {
    try {
      const res = await api(`${API}/files/${id}?${TODAS}&fields=${CAMPOS},trashed`);
      const f = (await res.json()) as Crudo & { trashed?: boolean };
      return f.trashed ? null : aArchivo(f);
    } catch {
      return null;
    }
  },

  async listar(carpetaIds) {
    if (!carpetaIds.length) return [];
    const q = `(${carpetaIds.map((id) => `'${id}' in parents`).join(' or ')}) and trashed = false`;
    const archivos: ArchivoDrive[] = [];
    let pagina = '';
    do {
      const params = new URLSearchParams({
        q,
        fields: `nextPageToken,files(${CAMPOS})`,
        pageSize: '1000',
        orderBy: 'createdTime desc',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
        corpora: 'allDrives',
      });
      if (pagina) params.set('pageToken', pagina);
      const res = await api(`${API}/files?${params}`);
      const datos = (await res.json()) as { files: Crudo[]; nextPageToken?: string };
      archivos.push(...datos.files.map(aArchivo));
      pagina = datos.nextPageToken ?? '';
    } while (pagina);
    return archivos;
  },

  async aPapelera(id) {
    await api(`${API}/files/${id}?${TODAS}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    });
  },

  async htmlADoc(html, carpetaId, nombre) {
    // Drive convierte el HTML en un Google Doc al subirlo con ese tipo.
    const limite = `limite${Date.now()}`;
    const cuerpo =
      `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name: nombre, mimeType: ES_DOC, parents: [carpetaId] }) +
      `\r\n--${limite}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n--${limite}--`;
    const res = await api(`${SUBIDA}/files?uploadType=multipart&${TODAS}&fields=${CAMPOS}`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${limite}` },
      body: cuerpo,
    });
    return aArchivo((await res.json()) as Crudo);
  },

  async copiar(id, carpetaId, nombre) {
    const res = await api(`${API}/files/${id}/copy?${TODAS}&fields=${CAMPOS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nombre, parents: [carpetaId] }),
    });
    return aArchivo((await res.json()) as Crudo);
  },

  async copiarConvirtiendo(id, carpetaId, nombre, mime) {
    // Al copiar con un tipo de Google, Drive convierte (con OCR en los PDF y las imágenes).
    const res = await api(`${API}/files/${id}/copy?${TODAS}&fields=${CAMPOS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nombre, parents: [carpetaId], mimeType: mime }),
    });
    return aArchivo((await res.json()) as Crudo);
  },

  async exportar(id, mime) {
    // Drive exporta hasta 10 MB.
    return bytesDe(await api(`${API}/files/${id}/export?mimeType=${encodeURIComponent(mime)}`), 10 * 1048576);
  },

  async descargar(id, maxBytes = 20 * 1048576) {
    const res = await api(`${API}/files/${id}?${TODAS}&alt=media`);
    return { bytes: await bytesDe(res, maxBytes), mime: res.headers.get('Content-Type')?.split(';')[0] ?? 'application/octet-stream' };
  },

  async imagen(id, lado) {
    const f = (await (await api(`${API}/files/${id}?${TODAS}&fields=mimeType,size,thumbnailLink`)).json()) as { mimeType: string; size?: string; thumbnailLink?: string };
    if (f.thumbnailLink) {
      // La miniatura acaba en «=s220»: se pide al tamaño deseado.
      const res = await fetch(f.thumbnailLink.replace(/=s\d+$/, `=s${lado}`), { headers: { Authorization: `Bearer ${await token()}` } });
      if (res.ok) return { bytes: await bytesDe(res, 8 * 1048576), mime: res.headers.get('Content-Type')?.split(';')[0] ?? 'image/jpeg' };
    }
    // Recién subida, Drive puede no tener aún la miniatura: vale el original si es pequeño y de un tipo que Google admite.
    if (IMAGEN_DIRECTA.includes(f.mimeType) && Number(f.size ?? 0) <= 4 * 1048576) return this.descargar(id, 4 * 1048576);
    throw new ErrorDrive('La foto aún no tiene miniatura en Drive', 503);
  },

  async carpetaHija(nombre, padreId) {
    const existente = (await this.listar([padreId])).find((a) => a.mime === ES_CARPETA && a.nombre === nombre);
    return existente?.id ?? this.crearCarpeta(nombre, padreId);
  },

  async documentosDeUnidad(unidadId, mimes = [ES_DOC, ES_PRESENTACION]) {
    // Una sola consulta por tipo a toda la unidad; la ruta se reconstruye con las carpetas.
    const buscar = async (q: string) => {
      const lista: Crudo[] = [];
      let pagina = '';
      do {
        const params = new URLSearchParams({
          q: `${q} and trashed = false`,
          fields: `nextPageToken,files(${CAMPOS})`,
          pageSize: '1000',
          corpora: 'drive',
          driveId: unidadId,
          supportsAllDrives: 'true',
          includeItemsFromAllDrives: 'true',
        });
        if (pagina) params.set('pageToken', pagina);
        const datos = (await (await api(`${API}/files?${params}`)).json()) as { files: Crudo[]; nextPageToken?: string };
        lista.push(...datos.files);
        pagina = datos.nextPageToken ?? '';
      } while (pagina);
      return lista;
    };
    const [docs, carpetas] = await Promise.all([buscar(`(${mimes.map((m) => `mimeType = '${m}'`).join(' or ')})`), buscar(`mimeType = '${ES_CARPETA}'`)]);
    const porId = new Map(carpetas.map((c) => [c.id, c]));
    const ruta = (id?: string): string[] => {
      const c = id ? porId.get(id) : undefined;
      return c ? [...ruta(c.parents?.[0]), c.name] : [];
    };
    return docs.map((d) => ({ ...aArchivo(d), ruta: ruta(d.parents?.[0]).join(' / ') }));
  },

  async crearVacio(nombre, mime, carpetaId) {
    const res = await api(`${API}/files?${TODAS}&fields=${CAMPOS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nombre, mimeType: mime, parents: [carpetaId] }),
    });
    return aArchivo((await res.json()) as Crudo);
  },

  async htmlAPdf(html, carpetaId, nombre) {
    // 1) Sube el HTML convirtiéndolo en Google Doc, 2) lo exporta a PDF, 3) borra el Doc temporal.
    const { id } = await this.htmlADoc(html, carpetaId, `${nombre} (temporal)`);
    try {
      const pdf = await api(`${API}/files/${id}/export?mimeType=application/pdf`);
      return await this.subir(carpetaId, `${nombre}.pdf`, 'application/pdf', Buffer.from(await pdf.arrayBuffer()));
    } finally {
      // A la papelera y no DELETE: borrar del todo en una unidad compartida exige rol de Gestor,
      // y la app es Gestor de contenido. La papelera se vacía sola a los 30 días.
      await this.aPapelera(id).catch((e) => console.error('No se pudo quitar el Doc temporal', id, e));
    }
  },

  urlCarpeta: (id) => `https://drive.google.com/drive/folders/${id}`,
  urlArchivo: (id) => `https://drive.google.com/file/d/${id}/view`,
  // Funciona en el navegador de quien tenga sesión de Google con acceso a la unidad compartida.
  urlMiniatura: (id) => `https://drive.google.com/thumbnail?id=${id}&sz=w480`,
  urlDocumento: (id) => `https://docs.google.com/document/d/${id}/edit`,
  urlPresentacion: (id) => `https://docs.google.com/presentation/d/${id}/edit`,
  urlHoja: (id) => `https://docs.google.com/spreadsheets/d/${id}/edit`,
};

/**
 * Llamada a otra API de Google (Docs) con la misma cuenta de servicio. El permiso de Drive
 * basta para leer y editar los documentos de las unidades compartidas.
 */
export async function apiGoogle<T>(url: string, init: RequestInit = {}): Promise<T> {
  return (await (await api(url, init)).json()) as T;
}
