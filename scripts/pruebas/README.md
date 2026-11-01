# Pruebas técnicas del rediseño de informes (fase 0)

Comprueban con los servicios reales lo incierto del nuevo sistema de plantillas e informes antes de construirlo. Usan la configuración de `.env.local`, solo **datos inventados**, y dejan lo que crean en la carpeta `_Pruebas técnicas` de la unidad **Sistema**. Los JSON de cada prueba quedan en `scripts/pruebas/salida/`, que git ignora; servirán de ejemplos para los tests.

```bash
node scripts/pruebas/s1-lotes.mjs enviar [modelo]      # Batch API de OpenRouter (y leer <id> / borrar <id>)
node scripts/pruebas/s2-fotos.mjs                      # fotos en Docs y Slides
node scripts/pruebas/s2-ruta-foto.mjs                  # la ruta /api/foto (con npm run dev en marcha)
node scripts/pruebas/s3-conversion.mjs <archivo.docx>  # conversión de plantillas de donante
node scripts/pruebas/s4-marcadores.mjs                 # sustitución de marcadores en Docs
```

Los compositores definitivos (`src/lib/drive/plantilla*.ts`) tienen además su prueba contra Google, que no se ejecuta con `npm test`:

```bash
PRUEBAS_GOOGLE=1 npx vitest run src/lib/drive/plantillas.google.test.ts
```

## Resultados (1 de noviembre de 2026)

### S4 · Marcadores en Docs: sigue ✔

Pasan las 20 comprobaciones:
- Se encuentran los marcadores aunque la negrita los parta en varios fragmentos, también dentro de tablas y del encabezado.
- El texto insertado *dentro* del marcador hereda su fuente, tamaño y color.
- El Markdown restringido se aplica: negrita, viñetas, `###` como Título 3 (reseteando el estilo heredado) y `[PENDIENTE: x]` como `[x]` resaltado en amarillo.
- Las líneas de un marcador que está en una lista heredan la viñeta.
- Las posiciones con emoji son correctas, porque se cuentan en UTF-16.
- La fórmula de índices de las celdas de una tabla nueva es correcta: `inicio + 4 + fila·(2·columnas + 1) + 2·columna`.
- `requiredRevisionId` rechaza con 400 una revisión vieja.
- Todo cabe en un solo `batchUpdate`.

### S2 · Fotos en Docs y Slides: sigue ✔, salvo la ruta de la app

Funciona:
- `insertInlineImage` en el cuerpo, en una celda (al ancho de la columna) y en el encabezado.
- `replaceImage` sobre imágenes en línea y flotantes.
- `replaceAllShapesWithImage` en Slides, que ocupa exactamente el recuadro.

A tener en cuenta:
- El texto alternativo de una imagen se conserva al importar, así que sirve de marcador (`{{foto:x}}` en el alt).
- Google **omite `startIndex` cuando vale 0**, por ejemplo al principio de un encabezado: tratar su ausencia como 0.
- Docs **rechaza la miniatura de Drive** («Access to the provided image was forbidden»), así que hace falta la ruta propia `/api/foto/[token]`.
- Esa ruta puede servir la miniatura a 1600 px (unos 760 KB de una foto de 3 MB), que la cuenta de servicio obtiene sin problema.
- **La miniatura de Drive se descarga sin credenciales mientras dura**: es una URL secreta. No debe llegar nunca al navegador ni a los registros.
- `replaceImage` cambia el identificador de la imagen: hay que releer el documento después.

La ruta `/api/foto/[token]` ya existe y está probada con la app en marcha (`node scripts/pruebas/s2-ruta-foto.mjs`, con `npm run dev`):
- Sirve una foto publicable real reducida (JPEG de unos 640 KB, `Cache-Control: private, no-store`).
- Responde 404 a un token alterado, a uno caducado, a una foto no publicable y a un archivo inexistente.

Pendiente: que Google descargue de verdad desde `/api/foto` en Vercel, con la protección de los despliegues de vista previa. No se puede probar desde `localhost`.

### S3 · Conversión de .docx: sigue ✔, con una limitación

Prueba hecha con un .docx sintético que imita una plantilla de donante. Hay que repetirla con plantillas reales.
- Se conservan los estilos de título (los propios pasan a Título 1, Título 2 y Subtítulo), las fuentes (Calibri y Cambria), la tabla y el encabezado.
- Las imágenes en línea y flotantes conservan su texto alternativo.
- **El texto de los cuadros de texto no es visible para la API**: no se puede leer, traducir ni rellenar.
  - Detectarlo en el original: buscar `w:txbxContent` dentro del .docx.
  - Avisar al crear la plantilla, para que se pasen a texto normal.
- La conversión tarda unos 3 s.

### S1 · Batch API de OpenRouter: sigue ✔

Los dos modelos actuales tienen variante batch, a mitad de precio:

| Modelo | Batch, por millón de tokens de entrada / salida | Coste medio por campo en la prueba |
| --- | --- | --- |
| `google/gemini-3.7-flash` | 0,375 $ / 1,875 $ | ~0,0015 $ (≈ 85–90 % de la salida es razonamiento) |
| `anthropic/claude-haiku-5.5` | 0,05 $ / 0,25 $ | ~0,00012 $ |

Funciona:
- Se envió un lote con cada modelo. Todos terminaron en **3–5 minutos**, con el proveedor de Google y con el de Anthropic.
- `response_format` con json_schema **se respeta** en los dos, y devuelve JSON válido según el esquema.
- `max_tokens` se respeta (`finish_reason: length`). Ojo: el razonamiento cuenta dentro de `max_tokens`.
- Un `max_tokens` por encima del máximo del modelo se ignora sin error.
- `reasoning: { effort: 'low' }` se acepta, pero en Gemini apenas reduce el razonamiento (642 frente a 758 tokens).
- `DELETE` borra el lote en OpenRouter y en el proveedor (`upstream.status: deleted` en Google y Anthropic). Después, `GET` responde 404.

Hallazgos que cambian el diseño:
- **Una sola petición mal formada hace que se rechace el lote entero** al validar, con `status: failed` y sin resultados. Hay que validar cada petición antes de enviar.
- **Con Google, todas las peticiones de un lote deben compartir la misma configuración de `response_format`**; si no, se rechaza el lote entero. Con Anthropic se aceptó un lote mezclado. Los campos de un informe van todos en texto, sin `response_format`. El agente de plantillas va en su propio lote, con JSON.
- **Los modelos se salen del Markdown pedido:** usan `##` y `####`, `*` como viñeta y dos espacios al final de línea, y repiten el título del apartado. El intérprete debe aceptarlo, y el prompt debe decir que no se repita el título.
- **Abusan de `[PENDIENTE: …]`**, con hasta 5 en un campo corto. El prompt debe pedir que solo se marque lo imprescindible.

No se ha podido provocar un fallo de una sola petición en ejecución. El caso queda cubierto por el diseño (reenviar una vez y, si no, `[PENDIENTE]`).

Pendiente: que el webhook llegue a Vercel y su firma se verifique. Desde `localhost` no se puede; queda para el primer despliegue.

Coste total de las pruebas: unos 0,01 $.
