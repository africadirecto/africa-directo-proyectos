import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requiere, tienePermiso } from '@/lib/sesion';
import { leerProyecto } from '@/lib/dominio/proyectos';
import { drive } from '@/lib/drive';
import { ESTADOS, FASES, esFinal, estadosManuales, indiceFase } from '@/lib/estados';
import { dinero } from '@/lib/formato';
import { nombrePais } from '@/lib/paises';
import { nombreSector } from '@/lib/formulario/textos';
import { Estado } from '@/componentes/Basicos';
import { Dialogo } from '@/componentes/Dialogo';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { Desplegable } from '@/componentes/Desplegable';
import { cambiarEstadoAccion, crearCarpetaAccion } from '@/lib/acciones/proyectos';
import { EditarProyecto } from './EditarProyecto';
import { GenerarInforme } from './GenerarInforme';
import { LogoDrive } from '@/componentes/Iconos';
import { desdePropuesto, listarInformes } from '@/lib/dominio/informes';
import { plantillasActivas } from '@/lib/dominio/plantillas';
import { presupuestoEnEuros } from '@/lib/dominio/aportaciones';
import { listarDonantes } from '@/lib/dominio/donantes';
import { iaDisponible } from '@/lib/ia';
import { Resumen } from './Resumen';
import { Seguimiento } from './Seguimiento';
import { Financiacion } from './Financiacion';
import { Archivos } from './Archivos';
import { Solicitud } from './Solicitud';
import type { Proyecto } from '@/lib/tipos';

const PESTANAS = {
  resumen: 'Resumen',
  archivos: 'Archivos',
  seguimiento: 'Seguimiento',
  financiacion: 'Financiación',
  solicitud: 'Solicitud',
} as const;

// Al pedir un informe, su preparación sigue en segundo plano dentro de la misma petición.
export const maxDuration = 300;
type Pestana = keyof typeof PESTANAS;

export async function generateMetadata({ params }: { params: Promise<{ codigo: string }> }): Promise<Metadata> {
  return { title: (await params).codigo };
}

export default async function FichaProyecto({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ pestana?: string; v?: string }>;
}) {
  const yo = await requiere('lectura');
  const editor = tienePermiso(yo, 'edicion');
  const { codigo } = await params;
  const q = await searchParams;
  const p = await leerProyecto(codigo);
  if (!p) notFound();
  const pestana: Pestana = q.pestana && q.pestana in PESTANAS ? (q.pestana as Pestana) : 'resumen';
  const d = await drive();
  const fase = indiceFase(p.estado);
  const opciones = estadosManuales(p.estado);

  return (
    <main className="principal" style={{ paddingTop: 20, gap: 20 }}>
      <Link className="volver" href="/">
        ← Todos los proyectos
      </Link>

      <section className="card ficha-cab">
        <div className="arriba">
          <div className="pila" style={{ gap: 6, minWidth: 0 }}>
            <p className="meta" style={{ margin: 0 }}>
              {p.codigo}
              {p.sector ? ` · ${nombreSector(p.sector)}` : ''}
            </p>
            <div className="titulo">
              <h1>{p.titulo || `Solicitud de ${p.contraparte.nombre}`}</h1>
              <Estado estado={p.estado} />
            </div>
            <p style={{ margin: 0, fontSize: 15, color: 'var(--texto-2)' }}>
              {[p.lugar, nombrePais(p.pais)].filter(Boolean).join(', ') || 'Sin ubicación'} · Contraparte: {p.contraparte.nombre}
            </p>
          </div>
          <div className="botones">
            {p.drive ? (
              <a className="btn btn-s" href={d.urlCarpeta(p.drive.carpetaId)} target="_blank" rel="noreferrer">
                <LogoDrive /> Carpeta en Drive
              </a>
            ) : editor ? (
              <FormAccion accion={crearCarpetaAccion}>
                <input type="hidden" name="codigo" value={p.codigo} />
                <Enviar clase="btn btn-s" pendiente="Creando…">
                  Crear carpeta en Drive
                </Enviar>
              </FormAccion>
            ) : null}
            {editor ? (
              <EditarProyecto p={p} />
            ) : null}
            {editor && p.drive ? (
              <GenerarInforme
                codigo={p.codigo}
                plantillas={await plantillasActivas('proyecto')}
                donantes={(await listarDonantes()).map((d) => ({ id: d.id, nombre: d.nombre }))}
                desde={desdePropuesto(p, await listarInformes(p.codigo))}
                hoy={new Date().toISOString().slice(0, 10)}
                ia={iaDisponible()}
              />
            ) : null}
            {editor && opciones.length ? (
              <Dialogo boton="Cambiar estado" claseBoton="btn btn-p" titulo="Cambiar estado">
                <FormAccion accion={cambiarEstadoAccion} className="pila" limpiar>
                  <input type="hidden" name="codigo" value={p.codigo} />
                  <p className="meta" style={{ margin: 0 }}>
                    Estado actual: {ESTADOS[p.estado].nombre}. Queda anotado quién, cuándo y por qué.
                  </p>
                  {p.estado === 'solicitud' || p.estado === 'revision' ? (
                    <p className="meta" style={{ margin: 0 }}>
                      Para validar, pedir cambios o rechazar la solicitud, usa <Link href={`/solicitudes?p=${p.codigo}`}>Solicitudes</Link>.
                    </p>
                  ) : null}
                  <label className="field">
                    Nuevo estado
                    <Desplegable name="estado" required opciones={opciones.map((e) => ({ valor: e, texto: ESTADOS[e].nombre }))} />
                  </label>
                  {p.estado === 'financiacion' && (presupuestoEnEuros(p) ?? 0) > p.comprometido ? (
                    <p className="aviso" style={{ margin: 0 }}>
                      Ojo: lo comprometido ({dinero(p.comprometido)}) no cubre el presupuesto ({dinero(presupuestoEnEuros(p))}). Normalmente pasa solo a Aprobado al cubrirse.
                    </p>
                  ) : null}
                  <label className="field">
                    Motivo
                    <textarea name="motivo" required minLength={3} placeholder="Por ejemplo: se reanuda la obra tras las lluvias." />
                  </label>
                  <div className="botones">
                    <Enviar pendiente="Guardando…">Cambiar estado</Enviar>
                  </div>
                </FormAccion>
              </Dialogo>
            ) : null}
          </div>
        </div>

        {esFinal(p.estado) && p.estado !== 'cerrado' ? (
          <p className="aviso-error" style={{ margin: 0 }}>
            Proyecto {ESTADOS[p.estado].nombre.toLowerCase()}.
          </p>
        ) : (
          <ol className="steps" aria-label="Fases del proyecto">
            {FASES.map((f, i) => {
              const ahora = i === fase;
              const parado = ahora && p.estado === 'parado';
              const hecho = i < fase || (p.estado === 'cerrado' && ahora);
              return (
                <li key={f} className={parado ? 'alerta' : hecho ? 'done' : ahora ? 'now' : undefined} aria-current={ahora ? 'step' : undefined}>
                  <span aria-hidden="true">{hecho ? '✓' : parado ? '!' : i + 1}</span>
                  {parado ? 'Parado' : ESTADOS[f].nombre}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <nav className="tabs" aria-label="Secciones del proyecto">
        {(Object.keys(PESTANAS) as Pestana[]).map((t) => (
          <Link key={t} className="tab" href={t === 'resumen' ? `/proyectos/${p.codigo}` : `?pestana=${t}`} aria-current={t === pestana ? 'page' : undefined} scroll={false}>
            {PESTANAS[t]}
          </Link>
        ))}
      </nav>

      {pestana === 'resumen' ? <Resumen p={p} /> : null}
      {pestana === 'seguimiento' ? <Seguimiento p={p} editor={editor} /> : null}
      {pestana === 'financiacion' ? <Financiacion p={p} editor={editor} /> : null}
      {pestana === 'archivos' ? <Archivos p={p} editor={editor} /> : null}
      {pestana === 'solicitud' ? <Solicitud p={p} version={Number(q.v) || null} /> : null}
    </main>
  );
}
