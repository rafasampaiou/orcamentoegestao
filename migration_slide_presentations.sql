-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Rastreio de apresentações geradas no Google Slides
-- Guarda qual apresentação (ID do Google Slides) já foi gerada pra cada combinação
-- de hotel + ano + mês + versão do Forecast — assim o botão "Gerar Apresentação"
-- sabe quando já existe uma e pode perguntar "Atualizar existente" ou "Criar nova
-- versão" em vez de sempre criar um arquivo novo sem controle.
-- Rode isso uma vez no SQL Editor do Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.slide_presentations (
    -- Determinístico: hotel+ano+mês+versão (ver App.tsx) — "Atualizar existente" upserta na
    -- mesma linha; "Criar nova versão" grava com um sufixo de data/hora, gerando outra linha.
    id TEXT PRIMARY KEY,
    hotel TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    projection_type TEXT NOT NULL,
    presentation_id TEXT NOT NULL,       -- ID do arquivo no Google Slides
    presentation_url TEXT,               -- link direto pra abrir
    drive_folder_id TEXT,                -- pasta (hotel/ano) onde a cópia foi salva
    created_by_user_id TEXT,
    created_by_user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.slide_presentations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated slide_presentations" ON public.slide_presentations;
CREATE POLICY "Allow all for authenticated slide_presentations" ON public.slide_presentations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read slide_presentations" ON public.slide_presentations;
CREATE POLICY "Allow anon read slide_presentations" ON public.slide_presentations FOR SELECT TO anon USING (true);
