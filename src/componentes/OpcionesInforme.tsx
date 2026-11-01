'use client';

// Piezas comunes de los diálogos de informe: elegir la plantilla, el idioma y las indicaciones
// para la IA, y el resultado (el progreso del informe en segundo plano o el enlace al archivo).

import Link from 'next/link';
import { LogoDocs, LogoSheets, LogoSlides } from './Iconos';
import { Desplegable } from './Desplegable';
import { ProgresoInforme } from './ProgresoInforme';
import type { OpcionPlantilla } from '@/lib/dominio/plantillas';

export const IDIOMAS_INFORME = [
  { valor: 'es', texto: 'Español' },
  { valor: 'fr', texto: 'Francés' },
  { valor: 'en', texto: 'Inglés' },
  { valor: 'pt', texto: 'Portugués' },
];

/** Elegir plantilla (las del tipo que toca en esa página). `hoja`: añade la hoja de cálculo (sin IA). */
export function ElegirPlantilla({ plantillas, valor, onChange, hoja = false }: { plantillas: OpcionPlantilla[]; valor: string; onChange: (id: string) => void; hoja?: boolean }) {
  if (!plantillas.length && !hoja) {
    return (
      <p className="aviso ancho" style={{ margin: 0 }}>
        No hay plantillas activas para esto. Actívalas o créalas en <Link href="/plantillas">Plantillas</Link>.
      </p>
    );
  }
  return (
    <label className="field ancho">
      Plantilla
      <Desplegable
        name="plantilla"
        required
        value={valor}
        onChange={onChange}
        opciones={[
          ...plantillas.map((p) => ({
            valor: p.id,
            texto: `${p.nombre}${p.donante ? ` · de ${p.donante.nombre}` : ''}${p.porDefecto ? ' (por defecto)' : ''}`,
            ...(hoja ? { grupo: 'Con IA' } : {}),
            icono: p.formato === 'slides' ? <LogoSlides tamano={16} /> : <LogoDocs tamano={16} />,
          })),
          ...(hoja ? [{ valor: 'sheets', texto: 'Hoja de cálculo con los datos (sin IA)', grupo: 'Datos', icono: <LogoSheets tamano={16} /> }] : []),
        ]}
      />
    </label>
  );
}

export function Idioma({ valor }: { valor: string }) {
  return (
    <label className="field">
      Idioma
      {/* La clave fuerza el valor inicial al cambiar de plantilla. */}
      <Desplegable key={valor} name="idioma" defaultValue={valor} opciones={IDIOMAS_INFORME} />
    </label>
  );
}

export function Indicaciones({ ejemplo }: { ejemplo: string }) {
  return (
    <label className="field ancho">
      <span>
        Indicaciones para la IA <span className="ayuda">opcional: lo que quieres destacar en este informe</span>
      </span>
      <textarea name="indicaciones" rows={3} placeholder={`Por ejemplo: ${ejemplo}`} />
    </label>
  );
}

/** El resultado de pedir un informe: su progreso, la hoja ya hecha o el error. */
export function ResultadoInforme({ estado }: { estado: { ok: boolean; mensaje?: string; url?: string; ruta?: string; vez?: number } }) {
  if (!estado.vez) return null;
  if (estado.ok && estado.ruta) return <ProgresoInforme key={estado.ruta} ruta={estado.ruta} />;
  if (!estado.mensaje) return null;
  return (
    <div role="status" className={estado.ok ? 'aviso-ok' : 'aviso-error'} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span>{estado.mensaje}</span>
      {estado.url ? (
        <a className="btn btn-s btn-peq" href={estado.url} target="_blank" rel="noreferrer">
          Abrir
        </a>
      ) : null}
    </div>
  );
}
