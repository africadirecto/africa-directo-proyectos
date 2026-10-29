// Almacén sobre Firestore con la librería de administración de Firebase.
// Solo se usa en el servidor; las reglas de seguridad niegan el acceso desde el navegador.

import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldPath, FieldValue, type Firestore, type DocumentReference } from 'firebase-admin/firestore';
import { config } from '../config';
import type { Almacen, Consulta, Datos, Transaccion } from './tipos';

// En globalThis y no en el módulo: Next puede cargar este módulo más de una vez en el mismo
// proceso (y lo recarga en desarrollo), la app de Firebase es la misma y settings() solo se
// puede llamar una vez.
const global = globalThis as { firestoreAD?: Firestore };

export function appFirebase() {
  return (
    getApps()[0] ??
    initializeApp({
      projectId: config.google.proyectoId,
      credential: cert({
        projectId: config.google.proyectoId,
        clientEmail: config.google.cuentaServicio,
        privateKey: config.google.clavePrivada,
      }),
    })
  );
}

function firestore(): Firestore {
  if (!global.firestoreAD) {
    const db = getFirestore(appFirebase());
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Ya lo configuró otra copia de este módulo (con estos mismos ajustes): se reutiliza.
    }
    global.firestoreAD = db;
  }
  return global.firestoreAD;
}

const datosDe = (d: { data(): unknown }) => (d.data() ?? null) as Datos | null;

export const almacenFirestore: Almacen = {
  async leer<T>(ruta: string) {
    const snap = await firestore().doc(ruta).get();
    return snap.exists ? (snap.data() as T) : null;
  },

  async crear(coleccion, datos) {
    const ref = await firestore().collection(coleccion).add(datos);
    return ref.id;
  },

  async guardar(ruta, datos, opciones) {
    await firestore().doc(ruta).set(datos, { merge: !!opciones?.fusionar });
  },

  async borrarCampo(ruta, campo) {
    await firestore().doc(ruta).update(new FieldPath(...campo), FieldValue.delete());
  },

  async borrar(ruta) {
    await firestore().doc(ruta).delete();
  },

  async consultar<T>(coleccion: string, consulta: Consulta = {}) {
    let q: FirebaseFirestore.Query = firestore().collection(coleccion);
    for (const [campo, op, valor] of consulta.donde ?? []) q = q.where(campo, op, valor);
    if (consulta.orden) q = q.orderBy(consulta.orden[0], consulta.orden[1]);
    if (consulta.limite) q = q.limit(consulta.limite);
    const snap = await q.get();
    return snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
  },

  async transaccion(fn) {
    return firestore().runTransaction(async (t) => {
      const tx: Transaccion = {
        async leer<T>(ruta: string) {
          const snap = await t.get(firestore().doc(ruta));
          return snap.exists ? (snap.data() as T) : null;
        },
        guardar(ruta, datos) {
          t.set(firestore().doc(ruta), datos);
        },
      };
      return fn(tx);
    });
  },

  async volcar() {
    const salida: Record<string, Datos> = {};
    const recorrer = async (refs: DocumentReference[]) => {
      for (const ref of refs) {
        const snap = await ref.get();
        const d = snap.exists ? datosDe(snap) : null;
        if (d) salida[ref.path] = d;
        for (const sub of await ref.listCollections()) await recorrer(await sub.listDocuments());
      }
    };
    for (const col of await firestore().listCollections()) await recorrer(await col.listDocuments());
    return salida;
  },
};
