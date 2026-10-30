import { listarInformes } from '@/lib/dominio/informes';
import { ListaInformes } from '@/componentes/ListaInformes';
import type { Proyecto } from '@/lib/tipos';

/** Informes del proyecto (pestaña Archivos). */
export async function Informes({ p }: { p: Proyecto }) {
  return <ListaInformes informes={await listarInformes(p.codigo)} />;
}
