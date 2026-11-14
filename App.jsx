import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 앞서 만든 컴포넌트들 임포트
import TennisCourtBoardWithRealtime from './components/TennisCourtBoard';
import MyPage from './components/MyPage';
import AdminUserManagement from './components/AdminUserManagement';
import TournamentScheduleView from './components/TournamentScheduleView';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function TennisApp() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('courts'); // 'courts' | 'tournament' | 'mypage' | 'admin'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. 세션 확인 및 사용자 프로필(역할, 등급) 조회
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchUserProfile(session.user.id);
      else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // public.users 테이블에서 회원의 권한(role) 가져오기
  const fetchUserProfile = async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setUserProfile(data);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 font-medium">로딩 중...</div>;
  }

  // 1. 로그인되지 않은 경우 로그인 화면 출력
  if (!session) {
    return <LoginView supabase={supabase} />;
  }

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen pb-20 font-sans relative">
      {/* 상단 미니 헤더 */}
      <header className="bg-white px-4 py-3 border-b flex justify-between items-center sticky top-0 z-40 shadow-xs">
        <div>
          <span className="text-xs text-gray-400 block font-medium">테니스 클럽 운영 앱</span>
          <span className="text-sm font-bold text-gray-800">
            {userProfile?.name || '회원'}님 ({userProfile?.grade || '테린이'})
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg font-semibold hover:bg-gray-200 transition"
        >
          로그아웃
        </button>
      </header>

      {/* 메인 콘텐츠 영역 (선택된 탭에 따라 컴포넌트 렌더링) */}
      <main className="p-2">
        {activeTab === 'courts' && <TennisCourtBoardWithRealtime />}
        
        {activeTab === 'tournament' && (
          <div className="p-2">
            <TournamentScheduleView />
          </div>
        )}

        {activeTab === 'mypage' && <MyPage userId={session.user.id} />}

        {activeTab === 'admin' && userProfile?.role === 'admin' && <AdminUserManagement />}
      </main>

      {/* 하단 고정 네비게이션 탭 바 (Bottom Navigation Bar) */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 px-4 py-2 flex justify-around items-center z-50 shadow-lg">
        <button
          onClick={() => setActiveTab('courts')}
          className={`flex flex-col items-center text-xs font-semibold ${activeTab === 'courts' ? 'text-green-600' : 'text-gray-400'}`}
        >
          🎾 <span className="mt-1">실시간 코트</span>
        </button>

        <button
          onClick={() => setActiveTab('tournament')}
          className={`flex flex-col items-center text-xs font-semibold ${activeTab === 'tournament' ? 'text-green-600' : 'text-gray-400'}`}
        >
          📊 <span className="mt-1">대진표</span>
        </button>

        <button
          onClick={() => setActiveTab('mypage')}
          className={`flex flex-col items-center text-xs font-semibold ${activeTab === 'mypage' ? 'text-green-600' : 'text-gray-400'}`}
        >
          👤 <span className="mt-1">마이페이지</span>
        </button>

        {/* 운영자(admin) 계정일 때만 하단 탭에 관리자 메뉴 노출 */}
        {userProfile?.role === 'admin' && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center text-xs font-semibold ${activeTab === 'admin' ? 'text-red-600' : 'text-gray-400'}`}
          >
            ⚙️ <span className="mt-1">관리자</span>
          </button>
        )}
      </nav>
    </div>
  );
}

// 로그인 및 회원가입 뷰 컴포넌트
function LoginView({ supabase }) {
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
        alert('회원가입 완료! 로그인해 주세요.');
        setIsSignUp(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert('로그인 실패: ' + error.message);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white min-h-screen flex flex-col justify-center">
      <h1 className="text-2xl font-bold text-green-800 mb-2 text-center">🎾 테니스 클럽 앱</h1>
      <p className="text-xs text-gray-500 text-center mb-6">
        {isSignUp ? '신규 회원 정보를 입력하여 가입하세요.' : '로그인하여 실시간 대진표와 전적을 확인하세요.'}
      </p>
      
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
                className="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">성별</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
              >
                <option value="M">남성 (M)</option>
                <option value="F">여성 (F)</option>
              </select>
            </div>
          </>
        )}

        <input
          type="email"
          placeholder="이메일 주소"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm"
          required
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm"
          required
        />
        <button
          type="submit"
          className="w-full py-3 bg-green-600 text-white font-bold rounded-xl shadow-md hover:bg-green-700 text-sm transition"
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
