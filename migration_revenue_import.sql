-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Importação independente de Receitas (aba Importação > Receitas)
-- Este script só ADICIONA uma tabela nova — não mexe em nenhuma tabela existente.
-- Rode isso uma vez no SQL Editor do Supabase antes de usar a aba "Receitas".
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.revenue_import_data (
    id BIGSERIAL PRIMARY KEY,
    hotel TEXT NOT NULL,             -- hotel selecionado no import (contexto)
    hotel_raw TEXT,                  -- valor bruto da coluna "Empresa" da planilha
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    tipo TEXT,                       -- "Receita" ou "Despesa"
    cenario TEXT,                    -- "Real", "Meta" ou "Ano anterior"
    escopo TEXT,                     -- "Escopo" ou "Fora do escopo"
    cr TEXT,                         -- "CR Certo" bruto, como veio na planilha
    cr_matched TEXT,                 -- nome do Centro de Custo casado no cadastro (se achou)
    departamento TEXT,
    conta TEXT,                      -- "Descrição da Conta" bruta, como veio na planilha
    conta_matched TEXT,              -- nome da conta contábil casada no cadastro (se achou)
    value NUMERIC DEFAULT 0,
    import_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.revenue_import_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated revenue_import_data" ON public.revenue_import_data;
CREATE POLICY "Allow all for authenticated revenue_import_data" ON public.revenue_import_data FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read revenue_import_data" ON public.revenue_import_data;
CREATE POLICY "Allow anon read revenue_import_data" ON public.revenue_import_data FOR SELECT TO anon USING (true);
