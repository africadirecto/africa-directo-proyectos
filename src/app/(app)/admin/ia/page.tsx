import type { Metadata } from 'next';
import { requiere } from '@/lib/sesion';
import { almacen } from '@/lib/almacen';
import { ajustesIa } from '@/lib/ia/ajustes';
import { catalogoModelos } from '@/lib/ia/modelos';
import { lotesPosibles } from '@/lib/trabajos/comun';
import { ClavesIa, ProbarModelos } from './ClavesIa';
import { FormAjustesIa } from './FormAjustesIa';

export const metadata: Metadata = { title: 'Ajustes de IA' };
// «Probar los modelos» espera a que respondan todos.
export const maxDuration = 120;

type Mes = { llamadas: number; entrada: number; salida: number; coste?: number };
const dolares = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 3 })} $`;

export default async function AjustesIa() {
  await requiere('admin');
  const [a, catalogo, uso] = await Promise.all([
    ajustesIa(),
    catalogoModelos(),
    almacen().then((db) => db.leer<{ meses?: Record<string, Mes> }>('ajustes/ia')),
  ]);
  const meses = Object.entries(uso?.meses ?? {})
    .sort(([x], [y]) => y.localeCompare(x))
    .slice(0, 6);
  const gastoMes = uso?.meses?.[new Date().toISOString().slice(0, 7)]?.coste ?? 0;
  const { clave: _c, secretoWebhook: _s, origen, final, ...ajustes } = a;

  return (
    <>
      <h1>Ajustes de IA</h1>
      {!a.clave ? <p className="aviso" style={{ margin: 0 }}>Sin clave de OpenRouter, la app funciona sin IA.</p> : null}
      <ClavesIa origen={origen} final={final} />
      <FormAjustesIa ajustes={ajustes} catalogo={catalogo} lotesPosibles={lotesPosibles()} />
      {a.clave ? (
        <section className="card">
          <ProbarModelos />
        </section>
      ) : null}

      <section className="card">
        <h2 className="h2" style={{ marginBottom: 4 }}>
          Uso
        </h2>
        <p className="meta" style={{ margin: '0 0 12px' }}>
          Este mes: {dolares(gastoMes)}
          {a.limiteMensual ? ` de ${dolares(a.limiteMensual)}` : ''}
        </p>
        {meses.length ? (
          <div className="desliza">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Mes</th>
                  <th scope="col" className="der">
                    Llamadas
                  </th>
                  <th scope="col" className="der">
                    Tokens de entrada
                  </th>
                  <th scope="col" className="der">
                    Tokens de salida
                  </th>
                  <th scope="col" className="der">
                    Coste
                  </th>
                </tr>
              </thead>
              <tbody>
                {meses.map(([mes, m]) => (
                  <tr key={mes}>
                    <td>{mes}</td>
                    <td className="der">{m.llamadas.toLocaleString('es-ES')}</td>
                    <td className="der">{m.entrada.toLocaleString('es-ES')}</td>
                    <td className="der">{m.salida.toLocaleString('es-ES')}</td>
                    <td className="der">{m.coste != null ? dolares(m.coste) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vacio">Todavía no se ha usado la IA.</p>
        )}
      </section>
    </>
  );
}
