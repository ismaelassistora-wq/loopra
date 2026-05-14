-- ==============================================================================
-- LOOPRA — Migración v1.2 (Conocimiento de Empresa y Permisos)
-- ==============================================================================

-- 1. Añadir columna de Conocimiento de Empresa (Base de Datos Vectorial / Texto Largo)
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS company_knowledge TEXT;

-- 2. Añadir política de UPDATE para que el cliente pueda editar su propio perfil
-- (Esto arregla el error al guardar en la pestaña de Ajustes)
CREATE POLICY "Clients can update own profile" 
ON public.clients FOR UPDATE 
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);
