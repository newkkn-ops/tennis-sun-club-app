import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 컴포넌트 임포트
import TennisCourtBoardWithRealtime from './components/TennisCourtBoard';
import MyPage from './components/MyPage';
import AdminUserManagement from './components/AdminUserManagement';
import TournamentScheduleView from './components/TournamentScheduleView';
import ServiceWorkerRegister from './components/ServiceWorkerRegister';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function TennisApp() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('courts'); // 'courts' | 'tournament' | 'mypage' | 'admin'
  const [loading, setLoading] = useState(true);

  // 게스트/데모 모드 지원 (Supabase 로그인 없이도 클럽 기능 미리보기 가능)
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
    if (isDemoMode) {
      setIsDemoMode(false);
      setUserProfile(null);
      return;
    }
    await supabase.auth.signOut();
  };

  const handleStartDemo = (role = 'member') => {
    setIsDemoMode(true);
    setUserProfile({
      id: 'demo-user-1',
      name: role === 'admin' ? '운영자 김선샤인' : '김철수',
      grade: '금배',
      role: role,
    });
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white font-sans p-4">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full border-4 border-amber-400/20 border-t-amber-400 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-2xl">☀️</div>
        </div>
        <h2 className="text-xl font-black tracking-wider text-amber-300">SUN TENNIS CLUB</h2>
        <p className="text-sm text-emerald-300/80 mt-1">썬 테니스 클럽 시스템 로딩 중...</p>
      </div>
    );
  }

  // 비로그인 상태일 때: 화려한 썬 클럽 랜딩 & 로그인 화면
  if (!session && !isDemoMode) {
    return <SunClubLandingLogin supabase={supabase} onStartDemo={handleStartDemo} />;
  }

  const effectiveUser = userProfile || {
    name: session?.user?.user_metadata?.name || '클럽회원',
    grade: '테린이',
    role: 'member',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-900 flex justify-center">
      {/* PC/태블릿 와이드 데스크톱 레이아웃 래퍼 */}
      <div className="w-full max-w-7xl flex flex-col lg:flex-row justify-center items-start lg:gap-8 lg:p-6">
        
        {/* ======================================================== */}
        {/* [PC 전용 사이드 패널]: 썬(SUN) 클럽 브랜딩 & 실시간 정보 */}
        {/* ======================================================== */}
        <aside className="hidden lg:flex flex-col w-[380px] shrink-0 sticky top-6 space-y-4">
          {/* 썬 클럽 공식 히어로 비주얼 카드 */}
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-amber-500/20 group">
            <img
              src="/sun-tennis-hero.jpg"
              alt="썬 테니스 클럽"
              className="w-full h-56 object-cover object-center group-hover:scale-105 transition-transform duration-700"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent flex flex-col justify-end p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 uppercase tracking-wider shadow-sm">
                  Official Club
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  라이브 운영 중
                </span>
              </div>
              <h1 className="text-2xl font-black text-white flex items-center gap-2">
                <span className="text-amber-400 text-3xl">☀️</span>
                <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-orange-400 bg-clip-text text-transparent">
                  썬 테니스 클럽
                </span>
              </h1>
              <p className="text-xs text-slate-300 font-medium mt-1 leading-relaxed">
                태양처럼 뜨거운 열정과 페어플레이! 회원들의 실시간 코트 대진 및 경기 통합 시스템
              </p>
            </div>
          </div>

          {/* 오늘의 코트 상태 요약 위젯 */}
          <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-4 border border-slate-800 shadow-xl space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <span>📍</span> 코트 가동 상태
              </span>
              <span className="text-xs font-extrabold text-amber-400">총 4면 (실내/야외)</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/50">
                <span className="text-slate-400 block text-[11px]">진행 중인 경기</span>
                <span className="text-lg font-black text-emerald-400">2 코트 🔴</span>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/50">
                <span className="text-slate-400 block text-[11px]">대기 중인 매치</span>
                <span className="text-lg font-black text-amber-400">3 게임 ⏳</span>
              </div>
            </div>
          </div>

          {/* 모바일 스마트폰 연동 QR 및 PWA 안내 카드 */}
          <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-amber-950/30 rounded-2xl p-4 border border-emerald-500/20 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 shrink-0 shadow-md">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-xl">
                  📱
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">스마트폰 앱(PWA) 연동</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  스마트폰 브라우저에서 접속 시 <strong>[홈 화면에 추가]</strong>를 누르면 실제 앱처럼 동작합니다.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* ======================================================== */}
        {/* [메인 앱 본체]: 스마트폰 크기 모바일 프레임 + 반응형 통합 */}
        {/* ======================================================== */}
        <div className="w-full max-w-md mx-auto bg-slate-900/95 lg:rounded-3xl border-x lg:border border-slate-800/80 shadow-2xl min-h-screen lg:min-h-[820px] pb-24 relative overflow-hidden backdrop-blur-xl">
          
          {/* 썬(SUN) 클럽 프리미엄 상단 헤더 */}
          <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/80 px-4 py-3.5 border-b border-amber-500/20 sticky top-0 z-40 backdrop-blur-md flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-2.5">
              {/* 썬 테니스 엠블럼 아이콘 */}
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-lime-400 p-0.5 shadow-md shadow-amber-500/20 animate-pulse">
                  <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-lg">
                    ☀️
                  </div>
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full" />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                    SUN TENNIS
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    LIVE
                  </span>
                </div>
                <div className="text-sm font-extrabold text-white flex items-center gap-1.5">
                  <span>{effectiveUser.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    {effectiveUser.grade}
                  </span>
                </div>
              </div>
            </div>

            {/* 헤더 우측 로그아웃 / 데모 토글 버튼 */}
            <div className="flex items-center gap-1.5">
              {effectiveUser.role === 'admin' && (
                <span className="text-[10px] px-2 py-0.8 bg-red-950/80 text-red-300 font-bold rounded-lg border border-red-500/30">
                  👑 ADMIN
                </span>
              )}
              <button
                onClick={handleLogout}
                className="text-xs px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl font-semibold transition border border-slate-700/60 shadow-xs"
              >
                {isDemoMode ? '로그인 복귀' : '로그아웃'}
              </button>
            </div>
          </header>

          {/* PWA 서비스 워커 등록 & 스마트폰 푸시 알림 권한 배너 */}
          <ServiceWorkerRegister userId={effectiveUser?.id} />

          {/* 메인 콘텐츠 탭 영역 */}
          <main className="p-3">
            {activeTab === 'courts' && <TennisCourtBoardWithRealtime />}
            {activeTab === 'tournament' && <TournamentScheduleView />}
            {activeTab === 'mypage' && <MyPage userId={effectiveUser.id} />}
            {activeTab === 'admin' && effectiveUser.role === 'admin' && <AdminUserManagement />}
          </main>

          {/* 하단 고정 네비게이션 탭바 (현대적인 플로팅 글래스모피즘 스타일) */}
          <nav className="fixed lg:absolute bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-950/90 backdrop-blur-md border-t border-slate-800/80 px-3 py-2 flex justify-around items-center z-50 shadow-2xl">
            <button
              onClick={() => setActiveTab('courts')}
              className={`flex flex-col items-center py-1 px-3 rounded-2xl transition-all ${
                activeTab === 'courts'
                  ? 'text-amber-400 font-bold scale-105 bg-amber-400/10'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <span className="text-lg">🎾</span>
              <span className="text-[10px] mt-0.5">실시간 코트</span>
            </button>

            <button
              onClick={() => setActiveTab('tournament')}
              className={`flex flex-col items-center py-1 px-3 rounded-2xl transition-all ${
                activeTab === 'tournament'
                  ? 'text-amber-400 font-bold scale-105 bg-amber-400/10'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <span className="text-lg">📊</span>
              <span className="text-[10px] mt-0.5">대진표</span>
            </button>

            <button
              onClick={() => setActiveTab('mypage')}
              className={`flex flex-col items-center py-1 px-3 rounded-2xl transition-all ${
                activeTab === 'mypage'
                  ? 'text-amber-400 font-bold scale-105 bg-amber-400/10'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <span className="text-lg">👤</span>
              <span className="text-[10px] mt-0.5">마이페이지</span>
            </button>

            {effectiveUser.role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex flex-col items-center py-1 px-3 rounded-2xl transition-all ${
                  activeTab === 'admin'
                    ? 'text-red-400 font-bold scale-105 bg-red-400/10'
                    : 'text-slate-400 hover:text-slate-200 font-medium'
                }`}
              >
                <span className="text-lg">⚙️</span>
                <span className="text-[10px] mt-0.5">운영관리</span>
              </button>
            )}
          </nav>
        </div>

      </div>
    </div>
  );
}

// ========================================================
// 썬(SUN) 테니스 클럽 전용 화려한 랜딩 & 로그인 화면
// ========================================================
function SunClubLandingLogin({ supabase, onStartDemo }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('M');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
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
        if (error) throw error;
        alert('회원가입이 완료되었습니다! 로그인해 주세요.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setErrorMsg(err.message || '인증에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* 배경 장식 원형 조명 */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        
        {/* 썬 클럽 대표 엠블럼 & 헤더 */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-tr from-amber-500 via-orange-500 to-lime-400 p-1 shadow-2xl shadow-amber-500/30">
            <div className="w-full h-full rounded-[22px] bg-slate-950 flex flex-col items-center justify-center">
              <span className="text-4xl filter drop-shadow">☀️</span>
              <span className="text-[10px] font-black tracking-widest text-amber-400 mt-1">SUN CLUB</span>
            </div>
          </div>

          <div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-400/10 text-amber-300 border border-amber-400/20">
              🎾 TENNIS CLUB OPERATIONS
            </span>
            <h1 className="text-3xl font-black mt-2 text-white tracking-tight">
              썬 테니스 클럽
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              실시간 코트 스코어 중계 · KDK 파트너 로테이션 · 토너먼트 자동 편성
            </p>
          </div>
        </div>

        {/* 로그인 / 회원가입 폼 카드 */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex border-b border-slate-800 pb-3">
            <button
              onClick={() => { setIsSignUp(false); setErrorMsg(''); }}
              className={`flex-1 text-center font-bold text-sm py-1.5 transition ${
                !isSignUp ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-400'
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => { setIsSignUp(true); setErrorMsg(''); }}
              className={`flex-1 text-center font-bold text-sm py-1.5 transition ${
                isSignUp ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-400'
              }`}
            >
              회원가입
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/80 border border-red-500/40 rounded-xl text-xs text-red-200">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {isSignUp && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">회원 이름</label>
                  <input
                    type="text"
                    required
                    placeholder="홍길동"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">성별</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGender('M')}
                      className={`py-2 text-xs font-bold rounded-xl border ${gender === 'M' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                    >
                      남성 (M)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('F')}
                      className={`py-2 text-xs font-bold rounded-xl border ${gender === 'F' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                    >
                      여성 (F)
                    </button>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">이메일 주소</label>
              <input
                type="email"
                required
                placeholder="tennis@sunclub.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">비밀번호</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20"
            >
              {loading ? '처리 중...' : isSignUp ? '☀️ 썬 테니스 클럽 가입하기' : '🎾 썬 클럽 입장하기'}
            </button>
          </form>

          {/* 원클릭 즉시 체험 (게스트 데모 모드) */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <span className="text-[11px] text-slate-400 block text-center">
              로그인 없이 바로 화면과 기능을 둘러보시겠어요?
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onStartDemo('member')}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs rounded-xl border border-emerald-500/30 transition shadow-xs"
              >
                👤 회원 모드로 체험
              </button>
              <button
                type="button"
                onClick={() => onStartDemo('admin')}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl border border-amber-500/30 transition shadow-xs"
              >
                👑 운영자 모드로 체험
              </button>
            </div>
          </div>
        </div>

        {/* 풋터 */}
        <p className="text-[11px] text-slate-500 text-center">
          © 2026 SUN TENNIS CLUB. All rights reserved.
        </p>
      </div>
    </div>
  );
}
