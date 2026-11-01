// S2b · La ruta /api/foto de la app con la app en marcha (npm run dev).
//   node scripts/pruebas/s2-ruta-foto.mjs [http://localhost:3000]
// Busca en Firestore una foto publicable y otra que no lo sea (solo lectura), firma su token
// como hace la app (urlFoto en src/lib/enlaces.ts) y comprueba lo que responde la ruta.
// Desde localhost no se prueba que Google llegue a la ruta: eso queda para Vercel.

import crypto from 'node:crypto';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from './comun.mjs';

const base = process.argv[2] ?? 'http://localhost:3000';
const secreto = (process.env.ENLACES_SECRETO ?? '').trim();
const firmar = (t) => crypto.createHmac('sha256', secreto).update(t).digest('base64url');
function token(datos, minutos) {
  const d = Buffer.from(datos).toString('base64url');
  const caduca = Math.floor(Date.now() / 1000 + minutos * 60).toString(36);
  return `${d}.${caduca}.${firmar(`temporal:${d}.${caduca}`).slice(0, 22)}`;
}

initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: config.cuenta, privateKey: config.clave }) });
const db = getFirestore();
let publicable;
let privada;
for (const p of (await db.collection('proyectos').limit(30).get()).docs) {
  for (const a of (await p.ref.collection('archivos').where('esFoto', '==', true).limit(20).get()).docs) {
    if (a.data().publicable && !publicable) publicable = { codigo: p.id, id: a.id };
    if (!a.data().publicable && !privada) privada = { codigo: p.id, id: a.id };
  }
  if (publicable && privada) break;
}
console.log('Foto publicable:', publicable ? 'sí' : 'no hay', '· no publicable:', privada ? 'sí' : 'no hay');

const pedir = async (nombre, t, esperado) => {
  const res = await fetch(`${base}/api/foto/${t}`);
  const bytes = (await res.arrayBuffer()).byteLength;
  console.log(`  ${res.status === esperado ? '✔' : '✘'} ${nombre} → ${res.status} ${res.headers.get('content-type')} ${Math.round(bytes / 1024)} KB · cache: ${res.headers.get('cache-control')}`);
};
if (publicable) {
  const t = token(`foto:${publicable.codigo}:${publicable.id}`, 5);
  await pedir('foto publicable', t, 200);
  await pedir('token alterado', t.slice(0, -2) + (t.endsWith('AA') ? 'BB' : 'AA'), 404);
  await pedir('token caducado', token(`foto:${publicable.codigo}:${publicable.id}`, -1), 404);
}
if (privada) await pedir('foto NO publicable', token(`foto:${privada.codigo}:${privada.id}`, 5), 404);
await pedir('archivo inexistente', token('foto:P-0000-000:noexiste', 5), 404);
process.exit(0);
