// Google Docs por su API REST, para rellenar las plantillas de informe con marcadores.
// Usa la cuenta de servicio de Drive (ver ./google.ts). Hay que activar la "Google Docs API"
// en el proyecto de Google Cloud.

import { apiGoogle } from './google';

const DOCS = 'https://docs.googleapis.com/v1/documents';

type Elemento = {
  paragraph?: { elements?: { textRun?: { content?: string } }[] };
  table?: { tableRows?: { tableCells?: { content?: Elemento[] }[] }[] };
  tableOfContents?: { content?: Elemento[] };
};
type Documento = {
  body?: { content?: Elemento[] };
  headers?: Record<string, { content?: Elemento[] }>;
  footers?: Record<string, { content?: Elemento[] }>;
};

function texto(elementos: Elemento[] = []): string {
  return elementos
    .map((e) => {
      if (e.paragraph) return (e.paragraph.elements ?? []).map((x) => x.textRun?.content ?? '').join('');
      if (e.table) return (e.table.tableRows ?? []).flatMap((f) => (f.tableCells ?? []).map((c) => texto(c.content))).join('\n');
      if (e.tableOfContents) return texto(e.tableOfContents.content);
      return '';
    })
    .join('');
}

/** Todo el texto del documento: cuerpo, tablas, encabezados y pies. */
export async function textoDocumento(id: string): Promise<string> {
  const d = await apiGoogle<Documento>(`${DOCS}/${id}`);
  const partes = [texto(d.body?.content)];
  for (const h of Object.values(d.headers ?? {})) partes.push(texto(h.content));
  for (const f of Object.values(d.footers ?? {})) partes.push(texto(f.content));
  return partes.join('\n');
}

/** Sustituye cada texto por su valor en todo el documento, manteniendo el formato de la plantilla. */
export async function reemplazar(id: string, pares: [buscar: string, poner: string][], alFinal?: string): Promise<void> {
  const requests: object[] = pares.map(([buscar, poner]) => ({
    replaceAllText: { containsText: { text: buscar, matchCase: true }, replaceText: poner },
  }));
  if (alFinal) requests.push({ insertText: { endOfSegmentLocation: {}, text: alFinal } });
  if (!requests.length) return;
  await apiGoogle(`${DOCS}/${id}:batchUpdate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });
}
