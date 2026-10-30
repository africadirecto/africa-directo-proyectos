'use client';

// Formulario de la contraparte. Guarda en el dispositivo a cada cambio y en el
// servidor unos segundos después; si no hay conexión, lo reintenta al volver.

import { cloneElement, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { camposQueFaltan, totalPresupuesto } from '@/lib/formulario/respuestas';
import type { Textos } from '@/lib/formulario/textos';
import { MONEDA_DE_PAIS } from '@/lib/paises';
import { enEuros, FUENTE_CAMBIO } from '@/lib/cambio';
import { Desplegable } from '@/componentes/Desplegable';
import { opcionesMonedas, opcionesPaises } from '@/componentes/opciones';
import type { ArchivoSubido, Idioma, RespuestasSolicitud } from '@/lib/tipos';
import { prepararArchivo, subirArchivo } from './subir';

type EstadoGuardado = '' | 'guardando' | 'guardado' | 'sinConexion';
interface Subida {
  clave: string;
  nombre: string;
  tamano: number;
  subido: number;
  estado: 'preparando' | 'subiendo' | 'sinRed' | 'error';
  error?: string;
  archivo: File;
}

const MAX_BYTES = 50 * 1024 * 1024;
const ACEPTA = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.ppt,.pptx,.txt,.csv';

function formatoTamano(b: number) {
  return b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function FormularioSolicitud({
  token,
  idioma: idiomaInicial,
  idiomas,
  textos: t,
  inicial,
  actualizado,
  archivosIniciales,
  sectores,
  cambio,
  cambios,
}: {
  token: string;
  idioma: Idioma;
  idiomas: Record<Idioma, string>;
  textos: Textos;
  inicial: RespuestasSolicitud;
  actualizado: string;
  archivosIniciales: ArchivoSubido[];
  sectores: Record<string, string>;
  /** Unidades de cada moneda por 1 euro (ver lib/cambio.ts). */
  cambio: Record<string, number>;
  cambios: string;
}) {
  const router = useRouter();
  const clave = `ad-solicitud-${token.split('.')[0]}`;
  const [r, setR] = useState<RespuestasSolicitud>(inicial);
  const [idioma, setIdioma] = useState(idiomaInicial);
  const [archivos, setArchivos] = useState(archivosIniciales);
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [guardado, setGuardado] = useState<EstadoGuardado>('');
  const [errores, setErrores] = useState<string[]>([]);
  const [aviso, setAviso] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const primera = useRef(true);
  const cola = useRef<Subida[]>([]);
  const subiendo = useRef(false);

  // Al abrir: si en este dispositivo hay una versión más reciente que la del servidor, se recupera.
  useEffect(() => {
    try {
      const local = JSON.parse(localStorage.getItem(clave) ?? 'null') as { respuestas: RespuestasSolicitud; fecha: string } | null;
      if (local && local.fecha > (actualizado || '')) setR({ ...inicial, ...local.respuestas });
    } catch {
      /* sin almacenamiento local */
    }
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guardarServidor = useCallback(
    async (datos: RespuestasSolicitud, idi: Idioma) => {
      setGuardado('guardando');
      try {
        const res = await fetch(`/api/f/${token}/borrador`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ respuestas: datos, idioma: idi }),
          keepalive: true,
        });
        setGuardado(res.ok ? 'guardado' : 'sinConexion');
      } catch {
        setGuardado('sinConexion');
      }
    },
    [token],
  );

  // Guardado: en el dispositivo al momento y en el servidor a los 2,5 s del último cambio.
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    try {
      localStorage.setItem(clave, JSON.stringify({ respuestas: r, fecha: new Date().toISOString() }));
    } catch {
      /* sin almacenamiento local */
    }
    const id = setTimeout(() => guardarServidor(r, idioma), 2500);
    return () => clearTimeout(id);
  }, [r, idioma, clave, guardarServidor]);

  // Al volver la conexión, se guarda lo pendiente.
  useEffect(() => {
    const alVolver = () => {
      if (guardado === 'sinConexion') guardarServidor(r, idioma);
    };
    window.addEventListener('online', alVolver);
    return () => window.removeEventListener('online', alVolver);
  }, [guardado, r, idioma, guardarServidor]);

  const cambiar = <K extends keyof RespuestasSolicitud>(campo: K, valor: RespuestasSolicitud[K]) => {
    setR((x) => ({ ...x, [campo]: valor }));
    setErrores((e) => e.filter((c) => c !== campo));
  };
  const num = (v: string) => (v.trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v));

  // ── Archivos ──────────────────────────────────────────────
  const actualizarSubida = (clave: string, cambios: Partial<Subida>) =>
    setSubidas((s) => s.map((x) => (x.clave === clave ? { ...x, ...cambios } : x)));

  const procesarCola = async () => {
    if (subiendo.current) return;
    subiendo.current = true;
    while (cola.current.length) {
      const s = cola.current.shift()!;
      try {
        actualizarSubida(s.clave, { estado: 'preparando' });
        const { blob, nombre, mime } = await prepararArchivo(s.archivo);
        actualizarSubida(s.clave, { estado: 'subiendo', tamano: blob.size, subido: 0 });
        const lista = await subirArchivo(
          token,
          blob,
          nombre,
          mime,
          (subido) => actualizarSubida(s.clave, { subido }),
          (esperando) => actualizarSubida(s.clave, { estado: esperando ? 'sinRed' : 'subiendo' }),
        );
        setArchivos(lista);
        setSubidas((x) => x.filter((y) => y.clave !== s.clave));
      } catch (e) {
        actualizarSubida(s.clave, { estado: 'error', error: e instanceof Error ? e.message : '' });
      }
    }
    subiendo.current = false;
  };

  const anadirArchivos = (lista: FileList | null) => {
    if (!lista) return;
    const nuevas: Subida[] = [];
    for (const f of Array.from(lista)) {
      const s: Subida = { clave: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`, nombre: f.name, tamano: f.size, subido: 0, estado: 'preparando', archivo: f };
      if (f.size > MAX_BYTES) {
        s.estado = 'error';
        s.error = t.demasiadoGrande;
      } else {
        cola.current.push(s);
      }
      nuevas.push(s);
    }
    setSubidas((x) => [...x, ...nuevas]);
    void procesarCola();
  };

  const reintentar = (s: Subida) => {
    actualizarSubida(s.clave, { estado: 'preparando', error: undefined, subido: 0 });
    cola.current.push(s);
    void procesarCola();
  };

  const quitar = async (id: string) => {
    setArchivos((a) => a.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/f/${token}/quitar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (res.ok) setArchivos(((await res.json()) as { archivos: ArchivoSubido[] }).archivos);
    } catch {
      /* se volverá a ver al recargar */
    }
  };

  // ── Ubicación ─────────────────────────────────────────────
  const usarUbicacion = () => {
    if (!navigator.geolocation) return setUbicacion(t.ubicacionError);
    setUbicacion('…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cambiar('lat', Number(pos.coords.latitude.toFixed(5)));
        cambiar('lng', Number(pos.coords.longitude.toFixed(5)));
        setUbicacion(t.ubicacionOk);
      },
      () => setUbicacion(t.ubicacionError),
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  };

  // ── Envío ─────────────────────────────────────────────────
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setAviso('');
    const faltan = camposQueFaltan(r);
    if (faltan.length) {
      setErrores(faltan);
      setAviso(t.revisaCampos);
      document.querySelector(`[data-campo="${faltan[0]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (subidas.some((s) => s.estado !== 'error')) return setAviso(t.esperaSubidas);
    if (!window.confirm(t.confirmarEnvio)) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/f/${token}/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuestas: r, idioma }),
      });
      if (res.status === 422) {
        setErrores(((await res.json()) as { faltan: string[] }).faltan);
        setAviso(t.revisaCampos);
      } else if (!res.ok) {
        setAviso(t.error);
      } else {
        try {
          localStorage.removeItem(clave);
        } catch {
          /* nada */
        }
        setEnviado(true);
        window.scrollTo({ top: 0 });
        router.refresh();
      }
    } catch {
      setAviso(t.sinConexion);
    }
    setEnviando(false);
  };

  if (enviado) {
    return (
      <section className="card pila">
        <h1>{t.enviado_t}</h1>
        <p className="p">{t.enviado_p}</p>
      </section>
    );
  }

  const error = (campo: keyof RespuestasSolicitud) => errores.includes(campo);
  const etiqueta = (campo: keyof RespuestasSolicitud, texto: string, opcional = false) => (
    <span>
      {texto}
      {opcional ? <span className="ayuda"> ({t.opcional})</span> : null}
      {error(campo) ? <span className="error-campo"> · {t.obligatorio}</span> : null}
    </span>
  );
  const attrs = (campo: keyof RespuestasSolicitud) => ({ 'data-campo': campo, 'data-error': error(campo) ? '' : undefined });

  // Una casilla con su etiqueta y, si la tiene, su pista debajo (ligada con aria-describedby).
  // Es una función y no un componente para que React no vuelva a montar el campo al escribir.
  const casilla = (
    nombre: keyof RespuestasSolicitud,
    texto: string,
    control: React.ReactElement<{ id?: string; 'aria-describedby'?: string }>,
    { opcional = false, ancho = false }: { opcional?: boolean; ancho?: boolean } = {},
  ) => {
    const pista = t.pistas[nombre as keyof Textos['pistas']];
    const id = `campo-${nombre}`;
    return (
      <div className={ancho ? 'field ancho' : 'field'} {...attrs(nombre)}>
        <label htmlFor={id}>{etiqueta(nombre, texto, opcional)}</label>
        {cloneElement(control, { id, 'aria-describedby': pista ? `${id}-pista` : undefined })}
        {pista ? (
          <p id={`${id}-pista`} className="pista">
            {pista}
          </p>
        ) : null}
      </div>
    );
  };

  const elegirPais = (pais: string) => {
    cambiar('pais', pais);
    // La moneda sigue al país; la contraparte puede cambiarla después.
    if (MONEDA_DE_PAIS[pais]) cambiar('moneda', MONEDA_DE_PAIS[pais]);
  };

  const total = totalPresupuesto(r.lineas);
  const totalEur = r.moneda !== 'EUR' ? enEuros(total, r.moneda, cambio) : null;
  const euros = (n: number) => new Intl.NumberFormat(idioma, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

  return (
    <form className="pila" style={{ gap: 20 }} onSubmit={enviar} noValidate>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        <h1>{t.titulo}</h1>
        <label className="field" style={{ width: 170 }}>
          {t.idioma}
          <Desplegable
            value={idioma}
            onChange={(v) => {
              const nuevo = v as Idioma;
              setIdioma(nuevo);
              router.replace(`?lang=${nuevo}`, { scroll: false });
            }}
            opciones={(Object.keys(idiomas) as Idioma[]).map((i) => ({ valor: i, texto: idiomas[i] }))}
          />
        </label>
      </div>
      <p className="p" style={{ color: 'var(--texto-2)' }}>
        {t.intro}
      </p>

      {cambios ? (
        <section className="aviso">
          <h3>{t.cambios_t}</h3>
          <p className="p" style={{ whiteSpace: 'pre-wrap' }}>
            {cambios}
          </p>
          <p className="meta" style={{ margin: '6px 0 0' }}>
            {t.cambios_p}
          </p>
        </section>
      ) : null}

      <section className="card pila" style={{ gap: 14 }}>
        <h2 className="h3" style={{ margin: 0 }}>
          {t.s_org}
        </h2>
        <div className="campos">
          {casilla('organizacion', t.organizacion, <input value={r.organizacion} onChange={(e) => cambiar('organizacion', e.target.value)} autoComplete="organization" />, { ancho: true })}
          {casilla('contactoNombre', t.contactoNombre, <input value={r.contactoNombre} onChange={(e) => cambiar('contactoNombre', e.target.value)} autoComplete="name" />)}
          {casilla('contactoCargo', t.contactoCargo, <input value={r.contactoCargo} onChange={(e) => cambiar('contactoCargo', e.target.value)} />, { opcional: true })}
          {casilla(
            'contactoCorreo',
            t.contactoCorreo,
            <input type="email" value={r.contactoCorreo} onChange={(e) => cambiar('contactoCorreo', e.target.value)} autoComplete="email" />,
          )}
          {casilla(
            'contactoTelefono',
            t.contactoTelefono,
            <input type="tel" value={r.contactoTelefono} onChange={(e) => cambiar('contactoTelefono', e.target.value)} autoComplete="tel" />,
            { opcional: true },
          )}
        </div>
      </section>

      <section className="card pila" style={{ gap: 14 }}>
        <h2 className="h3" style={{ margin: 0 }}>
          {t.s_proyecto}
        </h2>
        <div className="campos">
          {casilla('titulo', t.tituloProyecto, <input value={r.titulo} onChange={(e) => cambiar('titulo', e.target.value)} />, { ancho: true })}
          {casilla(
            'sector',
            t.sector,
            <Desplegable value={r.sector} onChange={(v) => cambiar('sector', v)} placeholder="—" opciones={Object.entries(sectores).map(([valor, texto]) => ({ valor, texto }))} />,
          )}
          {casilla(
            'pais',
            t.pais,
            <Desplegable value={r.pais} onChange={elegirPais} placeholder="—" opciones={opcionesPaises(idioma)} textoBuscar={t.buscar} sinResultados={t.sinResultados} />,
          )}
          {casilla('lugar', t.lugar, <input value={r.lugar} onChange={(e) => cambiar('lugar', e.target.value)} />)}
          {casilla('indicaciones', t.indicaciones, <input value={r.indicaciones} onChange={(e) => cambiar('indicaciones', e.target.value)} />, { opcional: true })}
          <div className="field ancho">
            <span>
              {t.ubicacion} <span className="ayuda">({t.opcional})</span>
            </span>
            <div className="botones">
              <button type="button" className="btn btn-s" onClick={usarUbicacion}>
                📍 {t.usarUbicacion}
              </button>
              <span className="meta" role="status">
                {ubicacion || (r.lat != null ? `${t.ubicacionOk}: ${r.lat}, ${r.lng}` : t.ayudaUbicacion)}
              </span>
            </div>
          </div>
          {casilla('necesidad', t.necesidad, <textarea value={r.necesidad} onChange={(e) => cambiar('necesidad', e.target.value)} rows={6} />, { ancho: true })}
          {casilla('beneficiarios', t.beneficiarios, <textarea value={r.beneficiarios} onChange={(e) => cambiar('beneficiarios', e.target.value)} rows={3} />, { ancho: true })}
          {casilla(
            'numBeneficiarios',
            t.numBeneficiarios,
            <input type="number" inputMode="numeric" min={0} value={r.numBeneficiarios ?? ''} onChange={(e) => cambiar('numBeneficiarios', num(e.target.value))} />,
            { opcional: true },
          )}
          {casilla(
            'plazoMeses',
            t.plazoMeses,
            <input type="number" inputMode="numeric" min={0} value={r.plazoMeses ?? ''} onChange={(e) => cambiar('plazoMeses', num(e.target.value))} />,
            { opcional: true },
          )}
          {casilla('aportacionLocal', t.aportacionLocal, <textarea value={r.aportacionLocal} onChange={(e) => cambiar('aportacionLocal', e.target.value)} rows={3} />, {
            opcional: true,
            ancho: true,
          })}
        </div>
      </section>

      <section className="card pila" style={{ gap: 14 }} {...attrs('lineas')}>
        <div>
          <h2 className="h3" style={{ margin: 0 }}>
            {t.s_presupuesto}
            {error('lineas') ? <span className="error-campo" style={{ fontSize: 13, color: 'var(--error)' }}> · {t.obligatorio}</span> : null}
          </h2>
          <p className="pista" style={{ marginTop: 6 }}>
            {t.pistas.lineas}
          </p>
        </div>
        <div className="campos">
          {casilla(
            'moneda',
            t.moneda,
            <Desplegable
              value={r.moneda}
              onChange={(v) => cambiar('moneda', v)}
              opciones={opcionesMonedas(idioma, r.pais)}
              buscar
              textoBuscar={t.buscar}
              sinResultados={t.sinResultados}
            />,
          )}
        </div>
        {r.lineas.map((l, i) => (
          <div key={i} className="linea-ppto">
            <label className="field">
              {t.concepto} {i + 1}
              <input
                value={l.concepto}
                onChange={(e) => cambiar('lineas', r.lineas.map((x, j) => (j === i ? { ...x, concepto: e.target.value } : x)))}
              />
            </label>
            <label className="field">
              {t.importe}
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={l.importe ?? ''}
                onChange={(e) => cambiar('lineas', r.lineas.map((x, j) => (j === i ? { ...x, importe: num(e.target.value) } : x)))}
              />
            </label>
            <button type="button" className="btn btn-s" onClick={() => cambiar('lineas', r.lineas.filter((_, j) => j !== i))} disabled={r.lineas.length <= 1}>
              {t.quitar}
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <button type="button" className="btn btn-s" onClick={() => cambiar('lineas', [...r.lineas, { concepto: '', importe: null }])}>
            ＋ {t.anadirLinea}
          </button>
          <div className="total-ppto">
            <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
              {t.total}: {total.toLocaleString(idioma)} {r.moneda}
            </p>
            {totalEur != null && total > 0 ? (
              <p className="meta" style={{ margin: 0 }}>
                {t.equivalente.replace('{eur}', euros(totalEur))} ·{' '}
                <a href={FUENTE_CAMBIO.url} target="_blank" rel="noreferrer">
                  {FUENTE_CAMBIO.nombre}
                </a>
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card pila" style={{ gap: 14 }}>
        <div>
          <h2 className="h3" style={{ margin: 0 }}>
            {t.s_archivos}
          </h2>
          <p className="pista" style={{ marginTop: 6 }}>
            {t.pistas.archivos}
          </p>
        </div>
        {archivos.length || subidas.length ? (
          <ul className="subidas">
            {archivos.map((a) => (
              <li key={a.id}>
                <span>
                  ✓ {a.nombre.replace(/^\d{4}-\d{2}-\d{2} /, '')} <span className="meta">({formatoTamano(a.tamano)})</span>
                </span>
                <button type="button" className="btn btn-s btn-peq" onClick={() => quitar(a.id)}>
                  {t.quitar}
                </button>
              </li>
            ))}
            {subidas.map((s) => (
              <li key={s.clave}>
                <span>{s.nombre}</span>
                {s.estado === 'error' ? (
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="warn">{s.error === t.demasiadoGrande ? s.error : t.errorSubida}</span>
                    {s.error !== t.demasiadoGrande ? (
                      <button type="button" className="btn btn-s btn-peq" onClick={() => reintentar(s)}>
                        {t.reintentar}
                      </button>
                    ) : null}
                  </span>
                ) : (
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="meta">{s.estado === 'preparando' ? t.preparando : s.estado === 'sinRed' ? t.esperandoRed : `${t.subiendo} ${Math.round((s.subido / Math.max(1, s.tamano)) * 100)} %`}</span>
                    <progress max={s.tamano} value={s.subido} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        <label className="btn btn-s" style={{ alignSelf: 'flex-start' }}>
          ＋ {t.elegirArchivos}
          <input type="file" multiple accept={ACEPTA} className="oculto" onChange={(e) => { anadirArchivos(e.target.files); e.target.value = ''; }} />
        </label>
      </section>

      {aviso ? (
        <p className="aviso-error" role="alert" style={{ margin: 0 }}>
          {aviso}
        </p>
      ) : null}

      <div className="estado-guardado">
        <span className="meta" role="status">
          {guardado === 'guardando' ? t.guardando : guardado === 'guardado' ? `✓ ${t.guardado}` : guardado === 'sinConexion' ? t.sinConexion : ''}
        </span>
        <button type="submit" className="btn btn-p" disabled={enviando}>
          {enviando ? t.enviando : t.enviar}
        </button>
      </div>
    </form>
  );
}
