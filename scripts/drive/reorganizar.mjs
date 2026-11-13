// Pasa la unidad de proyectos a la estructura de docs/DRIVE.md:
//
//   1. Proyectos/   (las carpetas de año)      3. Reportes/Resúmenes y Hojas de cálculo
//   2. Solicitudes/ (vacía, reservada)         4. Eliminados/
//
// Sin argumentos solo dice lo que haría. Para hacerlo:
//
//   node scripts/drive/reorganizar.mjs --aplicar
//
// Solo mueve y renombra dentro de la unidad (los identificadores no cambian, así que la app no
// pierde nada) y manda a la papelera las carpetas antiguas que quedan vacías y «_Informes
// generales». Se puede ejecutar más de una vez: lo que ya está en su sitio no se toca.

import { config, google, DRIVE } from '../pruebas/comun.mjs';

const APLICAR = process.argv.includes('--aplicar');
const CARPETA = 'application/vnd.google-apps.folder';
const HOJA = 'application/vnd.google-apps.spreadsheet';
const TODAS = 'supportsAllDrives=true';
const RAIZ = config.unidadProyectos;

async function hijos(padre) {
  const lista = [];
  let pagina = '';
  do {
    const p = new URLSearchParams({
      q: `'${padre}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType)',
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      corpora: 'allDrives',
    });
    if (pagina) p.set('pageToken', pagina);
    const r = await google(`${DRIVE}/files?${p}`);
    lista.push(...(r.files ?? []));
    pagina = r.nextPageToken ?? '';
  } while (pagina);
  return lista.sort((a, b) => a.name.localeCompare(b.name));
}

/** Cuántos archivos (no carpetas) hay dentro, a cualquier profundidad. */
async function contar(id) {
  let n = 0;
  for (const h of await hijos(id)) n += h.mimeType === CARPETA ? await contar(h.id) : 1;
  return n;
}

const hecho = (texto) => console.log(`${APLICAR ? '✔' : '·'} ${texto}`);

async function crear(nombre, padre) {
  hecho(`Crear la carpeta «${nombre}»`);
  if (!APLICAR) return null;
  return (await google(`${DRIVE}/files?${TODAS}&fields=id`, { metodo: 'POST', cuerpo: { name: nombre, mimeType: CARPETA, parents: [padre] } })).id;
}

/** La carpeta con ese nombre dentro de `padre`; si no está, se crea (en la simulación, null). */
async function asegurar(nombre, padre, lista) {
  const existente = (lista ?? (padre ? await hijos(padre) : [])).find((h) => h.mimeType === CARPETA && h.name === nombre);
  return existente?.id ?? crear(nombre, padre);
}

async function mover(f, de, a, destino) {
  hecho(`Mover «${f.name}» a «${destino}»`);
  if (APLICAR) await google(`${DRIVE}/files/${f.id}?${TODAS}&addParents=${a}&removeParents=${de}&fields=id`, { metodo: 'PATCH', cuerpo: {} });
}

async function renombrar(f, nombre) {
  hecho(`Renombrar «${f.name}» como «${nombre}»`);
  if (APLICAR) await google(`${DRIVE}/files/${f.id}?${TODAS}`, { metodo: 'PATCH', cuerpo: { name: nombre } });
}

async function aPapelera(f, motivo) {
  hecho(`Mandar a la papelera «${f.name}» (${motivo})`);
  if (APLICAR) await google(`${DRIVE}/files/${f.id}?${TODAS}`, { metodo: 'PATCH', cuerpo: { trashed: true } });
}

console.log(APLICAR ? 'Reorganizando la unidad de proyectos…\n' : 'SIMULACIÓN: no se cambia nada. Con --aplicar se hace.\n');

const raiz = await hijos(RAIZ);
const enRaiz = (nombre) => raiz.find((h) => h.mimeType === CARPETA && h.name === nombre);
const tratadas = new Set(['1. Proyectos', '2. Solicitudes', '3. Reportes', '4. Eliminados']);

// 1. Proyectos: las carpetas de año.
const proyectos = await asegurar('1. Proyectos', RAIZ, raiz);
for (const f of raiz.filter((h) => h.mimeType === CARPETA && /^\d{4}$/.test(h.name))) {
  tratadas.add(f.name);
  await mover(f, RAIZ, proyectos, '1. Proyectos');
}

// 2. Solicitudes: vacía por ahora.
await asegurar('2. Solicitudes', RAIZ, raiz);

// 3. Reportes: lo que había en «_Resúmenes», repartido entre documentos y hojas de cálculo.
const reportes = await asegurar('3. Reportes', RAIZ, raiz);
const resumenes = await asegurar('Resúmenes', reportes);
const hojas = await asegurar('Hojas de cálculo', reportes);
const antigua = enRaiz('_Resúmenes');
if (antigua) {
  tratadas.add(antigua.name);
  for (const f of await hijos(antigua.id)) {
    if (f.mimeType === HOJA) await mover(f, antigua.id, hojas, '3. Reportes/Hojas de cálculo');
    else await mover(f, antigua.id, resumenes, '3. Reportes/Resúmenes');
  }
  await aPapelera(antigua, 'queda vacía');
}

// «_Informes generales»: la carpeta de antes del sistema de plantillas, que la app ya no usa.
const generales = enRaiz('_Informes generales');
if (generales) {
  tratadas.add(generales.name);
  await aPapelera(generales, `antigua, con ${await contar(generales.id)} archivos dentro`);
}

// 4. Eliminados: si ya existía «Proyectos eliminados», es la misma carpeta con otro nombre.
const eliminados = enRaiz('Proyectos eliminados');
if (eliminados) {
  tratadas.add(eliminados.name);
  const nueva = enRaiz('4. Eliminados');
  if (!nueva) await renombrar(eliminados, '4. Eliminados');
  else {
    for (const f of await hijos(eliminados.id)) await mover(f, eliminados.id, nueva.id, '4. Eliminados');
    await aPapelera(eliminados, 'queda vacía');
  }
} else {
  await asegurar('4. Eliminados', RAIZ, raiz);
}

const resto = raiz.filter((h) => !tratadas.has(h.name));
if (resto.length) console.log(`\nSe deja como está en la raíz de la unidad: ${resto.map((h) => `«${h.name}»`).join(', ')}`);
console.log(APLICAR ? '\nHecho. Lo enviado a la papelera se puede recuperar durante 30 días.' : '\nNada cambiado.');
