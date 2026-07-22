-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Nomes secundários (aliases) para Setores (cost_centers)
-- Só ADICIONA uma coluna nova — não mexe em nenhum dado existente.
-- Rode isso uma vez no SQL Editor do Supabase antes de usar o campo de nomes
-- secundários na tela de Administração > Setores.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.cost_centers
  ADD COLUMN IF NOT EXISTS aliases JSONB DEFAULT '[]'::jsonb;
