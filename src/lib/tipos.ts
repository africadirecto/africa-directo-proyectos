// Tipos de los documentos que se guardan en la base de datos.
// Las fechas son texto ISO 8601 ("2026-10-29T10:00:00.000Z").

import type { Subcarpeta } from './drive';

export type Permiso = 'lectura' | 'edicion' | 'admin';
export type EstadoUsuario = 'pendiente' | 'activo' | 'rechazado';

/** usuarios/{correo} */
export interface Usuario {
  email: string;
  nombre: string;
  permiso: Permiso;
  estado: EstadoUsuario;
  creado: string;
  ultimoAcceso?: string;
  invitadoPor?: string;
}

export type Idioma = 'es' | 'fr' | 'en' | 'pt';

export type EstadoProyecto =
  | 'solicitud'
  | 'revision'
  | 'validada'
  | 'financiacion'
  | 'aprobado'
  | 'ejecucion'
  | 'parado'
  | 'completado'
  | 'cerrado'
  | 'rechazada'
  | 'cancelado';

export interface Persona {
  id: string;
  nombre: string;
}

/** contrapartes/{id} */
export interface Contraparte {
  nombre: string;
  tipo: string;
  pais: string;
  contactoNombre: string;
  correos: string[];
  telefono?: string;
  idioma: Idioma;
  notas?: string;
  creado: string;
  actualizado: string;
}

/** Estado del formulario que rellena la contraparte. */
export type EstadoFormulario = 'pendiente' | 'abierto' | 'enviado' | 'cambios' | 'cerrado';

/** proyectos/{codigo} */
export interface Proyecto {
  codigo: string;
  titulo: string;
  sector: string;
  pais: string;
  lugar: string;
  lat: number | null;
  lng: number | null;
  estado: EstadoProyecto;
  /** Presupuesto en la moneda local de la solicitud (la que eligió la contraparte). */
  moneda: string;
  presupuesto: number | null;
  /**
   * Presupuesto en euros: es la cifra que se financia. Se calcula con el cambio del día al
   * recibir la solicitud y un voluntario puede corregirlo en «Editar datos».
   */
  presupuestoEur: number | null;
  /** En euros: lo comprometido por los donantes, lo cobrado por AD y lo enviado a la contraparte. */
  comprometido: number;
  recibido: number;
  /** Pueden faltar en los proyectos guardados antes de registrar envíos. */
  enviado?: number;
  envios?: Envio[];
  numDonantes: number;
  descripcion: string;
  /** Resumen en español hecho por IA a partir de la última solicitud. */
  resumen: string;
  beneficiarios: string;
  /** Copia de los datos de la contraparte que se usan a menudo (contacto: a quién se saluda en los correos). */
  contraparte: { id: string; nombre: string; contacto: string; idioma: Idioma; correo: string };
  revisor: (Persona & { fecha: string }) | null;
  drive: { carpetaId: string; subcarpetas: Record<Subcarpeta, string> } | null;
  formulario: {
    enlaceId: string;
    estado: EstadoFormulario;
    version: number;
    enviadoEn: string;
    abiertoEn?: string;
    recibidoEn?: string;
    /** Comentarios del revisor al pedir cambios: en español y en el idioma de la contraparte. */
    comentarios?: { es: string; traducido: string; idioma: Idioma } | null;
  };
  fechas: {
    creado: string;
    actualizado: string;
    inicio?: string;
    finPrevisto?: string;
    validada?: string;
    aprobado?: string;
    cierre?: string;
  };
  /** Última noticia de la contraparte (formulario, correo, fotos o una nota marcada como noticia). */
  ultimaNoticia: string;
  anio: number;
}

/** Fila del índice del panel (indices/proyectos → items[codigo]). Un solo documento para todo el panel. */
export interface FilaPanel {
  codigo: string;
  titulo: string;
  sector: string;
  pais: string;
  lugar: string;
  lat: number | null;
  lng: number | null;
  estado: EstadoProyecto;
  moneda: string;
  presupuesto: number | null;
  presupuestoEur: number | null;
  /** En euros. */
  comprometido: number;
  contraparte: string;
  contraparteId: string;
  /** Inicio de la ejecución (se pone solo al pasar a En ejecución; se puede corregir en la ficha). */
  inicio: string | null;
  formulario: EstadoFormulario;
  formularioEnviadoEn: string;
  ultimaNoticia: string;
  anio: number;
  actualizado: string;
}

export interface LineaPresupuesto {
  concepto: string;
  importe: number | null;
}

/** Lo que rellena la contraparte en el formulario. */
export interface RespuestasSolicitud {
  organizacion: string;
  contactoNombre: string;
  contactoCargo: string;
  contactoCorreo: string;
  contactoTelefono: string;
  titulo: string;
  sector: string;
  pais: string;
  lugar: string;
  indicaciones: string;
  lat: number | null;
  lng: number | null;
  necesidad: string;
  beneficiarios: string;
  numBeneficiarios: number | null;
  plazoMeses: number | null;
  aportacionLocal: string;
  moneda: string;
  lineas: LineaPresupuesto[];
}

export interface ArchivoSubido {
  id: string;
  nombre: string;
  mime: string;
  tamano: number;
  subido: string;
}

/** proyectos/{codigo}/solicitudes/borrador */
export interface BorradorSolicitud {
  respuestas: Partial<RespuestasSolicitud>;
  /** Puede faltar si aún no se ha subido ningún archivo. */
  archivos?: ArchivoSubido[];
  idioma: Idioma;
  actualizado: string;
}

export interface TraduccionSolicitud {
  titulo: string;
  necesidad: string;
  beneficiarios: string;
  aportacionLocal: string;
  indicaciones: string;
  conceptos: string[];
}

/** Resultado del análisis con IA de una solicitud. */
export interface AnalisisSolicitud {
  tituloEs: string;
  resumen: string;
  /** Traducción al español de los campos de texto libre (vacía si ya estaba en español o no hay IA). */
  traduccion: TraduccionSolicitud | null;
  falta: string[];
  hechoPorIA: boolean;
}

/** proyectos/{codigo}/solicitudes/v{n} */
export interface VersionSolicitud {
  version: number;
  respuestas: RespuestasSolicitud;
  archivos: ArchivoSubido[];
  idioma: Idioma;
  enviada: string;
  analisis?: AnalisisSolicitud | null;
  pdf?: { id: string; nombre: string } | null;
}

export type Decision = 'validar' | 'cambios' | 'rechazar';

/** proyectos/{codigo}/revisiones/{id} */
export interface Revision {
  decision: Decision;
  comentario: string;
  comentarioTraducido: string;
  version: number;
  por: Persona;
  fecha: string;
}

export type TipoEvento = 'estado' | 'nota' | 'solicitud' | 'revision' | 'aportacion' | 'correo' | 'archivo' | 'sistema';
export type CategoriaEvento = 'avance' | 'incidencia' | 'economico' | 'otro';

/** proyectos/{codigo}/eventos/{id}: la cronología del proyecto. */
export interface Evento {
  tipo: TipoEvento;
  categoria?: CategoriaEvento;
  fecha: string;
  autor: Persona | null;
  texto: string;
  enlaces?: { texto: string; url: string }[];
  de?: EstadoProyecto;
  a?: EstadoProyecto;
}

/** proyectos/{codigo}/archivos/{driveId} */
export interface ArchivoProyecto {
  nombre: string;
  mime: string;
  tamano: number;
  carpeta: Subcarpeta;
  esFoto: boolean;
  /** Solo las fotos publicables pueden aparecer en informes y presentaciones. */
  publicable: boolean;
  origen: 'contraparte' | 'voluntario' | 'correo' | 'sistema';
  fecha: string;
}

export type TipoDonante = 'fundacion' | 'empresa' | 'particular' | 'publica' | 'otra';

/** donantes/{id} */
export interface Donante {
  nombre: string;
  tipo: TipoDonante;
  contactoNombre: string;
  correo: string;
  informes: string;
  plantilla: string;
  notas: string;
  creado: string;
  actualizado: string;
}

/** Un registro de dinero: compromiso de un donante, cobro de AD o envío a la contraparte. */
export interface Movimiento {
  id: string;
  /** En euros. */
  importe: number;
  /** AAAA-MM-DD. */
  fecha: string;
  nota: string;
}

/** Dinero que un donante se compromete a dar. */
export type Compromiso = Movimiento;
/** Dinero que llega a Africa Directo de un donante. */
export type Cobro = Movimiento;
/** Transferencia de Africa Directo a la contraparte (por proyecto, no por donante). */
export type Envio = Movimiento;

/** aportaciones/{id}: relación proyecto–donante (una por donante en cada proyecto). */
export interface Aportacion {
  proyecto: string;
  proyectoTitulo: string;
  donanteId: string;
  donanteNombre: string;
  /** Lo que se ha comprometido, por fechas (un donante puede ampliar su compromiso). */
  compromisos: Compromiso[];
  /** Lo que ya ha llegado a AD. */
  cobros: Cobro[];
  /** Sumas de compromisos y cobros, en euros, copiadas para las listas y los informes. */
  importe: number;
  recibido: number;
  creado: string;
  actualizado: string;
  actualizadoPor: Persona;
}

/** enlaces/{id}: accesos sin cuenta. El token no se guarda: se deriva con HMAC del id. */
export interface Enlace {
  proyecto: string;
  accion: 'solicitud';
  creado: string;
  creadoPor: Persona;
  caduca: string;
  revocado: boolean;
}

/**
 * De un proyecto: seguimiento, final o de financiación (para presentarlo a donantes).
 * De conjunto: cartera (varios proyectos), contraparte o donante.
 */
export type TipoInforme = 'seguimiento' | 'final' | 'financiacion' | 'cartera' | 'contraparte' | 'donante';
export type ExtensionInforme = 'breve' | 'normal' | 'detallado';
/** Documento (Google Docs), presentación (Google Slides) u hoja de cálculo (Google Sheets, solo de proyectos). */
export type FormatoInforme = 'docs' | 'slides' | 'sheets';

export type FormatoPlantilla = 'docs' | 'slides';
/** procesando: se está creando desde un ejemplo. borrador: aún no se ofrece al generar informes. */
export type EstadoPlantilla = 'procesando' | 'borrador' | 'activa' | 'archivada' | 'error';

/** Lo que se le pide a la IA en una plantilla: en general y en cada campo ({{ia:…}}, {{foto:…}}). */
export interface InstruccionesPlantilla {
  general: string;
  /** clave del campo → instrucción */
  campos: Record<string, string>;
}

/** Un campo que la IA rellena, tal como aparece en el documento. */
export interface CampoPlantilla {
  clave: string;
  tipo: 'ia' | 'foto' | 'fotos';
  /** Cuántas veces aparece (todas reciben el mismo contenido). */
  veces: number;
  /** Está dentro de una frase: se rellena con una sola frase. */
  enLinea: boolean;
  /** En Slides, el tamaño del recuadro en puntos, para orientar la extensión. */
  caja?: { ancho: number; alto: number };
  /** Ya no está en el documento; se conserva su instrucción por si vuelve. */
  huerfano?: boolean;
}

/**
 * plantillas/{id}: una plantilla de informe. El documento es un Google Doc o Slides de la unidad
 * Plantillas con marcadores (ver dominio/marcadores.ts); aquí se guardan sus instrucciones y lo
 * que se ha leído del documento. Las plantillas de la ONG son plantillas como las demás.
 */
export interface Plantilla {
  nombre: string;
  descripcion: string;
  tipo: TipoInforme;
  formato: FormatoPlantilla;
  estado: EstadoPlantilla;
  /** La que se propone para su tipo y formato. */
  porDefecto: boolean;
  /** Si es la plantilla propia de un donante. */
  donante: { id: string; nombre: string } | null;
  /** Idioma del texto fijo; si el informe va en otro, se traduce. */
  idioma: Idioma;
  archivoId: string;
  url: string;
  origen: 'app' | 'ejemplo' | 'drive';
  /** Informe de ejemplo del que salió, si lo hay. */
  ejemplo: { archivoId: string; nombre: string } | null;
  /** Versión de las instrucciones (ver plantillas/{id}/versiones). */
  version: number;
  instrucciones: InstruccionesPlantilla;
  /** Lo que hay en el documento, leído al sincronizar. */
  estructura: { campos: CampoPlantilla[]; datos: string[]; tablas: string[] };
  sincronizado: { modificado: string; fecha: string; avisos: string[] } | null;
  error?: string;
  creado: string;
  creadoPor: Persona;
  actualizado: string;
  actualizadoPor: Persona;
}

/** plantillas/{id}/versiones/{n}: cada versión guardada de las instrucciones, para volver atrás. */
export interface VersionPlantilla {
  version: number;
  instrucciones: InstruccionesPlantilla;
  nota: string;
  creado: string;
  creadoPor: Persona;
}

/**
 * Borradores hechos con IA, en Google Docs o Slides. Los de un proyecto están en
 * proyectos/{codigo}/informes/{id}; los de conjunto, en informes/{id}. La app no los envía:
 * un voluntario los revisa en Google y los descarga para enviarlos.
 */
export interface Informe {
  titulo: string;
  tipo: TipoInforme;
  formato: FormatoInforme;
  /** En los de conjunto: la contraparte o el donante del informe (null = todos). */
  sobre?: { id: string; nombre: string } | null;
  /** En los de conjunto: los filtros con que se eligieron los proyectos. */
  filtros?: { estados: EstadoProyecto[]; paises: string[] };
  plantilla: { id: string; nombre: string; version?: number };
  desde: string;
  hasta: string;
  donante: { id: string; nombre: string } | null;
  idioma: Idioma;
  /** Solo en los informes anteriores al sistema de plantillas. */
  extension?: ExtensionInforme;
  /** Lo que el voluntario quiso destacar al pedirlo. */
  indicaciones?: string;
  /** Vacíos hasta que el documento está hecho. */
  docId: string;
  url: string;
  /** Cuántos huecos (resaltados en amarillo) quedan por completar. */
  pendientes: number;
  /** Solo en los informes anteriores: notas que iban al final del documento. */
  notas?: string[];
  /** De dónde sale cada campo de la IA: clave → eventos o datos usados. Se ve en la app. */
  fuentes?: Record<string, string[]>;
  /** Resumen en español, para el siguiente informe y para la lista. */
  resumen: string;
  hechoPorIA: boolean;
  /** Sin estado: hecho antes del trabajo en segundo plano (está listo). */
  estado?: EstadoInforme;
  /** Cómo va: campos redactados de los que hay. */
  progreso?: { campos: number; hechos: number };
  /** «lote»: la IA trabaja en un lote de OpenRouter; «directo»: llamadas normales. */
  modo?: 'lote' | 'directo';
  lote?: { id: string; enviado: string; comprobado: string; reenviado: boolean } | null;
  error?: string;
  /** Hasta cuándo lo está procesando una ejecución (para que no lo hagan dos a la vez). */
  bloqueo?: string;
  intentos?: number;
  creado: string;
  creadoPor: Persona;
  actualizado?: string;
}

/** en_cola → redactando (la IA, en un lote o directo) → componiendo (el documento) → listo. */
export type EstadoInforme = 'en_cola' | 'redactando' | 'componiendo' | 'listo' | 'error';
