// Lectura centralizada de la configuración (variables de entorno).
// Ver .env.example y docs/DESPLIEGUE.md para el significado de cada una.

function texto(nombre: string): string {
  return (process.env[nombre] ?? '').trim();
}

function lista(nombre: string): string[] {
  return texto(nombre)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const modoDemo = texto('MODO_DEMO') === '1';

if (modoDemo && process.env.VERCEL_ENV === 'production') {
  throw new Error('MODO_DEMO no puede usarse en producción.');
}

export const config = {
  modoDemo,
  appUrl: texto('APP_URL') || 'http://localhost:3000',
  ong: {
    dominio: texto('ONG_DOMINIO').toLowerCase(),
    adminsIniciales: lista('ONG_ADMINS_INICIALES'),
    correoProyectos: texto('CORREO_PROYECTOS'),
  },
  google: {
    proyectoId: texto('FIREBASE_PROJECT_ID'),
    cuentaServicio: texto('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
    // En Vercel la clave se pega con "\n" literales: se convierten a saltos de línea. Si al
    // importar un .env se quedaron las comillas alrededor, se quitan.
    clavePrivada: texto('GOOGLE_SERVICE_ACCOUNT_KEY')
      .replace(/^"([\s\S]*)"$/, '$1')
      .replace(/\\n/g, '\n'),
  },
  drive: {
    unidadProyectos: texto('DRIVE_UNIDAD_PROYECTOS_ID'),
    unidadSistema: texto('DRIVE_UNIDAD_SISTEMA_ID'),
    // Opcional: usuario de Workspace al que suplanta la cuenta de servicio (delegación de dominio).
    usuario: texto('GOOGLE_DRIVE_USUARIO').toLowerCase(),
  },
  secretos: {
    enlaces: texto('ENLACES_SECRETO') || (modoDemo ? 'secreto-de-demostracion-enlaces' : ''),
    sesionDemo: texto('SESION_SECRETO') || 'secreto-de-demostracion-sesion',
    cron: texto('CRON_SECRET'),
  },
  ia: {
    openaiClave: texto('OPENAI_API_KEY'),
    modeloRapido: texto('OPENAI_MODELO_RAPIDO') || 'gpt-5-mini',
    modeloRedaccion: texto('OPENAI_MODELO_REDACCION') || 'gpt-5',
  },
  avisos: {
    chatWebhook: texto('GOOGLE_CHAT_WEBHOOK_URL'),
  },
};

/** Qué integraciones están configuradas (se muestra en Administración › Ajustes). */
export function estadoIntegraciones() {
  return {
    firestore: modoDemo ? 'demo' : config.google.proyectoId && config.google.clavePrivada ? 'ok' : 'falta',
    drive: modoDemo ? 'demo' : config.drive.unidadProyectos ? 'ok' : 'falta',
    login: modoDemo ? 'demo' : process.env.NEXT_PUBLIC_FIREBASE_API_KEY && config.ong.dominio ? 'ok' : 'falta',
    ia: config.ia.openaiClave ? 'ok' : modoDemo ? 'demo' : 'falta',
    chat: config.avisos.chatWebhook ? 'ok' : 'falta',
    copia: modoDemo ? 'demo' : config.drive.unidadSistema && config.secretos.cron ? 'ok' : 'falta',
  } as const;
}

/** Comprueba al arrancar que no falta nada imprescindible fuera del modo demo. */
export function comprobarConfig(): string[] {
  if (modoDemo) return [];
  const faltan: string[] = [];
  if (!config.google.proyectoId) faltan.push('FIREBASE_PROJECT_ID');
  if (!config.google.cuentaServicio) faltan.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  if (!config.google.clavePrivada) faltan.push('GOOGLE_SERVICE_ACCOUNT_KEY');
  if (!config.ong.dominio) faltan.push('ONG_DOMINIO');
  if (!config.secretos.enlaces) faltan.push('ENLACES_SECRETO');
  if (!config.drive.unidadProyectos) faltan.push('DRIVE_UNIDAD_PROYECTOS_ID');
  return faltan;
}
