-- ==============================================================================
-- LOOPRA — Migración v1.1: Añadir campos content_type y proposed_time a posts
-- Ejecutar en: Supabase SQL Editor
-- ==============================================================================

-- Añadir tipo de contenido (POST, REEL, HISTORIA)
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'POST';

-- Añadir hora propuesta de publicación
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS proposed_time TIME DEFAULT '18:00:00';

-- Verificar resultado
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'posts' 
ORDER BY ordinal_position;
