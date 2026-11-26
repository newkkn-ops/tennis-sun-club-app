-- =========================================================================
-- [Supabase 기본 관리자(Admin) 계정 생성 및 public.users 등록 SQL]
-- 아이디: admin
-- 가상 이메일: admin@suntennis.local
-- 기본 비밀번호: admin1234 (또는 희망하는 비밀번호로 변경 가능)
-- 권한: role = 'admin' (운영 관리 및 전체 제어 권한)
-- 승인 상태: approval_status = 'approved' (즉시 로그인 가능)
-- =========================================================================

-- 1. pgcrypto 확장 활성화 (비밀번호 안전 암호화 해싱용)
create extension if not exists pgcrypto;

-- 2. auth.users 테이블에 admin 계정 등록/갱신
do $$
declare
  v_admin_id uuid;
begin
  select id into v_admin_id from auth.users where email = 'admin@suntennis.local';

  if v_admin_id is null then
    v_admin_id := gen_random_uuid();
    
    insert into auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud,
      confirmation_token
    ) values (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'admin@suntennis.local',
      crypt('admin1234', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"공유 관리자","username":"admin","role":"admin","grade":"금배","gender":"M","approval_status":"approved"}'::jsonb,
      now(),
      now(),
      'authenticated',
      'authenticated',
      ''
    );
  else
    update auth.users
    set encrypted_password = crypt('admin1234', gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = raw_user_meta_data || '{"role":"admin","approval_status":"approved"}'::jsonb,
        updated_at = now()
    where id = v_admin_id;
  end if;

  -- 3. public.users 테이블에 admin 레코드 upsert (role: 'admin', approval_status: 'approved')
  insert into public.users (
    id,
    username,
    email,
    name,
    gender,
    grade,
    role,
    approval_status,
    is_guest,
    requested_at,
    created_at
  ) values (
    v_admin_id,
    'admin',
    'admin@suntennis.local',
    '공유 관리자',
    'M',
    '금배',
    'admin',
    'approved',
    false,
    now(),
    now()
  )
  on conflict (username) do update set
    id = excluded.id,
    email = excluded.email,
    name = '공유 관리자',
    gender = 'M',
    grade = '금배',
    role = 'admin',
    approval_status = 'approved',
    is_guest = false;

  -- status 컬럼이 존재하는 경우 status도 approved로 갱신 (호환성 보장)
  begin
    update public.users set status = 'approved' where username = 'admin';
  exception when undefined_column then
    -- status 컬럼 없으면 무시
  end;

end $$;
