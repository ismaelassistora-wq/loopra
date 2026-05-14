# DIRECTIVA: PRODUCCION_CONTENIDO_MENSUAL — Fotoshoot a Calendario de Publicación

> **ID:** LOOPRA-WF-001
> **Última Actualización:** 2026-04-23
> **Estado:** ACTIVO

---

## 1. Objetivos y Alcance

- **Objetivo Principal:** Recibir un lote de fotos/vídeos subidos por la agencia para un cliente, analizarlos con IA y generar automáticamente un calendario de publicaciones mensual organizado en Posts, Reels e Historias con copy, hashtags y fecha propuesta. Todo queda en Supabase con `status = PENDING_APPROVAL` para revisión del cliente.
- **Criterio de Éxito:** Por cada archivo subido existe una fila en `posts` con copy, hashtags, content_type, proposed_date y proposed_time calculados. El cliente recibe una notificación en su portal.

---

## 2. Especificaciones de Entrada/Salida (I/O)

### Entradas (Inputs)

- **Trigger:** Webhook POST `/webhook/loopra/upload` desde el panel de producción (Antigravity — rol Agencia)
- **Payload esperado:**
  ```json
  {
    "client_id": "uuid",
    "uploaded_by": "uuid",
    "files": [
      {
        "path": "loopra/{client_id}/photoshoot_2024-04/{filename}",
        "filename": "foto1.jpg",
        "content_type": "image/jpeg"
      }
    ],
    "notes": "Sesión restaurante, ambiente de tarde"
  }
  ```

### Salidas (Outputs)

- Registro en `posts` por cada archivo
- Notificación al cliente vía webhook secundario

---

## 3. Lógica de Calendario Mensual

### Distribución de Contenido por Tipo

Dado un lote de N archivos, el sistema asigna tipos de la siguiente forma:\n- **Posts** (imágenes cuadradas/horizontales, texto largo)\n- **Reels** (vídeos)\n- **Historias** (imágenes efímeras, formato vertical)\n\nSi el archivo es `video/*` → siempre se clasifica como Reel.\nSi el archivo es `image/*` → app.js lee sus dimensiones antes de subirlo y, si es formato vertical (alto > ancho * 1.2), lo etiqueta como Historia (`historia_...jpg`). Si no, como Post (`post_...jpg`). WF001 simplemente lee este prefijo en el nombre.

### Lógica de Fechas (Algoritmo de Spacing)

```
días_disponibles_mes = 28 (siempre usar 28 para evitar problemas fin de mes)
intervalo = floor(días_disponibles_mes / N_archivos)
fecha_post[i] = primer_día_mes + (i * intervalo)
```

- Posts → publicar Lunes, Miércoles, Viernes a las 18:00
- Reels → publicar Martes, Sábado a las 20:00
- Historias → publicar cualquier día a las 09:00

Si la fecha calculada cae en fin de semana para un Post, mover al siguiente lunes.

---

## 4. Flujo Lógico — Nodos n8n (LOOPRA-WF-001)

### Nodo 1: Webhook Trigger
- Escucha POST `/loopra/upload`
- Extrae: `client_id`, `files[]`, `uploaded_by`, `notes`

### Nodo 2: Get Cliente de Supabase
- GET `/rest/v1/clients?id=eq.{client_id}&select=*`
- Headers: `apikey` + `Authorization: Bearer SERVICE_KEY`
- **Edge case:** Si el array devuelto está vacío → responder 404 y detener

### Nodo 3: Validar Cliente (IF node)
- Condición: `{{ $json.length > 0 }}`
- True → continuar
- False → responder 404 "Cliente no encontrado"

### Nodo 4: Code — Preparar Items de Archivos
- Recibe: `files[]` del webhook + datos del cliente
- Devuelve: N items (uno por archivo), cada uno con:
  - `file_path`, `filename`, `content_type`
  - `client_id`, `client_name`, `industry`, `tone_of_voice`, `brand_keywords`
  - `file_index` (0, 1, 2...), `total_files` (N)
  - `content_type_assigned` (POST / REEL / HISTORIA según lógica)
  - `proposed_date`, `proposed_time` (calculados aquí)
  - `image_url_public` (URL pública Supabase Storage)

### Nodo 5: HTTP Request — OpenAI GPT-4 Vision
- POST `https://api.openai.com/v1/chat/completions`
- Model: `gpt-4o` (soporta Vision y es más barato que gpt-4-vision-preview)
- Prompt dinámico con: industry, tone_of_voice, brand_keywords, content_type_assigned
- Response format: JSON estricto con `copy_text`, `hashtags[]`, `mood`, `description`

### Nodo 6: Code — Parsear Respuesta IA
- Limpia la respuesta con try/catch + regex (extraer entre `{` y `}`)
- Combina con los datos de calendario calculados en el Nodo 4
- Output: item listo para insertar en Supabase

### Nodo 7: HTTP Request — Insertar Post en Supabase
- POST `/rest/v1/posts`
- Header `Prefer: return=representation` para obtener el ID

### Nodo 8: HTTP Request — Notificar al Cliente
- POST al webhook de notificación con el resumen del calendario creado
- Body: `{ client_id, posts_created: N, portal_url }`

### Nodo 9: Respond to Webhook
- 200 OK con resumen de posts creados

---

## 5. Restricciones y Casos Borde

- **GPT-4o Vision:** Usar la URL pública de Supabase Storage. El bucket debe ser público.
- **JSON sucio de GPT:** Siempre parsear con try/catch. Regex: `/\{[\s\S]*\}/` para extraer el JSON.
- **Archivos de vídeo:** GPT-4o no analiza vídeos directamente. Para Reels usar el primer frame o el thumbnail. En v1: enviar el filename y notes como contexto en lugar de la imagen.
- **Rate limits OpenAI:** Procesar archivos secuencialmente (un item por vez), no en paralelo.
- **Lote grande (>20 fotos):** Limitar a 20 archivos por llamada al webhook. Si hay más, hacer múltiples llamadas.

---

## 6. Historial de Aprendizaje (Memoria Viva)

| Fecha | Error | Causa | Solución |
|-------|-------|-------|----------|
| 2026-05-11 | Imágenes cuadradas/horizontales se subían como historias y se veían borrosas al deformarse en Instagram. | La función `assignContentType` en WF001 distribuía HISTORIAs de forma ciega por índice (20%), ignorando las dimensiones reales de las imágenes. | **Corrección en app.js y WF001:** Ahora `app.js` detecta el aspect ratio antes de subir a Supabase. Si la altura > ancho * 1.2, nombra el archivo como `historia_...`. WF001 lee este prefijo para asignar el tipo correcto de forma fiable. |
| — | — | — | — |
| 2026-04-27 | Imágenes con índice 60–84% del lote se guardaban con `content_type = REEL`. Al publicarlas, WF004 las enviaba al endpoint `/api/upload` (vídeo), causando fallo. | La función `assignContentType` en WF001 distribuía REELs por índice sin distinguir el tipo real de archivo. | **Corrección en WF001:** `assignContentType` ahora solo asigna REEL si `file.content_type.startsWith('video/')`. Las imágenes solo pueden ser POST (80%) o HISTORIA (20%). |


---

## 7. Prompt Maestro para GPT-4o Vision

```
Eres un estratega experto en redes sociales para negocios de [industry] en España.
Analiza esta imagen y genera el contenido para un [content_type] en Instagram.
Tono de voz del cliente: [tone_of_voice]
Palabras clave de marca: [brand_keywords]

Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:
{
  "copy_text": "texto completo del post, máximo 300 caracteres para POST/HISTORIA, 150 para REEL",
  "hashtags": ["hashtag1", "hashtag2", ... máximo 15],
  "mood": "descripción breve de la sensación visual",
  "description": "descripción objetiva de lo que aparece en la imagen"
}
No incluyas texto adicional fuera del JSON. Responde siempre en español.
```
