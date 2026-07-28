-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Segmentação de despesas para Metas GMD
-- Guarda os valores manuais de "Tech HUB (TI/Marketing/Martech)" (segmentação de
-- Despesas Administrativas) e "Marketing"/"Martech" (segmentação de Despesas com
-- Vendas e Marketing) — só um informativo pra Metas GMD, não altera financial_data.
-- Só ADICIONA uma tabela nova — não mexe em nenhum dado existente.
-- Rode isso uma vez no SQL Editor do Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.gmd_expense_segments (
    id BIGSERIAL PRIMARY KEY,
    hotel TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    version_id TEXT NOT NULL DEFAULT '',  -- Versão de Orçamento (Meta)
    segment_key TEXT NOT NULL,  -- 'admin_ti' | 'admin_marketing' | 'admin_martech' | 'vendas_marketing' | 'vendas_martech'
    value NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (hotel, year, month, version_id, segment_key)
);

ALTER TABLE public.gmd_expense_segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated gmd_expense_segments" ON public.gmd_expense_segments;
CREATE POLICY "Allow all for authenticated gmd_expense_segments" ON public.gmd_expense_segments FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read gmd_expense_segments" ON public.gmd_expense_segments;
CREATE POLICY "Allow anon read gmd_expense_segments" ON public.gmd_expense_segments FOR SELECT TO anon USING (true);
