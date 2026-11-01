import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { persona, requiere, tienePermiso } from '@/lib/sesion';
import { listarDonantes } from '@/lib/dominio/donantes';
import {
  CLASE_ESTADO,
  ESTADOS_PLANTILLA,
  FORMATOS_PLANTILLA,
  TIPOS_PLANTILLA,
  camposSinInstruccion,
  leerPlantilla,
  listarPruebas,
  listarVersiones,
  sincronizarPlantilla,
} from '@/lib/dominio/plantillas';
import { DATOS, TABLAS, valeParaTipo } from '@/lib/dominio/marcadores';
import { iaDisponible } from '@/lib/ia';
import {
  borrarPlantillaAccion,
  duplicarPlantillaAccion,
  estadoPlantillaAccion,
  porDefectoAccion,
  reintentarPlantillaAccion,
  restaurarVersionAccion,
  sincronizarAccion,
} from '@/lib/acciones/plantillas';
import { IDIOMAS_ES } from '@/lib/formulario/textos';
import { fechaHora } from '@/lib/formato';
import { Dialogo } from '@/componentes/Dialogo';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { Etiqueta } from '@/componentes/Basicos';
import { FormPlantilla } from '../FormPlantilla';
import { Instrucciones } from './Instrucciones';
import { ProbarPlantilla } from './ProbarPlantilla';
import { ListaInformes } from '@/componentes/ListaInformes';
import { Refrescar } from '@/componentes/Refrescar';
import { leerIndice } from '@/lib/dominio/indice';
import { avanzarPlantilla } from '@/lib/trabajos/plantilla';
import type { Plantilla as TipoPlantilla } from '@/lib/tipos';

// «Cambiar con IA» espera la respuesta de la IA, y una plantilla desde un ejemplo avanza al abrirla.
export const maxDuration = 300;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await leerPlantilla((await params).id);
  return { title: p?.nombre ?? 'Plantilla' };
}

export default async function Plantilla({ params }: { params: Promise<{ id: string }> }) {
  const yo = await requiere('lectura');
  const id = (await params).id;
  const guardada = await leerPlantilla(id);
  if (!guardada) notFound();
  // Si alguien ha editado el documento en Google, se vuelve a leer (si no, no cuesta nada).
  // Mientras se prepara desde un ejemplo, no: aún no está escrita.
  let errorLectura = '';
  const preparando = guardada.estado === 'procesando';
  const p = preparando || !guardada.archivoId
    ? guardada
    : await sincronizarPlantilla(id, persona(yo)).catch((e) => {
        errorLectura = e instanceof Error ? e.message : 'No se pudo leer el documento.';
        return guardada;
      });
  // Al abrirla mientras se prepara, se hace avanzar (así sigue aunque se pierda un aviso).
  const proceso = (guardada as TipoPlantilla & { proceso?: { paso: string; bloqueo?: string; lote?: { comprobado: string } | null } | null }).proceso;
  if (preparando && proceso && !(proceso.bloqueo && proceso.bloqueo > new Date().toISOString()) && !(proceso.paso === 'esperando' && proceso.lote && Date.now() - Date.parse(proceso.lote.comprobado) < 60_000)) {
    after(() => avanzarPlantilla(id));
  }
  const PASOS: Record<string, string> = { convertir: 'convirtiendo el ejemplo en un documento de Google', analizar: 'la IA está leyendo el ejemplo', esperando: 'la IA está leyendo el ejemplo (puede tardar unos minutos)', escribir: 'escribiendo los marcadores y las instrucciones' };
  const deProyecto = ['seguimiento', 'final', 'financiacion'].includes(p.tipo);
  const edicion = tienePermiso(yo, 'edicion');
  const admin = tienePermiso(yo, 'admin');
  const [versiones, donantes, pruebas, proyectos] = await Promise.all([
    listarVersiones(id),
    edicion ? listarDonantes() : Promise.resolve([]),
    listarPruebas(id),
    edicion && deProyecto ? leerIndice() : Promise.resolve([]),
  ]);
  const avisos = [...(errorLectura ? [`No se pudo leer el documento: ${errorLectura}`] : []), ...(p.sincronizado?.avisos ?? [])];
  const sin = camposSinInstruccion(p);

  return (
    <main className="principal">
      <Link className="volver" href="/plantillas">
        ← Plantillas
      </Link>
      <div className="titulo-pagina">
        <div>
          <h1>{p.nombre}</h1>
          <p>
            {TIPOS_PLANTILLA[p.tipo]} · {FORMATOS_PLANTILLA[p.formato]} · en {IDIOMAS_ES[p.idioma].toLowerCase()}
            {p.donante ? ` · de ${p.donante.nombre}` : ''}
          </p>
          <div className="botones" style={{ gap: 6, marginTop: 8 }}>
            <Etiqueta clase={CLASE_ESTADO[p.estado]}>{ESTADOS_PLANTILLA[p.estado]}</Etiqueta>
            {p.porDefecto ? <Etiqueta clase="s-fin">Por defecto</Etiqueta> : null}
          </div>
        </div>
        <div className="botones">
          {p.url ? (
            <a className="btn btn-p" href={p.url} target="_blank" rel="noopener noreferrer">
              Abrir en Google {p.formato === 'slides' ? 'Slides' : 'Docs'}
            </a>
          ) : null}
          {edicion && p.archivoId && !preparando ? (
            <FormAccion accion={sincronizarAccion}>
              <input type="hidden" name="id" value={p.id} />
              <Enviar clase="btn btn-s" pendiente="Leyendo…">
                Volver a leer el documento
              </Enviar>
            </FormAccion>
          ) : null}
        </div>
      </div>
      {p.descripcion ? <p style={{ margin: 0 }}>{p.descripcion}</p> : null}
      {preparando ? (
        <div className="nota" role="status">
          <Refrescar segundos={5} />
          Preparando la plantilla a partir de «{p.ejemplo?.nombre}»: {PASOS[proceso?.paso ?? ''] ?? 'en cola'}… Puedes cerrar esta página: seguirá haciéndose.
        </div>
      ) : null}
      {p.estado === 'error' && p.error ? (
        <div className="aviso-error" role="status" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <span>No se pudo preparar la plantilla: {p.error}</span>
          {edicion && p.origen === 'ejemplo' ? (
            <FormAccion accion={reintentarPlantillaAccion} ocultarOk>
              <input type="hidden" name="id" value={p.id} />
              <Enviar clase="btn btn-s btn-peq" pendiente="…">
                Reintentar
              </Enviar>
            </FormAccion>
          ) : null}
        </div>
      ) : null}

      {avisos.length || sin.length ? (
        <div className="aviso">
          <h3>Revisa la plantilla</h3>
          <ul>
            {sin.length ? <li>Campos sin instrucción: {sin.map((c) => `{{ia:${c}}}`).join(', ')}. La IA solo tendrá las instrucciones generales.</li> : null}
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="fila">
        <section className="card col-ancha">
          <div className="card-cab">
            <h2 className="h3">Instrucciones para la IA</h2>
            <span className="sub">Versión {p.version}</span>
          </div>
          {preparando ? (
            <p className="vacio">La IA está escribiendo las instrucciones a partir del ejemplo.</p>
          ) : p.estructura.campos.length ? (
            <Instrucciones
              key={`${p.id}-${p.version}`}
              id={p.id}
              editable={edicion}
              formato={p.formato}
              campos={p.estructura.campos}
              actuales={p.instrucciones}
              iaDisponible={iaDisponible()}
            />
          ) : (
            <p className="vacio">El documento no tiene campos para la IA. Escribe en él marcadores como {'{{ia:avance}}'} y vuelve a leerlo.</p>
          )}
        </section>

        <aside className="pila" style={{ flex: '1 1 280px', gap: 20 }}>
          {edicion ? (
            <section className="card pila">
              <h2 className="h3">Acciones</h2>
              <div className="botones">
                {deProyecto && (p.estado === 'borrador' || p.estado === 'activa') ? (
                  <Dialogo boton="Probar con un proyecto" claseBoton="btn btn-p btn-peq" titulo="Probar la plantilla">
                    <ProbarPlantilla id={p.id} idioma={p.idioma} proyectos={proyectos.map((f) => ({ codigo: f.codigo, titulo: f.titulo }))} conPeriodo={p.tipo !== 'financiacion'} />
                  </Dialogo>
                ) : null}
                {p.estado !== 'activa' && !preparando ? (
                  <FormAccion accion={estadoPlantillaAccion}>
                    <input type="hidden" name="id" value={p.id} />
                    <Enviar clase="btn btn-p btn-peq" name="estado" value="activa">
                      Activar
                    </Enviar>
                  </FormAccion>
                ) : null}
                {admin && p.estado === 'activa' && !p.porDefecto ? (
                  <FormAccion accion={porDefectoAccion}>
                    <input type="hidden" name="id" value={p.id} />
                    <Enviar clase="btn btn-s btn-peq">Proponer por defecto</Enviar>
                  </FormAccion>
                ) : null}
                {p.estado === 'activa' ? (
                  <FormAccion accion={estadoPlantillaAccion}>
                    <input type="hidden" name="id" value={p.id} />
                    <Enviar clase="btn btn-s btn-peq" name="estado" value="borrador">
                      Pasar a borrador
                    </Enviar>
                  </FormAccion>
                ) : null}
                {p.estado !== 'archivada' ? (
                  <FormAccion accion={estadoPlantillaAccion}>
                    <input type="hidden" name="id" value={p.id} />
                    <Enviar clase="btn btn-s btn-peq" name="estado" value="archivada">
                      Archivar
                    </Enviar>
                  </FormAccion>
                ) : null}
                <Dialogo boton="Editar datos" claseBoton="btn btn-s btn-peq" titulo="Datos de la plantilla">
                  <FormPlantilla p={p} donantes={donantes.map((d) => ({ id: d.id, nombre: d.nombre }))} />
                </Dialogo>
                <Dialogo boton="Duplicar" claseBoton="btn btn-s btn-peq" titulo="Duplicar la plantilla">
                  <FormAccion accion={duplicarPlantillaAccion} className="pila">
                    <input type="hidden" name="id" value={p.id} />
                    <p className="nota" style={{ margin: 0 }}>
                      Se copia el documento en la misma carpeta de Drive, con las mismas instrucciones, como borrador.
                    </p>
                    <label className="field">
                      Nombre de la copia
                      <input name="nombre" required defaultValue={`${p.nombre} (copia)`} />
                    </label>
                    <div className="botones">
                      <Enviar pendiente="Copiando…">Duplicar</Enviar>
                    </div>
                  </FormAccion>
                </Dialogo>
                {admin ? (
                  <FormAccion
                    accion={borrarPlantillaAccion}
                    confirmar={
                      p.origen === 'drive'
                        ? '¿Quitar esta plantilla de la app? El documento se queda en Drive.'
                        : '¿Borrar esta plantilla? Se quita de la app y el documento va a la papelera de Drive.'
                    }
                  >
                    <input type="hidden" name="id" value={p.id} />
                    <Enviar clase="btn btn-s btn-peq" pendiente="Borrando…">
                      Borrar
                    </Enviar>
                  </FormAccion>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="card pila">
            <h2 className="h3">Datos y tablas</h2>
            {p.estructura.datos.length || p.estructura.tablas.length ? (
              <p style={{ margin: 0, lineHeight: 1.8 }}>
                {[...p.estructura.datos.map((d) => `{{${d}}}`), ...p.estructura.tablas.map((t) => `{{tabla:${t}}}`)].map((m) => (
                  <code key={m} className="marcador" style={{ marginRight: 6 }}>
                    {m}
                  </code>
                ))}
              </p>
            ) : (
              <p className="sub">La plantilla no usa datos del proyecto.</p>
            )}
            <details className="desplegable">
              <summary className="enlace">Marcadores que se pueden usar</summary>
              <div className="pila" style={{ fontSize: 14 }}>
                <p style={{ margin: 0 }}>
                  Se escriben tal cual en el documento, de una vez y sin cambiar el formato a mitad. <code className="marcador">{'{{ia:clave}}'}</code> es un texto de la IA,{' '}
                  <code className="marcador">{'{{foto:clave}}'}</code> una foto (o en el texto alternativo de una imagen), <code className="marcador">{'{{pie:clave}}'}</code> su pie
                  {p.formato === 'docs' ? (
                    <>
                      {' '}
                      y <code className="marcador">{'{{fotos:clave}}'}</code> varias en una tabla
                    </>
                  ) : null}
                  .{p.formato === 'slides' ? ' En Slides, las tablas salen como líneas de texto y una foto ocupa el recuadro donde está su marcador.' : ''}
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                  {Object.entries(DATOS)
                    .filter(([, d]) => valeParaTipo(d.ambito, p.tipo))
                    .map(([k, d]) => (
                      <li key={k}>
                        <code className="marcador">{`{{${k}}}`}</code> {d.descripcion}
                      </li>
                    ))}
                  {Object.entries(TABLAS)
                    .filter(([, t]) => valeParaTipo(t.ambito, p.tipo))
                    .map(([k, t]) => (
                      <li key={k}>
                        <code className="marcador">{`{{tabla:${k}}}`}</code> {t.descripcion}
                      </li>
                    ))}
                </ul>
              </div>
            </details>
          </section>

          <section className="card pila">
            <h2 className="h3">Versiones de las instrucciones</h2>
            {versiones.length ? (
              <ul className="pila" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 10 }}>
                {versiones.map((v) => (
                  <li key={v.id} style={{ fontSize: 14 }}>
                    <b>Versión {v.version}</b>
                    {v.version === p.version ? ' (la actual)' : ''} · {fechaHora(v.creado)} · {v.creadoPor.nombre}
                    {v.nota ? <span className="sub">{v.nota}</span> : null}
                    {edicion && v.version !== p.version ? (
                      <FormAccion accion={restaurarVersionAccion} confirmar={`¿Volver a las instrucciones de la versión ${v.version}? Se guardan como una versión nueva.`}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="version" value={v.version} />
                        <Enviar clase="btn btn-s btn-peq" pendiente="Recuperando…">
                          Volver a esta
                        </Enviar>
                      </FormAccion>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sub">Aún no se han guardado instrucciones.</p>
            )}
          </section>
        </aside>
      </div>
      <ListaInformes informes={pruebas} coleccion="informes" editable={edicion} titulo="Pruebas de esta plantilla" />
    </main>
  );
}
