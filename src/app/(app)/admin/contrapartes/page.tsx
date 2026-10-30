import { redirect } from 'next/navigation';

// Las contrapartes tienen ahora su propia sección en el menú principal.
export default function ContrapartesAdmin() {
  redirect('/contrapartes');
}
