// Capa propia de acceso a datos. El resto de la app solo usa esta interfaz,
// así se puede cambiar Firestore por otro almacén sin tocar la lógica.
//
// Rutas al estilo Firestore: "proyectos/P-2026-001" es un documento y
// "proyectos/P-2026-001/eventos" una colección. Las fechas se guardan como
// texto ISO 8601 para que la copia de seguridad sea JSON sin conversiones.

export type Datos = Record<string, unknown>;

export type Operador = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains';

export interface Consulta {
  donde?: [campo: string, op: Operador, valor: unknown][];
  orden?: [campo: string, dir: 'asc' | 'desc'];
  limite?: number;
}

export interface Transaccion {
  leer<T = Datos>(ruta: string): Promise<T | null>;
  guardar(ruta: string, datos: Datos): void;
}

export interface Almacen {
  leer<T = Datos>(ruta: string): Promise<T | null>;
  /** Crea un documento con identificador automático y lo devuelve. */
  crear(coleccion: string, datos: Datos): Promise<string>;
  /** Escribe el documento entero, o lo fusiona (en profundidad) si `fusionar`. */
  guardar(ruta: string, datos: Datos, opciones?: { fusionar?: boolean }): Promise<void>;
  /** Borra un campo anidado, p. ej. ["items", "P-2026-001"]. */
  borrarCampo(ruta: string, campo: string[]): Promise<void>;
  borrar(ruta: string): Promise<void>;
  consultar<T = Datos>(coleccion: string, consulta?: Consulta): Promise<(T & { id: string })[]>;
  transaccion<R>(fn: (tx: Transaccion) => Promise<R>): Promise<R>;
  /** Todos los documentos (para la copia nocturna). */
  volcar(): Promise<Record<string, Datos>>;
}
