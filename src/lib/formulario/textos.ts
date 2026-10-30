// Textos del formulario de solicitud y de los correos a la contraparte,
// en los cuatro idiomas de las contrapartes. Se usa en el servidor y en el navegador.

import type { Idioma } from '../tipos';

export const IDIOMAS: Record<Idioma, string> = {
  es: 'Español',
  fr: 'Français',
  en: 'English',
  pt: 'Português',
};

/** Nombres de los idiomas en español, para las pantallas internas. */
export const IDIOMAS_ES: Record<Idioma, string> = {
  es: 'Español',
  fr: 'Francés',
  en: 'Inglés',
  pt: 'Portugués',
};

export const SECTORES: Record<string, Record<Idioma, string>> = {
  educacion: { es: 'Educación', fr: 'Éducation', en: 'Education', pt: 'Educação' },
  salud: { es: 'Salud', fr: 'Santé', en: 'Health', pt: 'Saúde' },
  agua: { es: 'Agua', fr: 'Eau', en: 'Water', pt: 'Água' },
  energia: { es: 'Energía', fr: 'Énergie', en: 'Energy', pt: 'Energia' },
  formacion: { es: 'Formación', fr: 'Formation', en: 'Training', pt: 'Formação' },
  alimentacion: { es: 'Alimentación', fr: 'Alimentation', en: 'Food', pt: 'Alimentação' },
  vivienda: { es: 'Vivienda', fr: 'Logement', en: 'Housing', pt: 'Habitação' },
  otro: { es: 'Otro', fr: 'Autre', en: 'Other', pt: 'Outro' },
};

export function nombreSector(clave: string, idioma: Idioma = 'es'): string {
  return SECTORES[clave]?.[idioma] ?? clave;
}

const es = {
  titulo: 'Solicitud de proyecto',
  intro: 'Rellenad este formulario con los datos del proyecto. Se guarda solo mientras escribís: podéis volver a este enlace cuando queráis y seguir.',
  idioma: 'Idioma',
  opcional: 'opcional',
  s_org: 'Vuestra organización',
  organizacion: 'Nombre de la organización',
  contactoNombre: 'Persona responsable',
  contactoCargo: 'Cargo',
  contactoCorreo: 'Correo electrónico',
  contactoTelefono: 'Teléfono o WhatsApp',
  s_proyecto: 'El proyecto',
  tituloProyecto: 'Nombre corto del proyecto',
  sector: 'Tipo de proyecto',
  pais: 'País',
  lugar: 'Ciudad o pueblo',
  indicaciones: 'Dirección o cómo llegar',
  ubicacion: 'Ubicación en el mapa',
  usarUbicacion: 'Usar mi ubicación actual',
  ayudaUbicacion: 'Pulsadlo estando en el lugar del proyecto.',
  ubicacionOk: 'Ubicación guardada',
  ubicacionError: 'No se pudo obtener la ubicación.',
  necesidad: '¿Qué necesitáis y por qué?',
  beneficiarios: '¿Quiénes se benefician?',
  numBeneficiarios: 'Número aproximado de personas',
  plazoMeses: 'Plazo previsto (meses)',
  aportacionLocal: '¿Qué aportáis vosotros?',
  s_presupuesto: 'Presupuesto',
  moneda: 'Moneda',
  concepto: 'Concepto',
  importe: 'Importe',
  anadirLinea: 'Añadir línea',
  quitar: 'Quitar',
  total: 'Total',
  s_archivos: 'Documentos y fotos',
  elegirArchivos: 'Añadir archivos',
  preparando: 'Preparando…',
  subiendo: 'Subiendo',
  subido: 'Subido',
  esperandoRed: 'Sin conexión: seguirá sola al volver la conexión',
  errorSubida: 'No se pudo subir',
  reintentar: 'Reintentar',
  demasiadoGrande: 'El archivo es demasiado grande (máximo 50 MB).',
  enviar: 'Enviar solicitud',
  enviando: 'Enviando…',
  guardado: 'Guardado',
  guardando: 'Guardando…',
  sinConexion: 'Sin conexión. Los cambios se guardan en este dispositivo.',
  obligatorio: 'Falta este dato',
  revisaCampos: 'Revisad los campos marcados.',
  esperaSubidas: 'Esperad a que terminen de subirse los archivos.',
  confirmarEnvio: '¿Enviar la solicitud? Si hace falta, os pediremos cambios.',
  enviado_t: '¡Solicitud enviada!',
  enviado_p: 'Gracias. Un voluntario de Africa Directo la revisará y os escribirá.',
  cambios_t: 'Os pedimos algunos cambios',
  cambios_p: 'Corregid lo que se indica y volved a enviar la solicitud.',
  cerrado_t: 'Este formulario ya no está abierto',
  cerrado_p: 'Si tenéis dudas, responded al último correo de Africa Directo.',
  noValido_t: 'Enlace no válido',
  noValido_p: 'El enlace no existe o ha caducado. Pedid uno nuevo respondiendo al correo de Africa Directo.',
  error: 'Algo ha fallado. Volved a intentarlo en unos minutos.',
};

type Base = typeof es;

const fr: Base = {
  titulo: 'Demande de projet',
  intro: "Remplissez ce formulaire avec les informations du projet. Il s'enregistre automatiquement : vous pouvez revenir à ce lien quand vous voulez pour continuer.",
  idioma: 'Langue',
  opcional: 'facultatif',
  s_org: 'Votre organisation',
  organizacion: "Nom de l'organisation",
  contactoNombre: 'Personne responsable',
  contactoCargo: 'Fonction',
  contactoCorreo: 'Adresse e-mail',
  contactoTelefono: 'Téléphone ou WhatsApp',
  s_proyecto: 'Le projet',
  tituloProyecto: 'Nom court du projet',
  sector: 'Type de projet',
  pais: 'Pays',
  lugar: 'Ville ou village',
  indicaciones: 'Adresse ou comment y arriver',
  ubicacion: 'Emplacement sur la carte',
  usarUbicacion: 'Utiliser ma position actuelle',
  ayudaUbicacion: 'Appuyez quand vous êtes sur le lieu du projet.',
  ubicacionOk: 'Position enregistrée',
  ubicacionError: "Impossible d'obtenir la position.",
  necesidad: 'De quoi avez-vous besoin et pourquoi ?',
  beneficiarios: 'Qui en bénéficie ?',
  numBeneficiarios: 'Nombre approximatif de personnes',
  plazoMeses: 'Durée prévue (mois)',
  aportacionLocal: 'Quelle est votre contribution ?',
  s_presupuesto: 'Budget',
  moneda: 'Monnaie',
  concepto: 'Poste',
  importe: 'Montant',
  anadirLinea: 'Ajouter une ligne',
  quitar: 'Supprimer',
  total: 'Total',
  s_archivos: 'Documents et photos',
  elegirArchivos: 'Ajouter des fichiers',
  preparando: 'Préparation…',
  subiendo: 'Envoi',
  subido: 'Envoyé',
  esperandoRed: 'Pas de connexion : l’envoi reprendra tout seul',
  errorSubida: "Échec de l'envoi",
  reintentar: 'Réessayer',
  demasiadoGrande: 'Le fichier est trop volumineux (50 Mo maximum).',
  enviar: 'Envoyer la demande',
  enviando: 'Envoi…',
  guardado: 'Enregistré',
  guardando: 'Enregistrement…',
  sinConexion: 'Pas de connexion. Les modifications sont gardées sur cet appareil.',
  obligatorio: 'Information manquante',
  revisaCampos: 'Vérifiez les champs indiqués.',
  esperaSubidas: "Attendez la fin de l'envoi des fichiers.",
  confirmarEnvio: 'Envoyer la demande ? Si nécessaire, nous vous demanderons des modifications.',
  enviado_t: 'Demande envoyée !',
  enviado_p: 'Merci. Un bénévole d’Africa Directo l’examinera et vous écrira.',
  cambios_t: 'Nous vous demandons quelques modifications',
  cambios_p: 'Corrigez ce qui est indiqué et renvoyez la demande.',
  cerrado_t: "Ce formulaire n'est plus ouvert",
  cerrado_p: 'Pour toute question, répondez au dernier e-mail d’Africa Directo.',
  noValido_t: 'Lien non valide',
  noValido_p: 'Le lien n’existe pas ou a expiré. Demandez-en un nouveau en répondant à l’e-mail d’Africa Directo.',
  error: 'Une erreur est survenue. Réessayez dans quelques minutes.',
};

const en: Base = {
  titulo: 'Project request',
  intro: 'Fill in this form with the project details. It saves automatically as you type: you can come back to this link at any time and carry on.',
  idioma: 'Language',
  opcional: 'optional',
  s_org: 'Your organisation',
  organizacion: 'Name of the organisation',
  contactoNombre: 'Person in charge',
  contactoCargo: 'Position',
  contactoCorreo: 'Email',
  contactoTelefono: 'Phone or WhatsApp',
  s_proyecto: 'The project',
  tituloProyecto: 'Short name of the project',
  sector: 'Type of project',
  pais: 'Country',
  lugar: 'Town or village',
  indicaciones: 'Address or how to get there',
  ubicacion: 'Location on the map',
  usarUbicacion: 'Use my current location',
  ayudaUbicacion: 'Press it while you are at the project site.',
  ubicacionOk: 'Location saved',
  ubicacionError: 'Could not get the location.',
  necesidad: 'What do you need and why?',
  beneficiarios: 'Who will benefit?',
  numBeneficiarios: 'Approximate number of people',
  plazoMeses: 'Expected duration (months)',
  aportacionLocal: 'What will you contribute?',
  s_presupuesto: 'Budget',
  moneda: 'Currency',
  concepto: 'Item',
  importe: 'Amount',
  anadirLinea: 'Add a line',
  quitar: 'Remove',
  total: 'Total',
  s_archivos: 'Documents and photos',
  elegirArchivos: 'Add files',
  preparando: 'Preparing…',
  subiendo: 'Uploading',
  subido: 'Uploaded',
  esperandoRed: 'No connection: it will resume on its own',
  errorSubida: 'Upload failed',
  reintentar: 'Try again',
  demasiadoGrande: 'The file is too large (50 MB maximum).',
  enviar: 'Send request',
  enviando: 'Sending…',
  guardado: 'Saved',
  guardando: 'Saving…',
  sinConexion: 'No connection. Changes are kept on this device.',
  obligatorio: 'This is required',
  revisaCampos: 'Please check the highlighted fields.',
  esperaSubidas: 'Please wait until the files have finished uploading.',
  confirmarEnvio: 'Send the request? If needed, we will ask you for changes.',
  enviado_t: 'Request sent!',
  enviado_p: 'Thank you. A volunteer from Africa Directo will review it and write to you.',
  cambios_t: 'We are asking for some changes',
  cambios_p: 'Please correct what is indicated and send the request again.',
  cerrado_t: 'This form is no longer open',
  cerrado_p: 'If you have any questions, reply to the last email from Africa Directo.',
  noValido_t: 'Invalid link',
  noValido_p: 'The link does not exist or has expired. Ask for a new one by replying to the email from Africa Directo.',
  error: 'Something went wrong. Please try again in a few minutes.',
};

const pt: Base = {
  titulo: 'Pedido de projeto',
  intro: 'Preencham este formulário com os dados do projeto. Fica guardado enquanto escrevem: podem voltar a este link quando quiserem e continuar.',
  idioma: 'Língua',
  opcional: 'opcional',
  s_org: 'A vossa organização',
  organizacion: 'Nome da organização',
  contactoNombre: 'Pessoa responsável',
  contactoCargo: 'Cargo',
  contactoCorreo: 'Correio eletrónico',
  contactoTelefono: 'Telefone ou WhatsApp',
  s_proyecto: 'O projeto',
  tituloProyecto: 'Nome curto do projeto',
  sector: 'Tipo de projeto',
  pais: 'País',
  lugar: 'Cidade ou aldeia',
  indicaciones: 'Morada ou como chegar',
  ubicacion: 'Localização no mapa',
  usarUbicacion: 'Usar a minha localização atual',
  ayudaUbicacion: 'Carreguem estando no local do projeto.',
  ubicacionOk: 'Localização guardada',
  ubicacionError: 'Não foi possível obter a localização.',
  necesidad: 'De que precisam e porquê?',
  beneficiarios: 'Quem beneficia?',
  numBeneficiarios: 'Número aproximado de pessoas',
  plazoMeses: 'Prazo previsto (meses)',
  aportacionLocal: 'O que é que vocês contribuem?',
  s_presupuesto: 'Orçamento',
  moneda: 'Moeda',
  concepto: 'Rubrica',
  importe: 'Montante',
  anadirLinea: 'Adicionar linha',
  quitar: 'Remover',
  total: 'Total',
  s_archivos: 'Documentos e fotografias',
  elegirArchivos: 'Adicionar ficheiros',
  preparando: 'A preparar…',
  subiendo: 'A enviar',
  subido: 'Enviado',
  esperandoRed: 'Sem ligação: o envio continuará sozinho',
  errorSubida: 'Não foi possível enviar',
  reintentar: 'Tentar de novo',
  demasiadoGrande: 'O ficheiro é demasiado grande (máximo 50 MB).',
  enviar: 'Enviar pedido',
  enviando: 'A enviar…',
  guardado: 'Guardado',
  guardando: 'A guardar…',
  sinConexion: 'Sem ligação. As alterações ficam guardadas neste dispositivo.',
  obligatorio: 'Falta este dado',
  revisaCampos: 'Revejam os campos assinalados.',
  esperaSubidas: 'Esperem que os ficheiros acabem de ser enviados.',
  confirmarEnvio: 'Enviar o pedido? Se for preciso, pediremos alterações.',
  enviado_t: 'Pedido enviado!',
  enviado_p: 'Obrigado. Um voluntário da Africa Directo vai analisá-lo e escrever-vos.',
  cambios_t: 'Pedimos-vos algumas alterações',
  cambios_p: 'Corrijam o que se indica e voltem a enviar o pedido.',
  cerrado_t: 'Este formulário já não está aberto',
  cerrado_p: 'Se tiverem dúvidas, respondam ao último e-mail da Africa Directo.',
  noValido_t: 'Link inválido',
  noValido_p: 'O link não existe ou expirou. Peçam um novo respondendo ao e-mail da Africa Directo.',
  error: 'Algo correu mal. Tentem de novo dentro de alguns minutos.',
};

// ── Pistas del formulario ───────────────────────────────────────────────────
// Muchas contrapartes no están acostumbradas a rellenar formularios: cada casilla que
// puede dar dudas lleva debajo una explicación sencilla con un ejemplo concreto.

type CampoConPista =
  | 'organizacion'
  | 'contactoNombre'
  | 'contactoCargo'
  | 'contactoCorreo'
  | 'contactoTelefono'
  | 'titulo'
  | 'lugar'
  | 'indicaciones'
  | 'necesidad'
  | 'beneficiarios'
  | 'numBeneficiarios'
  | 'plazoMeses'
  | 'aportacionLocal'
  | 'lineas'
  | 'moneda'
  | 'archivos';

interface Extra {
  pistas: Record<CampoConPista, string>;
  /** «{eur}» se sustituye por el importe en euros. */
  equivalente: string;
  buscar: string;
  sinResultados: string;
}

export type Textos = Base & Extra;

const EXTRA: Record<Idioma, Extra> = {
  es: {
    pistas: {
      organizacion: 'El nombre completo de vuestro grupo. Ejemplo: «Congregación de las Hermanas de San José, comunidad de Limete».',
      contactoNombre: 'La persona que seguirá el proyecto y con la que hablaremos. Ejemplo: «Hna. María Kabila».',
      contactoCargo: 'Qué hace esa persona en la organización. Ejemplo: «Directora de la escuela».',
      contactoCorreo: 'El correo que miráis a menudo. Os escribiremos aquí.',
      contactoTelefono: 'Con el prefijo del país delante. Ejemplo: «+243 81 234 5678».',
      titulo: 'En pocas palabras, qué queréis hacer. Ejemplo: «Aula para la escuela primaria».',
      lugar: 'La ciudad o el pueblo donde se hará el proyecto. Ejemplo: «Kinshasa, barrio de Limete».',
      indicaciones: 'Cómo encontrar el sitio. Ejemplo: «Junto a la parroquia de San Pedro, a 2 km de la carretera principal».',
      necesidad:
        'Contad el problema que tenéis, qué queréis construir o comprar y por qué es importante. Ejemplo: «Los 60 niños de primero estudian debajo de un árbol. Cuando llueve no hay clase. Queremos construir un aula con pupitres».',
      beneficiarios: 'Quiénes van a usar el proyecto o a vivir mejor gracias a él. Ejemplo: «60 alumnos de primaria cada año y 2 maestros».',
      numBeneficiarios: 'Solo el número. Ejemplo: 60.',
      plazoMeses: 'Cuántos meses tardaréis en terminar. Ejemplo: 6.',
      aportacionLocal: 'Lo que ponéis vosotros. Ejemplo: «El terreno, el trabajo de los padres y 500 € en dinero».',
      lineas:
        'Escribid una línea por cada gasto, con su precio. Ejemplo: «Cemento (50 sacos): 600», «Mano de obra: 2.000», «Pupitres (30): 1.500». Si tenéis el presupuesto del constructor, subidlo más abajo.',
      moneda: 'La moneda de los precios que escribís. Se elige sola con el país; cambiadla si usáis otra.',
      archivos: 'Fotos del sitio tal como está hoy, el presupuesto del constructor o de la tienda y los planos si los tenéis. Podéis hacer las fotos con el móvil.',
    },
    equivalente: '≈ {eur} (cambio aproximado)',
    buscar: 'Buscar…',
    sinResultados: 'Sin resultados',
  },
  fr: {
    pistas: {
      organizacion: 'Le nom complet de votre groupe. Exemple : « Congrégation des Sœurs de Saint-Joseph, communauté de Limete ».',
      contactoNombre: 'La personne qui suivra le projet et avec qui nous parlerons. Exemple : « Sœur Marie Kabila ».',
      contactoCargo: 'Ce que fait cette personne dans l’organisation. Exemple : « Directrice de l’école ».',
      contactoCorreo: 'L’adresse e-mail que vous regardez souvent. Nous vous écrirons ici.',
      contactoTelefono: 'Avec l’indicatif du pays devant. Exemple : « +243 81 234 5678 ».',
      titulo: 'En quelques mots, ce que vous voulez faire. Exemple : « Salle de classe pour l’école primaire ».',
      lugar: 'La ville ou le village où se fera le projet. Exemple : « Kinshasa, quartier de Limete ».',
      indicaciones: 'Comment trouver le lieu. Exemple : « À côté de la paroisse Saint-Pierre, à 2 km de la route principale ».',
      necesidad:
        'Expliquez le problème, ce que vous voulez construire ou acheter et pourquoi c’est important. Exemple : « Les 60 enfants de première année étudient sous un arbre. Quand il pleut, il n’y a pas cours. Nous voulons construire une salle de classe avec des bancs ».',
      beneficiarios: 'Qui va utiliser le projet ou vivre mieux grâce à lui. Exemple : « 60 élèves du primaire chaque année et 2 enseignants ».',
      numBeneficiarios: 'Seulement le nombre. Exemple : 60.',
      plazoMeses: 'Combien de mois il vous faudra pour terminer. Exemple : 6.',
      aportacionLocal: 'Ce que vous apportez vous-mêmes. Exemple : « Le terrain, le travail des parents et 500 € en argent ».',
      lineas:
        'Écrivez une ligne pour chaque dépense, avec son prix. Exemple : « Ciment (50 sacs) : 600 », « Main-d’œuvre : 2 000 », « Bancs (30) : 1 500 ». Si vous avez le devis de l’entrepreneur, ajoutez-le plus bas.',
      moneda: 'La monnaie des prix que vous écrivez. Elle se choisit toute seule avec le pays ; changez-la si vous en utilisez une autre.',
      archivos: 'Des photos du lieu tel qu’il est aujourd’hui, le devis de l’entrepreneur ou du magasin et les plans si vous en avez. Vous pouvez prendre les photos avec le téléphone.',
    },
    equivalente: '≈ {eur} (taux approximatif)',
    buscar: 'Rechercher…',
    sinResultados: 'Aucun résultat',
  },
  en: {
    pistas: {
      organizacion: 'The full name of your group. Example: “Sisters of Saint Joseph, Limete community”.',
      contactoNombre: 'The person who will follow the project and talk with us. Example: “Sister Mary Kabila”.',
      contactoCargo: 'What this person does in the organisation. Example: “Head teacher of the school”.',
      contactoCorreo: 'The email address you check often. We will write to you here.',
      contactoTelefono: 'With the country code in front. Example: “+254 712 345 678”.',
      titulo: 'In a few words, what you want to do. Example: “Classroom for the primary school”.',
      lugar: 'The town or village where the project will be. Example: “Kisumu, Nyalenda area”.',
      indicaciones: 'How to find the place. Example: “Next to Saint Peter’s parish, 2 km from the main road”.',
      necesidad:
        'Tell us the problem, what you want to build or buy, and why it is important. Example: “The 60 first-year children study under a tree. When it rains there is no class. We want to build a classroom with desks”.',
      beneficiarios: 'Who will use the project or live better thanks to it. Example: “60 primary pupils every year and 2 teachers”.',
      numBeneficiarios: 'Just the number. Example: 60.',
      plazoMeses: 'How many months you need to finish. Example: 6.',
      aportacionLocal: 'What you will provide yourselves. Example: “The land, the parents’ work and €500 in money”.',
      lineas:
        'Write one line for each cost, with its price. Example: “Cement (50 bags): 600”, “Labour: 2,000”, “Desks (30): 1,500”. If you have the builder’s quote, add it further down.',
      moneda: 'The currency of the prices you write. It is chosen automatically with the country; change it if you use another one.',
      archivos: 'Photos of the place as it is today, the quote from the builder or shop, and the plans if you have them. You can take the photos with your phone.',
    },
    equivalente: '≈ {eur} (approximate rate)',
    buscar: 'Search…',
    sinResultados: 'No results',
  },
  pt: {
    pistas: {
      organizacion: 'O nome completo do vosso grupo. Exemplo: «Congregação das Irmãs de São José, comunidade da Munhava».',
      contactoNombre: 'A pessoa que vai acompanhar o projeto e com quem vamos falar. Exemplo: «Irmã Maria Chissano».',
      contactoCargo: 'O que essa pessoa faz na organização. Exemplo: «Diretora da escola».',
      contactoCorreo: 'O e-mail que consultam com frequência. Vamos escrever-vos para aqui.',
      contactoTelefono: 'Com o indicativo do país à frente. Exemplo: «+258 84 123 4567».',
      titulo: 'Em poucas palavras, o que querem fazer. Exemplo: «Sala de aula para a escola primária».',
      lugar: 'A cidade ou a aldeia onde será o projeto. Exemplo: «Beira, bairro da Munhava».',
      indicaciones: 'Como encontrar o local. Exemplo: «Ao lado da paróquia de São Pedro, a 2 km da estrada principal».',
      necesidad:
        'Contem o problema, o que querem construir ou comprar e porque é importante. Exemplo: «As 60 crianças da 1.ª classe estudam debaixo de uma árvore. Quando chove não há aulas. Queremos construir uma sala com carteiras».',
      beneficiarios: 'Quem vai usar o projeto ou viver melhor graças a ele. Exemplo: «60 alunos da primária por ano e 2 professores».',
      numBeneficiarios: 'Só o número. Exemplo: 60.',
      plazoMeses: 'Quantos meses vão demorar a terminar. Exemplo: 6.',
      aportacionLocal: 'O que vocês próprios põem. Exemplo: «O terreno, o trabalho dos pais e 500 € em dinheiro».',
      lineas:
        'Escrevam uma linha para cada despesa, com o seu preço. Exemplo: «Cimento (50 sacos): 600», «Mão de obra: 2000», «Carteiras (30): 1500». Se tiverem o orçamento do construtor, juntem-no mais abaixo.',
      moneda: 'A moeda dos preços que escrevem. Escolhe-se sozinha com o país; mudem-na se usarem outra.',
      archivos: 'Fotos do local como está hoje, o orçamento do construtor ou da loja e as plantas se as tiverem. Podem tirar as fotos com o telemóvel.',
    },
    equivalente: '≈ {eur} (câmbio aproximado)',
    buscar: 'Procurar…',
    sinResultados: 'Sem resultados',
  },
};

export const TEXTOS: Record<Idioma, Textos> = {
  es: { ...es, ...EXTRA.es },
  fr: { ...fr, ...EXTRA.fr },
  en: { ...en, ...EXTRA.en },
  pt: { ...pt, ...EXTRA.pt },
};

export function esIdioma(v: unknown): v is Idioma {
  return v === 'es' || v === 'fr' || v === 'en' || v === 'pt';
}

// ── Correos a la contraparte ────────────────────────────────────────────────

type Plantilla = (d: { nombre: string; codigo: string; enlace: string; comentarios?: string }) => { asunto: string; texto: string };

export const CORREOS: Record<'invitacion' | 'cambios' | 'rechazo', Record<Idioma, Plantilla>> = {
  invitacion: {
    es: (d) => ({
      asunto: `Africa Directo: formulario del proyecto ${d.codigo}`,
      texto: `Hola, ${d.nombre}:\n\nGracias por escribir a Africa Directo. Para estudiar vuestro proyecto necesitamos que rellenéis este formulario:\n\n${d.enlace}\n\nSe puede rellenar en varios días y desde el móvil: lo escrito se guarda solo. Si tenéis cualquier duda, responded a este correo.\n\nUn saludo,\nAfrica Directo`,
    }),
    fr: (d) => ({
      asunto: `Africa Directo : formulaire du projet ${d.codigo}`,
      texto: `Bonjour ${d.nombre},\n\nMerci d'avoir écrit à Africa Directo. Pour étudier votre projet, nous avons besoin que vous remplissiez ce formulaire :\n\n${d.enlace}\n\nVous pouvez le remplir en plusieurs jours, depuis votre téléphone : ce que vous écrivez est enregistré automatiquement. Pour toute question, répondez à cet e-mail.\n\nBien cordialement,\nAfrica Directo`,
    }),
    en: (d) => ({
      asunto: `Africa Directo: form for project ${d.codigo}`,
      texto: `Dear ${d.nombre},\n\nThank you for writing to Africa Directo. To study your project, we need you to fill in this form:\n\n${d.enlace}\n\nYou can fill it in over several days and from your phone: what you write is saved automatically. If you have any questions, just reply to this email.\n\nBest regards,\nAfrica Directo`,
    }),
    pt: (d) => ({
      asunto: `Africa Directo: formulário do projeto ${d.codigo}`,
      texto: `Olá, ${d.nombre}:\n\nObrigado por escreverem à Africa Directo. Para estudarmos o vosso projeto, precisamos que preencham este formulário:\n\n${d.enlace}\n\nPodem preenchê-lo em vários dias e a partir do telemóvel: o que escreverem fica guardado. Se tiverem dúvidas, respondam a este e-mail.\n\nCumprimentos,\nAfrica Directo`,
    }),
  },
  cambios: {
    es: (d) => ({
      asunto: `Africa Directo: cambios en la solicitud ${d.codigo}`,
      texto: `Hola, ${d.nombre}:\n\nHemos revisado vuestra solicitud y necesitamos algunos cambios:\n\n${d.comentarios}\n\nPodéis corregirla en el mismo enlace:\n${d.enlace}\n\nGracias,\nAfrica Directo`,
    }),
    fr: (d) => ({
      asunto: `Africa Directo : modifications de la demande ${d.codigo}`,
      texto: `Bonjour ${d.nombre},\n\nNous avons examiné votre demande et nous avons besoin de quelques modifications :\n\n${d.comentarios}\n\nVous pouvez la corriger avec le même lien :\n${d.enlace}\n\nMerci,\nAfrica Directo`,
    }),
    en: (d) => ({
      asunto: `Africa Directo: changes to request ${d.codigo}`,
      texto: `Dear ${d.nombre},\n\nWe have reviewed your request and need some changes:\n\n${d.comentarios}\n\nYou can correct it using the same link:\n${d.enlace}\n\nThank you,\nAfrica Directo`,
    }),
    pt: (d) => ({
      asunto: `Africa Directo: alterações ao pedido ${d.codigo}`,
      texto: `Olá, ${d.nombre}:\n\nAnalisámos o vosso pedido e precisamos de algumas alterações:\n\n${d.comentarios}\n\nPodem corrigi-lo no mesmo link:\n${d.enlace}\n\nObrigado,\nAfrica Directo`,
    }),
  },
  rechazo: {
    es: (d) => ({
      asunto: `Africa Directo: solicitud ${d.codigo}`,
      texto: `Hola, ${d.nombre}:\n\nHemos estudiado con atención vuestra solicitud y, por ahora, no podemos apoyarla.\n\n${d.comentarios ?? ''}\n\nGracias por vuestra confianza.\nAfrica Directo`,
    }),
    fr: (d) => ({
      asunto: `Africa Directo : demande ${d.codigo}`,
      texto: `Bonjour ${d.nombre},\n\nNous avons étudié attentivement votre demande et, pour le moment, nous ne pouvons pas la soutenir.\n\n${d.comentarios ?? ''}\n\nMerci de votre confiance.\nAfrica Directo`,
    }),
    en: (d) => ({
      asunto: `Africa Directo: request ${d.codigo}`,
      texto: `Dear ${d.nombre},\n\nWe have carefully considered your request and, for now, we are unable to support it.\n\n${d.comentarios ?? ''}\n\nThank you for your trust.\nAfrica Directo`,
    }),
    pt: (d) => ({
      asunto: `Africa Directo: pedido ${d.codigo}`,
      texto: `Olá, ${d.nombre}:\n\nAnalisámos com atenção o vosso pedido e, por agora, não o podemos apoiar.\n\n${d.comentarios ?? ''}\n\nObrigado pela vossa confiança.\nAfrica Directo`,
    }),
  },
};
