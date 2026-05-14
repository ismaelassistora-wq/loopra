-- 06_migration_upload_post_profile.sql

-- Añadir la columna a la tabla clients para guardar el perfil de Upload-Post
ALTER TABLE public.clients
ADD COLUMN upload_post_profile TEXT;

-- Añadir comentario descriptivo
COMMENT ON COLUMN public.clients.upload_post_profile IS 'Nombre del perfil creado en app.upload-post.com para publicar en redes sociales';
