-- ══════════════════════════════════════════════════════════════════════════════
-- CORREÇÃO: admin_save_user duplicada (erro 409 ao salvar/editar usuário)
-- A migração anterior (migration_user_multi_roles.sql) adicionou o parâmetro
-- "p_roles" na função admin_save_user, mas o Postgres não substitui uma função
-- quando a lista de parâmetros muda — ele cria uma SEGUNDA versão ao lado da
-- antiga. Com as duas coexistindo, o banco fica sem saber qual chamar (erro 409
-- "could not choose the best candidate function"). Este script remove só a
-- versão antiga (sem "roles"), mantendo a nova. Rode uma vez no SQL Editor do
-- Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.admin_save_user(
  text, text, text, text, text, text, boolean, boolean, boolean
);
