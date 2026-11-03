'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { permitido, persona } from '../sesion';
import { crearContraparte, leerContraparte, listarContrapartes } from '../dominio/contrapartes';
import { crearProyecto } from '../dominio/proyectos';
import { corregirComentario, decidir, deshacerDecision, enviarSolicitud, procesarSolicitud, renovarEnlace } from '../dominio/solicitudes';
import { camposQueFaltan, normalizar } from '../formulario/respuestas';
import { MONEDAS, PAISES } from '../paises';
import { esIdioma, SECTORES } from '../formulario/textos';
import { intentar, texto, type Resultado } from './resultado';
import type { Decision, Idioma } from '../tipos';

const correoValido = (c: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c);

/** La contraparte elegida en el formulario o, si es «nueva», la que se da de alta con sus datos. */
async function contraparteDe(fd: FormData) {
  let contraparteId = texto(fd, 'contraparte', 100);
  if (contraparteId === 'nueva') {
    const nombre = texto(fd, 'cp_nombre', 200);
    const pais = texto(fd, 'cp_pais', 2);
    const idioma = texto(fd, 'cp_idioma', 2);
    const correo = texto(fd, 'cp_correo', 200).toLowerCase();
    if (!nombre) throw new Error('Escribe el nombre de la contraparte.');
    if (!PAISES[pais]) throw new Error('Elige el país de la contraparte.');
    if (!esIdioma(idioma)) throw new Error('Elige el idioma de la contraparte.');
    if (correo && !correoValido(correo)) throw new Error('El correo de la contraparte no es válido.');
    const c = await crearContraparte({
      nombre,
      tipo: texto(fd, 'cp_tipo', 100),
      pais,
      contactoNombre: texto(fd, 'cp_contacto', 200),
      correos: correo ? [correo] : [],
      idioma,
      notas: '',
    });
    contraparteId = c.id;
  }
  const contraparte = await leerContraparte(contraparteId);
  if (!contraparte) throw new Error('Elige una contraparte.');
  return contraparte;
}

/** Contrapartes para elegir en un diálogo: se piden al abrirlo, no en cada carga de la página. */
export async function opcionesContrapartes(): Promise<{ id: string; nombre: string; pais: string; correo: string; idioma: Idioma }[]> {
  await permitido('edicion');
  return (await listarContrapartes()).map((c) => ({ id: c.id, nombre: c.nombre, pais: c.pais, correo: c.correos[0] ?? '', idioma: c.idioma }));
}

/** Da de alta la contraparte (si es nueva) y la solicitud, con su carpeta y su enlace. */
export async function nuevaSolicitud(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const contraparte = await contraparteDe(fd);
    const sector = texto(fd, 'sector', 40);

    const { proyecto, errorDrive } = await crearProyecto({
      contraparte,
      titulo: texto(fd, 'titulo', 200),
      sector: SECTORES[sector] ? sector : '',
      autor: persona(yo),
    });

    revalidatePath('/', 'layout');
    const aviso = errorDrive ? '&drive=0' : '';
    redirect(`/solicitudes?p=${proyecto.codigo}&nueva=1${aviso}`);
  });
}

/**
 * Alta a mano, cuando la contraparte no puede usar el formulario: un voluntario rellena los
 * mismos datos y el proyecto entra En revisión, como una solicitud recibida (con su análisis).
 * La organización y el contacto salen de la contraparte.
 */
export async function altaManual(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const sector = texto(fd, 'sector', 40);
    const pais = texto(fd, 'pais', 2);
    const moneda = texto(fd, 'moneda', 3);
    if (!SECTORES[sector]) throw new Error('Elige el tipo de proyecto.');
    if (!PAISES[pais]) throw new Error('Elige el país del proyecto.');
    if (!MONEDAS.includes(moneda)) throw new Error('Elige la moneda del presupuesto.');
    const importes = fd.getAll('importe');
    const lineas = fd.getAll('concepto').map((concepto, i) => ({ concepto, importe: importes[i] }));
    const respuestas = normalizar({
      ...Object.fromEntries(['titulo', 'lugar', 'indicaciones', 'necesidad', 'beneficiarios', 'numBeneficiarios', 'plazoMeses', 'aportacionLocal'].map((c) => [c, fd.get(c) ?? ''])),
      sector,
      pais,
      moneda,
      lineas,
    });
    // La organización y el contacto salen de la contraparte (y el contacto puede faltar).
    const faltan = camposQueFaltan(respuestas).filter((c) => c !== 'organizacion' && c !== 'contactoNombre' && c !== 'contactoCorreo');
    if (faltan.includes('lineas')) throw new Error('Escribe al menos un importe del presupuesto.');
    if (faltan.length) throw new Error('Faltan datos obligatorios: título, lugar, qué se necesita y quiénes se benefician.');

    // Después de comprobar los datos, para no dar de alta una contraparte nueva si falta algo.
    const contraparte = await contraparteDe(fd);
    const { proyecto, errorDrive } = await crearProyecto({ contraparte, titulo: respuestas.titulo, sector, autor: persona(yo) });
    const version = await enviarSolicitud(
      proyecto.codigo,
      {
        ...respuestas,
        organizacion: contraparte.nombre.slice(0, 300),
        contactoNombre: contraparte.contactoNombre.slice(0, 300),
        contactoCorreo: contraparte.correos[0] ?? '',
        contactoTelefono: contraparte.telefono ?? '',
      },
      'es',
      persona(yo),
    );
    after(() => procesarSolicitud(proyecto.codigo, version));
    revalidatePath('/', 'layout');
    redirect(`/solicitudes?p=${proyecto.codigo}${errorDrive ? '&drive=0' : ''}`);
  });
}

export async function decidirSolicitud(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const codigo = texto(fd, 'codigo', 20);
    const decision = texto(fd, 'decision', 20) as Decision;
    if (!['validar', 'cambios', 'rechazar'].includes(decision)) throw new Error('Decisión no válida.');
    await decidir(codigo, decision, texto(fd, 'comentario', 4000), persona(yo));
    revalidatePath('/', 'layout');
    return {
      validar: 'Propuesta validada.',
      cambios: 'Cambios pedidos. Copia el correo para la contraparte y envíaselo.',
      rechazar: 'Solicitud rechazada. Copia el correo para la contraparte y envíaselo.',
    }[decision];
  });
}

/** Corrige el comentario de la última decisión (pedir cambios o rechazar). */
export async function corregirComentarioAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    await corregirComentario(texto(fd, 'codigo', 20), texto(fd, 'comentario', 4000), persona(yo));
    revalidatePath('/', 'layout');
    return 'Comentario corregido. El correo para la contraparte ya lleva el texto nuevo.';
  });
}

export async function deshacerDecisionAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    await deshacerDecision(texto(fd, 'codigo', 20), persona(yo));
    revalidatePath('/', 'layout');
    return 'Decisión deshecha: la solicitud vuelve a estar por revisar.';
  });
}

export async function renovarEnlaceAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    await renovarEnlace(texto(fd, 'codigo', 20), persona(yo));
    revalidatePath('/solicitudes');
    return 'Enlace renovado. El anterior ya no funciona: envía el nuevo a la contraparte.';
  });
}

/** Vuelve a pasar la última versión por la IA (por ejemplo, si falló o no estaba configurada). */
export async function reanalizar(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await permitido('edicion');
    const codigo = texto(fd, 'codigo', 20);
    const version = Number(texto(fd, 'version', 5));
    after(() => procesarSolicitud(codigo, version));
    return 'Análisis en marcha. Recarga la página en un minuto.';
  });
}
