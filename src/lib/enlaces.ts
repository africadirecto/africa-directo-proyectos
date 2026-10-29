// Enlaces sin cuenta para las contrapartes.
//
// El token es "<id>.<firma>", donde la firma es un HMAC del id con ENLACES_SECRETO.
// La base de datos guarda solo el id (con proyecto, caducidad y revocación), nunca
// el token: quien lea la base de datos no puede fabricar enlaces sin el secreto,
// y la app puede volver a mostrar el enlace para reenviarlo. Cambiar el secreto
// invalida todos los enlaces a la vez.

import crypto from 'node:crypto';
import { config } from './config';

const LARGO_FIRMA = 22; // 132 bits en base64url

function firmar(texto: string): string {
  if (!config.secretos.enlaces) throw new Error('Falta ENLACES_SECRETO');
  return crypto.createHmac('sha256', config.secretos.enlaces).update(texto).digest('base64url');
}

export function nuevoIdEnlace(): string {
  return crypto.randomBytes(12).toString('base64url');
}

export function tokenDe(id: string): string {
  return `${id}.${firmar(`enlace:${id}`).slice(0, LARGO_FIRMA)}`;
}

/** Devuelve el id si el token es auténtico, o null. Comparación en tiempo constante. */
export function idDeToken(token: string): string | null {
  const [id, firma] = token.split('.');
  if (!id || !firma || id.length > 40) return null;
  const esperada = Buffer.from(firmar(`enlace:${id}`).slice(0, LARGO_FIRMA));
  const recibida = Buffer.from(firma);
  return recibida.length === esperada.length && crypto.timingSafeEqual(recibida, esperada) ? id : null;
}

export function urlFormulario(id: string, base = config.appUrl): string {
  return `${base.replace(/\/$/, '')}/f/${tokenDe(id)}`;
}

/** Firma de una sesión de subida, para que el servidor solo reenvíe trozos a sesiones que él abrió. */
export function firmaSubida(idEnlace: string, url: string): string {
  return firmar(`subida:${idEnlace}:${url}`);
}

export function comprobarFirmaSubida(idEnlace: string, url: string, firma: string): boolean {
  const a = Buffer.from(firmaSubida(idEnlace, url));
  const b = Buffer.from(firma);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
