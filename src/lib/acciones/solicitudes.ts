'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { permitido, persona } from '../sesion';
import { correoDisponible } from '../avisos';
import { crearContraparte, leerContraparte } from '../dominio/contrapartes';
import { crearProyecto } from '../dominio/proyectos';
import { decidir, enviarInvitacion, procesarSolicitud, renovarEnlace } from '../dominio/solicitudes';
import { PAISES } from '../paises';
import { esIdioma, SECTORES } from '../formulario/textos';
import { intentar, texto, type Resultado } from './resultado';
import type { Decision } from '../tipos';

const correoValido = (c: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c);

/** Da de alta la contraparte (si es nueva) y la solicitud, con su carpeta y su enlace. */
export async function nuevaSolicitud(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
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
    const sector = texto(fd, 'sector', 40);

    const { proyecto, errorDrive } = await crearProyecto({
      contraparte,
      titulo: texto(fd, 'titulo', 200),
      sector: SECTORES[sector] ? sector : '',
      responsable: persona(yo),
      autor: persona(yo),
    });

    let enviado = false;
    if (fd.get('enviar') === 'on' && correoDisponible() && proyecto.contraparte.correo) {
      enviado = await enviarInvitacion(proyecto.codigo, persona(yo));
    }
    revalidatePath('/', 'layout');
    const aviso = errorDrive ? '&drive=0' : '';
    redirect(`/solicitudes?p=${proyecto.codigo}&nueva=${enviado ? 'enviada' : '1'}${aviso}`);
  });
}

export async function decidirSolicitud(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const codigo = texto(fd, 'codigo', 20);
    const decision = texto(fd, 'decision', 20) as Decision;
    if (!['validar', 'cambios', 'rechazar'].includes(decision)) throw new Error('Decisión no válida.');
    const { correoEnviado } = await decidir(codigo, decision, texto(fd, 'comentario', 4000), persona(yo));
    revalidatePath('/', 'layout');
    const base = { validar: 'Propuesta validada.', cambios: 'Cambios pedidos.', rechazar: 'Solicitud rechazada.' }[decision];
    if (decision === 'validar') return base;
    return correoEnviado ? `${base} Se ha enviado el correo a la contraparte.` : `${base} No se ha enviado ningún correo: copia el texto y envíalo tú.`;
  });
}

export async function reenviarFormulario(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const ok = await enviarInvitacion(texto(fd, 'codigo', 20), persona(yo));
    revalidatePath('/solicitudes');
    if (!ok) throw new Error('No se pudo enviar el correo. Copia el enlace y envíalo tú.');
    return 'Correo enviado a la contraparte.';
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
