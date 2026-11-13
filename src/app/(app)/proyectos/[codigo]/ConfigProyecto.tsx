'use client';

// Configuración del proyecto, solo para administración: un diálogo con las opciones (por ahora,
// eliminarlo). Eliminar pide escribir el nombre del proyecto y, después, una confirmación.

import { useContext, useState } from 'react';
import { ContextoDialogo, Dialogo, abrirDialogo } from '@/componentes/Dialogo';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { IconoAjustes, IconoBorrar } from '@/componentes/Iconos';
import { eliminarProyectoAccion } from '@/lib/acciones/proyectos';

const ID_ELIMINAR = 'eliminar-proyecto';
const limpio = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase();

/** Una opción del diálogo de configuración: lo cierra y abre el suyo. */
function Opcion({ dialogo, icono, texto, detalle }: { dialogo: string; icono: React.ReactNode; texto: string; detalle: string }) {
  const config = useContext(ContextoDialogo);
  return (
    <button
      type="button"
      className="menu-opcion"
      data-peligro
      style={{ height: 'auto', padding: '10px', alignItems: 'flex-start', whiteSpace: 'normal' }}
      onClick={() => {
        config?.cerrar();
        abrirDialogo(dialogo);
      }}
    >
      <span style={{ marginTop: 2 }}>{icono}</span>
      <span>
        <strong style={{ display: 'block' }}>{texto}</strong>
        <span className="meta">{detalle}</span>
      </span>
    </button>
  );
}

export function ConfigProyecto({ codigo, nombre }: { codigo: string; nombre: string }) {
  const [escrito, setEscrito] = useState('');
  const coincide = limpio(escrito) === limpio(nombre);

  return (
    <>
      <Dialogo
        boton={
          <>
            <IconoAjustes tamano={18} /> Configuración
          </>
        }
        titulo="Configuración del proyecto"
      >
        <Opcion
          dialogo={ID_ELIMINAR}
          icono={<IconoBorrar tamano={18} />}
          texto="Eliminar proyecto"
          detalle="Deja de verse en la app. Se puede recuperar en Administración › Proyectos eliminados."
        />
      </Dialogo>

      <Dialogo id={ID_ELIMINAR} titulo="Eliminar proyecto">
        <FormAccion
          accion={eliminarProyectoAccion}
          className="pila"
          peligro
          confirmar={`¿Eliminar el proyecto ${codigo}? Dejará de verse en la app y su carpeta de Drive pasará a «4. Eliminados».`}
        >
          <input type="hidden" name="codigo" value={codigo} />
          <p style={{ margin: 0, fontSize: 15 }}>
            El proyecto <strong>{codigo}</strong> dejará de verse en Proyectos, Solicitudes, donantes e informes, y el formulario de la contraparte dejará de funcionar. Su
            carpeta de Drive se mueve a «4. Eliminados».
          </p>
          <p className="meta" style={{ margin: 0 }}>
            No se borra nada: un administrador puede recuperarlo en Administración › Proyectos eliminados.
          </p>
          <label className="field">
            <span>
              Para confirmar, escribe el nombre del proyecto: <strong>{nombre}</strong>
            </span>
            <input name="nombre" value={escrito} onChange={(e) => setEscrito(e.target.value)} autoComplete="off" required />
          </label>
          <div className="botones">
            <Enviar clase="btn btn-d" pendiente="Eliminando…" disabled={!coincide}>
              Eliminar proyecto
            </Enviar>
          </div>
        </FormAccion>
      </Dialogo>
    </>
  );
}
