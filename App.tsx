'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function TennisApp() {
  // 메인 네비게이션 탭: 'courts' | 'kdk' | 'tournament' | 'mypage' | 'admin'
  const [activeTab, setActiveTab] = useState<'courts' | 'kdk' | 'tournament' | 'mypage' | 'admin'>('courts');
  const [role, setRole] = useState<'member' | 'admin'>('member');

  // 토너먼트 2단계 서브탭: 'qualifying' (예선 조별리그) | 'main' (본선 토너먼트)
  const [tourPhase, setTourPhase] = useState<'qualifying' | 'main'>('qualifying');

  // ----------------------------------------------------
  // 1. KDK 관련 상태 및 데이터
  // ----------------------------------------------------
  const [participantsInput, setParticipantsInput] = useState<string>(
    '김철수, 강동원, 박민수, 정지훈, 이영희, 한지민, 최수진, 송중기'
  );

  // KDK 기본 3라운드 매치 데이터
  const [kdkRounds, setKdkRounds] = useState([
    {
      round: 1,
      name: '제 1 라운드 (오프닝 로테이션)',
      matches: [
        { id: 'k1-1', court: 1, teamA: ['김철수 (금배)', '강동원 (금배)'], teamB: ['박민수 (은배)', '정지훈 (동배)'], scoreA: 6, scoreB: 3, completed: true },
        { id: 'k1-2', court: 2, teamA: ['이영희 (국화)', '한지민 (은배)'], teamB: ['최수진 (개나리)', '송중기 (동배)'], scoreA: 4, scoreB: 6, completed: true },
      ],
    },
    {
      round: 2,
      name: '제 2 라운드 (크로스 파트너 순환)',
      matches: [
        { id: 'k2-1', court: 1, teamA: ['김철수 (금배)', '정지훈 (동배)'], teamB: ['강동원 (금배)', '박민수 (은배)'], scoreA: 5, scoreB: 6, completed: true },
        { id: 'k2-2', court: 2, teamA: ['이영희 (국화)', '최수진 (개나리)'], teamB: ['한지민 (은배)', '송중기 (동배)'], scoreA: 6, scoreB: 2, completed: true },
      ],
    },
    {
      round: 3,
      name: '제 3 라운드 (승부 라운드)',
      matches: [
        { id: 'k3-1', court: 1, teamA: ['김철수 (금배)', '박민수 (은배)'], teamB: ['강동원 (금배)', '정지훈 (동배)'], scoreA: 6, scoreB: 4, completed: false },
        { id: 'k3-2', court: 2, teamA: ['이영희 (국화)', '송중기 (동배)'], teamB: ['한지민 (은배)', '최수진 (개나리)'], scoreA: 3, scoreB: 5, completed: false },
      ],
    },
  ]);

  // KDK 실시간 개인 순위표 데이터
  const [kdkStandings, setKdkStandings] = useState([
    { rank: 1, name: '강동원', grade: '금배', matches: 2, wins: 2, losses: 0, ptsDiff: '+4', totalPts: 12 },
    { rank: 2, name: '김철수', grade: '금배', matches: 2, wins: 1, losses: 1, ptsDiff: '+2', totalPts: 11 },
    { rank: 3, name: '이영희', grade: '국화', matches: 2, wins: 1, losses: 1, ptsDiff: '+2', totalPts: 10 },
    { rank: 4, name: '송중기', grade: '동배', matches: 2, wins: 1, losses: 1, ptsDiff: '-2', totalPts: 8 },
    { rank: 5, name: '박민수', grade: '은배', matches: 2, wins: 1, losses: 1, ptsDiff: '-2', totalPts: 9 },
    { rank: 6, name: '정지훈', grade: '동배', matches: 2, wins: 0, losses: 2, ptsDiff: '-4', totalPts: 8 },
    { rank: 7, name: '한지민', grade: '은배', matches: 2, wins: 0, losses: 2, ptsDiff: '-6', totalPts: 6 },
    { rank: 8, name: '최수진', grade: '개나리', matches: 2, wins: 0, losses: 2, ptsDiff: '-2', totalPts: 8 },
  ]);

  // KDK 스코어 조절
  const updateKdkMatchScore = (roundIdx: number, matchIdx: number, deltaA: number, deltaB: number) => {
    setKdkRounds((prev) => {
      const next = [...prev];
      const match = { ...next[roundIdx].matches[matchIdx] };
      match.scoreA = Math.max(0, match.scoreA + deltaA);
      match.scoreB = Math.max(0, match.scoreB + deltaB);
      next[roundIdx].matches[matchIdx] = match;
      return next;
    });
  };

  // KDK 경기 완료 토글
  const toggleKdkMatchComplete = (roundIdx: number, matchIdx: number) => {
    setKdkRounds((prev) => {
      const next = [...prev];
      const match = { ...next[roundIdx].matches[matchIdx] };
      match.completed = !match.completed;
      next[roundIdx].matches[matchIdx] = match;
      return next;
    });
  };

  // KDK 대진표 자동 편성 생성기
  const handleGenerateKdk = () => {
    const names = participantsInput
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length < 4) {
      alert('KDK 편성을 위해서는 최소 4명 이상의 참가자가 필요합니다.');
      return;
    }

    const generated = [];
    for (let r = 1; r <= 3; r++) {
      const shuffled = [...names].sort(() => Math.random() - 0.5);
      const matches = [];
      for (let i = 0; i < shuffled.length; i += 4) {
        if (i + 3 < shuffled.length) {
          matches.push({
            id: `gen-r${r}-m${matches.length + 1}`,
            court: matches.length + 1,
            teamA: [shuffled[i], shuffled[i + 1]],
            teamB: [shuffled[i + 2], shuffled[i + 3]],
            scoreA: 0,
            scoreB: 0,
            completed: false,
          });
        }
      }
      generated.push({
        round: r,
        name: `제 ${r} 라운드 (자동 매칭)`,
        matches,
      });
    }

    setKdkRounds(generated);
    alert(`🎉 ${names.length}명의 참가자로 총 3개 라운드 KDK 순환 대진표가 새로 편성되었습니다!`);
  };

  // ----------------------------------------------------
  // 2. 예선 조별리그 & 본선 토너먼트 상태 및 데이터
  // ----------------------------------------------------
  // 예선 A조 & B조 순위표
  const [groupAStandings, setGroupAStandings] = useState([
    { rank: 1, team: '김철수 / 강동원', played: 2, wins: 2, losses: 0, diff: '+7', pts: 6, qualified: true },
    { rank: 2, team: '이영희 / 한지민', played: 2, wins: 1, losses: 1, diff: '+1', pts: 3, qualified: true },
    { rank: 3, team: '정지훈 / 조인성', played: 2, wins: 0, losses: 2, diff: '-8', pts: 0, qualified: false },
  ]);

  const [groupBStandings, setGroupBStandings] = useState([
    { rank: 1, team: '박민수 / 송중기', played: 2, wins: 2, losses: 0, diff: '+6', pts: 6, qualified: true },
    { rank: 2, team: '최수진 / 김태희', played: 2, wins: 1, losses: 1, diff: '+2', pts: 3, qualified: true },
    { rank: 3, team: '공유 / 정우성', played: 2, wins: 0, losses: 2, diff: '-8', pts: 0, qualified: false },
  ]);

  // 예선 조별 실시간 매치 목록
  const [groupMatches, setGroupMatches] = useState([
    { id: 'ga-1', group: 'A조', matchNum: 1, court: 1, teamA: '김철수 / 강동원', teamB: '이영희 / 한지민', scoreA: 6, scoreB: 3, status: '종료' },
    { id: 'ga-2', group: 'A조', matchNum: 2, court: 2, teamA: '이영희 / 한지민', teamB: '정지훈 / 조인성', scoreA: 6, scoreB: 2, status: '종료' },
    { id: 'ga-3', group: 'A조', matchNum: 3, court: 1, teamA: '김철수 / 강동원', teamB: '정지훈 / 조인성', scoreA: 6, scoreB: 2, status: '종료' },
    { id: 'gb-1', group: 'B조', matchNum: 1, court: 3, teamA: '박민수 / 송중기', teamB: '최수진 / 김태희', scoreA: 6, scoreB: 4, status: '종료' },
    { id: 'gb-2', group: 'B조', matchNum: 2, court: 1, teamA: '최수진 / 김태희', teamB: '공유 / 정우성', scoreA: 6, scoreB: 2, status: '종료' },
    { id: 'gb-3', group: 'B조', matchNum: 3, court: 2, teamA: '박민수 / 송중기', teamB: '공유 / 정우성', scoreA: 6, scoreB: 2, status: '종료' },
  ]);

  // 본선 4강 및 결승전 매치 데이터
  const [semiFinal1, setSemiFinal1] = useState({
    name: '4강 제 1경기',
    teamA: '김철수 / 강동원 (A조 1위)',
    teamB: '최수진 / 김태희 (B조 2위)',
    scoreA: 6,
    scoreB: 3,
    winner: '김철수 / 강동원',
    court: 1,
  });

  const [semiFinal2, setSemiFinal2] = useState({
    name: '4강 제 2경기',
    teamA: '박민수 / 송중기 (B조 1위)',
    teamB: '이영희 / 한지민 (A조 2위)',
    scoreA: 4,
    scoreB: 6,
    winner: '이영희 / 한지민',
    court: 2,
  });

  const [finalMatch, setFinalMatch] = useState({
    name: '🏆 결승전 (FINAL)',
    teamA: '김철수 / 강동원',
    teamB: '이영희 / 한지민',
    scoreA: 6,
    scoreB: 5,
    winner: '',
    court: 1,
  });

  const [thirdPlaceMatch, setThirdPlaceMatch] = useState({
    name: '🥉 3·4위 결정전',
    teamA: '최수진 / 김태희',
    teamB: '박민수 / 송중기',
    scoreA: 6,
    scoreB: 4,
    winner: '최수진 / 김태희',
    court: 3,
  });

  const [champion, setChampion] = useState<string>('');

  // 예선 결과로 본선 진출팀 자동 확정
  const handleAdvanceToMain = () => {
    setSemiFinal1((prev) => ({
      ...prev,
      teamA: `${groupAStandings[0].team} (A조 1위)`,
      teamB: `${groupBStandings[1].team} (B조 2위)`,
    }));
    setSemiFinal2((prev) => ({
      ...prev,
      teamA: `${groupBStandings[0].team} (B조 1위)`,
      teamB: `${groupAStandings[1].team} (A조 2위)`,
    }));
    setTourPhase('main');
    alert('🏆 예선 조별 1, 2위가 확정되어 본선 4강 토너먼트 브래킷에 자동 배치되었습니다!');
  };

  // 결승전 우승팀 확정
  const handleDeclareChampion = (teamName: string) => {
    setChampion(teamName);
    setFinalMatch((prev) => ({ ...prev, winner: teamName }));
    alert(`🎉 축하합니다! [${teamName}] 조가 썬 테니스 클럽 공식 챔피언에 등극했습니다! 🏆`);
  };

  // ----------------------------------------------------
  // 3. 실시간 코트 현황 데이터
  // ----------------------------------------------------
  const [courts, setCourts] = useState([
    {
      id: 1,
      courtNumber: 1,
      status: 'playing',
      teamA: ['김철수 (금배)', '강동원 (금배)'],
      teamB: ['이영희 (국화)', '한지민 (은배)'],
      scoreA: 5,
      scoreB: 5,
    },
    {
      id: 2,
      courtNumber: 2,
      status: 'playing',
      teamA: ['박민수 (은배)', '송중기 (동배)'],
      teamB: ['최수진 (개나리)', '김태희 (테린이)'],
      scoreA: 6,
      scoreB: 4,
    },
    {
      id: 3,
      courtNumber: 3,
      status: 'waiting',
      teamA: ['정지훈 (동배)', '조인성 (은배)'],
      teamB: ['공유 (금배)', '정우성 (은배)'],
      scoreA: 0,
      scoreB: 0,
    },
  ]);

  // 회원 목록 데이터
  const [users, setUsers] = useState([
    { id: '1', name: '김철수', gender: 'M', grade: '금배', role: 'member', status: 'playing' },
    { id: '2', name: '강동원', gender: 'M', grade: '금배', role: 'member', status: 'playing' },
    { id: '3', name: '박민수', gender: 'M', grade: '은배', role: 'member', status: 'playing' },
    { id: '4', name: '정지훈', gender: 'M', grade: '동배', role: 'member', status: 'waiting' },
    { id: '5', name: '이영희', gender: 'F', grade: '국화', role: 'member', status: 'playing' },
    { id: '6', name: '한지민', gender: 'F', grade: '은배', role: 'member', status: 'playing' },
    { id: '7', name: '최수진', gender: 'F', grade: '개나리', role: 'member', status: 'playing' },
    { id: '8', name: '송중기', gender: 'M', grade: '동배', role: 'member', status: 'playing' },
    { id: '9', name: '조인성', gender: 'M', grade: '은배', role: 'member', status: 'waiting' },
    { id: '10', name: '공유', gender: 'M', grade: '금배', role: 'admin', status: 'waiting' },
  ]);

  // 스코어 수정 모달 상태
  const [selectedCourt, setSelectedCourt] = useState<any>(null);
  const [inputScoreA, setInputScoreA] = useState<number>(0);
  const [inputScoreB, setInputScoreB] = useState<number>(0);
  const [inputStatus, setInputStatus] = useState<string>('playing');

  const openScoreModal = (court: any) => {
    setSelectedCourt(court);
    setInputScoreA(court.scoreA);
    setInputScoreB(court.scoreB);
    setInputStatus(court.status);
  };

  const saveCourtScore = () => {
    if (!selectedCourt) return;
    setCourts((prev) =>
      prev.map((c) =>
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

  const setQuickNames = (count: number) => {
    if (count === 8) {
      setParticipantsInput('김철수, 강동원, 박민수, 정지훈, 이영희, 한지민, 최수진, 송중기');
    } else {
      setParticipantsInput('김철수, 강동원, 박민수, 정지훈, 이영희, 한지민, 최수진, 송중기, 조인성, 공유, 김태희, 정우성');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-900">
      <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row justify-center items-start lg:gap-8 lg:p-6 min-h-screen">
        
        {/* ======================================================== */}
        {/* [PC 전용 좌측 사이드바: 썬 클럽 브랜드 & 메뉴 대시보드] */}
        {/* ======================================================== */}
        <aside className="hidden lg:flex flex-col w-[380px] shrink-0 sticky top-6 space-y-4">
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-amber-500/20 group">
            <img
              src="/sun-tennis-hero.jpg"
              alt="썬 테니스 클럽"
              className="w-full h-56 object-cover object-center group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent flex flex-col justify-end p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 uppercase tracking-wider shadow-sm">
                  Official Club
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  실시간 운영 중
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2 drop-shadow-md">
                <span className="text-amber-400">☀️</span> 썬 테니스 클럽
              </h1>
              <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                태양처럼 뜨거운 열정! KDK 파트너 순환 리그와 정규 예선/본선 토너먼트를 스마트하게 운영합니다.
              </p>
            </div>
          </div>

          {/* PC 퀵 네비게이션 카드 */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">시스템 메뉴 바로가기</p>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                onClick={() => setActiveTab('courts')}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left ${
                  activeTab === 'courts'
                    ? 'bg-amber-400/10 text-amber-300 border border-amber-400/30 shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="text-base">🎾</span>
                <div className="flex-1">
                  <p className="leading-tight">실시간 코트 현황</p>
                  <p className="text-[10px] text-slate-500 font-normal">1~3번 코트 라이브 스코어</p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('kdk')}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left ${
                  activeTab === 'kdk'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="text-base">🔄</span>
                <div className="flex-1">
                  <p className="leading-tight">KDK 파트너 순환 진행</p>
                  <p className="text-[10px] text-slate-500 font-normal">개인 승점제 월례회 대진표</p>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md font-extrabold">인기</span>
              </button>

              <button
                onClick={() => setActiveTab('tournament')}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left ${
                  activeTab === 'tournament'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30 shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="text-base">🏆</span>
                <div className="flex-1">
                  <p className="leading-tight">예선 & 본선 토너먼트</p>
                  <p className="text-[10px] text-slate-500 font-normal">조별 풀리그 & 4강/결승 브래킷</p>
                </div>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-md font-extrabold">대회용</span>
              </button>

              <button
                onClick={() => setActiveTab('mypage')}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left ${
                  activeTab === 'mypage'
                    ? 'bg-amber-400/10 text-amber-300 border border-amber-400/30 shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="text-base">👤</span>
                <div className="flex-1">
                  <p className="leading-tight">VIP 마이페이지</p>
                  <p className="text-[10px] text-slate-500 font-normal">개인 전적 & 승률 랭킹</p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left ${
                  activeTab === 'admin'
                    ? 'bg-red-400/10 text-red-300 border border-red-400/30 shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="text-base">⚙️</span>
                <div className="flex-1">
                  <p className="leading-tight">운영자 관리 센터</p>
                  <p className="text-[10px] text-slate-500 font-normal">회원 등급 및 권한 설정</p>
                </div>
              </button>
            </div>
          </div>

          {/* 실시간 코트 가동 상태 위젯 */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                현재 코트 가동률
              </span>
              <span className="text-xs font-black text-amber-400">66.7% (2/3 코트)</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
              <div className="bg-gradient-to-r from-emerald-500 to-amber-500 h-2 rounded-full" style={{ width: '66.7%' }} />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                <p className="text-[10px] text-slate-400">1코트</p>
                <p className="text-xs font-black text-emerald-400">경기 중</p>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                <p className="text-[10px] text-slate-400">2코트</p>
                <p className="text-xs font-black text-emerald-400">경기 중</p>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                <p className="text-[10px] text-slate-400">3코트</p>
                <p className="text-xs font-black text-slate-400">대기 중</p>
              </div>
            </div>
          </div>
        </aside>

        {/* ======================================================== */}
        {/* [모바일 프레임 / 메인 모바일 네이티브 레이아웃] */}
        {/* ======================================================== */}
        <main className="w-full max-w-md bg-slate-950 min-h-screen lg:min-h-[900px] lg:rounded-[42px] lg:border-[8px] lg:border-slate-800/80 shadow-2xl overflow-hidden flex flex-col relative pb-24">
          
          {/* 상단 썬 클럽 모바일 헤더 */}
          <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-lg">
                ☀️
              </div>
              <div>
                <h2 className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
                  썬 테니스 클럽
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    SUN
                  </span>
                </h2>
                <p className="text-[10px] text-slate-400 font-medium">태양처럼 뜨거운 코트의 열정</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setRole((r) => (r === 'member' ? 'admin' : 'member'))}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold border transition-all ${
                  role === 'admin'
                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}
              >
                {role === 'admin' ? '👑 운영자 모드' : '👤 회원 모드'}
              </button>
            </div>
          </header>

          {/* 메인 탭 컨텐츠 영역 */}
          <div className="p-4 space-y-4 flex-1">
            
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
                    <span className="text-xs font-bold text-white">실시간 코트 가동 중</span>
                  </div>
                  <span className="text-[11px] text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/30 font-extrabold">
                    총 3개 코트
                  </span>
                </div>

                {/* 대진 모드 빠른 스위치 버튼 2개 */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setActiveTab('kdk')}
                    className="p-3 bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30 hover:border-emerald-400 rounded-2xl text-left transition group shadow-md"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base">🔄</span>
                      <span className="text-[10px] font-black bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded-md">바로가기</span>
                    </div>
                    <p className="text-xs font-black text-white group-hover:text-emerald-300">KDK 파트너 순환 진행</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">매 라운드 파트너 자동 변경</p>
                  </button>

                  <button
                    onClick={() => setActiveTab('tournament')}
                    className="p-3 bg-gradient-to-br from-amber-950/60 to-slate-900 border border-amber-500/30 hover:border-amber-400 rounded-2xl text-left transition group shadow-md"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base">🏆</span>
                      <span className="text-[10px] font-black bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-md">바로가기</span>
                    </div>
                    <p className="text-xs font-black text-white group-hover:text-amber-300">예선 & 본선 토너먼트</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">조별리그 & 결승 브래킷</p>
                  </button>
                </div>

                {/* 코트 카드 리스트 */}
                {courts.map((court) => (
                  <div
                    key={court.id}
                    className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3 relative overflow-hidden transition-all hover:border-slate-700"
                  >
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-amber-400 text-slate-950">
                          {court.courtNumber}번 코트
                        </span>
                        <span
                          className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                            court.status === 'playing'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {court.status === 'playing' ? '🔴 LIVE 경기 중' : '⚪ 대기 중'}
                        </span>
                      </div>
                      <button
                        onClick={() => openScoreModal(court)}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold border border-slate-700 transition"
                      >
                        점수 수정 ✎
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 items-center">
                      {/* 팀 A */}
                      <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-amber-400">TEAM A</span>
                          <span className="text-xl font-black text-white">{court.scoreA}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-200">
                          {court.teamA.map((m, idx) => (
                            <p key={idx} className="truncate">{m}</p>
                          ))}
                        </div>
                      </div>

                      {/* 팀 B */}
                      <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-emerald-400">TEAM B</span>
                          <span className="text-xl font-black text-white">{court.scoreB}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-200">
                          {court.teamB.map((m, idx) => (
                            <p key={idx} className="truncate">{m}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* [탭 2]: KDK 파트너 순환 진행 전용 화면 */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'kdk' && (
              <div className="space-y-4">
                {/* 헤더 & 대회 토너먼트 전환 버튼 */}
                <div className="flex justify-between items-center bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 p-3 rounded-2xl border border-emerald-500/30 shadow-md">
                  <div>
                    <h3 className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                      <span>🔄</span> KDK 파트너 순환 리그
                    </h3>
                    <p className="text-[10px] text-slate-400">월례회 전용! 매 라운드 파트너 교체 및 개인 승점제</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('tournament')}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-[11px] font-black transition flex items-center gap-1 shadow-xs"
                  >
                    <span>🏆</span>
                    <span>예선/본선 토너먼트로</span>
                  </button>
                </div>

                {/* 참가자 명단 입력 폼 */}
                <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-xs text-white flex items-center gap-1.5">
                      <span className="text-amber-400">🎾</span> KDK 참가자 명단 (쉼표 구분)
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setQuickNames(8)}
                        className="text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700"
                      >
                        8명 추천
                      </button>
                      <button
                        onClick={() => setQuickNames(12)}
                        className="text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700"
                      >
                        12명 추천
                      </button>
                    </div>
                  </div>

                  <textarea
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono leading-relaxed"
                    rows={2}
                    value={participantsInput}
                    onChange={(e) => setParticipantsInput(e.target.value)}
                  />

                  <button
                    onClick={handleGenerateKdk}
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>🏓</span>
                    <span>KDK 대진표 자동 편성 & 랭킹 초기화</span>
                  </button>
                </div>

                {/* KDK 실시간 개인 순위표 (TOP 8) */}
                <div className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-2.5">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <span>🥇</span> KDK 실시간 개인 순위표
                    </span>
                    <span className="text-[10px] text-slate-400">승수 &gt; 득실차 &gt; 승점 순</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-center text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800/80 text-[10px]">
                          <th className="py-1">순위</th>
                          <th className="py-1 text-left px-2">선수(등급)</th>
                          <th className="py-1">경기</th>
                          <th className="py-1">승-패</th>
                          <th className="py-1">득실</th>
                          <th className="py-1 font-bold text-amber-400">승점</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {kdkStandings.map((s) => (
                          <tr key={s.name} className={s.rank <= 3 ? 'bg-amber-400/5 font-bold' : ''}>
                            <td className="py-2">
                              {s.rank === 1 ? '🥇 1' : s.rank === 2 ? '🥈 2' : s.rank === 3 ? '🥉 3' : s.rank}
                            </td>
                            <td className="py-2 text-left px-2 text-white">
                              {s.name} <span className="text-[10px] text-slate-400 font-normal">({s.grade})</span>
                            </td>
                            <td className="py-2 text-slate-300">{s.matches}</td>
                            <td className="py-2 text-emerald-400">{s.wins}승 {s.losses}패</td>
                            <td className="py-2 text-slate-300">{s.ptsDiff}</td>
                            <td className="py-2 font-black text-amber-400">{s.totalPts}점</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* KDK 라운드별 매칭 카드 및 스코어 조절 */}
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-300 px-1 flex items-center gap-1">
                    <span>🎾</span> KDK 라운드별 경기 진행 & 스코어 입력
                  </h4>

                  {kdkRounds.map((r, rIdx) => (
                    <div key={r.round} className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-2.5">
                      <div className="text-xs font-black text-emerald-400 border-b border-slate-800 pb-1.5 flex justify-between items-center">
                        <span>{r.name}</span>
                        <span className="text-[10px] text-slate-400">{r.matches.length}개 코트 가동</span>
                      </div>

                      <div className="space-y-2">
                        {r.matches.map((m, mIdx) => (
                          <div key={m.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-extrabold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20 text-[10px]">
                                코트 {m.court}
                              </span>
                              <button
                                onClick={() => toggleKdkMatchComplete(rIdx, mIdx)}
                                className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition ${
                                  m.completed
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {m.completed ? '✓ 경기완료' : '진행 중'}
                              </button>
                            </div>

                            <div className="flex justify-between items-center text-xs">
                              <div className="text-left font-bold text-white flex-1 truncate">
                                {m.teamA.join(' / ')}
                              </div>

                              <div className="flex items-center gap-1.5 mx-2 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => updateKdkMatchScore(rIdx, mIdx, -1, 0)}
                                    className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                                  >
                                    -
                                  </button>
                                  <span className="text-sm font-black text-white w-4 text-center">{m.scoreA}</span>
                                  <button
                                    onClick={() => updateKdkMatchScore(rIdx, mIdx, 1, 0)}
                                    className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                                <span className="font-black text-slate-500 text-[10px]">:</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => updateKdkMatchScore(rIdx, mIdx, 0, -1)}
                                    className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                                  >
                                    -
                                  </button>
                                  <span className="text-sm font-black text-white w-4 text-center">{m.scoreB}</span>
                                  <button
                                    onClick={() => updateKdkMatchScore(rIdx, mIdx, 0, 1)}
                                    className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              <div className="text-right font-bold text-white flex-1 truncate">
                                {m.teamB.join(' / ')}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* [탭 3]: 예선전 & 본선 토너먼트 진행 전용 화면 */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'tournament' && (
              <div className="space-y-4">
                {/* 상단 헤더 & KDK 전환 버튼 */}
                <div className="flex justify-between items-center bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 p-3 rounded-2xl border border-amber-500/30 shadow-md">
                  <div>
                    <h3 className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <span>🏆</span> 정규 대회 토너먼트 시스템
                    </h3>
                    <p className="text-[10px] text-slate-400">1단계 예선 조별리그 ➔ 2단계 본선 4강/결승 토너먼트</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('kdk')}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-black transition flex items-center gap-1 shadow-xs"
                  >
                    <span>🔄</span>
                    <span>KDK 진행으로</span>
                  </button>
                </div>

                {/* 예선전 / 본선 토너먼트 서브 탭 버튼 2개 */}
                <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold gap-1">
                  <button
                    onClick={() => setTourPhase('qualifying')}
                    className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
                      tourPhase === 'qualifying'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🥇</span>
                    <span>1단계: 예선 조별리그</span>
                  </button>

                  <button
                    onClick={() => setTourPhase('main')}
                    className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
                      tourPhase === 'main'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🏅</span>
                    <span>2단계: 본선 토너먼트 (4강/결승)</span>
                  </button>
                </div>

                {/* ---------------- 1단계: 예선 조별리그 화면 ---------------- */}
                {tourPhase === 'qualifying' && (
                  <div className="space-y-4">
                    {/* A조 & B조 순위표 */}
                    <div className="grid grid-cols-1 gap-3">
                      {/* A조 순위표 */}
                      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-2">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                          <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                            <span>🅰️</span> 예선 A조 순위표 (상위 2팀 본선 진출)
                          </span>
                          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30">
                            풀리그 진행
                          </span>
                        </div>
                        <table className="w-full text-center text-xs">
                          <thead>
                            <tr className="text-slate-400 text-[10px] border-b border-slate-800/80">
                              <th className="py-1">순위</th>
                              <th className="py-1 text-left px-2">팀명</th>
                              <th className="py-1">승-패</th>
                              <th className="py-1">득실</th>
                              <th className="py-1 font-bold text-amber-400">승점</th>
                              <th className="py-1">진출</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {groupAStandings.map((t) => (
                              <tr key={t.team} className={t.qualified ? 'bg-amber-400/5' : ''}>
                                <td className="py-2 font-bold">{t.rank}</td>
                                <td className="py-2 text-left px-2 font-bold text-white truncate max-w-[120px]">{t.team}</td>
                                <td className="py-2 text-emerald-400 font-bold">{t.wins}승 {t.losses}패</td>
                                <td className="py-2 text-slate-300">{t.diff}</td>
                                <td className="py-2 font-black text-amber-400">{t.pts}</td>
                                <td className="py-2">
                                  {t.qualified ? (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                                      본선진출
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-500">탈락</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* B조 순위표 */}
                      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-2">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                          <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                            <span>🅱️</span> 예선 B조 순위표 (상위 2팀 본선 진출)
                          </span>
                          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30">
                            풀리그 진행
                          </span>
                        </div>
                        <table className="w-full text-center text-xs">
                          <thead>
                            <tr className="text-slate-400 text-[10px] border-b border-slate-800/80">
                              <th className="py-1">순위</th>
                              <th className="py-1 text-left px-2">팀명</th>
                              <th className="py-1">승-패</th>
                              <th className="py-1">득실</th>
                              <th className="py-1 font-bold text-amber-400">승점</th>
                              <th className="py-1">진출</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {groupBStandings.map((t) => (
                              <tr key={t.team} className={t.qualified ? 'bg-emerald-400/5' : ''}>
                                <td className="py-2 font-bold">{t.rank}</td>
                                <td className="py-2 text-left px-2 font-bold text-white truncate max-w-[120px]">{t.team}</td>
                                <td className="py-2 text-emerald-400 font-bold">{t.wins}승 {t.losses}패</td>
                                <td className="py-2 text-slate-300">{t.diff}</td>
                                <td className="py-2 font-black text-amber-400">{t.pts}</td>
                                <td className="py-2">
                                  {t.qualified ? (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                                      본선진출
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-500">탈락</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 조별 풀리그 매치 결과 목록 */}
                    <div className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-2.5">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                        <span className="text-xs font-black text-white flex items-center gap-1">
                          <span>🎾</span> 조별 예선전 경기 상세 스코어
                        </span>
                        <span className="text-[10px] text-slate-400">총 6경기 완료</span>
                      </div>

                      <div className="space-y-2">
                        {groupMatches.map((m) => (
                          <div key={m.id} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                              {m.group} R{m.matchNum}
                            </span>
                            <span className="font-bold text-white truncate max-w-[90px]">{m.teamA}</span>
                            <span className="text-sm font-black text-amber-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                              {m.scoreA} : {m.scoreB}
                            </span>
                            <span className="font-bold text-white truncate max-w-[90px]">{m.teamB}</span>
                            <span className="text-[10px] font-bold text-emerald-400">{m.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 본선 토너먼트 진출 확정 액션 버튼 */}
                    <button
                      onClick={handleAdvanceToMain}
                      className="w-full py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-2xl text-xs transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span className="text-base">🚀</span>
                      <span>조별 1, 2위 본선 진출 확정 & 본선 토너먼트 브래킷 생성</span>
                    </button>
                  </div>
                )}

                {/* ---------------- 2단계: 본선 토너먼트 브래킷 화면 ---------------- */}
                {tourPhase === 'main' && (
                  <div className="space-y-4">
                    {/* 우승자 알림 배너 */}
                    {champion && (
                      <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 text-slate-950 p-4 rounded-3xl shadow-2xl text-center space-y-1 animate-bounce">
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-900/80">🏆 2026 SUN TENNIS TOURNAMENT CHAMPION</p>
                        <h3 className="text-xl font-black">{champion}</h3>
                        <p className="text-xs font-extrabold text-slate-900">영예의 썬 테니스 클럽 챔피언십 우승을 축하합니다!</p>
                      </div>
                    )}

                    {/* 토너먼트 브래킷 트리 (4강 -> 결승) */}
                    <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <div>
                          <span className="text-xs font-black text-amber-400 block">🏆 본선 녹아웃 브래킷 (Knockout Bracket)</span>
                          <span className="text-[10px] text-slate-400">4강 토너먼트 준결승 및 결승전</span>
                        </div>
                        <span className="text-[10px] font-bold bg-amber-400/10 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/20">
                          정규전 6게임 세트
                        </span>
                      </div>

                      {/* 4강 준결승 (Semi-Finals) */}
                      <div className="space-y-3">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">1. 준결승전 (Semi-Finals)</span>
                        
                        {/* 4강 1경기 */}
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                          <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                            <span>{semiFinal1.name} (코트 1)</span>
                            <span className="text-emerald-400">승자 결승 진출</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className={`font-bold truncate max-w-[140px] ${semiFinal1.winner === '김철수 / 강동원' ? 'text-amber-400' : 'text-white'}`}>
                              {semiFinal1.teamA}
                            </span>
                            <span className="text-sm font-black text-white px-2 py-0.5 bg-slate-900 rounded border border-slate-800">
                              {semiFinal1.scoreA} : {semiFinal1.scoreB}
                            </span>
                            <span className="font-bold text-slate-400 truncate max-w-[140px]">
                              {semiFinal1.teamB}
                            </span>
                          </div>
                        </div>

                        {/* 4강 2경기 */}
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                          <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                            <span>{semiFinal2.name} (코트 2)</span>
                            <span className="text-emerald-400">승자 결승 진출</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-400 truncate max-w-[140px]">
                              {semiFinal2.teamA}
                            </span>
                            <span className="text-sm font-black text-white px-2 py-0.5 bg-slate-900 rounded border border-slate-800">
                              {semiFinal2.scoreA} : {semiFinal2.scoreB}
                            </span>
                            <span className={`font-bold truncate max-w-[140px] ${semiFinal2.winner === '이영희 / 한지민' ? 'text-amber-400' : 'text-white'}`}>
                              {semiFinal2.teamB}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 대망의 결승전 (FINAL) 카드 */}
                      <div className="bg-gradient-to-br from-amber-950/80 via-slate-950 to-slate-950 p-4 rounded-2xl border-2 border-amber-500/50 shadow-2xl space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                            <span>👑</span> {finalMatch.name}
                          </span>
                          <span className="text-[10px] font-extrabold text-amber-400 bg-amber-400/20 px-2 py-0.5 rounded-full border border-amber-400/40 animate-pulse">
                            CHAMPIONSHIP
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                          <div className="text-center flex-1">
                            <p className="font-black text-white text-sm">{finalMatch.teamA}</p>
                            <span className="text-[10px] text-amber-400 font-bold">(A조 1위)</span>
                          </div>

                          <div className="flex flex-col items-center mx-2 bg-slate-900 p-2 rounded-2xl border border-amber-500/30">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xl font-black text-amber-400">{finalMatch.scoreA}</span>
                              <span className="font-black text-slate-500 text-xs">:</span>
                              <span className="text-xl font-black text-amber-400">{finalMatch.scoreB}</span>
                            </div>
                            <span className="text-[9px] text-slate-400 font-bold mt-0.5">매치포인트</span>
                          </div>

                          <div className="text-center flex-1">
                            <p className="font-black text-white text-sm">{finalMatch.teamB}</p>
                            <span className="text-[10px] text-amber-400 font-bold">(A조 2위)</span>
                          </div>
                        </div>

                        {/* 결승전 우승 결정 버튼 2개 */}
                        <div className="pt-2 border-t border-slate-800/80 flex gap-2">
                          <button
                            onClick={() => handleDeclareChampion(finalMatch.teamA)}
                            className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs transition shadow-md"
                          >
                            🥇 {finalMatch.teamA} 우승 확정
                          </button>
                          <button
                            onClick={() => handleDeclareChampion(finalMatch.teamB)}
                            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-black rounded-xl text-xs transition border border-amber-500/30"
                          >
                            🥇 {finalMatch.teamB} 우승 확정
                          </button>
                        </div>
                      </div>

                      {/* 3·4위 결정전 */}
                      <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                        <span className="text-[10px] font-bold text-slate-400">{thirdPlaceMatch.name}</span>
                        <span className="font-bold text-white truncate">{thirdPlaceMatch.teamA}</span>
                        <span className="text-xs font-black text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {thirdPlaceMatch.scoreA} : {thirdPlaceMatch.scoreB}
                        </span>
                        <span className="font-bold text-slate-400 truncate">{thirdPlaceMatch.teamB}</span>
                        <span className="text-[10px] font-bold text-amber-400">3위: {thirdPlaceMatch.winner}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* [탭 4]: VIP 마이페이지 */}
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
                        <div className="font-bold text-white">2026 본선 결승전 <span className="text-[10px] text-slate-400">코트 1번</span></div>
                        <p className="text-[11px] text-slate-400">파트너: 강동원 (금배) vs 이영희 / 한지민</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">6 : 5</span>
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">FINAL</span>
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-750 p-3 rounded-2xl shadow-md flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white">월례회 KDK 예선 R1 <span className="text-[10px] text-slate-400">코트 1번</span></div>
                        <p className="text-[11px] text-slate-400">파트너: 강동원 vs 박민수 / 정지훈</p>
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
            {/* [탭 5]: 운영자 관리 센터 */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'admin' && (
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h3 className="text-sm font-black text-red-400 flex items-center gap-1.5">
                      <span>👑</span> 썬 클럽 회원 등급 & 권한 관리
                    </h3>
                    <span className="text-[11px] text-slate-400">총 {users.length}명</span>
                  </div>

                  <div className="divide-y divide-slate-800/80">
                    {users.map((u) => (
                      <div key={u.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{u.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold ${
                            u.grade === '금배' ? 'badge-gold' :
                            u.grade === '은배' ? 'badge-silver' :
                            u.grade === '동배' ? 'badge-bronze' :
                            u.grade === '국화' ? 'badge-chrys' : 'badge-beginner'
                          }`}>
                            {u.grade}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">{u.role === 'admin' ? '운영진' : '정회원'}</span>
                          <button
                            onClick={() => alert(`${u.name} 회원의 등급/권한 변경 창을 엽니다.`)}
                            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] border border-slate-700"
                          >
                            수정
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* [하단 고정 네비게이션 바텀 탭바: 5개 분리 버튼] */}
          {/* ======================================================== */}
          <nav className="fixed lg:absolute bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-2 py-2 flex justify-around items-center z-50 shadow-2xl">
            {/* 버튼 1: 코트 현황 */}
            <button
              onClick={() => setActiveTab('courts')}
              className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
                activeTab === 'courts'
                  ? 'text-amber-400 font-bold scale-105 bg-amber-400/10'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <span className="text-base">🎾</span>
              <span className="text-[10px] mt-0.5">코트현황</span>
            </button>

            {/* 버튼 2: KDK 순환 진행 (요청사항 별도 버튼) */}
            <button
              onClick={() => setActiveTab('kdk')}
              className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
                activeTab === 'kdk'
                  ? 'text-emerald-400 font-bold scale-105 bg-emerald-400/10'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <span className="text-base">🔄</span>
              <span className="text-[10px] mt-0.5">KDK진행</span>
            </button>

            {/* 버튼 3: 예선·본선 토너먼트 (요청사항 별도 버튼) */}
            <button
              onClick={() => setActiveTab('tournament')}
              className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
                activeTab === 'tournament'
                  ? 'text-amber-400 font-bold scale-105 bg-amber-400/10'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <span className="text-base">🏆</span>
              <span className="text-[10px] mt-0.5">토너먼트</span>
            </button>

            {/* 버튼 4: 마이페이지 */}
            <button
              onClick={() => setActiveTab('mypage')}
              className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
                activeTab === 'mypage'
                  ? 'text-amber-400 font-bold scale-105 bg-amber-400/10'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <span className="text-base">👤</span>
              <span className="text-[10px] mt-0.5">마이페이지</span>
            </button>

            {/* 버튼 5: 운영자 */}
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
                activeTab === 'admin'
                  ? 'text-red-400 font-bold scale-105 bg-red-400/10'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <span className="text-base">⚙️</span>
              <span className="text-[10px] mt-0.5">운영관리</span>
            </button>
          </nav>
        </main>
      </div>

      {/* ======================================================== */}
      {/* [실시간 점수 및 코트 상태 수정 모달] */}
      {/* ======================================================== */}
      {selectedCourt && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-amber-400 flex items-center gap-1.5">
                <span>🎾</span> {selectedCourt.courtNumber}번 코트 스코어 실시간 조절
              </h3>
              <button
                onClick={() => setSelectedCourt(null)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center space-y-2">
                <span className="text-[11px] font-black text-amber-400 block">TEAM A</span>
                <span className="text-3xl font-black text-white block">{inputScoreA}</span>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => setInputScoreA((prev) => Math.max(0, Number(prev) - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-base"
                  >
                    -
                  </button>
                  <button
                    onClick={() => setInputScoreA((prev) => Number(prev) + 1)}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-base"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center space-y-2">
                <span className="text-[11px] font-black text-emerald-400 block">TEAM B</span>
                <span className="text-3xl font-black text-white block">{inputScoreB}</span>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => setInputScoreB((prev) => Math.max(0, Number(prev) - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-base"
                  >
                    -
                  </button>
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
