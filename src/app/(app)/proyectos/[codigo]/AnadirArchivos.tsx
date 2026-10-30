'use client';

// Diálogo para añadir archivos a la carpeta del proyecto: se arrastran a la zona o se
// eligen del ordenador. Suben directo a Drive, de uno en uno, y quedan en la cronología.

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialogo } from '@/componentes/Dialogo';
import { Desplegable } from '@/componentes/Desplegable';
import { subirArchivo } from '@/componentes/subida';
import { tamanoArchivo } from '@/lib/formato';

const CARPETAS = [
  { valor: 'seguimiento', texto: '04 Seguimiento (carpeta de este mes)' },
  { valor: 'solicitud', texto: '01 Solicitud' },
  { valor: 'propuesta', texto: '02 Propuesta' },
  { valor: 'financiacion', texto: '03 Financiación' },
  { valor: 'informes', texto: '05 Informes' },
  { valor: 'economico', texto: '06 Económico' },
  { valor: 'cierre', texto: '07 Cierre' },
];

interface Subida {
  clave: string;
  archivo: File;
  carpeta: string;
  subido: number;
  estado: 'esperando' | 'subiendo' | 'sinRed' | 'hecho' | 'error';
  error?: string;
}

export function AnadirArchivos({ codigo }: { codigo: string }) {
  const router = useRouter();
  const [carpeta, setCarpeta] = useState('seguimiento');
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [encima, setEncima] = useState(false);
  const cola = useRef<Subida[]>([]);
  const ocupado = useRef(false);
  const entrada = useRef<HTMLInputElement>(null);

  const actualizar = (clave: string, cambios: Partial<Subida>) => setSubidas((s) => s.map((x) => (x.clave === clave ? { ...x, ...cambios } : x)));

  const procesar = async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    let alguna = false;
    while (cola.current.length) {
      const s = cola.current.shift()!;
      try {
        actualizar(s.clave, { estado: 'subiendo', subido: 0, error: undefined });
        await subirArchivo<{ id: string }>(
          `/api/proyectos/${codigo}/subida`,
          s.archivo,
          s.archivo.name,
          s.archivo.type || 'application/octet-stream',
          (subido) => actualizar(s.clave, { subido }),
          (esperando) => actualizar(s.clave, { estado: esperando ? 'sinRed' : 'subiendo' }),
          { carpeta: s.carpeta },
        );
        actualizar(s.clave, { estado: 'hecho', subido: s.archivo.size });
        alguna = true;
      } catch (e) {
        actualizar(s.clave, { estado: 'error', error: e instanceof Error ? e.message : 'No se pudo subir' });
      }
    }
    ocupado.current = false;
    // La pestaña de archivos y la cronología se vuelven a cargar con lo nuevo.
    if (alguna) router.refresh();
  };

  const anadir = (lista: FileList | File[] | null) => {
    if (!lista?.length) return;
    const nuevas = Array.from(lista).map((archivo) => ({
      clave: `${archivo.name}-${archivo.size}-${Math.random()}`,
      archivo,
      carpeta,
      subido: 0,
      estado: 'esperando' as const,
    }));
    cola.current.push(...nuevas);
    setSubidas((s) => [...s, ...nuevas]);
    void procesar();
  };

  const reintentar = (s: Subida) => {
    cola.current.push(s);
    actualizar(s.clave, { estado: 'esperando', error: undefined });
    void procesar();
  };

  const pendientes = subidas.filter((s) => s.estado !== 'hecho' && s.estado !== 'error').length;

  return (
    <Dialogo boton="＋ Añadir archivos" claseBoton="btn btn-p btn-peq" titulo="Añadir archivos">
      <label className="field">
        Guardar en
        <Desplegable value={carpeta} onChange={setCarpeta} opciones={CARPETAS} />
      </label>

      <div
        className="zona-soltar"
        data-encima={encima ? '' : undefined}
        onDragEnter={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setEncima(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          anadir(e.dataTransfer.files);
        }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p style={{ margin: 0, fontWeight: 600 }}>Arrastra aquí los archivos</p>
        <p className="meta" style={{ margin: 0 }}>
          o
        </p>
        <button type="button" className="btn btn-s" onClick={() => entrada.current?.click()}>
          Elegir del ordenador
        </button>
        <input
          ref={entrada}
          type="file"
          multiple
          className="oculto"
          tabIndex={-1}
          onChange={(e) => {
            anadir(e.target.files);
            e.target.value = '';
          }}
        />
        <p className="meta" style={{ margin: 0 }}>
          Fotos, documentos, hojas de cálculo… hasta 500 MB por archivo. Se guardan con la fecha de hoy delante del nombre.
        </p>
      </div>

      {subidas.length ? (
        <ul className="subidas">
          {subidas.map((s) => (
            <li key={s.clave}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.estado === 'hecho' ? '✓ ' : ''}
                {s.archivo.name} <span className="meta">({tamanoArchivo(s.archivo.size)})</span>
              </span>
              {s.estado === 'error' ? (
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="warn">{s.error}</span>
                  <button type="button" className="btn btn-s btn-peq" onClick={() => reintentar(s)}>
                    Reintentar
                  </button>
                </span>
              ) : s.estado === 'hecho' ? (
                <span className="meta">Subido</span>
              ) : (
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="meta">
                    {s.estado === 'esperando' ? 'En cola' : s.estado === 'sinRed' ? 'Sin conexión…' : `${Math.round((s.subido / Math.max(1, s.archivo.size)) * 100)} %`}
                  </span>
                  <progress max={s.archivo.size} value={s.subido} />
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {subidas.length && !pendientes ? (
        <p className="aviso-ok" role="status" style={{ margin: 0 }}>
          Listo. Ya están en la carpeta del proyecto y en la cronología.
        </p>
      ) : null}
    </Dialogo>
  );
}
