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

/**
 * Token que caduca solo, sin guardar nada en la base de datos: «<datos>.<caducidad>.<firma>».
 * Sirve para direcciones de un solo uso, como las fotos que Google descarga al hacer un informe.
 */
export function tokenTemporal(datos: string, minutos: number, ahora = Date.now()): string {
  const d = Buffer.from(datos).toString('base64url');
  const caduca = Math.floor(ahora / 1000 + minutos * 60).toString(36);
  return `${d}.${caduca}.${firmar(`temporal:${d}.${caduca}`).slice(0, LARGO_FIRMA)}`;
}

/** Los datos de un token temporal si es auténtico y no ha caducado, o null. */
export function leerTokenTemporal(token: string, ahora = Date.now()): string | null {
  const [d, caduca, firma] = token.split('.');
  if (!d || !caduca || !firma || d.length > 200) return null;
  const esperada = Buffer.from(firmar(`temporal:${d}.${caduca}`).slice(0, LARGO_FIRMA));
  const recibida = Buffer.from(firma);
  if (recibida.length !== esperada.length || !crypto.timingSafeEqual(recibida, esperada)) return null;
  if (parseInt(caduca, 36) * 1000 < ahora) return null;
  return Buffer.from(d, 'base64url').toString();
}

/** Dirección pública y temporal de una foto publicable de un proyecto (ver /api/foto). */
export function urlFoto(codigo: string, archivoId: string, minutos = 30, base = config.appUrl): string {
  return `${base.replace(/\/$/, '')}/api/foto/${tokenTemporal(`foto:${codigo}:${archivoId}`, minutos)}`;
}
