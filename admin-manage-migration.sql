-- admin-manage-migration.sql
-- Supabase SQL Editor에서 실행
--
-- 서브 관리자 생성 RPC
-- 비밀번호를 DB 내부에서 bcrypt 해시로 저장 (평문이 함수 밖으로 나가지 않음)
-- role은 'sub'로 고정 (이 RPC로 super 생성 불가)

CREATE OR REPLACE FUNCTION create_admin_account(
  p_username    TEXT,
  p_password    TEXT,
  p_permissions JSONB,
  p_created_by  UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO admin_accounts (username, password_hash, role, permissions, is_active, created_by, created_at)
  VALUES (
    p_username,
    crypt(p_password, gen_salt('bf', 12)),
    'sub',
    p_permissions,
    true,
    p_created_by,
    now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
