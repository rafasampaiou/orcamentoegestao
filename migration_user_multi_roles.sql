-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Perfil de Acesso com múltipla seleção (usuários com mais de um perfil)
-- Adiciona a coluna "roles" (lista de perfis) em cost profiles e atualiza a RPC
-- admin_save_user pra gravar essa lista também. Não mexe em nenhum dado existente —
-- "role" (perfil único, legado) continua funcionando normalmente.
-- Rode isso uma vez no SQL Editor do Supabase antes de usar a seleção múltipla de
-- perfis em Administração > Usuários.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS roles JSONB DEFAULT '[]'::jsonb;

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
BEGIN
  -- Tentar encontrar o usuário no Auth pelo email
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Usuário já existe. Se passou senha, tenta atualizar.
    IF p_password IS NOT NULL AND p_password != '' THEN
      UPDATE auth.users
      SET encrypted_password = crypt(p_password, gen_salt('bf')),
          updated_at = now()
      WHERE id = v_user_id;
    END IF;
  ELSE
    -- Opcional: Se passaram um UUID, tentamos usar, caso contrário geramos um
    BEGIN
      v_user_id := p_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_user_id := gen_random_uuid();
    END;

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
