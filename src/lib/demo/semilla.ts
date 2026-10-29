// Datos de ejemplo para el modo demo (MODO_DEMO=1). Se crean la primera vez que
// se abre la pantalla de acceso. Para empezar de cero, borra la carpeta .datos.

import { almacen } from '../almacen';
import { modoDemo } from '../config';
import { drive } from '../drive';
import { reconstruirIndice } from '../dominio/indice';
import { asegurarCarpetas } from '../dominio/proyectos';
import { totales } from '../dominio/aportaciones';
import { nuevoIdEnlace } from '../enlaces';
import { avisosAutomaticos } from '../formulario/respuestas';
import type {
  Aportacion,
  Contraparte,
  Donante,
  Enlace,
  EstadoProyecto,
  Evento,
  Idioma,
  Proyecto,
  RespuestasSolicitud,
  Usuario,
  VersionSolicitud,
} from '../tipos';

export const USUARIOS_DEMO = [
  { email: 'ana.lopez@demo.africadirecto', nombre: 'Ana López', etiqueta: 'Administración' },
  { email: 'luis.gomez@demo.africadirecto', nombre: 'Luis Gómez', etiqueta: 'Edición' },
  { email: 'elena.vidal@demo.africadirecto', nombre: 'Elena Vidal', etiqueta: 'Lectura' },
  { email: 'pablo.ruiz@demo.africadirecto', nombre: 'Pablo Ruiz', etiqueta: 'Persona nueva' },
];

const DIA = 86_400_000;
const hace = (dias: number) => new Date(Date.now() - dias * DIA).toISOString();
const ana = { id: 'ana.lopez@demo.africadirecto', nombre: 'Ana López' };
const luis = { id: 'luis.gomez@demo.africadirecto', nombre: 'Luis Gómez' };

let enMarcha: Promise<void> | null = null;

export function asegurarDemo(): Promise<void> {
  if (!modoDemo) return Promise.resolve();
  enMarcha ??= sembrar().catch((e) => {
    enMarcha = null;
    throw e;
  });
  return enMarcha;
}

async function sembrar() {
  const db = await almacen();
  if (await db.leer('usuarios/ana.lopez@demo.africadirecto')) return;

  const usuarios: Usuario[] = [
    { email: ana.id, nombre: ana.nombre, permiso: 'admin', estado: 'activo', creado: hace(400), ultimoAcceso: hace(0) },
    { email: luis.id, nombre: luis.nombre, permiso: 'edicion', estado: 'activo', creado: hace(300), ultimoAcceso: hace(1) },
    { email: 'elena.vidal@demo.africadirecto', nombre: 'Elena Vidal', permiso: 'lectura', estado: 'activo', creado: hace(200), ultimoAcceso: hace(57) },
    { email: 'marta.sanz@demo.africadirecto', nombre: 'Marta Sanz', permiso: 'lectura', estado: 'pendiente', creado: hace(2), ultimoAcceso: hace(2) },
  ];
  for (const u of usuarios) await db.guardar(`usuarios/${u.email}`, { ...u });

  const contrapartes: Record<string, Contraparte> = {
    kinshasa: cp('Sœurs de la Charité de Kinshasa', 'Congregación religiosa', 'CD', 'Sœur Marie', 'fr'),
    bukavu: cp('Diocèse de Bukavu', 'Diócesis', 'CD', 'Abbé Jean', 'fr'),
    bamenda: cp('Mission Sisters of Bamenda', 'Congregación religiosa', 'CM', 'Sister Grace', 'en'),
    kara: cp('Diocèse de Kara', 'Diócesis', 'TG', 'Père Paul', 'fr'),
    meru: cp('Consolata Sisters Meru', 'Congregación religiosa', 'KE', 'Sister Agnes', 'en'),
    uagadugu: cp("Sœurs de l'Immaculée Conception", 'Congregación religiosa', 'BF', 'Sœur Bernadette', 'fr'),
    adis: cp('Daughters of Charity Addis Ababa', 'Congregación religiosa', 'ET', 'Sister Tsehay', 'en'),
    lilongwe: cp('Malawi Tailoring Cooperative', 'Asociación local', 'MW', 'Mrs. Banda', 'en'),
    beira: cp('Irmãs Franciscanas da Beira', 'Congregación religiosa', 'MZ', 'Irmã Ana', 'pt'),
    mwanza: cp('Mwanza Parish Health Committee', 'Parroquia', 'TZ', 'Fr. Joseph', 'en'),
  };
  for (const [id, c] of Object.entries(contrapartes)) await db.guardar(`contrapartes/${id}`, { ...c });

  const donantes: Record<string, Donante> = {
    horizonte: dn('Fundación Horizonte', 'fundacion', 'Informe intermedio y final con su plantilla (Word).'),
    aguaviva: dn('Fundación Agua Viva', 'fundacion', 'Informe final con la plantilla de la ONG.'),
    solar: dn('Solar Ibérica, S. A.', 'empresa', 'Informe final y fotos publicables.'),
    ayto: dn('Ayuntamiento de Villaejemplo', 'publica', 'Justificación económica y memoria final (su plantilla).'),
    particular: dn('Donaciones particulares', 'particular', ''),
  };
  for (const [id, d] of Object.entries(donantes)) await db.guardar(`donantes/${id}`, { ...d });

  const proyectos: Proyecto[] = [
    py('P-2026-014', 'Aula escuela primaria', 'educacion', 'kinshasa', 'Kinshasa', -4.33, 15.31, 'ejecucion', 18000, 5, 150, {
      descripcion: 'Construcción de un aula nueva para la escuela primaria, que hoy da clase en dos turnos por falta de espacio. Incluye mobiliario para 45 alumnos.',
      beneficiarios: '45 alumnos de 3.º y 4.º curso',
      inicio: hace(87),
      finPrevisto: new Date(Date.now() + 47 * DIA).toISOString(),
    }),
    py('P-2026-006', 'Placas solares del hospital', 'energia', 'bukavu', 'Bukavu', -2.51, 28.86, 'parado', 31000, 47, 260, {
      descripcion: 'Instalación fotovoltaica para garantizar la electricidad del quirófano y la cadena de frío de las vacunas.',
      inicio: hace(120),
    }),
    py('P-2026-009', 'Paritorio del dispensario', 'salud', 'bamenda', 'Bamenda', 5.96, 10.15, 'aprobado', 24000, 42, 200, {
      descripcion: 'Ampliación del dispensario con una sala de partos equipada.',
    }),
    py('P-2026-011', 'Pozo y depósito de agua', 'agua', 'kara', 'Kara', 9.55, 1.19, 'financiacion', 9500, 9, 90, {
      descripcion: 'Pozo de 60 m con bomba solar y depósito elevado de 10 m³ para el barrio y la escuela.',
    }),
    py('P-2026-015', 'Dormitorio del internado', 'educacion', 'meru', 'Meru', 0.05, 37.65, 'validada', 21000, 7, 60, {
      descripcion: 'Dormitorio para 40 alumnas internas que hoy duermen en las aulas.',
    }),
    py('P-2026-017', 'Comedor escolar', 'educacion', 'uagadugu', 'Uagadugú', 12.37, -1.52, 'revision', 12300, 2, 20, {}),
    py('P-2026-018', '', 'educacion', 'adis', '', null, null, 'solicitud', null, 1, 1, {}),
    py('P-2026-016', 'Centro de salud rural', 'salud', 'mwanza', 'Mwanza', -2.52, 32.9, 'solicitud', 15400, 9, 40, {}),
    py('P-2026-003', 'Taller de costura', 'formacion', 'lilongwe', 'Lilongüe', -13.96, 33.79, 'completado', 6800, 27, 330, {
      descripcion: 'Taller con 12 máquinas de coser y formación para 30 mujeres.',
      inicio: hace(250),
    }),
    py('P-2025-021', 'Biblioteca escolar', 'educacion', 'beira', 'Beira', -19.84, 34.84, 'cerrado', 8200, 106, 500, {
      descripcion: 'Biblioteca con 2.000 libros en portugués para la escuela secundaria.',
      inicio: hace(420),
    }),
  ];

  const aportaciones: Omit<Aportacion, 'proyectoTitulo' | 'creado' | 'actualizado' | 'actualizadoPor' | 'donanteNombre' | 'moneda' | 'importeProyecto' | 'notas'>[] = [
    { proyecto: 'P-2026-014', donanteId: 'horizonte', importe: 12000, estado: 'comprometida' },
    { proyecto: 'P-2026-014', donanteId: 'aguaviva', importe: 6000, estado: 'recibida' },
    { proyecto: 'P-2026-006', donanteId: 'solar', importe: 25000, estado: 'recibida' },
    { proyecto: 'P-2026-006', donanteId: 'particular', importe: 6000, estado: 'recibida' },
    { proyecto: 'P-2026-009', donanteId: 'ayto', importe: 24000, estado: 'comprometida' },
    { proyecto: 'P-2026-011', donanteId: 'aguaviva', importe: 3800, estado: 'comprometida' },
    { proyecto: 'P-2026-011', donanteId: 'horizonte', importe: 5700, estado: 'interesado' },
    { proyecto: 'P-2026-003', donanteId: 'particular', importe: 6800, estado: 'recibida' },
    { proyecto: 'P-2025-021', donanteId: 'horizonte', importe: 8200, estado: 'recibida' },
  ];
  for (const [i, a] of aportaciones.entries()) {
    const p = proyectos.find((x) => x.codigo === a.proyecto)!;
    await db.guardar(`aportaciones/demo${i}`, {
      ...a,
      proyectoTitulo: p.titulo,
      donanteNombre: donantes[a.donanteId].nombre,
      moneda: 'EUR',
      importeProyecto: a.importe,
      notas: '',
      creado: hace(60),
      actualizado: hace(30),
      actualizadoPor: ana,
    } satisfies Aportacion);
  }

  for (const p of proyectos) {
    const t = totales(aportaciones.filter((a) => a.proyecto === p.codigo).map((a) => ({ ...a, importeProyecto: a.importe })));
    Object.assign(p, t);
    const enlace: Enlace = { proyecto: p.codigo, accion: 'solicitud', creado: p.fechas.creado, creadoPor: ana, caduca: new Date(Date.now() + 120 * DIA).toISOString(), revocado: false };
    await db.guardar(`enlaces/${p.formulario.enlaceId}`, { ...enlace });
    await db.guardar(`proyectos/${p.codigo}`, { ...p });
    await asegurarCarpetas(p.codigo);
  }

  await db.guardar('contadores/proyectos-2026', { ultimo: 18 });
  await db.guardar('contadores/proyectos-2025', { ultimo: 21 });

  // Cronología del proyecto principal (como en las maquetas).
  const eventos: [string, Omit<Evento, 'fecha'>, number][] = [
    ['P-2026-014', { tipo: 'correo', categoria: 'avance', autor: null, texto: 'Muros terminados; la cubierta empieza la semana que viene. Llegan 3 fotos de la obra.' }, 5],
    ['P-2026-014', { tipo: 'nota', categoria: 'economico', autor: ana, texto: 'La contraparte confirma la segunda transferencia (6.000 €).' }, 23],
    ['P-2026-014', { tipo: 'estado', autor: luis, de: 'parado', a: 'ejecucion', texto: 'Parado → En ejecución. Se reanuda la obra tras las lluvias.' }, 27],
    ['P-2026-014', { tipo: 'correo', categoria: 'incidencia', autor: null, texto: 'Las lluvias paran la obra y el cemento sube un 15 %.' }, 45],
    ['P-2026-014', { tipo: 'estado', autor: luis, de: 'ejecucion', a: 'parado', texto: 'En ejecución → Parado. Lluvias torrenciales.' }, 45],
    ['P-2026-014', { tipo: 'correo', categoria: 'avance', autor: null, texto: 'Cimientos terminados.' }, 58],
    ['P-2026-014', { tipo: 'estado', autor: ana, de: 'aprobado', a: 'ejecucion', texto: 'Aprobado → En ejecución. Empieza la obra.' }, 87],
    ['P-2026-014', { tipo: 'estado', autor: null, de: 'financiacion', a: 'aprobado', texto: 'Financiación → Aprobado. Financiación cubierta: 18.000 € comprometidos de 18.000 €.' }, 100],
    ['P-2026-014', { tipo: 'estado', autor: luis, de: 'revision', a: 'validada', texto: 'En revisión → Validada. Propuesta validada.' }, 133],
    ['P-2026-006', { tipo: 'estado', autor: ana, de: 'ejecucion', a: 'parado', texto: 'En ejecución → Parado. El proveedor no entrega las baterías.' }, 47],
    ['P-2026-016', { tipo: 'estado', autor: luis, de: 'revision', a: 'solicitud', texto: 'En revisión → Solicitud. Se piden cambios: falta el desglose del presupuesto.' }, 9],
  ];
  for (const [codigo, e, dias] of eventos) await db.crear(`proyectos/${codigo}/eventos`, { ...e, fecha: hace(dias) });

  // Solicitud recibida del comedor escolar, en francés, ya analizada.
  const r: RespuestasSolicitud = {
    organizacion: "Sœurs de l'Immaculée Conception",
    contactoNombre: 'Sœur Bernadette',
    contactoCargo: 'Directrice',
    contactoCorreo: 'uagadugu@example.org',
    contactoTelefono: '',
    titulo: 'Cantine scolaire',
    sector: 'educacion',
    pais: 'BF',
    lugar: 'Ouagadougou',
    indicaciones: 'Quartier Tampouy, derrière la paroisse',
    lat: 12.37,
    lng: -1.52,
    necesidad: "L'école accueille des élèves qui passent toute la journée hors de chez eux. Nous demandons la construction d'une cantine avec une cuisine à bois améliorée et un magasin.",
    beneficiarios: 'Les élèves du primaire et leurs familles.',
    numBeneficiarios: null,
    plazoMeses: 5,
    aportacionLocal: "Le terrain et la main-d'œuvre non qualifiée.",
    moneda: 'EUR',
    lineas: [{ concepto: 'Construction de la cantine', importe: 12300 }],
  };
  const v1: VersionSolicitud = {
    version: 1,
    respuestas: r,
    archivos: [],
    idioma: 'fr',
    enviada: hace(2),
    analisis: {
      tituloEs: 'Comedor escolar',
      resumen: 'La escuela atiende a alumnos que pasan el día fuera de casa. Piden construir un comedor con cocina de leña mejorada y un almacén. La contraparte aporta el terreno y la mano de obra no cualificada.',
      traduccion: {
        titulo: 'Comedor escolar',
        necesidad: 'La escuela acoge a alumnos que pasan todo el día fuera de casa. Pedimos la construcción de un comedor con una cocina de leña mejorada y un almacén.',
        beneficiarios: 'Los alumnos de primaria y sus familias.',
        aportacionLocal: 'El terreno y la mano de obra no cualificada.',
        indicaciones: 'Barrio de Tampouy, detrás de la parroquia',
        conceptos: ['Construcción del comedor'],
      },
      falta: [...avisosAutomaticos(r, []), 'No explica cómo se pagarán los alimentos y la leña una vez construido el comedor.'],
      hechoPorIA: true,
    },
    pdf: null,
  };
  await db.guardar('proyectos/P-2026-017/solicitudes/v1', { ...v1 });
  await db.guardar('proyectos/P-2026-017', { resumen: v1.analisis!.resumen, descripcion: v1.analisis!.traduccion!.necesidad, formulario: { version: 1, estado: 'enviado', recibidoEn: hace(2) } }, { fusionar: true });
  await db.crear('proyectos/P-2026-017/eventos', { tipo: 'solicitud', autor: null, texto: 'La contraparte envía la solicitud (versión 1) con 0 archivos.', fecha: hace(2) });

  await db.guardar(
    'proyectos/P-2026-016',
    {
      formulario: {
        estado: 'cambios',
        version: 1,
        enviadoEn: hace(9),
        comentarios: {
          es: 'Por favor, separad el presupuesto en materiales, mano de obra y equipamiento.',
          traducido: 'Please split the budget into materials, labour and equipment.',
          idioma: 'en',
        },
      },
    },
    { fusionar: true },
  );

  // Unas "fotos" de ejemplo en la carpeta de seguimiento del aula.
  const aula = await db.leer<Proyecto>('proyectos/P-2026-014');
  if (aula?.drive) {
    const d = await drive();
    for (const [i, color] of ['#C9A27E', '#9DB4A0', '#B7B1A5'].entries()) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="${color}"/><text x="320" y="250" font-family="sans-serif" font-size="36" text-anchor="middle" fill="#fff">Foto de la obra ${i + 1}</text></svg>`;
      const f = await d.subir(aula.drive.subcarpetas.seguimiento, `${hace(5).slice(0, 10)} obra-${i + 1}.svg`, 'image/svg+xml', Buffer.from(svg));
      if (i < 2) await db.guardar(`proyectos/P-2026-014/archivos/${f.id}`, { nombre: f.nombre, mime: f.mime, tamano: f.tamano, carpeta: 'seguimiento', esFoto: true, publicable: true, origen: 'correo', fecha: f.creado });
    }
  }

  await reconstruirIndice();
}

function cp(nombre: string, tipo: string, pais: string, contactoNombre: string, idioma: Idioma): Contraparte {
  const correo = `${nombre.toLowerCase().normalize('NFD').replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 30)}@example.org`;
  return { nombre, tipo, pais, contactoNombre, correos: [correo], idioma, notas: '', creado: hace(400), actualizado: hace(100) };
}

function dn(nombre: string, tipo: Donante['tipo'], informes: string): Donante {
  return { nombre, tipo, contactoNombre: '', correo: '', informes, plantilla: '', notas: '', creado: hace(400), actualizado: hace(100) };
}

function py(
  codigo: string,
  titulo: string,
  sector: string,
  contraparte: string,
  lugar: string,
  lat: number | null,
  lng: number | null,
  estado: EstadoProyecto,
  presupuesto: number | null,
  diasNoticia: number,
  diasCreado: number,
  extra: { descripcion?: string; beneficiarios?: string; inicio?: string; finPrevisto?: string },
): Proyecto {
  const nombres: Record<string, [string, string, Idioma]> = {
    kinshasa: ['Sœurs de la Charité de Kinshasa', 'CD', 'fr'],
    bukavu: ['Diocèse de Bukavu', 'CD', 'fr'],
    bamenda: ['Mission Sisters of Bamenda', 'CM', 'en'],
    kara: ['Diocèse de Kara', 'TG', 'fr'],
    meru: ['Consolata Sisters Meru', 'KE', 'en'],
    uagadugu: ["Sœurs de l'Immaculée Conception", 'BF', 'fr'],
    adis: ['Daughters of Charity Addis Ababa', 'ET', 'en'],
    lilongwe: ['Malawi Tailoring Cooperative', 'MW', 'en'],
    beira: ['Irmãs Franciscanas da Beira', 'MZ', 'pt'],
    mwanza: ['Mwanza Parish Health Committee', 'TZ', 'en'],
  };
  const [nombre, pais, idioma] = nombres[contraparte];
  const avanzado = !['solicitud', 'revision'].includes(estado);
  return {
    codigo,
    titulo,
    sector,
    pais,
    lugar,
    lat,
    lng,
    estado,
    moneda: 'EUR',
    presupuesto,
    comprometido: 0,
    recibido: 0,
    numDonantes: 0,
    descripcion: extra.descripcion ?? '',
    resumen: '',
    beneficiarios: extra.beneficiarios ?? '',
    contraparte: { id: contraparte, nombre, contacto: '', idioma, correo: cp(nombre, '', pais, '', idioma).correos[0] },
    responsable: codigo === 'P-2026-006' || codigo === 'P-2026-011' ? luis : ana,
    revisor: avanzado ? { ...luis, fecha: hace(diasCreado - 20) } : null,
    drive: null,
    formulario: {
      enlaceId: nuevoIdEnlace(),
      estado: avanzado ? 'cerrado' : 'pendiente',
      version: avanzado ? 1 : 0,
      enviadoEn: hace(Math.min(diasCreado, diasNoticia)),
      comentarios: null,
    },
    fechas: { creado: hace(diasCreado), actualizado: hace(diasNoticia), inicio: extra.inicio, finPrevisto: extra.finPrevisto },
    ultimaNoticia: hace(diasNoticia),
    anio: Number(codigo.slice(2, 6)),
  };
}
