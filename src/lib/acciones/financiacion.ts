'use server';

import { revalidatePath } from 'next/cache';
import { permitido, persona } from '../sesion';
import { leerProyecto } from '../dominio/proyectos';
import {
  fechaValida,
  importeValido,
  quitarCobro,
  quitarCompromiso,
  quitarEnvio,
  registrarCobro,
  registrarCompromiso,
  registrarEnvio,
  renombrarDonanteEnAportaciones,
} from '../dominio/aportaciones';
import { actualizarDonante, crearDonante, leerDonante, TIPOS_DONANTE } from '../dominio/donantes';
import { exportarFinanciacion } from '../dominio/financiacionHoja';
import { intentar, numero, texto, type Resultado } from './resultado';
import type { TipoDonante } from '../tipos';

function rutas(codigo: string) {
  revalidatePath(`/proyectos/${codigo}`);
  revalidatePath('/', 'layout');
}

/** Un donante (nuevo o ya registrado) se compromete con un importe. */
export async function compromisoAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const codigo = texto(fd, 'codigo', 20);
    const p = await leerProyecto(codigo);
    if (!p) throw new Error('Proyecto no encontrado');
    const importe = importeValido(numero(fd, 'importe'), 'el importe comprometido');

    let donanteId = texto(fd, 'donante', 100);
    if (donanteId === 'nuevo') {
      const nombre = texto(fd, 'donante_nombre', 200);
      if (!nombre) throw new Error('Escribe el nombre del donante nuevo.');
      const tipo = texto(fd, 'donante_tipo', 20) as TipoDonante;
      donanteId = (
        await crearDonante({
          nombre,
          tipo: tipo in TIPOS_DONANTE ? tipo : 'otra',
          contactoNombre: '',
          correo: '',
          informes: '',
          plantilla: '',
          notas: '',
        })
      ).id;
    }
    const donante = await leerDonante(donanteId);
    if (!donante) throw new Error('Elige un donante.');

    const r = await registrarCompromiso(
      codigo,
      { donanteId, donanteNombre: donante.nombre, importe, fecha: fechaValida(texto(fd, 'fecha', 10)), nota: texto(fd, 'nota', 200) },
      persona(yo),
    );
    rutas(codigo);
    revalidatePath('/donantes', 'layout');
    return r === 'sumado' ? `Sumado a lo que ya había comprometido ${donante.nombre}.` : 'Compromiso registrado.';
  });
}

export async function quitarCompromisoAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const codigo = await quitarCompromiso(texto(fd, 'aportacion', 100), texto(fd, 'registro', 40), persona(yo));
    rutas(codigo);
    revalidatePath('/donantes', 'layout');
  });
}

export async function cobroAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const id = texto(fd, 'aportacion', 100);
    if (!id) throw new Error('Elige de qué donante es el cobro.');
    const codigo = await registrarCobro(
      id,
      { importe: importeValido(numero(fd, 'importe')), fecha: fechaValida(texto(fd, 'fecha', 10)), nota: texto(fd, 'nota', 200) },
      persona(yo),
    );
    rutas(codigo);
    revalidatePath('/donantes', 'layout');
    return 'Cobro registrado.';
  });
}

export async function quitarCobroAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const codigo = await quitarCobro(texto(fd, 'aportacion', 100), texto(fd, 'registro', 40), persona(yo));
    rutas(codigo);
    revalidatePath('/donantes', 'layout');
  });
}

export async function envioAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const codigo = texto(fd, 'codigo', 20);
    await registrarEnvio(codigo, { importe: importeValido(numero(fd, 'importe')), fecha: fechaValida(texto(fd, 'fecha', 10)), nota: texto(fd, 'nota', 200) }, persona(yo));
    rutas(codigo);
    return 'Envío registrado.';
  });
}

export async function quitarEnvioAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const codigo = texto(fd, 'codigo', 20);
    await quitarEnvio(codigo, texto(fd, 'registro', 40), persona(yo));
    rutas(codigo);
  });
}

/** Libro de Google Sheets con la financiación del proyecto; devuelve su dirección para abrirlo. */
export async function exportarFinanciacionAccion(_: Resultado & { url?: string }, fd: FormData): Promise<Resultado & { url?: string }> {
  let url = '';
  const r = await intentar(async () => {
    const yo = await permitido('edicion');
    url = await exportarFinanciacion(texto(fd, 'codigo', 20), persona(yo));
    return 'Hoja de cálculo creada en 04_Administración.';
  });
  return r.ok ? { ...r, url } : r;
}

export async function guardarDonante(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await permitido('edicion');
    const id = texto(fd, 'id', 100);
    const nombre = texto(fd, 'nombre', 200);
    if (!nombre) throw new Error('Escribe el nombre del donante.');
    const tipo = texto(fd, 'tipo', 20) as TipoDonante;
    const correo = texto(fd, 'correo', 200).toLowerCase();
    if (correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) throw new Error('El correo no es válido.');
    const datos = {
      nombre,
      tipo: tipo in TIPOS_DONANTE ? tipo : ('otra' as TipoDonante),
      contactoNombre: texto(fd, 'contactoNombre', 200),
      correo,
      informes: texto(fd, 'informes', 2000),
      plantilla: texto(fd, 'plantilla', 500),
      notas: texto(fd, 'notas', 4000),
    };
    if (id) {
      const antes = await leerDonante(id);
      if (!antes) throw new Error('Donante no encontrado');
      await actualizarDonante(id, datos);
      if (antes.nombre !== nombre) await renombrarDonanteEnAportaciones(id, nombre);
    } else {
      await crearDonante(datos);
    }
    revalidatePath('/donantes', 'layout');
    return id ? 'Donante guardado.' : 'Donante añadido.';
  });
}
