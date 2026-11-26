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
 * 아이디(예: chulsoo) 또는 이메일(예: chulsoo@suntc.kr)을 Supabase Auth 표준 이메일 형식으로 변환
 */
export function toAuthEmail(loginIdOrEmail = '') {
  const trimmed = String(loginIdOrEmail || '').trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.includes('@') ? trimmed : `${trimmed}@suntc.kr`;
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

