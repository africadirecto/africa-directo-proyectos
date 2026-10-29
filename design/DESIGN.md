# Guía de diseño — interfaz de gestión de proyectos

Esta carpeta es una **referencia visual**, no una especificación cerrada. Las maquetas fijan el tono (sencillo, claro, pensado para voluntarios sin experiencia técnica), la estructura de pantallas y la identidad de la ONG. Los detalles se pueden ajustar si mejoran el resultado; si cambias algo importante, explícalo.

## Contenido

| Ruta | Qué es |
| --- | --- |
| `mockups/acceso.html` | Entrar con Google y estado "acceso pendiente" (pulsa el botón para alternar) |
| `mockups/proyectos.html` | Inicio: avisos, filtros, tabla y mapa de proyectos |
| `mockups/solicitudes.html` | Bandeja de solicitudes y correos sin asignar, con el detalle de una solicitud |
| `mockups/proyecto.html` | Ficha de proyecto con seis pestañas (funcionan en la maqueta) |
| `mockups/admin.html` | Usuarios, permisos y accesos pendientes |
| `assets/logo-cara.svg` | Logo vectorial (la cara), para la cabecera y el favicon |
| `assets/logo-africadirecto.png` | Logotipo completo con el texto; viene de una imagen de baja resolución, úsalo solo pequeño |

Las maquetas son HTML estático con datos de ejemplo. Se abren en el navegador sin servidor y muestran la vista de un usuario con permiso de administración. Los textos entre corchetes ([nombre], [dominio]) son datos que aún no conocemos.

## Principios

- **Simple antes que completo.** Pocas pantallas, pocas acciones visibles y lenguaje llano. Quien entra por primera vez debe entender qué hacer sin formación.
- **Lo urgente primero.** El inicio muestra lo que requiere atención antes que la lista completa.
- **Cada proyecto es una ficha.** Todo lo de un proyecto (estado, contraparte, donantes, seguimiento, archivos, informes) vive en una sola página con pestañas.
- **Permisos sin ruido.** Lo que el usuario no puede hacer se oculta; no se muestra deshabilitado.
- **Drive es el almacén.** La interfaz enlaza a carpetas y documentos de Drive; no duplica archivos.
- **Funciona en móvil**, aunque el uso principal sea en ordenador.

## Identidad

- **Tipografía:** Quicksand (Google Fonts), pesos 400–700. Usar 500 como peso base del texto corrido: el 400 queda fino en tamaños pequeños.
- **Color de acento de la marca:** `#E54611`.
  - El texto blanco sobre `#E54611` tiene un contraste de 4,0:1, por debajo del 4,5:1 que exige el texto normal. Úsalo tal cual en elementos no textuales (barras de progreso, pestaña activa, selección, indicadores) y en texto grande y en negrita.
  - Para botones primarios: fondo `#D2400F` (hover `#B8360B`).
  - Para enlaces sobre fondo claro: `#B8360B` (hover `#8F2A08`).
  - Fondo suave para el elemento activo de la navegación: `#FCE9E1`, con texto `#9A2E09`.
- **Neutros:** fondo de página `#F6F6F3`, superficies `#FFFFFF`, bordes `#E3E2DC`, texto `#1B1B18`, texto secundario `#5E5D57`.
- **Logo:** la cara (`logo-cara.svg`) arriba a la izquierda. El logotipo completo y la etiqueta "el 100 % llega" (fondo `#E54611`, texto blanco en negrita y grande) aparecen en la pantalla de acceso.

## Estados del proyecto

Cada estado tiene una etiqueta con punto de color. El rojo queda reservado para problemas (parado, incidencia, cambios pedidos), para no confundirlo con el naranja de la marca.

| Estado | Fondo | Texto |
| --- | --- | --- |
| Solicitud | `#EEEDE8` | `#4A4943` |
| En revisión | `#FBEFD5` | `#7A4B00` |
| Validada | `#E3EDFB` | `#1F4E8C` |
| Financiación | `#EDE8FB` | `#4F3A99` |
| Aprobado | `#DDF0E5` | `#1D6B50` |
| En ejecución | `#D6EEF0` | `#0F5E66` |
| Parado | `#FDE6E4` | `#B42318` |
| Completado | `#E6E9EE` | `#334155` |
| Cerrado | `#EEEDE8` | `#5E5D57` |

Los puntos del mapa usan el color de texto de cada estado.

## Pantallas

**Barra superior** (todas menos acceso): logo, navegación (Proyectos · Solicitudes con contador · Administración solo para administradores) y usuario con su permiso.

**Proyectos (inicio)**
- Título y botón "Nueva solicitud".
- Fila "Requiere atención": avisos con enlace (sin noticias en más de 30 días, informes que vencen, solicitudes por revisar, correos sin asignar).
- Filtros: buscar, estado (por defecto "Activos"), país, año y "Solo los míos".
- Tabla y mapa lado a lado, con los mismos filtros. Al pulsar un punto del mapa aparece una tarjeta con enlace al proyecto. En la maqueta el mapa es un dibujo; en la app, un mapa real.

**Solicitudes**
- Bandeja en tres grupos: por revisar, esperando a la contraparte y correos sin asignar (con la sugerencia de la IA para confirmar o reasignar).
- Detalle de la solicitud seleccionada: resumen traducido, aviso de información que falta, datos clave, documentos y la decisión (comentario para la contraparte; Validar / Pedir cambios / Rechazar).

**Ficha de proyecto**
- Cabecera: código, título, estado, ubicación, contraparte, responsable y acciones (carpeta en Drive, cambiar estado, generar informe).
- Recorrido de fases con la actual destacada, y un aviso de "Siguiente paso" con su botón.
- Pestañas:
  - Resumen
  - Seguimiento: cronología de correos, notas y cambios de estado
  - Financiación: totales y donantes
  - Archivos: carpetas de Drive y fotos marcables como publicables
  - Informes: documentos generados y formulario para generar uno nuevo
  - Solicitud: respuestas de la contraparte, por versión

**Administración**
- Accesos pendientes con "Dar acceso de lectura" o "Rechazar".
- Tabla de usuarios con selector de permiso.
- Explicación de los tres permisos.
- Menú lateral con contrapartes, donantes, plantillas de informe y ajustes (estas secciones no están dibujadas).

**Acceso:** botón "Entrar con Google"; si la cuenta no está autorizada, pantalla de "acceso pendiente".

## Accesibilidad

- Elementos interactivos reales (`button`, `a`, `input` con su `label`), con zonas de pulsación de al menos 44 px.
- Contraste mínimo de 4,5:1 en texto normal; los colores de esta guía ya lo cumplen.
- Los estados no se distinguen solo por el color: siempre llevan texto.
