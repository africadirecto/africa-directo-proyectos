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
  moneda: string;
  presupuesto: number | null;
  /** Suma de aportaciones comprometidas o recibidas, en la moneda del proyecto. */
  comprometido: number;
  recibido: number;
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

export type EstadoAportacion = 'ofrecida' | 'interesado' | 'comprometida' | 'recibida' | 'descartada';

/** aportaciones/{id}: relación proyecto–donante. */
export interface Aportacion {
  proyecto: string;
  proyectoTitulo: string;
  donanteId: string;
  donanteNombre: string;
  importe: number;
  moneda: string;
  /** Equivalente en la moneda del proyecto (igual a `importe` si es la misma moneda). */
  importeProyecto: number;
  estado: EstadoAportacion;
  notas: string;
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

export type TipoInforme = 'seguimiento' | 'final';
export type ExtensionInforme = 'breve' | 'normal' | 'detallado';

/** proyectos/{codigo}/informes/{id}: borradores de informe hechos con IA, en Google Docs. */
export interface Informe {
  titulo: string;
  tipo: TipoInforme;
  plantilla: { id: string; nombre: string };
  desde: string;
  hasta: string;
  donante: { id: string; nombre: string } | null;
  idioma: Idioma;
  extension: ExtensionInforme;
  docId: string;
  url: string;
  /** Ningún informe sale hacia un donante sin aprobación humana. */
  estado: 'borrador' | 'aprobado';
  /** Cuántos [PENDIENTE: …] dejó la IA para que los complete un voluntario. */
  pendientes: number;
  /** Resumen en español, para el siguiente informe y para la lista. */
  resumen: string;
  hechoPorIA: boolean;
  creado: string;
  creadoPor: Persona;
  aprobado?: string;
  aprobadoPor?: Persona;
}
