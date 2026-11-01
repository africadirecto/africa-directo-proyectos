'use client';

// Botón «Exportar a Google Sheets» de la financiación: crea el libro y deja el enlace para abrirlo.

import { useActionState } from 'react';
import { exportarFinanciacionAccion } from '@/lib/acciones/financiacion';
import { LogoSheets } from '@/componentes/Iconos';
import { ResultadoInforme } from '@/componentes/OpcionesInforme';

export function ExportarFinanciacion({ codigo }: { codigo: string }) {
  const [estado, ejecutar, pendiente] = useActionState(exportarFinanciacionAccion, { ok: false });
  return (
    <form action={ejecutar} className="fin-exportar">
      <input type="hidden" name="codigo" value={codigo} />
      <button type="submit" className="btn btn-s btn-peq" disabled={pendiente}>
        <LogoSheets tamano={16} /> {pendiente ? 'Exportando…' : 'Exportar a Google Sheets'}
      </button>
      <ResultadoInforme estado={estado} />
    </form>
  );
}
