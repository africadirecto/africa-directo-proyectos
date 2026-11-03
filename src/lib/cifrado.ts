// Cifrado de los secretos que se guardan en la base de datos (las claves de la IA que se
// escriben en Administración › Ajustes de IA). AES-256-GCM con una llave derivada de
// ENLACES_SECRETO: quien lea la base de datos sin esa variable no puede usarlas.
// Si ENLACES_SECRETO cambia, las claves guardadas dejan de poder leerse y hay que volver a escribirlas.

import crypto from 'node:crypto';
import { config } from './config';

export interface Cifrado {
  iv: string;
  dato: string;
  etiqueta: string;
}

function llave(): Buffer {
  if (!config.secretos.enlaces) throw new Error('Falta ENLACES_SECRETO: sin él no se pueden guardar claves en la app.');
  return Buffer.from(crypto.hkdfSync('sha256', config.secretos.enlaces, '', 'africadirecto/ajustes', 32));
}

export function cifrar(texto: string): Cifrado {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', llave(), iv);
  const dato = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return { iv: iv.toString('base64'), dato: dato.toString('base64'), etiqueta: c.getAuthTag().toString('base64') };
}

/** El texto, o null si no se puede descifrar (p. ej. porque cambió ENLACES_SECRETO). */
export function descifrar(c: Cifrado): string | null {
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', llave(), Buffer.from(c.iv, 'base64'));
    d.setAuthTag(Buffer.from(c.etiqueta, 'base64'));
    return Buffer.concat([d.update(Buffer.from(c.dato, 'base64')), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}
