import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import MyPage from './MyPage'; // 마이페이지 컴포넌트

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. 현재 로그인된 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. 로그인/로그아웃 상태 변경 실시간 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 로그아웃 함수
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  }

  // 로그인하지 않은 경우 로그인 화면 표시
  if (!session) {
    return <LoginComponent supabase={supabase} />;
  }

  // 로그인된 경우, 현재 회원의 id를 마이페이지에 전달
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
      
      {/* 마이페이지 호출 (로그인된 회원의 UUID 전달) */}
      <MyPage userId={currentUserId} />
    </div>
  );
}

// 간단한 로그인 및 회원가입 컴포넌트
export function LoginComponent({ supabase }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('M');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || '클럽회원',
            gender: gender,
          },
        },
      });
      if (error) {
        alert('회원가입 실패: ' + error.message);
      } else {
        alert('회원가입 완료! 자동 생성된 프로필로 로그인됩니다.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert('로그인 실패: ' + error.message);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white min-h-screen flex flex-col justify-center">
      <h1 className="text-2xl font-bold text-green-800 mb-6 text-center">
        🎾 테니스 클럽 {isSignUp ? '회원가입' : '로그인'}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">이름</label>
              <input
                type="text"
                placeholder="홍길동"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">성별</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="M">남성 (M)</option>
                <option value="F">여성 (F)</option>
              </select>
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">이메일</label>
          <input
            type="email"
            placeholder="이메일 주소"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-green-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">비밀번호</label>
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-green-500"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-green-600 text-white font-bold rounded-xl shadow-md hover:bg-green-700 transition"
        >
          {isSignUp ? '회원가입 완료하기' : '로그인하기'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-xs text-green-700 font-semibold hover:underline"
        >
          {isSignUp ? '이미 계정이 있으신가요? 로그인' : '처음이신가요? 클럽 회원가입'}
        </button>
      </div>
    </div>
  );
}
