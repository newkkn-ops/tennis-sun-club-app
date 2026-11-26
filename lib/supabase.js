import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isValidHttpUrl = (str) => {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

const supabaseUrl = isValidHttpUrl(rawUrl)
  ? rawUrl
  : 'https://placeholder-project.supabase.co';
const supabaseAnonKey =
  rawKey && rawKey !== 'YOUR_SUPABASE_ANON_KEY'
    ? rawKey
    : 'placeholder-anon-key';

export const isSupabaseConfigured =
  Boolean(rawUrl) &&
  isValidHttpUrl(rawUrl) &&
  !rawUrl.includes('placeholder') &&
  !rawUrl.includes('your-project') &&
  Boolean(rawKey) &&
  rawKey !== 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 일반 아이디 입력 시 사용하는 가상 이메일 도메인
 */
export const VIRTUAL_AUTH_DOMAIN = 'suntennis.local';

/**
 * 일반 아이디(예: admin, chulsoo, 홍길동) 또는 이메일을 Supabase Auth용 이메일로 변환
 * 사용자가 @가 없는 일반 아이디를 입력하면 자동으로 @suntennis.local을 붙여 반환합니다.
 */
export function toAuthEmail(loginIdOrEmail = '') {
  const trimmed = String(loginIdOrEmail || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('@')) return trimmed.toLowerCase();

  // 영문, 숫자, 밑줄, 하이픈, 마침표 등 표준 ASCII 계정명
  if (/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    return `${trimmed.toLowerCase()}@${VIRTUAL_AUTH_DOMAIN}`;
  }

  // 한글 및 특수문자 계정명 (GoTrue 이메일 규격 통과를 위한 안전한 ASCII 인코딩)
  const safeAscii = encodeURIComponent(trimmed).replace(/%/g, '').toLowerCase();
  return `u_${safeAscii}@${VIRTUAL_AUTH_DOMAIN}`;
}

/**
 * public.users 테이블에 회원 정보 저장 (status 컬럼 존재 여부 동적 호환)
 */
export async function saveUserToPublicUsers(payload) {
  let { data, error } = await supabase.from('users').upsert(payload);

  if (error) {
    // status 컬럼 미존재 에러 시 status 제외 후 재시도
    if (
      error.message?.includes('status') ||
      error.message?.includes('approval_status') ||
      error.message?.includes('column') ||
      error.message?.includes('schema cache')
    ) {
      const fallback = { ...payload };
      delete fallback.status;
      delete fallback.approval_status;
      const retry = await supabase.from('users').upsert(fallback);
      return { data: retry.data, error: retry.error };
    }
  }

  return { data, error };
}

/**
 * 기본 관리자 계정(admin / admin@suntennis.local / PW: admin1234)이
 * Supabase Auth 및 public.users 테이블에 존재하도록 자동 생성 및 승인
 */
export async function ensureDefaultAdminAccount() {
  if (!isSupabaseConfigured) {
    return null;
  }

  try {
    const adminEmail = `admin@${VIRTUAL_AUTH_DOMAIN}`;
    const defaultPassword = 'admin1234';

    let adminId = null;

    // 1. Auth에 admin 계정 signUp 시도
    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: adminEmail,
        password: defaultPassword,
        options: {
          data: {
            name: '관리자',
            gender: 'M',
            grade: '금배',
            role: 'admin',
            status: 'approved',
          },
        },
      });

      if (!signUpErr && signUpData?.user?.id) {
        adminId = signUpData.user.id;
      }
      if (signUpData?.session) {
        await supabase.auth.signOut();
      }
    } catch {
      // 이미 생성된 경우 무시
    }

    // 2. 이미 존재하는 경우 로그인을 통해 UUID(id) 확인
    if (!adminId) {
      try {
        const { data: signInData } = await supabase.auth.signInWithPassword({
          email: adminEmail,
          password: defaultPassword,
        });
        if (signInData?.user?.id) {
          adminId = signInData.user.id;
          await supabase.auth.signOut();
        }
      } catch {
        // 무시
      }
    }

    // 3. public.users 테이블에 admin 레코드(status: 'approved', role: 'admin') upsert
    if (adminId) {
      const adminPayload = {
        id: adminId,
        name: '관리자',
        gender: 'M',
        grade: '금배',
        role: 'admin',
        status: 'approved',
      };
      await saveUserToPublicUsers(adminPayload);
    }
  } catch (err) {
    console.warn('ensureDefaultAdminAccount notice:', err);
  }
}

/**
 * Supabase public.users 테이블 레코드를 프론트엔드 회원 객체로 정규화
 * (status 컬럼 기준, pending / approved 승인 상태 판별)
 */
export function mapSupabaseUserRow(row) {
  if (!row) return null;
  const rawStatus = row.status || row.approval_status || row.approvalStatus || 'pending';
  const isPending =
    rawStatus === 'pending' ||
    rawStatus === '미승인' ||
    rawStatus === 'waiting' ||
    rawStatus === '대기';
  const status = isPending ? 'pending' : 'approved';

  return {
    id: String(row.id),
    name: row.name || '클럽회원',
    username: row.username || row.name || '회원',
    email: row.email || '',
    gender: row.gender === 'F' || row.gender === '여' ? 'F' : 'M',
    grade: row.grade || '테린이',
    role: row.role === 'admin' ? 'admin' : 'member',
    status,
    approvalStatus: status,
    approval_status: status,
    phone: row.phone || '',
    birthDate: row.birth_date || row.birthDate || undefined,
    age: typeof row.age === 'number' ? row.age : undefined,
    isGuest: Boolean(row.is_guest ?? row.isGuest ?? false),
    requestedAt: row.requested_at || row.created_at || undefined,
    created_at: row.created_at,
  };
}
