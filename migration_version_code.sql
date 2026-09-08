-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Código de versão (ex.: "26.25.1")
-- Cada versão (Real ou Budget) passa a ter um código curto e único:
-- {2 últimos dígitos do ano}.{hotelId}.{sequência}, ex.: "26.25.1" = 2026, hotel
-- id 25 (João Pessoa), 1ª versão daquele hotel/ano. Uma réplica criada em Revisão
-- de Metas vira a próxima sequência (ex.: "26.25.2") — nunca reaproveita nome
-- pra identificar a versão, só o código, então duas versões com o MESMO nome
-- pro mesmo hotel/ano (o que causava confusão em Comparativos) ficam
-- inequivocamente diferentes pelo código.
-- Rode isso uma vez no SQL Editor do Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.budget_versions ADD COLUMN IF NOT EXISTS version_code TEXT;

-- Índice pra achar rápido "todas as versões desse hotel/ano" na hora de calcular a
-- próxima sequência (o app já filtra isso em memória, o índice só ajuda em bases
-- grandes).
CREATE INDEX IF NOT EXISTS idx_budget_versions_hotel_year ON public.budget_versions (hotel_id, year);
