-- ══════════════════════════════════════════════════════════════════════════════
-- CORREÇÃO: admin_save_user falhando ao editar usuário existente (erro 23505,
-- "duplicate key value violates unique constraint users_pkey")
--
-- Causa: a função procurava o usuário em auth.users só pelo e-mail. Se o e-mail
-- salvo em "profiles" ficou dessincronizado do que está em "auth.users" (por
-- qualquer motivo, de antes dessas mudanças), a busca não encontra ninguém,
-- a função tenta INSERIR um usuário novo com o mesmo ID que já existe, e o
-- banco rejeita por causa da chave primária duplicada.
--
-- Correção: procura primeiro pelo ID informado (confiável — é o mesmo ID que já
-- existe tanto em profiles quanto em auth.users quando é uma edição), e só cai
-- pra busca por e-mail se não achar (caso de usuário novo de verdade). Também
-- sincroniza o e-mail em auth.users com o que foi salvo, pra esse desalinhamento
-- não voltar a acontecer.
--
-- Rode isso uma vez no SQL Editor do Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION admin_save_user(
  p_id text,
  p_email text,
  p_password text,
  p_name text,
  p_role text,
  p_hotel_id text,
  p_can_admin boolean,
  p_can_geral boolean,
  p_can_cadastros boolean,
  p_roles jsonb DEFAULT '[]'::jsonb
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_id_candidate uuid;
BEGIN
  -- p_id só é um UUID válido de verdade quando é a edição de um usuário já existente
  -- (usuário novo chega com um id provisório tipo "u-1234567890", que não é UUID).
  BEGIN
    v_id_candidate := p_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_id_candidate := NULL;
  END;

  IF v_id_candidate IS NOT NULL THEN
    SELECT id INTO v_user_id FROM auth.users WHERE id = v_id_candidate LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;
  END IF;

  IF v_user_id IS NOT NULL THEN
    -- Usuário já existe. Se passou senha, tenta atualizar.
    IF p_password IS NOT NULL AND p_password != '' THEN
      UPDATE auth.users
      SET encrypted_password = crypt(p_password, gen_salt('bf')),
          updated_at = now()
      WHERE id = v_user_id;
    END IF;

    -- Mantém o e-mail de auth.users sincronizado com o que foi salvo no formulário —
    -- evita esse mesmo desalinhamento acontecer de novo no futuro.
    UPDATE auth.users
    SET email = p_email, updated_at = now()
    WHERE id = v_user_id AND email IS DISTINCT FROM p_email;
  ELSE
    v_user_id := COALESCE(v_id_candidate, gen_random_uuid());

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', p_email, crypt(p_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', p_name), now(), now(), '', '', '', ''
    );
  END IF;

  -- Sincronizar dados em public.profiles
  INSERT INTO public.profiles (
    id, email, full_name, role, roles, hotel_id, can_access_admin, can_access_geral, can_access_cadastros, temp_password, created_at, updated_at
  )
  VALUES (
    v_user_id::text, p_email, p_name, p_role, p_roles, p_hotel_id, p_can_admin, p_can_geral, p_can_cadastros, p_password, now(), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    roles = EXCLUDED.roles,
    hotel_id = EXCLUDED.hotel_id,
    can_access_admin = EXCLUDED.can_access_admin,
    can_access_geral = EXCLUDED.can_access_geral,
    can_access_cadastros = EXCLUDED.can_access_cadastros,
    temp_password = COALESCE(NULLIF(EXCLUDED.temp_password, ''), public.profiles.temp_password),
    updated_at = now();

  RETURN v_user_id::text;
END;
$$;
