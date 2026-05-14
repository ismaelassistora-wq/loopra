# DIRECTIVA: MODERACIÓN DE COMENTARIOS CON IA (WF003)

> **ID:** LOOPRA-COMMENTS-003
> **Última Actualización:** 2026-04-23
> **Estado:** ACTIVO

---

## 1. El Problema a Resolver
Las marcas no solo publican contenido, sino que deben interactuar con su comunidad. Responder a todos los comentarios consume mucho tiempo. Sin embargo, automatizar las respuestas al 100% es arriesgado (ej. responder con un emoji feliz a una queja de intoxicación alimentaria).

## 2. La Solución: Triage de Sentimientos
El sistema no responde a ciegas. Actúa como un "filtro de triaje" en urgencias:

1. **Ingesta:** Entra un comentario de Instagram/TikTok vía Webhook.
2. **Análisis (GPT-4o):** La IA lee el comentario y lo clasifica en 4 sentimientos: `POSITIVE`, `NEUTRAL`, `NEGATIVE`, `CRITICAL`.
3. **Generación de Respuesta:** La IA redacta una respuesta basándose en el Tono de Voz del cliente guardado en Supabase.
4. **Decisión de Publicación (Regla de Negocio):**
   - Si es `POSITIVE` o `NEUTRAL`: La respuesta se inyecta directamente en la red social (`AUTO_PUBLISHED`) para fomentar el engagement rápido.
   - Si es `NEGATIVE` o `CRITICAL`: La respuesta se guarda en Supabase con estado `PENDING_REVIEW`. El cliente (o la agencia) recibe un aviso y debe aprobarla o editarla manualmente antes de que se publique.

---

## 3. Especificaciones de Entrada/Salida (I/O) en n8n

### Entradas (Webhook Payload Simulado)
- `client_id` (UUID)
- `post_id` (UUID)
- `platform` (str: instagram | tiktok)
- `comment_id_ext` (str: ID del comentario en la red social)
- `author_handle` (str: @usuario)
- `comment_text` (str)

### Salidas (Base de Datos)
- Inserción en la tabla `public.post_comments` con todos los metadatos y el sentimiento clasificado.
- Si el sentimiento permite auto-publicación, llamada HTTP a la API de la red social correspondiente.

---

## 4. Restricciones y Casos Borde
- **Crisis PR (Critical):** Cualquier comentario con insultos, amenazas legales o quejas graves de salud debe etiquetarse como `CRITICAL` y **NUNCA** responderse automáticamente. Se debe enviar alerta urgente.
- **Tono de Voz:** La IA debe forzarse estrictamente a usar el tono del cliente al generar el `ai_response`. Si el tono es formal, no puede usar emojis.
