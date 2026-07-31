-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Resumo do balancete importado, pra dar pra "Revisar" a etapa depois
-- Guarda o resumo completo (totais, setores fora do escopo, contas fora do escopo)
-- de cada importação de balancete por CR — sem isso, clicar em "Revisar" na etapa
-- "Inserir despesas do balancete por CR" não tinha como mostrar de novo a tabela de
-- resumo (só existia em memória enquanto o modal de import estava aberto).
-- Só ADICIONA uma coluna nova — não mexe em nenhum dado existente.
-- Rode isso uma vez no SQL Editor do Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.import_history ADD COLUMN IF NOT EXISTS resumo_balancete JSONB;
