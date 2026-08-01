-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Comentários por célula na DRE Forecast
-- Permite anotar qualquer célula da tabela (linha + coluna: OTB, Prévia, Forecast,
-- Meta, deltas, Ano Anterior, KPI...) — comentário salvo por hotel/ano/mês/Versão
-- do Forecast. Usado pelo clique com botão direito do mouse em cima de uma célula.
-- Se você já rodou uma versão anterior desta migração (só com row_id, sem
-- column_id), rode este arquivo de novo — ele adiciona a coluna que faltava sem
-- mexer nos comentários já salvos.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.dre_row_comments (
    id TEXT PRIMARY KEY,  -- determinístico: hotel+ano+mês+versão+linha+coluna (ver ForecastTable.tsx)
    hotel TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    version_id TEXT NOT NULL DEFAULT '',
    row_id TEXT NOT NULL,
    column_id TEXT NOT NULL DEFAULT '',
    comment TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Caso a tabela já existisse (versão anterior desta migração, só com row_id).
ALTER TABLE public.dre_row_comments ADD COLUMN IF NOT EXISTS column_id TEXT NOT NULL DEFAULT '';
-- A constraint antiga (sem column_id) não faz mais sentido — o id já é determinístico
-- e único por hotel+ano+mês+versão+linha+coluna, então não precisa de outra UNIQUE.
ALTER TABLE public.dre_row_comments DROP CONSTRAINT IF EXISTS dre_row_comments_hotel_year_month_version_id_row_id_key;

ALTER TABLE public.dre_row_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated dre_row_comments" ON public.dre_row_comments;
CREATE POLICY "Allow all for authenticated dre_row_comments" ON public.dre_row_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read dre_row_comments" ON public.dre_row_comments;
CREATE POLICY "Allow anon read dre_row_comments" ON public.dre_row_comments FOR SELECT TO anon USING (true);
