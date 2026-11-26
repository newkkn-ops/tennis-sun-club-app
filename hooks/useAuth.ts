import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, toAuthEmail, mapSupabaseUserRow } from '../lib/supabase';
import { UserGrade } from '../lib/kdk';

export interface UserProfile {
  id: string;
  username?: string;
  email?: string;
  name: string;
  gender: 'M' | 'F';
  grade: UserGrade;
  role: 'admin' | 'member';
  phone?: string;
  birthDate?: string;
  birth_date?: string;
  age?: number;
  approvalStatus: 'pending' | 'approved';
  approval_status: 'pending' | 'approved';
  created_at?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAllUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const mapped = data
        .map((r) => mapSupabaseUserRow(r) as UserProfile)
        .filter(Boolean);
      setUsersList(mapped);
    }
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      const normalized = mapSupabaseUserRow(data) as UserProfile;
      setProfile(normalized);
      return normalized;
    }
    return null;
  };

  useEffect(() => {
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

    // public.users 테이블 실시간(Realtime) 구독
    const usersChannel = supabase
      .channel('public:users:useAuth')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        async (payload) => {
          await fetchAllUsers();
          const currentAuthUser = (await supabase.auth.getUser()).data.user;
          if (currentAuthUser && (payload.new as any)?.id === currentAuthUser.id) {
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

  const signInWithEmail = async (loginIdOrEmail: string, password: string) => {
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

  const signUpWithEmail = async (
    loginIdOrEmail: string,
    password: string,
    meta: {
      username?: string;
      name: string;
      gender?: 'M' | 'F';
      grade?: UserGrade;
      phone?: string;
      birthDate?: string;
      age?: number;
    }
  ) => {
    const email = toAuthEmail(loginIdOrEmail);
    const username = (meta.username || loginIdOrEmail).trim();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          name: meta.name,
          gender: meta.gender || 'M',
          grade: meta.grade || '테린이',
          phone: meta.phone || '',
          birth_date: meta.birthDate || null,
          role: 'member',
          approval_status: 'pending',
        },
      },
    });

    if (!error && data?.user) {
      await supabase.from('users').upsert({
        id: data.user.id,
        username,
        email,
        name: meta.name,
        gender: meta.gender || 'M',
        grade: meta.grade || '테린이',
        role: 'member',
        phone: meta.phone || null,
        birth_date: meta.birthDate || null,
        age: meta.age ?? null,
        is_guest: false,
        approval_status: 'pending',
        requested_at: new Date().toISOString(),
      });
      // 승인 대기(pending) 상태이므로 즉시 자동 로그인 세션을 해제
      if (data.session) {
        await supabase.auth.signOut();
      }
      await fetchAllUsers();
    }

    return { data, error };
  };

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
