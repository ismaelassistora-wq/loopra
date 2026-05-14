# DIRECTIVA: PUBLICACION_AUTOMATICA — Publicador Horario de Posts, Reels e Historias

> **ID:** LOOPRA-WF-004
> **Última Actualización:** 2026-04-27
> **Estado:** ACTIVO

---

## 1. Objetivos y Alcance

- **Objetivo Principal:** Publicar automáticamente en Instagram los posts con `status = APPROVED` cuya `proposed_date` coincida con hoy y cuya `proposed_time` caiga dentro de la ventana horaria actual (cron cada hora).
- **Criterio de Éxito:** Cada post procesado actualiza su estado en Supabase a `PUBLISHED` (si tuvo éxito) o `FAILED` (si falló). Se soporte correctamente el enrutamiento por `content_type`: **POST**, **REEL**, e **HISTORIA**, usando el endpoint y los parámetros adecuados de la API de Upload-Post.

---

## 2. Especificaciones de Entrada/Salida (I/O)

### Entradas (Inputs)

- **Trigger:** Cron schedule, cada hora, en punto.
- **Fuente de datos:** Supabase → tabla `posts`
  - `status = APPROVED`
  - `proposed_date = hoy (Europe/Madrid)`
  - `proposed_time` dentro de la ventana de la hora actual ± 59 min

### Salidas (Outputs)

- Actualización de fila en `posts`:
  - `status` → `PUBLISHED` o `FAILED`
  - `published_at` → timestamp ISO
  - `published_urls.upload_post_request_id` → ID de la solicitud de Upload-Post

---

## 3. Lógica de Enrutamiento por content_type

El campo `content_type` del post determina qué rama de publicación se usa:

| content_type | Endpoint Upload-Post       | Campo de media | Parámetros extra              |
|-------------|----------------------------|----------------|-------------------------------|
| POST        | `POST /api/upload_photos`  | `photos[]`     | (ninguno)                     |
| HISTORIA    | `POST /api/upload_photos`  | `photos[]`     | `media_type=STORIES`          |
| REEL        | `POST /api/upload`         | `video`        | (archivo de vídeo o URL pública) |

### Restricciones Críticas

- **Para REELs:** El campo `image_url` en Supabase debe contener una URL pública a un archivo de vídeo (`.mp4`). GPT-4o Vision no puede analizar vídeos; en WF001 se usa el filename y notas como contexto.
- **Para REELs:** El endpoint es `/api/upload` (no `/api/upload_photos`). El campo del formulario multipart es `video`, no `photos[]`.
- **Para HISTORIAs:** Usar `/api/upload_photos` igual que un POST, pero añadir el parámetro `media_type=STORIES` en el body.
- **Enrutamiento:** Se realiza con dos nodos IF en n8n secuenciales: primero si `content_type == REEL`, luego si `content_type == HISTORIA`. El camino FALSE del segundo IF es el POST estándar.

---

## 4. Flujo Lógico — Nodos n8n (LOOPRA-WF-004)

### Nodo 1: ⏰ Cron Cada Hora
- Schedule Trigger, cada 60 minutos.

### Nodo 2: 📋 Buscar Posts APPROVED de Hoy
- GET Supabase `/rest/v1/posts`
- Filtros: `status=eq.APPROVED`, `proposed_date=eq.{hoy}`
- Select: `id, client_id, content_type, copy_text, hashtags, platform, image_url, proposed_date, proposed_time, clients(upload_post_profile)`

### Nodo 3: 🕐 Filtrar Por Hora Actual
- Code node (Luxon). Devuelve los posts cuya `proposed_time` esté en la ventana de la hora actual.

### Nodo 4: ⬇️ Descargar Media
- HTTP Request → GET de `image_url` del post
- Respuesta en formato file → `image_binary`

### Nodo 5: 🔧 Preparar Payload
- Code node. Construye el caption (copy + hashtags), resuelve el `uploadProfile` del cliente, y mapea los flags `isReel` y `isStory`.

### Nodo 6: 🔀 IF ¿Es REEL?
- Condición: `{{ $json.content_type === 'REEL' }}`
- TRUE → rama REEL
- FALSE → siguiente IF

### Nodo 7: 🎬 Publicar REEL
- POST `https://api.upload-post.com/api/upload`
- multipart/form-data
- Campos: `user`, `title`, `description`, `platform[]=instagram`, `video` (binary)

### Nodo 8: 🔀 IF ¿Es HISTORIA?
- Condición: `{{ $json.content_type === 'HISTORIA' }}`
- TRUE → rama HISTORIA
- FALSE → rama POST estándar

### Nodo 9: 📖 Publicar HISTORIA
- POST `https://api.upload-post.com/api/upload_photos`
- multipart/form-data
- Campos: `user`, `title`, `description`, `platform[]=instagram`, `photos[]` (binary), `media_type=STORIES`

### Nodo 10: 🖼️ Publicar POST
- POST `https://api.upload-post.com/api/upload_photos`
- multipart/form-data
- Campos: `user`, `title`, `description`, `platform[]=instagram`, `photos[]` (binary)

### Nodo 11: ✅ Verificar Respuesta
- Code node. Comprueba `response.success === true`.
- Prepara el payload para actualizar Supabase.

### Nodo 12: 💾 Actualizar Estado en Supabase
- PATCH `/rest/v1/posts?id=eq.{postId}`
- Body JSON: `{ status, published_at, published_urls }`

---

## 5. Restricciones y Casos Borde

- **REEL sin vídeo en Supabase:** Si `image_url` apunta a una imagen en lugar de un vídeo, Upload-Post rechazará la solicitud. Verificar siempre que el bucket de Supabase contiene el tipo de archivo correcto para el `content_type`.
- **Tamaño de vídeo para Reels:** Instagram acepta hasta 300 MB / 15 min. El bucket de Supabase debe estar configurado para ficheros de ese tamaño.
- **HISTORIA vs POST:** La única diferencia en el payload es `media_type=STORIES`. Sin ese parámetro, se publica como post normal, no como historia efímera.
- **Convergencia de ramas:** Los tres nodos de publicación deben conectar al mismo nodo `✅ Verificar Respuesta`. En n8n, usar la opción de combinación de ramas (Merge node si es necesario, o conexión directa si la versión lo permite).
- **Timeout en vídeos grandes:** Para REELs pesados, añadir `async_upload=true` en el payload para evitar timeout de 30s en la conexión HTTP de n8n.

---

## 6. Historial de Aprendizaje (Memoria Viva)

| Fecha | Error | Causa | Solución |
|-------|-------|-------|----------|
| 2026-04-27 | Posts normales solo usaban `/upload_photos`. Reels y Historias no se publicaban correctamente. | El nodo de publicación era único y no diferenciaba por `content_type`. | Se añadieron dos nodos IF y tres ramas de publicación separadas en WF004. |
