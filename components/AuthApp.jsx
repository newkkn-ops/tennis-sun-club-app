'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import MyPage from './MyPage';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const GRADE_OPTIONS = ['금배', '은배', '동배', '국화', '개나리', '테린이', '고령자부'];

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  }

  if (!session) {
    return <LoginComponent supabase={supabase} />;
  }

  const currentUserId = session.user.id;

  return (
    <div>
      <div className="max-w-md mx-auto px-4 pt-4 flex justify-between items-center bg-gray-50">
        <span className="text-xs text-gray-600 font-medium">환영합니다, 클럽원님!</span>
        <button
          onClick={handleLogout}
          className="text-xs px-3 py-1 bg-red-100 text-red-600 rounded-lg font-semibold hover:bg-red-200 transition-colors"
        >
          로그아웃
        </button>
      </div>

      <MyPage userId={currentUserId} />
    </div>
  );
}

export function LoginComponent({ supabase, onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('M');
  const [grade, setGrade] = useState('테린이');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSignUp && password !== confirmPassword) {
      alert('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setSubmitting(true);
    try {
      if (isSignUp) {
        const username = email.includes('@') ? email.split('@')[0] : email;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
              name: name || '클럽회원',
              gender,
              grade,
              role: 'member',
              approval_status: 'pending',
            },
          },
        });
        if (error) {
          alert('회원가입 실패: ' + error.message);
        } else {
          if (data?.user?.id) {
            await supabase.from('users').upsert({
              id: data.user.id,
              username,
              email,
              name: name || '클럽회원',
              gender,
              grade,
              role: 'member',
              is_guest: false,
              approval_status: 'pending',
              requested_at: new Date().toISOString(),
            });
          }
          if (data?.session) {
            await supabase.auth.signOut();
          }
          alert('⏳ 회원가입 신청이 접수되었습니다! 운영자(관리자) 승인 완료 후 로그인할 수 있습니다.');
          setIsSignUp(false);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          alert('로그인 실패: ' + error.message);
        } else if (data?.user) {
          const { data: userRow } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();

          if (userRow?.approval_status === 'pending') {
            await supabase.auth.signOut();
            alert(`⏳ [${userRow.name || '회원'}] 님의 계정은 현재 운영자(관리자) 승인 대기 중입니다.`);
            return;
          }

          if (onAuthSuccess) {
            onAuthSuccess({
              id: data.user.id,
              name: userRow?.name || data.user.user_metadata?.name || email.split('@')[0],
              email: data.user.email,
              gender: (userRow?.gender || data.user.user_metadata?.gender) === 'F' ? '여' : '남',
              grade: userRow?.grade || data.user.user_metadata?.grade || '금배',
              role: userRow?.role || 'member',
              approval_status: userRow?.approval_status || 'approved',
            });
          }
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-slate-950 text-slate-100 min-h-screen flex flex-col justify-center">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 mb-2 shadow-lg">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-2xl">
              ☀️
            </div>
          </div>
          <h1 className="text-2xl font-black text-white">
            썬 테니스 클럽 {isSignUp ? '회원가입' : '로그인'}
          </h1>
          <p className="text-xs text-slate-400">
            {isSignUp
              ? '신규 회원 정보를 입력하고 클럽 대진표와 전적 관리를 시작하세요.'
              : '로그인하여 실시간 코트 대진표와 공식 전적을 확인하세요.'}
          </p>
        </div>

        {/* 로그인 / 회원가입 상단 탭 버튼 */}
        <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-extrabold">
          <button
            type="button"
            onClick={() => setIsSignUp(false)}
            className={`py-2.5 rounded-xl transition ${
              !isSignUp
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🔑 로그인
          </button>
          <button
            type="button"
            onClick={() => setIsSignUp(true)}
            className={`py-2.5 rounded-xl transition ${
              isSignUp
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ✨ 회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isSignUp && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">이름 *</label>
                <input
                  type="text"
                  placeholder="실명 입력 (예: 홍길동)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-amber-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">성별 *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="M">남성 (M)</option>
                    <option value="F">여성 (F)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">테니스 등급(부수) *</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-amber-300 font-bold outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">이메일 주소 *</label>
            <input
              type="email"
              placeholder="example@tennis.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-amber-400"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">비밀번호 *</label>
            <input
              type="password"
              placeholder="비밀번호 입력 (6자 이상)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-amber-400"
              required
            />
          </div>

          {isSignUp && (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">비밀번호 확인 *</label>
              <input
                type="password"
                placeholder="비밀번호 다시 입력"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-amber-400"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3 font-black rounded-xl shadow-lg text-sm transition ${
              isSignUp
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950'
            }`}
          >
            {submitting
              ? '처리 중...'
              : isSignUp
              ? '✨ 회원가입 완료하기'
              : '🎾 로그인하기'}
          </button>
        </form>

        {/* 하단 회원가입 / 로그인 전환 버튼 */}
        <div className="pt-2 border-t border-slate-800 text-center space-y-2">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/30 hover:bg-emerald-950/60 text-emerald-300 font-bold text-xs transition"
          >
            {isSignUp
              ? '이미 계정이 있으신가요? 로그인 화면으로 이동'
              : '처음이신가요? 썬 테니스 클럽 회원가입 하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
