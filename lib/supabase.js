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
 * (Supabase Auth가 '.local' 도메인을 유효하지 않은 이메일로 판단하여 422 에러를 반환하므로
 *  유효한 TLD를 가진 '@suntennis.com' 도메인으로 통일)
 */
export const VIRTUAL_AUTH_DOMAIN = 'suntennis.com';

/**
 * 이전 버전에서 사용하던 가상 이메일 도메인 (기존 계정 로그인 호환용)
 */
export const LEGACY_VIRTUAL_AUTH_DOMAIN = 'suntennis.local';

/**
 * Supabase Auth 최소 비밀번호 길이
 */
export const MIN_AUTH_PASSWORD_LENGTH = 6;

/**
 * 일반 아이디를 이메일 로컬파트(영문 소문자/숫자/._-)로 안전하게 변환
 */
function toSafeLocalPart(loginId) {
  const trimmed = String(loginId || '').trim();
  if (!trimmed) return '';

  // 영문, 숫자, 밑줄, 하이픈, 마침표로만 구성된 표준 ASCII 계정명
  if (/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    const ascii = trimmed
      .toLowerCase()
      .replace(/\.{2,}/g, '.')
      .replace(/^\.+|\.+$/g, '');
    return ascii || 'user';
  }

  // 한글 및 기타 문자 계정명 → UTF-8 바이트를 16진수(영문/숫자)로 변환
  const hex = Array.from(new TextEncoder().encode(trimmed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `u_${hex}`.slice(0, 64);
}

/**
 * 일반 아이디(예: admin, chulsoo, 홍길동) 또는 이메일을 Supabase Auth용 이메일로 변환
 * 사용자가 @가 없는 일반 아이디를 입력하면 영문/숫자로 변환 후 @suntennis.com을 붙여 반환합니다.
 */
export function toAuthEmail(loginIdOrEmail = '') {
  const trimmed = String(loginIdOrEmail || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  return `${toSafeLocalPart(trimmed)}@${VIRTUAL_AUTH_DOMAIN}`;
}

/**
 * 이전 버전(@suntennis.local) 규칙으로 만들어진 가상 이메일 (기존 계정 로그인 재시도용)
 */
export function toLegacyAuthEmail(loginIdOrEmail = '') {
  const trimmed = String(loginIdOrEmail || '').trim();
  if (!trimmed || trimmed.includes('@')) return '';
  if (/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    return `${trimmed.toLowerCase()}@${LEGACY_VIRTUAL_AUTH_DOMAIN}`;
  }
  const safeAscii = encodeURIComponent(trimmed).replace(/%/g, '').toLowerCase();
  return `u_${safeAscii}@${LEGACY_VIRTUAL_AUTH_DOMAIN}`;
}

/**
 * 아이디(또는 이메일) + 비밀번호로 Supabase Auth 로그인
 */
export async function signInWithLoginId(loginIdOrEmail = '', password = '') {
  const primaryEmail = toAuthEmail(loginIdOrEmail);
  let result = await supabase.auth.signInWithPassword({ email: primaryEmail, password });

  // 기존 @suntennis.local 계정 호환: 1차 실패 시 이전 가상 이메일로 재시도
  if (result.error || !result.data?.user) {
    const legacyEmail = toLegacyAuthEmail(loginIdOrEmail);
    if (legacyEmail && legacyEmail !== primaryEmail) {
      const legacyResult = await supabase.auth.signInWithPassword({ email: legacyEmail, password });
      if (!legacyResult.error && legacyResult.data?.user) {
        result = legacyResult;
      }
    }
  }

  return result;
}

/**
 * 현재 로그인 세션 존재 여부 (비로그인 상태에서 public.users 조회로 인한 401 에러 방지)
 */
export async function hasActiveSession() {
  if (!isSupabaseConfigured) return false;
  try {
    const { data } = await supabase.auth.getSession();
    return Boolean(data?.session?.user);
  } catch {
    return false;
  }
}

/**
 * public.users 테이블의 실제 존재 컬럼 목록
 * (id, name, gender, grade, role, push_subscription, created_at)
 */
export const PUBLIC_USERS_COLUMNS =
  'id, name, gender, grade, role, status, push_subscription, created_at';

/**
 * public.users 테이블에 실제로 존재하는 컬럼(id, name, gender, grade, role, push_subscription)만 추출하고,
 * 승인 상태(status/approval_status) 및 부가 프로필(username, email, phone, birth_date, age 등)은
 * push_subscription JSONB 내부 메타데이터에 안전하게 병합합니다.
 */
export function buildSafeUsersPayload(payload = {}, existingPushSubscription = null) {
  if (!payload || typeof payload !== 'object') {
    return {
      name: '클럽회원',
      gender: 'M',
      grade: '테린이',
      role: 'member',
    };
  }

  const prevMeta =
    existingPushSubscription &&
    typeof existingPushSubscription === 'object' &&
    !Array.isArray(existingPushSubscription)
      ? existingPushSubscription
      : payload.push_subscription &&
        typeof payload.push_subscription === 'object' &&
        !Array.isArray(payload.push_subscription)
      ? payload.push_subscription
      : {};

  const rawRole = payload.role ?? prevMeta.role ?? 'member';
  const role = rawRole === 'admin' ? 'admin' : 'member';

  const rawStatus =
    payload.status ??
    payload.approval_status ??
    payload.approvalStatus ??
    prevMeta.status ??
    prevMeta.approval_status ??
    prevMeta.approvalStatus ??
    (role === 'admin' ? 'approved' : 'approved');

  const isPending =
    rawStatus === 'pending' ||
    rawStatus === '미승인' ||
    rawStatus === 'waiting' ||
    rawStatus === '대기';
  const resolvedStatus = role === 'admin' ? 'approved' : isPending ? 'pending' : 'approved';

  const mergedMeta = {
    ...prevMeta,
    status: resolvedStatus,
    approval_status: resolvedStatus,
    ...(payload.username !== undefined ? { username: payload.username } : {}),
    ...(payload.email !== undefined ? { email: payload.email } : {}),
    ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
    ...(payload.birth_date !== undefined || payload.birthDate !== undefined
      ? { birth_date: payload.birth_date ?? payload.birthDate ?? null }
      : {}),
    ...(payload.age !== undefined ? { age: payload.age } : {}),
    ...(payload.is_guest !== undefined || payload.isGuest !== undefined
      ? { is_guest: Boolean(payload.is_guest ?? payload.isGuest) }
      : {}),
    ...(payload.requested_at !== undefined || payload.requestedAt !== undefined
      ? { requested_at: payload.requested_at ?? payload.requestedAt }
      : {}),
  };

  const safeRow = {
    name: String(payload.name || prevMeta.name || '클럽회원').trim() || '클럽회원',
    gender: payload.gender === 'F' || payload.gender === '여' ? 'F' : 'M',
    grade: String(payload.grade || '테린이'),
    role,
    status: resolvedStatus,
    push_subscription: mergedMeta,
  };

  if (payload.id) {
    safeRow.id = String(payload.id);
  }

  return safeRow;
}

/**
 * public.users 테이블에 회원 정보 저장 (실제 존재하는 컬럼만 사용하여 스키마 에러 원천 차단)
 */
export async function saveUserToPublicUsers(payload, existingPushSubscription = null) {
  const safePayload = buildSafeUsersPayload(payload, existingPushSubscription);
  let { data, error } = await supabase.from('users').upsert(safePayload);

  if (error) {
    const minimalPayload = {
      ...(safePayload.id ? { id: safePayload.id } : {}),
      name: safePayload.name,
      gender: safePayload.gender,
      grade: safePayload.grade,
      role: safePayload.role,
      status: safePayload.status,
    };
    const retry = await supabase.from('users').upsert(minimalPayload);
    return { data: retry.data, error: retry.error };
  }

  return { data, error };
}

/**
 * public.users 테이블의 특정 회원 레코드 업데이트 (실제 존재하는 컬럼만 사용)
 */
export async function updateUserInPublicUsers(userId, partialPayload = {}, existingRow = null) {
  if (!userId) return { data: null, error: new Error('회원 ID가 없습니다.') };

  let baseRow = existingRow;
  if (!baseRow) {
    try {
      const { data } = await supabase
        .from('users')
        .select(PUBLIC_USERS_COLUMNS)
        .eq('id', userId)
        .maybeSingle();
      baseRow = data || null;
    } catch {
      baseRow = null;
    }
  }

  const prevMeta =
    baseRow?.push_subscription &&
    typeof baseRow.push_subscription === 'object' &&
    !Array.isArray(baseRow.push_subscription)
      ? baseRow.push_subscription
      : {};

  const mergedInput = {
    id: userId,
    name: partialPayload.name ?? baseRow?.name ?? '클럽회원',
    gender: partialPayload.gender ?? baseRow?.gender ?? 'M',
    grade: partialPayload.grade ?? baseRow?.grade ?? '테린이',
    role: partialPayload.role ?? baseRow?.role ?? 'member',
    // 승인 상태는 실제 status 컬럼 값을 우선 유지 (JSONB 메타데이터의 오래된 값으로 되돌아가지 않도록)
    status: partialPayload.status ?? baseRow?.status ?? prevMeta.status ?? 'approved',
    ...partialPayload,
  };

  const safePayload = buildSafeUsersPayload(mergedInput, prevMeta);
  const { id: _ignoreId, ...updateColumns } = safePayload;

  let { data, error } = await supabase
    .from('users')
    .update(updateColumns)
    .eq('id', userId)
    .select(PUBLIC_USERS_COLUMNS);

  if (error) {
    const minimalUpdate = {
      name: updateColumns.name,
      gender: updateColumns.gender,
      grade: updateColumns.grade,
      role: updateColumns.role,
      status: updateColumns.status,
    };
    const retry = await supabase
      .from('users')
      .update(minimalUpdate)
      .eq('id', userId)
      .select('id, name, gender, grade, role, status, created_at');
    return { data: retry.data, error: retry.error };
  }

  return { data, error };
}

/**
 * 관리자 회원가입 승인: public.users.status 컬럼을 'approved'로 직접 UPDATE
 * - 에러 발생 시 error 반환
 * - RLS 정책 등으로 실제 변경된 행이 0건이면 명확한 에러로 반환 (조용히 실패하지 않음)
 */
export async function approveUserInPublicUsers(targetUserId) {
  if (!targetUserId) {
    return { data: null, error: new Error('승인할 회원 ID가 없습니다.') };
  }

  const { data, error } = await supabase
    .from('users')
    .update({ status: 'approved' })
    .eq('id', targetUserId)
    .select('*');

  if (error) {
    return { data: null, error };
  }

  if (!Array.isArray(data) || data.length === 0) {
    return {
      data: null,
      error: new Error(
        'DB에 반영된 행이 없습니다. (Supabase RLS 정책에서 관리자의 public.users UPDATE 권한을 확인해 주세요)'
      ),
    };
  }

  const updatedRow = data[0];
  if (updatedRow.status !== 'approved') {
    return {
      data: updatedRow,
      error: new Error(`status 값이 'approved'로 변경되지 않았습니다. (현재 값: ${updatedRow.status})`),
    };
  }

  // 부가 메타데이터(push_subscription)의 승인 상태도 동기화 (실패해도 승인 자체에는 영향 없음)
  try {
    const meta =
      updatedRow.push_subscription &&
      typeof updatedRow.push_subscription === 'object' &&
      !Array.isArray(updatedRow.push_subscription)
        ? updatedRow.push_subscription
        : null;
    if (meta && (meta.status !== 'approved' || meta.approval_status !== 'approved')) {
      await supabase
        .from('users')
        .update({ push_subscription: { ...meta, status: 'approved', approval_status: 'approved' } })
        .eq('id', targetUserId);
    }
  } catch {
    // 무시
  }

  return { data: updatedRow, error: null };
}

/**
 * 기본 관리자 계정(admin / admin@suntennis.com / PW: admin1234)이
 * Supabase Auth 및 public.users 테이블에 존재하도록 자동 생성 및 승인
 */
export async function ensureDefaultAdminAccount() {
  if (!isSupabaseConfigured) {
    return null;
  }

  try {
    // 현재 로그인된 세션이 있으면 기존 세션을 건드리지 않음
    // (비로그인 상태에서는 public.users를 조회하지 않아 401 에러를 유발하지 않음)
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user) {
      return null;
    }

    const adminEmail = `admin@${VIRTUAL_AUTH_DOMAIN}`;
    const defaultPassword = 'admin1234';

    let adminId = null;
    let hasTempSession = false;

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
      hasTempSession = Boolean(signUpData?.session);
    } catch {
      // 이미 생성된 경우 무시
    }

    // 2. public.users 테이블에 admin 레코드(status: 'approved', role: 'admin') upsert
    //    (세션이 유지되는 동안 저장해야 RLS/401 에러가 발생하지 않음)
    if (adminId && hasTempSession) {
      await saveUserToPublicUsers({
        id: adminId,
        name: '관리자',
        username: 'admin',
        email: adminEmail,
        gender: 'M',
        grade: '금배',
        role: 'admin',
        status: 'approved',
        approval_status: 'approved',
      });
    }

    if (hasTempSession) {
      await supabase.auth.signOut();
    }
  } catch (err) {
    console.warn('ensureDefaultAdminAccount notice:', err);
  }
  return null;
}

/**
 * Supabase public.users 테이블 레코드를 프론트엔드 회원 객체로 정규화
 * 실제 컬럼(id, name, gender, grade, role, push_subscription, created_at) 및
 * push_subscription JSONB 메타데이터에서 승인 상태(pending / approved)와 프로필을 안전하게 추출합니다.
 */
export function mapSupabaseUserRow(row) {
  if (!row || typeof row !== 'object') return null;

  const meta =
    row.push_subscription &&
    typeof row.push_subscription === 'object' &&
    !Array.isArray(row.push_subscription)
      ? row.push_subscription
      : {};

  const role = row.role === 'admin' || meta.role === 'admin' ? 'admin' : 'member';
  // 실제 public.users.status 컬럼 값을 최우선 기준으로 사용 (컬럼이 없을 때만 메타데이터 참조)
  const hasStatusColumn = Object.prototype.hasOwnProperty.call(row, 'status') && row.status != null;
  const rawStatus = hasStatusColumn
    ? row.status
    : row.approval_status ??
      row.approvalStatus ??
      meta.status ??
      meta.approval_status ??
      meta.approvalStatus ??
      'approved';

  const isPending =
    role !== 'admin' &&
    (rawStatus === 'pending' ||
      rawStatus === '미승인' ||
      rawStatus === 'waiting' ||
      rawStatus === '대기');
  const status = isPending ? 'pending' : 'approved';

  const safeName = String(row.name || meta.name || '클럽회원').trim() || '클럽회원';
  const safeUsername = String(row.username || meta.username || safeName || '회원').trim();
  const safeEmail = String(row.email || meta.email || '').trim();
  const safePhone = String(row.phone || meta.phone || '').trim();
  const safeBirthDate = row.birth_date || row.birthDate || meta.birth_date || meta.birthDate || undefined;
  const rawAge = row.age ?? meta.age;
  const safeAge =
    typeof rawAge === 'number' && !isNaN(rawAge)
      ? rawAge
      : typeof rawAge === 'string' && rawAge.trim() !== '' && !isNaN(Number(rawAge))
      ? Number(rawAge)
      : undefined;

  return {
    id: String(row.id || `user_${Date.now()}`),
    name: safeName,
    username: safeUsername,
    email: safeEmail,
    gender: row.gender === 'F' || row.gender === '여' ? 'F' : 'M',
    grade: String(row.grade || '테린이'),
    role,
    status,
    approvalStatus: status,
    approval_status: status,
    phone: safePhone,
    birthDate: safeBirthDate,
    age: safeAge,
    isGuest: Boolean(row.is_guest ?? row.isGuest ?? meta.is_guest ?? meta.isGuest ?? false),
    requestedAt: row.requested_at || meta.requested_at || row.created_at || undefined,
    created_at: row.created_at || undefined,
    push_subscription: row.push_subscription || null,
  };
}

/**
 * 코트 경기 종료 시 Supabase matches 테이블 및 player_stats 테이블에 경기 결과 저장
 */
export async function recordMatchResultToSupabase({
  tournamentId,
  roundName = '정기 경기',
  courtNumber = 1,
  teamAPlayerIds = [],
  teamBPlayerIds = [],
  scoreA = 0,
  scoreB = 0,
}) {
  if (!isSupabaseConfigured) return { success: false, reason: 'unconfigured' };

  try {
    const isUuid = (str) =>
      typeof str === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    // tournamentId가 유효한 UUID가 아니면 matches 테이블 저장 시 외래키 오류 방지
    const safeTourId = isUuid(tournamentId) ? tournamentId : null;

    const safeTeamA = (Array.isArray(teamAPlayerIds) ? teamAPlayerIds : []).filter(isUuid);
    const safeTeamB = (Array.isArray(teamBPlayerIds) ? teamBPlayerIds : []).filter(isUuid);

    const matchPayload = {
      ...(safeTourId ? { tournament_id: safeTourId } : {}),
      round_name: roundName,
      court_number: Number(courtNumber) || 1,
      team_a: safeTeamA,
      team_b: safeTeamB,
      score_a: Number(scoreA) || 0,
      score_b: Number(scoreB) || 0,
      status: 'completed',
    };

    const { data: insertedMatch, error: matchError } = await supabase
      .from('matches')
      .insert(matchPayload)
      .select()
      .maybeSingle();

    if (matchError) {
      console.warn('matches table insert notice (schema optional):', matchError.message);
    }

    // player_stats 누적 업데이트 시도
    const allParticipants = [
      ...safeTeamA.map((id) => ({ id, isTeamA: true })),
      ...safeTeamB.map((id) => ({ id, isTeamA: false })),
    ];

    for (const p of allParticipants) {
      const myScore = p.isTeamA ? Number(scoreA) || 0 : Number(scoreB) || 0;
      const oppScore = p.isTeamA ? Number(scoreB) || 0 : Number(scoreA) || 0;
      const won = myScore > oppScore;
      const lost = myScore < oppScore;
      const diff = myScore - oppScore;

      try {
        const { data: prevStats } = await supabase
          .from('player_stats')
          .select('*')
          .eq('user_id', p.id)
          .maybeSingle();

        const curTotal = (prevStats?.total_matches || 0) + 1;
        const curWins = (prevStats?.wins || 0) + (won ? 1 : 0);
        const curLosses = (prevStats?.losses || 0) + (lost ? 1 : 0);
        const curDiff = (prevStats?.point_diff || 0) + diff;
        const curWinRate = curTotal > 0 ? Number(((curWins / curTotal) * 100).toFixed(2)) : 0;

        await supabase.from('player_stats').upsert({
          user_id: p.id,
          total_matches: curTotal,
          wins: curWins,
          losses: curLosses,
          win_rate: curWinRate,
          point_diff: curDiff,
          updated_at: new Date().toISOString(),
        });
      } catch (statErr) {
        // player_stats 테이블이 없거나 권한 제한 시 무시
      }
    }

    return { success: true, match: insertedMatch };
  } catch (err) {
    console.warn('recordMatchResultToSupabase error:', err);
    return { success: false, error: err };
  }
}
