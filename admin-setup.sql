-- ============================================================
-- 관리자 시스템 DB 설정 — Supabase SQL Editor에서 실행
-- ============================================================

-- 1. pgcrypto 확장 (bcrypt 해시/검증)
create extension if not exists pgcrypto;

-- 2. admin_accounts 테이블
create table if not exists admin_accounts (
  id            uuid        primary key default gen_random_uuid(),
  username      text        unique not null,
  password_hash text        not null,
  role          text        not null check (role in ('super', 'sub')),
  permissions   jsonb       not null default '{}',
  created_by    uuid        references admin_accounts(id) on delete set null,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now()
);

-- 3. RLS 활성화 + 정책 없음 → 클라이언트(anon/authenticated) 직접 접근 불가
--    service-role key를 사용하는 Edge Function만 접근 가능
alter table admin_accounts enable row level security;

-- 4. 비밀번호 검증 RPC
--    security definer: 함수 소유자 권한으로 실행 (RLS 우회)
--    revoke: anon/authenticated/public에서 직접 호출 차단
--    Edge Function이 service-role key로만 호출
create or replace function verify_admin_password(p_username text, p_password text)
returns table(
  id          uuid,
  username    text,
  role        text,
  permissions jsonb
)
language sql security definer as $$
  select id, username, role, permissions
  from admin_accounts
  where username      = p_username
    and is_active     = true
    and password_hash = crypt(p_password, password_hash);
$$;

revoke execute on function verify_admin_password(text, text) from public, anon, authenticated;
grant  execute on function verify_admin_password(text, text) to service_role;

-- ============================================================
-- 5. 총괄 관리자(super) 1개 생성
--    ★ username과 비밀번호를 원하는 값으로 변경 후 실행
-- ============================================================
insert into admin_accounts (username, password_hash, role, permissions)
values (
  'superadmin',                                          -- ★ 원하는 username으로 변경
  crypt('change-this-password', gen_salt('bf', 12)),   -- ★ 원하는 비밀번호로 변경
  'super',
  '{
    "view_users":        true,
    "delete_users":      true,
    "view_spaces":       true,
    "read_space_content":true,
    "view_feedback":     true,
    "manage_admins":     true
  }'::jsonb
)
on conflict (username) do nothing;

-- ============================================================
-- permissions 키 목록 (서브 관리자 생성 시 참고)
-- ============================================================
-- view_users        : 사용자 목록 조회
-- delete_users      : 사용자 삭제
-- view_spaces       : 스페이스 목록 조회
-- read_space_content: 스페이스 내 식사/재료 조회
-- view_feedback     : 피드백/신고 조회
-- manage_admins     : 서브 관리자 생성/관리
