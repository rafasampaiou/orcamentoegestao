-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Comentários por linha na DRE Forecast
-- Permite anotar qualquer linha da tabela (comentário salvo por hotel/ano/mês/versão
-- do Forecast) — usado pelo clique com botão direito do mouse em cima de uma linha.
-- Só ADICIONA uma tabela nova — não mexe em nenhum dado existente.
-- Rode isso uma vez no SQL Editor do Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.dre_row_comments (
    id TEXT PRIMARY KEY,  -- determinístico: hotel+ano+mês+versão+linha (ver ForecastTable.tsx)
    hotel TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    version_id TEXT NOT NULL DEFAULT '',
    row_id TEXT NOT NULL,
    comment TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (hotel, year, month, version_id, row_id)
);

ALTER TABLE public.dre_row_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated dre_row_comments" ON public.dre_row_comments;
CREATE POLICY "Allow all for authenticated dre_row_comments" ON public.dre_row_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read dre_row_comments" ON public.dre_row_comments;
CREATE POLICY "Allow anon read dre_row_comments" ON public.dre_row_comments FOR SELECT TO anon USING (true);
