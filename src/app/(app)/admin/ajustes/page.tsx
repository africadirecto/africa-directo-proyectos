import type { Metadata } from 'next';
import { requiere } from '@/lib/sesion';
import { almacen } from '@/lib/almacen';
import { config, estadoIntegraciones } from '@/lib/config';

export const metadata: Metadata = { title: 'Ajustes' };

const NOMBRES: Record<keyof ReturnType<typeof estadoIntegraciones>, [string, string]> = {
  firestore: ['Base de datos (Firestore)', 'FIREBASE_PROJECT_ID y la cuenta de servicio'],
  drive: ['Carpetas en Drive', 'DRIVE_UNIDAD_PROYECTOS_ID'],
  login: ['Entrar con Google', 'NEXT_PUBLIC_FIREBASE_* y ONG_DOMINIO'],
  ia: ['IA: traducir y resumir', 'OPENAI_API_KEY'],
  correo: ['Envío de correos (Apps Script)', 'APPS_SCRIPT_URL y APPS_SCRIPT_SECRETO'],
  chat: ['Avisos en Google Chat', 'GOOGLE_CHAT_WEBHOOK_URL'],
  copia: ['Copia nocturna', 'DRIVE_UNIDAD_SISTEMA_ID y CRON_SECRET'],
};

const ESTADO = {
  ok: ['Configurado', '#1D6B50'],
  demo: ['Modo demo', '#7A4B00'],
  falta: ['Sin configurar', '#B42318'],
} as const;

export default async function Ajustes() {
  await requiere('admin');
  const integraciones = estadoIntegraciones();
  const uso = (await (await almacen()).leer<{ meses?: Record<string, { llamadas: number; entrada: number; salida: number }> }>('ajustes/ia'))?.meses ?? {};
  const meses = Object.entries(uso).sort(([a], [b]) => b.localeCompare(a)).slice(0, 6);

  return (
    <>
      <h1>Ajustes</h1>
      <section className="card">
        <h2 className="h2" style={{ marginBottom: 4 }}>
          Integraciones
        </h2>
        <p className="meta" style={{ margin: '0 0 8px' }}>
          Se configuran con variables de entorno en Vercel. Cómo hacerlo: docs/DESPLIEGUE.md en el repositorio.
        </p>
        {(Object.keys(NOMBRES) as (keyof typeof NOMBRES)[]).map((k) => {
          const [texto, color] = ESTADO[integraciones[k]];
          return (
            <div key={k} className="req">
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{NOMBRES[k][0]}</p>
                <p className="meta" style={{ margin: '2px 0 0' }}>
                  {NOMBRES[k][1]}
                </p>
              </div>
              <span className="estado-int" style={{ color }}>
                <span className="dot" style={{ background: color }} />
                {texto}
              </span>
            </div>
          );
        })}
      </section>

      <section className="card">
        <h2 className="h2" style={{ marginBottom: 4 }}>
          Uso de la IA
        </h2>
        <p className="meta" style={{ margin: '0 0 12px' }}>
          Modelo rápido: {config.ia.modeloRapido} · modelo de redacción: {config.ia.modeloRedaccion}. El gasto real y el límite mensual se ven en platform.openai.com.
        </p>
        {meses.length ? (
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
              </tr>
            </thead>
            <tbody>
              {meses.map(([mes, m]) => (
                <tr key={mes}>
                  <td>{mes}</td>
                  <td className="der">{m.llamadas.toLocaleString('es-ES')}</td>
                  <td className="der">{m.entrada.toLocaleString('es-ES')}</td>
                  <td className="der">{m.salida.toLocaleString('es-ES')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="vacio">Todavía no se ha usado la IA.</p>
        )}
      </section>

      <section className="card">
        <h2 className="h2" style={{ marginBottom: 8 }}>
          Organización
        </h2>
        <dl className="kv">
          <div>
            <dt>Dominio con acceso</dt>
            <dd>{config.ong.dominio || '—'}</dd>
          </div>
          <div>
            <dt>Buzón de proyectos</dt>
            <dd>{config.ong.correoProyectos || '—'}</dd>
          </div>
          <div>
            <dt>Dirección de la app</dt>
            <dd>{config.appUrl}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
