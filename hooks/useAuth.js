import { useState, useEffect } from 'react';
import { supabase, toAuthEmail, mapSupabaseUserRow } from '../lib/supabase';

/**
 * Supabase Auth 세션 및 public.users 프로필/전체 회원 목록을 실시간 관리하는 커스텀 훅
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAllUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const mapped = data.map((r) => mapSupabaseUserRow(r)).filter(Boolean);
      setUsersList(mapped);
    }
  };

  // public.users 테이블에서 추가 프로필(이름, 등급, 역할, 승인상태) 조회
  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      const normalized = mapSupabaseUserRow(data);
      setProfile(normalized);
      return normalized;
    }
    return null;
  };

  useEffect(() => {
    // 1. 현재 로그인 세션 확인 및 회원 목록 조회
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      await fetchAllUsers();
      setLoading(false);
    };

    checkSession();

    // 2. Auth 상태 변화 실시간 감지 (로그인, 로그아웃, 토큰 갱신 등)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    // 3. public.users 테이블 실시간(Realtime) 변경 감지
    const usersChannel = supabase
      .channel('public:users:useAuthJs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        async (payload) => {
          await fetchAllUsers();
          const currentAuthUser = (await supabase.auth.getUser()).data.user;
          if (currentAuthUser && payload?.new?.id === currentAuthUser.id) {
            await fetchProfile(currentAuthUser.id);
          }
        }
      )
      .subscribe();

    return () => {
      subscription?.unsubscribe();
      supabase.removeChannel(usersChannel);
    };
  }, []);

  // 아이디/이메일 로그인 (승인 대기 pending 상태 검증 포함)
  const signInWithEmail = async (loginIdOrEmail, password) => {
    const email = toAuthEmail(loginIdOrEmail);
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (!result.error && result.data?.user) {
      const prof = await fetchProfile(result.data.user.id);
      if (prof && prof.approval_status === 'pending') {
        await supabase.auth.signOut();
        return {
          data: { user: null, session: null },
          error: new Error(
            `⏳ [${prof.name}] 님의 계정은 현재 운영자(관리자) 승인 대기 중입니다. 승인 완료 후 로그인할 수 있습니다.`
          ),
        };
      }
    }
    return result;
  };

  // 회원가입 (supabase.auth.signUp + public.users에 pending 상태로 저장)
  const signUpWithEmail = async (
    loginIdOrEmail,
    password,
    { username, name, gender = 'M', grade = '테린이', phone = '', birthDate = '', age }
  ) => {
    const email = toAuthEmail(loginIdOrEmail);
    const resolvedUsername = (username || loginIdOrEmail).trim();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: resolvedUsername,
          name,
          gender,
          grade,
          phone,
          birth_date: birthDate || null,
          role: 'member',
          approval_status: 'pending',
        },
      },
    });

    if (!error && data?.user) {
      await supabase.from('users').upsert({
        id: data.user.id,
        username: resolvedUsername,
        email,
        name,
        gender,
        grade,
        role: 'member',
        phone: phone || null,
        birth_date: birthDate || null,
        age: age ?? null,
        is_guest: false,
        approval_status: 'pending',
        requested_at: new Date().toISOString(),
      });
      if (data.session) {
        await supabase.auth.signOut();
      }
      await fetchAllUsers();
    }

    return { data, error };
  };

  // 로그아웃
  const signOut = async () => {
    return await supabase.auth.signOut();
  };

  return {
    user,
    profile,
    usersList,
    loading,
    fetchAllUsers,
    fetchProfile,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };
}

export default useAuth;
