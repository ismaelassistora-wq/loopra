-- 07_storage_insert_policy.sql

-- Permitir a los usuarios autenticados (y anónimos si es necesario) subir archivos al bucket loopra
CREATE POLICY "Allow public uploads to Loopra bucket" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'loopra');

-- También necesitamos permitir a los usuarios actualizar sus propios archivos si lo intentan
CREATE POLICY "Allow public updates to Loopra bucket" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'loopra');

-- Y si la agencia quiere borrar fotos
CREATE POLICY "Allow public deletes to Loopra bucket" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'loopra');
