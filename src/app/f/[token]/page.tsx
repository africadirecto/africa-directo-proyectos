// Formulario de solicitud para la contraparte: sin cuenta, en su idioma y ligero
// para conexiones lentas (una sola pieza de JavaScript, sin librerías externas).

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { abrirEnlace, formularioEditable, leerBorrador, listarVersiones, marcarAbierto } from '@/lib/dominio/solicitudes';
import { leerContraparte } from '@/lib/dominio/contrapartes';
import { VACIAS } from '@/lib/formulario/respuestas';
import { esIdioma, IDIOMAS, SECTORES, TEXTOS } from '@/lib/formulario/textos';
import { MONEDA_DE_PAIS } from '@/lib/paises';
import { tiposDeCambio } from '@/lib/cambio';
import type { Idioma, RespuestasSolicitud } from '@/lib/tipos';
import { FormularioSolicitud } from './FormularioSolicitud';

export const metadata: Metadata = {
  title: { absolute: 'Africa Directo' },
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

async function idiomaNavegador(): Promise<Idioma> {
  const cabecera = (await headers()).get('accept-language') ?? '';
  const preferido = cabecera.split(',').map((s) => s.trim().slice(0, 2).toLowerCase()).find(esIdioma);
  return preferido ?? 'fr';
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="form-publico">
      <div className="marca">
        <img src="/logo-africadirecto.png" alt="Africa Directo" />
        <span className="lema">
          el 100 %<br />
          llega
        </span>
      </div>
      {children}
    </main>
  );
}

export default async function Formulario({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const { lang } = await searchParams;
  const acceso = await abrirEnlace(token);

  if (!acceso) {
    const t = TEXTOS[esIdioma(lang) ? lang : await idiomaNavegador()];
    return (
      <Marco>
        <h1>{t.noValido_t}</h1>
        <p className="p">{t.noValido_p}</p>
      </Marco>
    );
  }

  const p = acceso.proyecto;
  const borrador = await leerBorrador(p.codigo);
  const idioma: Idioma = esIdioma(lang) ? lang : (borrador?.idioma ?? p.contraparte.idioma);
  const t = TEXTOS[idioma];

  if (!formularioEditable(p)) {
    const cerrado = ['rechazada', 'cancelado', 'cerrado'].includes(p.estado);
    return (
      <Marco>
        <h1>{cerrado ? t.cerrado_t : t.enviado_t}</h1>
        <p className="p">{cerrado ? t.cerrado_p : t.enviado_p}</p>
      </Marco>
    );
  }

  await marcarAbierto(p);

  // Punto de partida: el borrador, o la última versión enviada (si piden cambios), o los datos de la contraparte.
  let inicial: RespuestasSolicitud;
  if (borrador?.respuestas && Object.keys(borrador.respuestas).length) {
    inicial = { ...VACIAS, ...borrador.respuestas };
  } else {
    const ultima = (await listarVersiones(p.codigo))[0];
    const c = await leerContraparte(p.contraparte.id);
    inicial = ultima?.respuestas ?? {
      ...VACIAS,
      organizacion: c?.nombre ?? p.contraparte.nombre,
      contactoNombre: c?.contactoNombre ?? '',
      contactoCorreo: c?.correos[0] ?? '',
      contactoTelefono: c?.telefono ?? '',
      titulo: '',
      sector: p.sector,
      pais: p.pais,
      moneda: MONEDA_DE_PAIS[p.pais] ?? VACIAS.moneda,
    };
  }

  return (
    <Marco>
      <FormularioSolicitud
        token={token}
        idioma={idioma}
        idiomas={IDIOMAS}
        textos={t}
        inicial={inicial}
        actualizado={borrador?.actualizado ?? ''}
        archivosIniciales={borrador?.archivos ?? []}
        sectores={Object.fromEntries(Object.entries(SECTORES).map(([k, v]) => [k, v[idioma]]))}
        cambio={await tiposDeCambio()}
        cambios={p.formulario.estado === 'cambios' ? (p.formulario.comentarios?.traducido || p.formulario.comentarios?.es || '') : ''}
      />
    </Marco>
  );
}
