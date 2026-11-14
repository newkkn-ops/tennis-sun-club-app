import React, { useState, useEffect } from 'react';
import { createClient, Session } from '@supabase/supabase-js';

import TennisCourtBoardWithRealtime from './components/TennisCourtBoard';
import MyPage from './components/MyPage';
import AdminUserManagement from './components/AdminUserManagement';
import TournamentScheduleView from './components/TournamentScheduleView';
import { UserProfile } from './hooks/useAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type AppTab = 'courts' | 'tournament' | 'mypage' | 'admin';

export default function TennisApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('courts');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
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

  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setUserProfile(data as UserProfile);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 font-medium">로딩 중...</div>;
  }

  if (!session) {
    return <LoginView supabase={supabase} />;
  }

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen pb-20 font-sans relative">
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

function LoginView({ supabase }: { supabase: any }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert('로그인 실패: ' + error.message);
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white min-h-screen flex flex-col justify-center">
      <h1 className="text-2xl font-bold text-green-800 mb-2 text-center">🎾 테니스 클럽 앱</h1>
      <p className="text-xs text-gray-500 text-center mb-8">로그인하여 실시간 대진표와 전적을 확인하세요.</p>
      
      <form onSubmit={handleLogin} className="space-y-4">
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
          className="w-full py-3 bg-green-600 text-white font-bold rounded-xl shadow-md hover:bg-green-700 text-sm"
        >
          로그인하기
        </button>
      </form>
    </div>
  );
}
