import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function TennisCourtBoard() {
  const [courts, setCourts] = useState([
    {
      id: 'court-1',
      court_number: 1,
      status: 'playing',
      team_a: ['김철수', '강동원'],
      team_b: ['박민수', '정지훈'],
      score_a: 5,
      score_b: 3,
    },
    {
      id: 'court-2',
      court_number: 2,
      status: 'playing',
      team_a: ['이영희', '한지민'],
      team_b: ['최수진', '김태희'],
      score_a: 2,
      score_b: 4,
    },
    {
      id: 'court-3',
      court_number: 3,
      status: 'waiting',
      team_a: ['송중기', '정우성'],
      team_b: ['조인성', '공유'],
      score_a: 0,
      score_b: 0,
    },
  ]);
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [inputScoreA, setInputScoreA] = useState(0);
  const [inputScoreB, setInputScoreB] = useState(0);

  useEffect(() => {
    fetchCourts();

    const channel = supabase
      .channel('public:matches')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
        },
        () => {
          fetchCourts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCourts = async () => {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .order('court_number', { ascending: true });

    if (!error && data && data.length > 0) {
      setCourts(data);
    }
  };

  const handleOpenModal = (court) => {
    setSelectedCourt(court);
    setInputScoreA(court.score_a ?? 0);
    setInputScoreB(court.score_b ?? 0);
  };

  const handleSaveScore = async () => {
    if (!selectedCourt) return;

    // 로컬 상태 즉시 반영 (반응성 극대화)
    setCourts(prev => prev.map(c => c.id === selectedCourt.id ? {
      ...c,
      score_a: Number(inputScoreA),
      score_b: Number(inputScoreB),
      status: 'playing',
    } : c));

    try {
      await supabase
        .from('matches')
        .update({
          score_a: Number(inputScoreA),
          score_b: Number(inputScoreB),
          status: 'playing',
        })
        .eq('id', selectedCourt.id);

      // 코트 배정/변경 푸시 알림 발송
      const playerIds = [
        selectedCourt.player_a1_id,
        selectedCourt.player_a2_id,
        selectedCourt.player_b1_id,
        selectedCourt.player_b2_id,
      ].filter(Boolean);

      if (playerIds.length > 0) {
        fetch('/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userIds: playerIds,
            title: `🎾 [썬 클럽 코트 ${selectedCourt.court_number}번] 스코어 업데이트`,
            body: `현재 스코어 (${inputScoreA} : ${inputScoreB}) - 경기 진행 중입니다!`,
            url: '/',
          }),
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('DB 업데이트 알림:', e);
    }

    setSelectedCourt(null);
  };

  return (
    <div className="space-y-4">
      {/* 라이브 상태 인디케이터 배너 */}
      <div className="flex justify-between items-center bg-gradient-to-r from-emerald-950/80 via-slate-900 to-amber-950/60 p-3 rounded-2xl border border-emerald-500/20 shadow-md">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <h2 className="text-sm font-extrabold text-white">썬 클럽 코트 실시간 스코어</h2>
        </div>
        <span className="text-[11px] font-bold text-amber-300 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
          ☀️ Real-time LIVE
        </span>
      </div>

      {/* 코트 카드 리스트 (테니스 코트 질감 디자인) */}
      <div className="space-y-3.5">
        {courts.map((court, idx) => {
          const isPlaying = court.status === 'playing';
          const teamANames = Array.isArray(court.team_a) ? court.team_a.join(', ') : (court.team_a || '팀 A');
          const teamBNames = Array.isArray(court.team_b) ? court.team_b.join(', ') : (court.team_b || '팀 B');

          return (
            <div
              key={court.id || idx}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-750 p-4 shadow-xl hover:border-amber-500/30 transition-all duration-300 group"
            >
              {/* 테니스 코트 라인 배경 디테일 */}
              <div className="absolute inset-0 pointer-events-none opacity-5">
                <div className="w-full h-full border-2 border-white m-1 rounded-xl" />
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white" />
              </div>

              {/* 상단 코트 번호 & 상태 */}
              <div className="flex justify-between items-center mb-3 relative z-10">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-md">
                    {court.court_number}
                  </span>
                  <span className="font-extrabold text-sm text-white tracking-wide">
                    {court.court_number}번 코트
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                    (클럽 공식 코트)
                  </span>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-wider border shadow-xs ${
                    isPlaying
                      ? 'bg-red-950/80 text-red-300 border-red-500/40 animate-pulse'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {isPlaying ? '🔴 경기 진행 중' : '⚪ 다음 경기 대기'}
                </span>
              </div>

              {/* 스코어보드 대형 매치업 카드 (호주오픈 블루 & 네온 볼트 테마) */}
              <div className="relative z-10 grid grid-cols-7 gap-2 items-center bg-gradient-to-r from-slate-950/90 via-slate-900 to-slate-950/90 p-3.5 rounded-xl border border-slate-800/80 mb-3 shadow-inner">
                {/* Team A */}
                <div className="col-span-3 text-center">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-400 block mb-0.5">
                    TEAM SUN
                  </span>
                  <p className="text-sm font-bold text-white truncate" title={teamANames}>
                    {teamANames}
                  </p>
                </div>

                {/* Score (형광 볼트 테니스 볼 스타일 LED 점수) */}
                <div className="col-span-1 flex flex-col items-center justify-center">
                  <div className="px-2 py-1 rounded-lg bg-slate-950 border border-amber-500/30 shadow-md">
                    <span className="text-xl font-black tracking-tight text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
                      {court.score_a ?? 0} : {court.score_b ?? 0}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-500 font-bold mt-0.5">GAME</span>
                </div>

                {/* Team B */}
                <div className="col-span-3 text-center">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-400 block mb-0.5">
                    TEAM ACE
                  </span>
                  <p className="text-sm font-bold text-white truncate" title={teamBNames}>
                    {teamBNames}
                  </p>
                </div>
              </div>

              {/* 스코어 입력 / 수정 버튼 */}
              <button
                onClick={() => handleOpenModal(court)}
                className="relative z-10 w-full py-2.5 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>⚡</span>
                <span>실시간 스코어 입력 / 결과 저장</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* 스코어 입력 모달 */}
      {selectedCourt && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-sm p-5 shadow-2xl text-white space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-amber-400 flex items-center gap-1.5">
                <span>🎾</span> 코트 {selectedCourt.court_number}번 스코어 입력
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
                    onClick={() => setInputScoreA(Math.max(0, Number(inputScoreA) - 1))}
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
                    onClick={() => setInputScoreA(Number(inputScoreA) + 1)}
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
                    onClick={() => setInputScoreB(Math.max(0, Number(inputScoreB) - 1))}
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
                    onClick={() => setInputScoreB(Number(inputScoreB) + 1)}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-base"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSelectedCourt(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
              >
                닫기
              </button>
              <button
                onClick={handleSaveScore}
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
