-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Reuniões dinâmicas da DRE Forecast ("Versão do Forecast")
-- Antes, a Versão do Forecast era uma lista fixa de 5 nomes (Reunião de Ritmo, FCA
-- N1, FCA N2, Fechamento oficial, Realizado). Agora o usuário cria quantas
-- reuniões quiser por hotel/mês (cada uma com data + nome), via o botão "+ Criar
-- nova" no seletor "Versão do Forecast". Cada reunião tem um ID único (nunca o
-- nome) — assim duas reuniões com o mesmo nome no mesmo mês nunca colidem.
-- "Realizado" continua sendo uma opção fixa separada, fora desta tabela.
-- Rode isso uma vez no SQL Editor do Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.meetings (
    id TEXT PRIMARY KEY,               -- mtg_<slug-hotel>_<ano>_<mes>_<random>, nunca o nome/kind
    hotel_id TEXT NOT NULL,            -- nome do hotel (mesma convenção de validations.hotel_id)
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    meeting_date DATE NOT NULL,
    kind TEXT NOT NULL,                -- 'Reunião de Ritmo' | 'FCA N1' | 'FCA N2' | 'Fechamento' | 'Prévia'
    display_label TEXT NOT NULL,       -- kind literal, ou "Prévia de DD/MM/AAAA"
    created_by_user_id TEXT,
    created_by_user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated meetings" ON public.meetings;
CREATE POLICY "Allow all for authenticated meetings" ON public.meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read meetings" ON public.meetings;
CREATE POLICY "Allow anon read meetings" ON public.meetings FOR SELECT TO anon USING (true);

-- Campos novos em validations — denormalizados só pra exibição/filtro (ex.: ValidationsView),
-- NUNCA usados como chave de armazenamento (isso continua sendo validations.projection_type,
-- que agora guarda o ID único da reunião em vez do nome).
ALTER TABLE public.validations ADD COLUMN IF NOT EXISTS meeting_kind TEXT;
ALTER TABLE public.validations ADD COLUMN IF NOT EXISTS meeting_label TEXT;
ALTER TABLE public.validations ADD COLUMN IF NOT EXISTS meeting_date DATE;
