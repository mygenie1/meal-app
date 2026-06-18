-- admin-manage-migration.sql
-- Supabase SQL Editor에서 실행
--
-- 서브 관리자 생성 RPC
-- 비밀번호를 DB 내부에서 bcrypt 해시로 저장 (평문이 함수 밖으로 나가지 않음)
-- role은 'sub'로 고정 (이 RPC로 super 생성 불가)
--
-- fix: search_path에 extensions 추가 + gen_salt/crypt 스키마 명시
-- Supabase에서 pgcrypto는 extensions 스키마에 설치되므로
-- SECURITY DEFINER 함수의 SET search_path = public 만으로는 못 찾음

CREATE OR REPLACE FUNCTION create_admin_account(
  p_username    TEXT,
  p_password    TEXT,
  p_permissions JSONB,
  p_created_by  UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO admin_accounts (username, password_hash, role, permissions, is_active, created_by, created_at)
  VALUES (
    p_username,
    extensions.crypt(p_password, extensions.gen_salt('bf', 12)),
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
