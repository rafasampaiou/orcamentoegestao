-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Overrides manuais da aba "Análise de A&B"
-- Guarda os valores de Receita (Alimentos/Bebidas, Inclusos/Extras) editados/digitados
-- manualmente por cima do que veio da importação de Receitas (Administração > Importação
-- > Receitas), por hotel/ano/mês/versão/linha/cenário (Realizado/Meta/Ano anterior).
-- Só ADICIONA uma tabela nova — não mexe em nenhuma tabela existente.
-- Rode isso uma vez no SQL Editor do Supabase antes de editar valores na aba Análise de A&B.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ab_analysis_overrides (
    id BIGSERIAL PRIMARY KEY,
    hotel TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    version_id TEXT NOT NULL DEFAULT '',
    line_key TEXT NOT NULL,     -- 'alimentos_inclusos' | 'alimentos_extras' | 'bebidas_inclusas' | 'bebidas_extras'
    scenario TEXT NOT NULL,     -- 'REALIZADO' | 'META' | 'ANO_ANTERIOR'
    value NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (hotel, year, month, version_id, line_key, scenario)
);

ALTER TABLE public.ab_analysis_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated ab_analysis_overrides" ON public.ab_analysis_overrides;
CREATE POLICY "Allow all for authenticated ab_analysis_overrides" ON public.ab_analysis_overrides FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read ab_analysis_overrides" ON public.ab_analysis_overrides;
CREATE POLICY "Allow anon read ab_analysis_overrides" ON public.ab_analysis_overrides FOR SELECT TO anon USING (true);
