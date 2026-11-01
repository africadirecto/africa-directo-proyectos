// Utilidades de las pruebas técnicas (fase 0 del rediseño de informes). Se ejecutan con
// `node scripts/pruebas/<prueba>.mjs` y leen la configuración de .env.local.
// Solo usan datos inventados y dejan lo que crean en «_Pruebas técnicas», en la unidad Sistema.

import { writeFileSync, mkdirSync } from 'node:fs';
import { JWT } from 'google-auth-library';

process.loadEnvFile('.env.local');

const env = (n) => (process.env[n] ?? '').trim();

export const config = {
  openrouter: env('OPENROUTER_API_KEY'),
  cuenta: env('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
  clave: env('GOOGLE_SERVICE_ACCOUNT_KEY').replace(/^"([\s\S]*)"$/, '$1').replace(/\\n/g, '\n'),
  usuario: env('GOOGLE_DRIVE_USUARIO') || undefined,
  unidadSistema: env('DRIVE_UNIDAD_SISTEMA_ID'),
  unidadProyectos: env('DRIVE_UNIDAD_PROYECTOS_ID'),
  unidadPlantillas: env('DRIVE_UNIDAD_PLANTILLAS_ID'),
};

// ── Google ──────────────────────────────────────────────────────────────────

let jwt;
export async function tokenGoogle() {
  jwt ??= new JWT({ email: config.cuenta, key: config.clave, scopes: ['https://www.googleapis.com/auth/drive'], subject: config.usuario });
  return (await jwt.getAccessToken()).token;
}

/** Llama a una API de Google y devuelve el JSON; lanza con el estado y el mensaje si falla. */
export async function google(url, { metodo = 'GET', cuerpo, cabeceras = {} } = {}) {
  const res = await fetch(url, {
    method: metodo,
    headers: { Authorization: `Bearer ${await tokenGoogle()}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}), ...cabeceras },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await res.text();
  if (!res.ok) {
    const e = new Error(`${res.status} ${texto.slice(0, 500)}`);
    e.status = res.status;
    throw e;
  }
  return texto ? JSON.parse(texto) : {};
}

export const DRIVE = 'https://www.googleapis.com/drive/v3';
export const DOCS = 'https://docs.googleapis.com/v1/documents';
export const SLIDES = 'https://slides.googleapis.com/v1/presentations';

/** Carpeta «_Pruebas técnicas» en la unidad Sistema (la crea si no existe). */
export async function carpetaPruebas() {
  const q = encodeURIComponent(`name = '_Pruebas técnicas' and mimeType = 'application/vnd.google-apps.folder' and '${config.unidadSistema}' in parents and trashed = false`);
  const r = await google(`${DRIVE}/files?q=${q}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=drive&driveId=${config.unidadSistema}`);
  if (r.files?.length) return r.files[0].id;
  const c = await google(`${DRIVE}/files?supportsAllDrives=true&fields=id`, {
    metodo: 'POST',
    cuerpo: { name: '_Pruebas técnicas', mimeType: 'application/vnd.google-apps.folder', parents: [config.unidadSistema] },
  });
  return c.id;
}

/** Crea un Google Doc a partir de HTML (como `htmlADoc` de la app). */
export async function docDesdeHtml(nombre, html, carpetaId) {
  const limite = 'limite' + Date.now();
  const cuerpo =
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: nombre, mimeType: 'application/vnd.google-apps.document', parents: [carpetaId] }) +
    `\r\n--${limite}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n--${limite}--`;
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await tokenGoogle()}`, 'Content-Type': `multipart/related; boundary=${limite}` },
    body: cuerpo,
  });
  if (!res.ok) throw new Error(`Drive ${res.status}: ${await res.text()}`);
  return (await res.json()).id;
}

// ── OpenRouter ──────────────────────────────────────────────────────────────

export async function openrouter(ruta, { metodo = 'GET', cuerpo } = {}) {
  const res = await fetch(`https://openrouter.ai/api/v1${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${config.openrouter}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}), 'X-Title': 'Africa Directo - pruebas' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await res.text();
  let json;
  try {
    json = JSON.parse(texto);
  } catch {
    json = { texto };
  }
  return { status: res.status, json };
}

// ── Resultados ──────────────────────────────────────────────────────────────

/** Guarda un JSON en scripts/pruebas/salida/ (ignorado por git) para revisarlo o usarlo en tests. */
export function guardar(nombre, datos) {
  mkdirSync('scripts/pruebas/salida', { recursive: true });
  writeFileSync(`scripts/pruebas/salida/${nombre}`, JSON.stringify(datos, null, 2));
  return `scripts/pruebas/salida/${nombre}`;
}
