'use client';

// Piezas comunes de los diálogos de informe: elegir formato (Docs o Slides), idioma,
// extensión, indicaciones para la IA y el resultado con el enlace al archivo.

import { LogoDocs, LogoSheets, LogoSlides } from './Iconos';
import { Desplegable } from './Desplegable';
import type { FormatoInforme } from '@/lib/tipos';

export const IDIOMAS_INFORME = [
  { valor: 'es', texto: 'Español' },
  { valor: 'fr', texto: 'Francés' },
  { valor: 'en', texto: 'Inglés' },
  { valor: 'pt', texto: 'Portugués' },
];
export const EXTENSIONES = [
  { valor: 'breve', texto: 'Breve' },
  { valor: 'normal', texto: 'Normal' },
  { valor: 'detallado', texto: 'Detallado' },
];

const FORMATOS = [
  ['docs', 'Informe', 'Documento de Google Docs', <LogoDocs key="d" tamano={22} />],
  ['slides', 'Presentación', 'Diapositivas de Google Slides', <LogoSlides key="s" tamano={22} />],
  ['sheets', 'Hoja de cálculo', 'Datos y resúmenes en Google Sheets', <LogoSheets key="h" tamano={22} />],
] as const;

/** Elegir formato. La hoja de cálculo solo se ofrece si `conHoja` (informe de proyectos). */
export function ElegirFormato({ valor, onChange, conHoja = false }: { valor: FormatoInforme; onChange: (f: FormatoInforme) => void; conHoja?: boolean }) {
  return (
    <fieldset className="formatos">
      <legend>Formato</legend>
      {FORMATOS.filter(([f]) => conHoja || f !== 'sheets').map(([f, nombre, detalle, icono]) => (
        <label key={f} className="formato" data-elegido={valor === f ? '' : undefined}>
          <input type="radio" name="formato" value={f} checked={valor === f} onChange={() => onChange(f)} className="oculto" />
          {icono}
          <span>
            <b>{nombre}</b>
            <span className="meta">{detalle}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export function IdiomaYExtension() {
  return (
    <>
      <label className="field">
        Idioma
        <Desplegable name="idioma" defaultValue="es" opciones={IDIOMAS_INFORME} />
      </label>
      <label className="field">
        Extensión
        <Desplegable name="extension" defaultValue="normal" opciones={EXTENSIONES} />
      </label>
    </>
  );
}

export function Indicaciones({ ejemplo }: { ejemplo: string }) {
  return (
    <label className="field ancho">
      <span>
        Indicaciones para la IA <span className="ayuda">opcional</span>
      </span>
      <textarea name="instrucciones" rows={3} placeholder={`Por ejemplo: ${ejemplo}`} />
    </label>
  );
}

export function ResultadoInforme({ estado }: { estado: { ok: boolean; mensaje?: string; url?: string; vez?: number } }) {
  if (!estado.vez || !estado.mensaje) return null;
  return (
    <div role="status" className={estado.ok ? 'aviso-ok' : 'aviso-error'} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span>{estado.mensaje}</span>
      {estado.url ? (
        <a className="btn btn-s btn-peq" href={estado.url} target="_blank" rel="noreferrer">
          {estado.url.includes('/presentation/') ? <LogoSlides tamano={16} /> : estado.url.includes('/spreadsheets/') ? <LogoSheets tamano={16} /> : <LogoDocs tamano={16} />} Abrir
        </a>
      ) : null}
    </div>
  );
}
