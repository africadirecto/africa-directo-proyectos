'use client';

// Entrar con Google mediante Firebase Auth. El token se manda al servidor, que
// comprueba el dominio de la ONG y abre la sesión con una cookie.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function BotonGoogle({ dominio }: { dominio: string }) {
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  const entrar = async () => {
    setError('');
    setCargando(true);
    try {
      const { initializeApp, getApps } = await import('firebase/app');
      const { getAuth, GoogleAuthProvider, signInWithPopup, signOut } = await import('firebase/auth');
      const app =
        getApps()[0] ??
        initializeApp({
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
      const auth = getAuth(app);
      const proveedor = new GoogleAuthProvider();
      proveedor.setCustomParameters({ hd: dominio, prompt: 'select_account' });
      const cred = await signInWithPopup(auth, proveedor);
      const idToken = await cred.user.getIdToken();
      const res = await fetch('/api/sesion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      // La sesión vive en la cookie del servidor; en el navegador no hace falta.
      await signOut(auth);
      const datos = (await res.json()) as { estado?: string; error?: string };
      if (!res.ok) throw new Error(datos.error ?? 'No se pudo entrar.');
      router.replace(datos.estado === 'activo' ? '/' : '/acceso');
      router.refresh();
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : '';
      setError(
        mensaje.includes('popup-closed')
          ? 'Has cerrado la ventana de Google.'
          : mensaje.includes('popup-blocked')
            ? 'Tu navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes para esta página y vuelve a pulsar el botón.'
            : mensaje || 'No se pudo entrar.',
      );
      setCargando(false);
    }
  };

  return (
    <div className="pila">
      <button type="button" className="btn btn-p" onClick={entrar} disabled={cargando}>
        {/* Logotipo «G» de Google, sobre fondo blanco como piden sus normas de marca. */}
        <span className="logo-google" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
        </span>
        {cargando ? 'Entrando…' : 'Entrar con Google'}
      </button>
      {error ? (
        <p role="alert" className="aviso-error" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
