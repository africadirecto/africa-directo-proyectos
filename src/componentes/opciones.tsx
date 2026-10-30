// Opciones con bandera para el Desplegable: países de África y monedas.
// Sirve tanto en componentes de servidor como de cliente.

import { Bandera, type Opcion } from './Desplegable';
import { banderaDeMoneda, listaPaises, MONEDAS, nombreMoneda } from '@/lib/paises';
import type { Idioma } from '@/lib/tipos';

/** Icono para los francos CFA, que no tienen una bandera propia. */
function Globo() {
  return (
    <svg className="bandera" viewBox="0 0 20 15" aria-hidden="true">
      <rect width="20" height="15" rx="2" fill="#eef3f6" />
      <circle cx="10" cy="7.5" r="5" fill="none" stroke="#5e5d57" strokeWidth="1" />
      <ellipse cx="10" cy="7.5" rx="2.2" ry="5" fill="none" stroke="#5e5d57" strokeWidth="0.8" />
      <path d="M5 7.5h10" stroke="#5e5d57" strokeWidth="0.8" />
    </svg>
  );
}

export function opcionesPaises(idioma: Idioma = 'es'): Opcion[] {
  return listaPaises(idioma).map((p) => ({ valor: p.codigo, texto: p.nombre, icono: <Bandera codigo={p.codigo} /> }));
}

/** «CDF (franco congoleño)», con la bandera del país de la moneda (ver banderaDeMoneda). */
export function opcionesMonedas(idioma: Idioma = 'es', pais = ''): Opcion[] {
  return MONEDAS.map((m) => {
    const b = banderaDeMoneda(m, pais);
    // Algunos nombres ya traen paréntesis («franc CFA (BCEAO)»): se cambian por una coma.
    const nombre = nombreMoneda(m, idioma).replace(/\s*\(([^)]+)\)/, ', $1');
    return { valor: m, texto: `${m} (${nombre})`, icono: b ? <Bandera codigo={b} /> : <Globo /> };
  });
}
