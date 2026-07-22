-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Coluna "cenario" no Histórico de Importações (import_history)
-- Guarda o(s) cenário(s) do lançamento (Real / Meta / Ano anterior), usado hoje
-- pela importação de Receitas para mostrar isso junto do Tipo no histórico.
-- Só ADICIONA uma coluna nova — não mexe em nenhum dado existente.
-- Rode isso uma vez no SQL Editor do Supabase antes de importar Receitas de novo.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.import_history
  ADD COLUMN IF NOT EXISTS cenario TEXT;
