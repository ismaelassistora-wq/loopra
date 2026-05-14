-- ==============================================================================
-- LOOPRA — Políticas de Storage para subida de archivos (Agencia)
-- ==============================================================================

-- Permitir a los usuarios autenticados subir archivos al bucket 'loopra'
CREATE POLICY "Authenticated users can upload" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'loopra');
