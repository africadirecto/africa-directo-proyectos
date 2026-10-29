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
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4h4" />
        </svg>
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
