'use client';

// Instrucciones de una plantilla: la general y una por campo. «Cambiar con IA» propone unas
// nuevas a partir de una petición; la propuesta se revisa aquí y se guarda como otra versión.

import { startTransition, useActionState, useState } from 'react';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { guardarInstruccionesAccion, proponerCambioAccion, type ResultadoPropuesta } from '@/lib/acciones/plantillas';
import type { CampoPlantilla, FormatoPlantilla, InstruccionesPlantilla } from '@/lib/tipos';

const TIPO_CAMPO: Record<CampoPlantilla['tipo'], string> = { ia: 'Texto', foto: 'Foto', fotos: 'Galería de fotos' };

function Marcador({ c }: { c: CampoPlantilla }) {
  return <code className="marcador">{`{{${c.tipo}:${c.clave}}}`}</code>;
}

function detalles(c: CampoPlantilla, formato: FormatoPlantilla): string {
  return [
    TIPO_CAMPO[c.tipo],
    c.enLinea ? 'dentro de una frase: una sola frase' : '',
    c.veces > 1 ? `aparece ${c.veces} veces` : '',
    formato === 'slides' && c.caja ? `recuadro de ${c.caja.ancho} × ${c.caja.alto} pt` : '',
    c.huerfano ? 'ya no está en el documento' : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export function Instrucciones({
  id,
  editable,
  formato,
  campos,
  actuales,
  iaDisponible,
}: {
  id: string;
  editable: boolean;
  formato: FormatoPlantilla;
  campos: CampoPlantilla[];
  actuales: InstruccionesPlantilla;
  iaDisponible: boolean;
}) {
  const [general, setGeneral] = useState(actuales.general);
  const [valores, setValores] = useState<Record<string, string>>(actuales.campos);
  const [nota, setNota] = useState('');
  const [propuesta, pedir, pidiendo] = useActionState<ResultadoPropuesta, FormData>(proponerCambioAccion, { ok: false });
  const [usada, setUsada] = useState<number | undefined>();
  const visibles = campos.filter((c) => !c.huerfano || valores[c.clave]);

  if (!editable) {
    return (
      <div className="pila">
        <div>
          <h3 className="h3">General</h3>
          <p className="nota" style={{ whiteSpace: 'pre-wrap' }}>{actuales.general || 'Sin instrucciones generales.'}</p>
        </div>
        {visibles.map((c) => (
          <div key={c.clave}>
            <h3 className="h3">
              <Marcador c={c} /> <span className="sub" style={{ display: 'inline' }}>{detalles(c, formato)}</span>
            </h3>
            <p className="nota" style={{ whiteSpace: 'pre-wrap' }}>{actuales.campos[c.clave] || 'Sin instrucción.'}</p>
          </div>
        ))}
      </div>
    );
  }

  const p = propuesta.propuesta;
  const cambios = p
    ? [
        ...(p.instrucciones.general !== general ? [{ clave: 'General', antes: general, despues: p.instrucciones.general }] : []),
        ...visibles.filter((c) => (p.instrucciones.campos[c.clave] ?? '') !== (valores[c.clave] ?? '')).map((c) => ({ clave: c.clave, antes: valores[c.clave] ?? '', despues: p.instrucciones.campos[c.clave] ?? '' })),
      ]
    : [];

  return (
    <div className="pila" style={{ gap: 20 }}>
      {iaDisponible ? (
        <form
          className="pila nota"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => pedir(fd));
          }}
        >
          <input type="hidden" name="id" value={id} />
          <label className="field">
            <span>
              Cambiar con IA <span className="ayuda">di qué quieres cambiar; verás la propuesta antes de guardarla</span>
            </span>
            <textarea name="peticion" rows={2} placeholder="Por ejemplo: más formal, y que el avance hable siempre del número de alumnos." />
          </label>
          <div className="botones">
            <button type="submit" className="btn btn-s" disabled={pidiendo}>
              {pidiendo ? 'Pensando…' : 'Proponer cambios'}
            </button>
          </div>
          {propuesta.vez && !propuesta.ok ? (
            <p role="status" className="aviso-error" style={{ margin: 0 }}>
              {propuesta.mensaje}
            </p>
          ) : null}
          {p && usada !== propuesta.vez ? (
            <div className="pila" role="status">
              <p style={{ margin: 0 }}>
                <b>Propuesta:</b> {p.resumen}
              </p>
              {cambios.length ? (
                <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.5 }}>
                  {cambios.map((c) => (
                    <li key={c.clave}>
                      <b>{c.clave}</b>: <s style={{ color: 'var(--texto-2)' }}>{c.antes || '(vacía)'}</s> → {c.despues}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0 }}>No cambia nada.</p>
              )}
              {cambios.length ? (
                <div className="botones">
                  <button
                    type="button"
                    className="btn btn-p btn-peq"
                    onClick={() => {
                      setGeneral(p.instrucciones.general);
                      setValores({ ...valores, ...p.instrucciones.campos });
                      setNota(`Con IA: ${propuesta.peticion ?? ''}`.slice(0, 300));
                      setUsada(propuesta.vez);
                    }}
                  >
                    Usar la propuesta
                  </button>
                  <span className="ayuda">Después revísala abajo y guarda.</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </form>
      ) : null}

      <FormAccion accion={guardarInstruccionesAccion} className="pila">
        <input type="hidden" name="id" value={id} />
        <label className="field">
          <span>
            General <span className="ayuda">propósito, a quién va dirigido, tono</span>
          </span>
          <textarea name="general" rows={4} value={general} onChange={(e) => setGeneral(e.target.value)} />
        </label>
        {visibles.map((c) => (
          <label key={c.clave} className="field">
            <span>
              <Marcador c={c} /> <span className="ayuda">{detalles(c, formato)}</span>
              {c.tipo === 'ia' && !valores[c.clave]?.trim() ? <span className="error-campo"> · sin instrucción</span> : null}
            </span>
            <textarea
              name={`campo.${c.clave}`}
              rows={c.tipo === 'ia' ? 3 : 2}
              value={valores[c.clave] ?? ''}
              onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })}
              placeholder={c.tipo === 'ia' ? 'Qué tiene que contar este campo y con qué extensión aproximada.' : 'Qué fotos convienen aquí.'}
            />
          </label>
        ))}
        <div className="botones">
          <input name="nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota de la versión (opcional)" className="campo-suelto" aria-label="Nota de la versión" />
          <Enviar pendiente="Guardando…">Guardar instrucciones</Enviar>
        </div>
      </FormAccion>
    </div>
  );
}
