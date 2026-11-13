import type { Metadata } from 'next';
import { requiere } from '@/lib/sesion';
import { actividadReciente } from '@/lib/dominio/actividad';
import { TablaActividad } from './TablaActividad';

export const metadata: Metadata = { title: 'Actividad' };

const PERIODOS = [7, 30, 90, 365];

export default async function PaginaActividad({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  await requiere('admin');
  const pedido = Number((await searchParams).dias);
  const dias = PERIODOS.includes(pedido) ? pedido : 30;

  return (
    <>
      <h1>Actividad</h1>
      <TablaActividad filas={await actividadReciente(dias)} dias={dias} periodos={PERIODOS} />
    </>
  );
}
