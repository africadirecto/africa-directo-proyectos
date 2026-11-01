'use client';

// Elegir un archivo del ordenador (o soltarlo encima), en lugar del <input type="file"> del
// navegador, que sale en su idioma y no encaja con el resto de campos. Sin archivo es una zona
// para soltar con un botón; con archivo, muestra su nombre y tamaño para cambiarlo o quitarlo.

import { useRef, useState } from 'react';
import { tamanoArchivo } from '@/lib/formato';

/** `acepta`: extensiones como en `accept` (".docx,.pdf"); también filtra lo que se suelta. */
export function ElegirArchivo({ acepta, archivo, onChange, etiqueta }: { acepta?: string; archivo: File | null; onChange: (f: File | null) => void; etiqueta?: string }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  const [aviso, setAviso] = useState('');
  const extensiones = acepta?.split(',').map((x) => x.trim().toLowerCase()) ?? [];

  function elegir(f: File | undefined) {
    if (!f) return;
    if (extensiones.length && !extensiones.some((x) => f.name.toLowerCase().endsWith(x))) {
      setAviso(`Ese tipo de archivo no vale aquí (${extensiones.join(', ')}).`);
      return;
    }
    setAviso('');
    onChange(f);
  }

  const abrir = () => entrada.current?.click();
  const input = (
    <input
      ref={entrada}
      type="file"
      accept={acepta}
      className="oculto"
      tabIndex={-1}
      aria-label={etiqueta}
      onChange={(e) => {
        elegir(e.target.files?.[0]);
        e.target.value = '';
      }}
    />
  );

  if (archivo) {
    return (
      <div className="archivo-elegido">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
        <span className="nombre">
          {archivo.name} <span className="meta">({tamanoArchivo(archivo.size)})</span>
        </span>
        <button type="button" className="btn btn-s btn-peq" onClick={abrir}>
          Cambiar
        </button>
        <button type="button" className="btn-enlace" onClick={() => onChange(null)}>
          Quitar
        </button>
        {input}
      </div>
    );
  }

  return (
    <div>
      <div
        className="zona-soltar compacta"
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
          elegir(e.dataTransfer.files[0]);
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Arrastra aquí el archivo o</span>
        <button type="button" className="btn btn-s btn-peq" onClick={abrir}>
          Elegir del ordenador
        </button>
        {input}
      </div>
      {aviso ? (
        <p className="warn" role="status" style={{ margin: '6px 0 0', fontSize: 14 }}>
          {aviso}
        </p>
      ) : null}
    </div>
  );
}
