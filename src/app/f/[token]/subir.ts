// Subida de archivos desde el navegador de la contraparte, pensada para conexiones
// lentas o que se cortan: las fotos se reducen antes de subir, los archivos van a
// trozos de 1 MiB y, si se corta la conexión, se reanuda donde se quedó.
//
// Primero se intenta subir directo a Drive (la app solo abre la sesión). Si el
// navegador no puede (CORS), los trozos pasan por la app, que los reenvía.

import type { ArchivoSubido } from '@/lib/tipos';

const TROZO = 1024 * 1024; // múltiplo de 256 KiB, como pide Drive
const CLAVE_PROXY = 'ad-subida-por-app';

class ErrorDefinitivo extends Error {}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const esperarConexion = () =>
  navigator.onLine ? Promise.resolve() : new Promise<void>((r) => window.addEventListener('online', () => r(), { once: true }));

async function postJson<T>(url: string, cuerpo: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const datos = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status >= 400 && res.status < 500 && res.status !== 429) throw new ErrorDefinitivo(datos.error ?? `Error ${res.status}`);
  if (!res.ok) throw new Error(datos.error ?? `Error ${res.status}`);
  return datos;
}

/** Reduce las fotos grandes a 1600 px de lado y JPEG; el resto se sube tal cual. */
export async function prepararArchivo(f: File): Promise<{ blob: Blob; nombre: string; mime: string }> {
  const original = { blob: f as Blob, nombre: f.name, mime: f.type || 'application/octet-stream' };
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(f.type) || f.size < 400_000) return original;
  try {
    const bmp = await createImageBitmap(f);
    const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(bmp.width * escala);
    lienzo.height = Math.round(bmp.height * escala);
    lienzo.getContext('2d')!.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, 'image/jpeg', 0.8));
    if (!blob || blob.size >= f.size) return original;
    return { blob, nombre: f.name.replace(/\.[^.]+$/, '') + '.jpg', mime: 'image/jpeg' };
  } catch {
    return original;
  }
}

/**
 * Sube un archivo y devuelve la lista de archivos del borrador.
 * `avance` recibe los bytes subidos; `sinRed` avisa cuando se espera a la conexión.
 */
export async function subirArchivo(
  token: string,
  blob: Blob,
  nombre: string,
  mime: string,
  avance: (subido: number) => void,
  sinRed: (esperando: boolean) => void,
): Promise<ArchivoSubido[]> {
  const base = `/api/f/${token}`;
  const total = blob.size;
  const { url, firma } = await postJson<{ url: string; firma: string }>(`${base}/subida`, { nombre, mime, tamano: total });
  let directo = url.startsWith('https://') && sessionStorage.getItem(CLAVE_PROXY) !== '1';
  let inicio = 0;
  let fallos = 0;

  for (;;) {
    const fin = Math.min(inicio + TROZO, total);
    const trozo = blob.slice(inicio, fin);
    try {
      if (directo) {
        const res = await fetch(url, { method: 'PUT', headers: { 'Content-Range': `bytes ${inicio}-${fin - 1}/${total}` }, body: trozo });
        if (res.status === 308) {
          const rango = res.headers.get('Range');
          inicio = rango ? Number(rango.split('-')[1]) + 1 : fin;
        } else if (res.ok) {
          const f = (await res.json()) as { id: string };
          return (await postJson<{ archivos: ArchivoSubido[] }>(`${base}/confirmar`, { id: f.id })).archivos;
        } else if (res.status === 404 || res.status === 410) {
          throw new ErrorDefinitivo('La sesión de subida ha caducado');
        } else {
          throw new Error(`Drive ${res.status}`);
        }
      } else {
        const res = await fetch(`${base}/trozo`, {
          method: 'PUT',
          headers: { 'x-subida-url': url, 'x-subida-firma': firma, 'x-inicio': String(inicio), 'x-total': String(total) },
          body: trozo,
        });
        const datos = (await res.json().catch(() => ({}))) as { recibido?: number; archivos?: ArchivoSubido[]; error?: string };
        if (res.status >= 400 && res.status < 500 && res.status !== 429) throw new ErrorDefinitivo(datos.error ?? `Error ${res.status}`);
        if (!res.ok) throw new Error(datos.error ?? `Error ${res.status}`);
        if (datos.archivos) return datos.archivos;
        inicio = datos.recibido ?? fin;
      }
      fallos = 0;
      avance(inicio);
    } catch (e) {
      if (e instanceof ErrorDefinitivo) throw e;
      // Con conexión, un fallo de red en el primer trozo directo suele ser CORS: se pasa a subir por la app.
      if (directo && navigator.onLine && e instanceof TypeError) {
        directo = false;
        sessionStorage.setItem(CLAVE_PROXY, '1');
      } else {
        fallos += 1;
        if (fallos > 10) throw e;
        if (!navigator.onLine) {
          sinRed(true);
          await esperarConexion();
          sinRed(false);
        } else {
          await esperar(Math.min(30_000, 1000 * 2 ** fallos));
        }
      }
      // Antes de seguir, se pregunta a Drive cuánto tiene ya.
      try {
        const estado = await postJson<{ recibido: number; archivos?: ArchivoSubido[] }>(`${base}/estado-subida`, { url, firma, total });
        if (estado.archivos) return estado.archivos;
        inicio = estado.recibido;
        avance(inicio);
      } catch (e2) {
        if (e2 instanceof ErrorDefinitivo) throw e2;
      }
    }
  }
}
