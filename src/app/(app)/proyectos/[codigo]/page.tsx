import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requiere, tienePermiso } from '@/lib/sesion';
import { leerProyecto } from '@/lib/dominio/proyectos';
import { listarUsuarios } from '@/lib/dominio/usuarios';
import { drive } from '@/lib/drive';
import { ESTADOS, FASES, esFinal, indiceFase, transicionesDesde } from '@/lib/estados';
import { dinero, diasDesde } from '@/lib/formato';
import { nombrePais, listaPaises, MONEDAS } from '@/lib/paises';
import { nombreSector } from '@/lib/formulario/textos';
import { DIAS_SIN_NOTICIAS } from '@/lib/dominio/atencion';
import { Estado } from '@/componentes/Basicos';
import { Dialogo } from '@/componentes/Dialogo';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { cambiarEstadoAccion, crearCarpetaAccion } from '@/lib/acciones/proyectos';
import { EditarProyecto } from './EditarProyecto';
import { Resumen } from './Resumen';
import { Seguimiento } from './Seguimiento';
import { Financiacion } from './Financiacion';
import { Archivos } from './Archivos';
import { Solicitud } from './Solicitud';
import type { Proyecto } from '@/lib/tipos';

const PESTANAS = {
  resumen: 'Resumen',
  seguimiento: 'Seguimiento',
  financiacion: 'Financiación',
  archivos: 'Archivos',
  solicitud: 'Solicitud',
} as const;
type Pestana = keyof typeof PESTANAS;

export async function generateMetadata({ params }: { params: Promise<{ codigo: string }> }): Promise<Metadata> {
  return { title: (await params).codigo };
}

/** Sugerencia de "Siguiente paso" según el estado. */
function siguientePaso(p: Proyecto): { texto: string; enlace?: [string, string] } | null {
  const falta = (p.presupuesto ?? 0) - p.comprometido;
  switch (p.estado) {
    case 'solicitud':
      return { texto: p.formulario.estado === 'cambios' ? 'esperando a que la contraparte corrija la solicitud.' : 'esperando a que la contraparte rellene el formulario.', enlace: ['Ver el enlace', `/solicitudes?p=${p.codigo}`] };
    case 'revision':
      return { texto: 'revisar la solicitud y decidir.', enlace: ['Revisar', `/solicitudes?p=${p.codigo}`] };
    case 'validada':
      return { texto: 'buscar financiación: añade los donantes a los que se presenta el proyecto.', enlace: ['Financiación', '?pestana=financiacion'] };
    case 'financiacion':
      return { texto: falta > 0 ? `faltan ${dinero(falta, p.moneda)} por comprometer.` : 'revisa el presupuesto: la financiación ya lo cubre.', enlace: ['Financiación', '?pestana=financiacion'] };
    case 'aprobado':
      return { texto: 'cuando empiece la obra, pasa el proyecto a «En ejecución».' };
    case 'ejecucion': {
      const d = diasDesde(p.ultimaNoticia);
      return d > DIAS_SIN_NOTICIAS
        ? { texto: `no hay noticias desde hace ${d} días: escribe a la contraparte.`, enlace: ['Seguimiento', '?pestana=seguimiento'] }
        : { texto: 'seguimiento de la obra: anota las novedades.', enlace: ['Seguimiento', '?pestana=seguimiento'] };
    }
    case 'parado':
      return { texto: 'proyecto parado: anota la causa y cuándo se reanuda.', enlace: ['Seguimiento', '?pestana=seguimiento'] };
    case 'completado':
      return { texto: 'recoge las fotos finales y el informe final, y cierra el proyecto.', enlace: ['Archivos', '?pestana=archivos'] };
    default:
      return null;
  }
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
  const siguiente = siguientePaso(p);
  const opciones = transicionesDesde(p.estado).filter((e) => !(p.estado === 'revision' && e === 'solicitud'));
  const responsables = editor ? (await listarUsuarios()).filter((u) => u.estado === 'activo' && u.permiso !== 'lectura') : [];

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
              {[p.lugar, nombrePais(p.pais)].filter(Boolean).join(', ') || 'Sin ubicación'} · Contraparte: {p.contraparte.nombre} · Responsable: {p.responsable?.nombre ?? 'sin asignar'}
            </p>
          </div>
          <div className="botones">
            {p.drive ? (
              <a className="btn btn-s" href={d.urlCarpeta(p.drive.carpetaId)} target="_blank" rel="noreferrer">
                Carpeta en Drive ↗
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
              <EditarProyecto
                p={p}
                paises={listaPaises('es')}
                monedas={MONEDAS}
                responsables={responsables.map((u) => ({ id: u.email, nombre: u.nombre || u.email }))}
              />
            ) : null}
            {editor && opciones.length ? (
              <Dialogo boton="Cambiar estado" claseBoton="btn btn-p" titulo="Cambiar estado">
                <FormAccion accion={cambiarEstadoAccion} className="pila">
                  <input type="hidden" name="codigo" value={p.codigo} />
                  <p className="meta" style={{ margin: 0 }}>
                    Estado actual: {ESTADOS[p.estado].nombre}. Queda anotado quién, cuándo y por qué.
                  </p>
                  <label className="field">
                    Nuevo estado
                    <select name="estado" required defaultValue="">
                      <option value="" disabled>
                        Elige…
                      </option>
                      {opciones.map((e) => (
                        <option key={e} value={e}>
                          {ESTADOS[e].nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  {p.estado === 'financiacion' && (p.presupuesto ?? 0) > p.comprometido ? (
                    <p className="aviso" style={{ margin: 0 }}>
                      Ojo: lo comprometido ({dinero(p.comprometido, p.moneda)}) no cubre el presupuesto ({dinero(p.presupuesto, p.moneda)}). Normalmente pasa solo a Aprobado al cubrirse.
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

        {siguiente ? (
          <div className="siguiente">
            <p>
              <b>Siguiente paso:</b> {siguiente.texto}
            </p>
            {siguiente.enlace ? (
              <Link className="btn btn-s" style={{ minHeight: 40 }} href={siguiente.enlace[1]}>
                {siguiente.enlace[0]}
              </Link>
            ) : null}
          </div>
        ) : null}
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
