// Google Sheets por su API REST: libros de análisis hechos por la app. Usa la cuenta de
// servicio de Drive (ver ./google.ts). Hay que activar la «Google Sheets API».
//
// El libro se crea vacío con Drive (así queda en la unidad compartida) y se configura en
// español: con esa configuración, las fórmulas separan los argumentos con «;».

import { apiGoogle } from './google';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

export type Celda = string | number | null;

export interface Hoja {
  titulo: string;
  filas: Celda[][];
  /** Formato por columna (índice desde 0), a partir de la segunda fila. */
  formatos?: Record<number, Formato>;
  /** Formato por fila (índice desde 0), de la segunda columna en adelante (hojas de resumen). */
  formatosFila?: Record<number, Formato>;
  /** Primera fila como cabecera: negrita, fija y con filtro. */
  cabecera?: boolean;
  /** Gráfica de columnas: etiquetas en la columna 0 y valores en `columna`. */
  grafico?: { titulo: string; columna: number };
}

const PATRONES = { euros: '#,##0 "€"', porcentaje: '0%', entero: '#,##0' } as const;
type Formato = keyof typeof PATRONES;

/** Rellena un libro vacío (recién creado con Drive) con las hojas indicadas. */
export async function rellenarLibro(id: string, hojas: Hoja[]): Promise<void> {
  const libro = await apiGoogle<{ sheets: { properties: { sheetId: number } }[] }>(`${SHEETS}/${id}?fields=sheets(properties(sheetId))`);
  const primera = libro.sheets[0].properties.sheetId;
  const ids = hojas.map((_, i) => (i === 0 ? primera : 1000 + i));

  // 1) Configuración española, nombres de las hojas y hojas nuevas.
  await lote(id, [
    { updateSpreadsheetProperties: { properties: { locale: 'es_ES', timeZone: 'Europe/Madrid' }, fields: 'locale,timeZone' } },
    { updateSheetProperties: { properties: { sheetId: primera, title: hojas[0].titulo }, fields: 'title' } },
    ...hojas.slice(1).map((h, i) => ({ addSheet: { properties: { sheetId: ids[i + 1], title: h.titulo } } })),
  ]);

  // 2) Valores (las fórmulas se interpretan como si las escribiera una persona).
  await apiGoogle(`${SHEETS}/${id}/values:batchUpdate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: hojas.map((h) => ({ range: `'${h.titulo}'!A1`, values: h.filas.map((f) => f.map((c) => c ?? '')) })),
    }),
  });

  // 3) Formato, cabeceras, anchos y gráficas.
  const peticiones: object[] = [];
  hojas.forEach((h, i) => {
    const sheetId = ids[i];
    const filas = h.filas.length;
    const columnas = Math.max(...h.filas.map((f) => f.length));
    if (h.cabecera) {
      peticiones.push(
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.99, green: 0.91, blue: 0.88 } } },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        },
        { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
        { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, endRowIndex: filas, startColumnIndex: 0, endColumnIndex: columnas } } } },
      );
    }
    for (const [col, tipo] of Object.entries(h.formatos ?? {})) {
      peticiones.push({
        repeatCell: {
          range: { sheetId, startRowIndex: h.cabecera ? 1 : 0, endRowIndex: filas, startColumnIndex: Number(col), endColumnIndex: Number(col) + 1 },
          cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: PATRONES[tipo] } } },
          fields: 'userEnteredFormat.numberFormat',
        },
      });
    }
    for (const [fila, tipo] of Object.entries(h.formatosFila ?? {})) {
      peticiones.push({
        repeatCell: {
          range: { sheetId, startRowIndex: Number(fila), endRowIndex: Number(fila) + 1, startColumnIndex: 1, endColumnIndex: columnas },
          cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: PATRONES[tipo] } } },
          fields: 'userEnteredFormat.numberFormat',
        },
      });
    }
    peticiones.push({ autoResizeDimensions: { dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: columnas } } });
    if (h.grafico && filas > 1) {
      peticiones.push({
        addChart: {
          chart: {
            spec: {
              title: h.grafico.titulo,
              basicChart: {
                chartType: 'BAR',
                legendPosition: 'NO_LEGEND',
                axis: [{ position: 'BOTTOM_AXIS' }, { position: 'LEFT_AXIS' }],
                domains: [{ domain: { sourceRange: { sources: [{ sheetId, startRowIndex: 0, endRowIndex: filas, startColumnIndex: 0, endColumnIndex: 1 }] } } }],
                series: [
                  {
                    series: { sourceRange: { sources: [{ sheetId, startRowIndex: 0, endRowIndex: filas, startColumnIndex: h.grafico.columna, endColumnIndex: h.grafico.columna + 1 }] } },
                    targetAxis: 'BOTTOM_AXIS',
                    color: { red: 0.82, green: 0.25, blue: 0.06 },
                  },
                ],
                headerCount: 1,
              },
            },
            position: { overlayPosition: { anchorCell: { sheetId, rowIndex: 0, columnIndex: columnas + 1 } } },
          },
        },
      });
    }
  });
  await lote(id, peticiones);
}

async function lote(id: string, requests: object[]) {
  if (!requests.length) return;
  await apiGoogle(`${SHEETS}/${id}:batchUpdate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });
}
