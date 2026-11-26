-- ===================================================
-- 테니스 어플(Tennis Club/Tournament App) DB Schema
-- ===================================================

-- 1. 사용자 등급, 권한 및 가입 승인 상태 타입 정의
create type user_grade as enum ('금배', '은배', '동배', '국화', '개나리', '테린이', '고령자부');
create type user_role as enum ('admin', 'member');

-- 2. 회원(Users) 테이블 (Supabase Auth auth.users와 연동 + 승인 상태 pending/approved 실시간 관리)
create table users (
  id uuid primary key default gen_random_uuid(),
  username text unique,
  email text,
  name text not null,
  gender text check (gender in ('M', 'F')) not null default 'M',
  grade user_grade not null default '테린이',
  role user_role not null default 'member',
  phone text,
  birth_date date,
  age int,
  experience_years int default 4,
  is_guest boolean default false,
  approval_status text check (approval_status in ('pending', 'approved')) not null default 'pending',
  requested_at timestamp with time zone default timezone('utc'::text, now()) not null,
  push_subscription jsonb, -- 웹 푸시 알림 브라우저 구독 객체(PushSubscription JSON)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. 대회/월례회(Tournaments) 테이블
create type tournament_type as enum ('KDK', 'TOURNAMENT');
create type tournament_status as enum ('pending', 'ongoing', 'finished');

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  title text not null, -- 예: "2026년 3월 정기 월례회"
  type tournament_type not null,
  status tournament_status not null default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. 대회 참가자(Tournament Participants) 매핑 테이블
create table tournament_participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  seed_rank int, -- 본선 토너먼트 시드 배정용 순위
  unique(tournament_id, user_id)
);

-- 5. 경기 및 코트 배정(Matches) 테이블
create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  round_name text not null, -- 예: "예선 R1", "8강", "4강", "결승"
  court_number int not null, -- 코트 번호 (1번, 2번 코트 등)
  team_a uuid[] not null, -- 팀 A 소속 유저 UUID 배열 [user_id_1, user_id_2]
  team_b uuid[] not null, -- 팀 B 소속 유저 UUID 배열 [user_id_3, user_id_4]
  score_a int default 0,
  score_b int default 0,
  status text check (status in ('waiting', 'playing', 'completed')) default 'waiting',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. 개인별 누적 통계(Player Stats) 테이블
create table player_stats (
  user_id uuid primary key references users(id) on delete cascade,
  total_matches int default 0,
  wins int default 0,
  losses int default 0,
  win_rate numeric(5,2) default 0.00, -- 승률 (%)
  point_diff int default 0, -- 총 득실차
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ===================================================
-- [성능 최적화 및 편의를 위한 인덱스 & 트리거 보완 권장사항]
-- ===================================================

-- 팀 검색(특정 유저가 속한 경기 조회)을 위한 GIN 인덱스
create index idx_matches_team_a on matches using gin (team_a);
create index idx_matches_team_b on matches using gin (team_b);
create index idx_matches_tournament_id on matches (tournament_id);
create index idx_tournament_participants_tournament on tournament_participants (tournament_id);

-- 회원 가입 시 기본 통계 레코드 자동 생성 트리거 함수
create or replace function handle_new_user_stats()
returns trigger as $$
begin
  insert into public.player_stats (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql;

create trigger trg_user_create_stats
  after insert on users
  for each row execute function handle_new_user_stats();

-- ===================================================
-- ===================================================
-- [웹 푸시(Web Push) 및 회원 인증/승인 확장 컬럼 보완]
-- ===================================================
alter table users add column if not exists username text;
alter table users add column if not exists email text;
alter table users add column if not exists phone text;
alter table users add column if not exists birth_date date;
alter table users add column if not exists age int;
alter table users add column if not exists experience_years int default 4;
alter table users add column if not exists is_guest boolean default false;
alter table users add column if not exists approval_status text check (approval_status in ('pending', 'approved')) default 'pending';
alter table users add column if not exists requested_at timestamp with time zone default timezone('utc'::text, now());
alter table users add column if not exists push_subscription jsonb;

-- ===================================================
-- [Supabase Realtime 활성화]
-- 실시간 코트 현황판 및 실시간 회원 승인/목록 동기화를 위해 matches, users 테이블 Realtime 발행
-- ===================================================
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table users;

-- ===================================================
-- [2단계: 회원가입 시 public.users 자동 생성 트리거 (Trigger)]
-- ===================================================

-- 1. 회원가입(supabase.auth.signUp) 시 자동으로 public.users에 승인 대기(pending) 기본 정보를 넣어주는 함수
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (
    id,
    username,
    email,
    name,
    gender,
    grade,
    phone,
    birth_date,
    role,
    approval_status,
    requested_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', '클럽회원'),
    coalesce(new.raw_user_meta_data ->> 'gender', 'M'),
    coalesce((new.raw_user_meta_data ->> 'grade')::public.user_grade, '테린이'::public.user_grade),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'birth_date', '')::date,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'member'::public.user_role),
    coalesce(new.raw_user_meta_data ->> 'approval_status', 'pending'),
    timezone('utc'::text, now())
  )
  on conflict (id) do update set
    username = excluded.username,
    email = excluded.email,
    name = excluded.name,
    gender = excluded.gender,
    grade = excluded.grade,
    phone = coalesce(excluded.phone, public.users.phone),
    birth_date = coalesce(excluded.birth_date, public.users.birth_date);
  return new;
end;
$$;

-- 2. auth.users 테이블에 insert가 발생할 때 위 함수를 실행하는 트리거 생성
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ===================================================
-- [RLS (Row Level Security) 기본 보안 정책]
-- ===================================================
alter table users enable row level security;
alter table player_stats enable row level security;
alter table tournaments enable row level security;
alter table tournament_participants enable row level security;
alter table matches enable row level security;

-- 조회: 회원 목록 및 승인 상태 조회 허용
create policy "Allow read for all users" on users for select to anon, authenticated using (true);
create policy "Allow read for authenticated stats" on player_stats for select to authenticated using (true);
create policy "Allow read for authenticated tournaments" on tournaments for select to authenticated using (true);
create policy "Allow read for authenticated participants" on tournament_participants for select to authenticated using (true);
create policy "Allow read for authenticated matches" on matches for select to authenticated using (true);

-- 등록: 신규 회원가입 신청(pending) 및 관리자 회원 등록 허용
create policy "Allow insert for signup and admin" on users for insert to anon, authenticated with check (true);

-- 수정: 본인 프로필만 본인이 수정 가능
create policy "Allow update own profile" on users for update to authenticated using (auth.uid() = id);

-- 수정: 관리자(Admin)는 모든 회원의 승인 상태(pending -> approved), 등급 및 권한 수정 가능
create policy "Allow admin to update any user" on users for update to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- 삭제: 관리자(Admin)는 가입 거절 및 회원가입 취소(탈퇴/삭제) 처리 가능
create policy "Allow admin to delete any user" on users for delete to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- ===================================================
-- [3단계: 관리자 대회 생성 및 자동/수동 코트·비로그인 임의 선수 배치 확장 스키마]
-- ===================================================

-- 대회 배정 방식(자동/수동) 및 가용 코트 목록 컬럼 추가
alter table tournaments add column if not exists assignment_type text check (assignment_type in ('AUTO', 'MANUAL')) default 'AUTO';
alter table tournaments add column if not exists selected_courts int[] default '{1,2,3}';

-- 로그인하지 못하는 임의(비회원/게스트) 선수 참가 지원 컬럼 추가
alter table tournament_participants alter column user_id drop not null;
alter table tournament_participants add column if not exists guest_name text;
alter table tournament_participants add column if not exists guest_grade user_grade default '은배';
alter table tournament_participants add column if not exists is_guest boolean default false;

-- 경기(matches) 테이블에 비로그인 임의 선수 이름 배열 표시 지원 컬럼 추가
alter table matches add column if not exists team_a_names text[] default '{}';
alter table matches add column if not exists team_b_names text[] default '{}';

-- 관리자(Admin) 대회 및 경기 생성/수정/삭제 RLS 정책
create policy "Allow admin full access on tournaments" on tournaments for all to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));
create policy "Allow admin full access on tournament_participants" on tournament_participants for all to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));
create policy "Allow admin full access on matches" on matches for all to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));




