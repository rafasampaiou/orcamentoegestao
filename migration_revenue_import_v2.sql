-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: adiciona Versão de Destino / Destino na importação de Receitas
-- Só ADICIONA colunas novas na tabela revenue_import_data (criada pelo
-- migration_revenue_import.sql) — não mexe em nenhum dado existente.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.revenue_import_data
  ADD COLUMN IF NOT EXISTS version_id TEXT,
  ADD COLUMN IF NOT EXISTS destino TEXT;
