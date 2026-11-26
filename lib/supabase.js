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
 * 아이디(예: admin, chulsoo, 김철수) 또는 이메일을 Supabase Auth 가상 이메일 형식으로 변환
 * 사용자가 이메일 형식이 아닌 일반 아이디를 입력하면 자동으로 @suntennis.local을 붙여 반환합니다.
 */
export function toAuthEmail(loginIdOrEmail = '') {
  const trimmed = String(loginIdOrEmail || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('@')) return trimmed.toLowerCase();

  // 영문, 숫자, 밑줄, 하이픈, 마침표 등 표준 ASCII 계정명
  if (/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    return `${trimmed.toLowerCase()}@${VIRTUAL_AUTH_DOMAIN}`;
  }

  // 한글 및 유니코드 계정명: Supabase Auth(GoTrue) 이메일 규격 통과를 위한 안전한 ASCII 해시 인코딩
  const safeAscii = encodeURIComponent(trimmed).replace(/%/g, '').toLowerCase();
  return `u_${safeAscii}@${VIRTUAL_AUTH_DOMAIN}`;
}

/**
 * 기본 관리자 계정(admin / admin@suntennis.local / PW: admin1234)이
 * Supabase Auth 및 public.users 테이블에 존재하도록 자동 보장(생성)
 */
export async function ensureDefaultAdminAccount() {
  if (!isSupabaseConfigured) {
    return null;
  }

  try {
    const adminEmail = `admin@${VIRTUAL_AUTH_DOMAIN}`;
    const defaultPassword = 'admin1234';

    // 1. public.users 테이블에서 admin 계정 존재 여부 확인
    const { data: existingAdmin } = await supabase
      .from('users')
      .select('*')
      .or(`username.eq.admin,email.eq.${adminEmail}`)
      .maybeSingle();

    let adminId = existingAdmin?.id;

    // 2. Auth에 계정 생성 시도 (이미 존재하면 무시)
    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: adminEmail,
        password: defaultPassword,
        options: {
          data: {
            username: 'admin',
            name: '공유 관리자',
            gender: 'M',
            grade: '금배',
            role: 'admin',
            approval_status: 'approved',
            status: 'approved',
          },
        },
      });

      if (!signUpErr && signUpData?.user?.id) {
        adminId = signUpData.user.id;
      }
      // 가입 시 생성된 자동 세션은 즉시 해제하여 일반 사용자 뷰에 영향 없도록 처리
      if (signUpData?.session) {
        await supabase.auth.signOut();
      }
    } catch {
      // 이미 생성된 경우 등 예외 무시
    }

    // 3. public.users 테이블에 admin 레코드가 없거나 권한/승인이 불일치할 경우 upsert
    if (
      !existingAdmin ||
      existingAdmin.role !== 'admin' ||
      (existingAdmin.approval_status !== 'approved' && existingAdmin.status !== 'approved')
    ) {
      const adminPayload = {
        ...(adminId ? { id: adminId } : {}),
        username: 'admin',
        email: adminEmail,
        name: existingAdmin?.name || '공유 관리자',
        gender: existingAdmin?.gender || 'M',
        grade: existingAdmin?.grade || '금배',
        role: 'admin',
        approval_status: 'approved',
        status: 'approved',
        is_guest: false,
        requested_at: existingAdmin?.requested_at || new Date().toISOString(),
      };

      let { data: inserted, error: upsertErr } = await supabase
        .from('users')
        .upsert(adminPayload, { onConflict: 'username' })
        .select()
        .maybeSingle();

      if (upsertErr) {
        const fallback = { ...adminPayload };
        delete fallback.status;
        const retry = await supabase
          .from('users')
          .upsert(fallback, { onConflict: 'username' })
          .select()
          .maybeSingle();
        inserted = retry.data;
      }
      return inserted;
    }

    return existingAdmin;
  } catch (err) {
    console.warn('ensureDefaultAdminAccount notice:', err);
    return null;
  }
}

/**
 * Supabase public.users 테이블 레코드를 프론트엔드 회원 객체로 정규화
 * (status, approval_status, approvalStatus 등 컬럼명 호환 지원)
 */
export function mapSupabaseUserRow(row) {
  if (!row) return null;
  const email = row.email || '';
  const username =
    row.username || (email.includes('@') ? email.split('@')[0] : email) || row.name || '';
  const rawStatus = row.approval_status || row.approvalStatus || row.status || '';
  const isPending =
    rawStatus === 'pending' ||
    rawStatus === '미승인' ||
    rawStatus === 'waiting' ||
    rawStatus === '대기';
  const approvalStatus = isPending ? 'pending' : 'approved';

  return {
    id: String(row.id),
    username,
    email,
    name: row.name || username || '클럽회원',
    gender: row.gender === 'F' || row.gender === '여' ? 'F' : 'M',
    grade: row.grade || '테린이',
    role: row.role === 'admin' ? 'admin' : 'member',
    phone: row.phone || '',
    birthDate: row.birth_date || row.birthDate || undefined,
    age: typeof row.age === 'number' ? row.age : undefined,
    experienceYears:
      typeof row.experience_years === 'number'
        ? row.experience_years
        : typeof row.experienceYears === 'number'
        ? row.experienceYears
        : undefined,
    isGuest: Boolean(row.is_guest ?? row.isGuest ?? false),
    approvalStatus,
    approval_status: approvalStatus,
    status: approvalStatus,
    requestedAt: row.requested_at || row.requestedAt || row.created_at || undefined,
    created_at: row.created_at,
  };
}
