// ¿Puede la cuenta de servicio mover carpetas dentro de una unidad compartida y de una unidad a
// otra? Crea carpetas inventadas, las mueve y las manda a la papelera. No toca ningún proyecto.
//
//   node scripts/pruebas/s5-mover.mjs

import { config, google, DRIVE, carpetaPruebas } from './comun.mjs';

const CARPETA = 'application/vnd.google-apps.folder';
const crear = async (nombre, padre) => (await google(`${DRIVE}/files?supportsAllDrives=true&fields=id`, { metodo: 'POST', cuerpo: { name: nombre, mimeType: CARPETA, parents: [padre] } })).id;
const mover = (id, de, a) => google(`${DRIVE}/files/${id}?supportsAllDrives=true&addParents=${a}&removeParents=${de}&fields=id,parents,driveId`, { metodo: 'PATCH', cuerpo: {} });
const papelera = (id) => google(`${DRIVE}/files/${id}?supportsAllDrives=true`, { metodo: 'PATCH', cuerpo: { trashed: true } });

async function probar(nombre, fn) {
  try {
    console.log(`✔ ${nombre}:`, JSON.stringify(await fn()));
    return true;
  } catch (e) {
    console.log(`✘ ${nombre}: ${e.message}`);
    return false;
  }
}

const pruebas = await carpetaPruebas();
const creadas = [];
try {
  // 1. Dentro de la unidad Sistema.
  const a = await crear('Prueba mover A (borrar)', pruebas);
  const b = await crear('Prueba mover B (borrar)', pruebas);
  creadas.push(a, b);
  await probar('Mover una carpeta dentro de la misma unidad', () => mover(a, pruebas, b));

  // 2. De la unidad Proyectos a la unidad Sistema: una carpeta con una subcarpeta dentro.
  const c = await crear('Prueba mover C (borrar)', config.unidadProyectos);
  creadas.push(c);
  await crear('Subcarpeta', c);
  await probar('Mover una carpeta de la unidad Proyectos a la unidad Sistema', () => mover(c, config.unidadProyectos, pruebas));
} finally {
  for (const id of creadas) await papelera(id).catch((e) => console.log('No se pudo mandar a la papelera', id, e.message));
  console.log('Carpetas de prueba, a la papelera.');
}
