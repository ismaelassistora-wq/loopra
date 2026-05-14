-- ==============================================================================
-- LOOPRA SAAS - Esquema Base de Datos Supabase (v1)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONES Y CONFIGURACIÓN INICIAL
-- ------------------------------------------------------------------------------
-- Habilitar extensión pgcrypto para generación de UUIDs (aunque Supabase ya usa uuid-ossp)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 2. TABLA: clients
-- ------------------------------------------------------------------------------
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    industry TEXT,
    tone_of_voice TEXT,
    brand_keywords TEXT[],
    portal_url TEXT,
    notify_email TEXT,
    notify_phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Enlazar con auth.users para que el cliente pueda loguearse y ver solo sus datos
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------------------------
-- 3. TABLA: posts
-- ------------------------------------------------------------------------------
-- Tipos enumerados para estados
CREATE TYPE post_status AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PUBLISHED', 'FAILED');

CREATE TABLE public.posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    status post_status DEFAULT 'PENDING_APPROVAL',
    image_url TEXT NOT NULL,
    copy_text TEXT,
    hashtags TEXT[],
    proposed_date DATE,
    platform TEXT[], -- ej: '{instagram, tiktok}'
    ai_analysis JSONB,
    rejection_note TEXT,
    published_urls JSONB,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Usuario de la agencia
    created_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- 4. TABLA: post_comments
-- ------------------------------------------------------------------------------
CREATE TYPE comment_sentiment AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'CRITICAL');
CREATE TYPE comment_response_status AS ENUM ('PENDING_REVIEW', 'AUTO_PUBLISHED', 'APPROVED', 'REJECTED');

CREATE TABLE public.post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    comment_id_ext TEXT NOT NULL,
    author_handle TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    sentiment comment_sentiment,
    ai_response TEXT,
    response_status comment_response_status DEFAULT 'PENDING_REVIEW',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. SEGURIDAD (ROW LEVEL SECURITY - RLS)
-- ------------------------------------------------------------------------------
-- Activar RLS en todas las tablas
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- Políticas para 'clients'
-- Los clientes solo pueden leer su propio perfil
CREATE POLICY "Clients can view own profile" 
ON public.clients FOR SELECT 
USING (auth.uid() = auth_user_id);

-- Políticas para 'posts'
-- Los clientes solo pueden ver sus propios posts
CREATE POLICY "Clients can view own posts" 
ON public.posts FOR SELECT 
USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

-- Los clientes solo pueden actualizar el estado de SUS propios posts (Aprobar/Rechazar)
CREATE POLICY "Clients can update status of own posts" 
ON public.posts FOR UPDATE 
USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()))
WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

-- Políticas para 'post_comments'
-- Los clientes solo pueden ver comentarios de sus posts
CREATE POLICY "Clients can view comments on own posts" 
ON public.post_comments FOR SELECT 
USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

-- Los clientes pueden aprobar o rechazar respuestas a comentarios
CREATE POLICY "Clients can update own comments" 
ON public.post_comments FOR UPDATE 
USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()))
WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

-- ------------------------------------------------------------------------------
-- 6. BUCKET DE STORAGE (IMÁGENES)
-- ------------------------------------------------------------------------------
-- NOTA: Esto se debe ejecutar en el SQL Editor de Supabase
INSERT INTO storage.buckets (id, name, public) 
VALUES ('loopra', 'loopra', true) 
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage para que Antigravity (público) pueda ver las imágenes
CREATE POLICY "Public Access to Loopra Images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'loopra');
