// Exportar la financiación de un proyecto a un libro de Google Sheets, en su carpeta
// 04_Administración. Tres hojas: «Resumen», «Donantes» y «Registros» (compromisos, cobros y
// envíos con su fecha y nota). Los totales son fórmulas sobre «Registros»: si se corrige
// allí un importe, todo se recalcula. Fórmulas en español («;»), como en informesGenerales.

import { config } from '../config';
import { drive, conFecha } from '../drive';
import { ES_HOJA } from '../drive/tipos';
import { rellenarLibro, type Celda, type Hoja } from '../drive/sheets';
import { aportacionesDeProyecto, presupuestoEnEuros, type AportacionConId } from './aportaciones';
import { asegurarCarpetas } from './proyectos';
import { anotarEvento } from './eventos';
import type { Persona, Proyecto } from '../tipos';

/** Las hojas del libro (sin Google, para poder probarlas). */
export function hojasFinanciacion(p: Proyecto, aportaciones: AportacionConId[], hoy = new Date().toISOString().slice(0, 10)): Hoja[] {
  const registros: { fecha: string; tipo: string; donante: string; importe: number; nota: string }[] = [
    ...aportaciones.flatMap((a) => [
      ...a.compromisos.map((m) => ({ ...m, tipo: 'Compromiso', donante: a.donanteNombre })),
      ...a.cobros.map((m) => ({ ...m, tipo: 'Cobro', donante: a.donanteNombre })),
    ]),
    ...(p.envios ?? []).map((m) => ({ ...m, tipo: 'Envío', donante: '' })),
  ].sort((x, y) => x.fecha.localeCompare(y.fecha));

  // «Registros»: A fecha · B tipo · C donante · D importe · E nota.
  const suma = (tipo: string) => `=SUMAR.SI(Registros!B:B;"${tipo}";Registros!D:D)`;
  const sumaDonante = (tipo: string, fila: number) => `SUMAR.SI.CONJUNTO(Registros!D:D;Registros!B:B;"${tipo}";Registros!C:C;A${fila})`;

  return [
    {
      titulo: 'Resumen',
      formatosFila: { 4: 'euros', 5: 'euros', 6: 'euros', 7: 'euros', 8: 'euros', 9: 'euros', 10: 'porcentaje' },
      filas: [
        ['Financiación del proyecto', `${p.codigo} · ${p.titulo || `Solicitud de ${p.contraparte.nombre}`}`],
        ['Contraparte', p.contraparte.nombre],
        ['Generado', hoy],
        ['', ''],
        ['Presupuesto (€)', presupuestoEnEuros(p)],
        ['Comprometido (€)', suma('Compromiso')],
        ['Cobrado por AD (€)', suma('Cobro')],
        ['Enviado a la contraparte (€)', suma('Envío')],
        ['Por cobrar (€)', '=B6-B7'],
        ['Cobrado sin enviar (€)', '=B7-B8'],
        ['% comprometido', '=SI(B5>0;B6/B5;"")'],
      ],
    },
    {
      titulo: 'Donantes',
      cabecera: true,
      formatos: { 1: 'euros', 2: 'euros', 3: 'euros' },
      filas: [
        ['Donante', 'Comprometido (€)', 'Cobrado (€)', 'Por cobrar (€)'],
        ...aportaciones.map((a, i): Celda[] => {
          const r = i + 2;
          return [a.donanteNombre, `=${sumaDonante('Compromiso', r)}`, `=${sumaDonante('Cobro', r)}`, `=B${r}-C${r}`];
        }),
      ],
    },
    {
      titulo: 'Registros',
      cabecera: true,
      formatos: { 3: 'euros' },
      filas: [['Fecha', 'Tipo', 'Donante', 'Importe (€)', 'Nota'], ...registros.map((m): Celda[] => [m.fecha, m.tipo, m.donante, m.importe, m.nota])],
    },
  ];
}

/** Crea el libro en 04_Administración, lo anota en la cronología y devuelve su dirección. */
export async function exportarFinanciacion(codigo: string, autor: Persona): Promise<string> {
  if (config.modoDemo) throw new Error('En el modo demo no se pueden crear hojas de cálculo de Google.');
  const p = await asegurarCarpetas(codigo);
  if (!p.drive) throw new Error('No se pudo crear la carpeta del proyecto en Drive.');
  const d = await drive();
  const nombre = conFecha(`${p.codigo} Financiación`);
  const { id } = await d.crearVacio(nombre, ES_HOJA, p.drive.subcarpetas.administracion);
  await rellenarLibro(id, hojasFinanciacion(p, await aportacionesDeProyecto(codigo)));
  const url = d.urlHoja(id);
  await anotarEvento(codigo, { tipo: 'sistema', autor, texto: 'Financiación exportada a Google Sheets (04_Administración).', enlaces: [{ texto: nombre, url }] });
  return url;
}
