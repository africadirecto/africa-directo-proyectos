// Respuestas de una versión de la solicitud: en español (traducción de la IA si
// la hay) con el original debajo, y los archivos que subió la contraparte.

import { drive } from '@/lib/drive';
import { dinero, fechaLarga, tamanoArchivo } from '@/lib/formato';
import { nombrePais } from '@/lib/paises';
import { IDIOMAS_ES, nombreSector } from '@/lib/formulario/textos';
import { totalPresupuesto } from '@/lib/formulario/respuestas';
import type { VersionSolicitud } from '@/lib/tipos';

function Campo({ titulo, valor, traduccion }: { titulo: string; valor?: string | number | null; traduccion?: string }) {
  if (valor == null || valor === '') return null;
  const hayTraduccion = traduccion && traduccion !== valor;
  return (
    <div>
      <dt>{titulo}</dt>
      <dd>
        {hayTraduccion ? traduccion : valor}
        {hayTraduccion ? <span className="original">Original: {valor}</span> : null}
      </dd>
    </div>
  );
}

export async function VistaSolicitud({ v, mostrarContacto = true }: { v: VersionSolicitud; mostrarContacto?: boolean }) {
  const d = await drive();
  const r = v.respuestas;
  const t = v.analisis?.traduccion ?? null;
  const lineas = r.lineas.filter((l) => l.concepto || l.importe);

  return (
    <div className="pila" style={{ gap: 16 }}>
      <p className="meta" style={{ margin: 0 }}>
        Versión {v.version} · enviada el {fechaLarga(v.enviada)} · en {IDIOMAS_ES[v.idioma].toLowerCase()}
        {t ? ' · traducida por IA' : ''}
        {v.pdf ? (
          <>
            {' · '}
            <a href={d.urlArchivo(v.pdf.id)} target="_blank" rel="noreferrer">
              PDF de la solicitud ↗
            </a>
          </>
        ) : null}
      </p>
      <dl className="respuestas">
        <Campo titulo="Título" valor={r.titulo} traduccion={t?.titulo} />
        <Campo titulo="Tipo de proyecto" valor={nombreSector(r.sector)} />
        <Campo titulo="Lugar" valor={[r.lugar, nombrePais(r.pais)].filter(Boolean).join(', ')} />
        <Campo titulo="Cómo llegar" valor={r.indicaciones} traduccion={t?.indicaciones} />
        <Campo titulo="Coordenadas" valor={r.lat != null ? `${r.lat.toFixed(4)}, ${r.lng?.toFixed(4)}` : null} />
        <Campo titulo="¿Qué necesitáis y por qué?" valor={r.necesidad} traduccion={t?.necesidad} />
        <Campo titulo="¿Quiénes se benefician?" valor={r.beneficiarios} traduccion={t?.beneficiarios} />
        <Campo titulo="Número de beneficiarios" valor={r.numBeneficiarios} />
        <Campo titulo="Plazo previsto" valor={r.plazoMeses ? `${r.plazoMeses} meses` : null} />
        <Campo titulo="¿Qué aportáis vosotros?" valor={r.aportacionLocal} traduccion={t?.aportacionLocal} />
        <div>
          <dt>Presupuesto</dt>
          <dd>
            {lineas.length ? (
              <table className="tbl" style={{ marginTop: 4 }}>
                <tbody>
                  {lineas.map((l, i) => (
                    <tr key={i}>
                      <td style={{ padding: '6px 0' }}>
                        {t?.conceptos[i] && t.conceptos[i] !== l.concepto ? t.conceptos[i] : l.concepto || '—'}
                        {t?.conceptos[i] && t.conceptos[i] !== l.concepto ? <span className="original">{l.concepto}</span> : null}
                      </td>
                      <td className="der" style={{ padding: '6px 0' }}>
                        {dinero(l.importe, r.moneda)}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ padding: '6px 0', fontWeight: 700 }}>Total</td>
                    <td className="der" style={{ padding: '6px 0', fontWeight: 700 }}>
                      {dinero(totalPresupuesto(r.lineas), r.moneda)}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              '—'
            )}
          </dd>
        </div>
        {mostrarContacto ? (
          <Campo
            titulo="Organización y contacto"
            valor={[r.organizacion, [r.contactoNombre, r.contactoCargo].filter(Boolean).join(', '), r.contactoCorreo, r.contactoTelefono].filter(Boolean).join(' · ')}
          />
        ) : null}
      </dl>
      <div className="pila" style={{ gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Documentos y fotos</h3>
        {v.archivos.length ? (
          <div className="docs">
            {v.archivos.map((a) => (
              <a key={a.id} href={d.urlArchivo(a.id)} target="_blank" rel="noreferrer">
                {a.nombre} ↗ <span className="meta">({tamanoArchivo(a.tamano)})</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="meta" style={{ margin: 0 }}>
            No ha subido archivos.
          </p>
        )}
      </div>
    </div>
  );
}
