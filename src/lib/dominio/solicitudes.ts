// Ciclo de la solicitud: enlace para la contraparte, borrador con guardado
// automático, envío de versiones, análisis con IA y decisión del revisor.

import { almacen } from '../almacen';
import { config } from '../config';
import { drive, conFecha } from '../drive';
import { idDeToken, nuevoIdEnlace, urlFormulario } from '../enlaces';
import { avisarChat } from '../avisos';
import { analizarSolicitud, traducir } from '../ia';
import { avisosAutomaticos, totalPresupuesto } from '../formulario/respuestas';
import { CORREOS, nombreSector, IDIOMAS_ES } from '../formulario/textos';
import { nombrePais } from '../paises';
import { actualizarProyecto, cambiarEstado, leerProyecto, nombreCarpeta } from './proyectos';
import { anotarEvento } from './eventos';
import type {
  ArchivoProyecto,
  ArchivoSubido,
  BorradorSolicitud,
  Decision,
  Enlace,
  Idioma,
  Persona,
  Proyecto,
  RespuestasSolicitud,
  Revision,
  VersionSolicitud,
} from '../tipos';

const DIAS_EXTRA_CAMBIOS = 90;
export const MAX_ARCHIVOS = 40;

const rutaBorrador = (codigo: string) => `proyectos/${codigo}/solicitudes/borrador`;

// ── Enlace ──────────────────────────────────────────────────────────────────

export interface AccesoEnlace {
  enlaceId: string;
  enlace: Enlace;
  proyecto: Proyecto;
}

/** Comprueba el token del enlace (firma, caducidad, revocación) y carga su proyecto. */
export async function abrirEnlace(token: string): Promise<AccesoEnlace | null> {
  const enlaceId = idDeToken(token);
  if (!enlaceId) return null;
  const enlace = await (await almacen()).leer<Enlace>(`enlaces/${enlaceId}`);
  if (!enlace || enlace.revocado || enlace.caduca < new Date().toISOString()) return null;
  const proyecto = await leerProyecto(enlace.proyecto);
  if (!proyecto || proyecto.formulario.enlaceId !== enlaceId) return null;
  return { enlaceId, enlace, proyecto };
}

/** ¿Puede la contraparte editar la solicitud ahora mismo? */
export function formularioEditable(p: Proyecto): boolean {
  return p.estado === 'solicitud' && p.formulario.estado !== 'cerrado';
}

/** A quién se saluda en los correos: la persona de contacto o, si no hay, la organización. */
function saludo(p: Proyecto): string {
  return p.contraparte.contacto || p.contraparte.nombre;
}

export function enlaceDe(p: Proyecto): string {
  return urlFormulario(p.formulario.enlaceId);
}

/** Revoca el enlace actual y crea otro (si se ha filtrado o ha caducado). */
export async function renovarEnlace(codigo: string, autor: Persona): Promise<Proyecto> {
  const db = await almacen();
  const p = await leerProyecto(codigo);
  if (!p) throw new Error('Proyecto no encontrado');
  await db.guardar(`enlaces/${p.formulario.enlaceId}`, { revocado: true }, { fusionar: true });
  const enlaceId = nuevoIdEnlace();
  const ahora = new Date();
  await db.guardar(`enlaces/${enlaceId}`, {
    proyecto: codigo,
    accion: 'solicitud',
    creado: ahora.toISOString(),
    creadoPor: autor,
    caduca: new Date(ahora.getTime() + 180 * 86_400_000).toISOString(),
    revocado: false,
  } satisfies Enlace);
  await anotarEvento(codigo, { tipo: 'sistema', autor, texto: 'Enlace del formulario renovado; el anterior ya no funciona.' });
  return actualizarProyecto(codigo, { formulario: { ...p.formulario, enlaceId } });
}

async function alargarEnlace(enlaceId: string) {
  const caduca = new Date(Date.now() + DIAS_EXTRA_CAMBIOS * 86_400_000).toISOString();
  await (await almacen()).guardar(`enlaces/${enlaceId}`, { caduca }, { fusionar: true });
}

/**
 * Correo listo para copiar, en el idioma de la contraparte: con el enlace o, si se han
 * pedido cambios, con los comentarios. La app no envía correos: lo envía el voluntario.
 */
export function textoInvitacion(p: Proyecto): { asunto: string; texto: string } {
  const datos = { nombre: saludo(p), codigo: p.codigo, enlace: enlaceDe(p) };
  const c = p.formulario.comentarios;
  return p.formulario.estado === 'cambios' && c
    ? CORREOS.cambios[p.contraparte.idioma]({ ...datos, comentarios: c.traducido || c.es })
    : CORREOS.invitacion[p.contraparte.idioma](datos);
}

/** Correo listo para copiar al rechazar, con el motivo (traducido si lo hay). */
export function textoRechazo(p: Proyecto, r: Revision): { asunto: string; texto: string } {
  return CORREOS.rechazo[p.contraparte.idioma]({
    nombre: saludo(p),
    codigo: p.codigo,
    enlace: enlaceDe(p),
    comentarios: r.comentarioTraducido || r.comentario,
  });
}

// ── Borrador ────────────────────────────────────────────────────────────────

export async function leerBorrador(codigo: string): Promise<BorradorSolicitud | null> {
  return (await almacen()).leer<BorradorSolicitud>(rutaBorrador(codigo));
}

/** La primera vez que la contraparte abre el formulario se anota (para los recordatorios). */
export async function marcarAbierto(p: Proyecto): Promise<void> {
  if (p.formulario.abiertoEn || p.formulario.estado !== 'pendiente') return;
  await actualizarProyecto(p.codigo, { formulario: { ...p.formulario, estado: 'abierto', abiertoEn: new Date().toISOString() } });
}

export async function guardarBorrador(codigo: string, respuestas: Partial<RespuestasSolicitud>, idioma: Idioma): Promise<string> {
  const actualizado = new Date().toISOString();
  await (await almacen()).guardar(rutaBorrador(codigo), { respuestas, idioma, actualizado }, { fusionar: true });
  return actualizado;
}

export async function anadirArchivoBorrador(codigo: string, archivo: ArchivoSubido): Promise<ArchivoSubido[]> {
  const db = await almacen();
  return db.transaccion(async (tx) => {
    const b = (await tx.leer<BorradorSolicitud>(rutaBorrador(codigo))) ?? { respuestas: {}, archivos: [], idioma: 'es', actualizado: '' };
    const archivos = [...(b.archivos ?? []).filter((a) => a.id !== archivo.id), archivo];
    if (archivos.length > MAX_ARCHIVOS) throw new Error('Demasiados archivos');
    tx.guardar(rutaBorrador(codigo), { ...b, archivos });
    return archivos;
  });
}

/** Quita un archivo del borrador y lo manda a la papelera de Drive (recuperable 30 días). */
export async function quitarArchivoBorrador(codigo: string, id: string, versionesPrevias: VersionSolicitud[]): Promise<ArchivoSubido[]> {
  const db = await almacen();
  const archivos = await db.transaccion(async (tx) => {
    const b = await tx.leer<BorradorSolicitud>(rutaBorrador(codigo));
    if (!b) return [];
    const resto = (b.archivos ?? []).filter((a) => a.id !== id);
    tx.guardar(rutaBorrador(codigo), { ...b, archivos: resto });
    return resto;
  });
  // Si ya formaba parte de una versión enviada, se conserva en Drive.
  if (!versionesPrevias.some((v) => v.archivos.some((a) => a.id === id))) {
    await (await drive()).aPapelera(id).catch(() => undefined);
  }
  return archivos;
}

// ── Envío ───────────────────────────────────────────────────────────────────

export async function listarVersiones(codigo: string): Promise<VersionSolicitud[]> {
  const docs = await (await almacen()).consultar<VersionSolicitud>(`proyectos/${codigo}/solicitudes`);
  return docs.filter((d) => d.id !== 'borrador').sort((a, b) => b.version - a.version);
}

/** Guarda una versión nueva, pasa el proyecto a En revisión y copia los datos a la ficha. */
export async function enviarSolicitud(codigo: string, respuestas: RespuestasSolicitud, idioma: Idioma): Promise<number> {
  const db = await almacen();
  const p = await leerProyecto(codigo);
  if (!p || !formularioEditable(p)) throw new Error('El formulario no está abierto');
  const borrador = await leerBorrador(codigo);
  const archivos = borrador?.archivos ?? [];
  const version = p.formulario.version + 1;
  const ahora = new Date().toISOString();

  const v: VersionSolicitud = { version, respuestas, archivos, idioma, enviada: ahora, analisis: null, pdf: null };
  await db.guardar(`proyectos/${codigo}/solicitudes/v${version}`, { ...v });
  await db.guardar(rutaBorrador(codigo), { respuestas, idioma, archivos, actualizado: ahora });

  for (const a of archivos) {
    const registro: ArchivoProyecto = {
      nombre: a.nombre,
      mime: a.mime,
      tamano: a.tamano,
      carpeta: 'solicitud',
      esFoto: a.mime.startsWith('image/'),
      publicable: false,
      origen: 'contraparte',
      fecha: a.subido,
    };
    await db.guardar(`proyectos/${codigo}/archivos/${a.id}`, { ...registro }, { fusionar: true });
  }

  const presupuesto = totalPresupuesto(respuestas.lineas);
  await actualizarProyecto(codigo, {
    titulo: p.titulo || respuestas.titulo,
    sector: respuestas.sector || p.sector,
    pais: respuestas.pais || p.pais,
    lugar: respuestas.lugar,
    lat: respuestas.lat ?? p.lat,
    lng: respuestas.lng ?? p.lng,
    moneda: respuestas.moneda,
    presupuesto: presupuesto || p.presupuesto,
    descripcion: respuestas.necesidad,
    beneficiarios: respuestas.numBeneficiarios
      ? `${respuestas.numBeneficiarios} · ${respuestas.beneficiarios}`
      : respuestas.beneficiarios,
    formulario: { ...p.formulario, estado: 'enviado', version, recibidoEn: ahora },
    ultimaNoticia: ahora,
  });
  await cambiarEstado(codigo, 'revision', `Recibida la versión ${version} de la solicitud.`, null);
  await anotarEvento(codigo, {
    tipo: 'solicitud',
    autor: null,
    texto: `La contraparte envía la solicitud (versión ${version}) con ${archivos.length} archivo${archivos.length === 1 ? '' : 's'}.`,
  });
  return version;
}

/** Trabajo lento tras el envío: análisis con IA, PDF en Drive y aviso al equipo. */
export async function procesarSolicitud(codigo: string, version: number): Promise<void> {
  const db = await almacen();
  const ruta = `proyectos/${codigo}/solicitudes/v${version}`;
  const v = await db.leer<VersionSolicitud>(ruta);
  const p = await leerProyecto(codigo);
  if (!v || !p) return;

  const analisis = await analizarSolicitud(v.respuestas, v.idioma, avisosAutomaticos(v.respuestas, v.archivos));
  await db.guardar(ruta, { analisis }, { fusionar: true });
  const cambios: Partial<Proyecto> = { resumen: analisis.resumen };
  if (analisis.hechoPorIA && (!p.titulo || p.titulo === v.respuestas.titulo)) cambios.titulo = analisis.tituloEs;
  if (analisis.traduccion?.necesidad) cambios.descripcion = analisis.traduccion.necesidad;
  const actualizado = await actualizarProyecto(codigo, cambios);

  const d = await drive();
  if (p.drive) {
    try {
      if (cambios.titulo && cambios.titulo !== p.titulo) await d.renombrar(p.drive.carpetaId, nombreCarpeta(actualizado));
      const pdf = await d.htmlAPdf(htmlSolicitud(actualizado, { ...v, analisis }), p.drive.subcarpetas.solicitud, conFecha(`Solicitud v${version}`));
      await db.guardar(ruta, { pdf: { id: pdf.id, nombre: pdf.nombre } }, { fusionar: true });
    } catch (e) {
      console.error('Drive: no se pudo guardar el PDF de la solicitud', e);
    }
  }

  await avisarChat(
    `📥 Nueva solicitud por revisar: ${codigo} ${actualizado.titulo} (${actualizado.contraparte.nombre}).` +
      (analisis.falta.length ? ` Falta: ${analisis.falta.slice(0, 3).join(' ')}` : '') +
      ` ${config.appUrl}/solicitudes?p=${codigo}`,
  );
}

function escapar(t: string) {
  return t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** HTML de la solicitud para generar su PDF (original y, si la hay, traducción). */
export function htmlSolicitud(p: Proyecto, v: VersionSolicitud): string {
  const r = v.respuestas;
  const t = v.analisis?.traduccion;
  const fila = (etiqueta: string, valor: string | number | null | undefined, traduccion?: string) =>
    valor || valor === 0
      ? `<tr><th>${escapar(etiqueta)}</th><td>${escapar(String(valor)).replace(/\n/g, '<br>')}${
          traduccion && traduccion !== valor ? `<p style="color:#5E5D57"><i>${escapar(traduccion).replace(/\n/g, '<br>')}</i></p>` : ''
        }</td></tr>`
      : '';
  const lineas = r.lineas
    .filter((l) => l.concepto || l.importe)
    .map((l, i) => `<tr><td>${escapar(l.concepto)}${t?.conceptos[i] && t.conceptos[i] !== l.concepto ? ` <i>(${escapar(t.conceptos[i])})</i>` : ''}</td><td style="text-align:right">${l.importe ?? ''} ${r.moneda}</td></tr>`)
    .join('');
  return `<html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;font-size:11pt;color:#1B1B18}th{text-align:left;vertical-align:top;width:32%;color:#5E5D57;font-weight:normal;padding:4px 8px 4px 0}td{padding:4px 0}table{border-collapse:collapse;width:100%}
</style></head><body>
<h1>${escapar(p.codigo)} · ${escapar(r.titulo)}</h1>
<p>Solicitud versión ${v.version} · enviada el ${v.enviada.slice(0, 10)} · idioma: ${IDIOMAS_ES[v.idioma]}${t ? ' · con traducción al español (IA) en cursiva' : ''}</p>
${v.analisis?.resumen ? `<h2>Resumen</h2><p>${escapar(v.analisis.resumen)}</p>` : ''}
<h2>Organización</h2><table>
${fila('Organización', r.organizacion)}${fila('Persona responsable', r.contactoNombre)}${fila('Cargo', r.contactoCargo)}${fila('Correo', r.contactoCorreo)}${fila('Teléfono', r.contactoTelefono)}
</table>
<h2>Proyecto</h2><table>
${fila('Título', r.titulo, t?.titulo)}${fila('Sector', nombreSector(r.sector))}${fila('País', nombrePais(r.pais))}${fila('Lugar', r.lugar)}${fila('Indicaciones', r.indicaciones, t?.indicaciones)}
${fila('Coordenadas', r.lat != null ? `${r.lat}, ${r.lng}` : '')}${fila('Necesidad', r.necesidad, t?.necesidad)}${fila('Beneficiarios', r.beneficiarios, t?.beneficiarios)}
${fila('Número de beneficiarios', r.numBeneficiarios)}${fila('Plazo (meses)', r.plazoMeses)}${fila('Aportación local', r.aportacionLocal, t?.aportacionLocal)}
</table>
<h2>Presupuesto</h2><table>${lineas}<tr><th>Total</th><td style="text-align:right"><b>${totalPresupuesto(r.lineas)} ${r.moneda}</b></td></tr></table>
<h2>Archivos</h2><ul>${v.archivos.map((a) => `<li>${escapar(a.nombre)}</li>`).join('') || '<li>Ninguno</li>'}</ul>
</body></html>`;
}

// ── Revisión ────────────────────────────────────────────────────────────────

export async function listarRevisiones(codigo: string): Promise<Revision[]> {
  return (await almacen()).consultar<Revision>(`proyectos/${codigo}/revisiones`, { orden: ['fecha', 'desc'] });
}

/**
 * Decisión del revisor sobre la versión vigente:
 * - validar: pasa a Validada.
 * - cambios: vuelve a Solicitud y reabre el mismo enlace con los comentarios traducidos.
 * - rechazar: pasa a Rechazada.
 * La app no envía correos: el voluntario copia el texto que prepara (textoInvitacion, textoRechazo).
 */
export async function decidir(
  codigo: string,
  decision: Decision,
  comentario: string,
  autor: Persona,
): Promise<{ traducido: string }> {
  const p = await leerProyecto(codigo);
  if (!p) throw new Error('Proyecto no encontrado');
  if (p.estado !== 'revision') throw new Error('La solicitud no está en revisión.');
  if (decision === 'cambios' && !comentario.trim()) throw new Error('Escribe qué cambios necesitas.');

  const idioma = p.contraparte.idioma;
  // Sin IA (o en español) no hay traducción: la contraparte recibe el comentario tal cual.
  const t = decision === 'validar' || !comentario.trim() ? null : await traducir(comentario, idioma);
  const traducido = t?.traducido ? t.texto : '';
  const ahora = new Date().toISOString();

  const revision: Revision = {
    decision,
    comentario: comentario.trim(),
    comentarioTraducido: traducido,
    version: p.formulario.version,
    por: autor,
    fecha: ahora,
  };
  await (await almacen()).crear(`proyectos/${codigo}/revisiones`, { ...revision });

  if (decision === 'validar') {
    await actualizarProyecto(codigo, { revisor: { ...autor, fecha: ahora }, formulario: { ...p.formulario, estado: 'cerrado', comentarios: null } });
    await cambiarEstado(codigo, 'validada', comentario.trim() ? `Validada: ${comentario.trim()}` : 'Propuesta validada.', autor);
  } else if (decision === 'cambios') {
    await alargarEnlace(p.formulario.enlaceId);
    await actualizarProyecto(codigo, {
      formulario: { ...p.formulario, estado: 'cambios', enviadoEn: ahora, comentarios: { es: comentario.trim(), traducido, idioma } },
    });
    await cambiarEstado(codigo, 'solicitud', `Se piden cambios: ${comentario.trim()}`, autor);
  } else {
    await actualizarProyecto(codigo, { revisor: { ...autor, fecha: ahora } });
    await cambiarEstado(codigo, 'rechazada', comentario.trim() ? `Rechazada: ${comentario.trim()}` : 'Solicitud rechazada.', autor);
  }
  return { traducido };
}
