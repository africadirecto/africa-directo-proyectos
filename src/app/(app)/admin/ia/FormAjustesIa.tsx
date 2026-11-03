'use client';

// Ajustes de IA: encendido, modo de los informes, límite de gasto y el modelo de cada función.

import { useState } from 'react';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { Desplegable, type Opcion } from '@/componentes/Desplegable';
import { guardarAjustesIaAccion } from '@/lib/acciones/ia';
import type { AjustesIa, ModoInformes, TareaIa } from '@/lib/ia/ajustes';
import type { ModeloIa } from '@/lib/ia/modelos';

const FUNCIONES: { tarea: TareaIa | 'lotes'; nombre: string; filtro?: (m: ModeloIa) => boolean }[] = [
  { tarea: 'rapida', nombre: 'Solicitudes y traducciones' },
  { tarea: 'redaccion', nombre: 'Informes' },
  { tarea: 'lotes', nombre: 'Informes (por lotes)', filtro: (m) => m.lotes },
  { tarea: 'vision', nombre: 'Fotos', filtro: (m) => m.imagenes },
  { tarea: 'plantillas', nombre: 'Plantillas' },
];

const precio = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function opciones(catalogo: ModeloIa[], actual: string, filtro?: (m: ModeloIa) => boolean): Opcion[] {
  const lista: Opcion[] = catalogo.filter((m) => !filtro || filtro(m)).map((m) => ({ valor: m.id, texto: `${m.nombre} · ${precio(m.entrada)} / ${precio(m.salida)} $` }));
  if (actual && !lista.some((o) => o.valor === actual)) lista.unshift({ valor: actual, texto: actual });
  return lista;
}

const MODOS: Record<ModoInformes, { texto: string; ayuda: string }> = {
  directo: { texto: 'Directo', ayuda: 'Listo en un minuto. Sin retención de datos.' },
  lotes: { texto: 'Por lotes', ayuda: 'Mitad de precio, pero tarda minutos u horas y los datos pasan por EE. UU.' },
};

export function FormAjustesIa({ ajustes, catalogo, lotesPosibles }: { ajustes: AjustesIa; catalogo: ModeloIa[]; lotesPosibles: boolean }) {
  const [modo, setModo] = useState<ModoInformes>(ajustes.modo);
  const [modelos, setModelos] = useState(ajustes.modelos);
  // Sin lotes posibles se redacta por la vía directa aunque estén elegidos.
  const lotes = modo === 'lotes' && lotesPosibles;
  const visibles = FUNCIONES.filter((f) => f.tarea !== (lotes ? 'redaccion' : 'lotes'));

  return (
    <FormAccion accion={guardarAjustesIaAccion} className="card pila">
      <label className="check">
        <input type="checkbox" name="activa" defaultChecked={ajustes.activa} />
        IA activada
      </label>
      <div className="campos">
        <div className="field">
          <span>Informes</span>
          <Desplegable
            name="modo"
            aria-label="Cómo se redactan los informes"
            opciones={(Object.keys(MODOS) as ModoInformes[]).map((m) => ({ valor: m, texto: MODOS[m].texto }))}
            value={modo}
            onChange={(v) => setModo(v as ModoInformes)}
          />
          <span className="ayuda">{modo === 'lotes' && !lotesPosibles ? 'Aquí no se puede (falta una APP_URL pública): se usa el directo.' : MODOS[modo].ayuda}</span>
        </div>
        <label className="field">
          <span>
            Límite de gasto al mes ($) <span className="ayuda">0: sin límite</span>
          </span>
          <input name="limiteMensual" type="number" min={0} max={1000} step={0.5} defaultValue={ajustes.limiteMensual} inputMode="decimal" />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" name="fotos" defaultChecked={ajustes.fotos} />
        Elegir las fotos y escribir sus pies con IA
      </label>

      <h3 className="h3" style={{ margin: '8px 0 0' }}>
        Modelos <span className="ayuda" style={{ fontWeight: 400, fontSize: 13, color: 'var(--texto-2)' }}>$ por millón de tokens</span>
      </h3>
      <div className="campos">
        {visibles.map((f) => (
          <div key={f.tarea} className="field">
            <span>{f.nombre}</span>
            {catalogo.length ? (
              <Desplegable
                aria-label={f.nombre}
                buscar
                textoBuscar="Buscar modelo…"
                opciones={opciones(catalogo, modelos[f.tarea], f.filtro)}
                value={modelos[f.tarea]}
                onChange={(v) => setModelos({ ...modelos, [f.tarea]: v })}
              />
            ) : (
              <input aria-label={f.nombre} value={modelos[f.tarea]} onChange={(e) => setModelos({ ...modelos, [f.tarea]: e.target.value.trim() })} placeholder="proveedor/modelo" />
            )}
          </div>
        ))}
      </div>
      {(Object.keys(modelos) as (keyof typeof modelos)[]).map((t) => (
        <input key={t} type="hidden" name={`modelo.${t}`} value={modelos[t]} />
      ))}
      <div className="botones">
        <Enviar pendiente="Guardando…">Guardar</Enviar>
      </div>
    </FormAccion>
  );
}
