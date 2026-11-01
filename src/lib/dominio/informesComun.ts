// Piezas comunes de los informes (de proyecto y de conjunto).

import type { Idioma, Informe } from '../tipos';

export type InformeConId = Informe & { id: string };

export const LOCALE: Record<Idioma, string> = { es: 'es-ES', fr: 'fr-FR', en: 'en-GB', pt: 'pt-PT' };

/** Quita correos y teléfonos de los textos que van a la IA. */
export const sinContactos = (t: string) =>
  t.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[correo]').replace(/\+?\d[\d\s().-]{7,}\d/g, (m) => (m.replace(/\D/g, '').length >= 9 ? '[teléfono]' : m));

/** Un evento de la cronología tal como lo ve la IA, con su id (E1, E2…) para citarlo. */
export interface EventoContexto {
  id: string;
  fecha: string;
  texto: string;
}

/** Direcciones de descarga de Google para un informe (exportan el documento tal como está). */
export function descargas(i: Pick<Informe, 'docId' | 'formato' | 'url'>): { texto: string; url: string }[] {
  // En demo el informe es un archivo local: no hay exportación.
  if (!i.docId || i.url?.startsWith('/')) return [];
  if (i.formato === 'sheets') {
    return [
      { texto: 'Excel', url: `https://docs.google.com/spreadsheets/d/${i.docId}/export?format=xlsx` },
      { texto: 'PDF', url: `https://docs.google.com/spreadsheets/d/${i.docId}/export?format=pdf` },
    ];
  }
  if (i.formato === 'slides') {
    return [
      { texto: 'PDF', url: `https://docs.google.com/presentation/d/${i.docId}/export/pdf` },
      { texto: 'PowerPoint', url: `https://docs.google.com/presentation/d/${i.docId}/export/pptx` },
    ];
  }
  return [
    { texto: 'PDF', url: `https://docs.google.com/document/d/${i.docId}/export?format=pdf` },
    { texto: 'Word', url: `https://docs.google.com/document/d/${i.docId}/export?format=docx` },
  ];
}
