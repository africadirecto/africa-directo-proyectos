import type { Metadata } from 'next';
import Link from 'next/link';
import { requiere, tienePermiso } from '@/lib/sesion';
import { leerIndice } from '@/lib/dominio/indice';
import { leerProyecto } from '@/lib/dominio/proyectos';
import { enlaceDe, listarVersiones, textoInvitacion } from '@/lib/dominio/solicitudes';
import { correoDisponible } from '@/lib/avisos';
import { iaDisponible } from '@/lib/ia';
import { dinero, fechaCorta, fechaLarga, haceDias } from '@/lib/formato';
import { nombrePais } from '@/lib/paises';
import { IDIOMAS_ES, nombreSector } from '@/lib/formulario/textos';
import { totalPresupuesto } from '@/lib/formulario/respuestas';
import { Estado, Etiqueta } from '@/componentes/Basicos';
import { Copiar } from '@/componentes/Copiar';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { VistaSolicitud } from '@/componentes/VistaSolicitud';
import { decidirSolicitud, reanalizar, reenviarFormulario, renovarEnlaceAccion } from '@/lib/acciones/solicitudes';
import type { EstadoFormulario, FilaPanel } from '@/lib/tipos';

export const metadata: Metadata = { title: 'Solicitudes' };

const FORMULARIO: Record<EstadoFormulario, { texto: string; clase: string }> = {
  pendiente: { texto: 'Formulario enviado', clase: 's-sol' },
  abierto: { texto: 'Formulario abierto', clase: 's-rev' },
  cambios: { texto: 'Cambios pedidos', clase: 's-par' },
  enviado: { texto: 'Recibida', clase: 's-val' },
  cerrado: { texto: 'Cerrado', clase: 's-cer' },
};

function Item({ f, actual, detalle }: { f: FilaPanel; actual: boolean; detalle: string }) {
  const etiqueta = f.estado === 'revision' ? null : FORMULARIO[f.formulario];
  return (
    <Link className="item" href={`/solicitudes?p=${f.codigo}`} aria-current={actual ? 'true' : undefined} scroll={false}>
      <span className="cab">
        <span className="t">{f.titulo || `Solicitud de ${f.contraparte}`}</span>
        {etiqueta ? <Etiqueta clase={etiqueta.clase}>{etiqueta.texto}</Etiqueta> : <Estado estado={f.estado} />}
      </span>
      <span className="m">
        {[f.lugar, nombrePais(f.pais)].filter(Boolean).join(', ') || f.contraparte} · {detalle}
      </span>
    </Link>
  );
}

export default async function Solicitudes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const yo = await requiere('lectura');
  const editor = tienePermiso(yo, 'edicion');
  const q = await searchParams;
  const filas = await leerIndice();
  const porRevisar = filas.filter((f) => f.estado === 'revision');
  const esperando = filas.filter((f) => f.estado === 'solicitud');
  const elegido = q.p ?? porRevisar[0]?.codigo ?? esperando[0]?.codigo;
  const p = elegido ? await leerProyecto(elegido) : null;
  const versiones = p ? await listarVersiones(p.codigo) : [];
  const v = versiones[0];

  return (
    <main className="principal">
      <div className="titulo-pagina">
        <div>
          <h1>Solicitudes</h1>
          <p>Necesidades nuevas y formularios pendientes de las contrapartes.</p>
        </div>
        {editor ? (
          <Link className="btn btn-p" href="/solicitudes/nueva">
            Nueva solicitud
          </Link>
        ) : null}
      </div>

      {q.nueva ? (
        <p className="aviso-ok" role="status" style={{ margin: 0 }}>
          Solicitud registrada.{' '}
          {q.nueva === 'enviada' ? 'Se ha enviado el formulario por correo a la contraparte.' : 'Envía a la contraparte el enlace al formulario (abajo).'}
        </p>
      ) : null}
      {q.drive === '0' ? (
        <p className="aviso-error" style={{ margin: 0 }}>
          No se pudo crear la carpeta en Drive. Puedes reintentarlo desde la ficha del proyecto.
        </p>
      ) : null}

      <div className="fila" style={{ gap: 24 }}>
        <section aria-label="Bandeja" style={{ flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="pila" style={{ gap: 10 }}>
            <h2 className="grp">Por revisar · {porRevisar.length}</h2>
            {porRevisar.map((f) => (
              <Item key={f.codigo} f={f} actual={f.codigo === elegido} detalle={`recibida ${haceDias(f.ultimaNoticia)}`} />
            ))}
            {!porRevisar.length ? <p className="meta" style={{ margin: 0 }}>Nada por revisar.</p> : null}
          </div>
          <div className="pila" style={{ gap: 10 }}>
            <h2 className="grp">Esperando a la contraparte · {esperando.length}</h2>
            {esperando.map((f) => (
              <Item
                key={f.codigo}
                f={f}
                actual={f.codigo === elegido}
                detalle={`${f.formulario === 'cambios' ? 'cambios pedidos' : 'enviado'} el ${fechaCorta(f.formularioEnviadoEn)}${f.formulario === 'pendiente' ? ' · sin abrir' : ''}`}
              />
            ))}
            {!esperando.length ? <p className="meta" style={{ margin: 0 }}>No hay formularios pendientes.</p> : null}
          </div>
        </section>

        {p ? (
          <article aria-labelledby="det-titulo" className="card" style={{ flex: '999 1 560px', minWidth: 0, padding: 24, display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <p className="meta" style={{ margin: '0 0 4px' }}>
                  <Link href={`/proyectos/${p.codigo}`}>{p.codigo}</Link>
                  {p.sector ? ` · ${nombreSector(p.sector)}` : ''}
                </p>
                <h2 id="det-titulo" style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
                  {p.titulo || `Solicitud de ${p.contraparte.nombre}`}
                </h2>
                <p style={{ margin: '6px 0 0', fontSize: 15, color: 'var(--texto-2)' }}>
                  {[p.lugar, nombrePais(p.pais)].filter(Boolean).join(', ')}
                  {p.lugar || p.pais ? ' · ' : ''}
                  {p.contraparte.nombre}
                </p>
              </div>
              <Estado estado={p.estado} />
            </div>

            {p.estado === 'revision' && v ? (
              <>
                <section className="pila" style={{ gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Resumen</h3>
                  {v.analisis ? (
                    <>
                      <p className="p">{v.analisis.resumen || '—'}</p>
                      <p className="meta" style={{ margin: 0 }}>
                        {v.analisis.hechoPorIA
                          ? `Resumen${v.idioma !== 'es' ? ` y traducción del ${IDIOMAS_ES[v.idioma].toLowerCase()}` : ''} hechos por IA. Revisa el original abajo.`
                          : 'Sin IA: es el principio de la descripción de la contraparte.'}
                      </p>
                    </>
                  ) : (
                    <p className="meta" style={{ margin: 0 }}>
                      Analizando la solicitud… Recarga la página en un momento.
                    </p>
                  )}
                </section>

                {v.analisis?.falta.length ? (
                  <section className="aviso">
                    <h3>Falta información</h3>
                    <ul>
                      {v.analisis.falta.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <dl className="kv">
                  <div>
                    <dt>Presupuesto estimado</dt>
                    <dd>{dinero(totalPresupuesto(v.respuestas.lineas), v.respuestas.moneda)}</dd>
                  </div>
                  <div>
                    <dt>Plazo previsto</dt>
                    <dd>{v.respuestas.plazoMeses ? `${v.respuestas.plazoMeses} meses` : '—'}</dd>
                  </div>
                  <div>
                    <dt>Persona de contacto</dt>
                    <dd>{v.respuestas.contactoNombre || '—'}</dd>
                  </div>
                  <div>
                    <dt>Idioma</dt>
                    <dd>{IDIOMAS_ES[v.idioma]}</dd>
                  </div>
                </dl>

                <details className="desplegable">
                  <summary className="btn btn-s">Ver la solicitud completa</summary>
                  <VistaSolicitud v={v} />
                </details>

                {editor ? (
                  <section className="pila" style={{ borderTop: '1px solid var(--borde-suave)', paddingTop: 20, gap: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Decisión</h3>
                    <FormAccion accion={decidirSolicitud} className="pila">
                      <input type="hidden" name="codigo" value={p.codigo} />
                      <label className="field">
                        Comentario para la contraparte{p.contraparte.idioma !== 'es' ? ` (se envía traducido al ${IDIOMAS_ES[p.contraparte.idioma].toLowerCase()})` : ''}
                        <textarea name="comentario" placeholder="Obligatorio si pides cambios. Por ejemplo: separad el presupuesto en materiales y mano de obra." />
                      </label>
                      <div className="botones">
                        <Enviar name="decision" value="validar" pendiente="Validando…">
                          Validar propuesta
                        </Enviar>
                        <Enviar name="decision" value="cambios" clase="btn btn-s" pendiente="Enviando…">
                          Pedir cambios
                        </Enviar>
                        <Enviar name="decision" value="rechazar" clase="btn btn-d" pendiente="Rechazando…">
                          Rechazar
                        </Enviar>
                      </div>
                    </FormAccion>
                    {!correoDisponible() ? (
                      <p className="meta" style={{ margin: 0 }}>
                        El envío automático de correos no está configurado: tras pedir cambios, copia el enlace y los comentarios y envíalos tú.
                      </p>
                    ) : null}
                    {!v.analisis?.hechoPorIA && iaDisponible() ? (
                      <FormAccion accion={reanalizar}>
                        <input type="hidden" name="codigo" value={p.codigo} />
                        <input type="hidden" name="version" value={v.version} />
                        <Enviar clase="btn-enlace">Analizar con IA</Enviar>
                      </FormAccion>
                    ) : null}
                  </section>
                ) : null}
              </>
            ) : p.estado === 'solicitud' ? (
              <>
                <dl className="kv">
                  <div>
                    <dt>Formulario</dt>
                    <dd>
                      <Etiqueta clase={FORMULARIO[p.formulario.estado].clase}>{FORMULARIO[p.formulario.estado].texto}</Etiqueta>
                    </dd>
                  </div>
                  <div>
                    <dt>{p.formulario.estado === 'cambios' ? 'Cambios pedidos' : 'Enviado'}</dt>
                    <dd>
                      {fechaLarga(p.formulario.enviadoEn)} <span className="meta">({haceDias(p.formulario.enviadoEn)})</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Contraparte</dt>
                    <dd>{p.contraparte.nombre}</dd>
                  </div>
                  <div>
                    <dt>Idioma</dt>
                    <dd>{IDIOMAS_ES[p.contraparte.idioma]}</dd>
                  </div>
                  <div>
                    <dt>Abierto por la contraparte</dt>
                    <dd>{p.formulario.abiertoEn ? fechaLarga(p.formulario.abiertoEn) : 'Todavía no'}</dd>
                  </div>
                  <div>
                    <dt>Versiones enviadas</dt>
                    <dd>{p.formulario.version}</dd>
                  </div>
                </dl>

                {p.formulario.estado === 'cambios' && p.formulario.comentarios ? (
                  <section className="aviso">
                    <h3>Cambios pedidos</h3>
                    <p className="p">{p.formulario.comentarios.es}</p>
                    <p className="meta" style={{ margin: '6px 0 0' }}>
                      {p.formulario.comentarios.traducido
                        ? `La contraparte lo ve en ${IDIOMAS_ES[p.formulario.comentarios.idioma].toLowerCase()}: ${p.formulario.comentarios.traducido}`
                        : p.formulario.comentarios.idioma !== 'es'
                          ? 'Sin IA no se ha traducido: la contraparte lo ve en español.'
                          : null}
                    </p>
                  </section>
                ) : null}

                {editor ? (
                  <section className="pila">
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Enlace al formulario</h3>
                    <p className="meta" style={{ margin: 0 }}>
                      La contraparte no necesita cuenta. El enlace caduca a los 180 días; puedes renovarlo si se ha perdido o compartido por error.
                    </p>
                    <Copiar valor={enlaceDe(p)} etiqueta="Enlace al formulario" />
                    <div className="botones">
                      {correoDisponible() && p.contraparte.correo ? (
                        <FormAccion accion={reenviarFormulario}>
                          <input type="hidden" name="codigo" value={p.codigo} />
                          <Enviar clase="btn btn-s" pendiente="Enviando…">
                            Enviar por correo a {p.contraparte.correo}
                          </Enviar>
                        </FormAccion>
                      ) : null}
                      <FormAccion accion={renovarEnlaceAccion} confirmar="El enlace actual dejará de funcionar. ¿Seguro?">
                        <input type="hidden" name="codigo" value={p.codigo} />
                        <Enviar clase="btn btn-d" pendiente="Renovando…">
                          Renovar enlace
                        </Enviar>
                      </FormAccion>
                    </div>
                    {!correoDisponible() ? (
                      <details className="desplegable">
                        <summary className="btn-enlace">Ver un correo listo para copiar ({IDIOMAS_ES[p.contraparte.idioma].toLowerCase()})</summary>
                        <Copiar valor={`${textoInvitacion(p).asunto}\n\n${textoInvitacion(p).texto}`} etiqueta="Correo para la contraparte" multilinea />
                      </details>
                    ) : null}
                  </section>
                ) : null}
              </>
            ) : (
              <p className="p">
                Esta solicitud ya no está pendiente. <Link href={`/proyectos/${p.codigo}`}>Abrir la ficha del proyecto →</Link>
              </p>
            )}
          </article>
        ) : (
          <div className="card" style={{ flex: '999 1 560px' }}>
            <p className="vacio">No hay solicitudes pendientes.</p>
          </div>
        )}
      </div>
    </main>
  );
}
