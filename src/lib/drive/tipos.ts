// Capa propia sobre Google Drive. En modo demo se sustituye por carpetas en disco.

export interface ArchivoDrive {
  id: string;
  nombre: string;
  mime: string;
  tamano: number;
  carpetaId: string;
  creado: string;
}

/** Bytes que Drive ya tiene de una subida reanudable y, si terminó, el archivo creado. */
export interface EstadoSubida {
  recibido: number;
  archivo?: ArchivoDrive;
}

export interface Drive {
  readonly raizProyectos: string;
  readonly raizSistema: string;
  crearCarpeta(nombre: string, padreId: string): Promise<string>;
  renombrar(id: string, nombre: string): Promise<void>;
  subir(carpetaId: string, nombre: string, mime: string, contenido: Buffer): Promise<ArchivoDrive>;
  /** Abre una sesión de subida reanudable y devuelve su URL. `origen` habilita CORS para el navegador. */
  iniciarSubida(o: { carpetaId: string; nombre: string; mime: string; tamano: number; origen: string }): Promise<string>;
  enviarTrozo(url: string, trozo: Uint8Array, inicio: number, total: number): Promise<EstadoSubida>;
  estadoSubida(url: string, total: number): Promise<EstadoSubida>;
  metadatos(id: string): Promise<ArchivoDrive | null>;
  listar(carpetaIds: string[]): Promise<ArchivoDrive[]>;
  aPapelera(id: string): Promise<void>;
  /** Convierte HTML en PDF (pasando por Google Docs) y lo guarda en la carpeta. */
  htmlAPdf(html: string, carpetaId: string, nombre: string): Promise<ArchivoDrive>;
  /** Crea un Google Doc editable a partir de HTML. */
  htmlADoc(html: string, carpetaId: string, nombre: string): Promise<ArchivoDrive>;
  /** Copia un archivo (por ejemplo, una plantilla) en otra carpeta. */
  copiar(id: string, carpetaId: string, nombre: string): Promise<ArchivoDrive>;
  /** Busca una subcarpeta por nombre y, si no existe, la crea. */
  carpetaHija(nombre: string, padreId: string): Promise<string>;
  /** Todos los Google Docs y Slides de una unidad compartida, con la ruta de carpetas de cada uno. */
  documentosDeUnidad(unidadId: string): Promise<(ArchivoDrive & { ruta: string })[]>;
  /** Crea un archivo vacío de Google (por ejemplo, una presentación) en la carpeta. */
  crearVacio(nombre: string, mime: string, carpetaId: string): Promise<ArchivoDrive>;
  urlCarpeta(id: string): string;
  urlArchivo(id: string): string;
  urlMiniatura(id: string): string;
  /** Dirección para abrir un documento (en Google, el editor de Docs). */
  urlDocumento(id: string): string;
  /** Dirección para abrir una presentación (en Google, el editor de Slides). */
  urlPresentacion(id: string): string;
  /** Dirección para abrir una hoja de cálculo (en Google, el editor de Sheets). */
  urlHoja(id: string): string;
}

export const ES_CARPETA = 'application/vnd.google-apps.folder';
export const ES_DOC = 'application/vnd.google-apps.document';
export const ES_PRESENTACION = 'application/vnd.google-apps.presentation';
export const ES_HOJA = 'application/vnd.google-apps.spreadsheet';
