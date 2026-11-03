'use client';

// Instrucciones de una plantilla: la general y una por campo. «Cambiar con IA» propone cambios a
// partir de una petición, en el documento (apartados, marcadores, texto fijo), las instrucciones,
// el nombre y la descripción; la propuesta se revisa aquí y, al aplicarla, se escribe en el
// documento y las instrucciones se guardan como otra versión.

import { startTransition, useActionState, useState } from 'react';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { IconoIa } from '@/componentes/Iconos';
import { aplicarPropuestaAccion, descartarPropuestaAccion, guardarInstruccionesAccion, proponerCambioAccion, type ResultadoPropuesta } from '@/lib/acciones/plantillas';
import type { CambioVisible } from '@/lib/dominio/cambiosPlantilla';
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

const recorte = (t: string) => (t.length > 70 ? `${t.slice(0, 69)}…` : t);

/** Un cambio en el documento, en palabras: qué se añade (+), se quita (−) o se cambia (→). */
function Cambio({ c }: { c: CambioVisible }) {
  if (c.accion === 'insertar') {
    return (
      <li className="cambio" data-tipo="mas">
        <span aria-hidden="true">+</span>
        <span>
          {c.estilo === 'titulo' ? 'Título' : 'Párrafo'} <b>{c.texto}</b>
          <span className="sub-linea"> tras «{recorte(c.contexto)}»</span>
        </span>
      </li>
    );
  }
  const contexto = c.contexto ? <span className="sub-linea"> en «{recorte(c.contexto)}»</span> : null;
  if (c.accion === 'borrar' || !c.texto) {
    return (
      <li className="cambio" data-tipo="menos">
        <span aria-hidden="true">−</span>
        <span>
          Quita <s>{c.antes}</s>
          {contexto}
        </span>
      </li>
    );
  }
  return (
    <li className="cambio" data-tipo="cambia">
      <span aria-hidden="true">→</span>
      <span>
        <s>{c.antes}</s> → <b>{c.texto}</b>
        {contexto}
      </span>
    </li>
  );
}

export function Instrucciones({
  id,
  editable,
  formato,
  campos,
  actuales,
  iaDisponible,
  nombre,
  descripcion,
}: {
  id: string;
  editable: boolean;
  formato: FormatoPlantilla;
  campos: CampoPlantilla[];
  actuales: InstruccionesPlantilla;
  iaDisponible: boolean;
  nombre: string;
  descripcion: string;
}) {
  const [general, setGeneral] = useState(actuales.general);
  const [valores, setValores] = useState<Record<string, string>>(actuales.campos);
  const [nota, setNota] = useState('');
  const [propuesta, pedir, pidiendo] = useActionState<ResultadoPropuesta, FormData>(proponerCambioAccion, { ok: false });
  const [descartada, setDescartada] = useState<number | undefined>();
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
  const instrucciones = p
    ? [
        ...(p.instrucciones.general !== general ? [{ clave: 'General', antes: general, despues: p.instrucciones.general }] : []),
        ...Object.entries(p.instrucciones.campos)
          .filter(([clave, despues]) => despues !== (valores[clave] ?? ''))
          .map(([clave, despues]) => ({ clave, antes: valores[clave] ?? '', despues })),
      ]
    : [];
  const datos = p ? [...(p.nombre !== nombre ? [['Nombre', nombre, p.nombre]] : []), ...(p.descripcion !== descripcion ? [['Descripción', descripcion, p.descripcion]] : [])] : [];
  const hayCambios = !!p && (p.cambios.length > 0 || instrucciones.length > 0 || datos.length > 0);

  return (
    <div className="pila" style={{ gap: 20 }}>
      {iaDisponible ? (
        <div className="pila nota">
          <form
            className="pila"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              // La IA parte de lo que hay en el formulario, aunque aún no esté guardado.
              fd.set('general', general);
              for (const [clave, v] of Object.entries(valores)) fd.set(`campo.${clave}`, v);
              startTransition(() => pedir(fd));
            }}
          >
            <input type="hidden" name="id" value={id} />
            <label className="field">
              <span className="con-icono">
                <IconoIa />
                Cambiar con IA
                <span className="ayuda">las instrucciones, los apartados y campos del documento, el nombre… Verás la propuesta antes de aplicarla.</span>
              </span>
              <textarea name="peticion" rows={2} placeholder="Por ejemplo: añade un apartado de sostenibilidad antes de las fotos, quita el de próximos pasos y que el tono sea más formal." />
            </label>
            <div className="botones">
              <button type="submit" className="btn btn-s" disabled={pidiendo}>
                {pidiendo ? 'Pensando… (puede tardar un minuto)' : 'Proponer cambios'}
              </button>
            </div>
            {propuesta.vez && !propuesta.ok ? (
              <p role="status" className="aviso-error" style={{ margin: 0 }}>
                {propuesta.mensaje}
              </p>
            ) : null}
          </form>

          {p && descartada !== propuesta.vez ? (
            <div className="pila propuesta" role="status">
              <p style={{ margin: 0 }}>
                <b>Propuesta:</b> {p.resumen}
              </p>
              {p.cambios.length ? (
                <div>
                  <h4 className="propuesta-cab">En el documento</h4>
                  <ul className="cambios">
                    {p.cambios.map((c, k) => (
                      <Cambio key={k} c={c} />
                    ))}
                  </ul>
                </div>
              ) : null}
              {datos.length ? (
                <div>
                  <h4 className="propuesta-cab">Datos de la plantilla</h4>
                  <ul className="cambios">
                    {datos.map(([campo, antes, despues]) => (
                      <li key={campo} className="cambio" data-tipo="cambia">
                        <span aria-hidden="true">→</span>
                        <span>
                          {campo}: <s>{antes || '(vacía)'}</s> → <b>{despues || '(vacía)'}</b>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {instrucciones.length ? (
                <div>
                  <h4 className="propuesta-cab">Instrucciones para la IA</h4>
                  <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.5 }}>
                    {instrucciones.map((c) => (
                      <li key={c.clave}>
                        <b>{c.clave}</b>: {c.antes ? <s style={{ color: 'var(--texto-2)' }}>{c.antes}</s> : <i style={{ color: 'var(--texto-2)' }}>(nueva)</i>} → {c.despues}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {p.avisos.length ? (
                <div className="aviso">
                  <ul>
                    {p.avisos.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {hayCambios ? (
                <>
                  <div className="botones">
                    <FormAccion accion={aplicarPropuestaAccion}>
                      <input type="hidden" name="id" value={id} />
                      <Enviar clase="btn btn-p btn-peq" pendiente="Aplicando…">
                        Aplicar los cambios
                      </Enviar>
                    </FormAccion>
                    <FormAccion accion={descartarPropuestaAccion} ocultarOk>
                      <input type="hidden" name="id" value={id} />
                      <button type="submit" className="btn btn-s btn-peq" onClick={() => setDescartada(propuesta.vez)}>
                        Descartar
                      </button>
                    </FormAccion>
                  </div>
                  <p className="ayuda" style={{ margin: 0, fontSize: 13, color: 'var(--texto-2)' }}>
                    {p.cambios.length ? 'Los cambios del documento se deshacen en Google (Archivo › Historial de versiones); ' : ''}
                    {p.cambios.length ? 'las instrucciones' : 'Las instrucciones'} se guardan como una versión nueva, y se puede volver a la anterior.
                  </p>
                </>
              ) : (
                <p style={{ margin: 0 }}>No cambia nada.</p>
              )}
            </div>
          ) : null}
        </div>
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
