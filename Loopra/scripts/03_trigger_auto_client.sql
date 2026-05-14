-- ==============================================================================
-- LOOPRA — Automatización de Registro (Trigger Supabase)
-- Ejecutar en: Supabase SQL Editor
-- ==============================================================================

-- 1. Crear la función que inserta al cliente automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.clients (auth_user_id, name, industry)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'name', 'Nuevo Cliente'), -- Si envías un nombre en la metadata, lo usa
    'General'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear el Trigger que escucha la creación de usuarios en Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
