'use client';

// Claves de OpenRouter (se guardan cifradas; aquí solo se ven sus cuatro últimos caracteres) y prueba de los modelos.

import { startTransition, useActionState } from 'react';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { Dialogo } from '@/componentes/Dialogo';
import { comprobarClaveAccion, guardarClaveAccion, probarModelosAccion, quitarClaveAccion, type ResultadoPrueba } from '@/lib/acciones/ia';
import type { AjustesIaEfectivos, NombreClave } from '@/lib/ia/ajustes';

const CLAVES: { nombre: NombreClave; titulo: string }[] = [
  { nombre: 'clave', titulo: 'Clave de OpenRouter' },
  { nombre: 'secretoWebhook', titulo: 'Secreto de los avisos (solo lotes)' },
];

const ORIGEN = { app: 'Guardada', entorno: 'Variable de entorno', ilegible: 'Ilegible: vuelve a escribirla', '': 'Sin configurar' };

export function ClavesIa({ origen, final }: Pick<AjustesIaEfectivos, 'origen' | 'final'>) {
  return (
    <section className="card">
      {CLAVES.map((c) => (
        <div key={c.nombre} className="req">
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{c.titulo}</p>
            <p className="meta" style={{ margin: '2px 0 0' }}>
              {ORIGEN[origen[c.nombre]]}
              {final[c.nombre] && origen[c.nombre] !== 'ilegible' ? <code> …{final[c.nombre]}</code> : null}
            </p>
          </div>
          <div className="botones" style={{ gap: 8 }}>
            {c.nombre === 'clave' && final.clave ? (
              <FormAccion accion={comprobarClaveAccion}>
                <Enviar clase="btn btn-s btn-peq" pendiente="Comprobando…">
                  Comprobar
                </Enviar>
              </FormAccion>
            ) : null}
            <Dialogo boton={origen[c.nombre] === 'app' ? 'Cambiar' : 'Escribir'} claseBoton="btn btn-s btn-peq" titulo={c.titulo}>
              <FormAccion accion={guardarClaveAccion} className="pila" limpiar>
                <input type="hidden" name="nombre" value={c.nombre} />
                <label className="field">
                  {c.titulo}
                  <input name="valor" type="password" autoComplete="off" required spellCheck={false} />
                </label>
                <div className="botones">
                  <Enviar pendiente="Guardando…">Guardar</Enviar>
                </div>
              </FormAccion>
            </Dialogo>
            {origen[c.nombre] === 'app' || origen[c.nombre] === 'ilegible' ? (
              <FormAccion accion={quitarClaveAccion} confirmar="¿Quitar esta clave de la app? Si hay variable de entorno, se usará esa.">
                <input type="hidden" name="nombre" value={c.nombre} />
                <Enviar clase="btn btn-d btn-peq" pendiente="Quitando…">
                  Quitar
                </Enviar>
              </FormAccion>
            ) : null}
          </div>
        </div>
      ))}
    </section>
  );
}

const NOMBRES: Record<string, string> = { rapida: 'Solicitudes y traducciones', redaccion: 'Informes', vision: 'Fotos', plantillas: 'Plantillas', lotes: 'Informes (por lotes)' };

/** Una llamada mínima a cada modelo guardado, con las condiciones de privacidad de la app. */
export function ProbarModelos() {
  const [r, probar, probando] = useActionState<ResultadoPrueba>(probarModelosAccion, { ok: false });
  return (
    <div className="pila">
      <div className="botones">
        <button type="button" className="btn btn-s btn-peq" disabled={probando} onClick={() => startTransition(() => probar())}>
          {probando ? 'Probando…' : 'Probar los modelos'}
        </button>
      </div>
      {r.vez && !r.pruebas?.length ? (
        <p role="status" className={r.ok ? 'aviso-ok' : 'aviso-error'} style={{ margin: 0 }}>
          {r.mensaje}
        </p>
      ) : null}
      {r.pruebas?.length ? (
        <ul role="status" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {r.pruebas.map((p) => (
            <li key={p.tarea} className="req" style={{ padding: '8px 0' }}>
              <span>{NOMBRES[p.tarea] ?? p.tarea}</span>
              <span className="estado-int" style={{ color: p.ok ? 'var(--ok)' : 'var(--error)' }}>
                <span className="dot" style={{ background: p.ok ? 'var(--ok)' : 'var(--error)' }} />
                {p.ok ? 'Funciona' : p.detalle}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
