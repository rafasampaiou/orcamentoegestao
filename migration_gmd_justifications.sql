-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Persistência dos Planos de Ação (Justification) do Metas GMD
-- Hoje os planos de ação ficam só em memória (somem ao recarregar a tela). Esta
-- tabela passa a guardar status/plano/datas/observações de verdade, amarrados a
-- hotel/ano/mês/versão — assim o que já foi preenchido não se perde conforme a
-- mesma versão avança de estágio (Reunião de Ritmo → FCA N1 → ... → Fechamento).
-- Só ADICIONA uma tabela nova — não mexe em nenhum dado existente.
-- Rode isso uma vez no SQL Editor do Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.gmd_justifications (
    id TEXT PRIMARY KEY,
    hotel TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    version_id TEXT NOT NULL DEFAULT '',
    gmd_config_id TEXT,
    account_id TEXT NOT NULL,
    account_name TEXT,
    meta NUMERIC DEFAULT 0,
    forecast NUMERIC DEFAULT 0,
    previa NUMERIC DEFAULT 0,
    delta_r NUMERIC DEFAULT 0,
    delta_pct NUMERIC DEFAULT 0,
    explanation TEXT,
    status TEXT DEFAULT 'Pendentes',
    rejection_reason TEXT,
    action_plan TEXT,
    action_plan_start_date TEXT,
    action_plan_end_date TEXT,
    action_plan_presentation_date TEXT,
    recovered_value NUMERIC,
    completion_observation TEXT,
    assigned_area_manager_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.gmd_justifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated gmd_justifications" ON public.gmd_justifications;
CREATE POLICY "Allow all for authenticated gmd_justifications" ON public.gmd_justifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read gmd_justifications" ON public.gmd_justifications;
CREATE POLICY "Allow anon read gmd_justifications" ON public.gmd_justifications FOR SELECT TO anon USING (true);
