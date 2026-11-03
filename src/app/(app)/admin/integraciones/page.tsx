import type { Metadata } from 'next';
import Link from 'next/link';
import { requiere } from '@/lib/sesion';
import { config, estadoIntegraciones, modoDemo } from '@/lib/config';
import { ajustesIa } from '@/lib/ia/ajustes';

export const metadata: Metadata = { title: 'Integraciones' };

const NOMBRES: Record<keyof ReturnType<typeof estadoIntegraciones>, [string, string]> = {
  firestore: ['Base de datos (Firestore)', 'FIREBASE_PROJECT_ID y la cuenta de servicio'],
  drive: ['Carpetas en Drive', 'DRIVE_UNIDAD_PROYECTOS_ID'],
  login: ['Entrar con Google', 'NEXT_PUBLIC_FIREBASE_* y ONG_DOMINIO'],
  ia: ['IA: traducir, resumir y redactar informes (OpenRouter)', 'OPENROUTER_API_KEY o la clave guardada en'],
  chat: ['Avisos en Google Chat', 'GOOGLE_CHAT_WEBHOOK_URL'],
  copia: ['Copia nocturna', 'DRIVE_UNIDAD_SISTEMA_ID y CRON_SECRET'],
};

const ESTADO = {
  ok: ['Configurado', '#1D6B50'],
  demo: ['Modo demo', '#7A4B00'],
  falta: ['Sin configurar', '#B42318'],
} as const;

export default async function Integraciones() {
  await requiere('admin');
  const ia = await ajustesIa();
  // La clave de la IA también puede estar guardada en la app (Ajustes de IA).
  const integraciones = { ...estadoIntegraciones(), ia: ia.clave ? 'ok' : modoDemo ? 'demo' : 'falta' } as const;

  return (
    <>
      <h1>Integraciones</h1>
      <section className="card">
        <h2 className="h2" style={{ marginBottom: 4 }}>
          Servicios conectados
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
                  {k === 'ia' ? (
                    <>
                      {' '}
                      <Link href="/admin/ia">Ajustes de IA</Link>
                    </>
                  ) : null}
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
