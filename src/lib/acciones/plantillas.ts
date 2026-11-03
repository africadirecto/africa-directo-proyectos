'use server';

// Plantillas de informe. Las gestiona quien tiene permiso de edición; borrar una, elegir la
// que se propone por defecto y crear las de la ONG es cosa de administración.

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { permitido, persona } from '../sesion';
import { intentar, texto, type Resultado } from './resultado';
import { leerDonante } from '../dominio/donantes';
import {
  TIPOS_PLANTILLA,
  borrarPlantilla,
  cambiarEstadoPlantilla,
  duplicarPlantilla,
  editarPlantilla,
  guardarInstrucciones,
  leerPlantilla,
  marcarPorDefecto,
  registrarPlantilla,
  restaurarVersion,
  sincronizarPlantilla,
  type DatosPlantilla,
} from '../dominio/plantillas';
import { crearPlantillasDeLaApp } from '../dominio/plantillasApp';
import { avanzarPlantilla, crearDesdeEjemplo, reintentarPlantilla } from '../trabajos/plantilla';
import { aplicarPropuesta, descartarPropuesta, proponerCambioPlantilla, type PropuestaPlantilla } from '../dominio/cambiosPlantilla';
import type { Idioma, TipoInforme } from '../tipos';

const IDIOMAS: Idioma[] = ['es', 'fr', 'en', 'pt'];

async function datosDe(fd: FormData): Promise<DatosPlantilla> {
  const nombre = texto(fd, 'nombre', 200);
  if (!nombre) throw new Error('Escribe un nombre para la plantilla.');
  const tipo = texto(fd, 'tipo', 20) as TipoInforme;
  if (!(tipo in TIPOS_PLANTILLA)) throw new Error('Elige para qué informe es.');
  const idioma = texto(fd, 'idioma', 2) as Idioma;
  const donanteId = texto(fd, 'donante', 100);
  const donante = donanteId ? await leerDonante(donanteId) : null;
  return {
    nombre,
    descripcion: texto(fd, 'descripcion', 1000),
    tipo,
    idioma: IDIOMAS.includes(idioma) ? idioma : 'es',
    donante: donante ? { id: donante.id, nombre: donante.nombre } : null,
  };
}

const revalidar = () => revalidatePath('/plantillas', 'layout');

export async function crearPlantillasAppAccion(_: Resultado): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('admin');
    const n = await crearPlantillasDeLaApp(persona(yo));
    revalidar();
    return n ? `Creadas ${n} plantillas en «AD · Plantillas / ONG».` : 'Ya estaban todas creadas.';
  });
}

export async function anadirDesdeDriveAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const archivoId = texto(fd, 'archivo', 100);
    if (!archivoId) throw new Error('Elige el documento de Drive.');
    const p = await registrarPlantilla(archivoId, { ...(await datosDe(fd)), origen: 'drive', estado: 'activa' }, persona(yo));
    revalidar();
    redirect(`/plantillas/${p.id}`);
  });
}

export async function editarPlantillaAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    await editarPlantilla(texto(fd, 'id', 100), await datosDe(fd), persona(yo));
    revalidar();
    return 'Guardado.';
  });
}

export async function sincronizarAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const p = await sincronizarPlantilla(texto(fd, 'id', 100), persona(yo), true);
    revalidar();
    const avisos = p.sincronizado?.avisos.length ?? 0;
    return `Documento leído: ${p.estructura.campos.filter((c) => !c.huerfano).length} campos para la IA${avisos ? `, ${avisos} aviso${avisos > 1 ? 's' : ''}` : ''}.`;
  });
}

/** Las instrucciones del formulario: «general» y un «campo.<clave>» por cada campo. */
function instruccionesDe(fd: FormData) {
  const campos: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith('campo.') && typeof v === 'string') campos[k.slice(6)] = v.trim().slice(0, 4000);
  return { general: texto(fd, 'general', 6000), campos };
}

export async function guardarInstruccionesAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const id = texto(fd, 'id', 100);
    const p = await leerPlantilla(id);
    if (!p) throw new Error('Plantilla no encontrada.');
    const nuevas = instruccionesDe(fd);
    // Los campos que no vienen en el formulario (p. ej. los que ya no están) conservan su instrucción.
    const instrucciones = { general: nuevas.general, campos: { ...p.instrucciones.campos, ...nuevas.campos } };
    if (JSON.stringify(instrucciones) === JSON.stringify(p.instrucciones)) return 'No había cambios.';
    const v = await guardarInstrucciones(id, instrucciones, texto(fd, 'nota', 300) || 'Cambio de instrucciones', persona(yo));
    revalidar();
    return `Guardada la versión ${v}.`;
  });
}

export interface ResultadoPropuesta extends Resultado {
  propuesta?: PropuestaPlantilla;
}

/** «Cambiar con IA»: la propuesta, para revisarla. Parte de las instrucciones del formulario, aunque no estén guardadas. */
export async function proponerCambioAccion(_: ResultadoPropuesta, fd: FormData): Promise<ResultadoPropuesta> {
  let propuesta: PropuestaPlantilla | undefined;
  const r = await intentar(async () => {
    const yo = await permitido('edicion');
    const peticion = texto(fd, 'peticion', 2000);
    if (!peticion) throw new Error('Escribe qué quieres cambiar.');
    propuesta = await proponerCambioPlantilla(texto(fd, 'id', 100), peticion, instruccionesDe(fd), persona(yo));
  });
  return { ...r, propuesta };
}

export async function aplicarPropuestaAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const mensaje = await aplicarPropuesta(texto(fd, 'id', 100), persona(yo));
    revalidar();
    return mensaje;
  });
}

export async function descartarPropuestaAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await permitido('edicion');
    await descartarPropuesta(texto(fd, 'id', 100));
  });
}

export async function restaurarVersionAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const v = await restaurarVersion(texto(fd, 'id', 100), Number(texto(fd, 'version', 10)), persona(yo));
    revalidar();
    return `Recuperada como versión ${v}.`;
  });
}

export async function estadoPlantillaAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const estado = texto(fd, 'estado', 20);
    if (estado !== 'activa' && estado !== 'archivada') throw new Error('Estado no válido.');
    await cambiarEstadoPlantilla(texto(fd, 'id', 100), estado, persona(yo));
    revalidar();
    return { activa: 'Recuperada: vuelve a ofrecerse al generar informes.', archivada: 'Archivada: ya no se ofrece al generar informes.' }[estado];
  });
}

export async function porDefectoAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('admin');
    await marcarPorDefecto(texto(fd, 'id', 100), persona(yo));
    revalidar();
    return 'Ahora es la que se propone primero.';
  });
}

export async function duplicarPlantillaAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const nombre = texto(fd, 'nombre', 200);
    if (!nombre) throw new Error('Escribe un nombre para la copia.');
    const p = await duplicarPlantilla(texto(fd, 'id', 100), nombre, persona(yo));
    revalidar();
    redirect(`/plantillas/${p.id}`);
  });
}

export async function borrarPlantillaAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await permitido('admin');
    await borrarPlantilla(texto(fd, 'id', 100));
    revalidar();
    redirect('/plantillas');
  });
}

/** Plantilla nueva a partir de un informe de ejemplo (ya subido o elegido de la unidad): se prepara en segundo plano. */
export async function crearDesdeEjemploAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const ejemplo = texto(fd, 'ejemplo', 100);
    if (!ejemplo) throw new Error('Sube o elige el informe de ejemplo.');
    const id = await crearDesdeEjemplo(ejemplo, await datosDe(fd), persona(yo));
    after(() => avanzarPlantilla(id));
    revalidar();
    redirect(`/plantillas/${id}`);
  });
}

export async function reintentarPlantillaAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await permitido('edicion');
    const id = texto(fd, 'id', 100);
    await reintentarPlantilla(id);
    after(() => avanzarPlantilla(id));
    revalidar();
    return 'En marcha otra vez.';
  });
}
