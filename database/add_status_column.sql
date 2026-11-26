-- =========================================================================
-- [Supabase public.users 테이블 승인 상태(status) 컬럼 추가 SQL]
-- =========================================================================

-- 1. public.users 테이블에 status 컬럼 추가 (기본값: 'pending')
alter table public.users 
  add column if not exists status text not null default 'pending';

-- 2. 관리자(admin) 계정은 즉시 승인(approved) 처리
update public.users 
  set status = 'approved' 
  where role = 'admin';

-- 3. 기존 승인된 회원 데이터가 있을 경우 status를 approved로 동기화
update public.users 
  set status = 'approved' 
  where role != 'admin' and (status is null or status = '');
