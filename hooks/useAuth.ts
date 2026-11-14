import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserGrade } from '../lib/kdk';

export interface UserProfile {
  id: string;
  name: string;
  gender: 'M' | 'F';
  grade: UserGrade;
  role: 'admin' | 'member';
  created_at: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
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

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data as UserProfile);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    meta: { name: string; gender?: 'M' | 'F'; grade?: UserGrade }
  ) => {
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: meta.name,
          gender: meta.gender || 'M',
          grade: meta.grade || '테린이',
        },
      },
    });
  };

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
