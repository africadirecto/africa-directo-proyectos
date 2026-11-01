// Iconos de marca que se usan en botones. Son decorativos: el texto del botón dice qué hace.

/** Logotipo de Google Drive. */
export function LogoDrive({ tamano = 18 }: { tamano?: number }) {
  return (
    <svg className="logo-drive" width={tamano} height={Math.round((tamano * 78) / 87.3)} viewBox="0 0 87.3 78" aria-hidden="true">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  );
}

/** Logotipo de Google Docs (para los informes). */
export function LogoDocs({ tamano = 18 }: { tamano?: number }) {
  return (
    <svg width={Math.round((tamano * 3) / 4)} height={tamano} viewBox="0 0 48 64" aria-hidden="true" style={{ flex: 'none' }}>
      <path d="M29.4 0H4.4A4.4 4.4 0 0 0 0 4.4v55.2A4.4 4.4 0 0 0 4.4 64h39.2a4.4 4.4 0 0 0 4.4-4.4V18.6L35.7 12.1z" fill="#4285f4" />
      <path d="M29.4 0v14.2a4.4 4.4 0 0 0 4.4 4.4H48z" fill="#a1c2fa" />
      <path d="M11 30h26v3.2H11zm0 7.3h26v3.2H11zm0 7.3h26v3.2H11zm0 7.3h18v3.2H11z" fill="#f1f1f1" />
    </svg>
  );
}

/** Logotipo de Google Slides (para las presentaciones). */
export function LogoSlides({ tamano = 18 }: { tamano?: number }) {
  return (
    <svg width={Math.round((tamano * 3) / 4)} height={tamano} viewBox="0 0 48 64" aria-hidden="true" style={{ flex: 'none' }}>
      <path d="M29.4 0H4.4A4.4 4.4 0 0 0 0 4.4v55.2A4.4 4.4 0 0 0 4.4 64h39.2a4.4 4.4 0 0 0 4.4-4.4V18.6L35.7 12.1z" fill="#f4b400" />
      <path d="M29.4 0v14.2a4.4 4.4 0 0 0 4.4 4.4H48z" fill="#fad165" />
      <rect x="11" y="30" width="26" height="20" rx="1.5" fill="none" stroke="#fff" strokeWidth="3.2" />
    </svg>
  );
}

/** Logotipo de Google Sheets (para los libros de análisis). */
export function LogoSheets({ tamano = 18 }: { tamano?: number }) {
  return (
    <svg width={Math.round((tamano * 3) / 4)} height={tamano} viewBox="0 0 48 64" aria-hidden="true" style={{ flex: 'none' }}>
      <path d="M29.4 0H4.4A4.4 4.4 0 0 0 0 4.4v55.2A4.4 4.4 0 0 0 4.4 64h39.2a4.4 4.4 0 0 0 4.4-4.4V18.6L35.7 12.1z" fill="#0f9d58" />
      <path d="M29.4 0v14.2a4.4 4.4 0 0 0 4.4 4.4H48z" fill="#87ceac" />
      <path d="M11 30h26v22H11zm3 3v4h8v-4zm11 0v4h9v-4zm-11 7v4h8v-4zm11 0v4h9v-4zm-11 7v2h8v-2zm11 0v2h9v-2z" fill="#f1f1f1" fillRule="evenodd" />
    </svg>
  );
}

// Iconos de línea (del juego Tabler, licencia MIT) para los botones de la financiación.
function Linea({ tamano, children }: { tamano: number; children: React.ReactNode }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
      {children}
    </svg>
  );
}

/** Compromiso de un donante: un acuerdo firmado. */
export function IconoCompromiso({ tamano = 16 }: { tamano?: number }) {
  return (
    <Linea tamano={tamano}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
      <path d="m9 14 2 2 4-4" />
    </Linea>
  );
}

/** Cobro: dinero que entra en Africa Directo. */
export function IconoCobro({ tamano = 16 }: { tamano?: number }) {
  return (
    <Linea tamano={tamano}>
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      <path d="m7 11 5 5 5-5" />
      <path d="M12 4v12" />
    </Linea>
  );
}

/** Envío: dinero que sale hacia la contraparte. */
export function IconoEnvio({ tamano = 16 }: { tamano?: number }) {
  return (
    <Linea tamano={tamano}>
      <path d="M10 14 21 3" />
      <path d="m21 3-6.5 18a.55.55 0 0 1-1 0L10 14l-7-3.5a.55.55 0 0 1 0-1z" />
    </Linea>
  );
}

/** Marca de «hecho». */
export function IconoHecho({ tamano = 16 }: { tamano?: number }) {
  return (
    <Linea tamano={tamano}>
      <path d="m5 12 5 5L20 7" />
    </Linea>
  );
}
