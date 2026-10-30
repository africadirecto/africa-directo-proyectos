// Google Slides por su API REST: presentaciones de informe hechas por la app y plantillas
// de Slides con marcadores. Usa la cuenta de servicio de Drive (ver ./google.ts). Hay que
// activar la «Google Slides API» en el proyecto de Google Cloud.
//
// La presentación se crea vacía con Drive (así queda en la unidad compartida) y luego se
// le añaden diapositivas con los diseños estándar: portada, título y texto, y título solo
// (para las tablas).

import { apiGoogle } from './google';

const SLIDES = 'https://slides.googleapis.com/v1/presentations';
const EMU = 12700; // 1 punto = 12.700 EMU

export interface Diapositiva {
  titulo: string;
  /** Texto con una idea por línea: se muestra como viñetas. */
  puntos?: string[];
  /** Tabla (máximo unas 9 filas por diapositiva). */
  tabla?: string[][];
  /** Si la primera fila de la tabla es cabecera (en negrita). Por defecto, sí. */
  cabecera?: boolean;
  /** Texto pequeño bajo el título (por ejemplo, datos del proyecto). */
  subtitulo?: string;
}

type Forma = { objectId: string; shape?: { placeholder?: { type?: string }; text?: { textElements?: { textRun?: { content?: string } }[] } }; table?: { tableRows?: { tableCells?: { text?: { textElements?: { textRun?: { content?: string } }[] } }[] }[] } };
type Presentacion = { slides?: { objectId: string; pageElements?: Forma[] }[] };

const COLOR_MARCA = { rgbColor: { red: 0.72, green: 0.21, blue: 0.04 } };

/** Añade a una presentación vacía (recién creada con Drive) la portada y las diapositivas. */
export async function rellenarPresentacion(id: string, portada: { titulo: string; subtitulo: string }, diapositivas: Diapositiva[]): Promise<void> {
  const p = await apiGoogle<Presentacion>(`${SLIDES}/${id}`);
  const primera = p.slides?.[0];
  const peticiones: object[] = [];

  // Portada: la diapositiva que trae la presentación nueva.
  const titular = primera?.pageElements?.find((e) => ['CENTERED_TITLE', 'TITLE'].includes(e.shape?.placeholder?.type ?? ''));
  const sub = primera?.pageElements?.find((e) => e.shape?.placeholder?.type === 'SUBTITLE');
  if (titular) peticiones.push({ insertText: { objectId: titular.objectId, text: portada.titulo } }, estiloTitulo(titular.objectId, 30));
  if (sub && portada.subtitulo) peticiones.push({ insertText: { objectId: sub.objectId, text: portada.subtitulo } });

  diapositivas.forEach((d, i) => {
    const n = String(i + 1).padStart(3, '0');
    const diap = `diap${n}`;
    const tit = `diap${n}tit`;
    const cuerpo = `diap${n}cue`;
    const conCuerpo = !d.tabla;
    peticiones.push({
      createSlide: {
        objectId: diap,
        slideLayoutReference: { predefinedLayout: conCuerpo ? 'TITLE_AND_BODY' : 'TITLE_ONLY' },
        placeholderIdMappings: [
          { layoutPlaceholder: { type: 'TITLE' }, objectId: tit },
          ...(conCuerpo ? [{ layoutPlaceholder: { type: 'BODY' }, objectId: cuerpo }] : []),
        ],
      },
    });
    peticiones.push({ insertText: { objectId: tit, text: d.titulo } }, estiloTitulo(tit, 22));

    if (conCuerpo) {
      const lineas = [...(d.subtitulo ? [d.subtitulo] : []), ...(d.puntos ?? [])].filter(Boolean);
      if (lineas.length) {
        peticiones.push({ insertText: { objectId: cuerpo, text: lineas.join('\n') } });
        peticiones.push({ updateTextStyle: { objectId: cuerpo, textRange: { type: 'ALL' }, style: { fontSize: { magnitude: lineas.join(' ').length > 700 ? 12 : 14, unit: 'PT' } }, fields: 'fontSize' } });
        if (d.puntos?.length) {
          const desde = d.subtitulo ? d.subtitulo.length + 1 : 0;
          peticiones.push({ createParagraphBullets: { objectId: cuerpo, textRange: { type: 'FROM_START_INDEX', startIndex: desde }, bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE' } });
        }
        if (d.subtitulo) {
          peticiones.push({
            updateTextStyle: { objectId: cuerpo, textRange: { type: 'FIXED_RANGE', startIndex: 0, endIndex: d.subtitulo.length }, style: { bold: true, fontSize: { magnitude: 12, unit: 'PT' } }, fields: 'bold,fontSize' },
          });
        }
      }
    } else if (d.tabla?.length) {
      const tabla = `diap${n}tab`;
      const filas = d.tabla.length;
      const columnas = Math.max(...d.tabla.map((f) => f.length));
      peticiones.push({
        createTable: {
          objectId: tabla,
          elementProperties: {
            pageObjectId: diap,
            size: { width: { magnitude: 660 * EMU, unit: 'EMU' }, height: { magnitude: Math.min(300, filas * 30) * EMU, unit: 'EMU' } },
            transform: { scaleX: 1, scaleY: 1, translateX: 30 * EMU, translateY: 85 * EMU, unit: 'EMU' },
          },
          rows: filas,
          columns: columnas,
        },
      });
      d.tabla.forEach((fila, r) =>
        fila.forEach((celda, c) => {
          if (!celda) return;
          peticiones.push({ insertText: { objectId: tabla, cellLocation: { rowIndex: r, columnIndex: c }, text: celda } });
          peticiones.push({
            updateTextStyle: {
              objectId: tabla,
              cellLocation: { rowIndex: r, columnIndex: c },
              textRange: { type: 'ALL' },
              style: { fontSize: { magnitude: 10, unit: 'PT' }, bold: r === 0 && d.cabecera !== false },
              fields: 'fontSize,bold',
            },
          });
        }),
      );
    }
  });

  // La API admite muchas peticiones por llamada, pero se trocea por si acaso.
  for (let i = 0; i < peticiones.length; i += 400) {
    await apiGoogle(`${SLIDES}/${id}:batchUpdate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: peticiones.slice(i, i + 400) }),
    });
  }
}

function estiloTitulo(objectId: string, tamano: number) {
  return {
    updateTextStyle: {
      objectId,
      textRange: { type: 'ALL' },
      style: { foregroundColor: { opaqueColor: COLOR_MARCA }, bold: true, fontSize: { magnitude: tamano, unit: 'PT' } },
      fields: 'foregroundColor,bold,fontSize',
    },
  };
}

/** Todo el texto de una presentación (cuadros de texto y tablas), para buscar marcadores. */
export async function textoPresentacion(id: string): Promise<string> {
  const p = await apiGoogle<Presentacion>(`${SLIDES}/${id}`);
  const runs = (t?: { textElements?: { textRun?: { content?: string } }[] }) => (t?.textElements ?? []).map((e) => e.textRun?.content ?? '').join('');
  return (p.slides ?? [])
    .flatMap((s) => s.pageElements ?? [])
    .map((e) => runs(e.shape?.text) + (e.table?.tableRows ?? []).flatMap((f) => (f.tableCells ?? []).map((c) => runs(c.text))).join('\n'))
    .join('\n');
}

/** Sustituye textos en toda la presentación, manteniendo el formato de la plantilla. */
export async function reemplazarEnPresentacion(id: string, pares: [buscar: string, poner: string][]): Promise<void> {
  if (!pares.length) return;
  await apiGoogle(`${SLIDES}/${id}:batchUpdate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: pares.map(([buscar, poner]) => ({ replaceAllText: { containsText: { text: buscar, matchCase: true }, replaceText: poner } })) }),
  });
}
