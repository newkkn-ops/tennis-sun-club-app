import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Supabase Auth 세션 및 public.users 프로필을 관리하는 커스텀 훅
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. 현재 로그인 세션 확인
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    };

    checkSession();

    // 2. Auth 상태 변화 실시간 감지 (로그인, 로그아웃, 토큰 갱신 등)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // public.users 테이블에서 추가 프로필(이름, 등급, 역할) 조회
  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data);
    }
  };

  // 이메일 로그인
  const signInWithEmail = async (email, password) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  // 회원가입 (메타데이터에 이름, 성별, 등급 전달 -> SQL 트리거가 public.users 자동 생성)
  const signUpWithEmail = async (email, password, { name, gender = 'M', grade = '테린이' }) => {
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          gender,
          grade,
        },
      },
    });
  };

  // 로그아웃
  const signOut = async () => {
    return await supabase.auth.signOut();
  };

  return {
    user,
    profile,
    loading,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };
}

export default useAuth;
