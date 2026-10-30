import { listarInformes } from '@/lib/dominio/informes';
import { ListaInformes } from '@/componentes/ListaInformes';
import type { Proyecto } from '@/lib/tipos';

/** Borradores de informe del proyecto (pestaña Archivos). */
export async function Informes({ p, editor }: { p: Proyecto; editor: boolean }) {
  return <ListaInformes informes={await listarInformes(p.codigo)} codigo={p.codigo} editor={editor} />;
}
