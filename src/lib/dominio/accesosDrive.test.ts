import { describe, expect, it } from 'vitest';
import { cambioDeMiembro, rolEnDrive } from './accesosDrive';
import type { MiembroUnidad, RolUnidad } from '../drive/tipos';

const miembro = (rol: RolUnidad): MiembroUnidad => ({ id: 'p1', tipo: 'user', email: 'ana@ong.org', rol });

describe('rolEnDrive', () => {
  it('traduce el permiso de la app al rol de las unidades de trabajo', () => {
    expect(rolEnDrive({ permiso: 'lectura', estado: 'activo' }, false)).toBe('reader');
    expect(rolEnDrive({ permiso: 'edicion', estado: 'activo' }, false)).toBe('writer');
    expect(rolEnDrive({ permiso: 'admin', estado: 'activo' }, false)).toBe('fileOrganizer');
  });

  it('en la unidad Sistema solo entra administración', () => {
    expect(rolEnDrive({ permiso: 'edicion', estado: 'activo' }, true)).toBeNull();
    expect(rolEnDrive({ permiso: 'admin', estado: 'activo' }, true)).toBe('fileOrganizer');
  });

  it('sin acceso a la app, sin acceso a Drive', () => {
    expect(rolEnDrive({ permiso: 'admin', estado: 'rechazado' }, false)).toBeNull();
  });
});

describe('cambioDeMiembro', () => {
  it('añade, cambia o quita según lo que ya haya', () => {
    expect(cambioDeMiembro('writer', undefined)).toBe('anadir');
    expect(cambioDeMiembro('writer', miembro('reader'))).toBe('cambiar');
    expect(cambioDeMiembro('writer', miembro('writer'))).toBe('nada');
    expect(cambioDeMiembro(null, miembro('writer'))).toBe('quitar');
    expect(cambioDeMiembro(null, undefined)).toBe('nada');
  });

  it('a un Gestor de la unidad no se le baja ni se le quita', () => {
    expect(cambioDeMiembro('reader', miembro('organizer'))).toBe('nada');
    expect(cambioDeMiembro(null, miembro('organizer'))).toBe('nada');
  });
});
