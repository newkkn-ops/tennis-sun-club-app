import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key-here';

export const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  supabaseUrl !== 'YOUR_SUPABASE_URL' &&
  !supabaseUrl.includes('your-project') &&
  !supabaseUrl.includes('placeholder');

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
 */
export function mapSupabaseUserRow(row) {
  if (!row) return null;
  const email = row.email || '';
  const username =
    row.username || (email.includes('@') ? email.split('@')[0] : email) || row.name || '';
  const approvalStatus =
    row.approval_status === 'pending' || row.approvalStatus === 'pending'
      ? 'pending'
      : 'approved';

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
    requestedAt: row.requested_at || row.requestedAt || row.created_at || undefined,
    created_at: row.created_at,
  };
}

