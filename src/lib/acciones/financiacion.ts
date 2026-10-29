'use server';

import { revalidatePath } from 'next/cache';
import { permitido, persona } from '../sesion';
import { leerProyecto } from '../dominio/proyectos';
import { actualizarAportacion, crearAportacion, ESTADOS_APORTACION, renombrarDonanteEnAportaciones } from '../dominio/aportaciones';
import { actualizarDonante, crearDonante, leerDonante, TIPOS_DONANTE } from '../dominio/donantes';
import { MONEDAS } from '../paises';
import { intentar, numero, texto, type Resultado } from './resultado';
import type { EstadoAportacion, TipoDonante } from '../tipos';

function estadoValido(e: string): e is EstadoAportacion {
  return e in ESTADOS_APORTACION;
}

export async function anadirAportacion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const codigo = texto(fd, 'codigo', 20);
    const p = await leerProyecto(codigo);
    if (!p) throw new Error('Proyecto no encontrado');

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

    const importe = numero(fd, 'importe');
    if (!importe || importe <= 0) throw new Error('Escribe el importe.');
    const moneda = MONEDAS.includes(texto(fd, 'moneda', 3)) ? texto(fd, 'moneda', 3) : p.moneda;
    const importeProyecto = moneda === p.moneda ? importe : numero(fd, 'importe_proyecto');
    if (!importeProyecto || importeProyecto <= 0) {
      throw new Error(`La aportación está en ${moneda}: indica su equivalente en ${p.moneda}.`);
    }
    const estado = texto(fd, 'estado', 20);
    if (!estadoValido(estado)) throw new Error('Elige el estado de la aportación.');

    await crearAportacion(
      codigo,
      { donanteId, donanteNombre: donante.nombre, importe, moneda, importeProyecto, estado, notas: texto(fd, 'notas', 1000) },
      persona(yo),
    );
    revalidatePath(`/proyectos/${codigo}`);
    revalidatePath('/', 'layout');
    return 'Aportación añadida.';
  });
}

export async function cambiarAportacion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const estado = texto(fd, 'estado', 20);
    if (!estadoValido(estado)) throw new Error('Estado no válido.');
    await actualizarAportacion(texto(fd, 'id', 100), { estado }, persona(yo));
    revalidatePath(`/proyectos/${texto(fd, 'codigo', 20)}`);
    revalidatePath('/', 'layout');
    revalidatePath('/donantes', 'layout');
  });
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
