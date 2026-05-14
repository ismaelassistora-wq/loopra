# Directiva: Regenerador de Posts Individuales (WF005)

## Objetivo
Permitir a los clientes y a la agencia rechazar un post generado en batch (WF002) y solicitar a la inteligencia artificial la creación de una **alternativa completamente nueva**, utilizando contenido multimedia fresco del repositorio, sin necesidad de esperar al siguiente ciclo semanal.

## Reglas de Arquitectura
1. **Conservación del Historial**: El post original debe mantenerse en la base de datos con el estado `REJECTED`. No se debe eliminar para permitir su recuperación manual si el cliente cambia de opinión y para entrenar a la IA en un futuro con casos de "lo que el cliente no quiere".
2. **Entrada de Datos (Webhook)**:
   - `client_id`: UUID del cliente.
   - `content_type`: El tipo de post requerido (`POST`, `REEL`, `HISTORIA`).
   - `proposed_date` y `proposed_time`: Para mantener el espacio temporal del calendario.
   - `platform`: Array con las plataformas destino.
   - `slot_label`: Para el contexto del IA.
3. **Manejo del Banco Bruto**: El flujo debe listar la carpeta `banco_bruto` del cliente. Si no hay archivos disponibles del tipo requerido (vídeo para Reels, imagen para Posts), el flujo debe detenerse y devolver un error HTTP claro al SaaS para informar al usuario de que debe subir más contenido.
4. **Desacople de URLs**: Igual que en WF002, se generará una `imageUrl` apuntando a `banco_bruto` para el análisis de GPT-4o, y una `finalUrl` apuntando a `banco_procesado` para el almacenamiento en la base de datos.
5. **Estado Inicial**: El nuevo post se debe insertar en Supabase con el estado `PENDING_APPROVAL` para obligar al cliente a revisarlo.

## Restricciones y Casos Borde (Trampas Conocidas)
- **Límites de OpenAI Vision**: OpenAI no admite el procesamiento directo de archivos de vídeo (`.mp4`, `.mov`). Si el `content_type` es `REEL`, el flujo solo debe enviar a GPT-4o el nombre del archivo y el contexto del negocio (Ajustes IA), pero NUNCA la URL del vídeo como objeto de imagen, ya que provocará un fallo de API.
- **Concurrencia de Movimientos**: El nodo de movimiento HTTP (Supabase Storage Move) falla si se le pasa una URL cruda. Debe construirse el payload con `bucketId`, `sourceKey` y `destinationKey`. El archivo solo debe moverse a `banco_procesado` si la inserción en la base de datos es exitosa.

## Salida Esperada
- Un nuevo registro en la tabla `posts`.
- Movimiento exitoso del archivo físico de `banco_bruto/` a `banco_procesado/`.
- Respuesta HTTP 200 OK al SaaS confirmando el éxito.
