'use client';

// Crear una plantilla a partir de un informe de ejemplo: se sube (Word, PowerPoint o PDF) o se
// elige uno de la unidad de plantillas. La app la prepara en segundo plano: la convierte, la IA
// decide qué es fijo y qué cambia en cada informe, y escribe las instrucciones.

import { startTransition, useActionState, useState } from 'react';
import { Desplegable } from '@/componentes/Desplegable';
import { ElegirTipo } from './ElegirTipo';
import { subirArchivo } from '@/componentes/subida';
import { crearDesdeEjemploAccion } from '@/lib/acciones/plantillas';
import type { Resultado } from '@/lib/acciones/resultado';

const TIPO_POR_EXTENSION: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
};

export function NuevaDesdeEjemplo({ ejemplos, donantes, demo }: { ejemplos: { id: string; nombre: string; ruta: string }[]; donantes: { id: string; nombre: string }[]; demo: boolean }) {
  const [estado, crear, creando] = useActionState<Resultado, FormData>(crearDesdeEjemploAccion, { ok: false });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [elegido, setElegido] = useState('');
  const [nombre, setNombre] = useState('');
  const [subida, setSubida] = useState<{ avance: number; error: string } | null>(null);
  const ocupado = creando || (subida !== null && !subida.error);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (archivo) {
      const mime = archivo.type || TIPO_POR_EXTENSION[archivo.name.split('.').pop()?.toLowerCase() ?? ''] || '';
      try {
        setSubida({ avance: 0, error: '' });
        const r = await subirArchivo<{ id: string }>('/api/plantillas/subida', archivo, archivo.name, mime, (n) => setSubida({ avance: n / archivo.size, error: '' }), () => undefined);
        fd.set('ejemplo', r.id);
      } catch (err) {
        setSubida({ avance: 0, error: err instanceof Error ? err.message : 'No se pudo subir el archivo.' });
        return;
      }
    } else fd.set('ejemplo', elegido);
    setSubida(null);
    startTransition(() => crear(fd));
  }

  return (
    <form className="pila" onSubmit={enviar}>
      <p className="meta" style={{ margin: 0 }}>
        La app convierte el ejemplo en un documento de Google, la IA decide qué es texto fijo y qué cambia en cada informe (y lo marca), y escribe las instrucciones copiando su estilo. Queda en borrador para que lo revises, lo pruebes con un proyecto y lo actives. Suele tardar unos minutos.
      </p>
      {demo ? <p className="aviso" style={{ margin: 0 }}>En el modo demo no se pueden convertir archivos de Word, PowerPoint ni PDF: esto solo funciona con Google Drive.</p> : null}
      <div className="campos">
        <label className="field ancho">
          <span>
            Informe de ejemplo <span className="ayuda">Word, PowerPoint o PDF; mejor el original que un PDF</span>
          </span>
          <input
            type="file"
            accept=".docx,.doc,.odt,.rtf,.pdf,.pptx,.ppt"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setArchivo(f);
              if (f && !nombre) setNombre(f.name.replace(/\.[^.]+$/, ''));
            }}
          />
        </label>
        {ejemplos.length ? (
          <label className="field ancho">
            <span>
              O uno que ya esté en Drive <span className="ayuda">de la unidad «AD · Plantillas»</span>
            </span>
            <Desplegable
              value={elegido}
              onChange={(v) => {
                setElegido(v);
                const e = ejemplos.find((x) => x.id === v);
                if (e && !nombre) setNombre(e.nombre.replace(/\.[^.]+$/, ''));
              }}
              placeholder="Ninguno"
              opciones={[{ valor: '', texto: 'Ninguno' }, ...ejemplos.map((x) => ({ valor: x.id, texto: x.nombre, grupo: x.ruta || 'AD · Plantillas' }))]}
            />
          </label>
        ) : null}
        <label className="field ancho">
          Nombre de la plantilla
          <input name="nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Por ejemplo: Informe intermedio Fundación Horizonte" />
        </label>
        <ElegirTipo />
        <label className="field">
          <span>
            Donante <span className="ayuda">si es su plantilla</span>
          </span>
          <Desplegable name="donante" defaultValue="" opciones={[{ valor: '', texto: 'Ninguno: plantilla general' }, ...donantes.map((d) => ({ valor: d.id, texto: d.nombre }))]} />
        </label>
      </div>
      <div className="botones">
        <button type="submit" className="btn btn-p" disabled={ocupado || (!archivo && !elegido)}>
          {subida && !subida.error ? `Subiendo… ${Math.round(subida.avance * 100)} %` : creando ? 'Poniéndolo en marcha…' : 'Crear la plantilla'}
        </button>
      </div>
      {subida?.error ? <p className="aviso-error" role="status" style={{ margin: 0 }}>{subida.error}</p> : null}
      {estado.vez && !estado.ok && estado.mensaje ? <p className="aviso-error" role="status" style={{ margin: 0 }}>{estado.mensaje}</p> : null}
    </form>
  );
}
