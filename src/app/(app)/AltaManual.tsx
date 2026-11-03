'use client';

// Alta de un proyecto a mano, cuando la contraparte no puede usar el formulario: un voluntario
// rellena los mismos datos y el proyecto entra En revisión, como una solicitud recibida. No es
// lo habitual, por eso va al final de Proyectos. Las contrapartes se piden al abrir el diálogo.

import { useState, useTransition } from 'react';
import { Dialogo, abrirDialogo } from '@/componentes/Dialogo';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { Bandera, Desplegable } from '@/componentes/Desplegable';
import { opcionesMonedas, opcionesPaises } from '@/componentes/opciones';
import { altaManual, opcionesContrapartes } from '@/lib/acciones/solicitudes';
import { IDIOMAS_ES, SECTORES } from '@/lib/formulario/textos';
import { MONEDA_DE_PAIS } from '@/lib/paises';
import type { Idioma } from '@/lib/tipos';

type OpcionContraparte = Awaited<ReturnType<typeof opcionesContrapartes>>[number];

const IDIOMAS = (Object.keys(IDIOMAS_ES) as Idioma[]).map((i) => ({ valor: i, texto: IDIOMAS_ES[i] }));
const SECTORES_OPC = Object.entries(SECTORES).map(([valor, n]) => ({ valor, texto: n.es }));
const LINEA = { concepto: '', importe: '' };

export function AltaManual() {
  const [contrapartes, setContrapartes] = useState<OpcionContraparte[] | null>(null);
  const [, cargar] = useTransition();
  const [cp, setCp] = useState('');
  const [pais, setPais] = useState('');
  const [moneda, setMoneda] = useState('EUR');
  const [lineas, setLineas] = useState([LINEA, LINEA]);
  const total = lineas.reduce((s, l) => s + (Number(l.importe.replace(',', '.')) || 0), 0);

  const abrir = () => {
    abrirDialogo('alta-manual');
    if (!contrapartes) cargar(async () => setContrapartes(await opcionesContrapartes()));
  };
  // El país y la moneda del proyecto se proponen a partir de la contraparte y del país.
  const elegirPais = (p: string) => {
    setPais(p);
    if (MONEDA_DE_PAIS[p]) setMoneda(MONEDA_DE_PAIS[p]);
  };
  const elegirContraparte = (id: string) => {
    setCp(id);
    const c = contrapartes?.find((x) => x.id === id);
    if (c?.pais && !pais) elegirPais(c.pais);
  };
  const cambiarLinea = (i: number, campo: 'concepto' | 'importe', valor: string) =>
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));

  return (
    <>
      <button type="button" className="btn btn-s" onClick={abrir}>
        ＋ Añadir proyecto a mano
      </button>
      <Dialogo id="alta-manual" titulo="Añadir proyecto a mano">
        <FormAccion accion={altaManual} className="pila">
          <p className="meta" style={{ margin: 0 }}>
            Para cuando la contraparte no puede usar el formulario: rellena tú sus datos. El proyecto queda «En revisión», como una solicitud recibida, y
            los documentos y fotos se añaden luego en su ficha.
          </p>

          <h3 className="alta-seccion">Contraparte</h3>
          <label className="field">
            ¿Quién pide el proyecto?
            <Desplegable
              name="contraparte"
              required
              buscar
              textoBuscar="Buscar contraparte…"
              value={cp}
              onChange={elegirContraparte}
              placeholder={contrapartes ? 'Elige una contraparte…' : 'Cargando contrapartes…'}
              opciones={[
                ...(contrapartes ?? []).map((c) => ({ valor: c.id, texto: c.nombre, icono: c.pais ? <Bandera codigo={c.pais} /> : undefined })),
                { valor: 'nueva', texto: '＋ Contraparte nueva' },
              ]}
            />
          </label>
          {cp === 'nueva' ? (
            <div className="campos">
              <label className="field ancho">
                Nombre de la organización
                <input name="cp_nombre" required placeholder="Por ejemplo: Congregación de las Hermanas de…" />
              </label>
              <label className="field">
                Tipo
                <input name="cp_tipo" placeholder="Congregación, diócesis, asociación…" />
              </label>
              <label className="field">
                País
                <Desplegable name="cp_pais" required opciones={opcionesPaises('es')} onChange={(p) => !pais && elegirPais(p)} />
              </label>
              <label className="field">
                Persona de contacto
                <input name="cp_contacto" placeholder="Hna. …" />
              </label>
              <label className="field">
                Correo
                <input name="cp_correo" type="email" placeholder="contacto@…" />
              </label>
              <label className="field">
                Idioma en que escribe
                <Desplegable name="cp_idioma" required defaultValue="fr" opciones={IDIOMAS} />
              </label>
            </div>
          ) : null}

          <h3 className="alta-seccion">Proyecto</h3>
          <div className="campos">
            <label className="field ancho">
              Nombre corto del proyecto
              <input name="titulo" required placeholder="Por ejemplo: Aula escuela primaria" />
            </label>
            <label className="field">
              Tipo de proyecto
              <Desplegable name="sector" required opciones={SECTORES_OPC} />
            </label>
            <label className="field">
              País
              <Desplegable name="pais" required value={pais} onChange={elegirPais} opciones={opcionesPaises('es')} buscar textoBuscar="Buscar país…" />
            </label>
            <label className="field">
              Ciudad o pueblo
              <input name="lugar" required />
            </label>
            <label className="field">
              <span>
                Dirección o cómo llegar <span className="ayuda">opcional</span>
              </span>
              <input name="indicaciones" />
            </label>
            <label className="field ancho">
              Qué se necesita y por qué
              <textarea name="necesidad" required rows={4} />
            </label>
            <label className="field ancho">
              Quiénes se benefician
              <textarea name="beneficiarios" required rows={2} placeholder="Por ejemplo: 45 alumnos de 3.º y 4.º curso" />
            </label>
            <label className="field">
              <span>
                Número aproximado de personas <span className="ayuda">opcional</span>
              </span>
              <input name="numBeneficiarios" type="number" inputMode="numeric" min={0} />
            </label>
            <label className="field">
              <span>
                Plazo previsto (meses) <span className="ayuda">opcional</span>
              </span>
              <input name="plazoMeses" type="number" inputMode="numeric" min={0} max={120} />
            </label>
            <label className="field ancho">
              <span>
                Qué aporta la contraparte <span className="ayuda">opcional</span>
              </span>
              <textarea name="aportacionLocal" rows={2} />
            </label>
          </div>

          <h3 className="alta-seccion">Presupuesto</h3>
          <label className="field">
            Moneda
            <Desplegable name="moneda" required value={moneda} onChange={setMoneda} opciones={opcionesMonedas('es', pais)} buscar textoBuscar="Buscar moneda…" />
          </label>
          {lineas.map((l, i) => (
            <div key={i} className="linea-ppto">
              <label className="field">
                Concepto {i + 1}
                <input name="concepto" value={l.concepto} onChange={(e) => cambiarLinea(i, 'concepto', e.target.value)} />
              </label>
              <label className="field">
                Importe
                <input name="importe" type="number" inputMode="decimal" min={0} step="any" value={l.importe} onChange={(e) => cambiarLinea(i, 'importe', e.target.value)} />
              </label>
              <button type="button" className="btn btn-s" onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))} disabled={lineas.length <= 1}>
                Quitar
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <button type="button" className="btn btn-s btn-peq" onClick={() => setLineas((ls) => [...ls, LINEA])}>
              ＋ Añadir línea
            </button>
            <p style={{ margin: 0, fontWeight: 700 }}>
              Total: {total.toLocaleString('es-ES')} {moneda}
            </p>
          </div>

          <div className="botones">
            <Enviar pendiente="Creando el proyecto…">Añadir proyecto</Enviar>
          </div>
        </FormAccion>
      </Dialogo>
    </>
  );
}
