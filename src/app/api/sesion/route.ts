// Recibe el token de Google (Firebase) tras entrar y abre la sesión con cookie.

import { NextResponse } from 'next/server';
import { iniciarSesion, SinPermiso } from '@/lib/sesion';
import { dentroDelLimite, ipDe } from '@/lib/limites';

export async function POST(req: Request) {
  if (!dentroDelLimite(`sesion:${ipDe(req)}`, 20)) {
    return NextResponse.json({ error: 'Demasiados intentos. Espera un minuto.' }, { status: 429 });
  }
  try {
    const { idToken } = (await req.json()) as { idToken?: string };
    if (!idToken) return NextResponse.json({ error: 'Falta el token' }, { status: 400 });
    const u = await iniciarSesion(idToken);
    return NextResponse.json({ estado: u.estado });
  } catch (e) {
    const mensaje = e instanceof SinPermiso ? e.message : 'No se pudo iniciar sesión.';
    if (!(e instanceof SinPermiso)) console.error(e);
    return NextResponse.json({ error: mensaje }, { status: 403 });
  }
}
