'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function TennisApp() {
  const [activeTab, setActiveTab] = useState('courts'); // 'courts' | 'tournament' | 'mypage' | 'admin'
  const [role, setRole] = useState('member'); // 'member' | 'admin'
  const [subTourTab, setSubTourTab] = useState('kdk'); // 'kdk' | 'bracket'

  // 참가자 명단 입력 및 대진표 생성 상태
  const [participantsInput, setParticipantsInput] = useState(
    '김철수, 박민수, 이영희, 최수진, 정지훈, 한지민, 송중기, 강동원'
  );
  const [generatedRounds, setGeneratedRounds] = useState([]);

  // 실시간 코트 현황 데이터
  const [courts, setCourts] = useState([
    {
      id: 1,
      courtNumber: 1,
      status: 'playing',
      teamA: ['김철수 (금배)', '강동원 (금배)'],
      teamB: ['박민수 (은배)', '정지훈 (동배)'],
      scoreA: 5,
      scoreB: 3,
    },
    {
      id: 2,
      courtNumber: 2,
      status: 'playing',
      teamA: ['이영희 (국화)', '한지민 (은배)'],
      teamB: ['최수진 (개나리)', '김태희 (테린이)'],
      scoreA: 2,
      scoreB: 4,
    },
    {
      id: 3,
      courtNumber: 3,
      status: 'waiting',
      teamA: ['송중기 (동배)', '조인성 (은배)'],
      teamB: ['공유 (금배)', '정우성 (은배)'],
      scoreA: 0,
      scoreB: 0,
    },
  ]);

  // 회원 목록 데이터
  const [users, setUsers] = useState([
    { id: 'u1', name: '김철수', gender: '남', grade: '금배', role: 'member' },
    { id: 'u2', name: '이영희', gender: '여', grade: '국화', role: 'member' },
    { id: 'u3', name: '박민수', gender: '남', grade: '은배', role: 'member' },
    { id: 'u4', name: '정지훈', gender: '남', grade: '동배', role: 'member' },
    { id: 'u5', name: '최수진', gender: '여', grade: '개나리', role: 'member' },
    { id: 'u6', name: '강동원', gender: '남', grade: '금배', role: 'member' },
    { id: 'u7', name: '한지민', gender: '여', grade: '은배', role: 'member' },
    { id: 'u8', name: '송중기', gender: '남', grade: '동배', role: 'member' },
    { id: 'u9', name: '조인성', gender: '남', grade: '은배', role: 'member' },
    { id: 'u10', name: '공유', gender: '남', grade: '금배', role: 'admin' },
  ]);

  // 스코어 수정 모달 상태
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [inputScoreA, setInputScoreA] = useState(0);
  const [inputScoreB, setInputScoreB] = useState(0);
  const [inputStatus, setInputStatus] = useState('playing');

  // 알림 권한 상태
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);

  useEffect(() => {
    // Supabase 연동 시도 (실제 환경 변수가 있을 경우 실시간 동기화)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
      supabase.from('matches').select('*').then(({ data }) => {
        if (data && data.length > 0) {
          // 필요 시 DB 데이터 병합
        }
      });
    }
  }, []);

  // 대진표 자동 생성 함수
  const handleGenerateBracket = () => {
    const names = participantsInput
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length < 4) {
      alert('최소 4명 이상의 참가자가 필요합니다.');
      return;
    }

    const rounds = [];
    for (let r = 1; r <= 3; r++) {
      const shuffled = [...names].sort(() => Math.random() - 0.5);
      const matches = [];
      for (let i = 0; i < shuffled.length; i += 4) {
        if (i + 3 < shuffled.length) {
          matches.push({
            court: matches.length + 1,
            team1: [shuffled[i], shuffled[i + 1]],
            team2: [shuffled[i + 2], shuffled[i + 3]],
          });
        }
      }
      rounds.push({ round: r, matches });
    }
    setGeneratedRounds(rounds);
  };

  const setQuickNames = (count) => {
    if (count === 8) {
      setParticipantsInput('김철수, 박민수, 이영희, 최수진, 정지훈, 한지민, 송중기, 강동원');
    } else {
      setParticipantsInput('김철수, 박민수, 이영희, 최수진, 정지훈, 한지민, 송중기, 강동원, 조인성, 공유, 김태희, 전지현');
    }
  };

  const openScoreModal = (court) => {
    setSelectedCourt(court);
    setInputScoreA(court.scoreA);
    setInputScoreB(court.scoreB);
    setInputStatus(court.status);
  };

  const saveCourtScore = () => {
    if (!selectedCourt) return;
    setCourts(
      courts.map((c) =>
        c.id === selectedCourt.id
          ? {
              ...c,
              scoreA: Number(inputScoreA),
              scoreB: Number(inputScoreB),
              status: inputStatus,
            }
          : c
      )
    );
    setSelectedCourt(null);
  };

  const handleUserGradeChange = (userId, newGrade) => {
    setUsers(users.map((u) => (u.id === userId ? { ...u, grade: newGrade } : u)));
  };

  const toggleRole = () => {
    setRole((prev) => (prev === 'admin' ? 'member' : 'admin'));
  };

  const requestPushPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setIsPushSubscribed(true);
        alert('🔔 썬 테니스 클럽 코트 출전 알림이 활성화되었습니다!');
      }
    }
  };

  const GRADE_OPTIONS = ['금배', '은배', '동배', '국화', '개나리', '테린이', '고령자부'];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-900">
      
      {/* 와이드 PC & 모바일 하이브리드 컨테이너 */}
      <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row justify-center items-start lg:gap-8 lg:p-6 min-h-screen">

        {/* ======================================================== */}
        {/* [PC 전용 사이드 패널]: 썬(SUN) 테니스 클럽 공식 브랜딩 & 코트 요약 */}
        {/* ======================================================== */}
        <aside className="hidden lg:flex flex-col w-[380px] shrink-0 sticky top-6 space-y-4">
          {/* 썬 클럽 공식 히어로 비주얼 카드 */}
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-amber-500/20 group">
            <img
              src="/sun-tennis-hero.jpg"
              alt="썬 테니스 클럽"
              className="w-full h-56 object-cover object-center group-hover:scale-105 transition-transform duration-700"
              onError={(e) => {
                e.target.src = '/sun-banner.png';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent flex flex-col justify-end p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 uppercase tracking-wider shadow-sm">
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

          {/* 오늘의 코트 가동 상태 위젯 */}
          <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-4 border border-slate-800 shadow-xl space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <i className="fa-solid fa-location-dot text-amber-400" /> 코트 가동 현황
              </span>
              <span className="text-xs font-extrabold text-amber-400">총 4면 (하드/클레이)</span>
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

          {/* 스마트폰 PWA 연동 카드 */}
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
                  스마트폰 브라우저에서 접속 시 <strong>[홈 화면에 추가]</strong>를 누르면 실제 앱처럼 설치되어 동작합니다.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* ======================================================== */}
        {/* [메인 모바일 프레임]: 스마트폰 크기 모바일 뷰 (터치 최적화) */}
        {/* ======================================================== */}
        <div className="w-full max-w-md mx-auto bg-slate-900/95 lg:rounded-3xl border-x lg:border border-slate-800/80 shadow-2xl min-h-screen lg:min-h-[840px] pb-24 relative overflow-hidden backdrop-blur-xl">
          
          {/* 상단 앱 헤더 (썬 테니스 클럽 엠블럼 & 프로필) */}
          <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/80 px-4 py-3.5 border-b border-amber-500/20 sticky top-0 z-40 backdrop-blur-md flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-2.5">
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
                  <span>김철수 회원님</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    금배
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleRole}
                className={`text-[10px] px-2.5 py-1 rounded-xl font-bold transition border ${
                  role === 'admin'
                    ? 'bg-red-950/80 text-red-300 border-red-500/40'
                    : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
                }`}
              >
                {role === 'admin' ? '👑 관리자 모드' : '👤 회원 모드'}
              </button>
            </div>
          </header>

          {/* 알림 권한 요청 배너 */}
          <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-950/90 via-slate-900 to-slate-950 border-b border-emerald-500/30 flex justify-between items-center text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-medium">
              <i className="fa-solid fa-bell text-amber-400" />
              <span>내 출전 차례 시 실시간 알림 받기</span>
            </div>
            <button
              onClick={requestPushPermission}
              className={`px-2.5 py-1 font-black rounded-lg text-[11px] shadow-sm transition ${
                isPushSubscribed
                  ? 'bg-slate-800 text-emerald-400'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-950 hover:from-emerald-500 hover:to-teal-500'
              }`}
            >
              {isPushSubscribed ? '알림 켜짐 ✓' : '알림 켜기'}
            </button>
          </div>

          {/* 메인 탭 콘텐츠 영역 */}
          <main className="p-3">
            
            {/* ---------------------------------------------------- */}
            {/* [탭 1]: 실시간 코트 현황판 */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'courts' && (
              <div className="space-y-3.5">
                <div className="flex justify-between items-center bg-gradient-to-r from-emerald-950/80 via-slate-900 to-amber-950/60 p-3 rounded-2xl border border-emerald-500/20 shadow-md">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </span>
                    <h2 className="text-sm font-extrabold text-white">썬 클럽 실시간 코트 현황</h2>
                  </div>
                  <span className="text-[11px] font-bold text-amber-300 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                    ☀️ LIVE 중계 중
                  </span>
                </div>

                <div className="space-y-3.5">
                  {courts.map((court) => {
                    const isPlaying = court.status === 'playing';
                    return (
                      <div
                        key={court.id}
                        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-750 p-4 shadow-xl hover:border-amber-500/30 transition-all group"
                      >
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-md">
                              {court.courtNumber}
                            </span>
                            <span className="font-extrabold text-sm text-white">{court.courtNumber}번 코트</span>
                            <span className="text-[10px] text-slate-400 hidden sm:inline">(클럽 공식 코트)</span>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                              isPlaying
                                ? 'bg-red-950/80 text-red-300 border-red-500/40 animate-pulse'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {isPlaying ? '🔴 경기 진행 중' : '⚪ 다음 경기 대기'}
                          </span>
                        </div>

                        <div className="grid grid-cols-7 gap-2 items-center bg-slate-950/90 p-3.5 rounded-xl border border-slate-800/80 mb-3 shadow-inner">
                          <div className="col-span-3 text-center">
                            <span className="text-[10px] uppercase font-extrabold text-emerald-400 block mb-0.5">TEAM SUN</span>
                            <p className="text-sm font-bold text-white truncate">{court.teamA.join(' / ')}</p>
                          </div>
                          <div className="col-span-1 flex flex-col items-center justify-center">
                            <div className="px-2 py-1 rounded-lg bg-slate-950 border border-amber-500/30 shadow-md">
                              <span className="text-xl font-black text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
                                {court.scoreA} : {court.scoreB}
                              </span>
                            </div>
                            <span className="text-[9px] text-slate-500 font-bold mt-0.5">GAME</span>
                          </div>
                          <div className="col-span-3 text-center">
                            <span className="text-[10px] uppercase font-extrabold text-amber-400 block mb-0.5">TEAM ACE</span>
                            <p className="text-sm font-bold text-white truncate">{court.teamB.join(' / ')}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => openScoreModal(court)}
                          className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>⚡</span>
                          <span>실시간 스코어 입력 / 결과 저장</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* [탭 2]: 대진표 및 토너먼트 */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'tournament' && (
              <div className="space-y-4">
                {/* 참가자 명단 입력 폼 및 생성 버튼 */}
                <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-extrabold text-sm text-white flex items-center gap-1.5">
                      <span className="text-amber-400">☀️</span> 참가자 명단 입력 (쉼표 구분)
                    </h3>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setQuickNames(8)}
                        className="text-[10px] px-2 py-0.8 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700"
                      >
                        8명
                      </button>
                      <button
                        onClick={() => setQuickNames(12)}
                        className="text-[10px] px-2 py-0.8 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700"
                      >
                        12명
                      </button>
                    </div>
                  </div>

                  <textarea
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono leading-relaxed"
                    rows={3}
                    value={participantsInput}
                    onChange={(e) => setParticipantsInput(e.target.value)}
                  />

                  <button
                    onClick={handleGenerateBracket}
                    className="w-full py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>🏓</span>
                    <span>썬 클럽 실시간 대진표 자동 생성</span>
                  </button>
                </div>

                {/* 생성된 대진표 결과 */}
                {generatedRounds.length > 0 && (
                  <div className="space-y-3 animate-fade-in">
                    <div className="flex justify-between items-center px-1">
                      <h4 className="text-xs font-extrabold text-amber-300">
                        ✨ 자동 생성된 실시간 대진표 ({generatedRounds.length}개 라운드)
                      </h4>
                      <span className="text-[10px] text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                        생성 완료
                      </span>
                    </div>

                    {generatedRounds.map((gr) => (
                      <div key={gr.round} className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-2">
                        <div className="text-xs font-black text-amber-400 border-b border-slate-800 pb-1.5 flex justify-between">
                          <span>제 {gr.round} 라운드</span>
                          <span className="text-slate-400 font-normal text-[11px]">{gr.matches.length}개 코트 진행</span>
                        </div>
                        <div className="space-y-1.5">
                          {gr.matches.map((m, idx) => (
                            <div key={idx} className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                              <span className="font-extrabold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20 text-[10px]">
                                코트 {m.court}
                              </span>
                              <span className="font-bold text-white">{m.team1[0]} / {m.team1[1]}</span>
                              <span className="font-black text-slate-500 text-[10px]">VS</span>
                              <span className="font-bold text-white">{m.team2[0]} / {m.team2[1]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 서브 탭 (KDK 예선 리그 / 본선 토너먼트) */}
                <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 text-xs font-bold">
                  <button
                    onClick={() => setSubTourTab('kdk')}
                    className={`flex-1 py-2 rounded-xl transition ${
                      subTourTab === 'kdk'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🎾 KDK 예선 리그
                  </button>
                  <button
                    onClick={() => setSubTourTab('bracket')}
                    className={`flex-1 py-2 rounded-xl transition ${
                      subTourTab === 'bracket'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🏆 본선 토너먼트
                  </button>
                </div>

                {subTourTab === 'kdk' ? (
                  <div className="space-y-3">
                    <div className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-2">
                      <div className="text-xs font-black text-emerald-400 border-b border-slate-800 pb-1.5 flex justify-between">
                        <span>제 1 라운드 (KDK 밸런싱)</span>
                        <span className="text-slate-400 font-normal text-[11px]">2개 코트 진행</span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                          <span className="font-extrabold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-lg border border-emerald-400/20 text-[10px]">코트 1</span>
                          <span className="font-bold text-white">김철수 / 강동원</span>
                          <span className="font-black text-slate-500 text-[10px]">VS</span>
                          <span className="font-bold text-white">박민수 / 정지훈</span>
                        </div>
                        <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                          <span className="font-extrabold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-lg border border-emerald-400/20 text-[10px]">코트 2</span>
                          <span className="font-bold text-white">이영희 / 한지민</span>
                          <span className="font-black text-slate-500 text-[10px]">VS</span>
                          <span className="font-bold text-white">최수진 / 송중기</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 flex justify-between items-center">
                      <div>
                        <span className="text-xs font-black text-amber-400 block">본선 토너먼트 브래킷 (16강)</span>
                        <span className="text-[11px] text-slate-400">상위 1~6위 부전승(BYE) 자동 배정</span>
                      </div>
                      <button
                        onClick={() => alert('본선 16강 토너먼트 브래킷이 편성되었습니다!')}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-black shadow-xs"
                      >
                        브래킷 생성
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* [탭 3]: 마이페이지 */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'mypage' && (
              <div className="space-y-4">
                {/* VIP 멤버십 배너 */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700 p-5 text-slate-950 shadow-2xl">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-950/70 block">
                        SUN TENNIS VIP CLUB
                      </span>
                      <h2 className="text-xl font-black text-slate-950 flex items-center gap-1.5">
                        <span>☀️</span> 김철수 회원님
                      </h2>
                      <div className="flex gap-1.5 pt-1">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-950 text-amber-300 shadow-sm">
                          금배 (Lv.5)
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/40 text-slate-950">
                          정회원
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-extrabold text-slate-950/70 block">승률 랭킹</span>
                      <span className="text-2xl font-black text-slate-950">TOP 3 🏆</span>
                    </div>
                  </div>
                </div>

                {/* 통산 4대 지표 */}
                <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                      <span>📊</span> 통산 누적 공식 전적
                    </span>
                    <span className="text-xs font-extrabold text-amber-400">승률 75.0%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                    <div className="bg-gradient-to-r from-amber-400 to-emerald-400 h-2.5 rounded-full" style={{ width: '75%' }} />
                  </div>
                  <div className="grid grid-cols-4 gap-2 pt-1 text-center text-xs">
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <p className="text-[10px] text-slate-400">총 경기</p>
                      <p className="text-base font-black text-white">12</p>
                    </div>
                    <div className="bg-emerald-950/40 p-2 rounded-xl border border-emerald-500/20">
                      <p className="text-[10px] text-emerald-400 font-bold">승리</p>
                      <p className="text-base font-black text-emerald-300">9</p>
                    </div>
                    <div className="bg-red-950/40 p-2 rounded-xl border border-red-500/20">
                      <p className="text-[10px] text-red-400 font-bold">패배</p>
                      <p className="text-base font-black text-red-300">3</p>
                    </div>
                    <div className="bg-amber-950/40 p-2 rounded-xl border border-amber-500/20">
                      <p className="text-[10px] text-amber-400 font-bold">득실차</p>
                      <p className="text-base font-black text-amber-300">+21</p>
                    </div>
                  </div>
                </div>

                {/* 최근 경기 이력 타임라인 */}
                <div className="space-y-2">
                  <h3 className="text-xs font-extrabold text-slate-300 px-1">🎾 최근 경기 상세 이력</h3>
                  <div className="space-y-2">
                    <div className="bg-slate-900 border border-slate-750 p-3 rounded-2xl shadow-md flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white">월례회 KDK 결승전 <span className="text-[10px] text-slate-400">코트 1번</span></div>
                        <p className="text-[11px] text-slate-400">파트너: 강동원 (금배) vs 박민수 / 정지훈</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">6 : 4</span>
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">WIN</span>
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-750 p-3 rounded-2xl shadow-md flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white">월례회 KDK 예선 R3 <span className="text-[10px] text-slate-400">코트 2번</span></div>
                        <p className="text-[11px] text-slate-400">파트너: 이영희 (국화) vs 최수진 / 한지민</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">6 : 3</span>
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">WIN</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* [탭 4]: 운영자 관리 센터 */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'admin' && (
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h3 className="text-sm font-black text-red-400 flex items-center gap-1.5">
                      <span>👑</span> 썬 클럽 회원 등급 & 권한 관리
                    </h3>
                    <span className="text-[11px] text-slate-400">총 {users.length}명 회원</span>
                  </div>
                  <div className="space-y-2.5">
                    {users.map((u) => (
                      <div key={u.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-bold text-white">{u.name} <span className="text-[10px] text-slate-400">({u.gender})</span></div>
                          <span className="text-[10px] text-amber-400 font-bold">{u.role === 'admin' ? '👑 운영자' : '일반회원'}</span>
                        </div>
                        <div className="flex gap-1.5 items-center">
                          <select
                            value={u.grade}
                            onChange={(e) => handleUserGradeChange(u.id, e.target.value)}
                            className="bg-slate-900 border border-slate-700 text-amber-300 text-[11px] font-bold rounded-lg px-2 py-1 focus:outline-none"
                          >
                            {GRADE_OPTIONS.map((g) => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </main>

          {/* 하단 고정 네비게이션 바텀 탭바 */}
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
          </nav>
        </div>

      </div>

      {/* 실시간 스코어 수정 모달 다이얼로그 */}
      {selectedCourt && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-sm p-5 shadow-2xl text-white space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-amber-400 flex items-center gap-1.5">
                <span>🎾</span> 코트 {selectedCourt.courtNumber}번 스코어 입력
              </h3>
              <button
                onClick={() => setSelectedCourt(null)}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center space-y-2">
                <span className="text-xs font-bold text-emerald-400 block">Team A 게임 스코어</span>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setInputScoreA((prev) => Math.max(0, Number(prev) - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-base"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={inputScoreA}
                    onChange={(e) => setInputScoreA(e.target.value)}
                    className="w-14 text-center font-black text-2xl bg-transparent text-amber-300 focus:outline-none"
                  />
                  <button
                    onClick={() => setInputScoreA((prev) => Number(prev) + 1)}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-base"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center space-y-2">
                <span className="text-xs font-bold text-amber-400 block">Team B 게임 스코어</span>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setInputScoreB((prev) => Math.max(0, Number(prev) - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-base"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={inputScoreB}
                    onChange={(e) => setInputScoreB(e.target.value)}
                    className="w-14 text-center font-black text-2xl bg-transparent text-amber-300 focus:outline-none"
                  />
                  <button
                    onClick={() => setInputScoreB((prev) => Number(prev) + 1)}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-base"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 block">경기 상태</label>
              <select
                value={inputStatus}
                onChange={(e) => setInputStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white focus:outline-none"
              >
                <option value="playing">🔴 경기 진행 중</option>
                <option value="completed">🏁 경기 완료 (전적 자동 집계)</option>
                <option value="waiting">⚪ 대기 중</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSelectedCourt(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
              >
                닫기
              </button>
              <button
                onClick={saveCourtScore}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-xs transition shadow-lg shadow-amber-500/20"
              >
                저장 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
