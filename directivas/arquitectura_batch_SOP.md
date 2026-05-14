# DIRECTIVA: ARQUITECTURA BATCH DE CONTENIDO (100 Fotos a 5 por semana)

> **ID:** LOOPRA-ARCH-002
> **Última Actualización:** 2026-04-23
> **Estado:** ACTIVO

---

## 1. El Problema a Resolver
La agencia realiza sesiones fotográficas masivas (ej. 100 fotos de golpe). Si enviamos 100 fotos simultáneamente a OpenAI Vision a través de un Webhook, ocurrirán dos cosas:
1. Saturación de tokens y error de timeout en la API (Rate Limiting).
2. El calendario del cliente se llenará con 100 posts de golpe, lo cual es inmanejable para él a nivel de revisión.

## 2. La Solución: Arquitectura de "Goteo" (Drip Content)

La arquitectura pasa de ser "Reaccionar a un webhook" a ser un **"Sistema de Cron Job (Goteo)"**.

### Componente 1: El Banco de Recursos (Supabase Storage)
- La agencia sube las 100 fotos en bruto a un bucket de Supabase, en la carpeta del cliente: `storage/loopra_assets/{client_id}/banco_bruto/`.
- Esta subida es simple, no dispara IAs, solo guarda archivos.

### Componente 2: El Estratega Semanal (Workflow n8n - Cron)
- **Disparador:** Se ejecuta automáticamente cada Domingo a las 10:00 AM (o cuando el usuario pulse un botón de "Planificar Semana").
- **Lógica:**
  1. Conecta con Supabase y extrae 5 fotos aleatorias (o por orden) del `banco_bruto` del cliente.
  2. Mueve esas 5 fotos a la carpeta `banco_procesado` para no repetirlas.
  3. Envía esas 5 fotos a OpenAI GPT-4o Vision.
  4. La IA genera 5 posts, asignando fechas (Lunes, Martes, Miércoles, Jueves, Viernes).
  5. Inserta las 5 filas en `public.posts` con estado `PENDING_APPROVAL`.

### Componente 3: La Revisión del Cliente (App Web)
- El cliente entra al portal Loopra y ve solo los 5 posts de *esa* semana en su Bandeja. Los revisa, aprueba o rechaza.

### Componente 4: El Publicador Diario (Workflow n8n - Cron)
- Se ejecuta todos los días a cada hora en punto.
- Busca en `public.posts` donde `status = 'APPROVED'` y `proposed_date = HOY` y `proposed_time = AHORA`.
- Publica en Instagram/TikTok vía API y cambia el estado a `PUBLISHED`.

---

## 3. Ventajas de este modelo
- **Anti-Baneos:** Respeta los límites de OpenAI al procesar solo 5 fotos por lote.
- **Psicología del Cliente:** El cliente no se abruma. Solo tiene que aprobar "el trabajo de la semana".
- **Flexibilidad:** Si una semana decides que el cliente necesita 3 posts en lugar de 5, solo cambias la variable en el perfil del cliente.
