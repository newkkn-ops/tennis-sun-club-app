import { KdkCourtState } from './KdkCourtOperations';
import React, { useState, useMemo, useEffect } from 'react';
import {
  Player,
  CourtKdkGame,
  KdkStandingRow,
  calculateKdkStandingsWithAgeTiebreak,
  resolvePlayerAge,
} from '../lib/kdk';

interface KdkOverallScheduleBoardProps {
  tournamentName?: string;
  currentUserName?: string;
  isAdmin?: boolean;
  onNavigateToTab?: (tab: string) => void;
  onClose?: () => void;
}

export default function KdkOverallScheduleBoard({
  tournamentName,
  currentUserName,
  isAdmin = false,
  onNavigateToTab,
  onClose,
}: KdkOverallScheduleBoardProps) {
  const [kdkCourts, setKdkCourts] = useState<KdkCourtState[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'playing' | 'completed' | 'pending'>('all');
  const [filterCourt, setFilterCourt] = useState<number | 'all'>('all');
  const [onlyMyMatches, setOnlyMyMatches] = useState<boolean>(false);
  const [syncVersion, setSyncVersion] = useState<number>(0);

  // 로컬 스토리지 및 이벤트 동기화
  const loadKdkData = () => {
    try {
      const raw = localStorage.getItem('sun_tennis_kdk_courts_v3');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setKdkCourts(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load KDK courts in KdkOverallScheduleBoard:', e);
    }
  };

  useEffect(() => {
    loadKdkData();
    const handleSync = () => {
      loadKdkData();
      setSyncVersion((v) => v + 1);
    };
    window.addEventListener('sun-tennis-kdk-sync', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('sun-tennis-kdk-sync', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // 전체 코트 목록 & 모든 경기 통합 리스트 (gameNumber 순번 정렬)
  const allMatches = useMemo(() => {
    const list: (CourtKdkGame & { courtNumber: number; minGamesPerPlayer: number; isLive: boolean; isNext: boolean })[] = [];
    kdkCourts.forEach((court) => {
      const uncompleted = (court.games || []).filter((g) => !g.completed);
      const liveGameId = uncompleted[0]?.id;
      const nextGameId = uncompleted[1]?.id;

      (court.games || []).forEach((g) => {
        list.push({
          ...g,
          courtNumber: court.courtNumber,
          minGamesPerPlayer: court.minGamesPerPlayer || 3,
          isLive: !g.completed && g.id === liveGameId,
          isNext: !g.completed && g.id === nextGameId,
        });
      });
    });

    return list.sort((a, b) => {
      if (a.courtNumber !== b.courtNumber) return a.courtNumber - b.courtNumber;
      return (a.gameNumber || 0) - (b.gameNumber || 0);
    });
  }, [kdkCourts, syncVersion]);

  // 필터링된 경기 리스트
  const filteredMatches = useMemo(() => {
    return allMatches.filter((m) => {
      // 코트 필터
      if (filterCourt !== 'all' && m.courtNumber !== filterCourt) return false;

      // 상태 필터
      if (filterStatus === 'playing' && !m.isLive) return false;
      if (filterStatus === 'completed' && !m.completed) return false;
      if (filterStatus === 'pending' && (m.completed || m.isLive)) return false;

      // 내 경기만 보기 필터
      if (onlyMyMatches && currentUserName) {
        const cleanMyName = currentUserName.trim();
        const isInMatch = [...m.teamA, ...m.teamB].some((p) => (p?.name || '').includes(cleanMyName));
        if (!isInMatch) return false;
      }

      return true;
    });
  }, [allMatches, filterCourt, filterStatus, onlyMyMatches, currentUserName]);

  // 전체 선수 및 통합 개인별 순위표 계산 (5단계 순위 산정 기준 실시간 자동 정렬)
  const { overallStandings, playerRoundMap, maxRounds, totalPlayersCount } = useMemo(() => {
    const playerMap = new Map<string, Player>();
    const allGames: CourtKdkGame[] = [];
    let calculatedMaxRounds = 3;

    kdkCourts.forEach((c) => {
      if (c.minGamesPerPlayer && c.minGamesPerPlayer > calculatedMaxRounds) {
        calculatedMaxRounds = c.minGamesPerPlayer;
      }
      (c.players || []).forEach((p) => {
        if (p && p.id && !playerMap.has(p.id)) {
          playerMap.set(p.id, p);
        }
      });
      (c.games || []).forEach((g) => {
        allGames.push(g);
      });
    });

    const playersList = Array.from(playerMap.values());
    const standings = calculateKdkStandingsWithAgeTiebreak(playersList, allGames);

    // 개인별 라운드(경기)별 득점/실점/결과 매핑
    const roundMap: Record<
      string,
      {
        round: number;
        courtNumber: number;
        scoreFor: number;
        scoreAgainst: number;
        isWin: boolean;
        isDraw: boolean;
        partnerName: string;
        oppNames: string;
        completed: boolean;
      }[]
    > = {};

    playersList.forEach((p) => {
      roundMap[p.id] = [];
    });

    kdkCourts.forEach((court) => {
      (court.games || []).forEach((g) => {
        const isTeamA0 = g.teamA[0]?.id;
        const isTeamA1 = g.teamA[1]?.id;
        const isTeamB0 = g.teamB[0]?.id;
        const isTeamB1 = g.teamB[1]?.id;

        const recordGame = (pId: string, partner: string, opps: string, sf: number, sa: number) => {
          if (!roundMap[pId]) roundMap[pId] = [];
          roundMap[pId].push({
            round: g.gameNumber,
            courtNumber: court.courtNumber,
            scoreFor: sf,
            scoreAgainst: sa,
            isWin: g.completed && sf > sa,
            isDraw: g.completed && sf === sa,
            partnerName: partner,
            oppNames: opps,
            completed: g.completed,
          });
        };

        if (isTeamA0) recordGame(isTeamA0, g.teamA[1]?.name || '', `${g.teamB[0]?.name || ''}/${g.teamB[1]?.name || ''}`, g.scoreA, g.scoreB);
        if (isTeamA1) recordGame(isTeamA1, g.teamA[0]?.name || '', `${g.teamB[0]?.name || ''}/${g.teamB[1]?.name || ''}`, g.scoreA, g.scoreB);
        if (isTeamB0) recordGame(isTeamB0, g.teamB[1]?.name || '', `${g.teamA[0]?.name || ''}/${g.teamA[1]?.name || ''}`, g.scoreB, g.scoreA);
        if (isTeamB1) recordGame(isTeamB1, g.teamB[0]?.name || '', `${g.teamA[0]?.name || ''}/${g.teamA[1]?.name || ''}`, g.scoreB, g.scoreA);
      });
    });

    return {
      overallStandings: standings,
      playerRoundMap: roundMap,
      maxRounds: calculatedMaxRounds,
      totalPlayersCount: playersList.length,
    };
  }, [kdkCourts, syncVersion]);

  // 통계 요약
  const summaryStats = useMemo(() => {
    const total = allMatches.length;
    const completed = allMatches.filter((m) => m.completed).length;
    const playing = allMatches.filter((m) => m.isLive).length;
    const pending = total - completed - playing;
    return { total, completed, playing, pending };
  }, [allMatches]);

  return (
    <div className="space-y-4 text-slate-200">
      {/* ---------------------------------------------------- */}
      {/* 1. 상단 안내 헤더 & 관리자/회원 배지 */}
      {/* ---------------------------------------------------- */}
      <div className="bg-gradient-to-r from-emerald-950/90 via-slate-900 to-teal-950/80 border border-emerald-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-400 text-slate-950 shadow-sm flex items-center gap-1">
              <span>🎾</span> KDK_V2025
            </span>
            <h2 className="text-sm sm:text-base font-black text-emerald-300">
              전체 게임현황 · KDK 라운드 기록표
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                운영관리자 모드
              </span>
            ) : (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                회원 조회 전용 (읽기 전용)
              </span>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs border border-slate-700 cursor-pointer transition"
                title="닫기"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
          <div>
            <span className="font-extrabold text-amber-300">{tournamentName || '썬 테니스 KDK 대회'}</span>
            <span className="text-slate-400 ml-2">
              (참여 {totalPlayersCount}명 · 총 {summaryStats.total}경기 중 {summaryStats.completed}경기 완료)
            </span>
          </div>
          {isAdmin && onNavigateToTab && (
            <button
              type="button"
              onClick={() => {
                onNavigateToTab('courts');
                if (onClose) onClose();
              }}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-[11px] shadow-sm flex items-center gap-1 cursor-pointer transition"
            >
              <span>⚙️</span>
              <span>코트/경기 관리 화면 바로가기 ➔</span>
            </button>
          )}
        </div>

        {/* 경기 진행 현황 요약 미니 카드 */}
        <div className="grid grid-cols-4 gap-2 pt-1 text-center font-bold">
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2">
            <span className="text-[10px] text-slate-400 block">전체 경기</span>
            <span className="text-sm font-black text-white">{summaryStats.total}</span>
          </div>
          <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-2">
            <span className="text-[10px] text-emerald-400 block">진행중</span>
            <span className="text-sm font-black text-emerald-400">{summaryStats.playing}</span>
          </div>
          <div className="bg-slate-950/80 border border-slate-700 rounded-xl p-2">
            <span className="text-[10px] text-slate-300 block">완료</span>
            <span className="text-sm font-black text-slate-200">{summaryStats.completed}</span>
          </div>
          <div className="bg-slate-950/80 border border-amber-500/30 rounded-xl p-2">
            <span className="text-[10px] text-amber-400 block">대기(예정)</span>
            <span className="text-sm font-black text-amber-300">{summaryStats.pending}</span>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. 상단: 전체 게임현황 (KDK_V2025 대진 순서표) */}
      {/* ---------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black text-amber-400 flex items-center gap-1">
              <span>📅</span> KDK_V2025 전체 게임 대진 순서표
            </span>
            <span className="text-[10px] text-slate-400">
              ({filteredMatches.length}경기 표시됨)
            </span>
          </div>

          {/* 내 경기만 보기 토글 버튼 */}
          {currentUserName && (
            <button
              type="button"
              onClick={() => setOnlyMyMatches((prev) => !prev)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-black border transition flex items-center gap-1 cursor-pointer ${
                onlyMyMatches
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md ring-1 ring-amber-400/50'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              <span>🎾</span>
              <span>내 출전 경기만 보기 ({currentUserName})</span>
            </button>
          )}
        </div>

        {/* 필터 툴바 (상태 필터 + 코트 필터) */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* 상태 필터 */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-2 py-1 rounded-lg cursor-pointer transition ${
                filterStatus === 'all' ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              전체
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('playing')}
              className={`px-2 py-1 rounded-lg cursor-pointer transition ${
                filterStatus === 'playing' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              🔴 진행중
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('completed')}
              className={`px-2 py-1 rounded-lg cursor-pointer transition ${
                filterStatus === 'completed' ? 'bg-slate-700 text-white font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              🏁 완료
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('pending')}
              className={`px-2 py-1 rounded-lg cursor-pointer transition ${
                filterStatus === 'pending' ? 'bg-amber-500/30 text-amber-300 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              ⏳ 대기(예정)
            </button>
          </div>

          {/* 코트 필터 */}
          {kdkCourts.length > 1 && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-bold">
              <span>코트:</span>
              <select
                value={filterCourt}
                onChange={(e) => setFilterCourt(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-amber-300 font-bold focus:outline-none"
              >
                <option value="all">전체 코트 ({kdkCourts.length}개)</option>
                {kdkCourts.map((c) => (
                  <option key={c.courtNumber} value={c.courtNumber}>
                    {c.courtNumber}번 코트
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 경기 카드 그리드 리스트 */}
        {filteredMatches.length === 0 ? (
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-6 text-center text-xs text-slate-400 space-y-1">
            <p className="text-base">📭</p>
            <p>선택하신 조건에 해당하는 KDK 경기가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
            {filteredMatches.map((m) => {
              const isMyMatch = Boolean(
                currentUserName &&
                  [...m.teamA, ...m.teamB].some((p) => (p?.name || '').includes(currentUserName.trim()))
              );

              const statusBadge = m.completed ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  🏁 경기완료
                </span>
              ) : m.isLive ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-emerald-500 text-slate-950 animate-pulse">
                  🔴 LIVE 진행중
                </span>
              ) : m.isNext ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                  ⏳ 다음 대기(NEXT)
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-900 text-slate-400 border border-slate-800">
                  ⚪ 예정
                </span>
              );

              return (
                <div
                  key={m.id || `match_${m.courtNumber}_${m.gameNumber}`}
                  className={`rounded-2xl border p-3.5 space-y-2.5 transition relative overflow-hidden ${
                    isMyMatch
                      ? 'bg-gradient-to-r from-amber-950/40 via-slate-950 to-slate-950 border-amber-500/60 ring-1 ring-amber-400/30'
                      : m.isLive
                      ? 'bg-gradient-to-r from-emerald-950/40 via-slate-950 to-slate-950 border-emerald-500/50'
                      : m.completed
                      ? 'bg-slate-950/80 border-slate-800/80 opacity-90'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  {/* 상단: 게임 번호, 코트 번호, 상태 배지, 내 경기 태그 */}
                  <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-800 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                        게임 {m.gameNumber}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">
                        {m.courtNumber}번 코트
                      </span>
                      {isMyMatch && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-400 text-slate-950">
                          내 출전
                        </span>
                      )}
                    </div>
                    {statusBadge}
                  </div>

                  {/* 중단: Team A vs Team B 및 스코어 */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    {/* Team A */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <span className="text-[9px] font-black text-slate-400 block">TEAM A</span>
                      {m.teamA.map((p, idx) => {
                        const isMe = Boolean(currentUserName && (p?.name || '').includes(currentUserName.trim()));
                        return (
                          <div
                            key={idx}
                            className={`font-black truncate ${
                              isMe ? 'text-amber-300 underline decoration-amber-400' : 'text-emerald-300'
                            }`}
                          >
                            {p?.name}
                            <span className="text-[10px] text-slate-400 font-normal ml-1">({p?.grade || '은배'})</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* 스코어 */}
                    <div className="shrink-0 flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800 text-center font-mono">
                      <span
                        className={`text-base font-black ${
                          m.completed && m.scoreA > m.scoreB ? 'text-amber-300' : 'text-white'
                        }`}
                      >
                        {m.scoreA}
                      </span>
                      <span className="text-xs font-black text-slate-600">:</span>
                      <span
                        className={`text-base font-black ${
                          m.completed && m.scoreB > m.scoreA ? 'text-amber-300' : 'text-white'
                        }`}
                      >
                        {m.scoreB}
                      </span>
                    </div>

                    {/* Team B */}
                    <div className="flex-1 min-w-0 space-y-0.5 text-right">
                      <span className="text-[9px] font-black text-slate-400 block">TEAM B</span>
                      {m.teamB.map((p, idx) => {
                        const isMe = Boolean(currentUserName && (p?.name || '').includes(currentUserName.trim()));
                        return (
                          <div
                            key={idx}
                            className={`font-black truncate ${
                              isMe ? 'text-amber-300 underline decoration-amber-400' : 'text-emerald-300'
                            }`}
                          >
                            {p?.name}
                            <span className="text-[10px] text-slate-400 font-normal ml-1">({p?.grade || '은배'})</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 하단: 휴식 선수 명단 (있는 경우) */}
                  {Array.isArray(m.resting) && m.resting.length > 0 && (
                    <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="text-slate-500 font-medium">☕ 해당 라운드 휴식:</span>
                      <span className="text-slate-300 font-bold truncate">
                        {m.resting.map((rp) => rp.name).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. 하단: KDK_V2025 개인별 라운드 기록표 및 순위표 */}
      {/* ---------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-800 pb-2">
          <span className="text-sm font-black text-emerald-300 flex items-center gap-1.5">
            <span>📊</span> KDK_V2025 개인별 라운드 종합 기록표 & 순위표
          </span>
          <span className="text-[10px] text-slate-400">
            총 {totalPlayersCount}명 선수 순위 실시간 자동 집계
          </span>
        </div>

        {/* 5단계 순위 산정 기준 공식 안내 배너 */}
        <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-2.5 text-[10px] text-slate-300 space-y-1">
          <div className="flex items-center gap-1 font-bold text-amber-300">
            <span>⚖️</span>
            <span>공식 5단계 순위 산정 기준 안내:</span>
          </div>
          <div className="text-slate-300 leading-relaxed font-mono">
            ① <strong>승수(다승)</strong> ➔ ② <strong>득실차</strong> ➔ ③ <strong>다득점</strong> ➔ ④ <strong>나이순(만 나이 연장자 우선)</strong> ➔ ⑤ <strong>실력순(하위 부수 우선)</strong>
          </div>
          <p className="text-[9px] text-slate-400">
            * 1~3순위 동률 발생 시 [연장자 우대] 또는 [하위부수 우대] 배지가 순위표에 명시됩니다.
          </p>
        </div>

        {/* 개인별 라운드 종합 테이블 */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
          <table className="w-full text-center text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-slate-900 text-slate-300 border-b border-slate-800 text-[10px] font-black">
                <th className="py-2.5 px-2">순위</th>
                <th className="py-2.5 px-3 text-left">선수명 (부수·나이)</th>
                {Array.from({ length: maxRounds }).map((_, rIdx) => (
                  <th key={rIdx} className="py-2.5 px-2 text-emerald-300">
                    {rIdx + 1}R
                  </th>
                ))}
                <th className="py-2.5 px-2.5 text-amber-300 bg-amber-400/10">승수</th>
                <th className="py-2.5 px-2 text-emerald-400">게임 득</th>
                <th className="py-2.5 px-2 text-rose-400">게임 실</th>
                <th className="py-2.5 px-2.5 text-cyan-300 font-black bg-cyan-400/10">득실차</th>
                <th className="py-2.5 px-2 text-slate-400">출전 경기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {overallStandings.length === 0 ? (
                <tr>
                  <td colSpan={maxRounds + 7} className="py-6 text-center text-xs text-slate-500 italic">
                    등록된 KDK 경기 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                overallStandings.map((row) => {
                  const isMe = Boolean(currentUserName && (row.name || '').includes(currentUserName.trim()));
                  const playerRounds = playerRoundMap[row.playerId] || [];

                  return (
                    <tr
                      key={row.playerId}
                      className={`transition ${
                        isMe
                          ? 'bg-amber-400/15 font-bold ring-1 ring-amber-400/40 text-white'
                          : row.rank <= 3
                          ? 'bg-slate-900/40 hover:bg-slate-900'
                          : 'hover:bg-slate-900/60'
                      }`}
                    >
                      {/* 순위 */}
                      <td className="py-2.5 px-2">
                        <div className="flex items-center justify-center gap-1">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                              row.rank === 1
                                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                                : row.rank === 2
                                ? 'bg-slate-300 text-slate-950'
                                : row.rank === 3
                                ? 'bg-amber-700 text-white'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {row.rank}
                          </span>
                          {row.tieBreakApplied && (
                            <span
                              className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-sans"
                              title="1~3순위 동점 후 연장자/하위부수 우대 판정 적용"
                            >
                              동점우대
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 이름 (부수·나이) */}
                      <td className="py-2.5 px-3 text-left font-sans">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-black ${isMe ? 'text-amber-300 font-extrabold' : 'text-slate-100'}`}>
                            {row.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({row.grade} · {row.age > 0 ? `${row.age}세` : '-'})
                          </span>
                          {isMe && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 ml-1">
                              나
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 1R ~ NR 결과 */}
                      {Array.from({ length: maxRounds }).map((_, rIdx) => {
                        const gameResult = playerRounds[rIdx];
                        if (!gameResult) {
                          return (
                            <td key={rIdx} className="py-2.5 px-2 text-[10px] text-slate-600">
                              -
                            </td>
                          );
                        }

                        if (!gameResult.completed) {
                          return (
                            <td key={rIdx} className="py-2.5 px-2 text-[10px] text-amber-400 font-bold">
                              진행중
                            </td>
                          );
                        }

                        return (
                          <td key={rIdx} className="py-2.5 px-2 text-xs">
                            <span
                              className={`px-1.5 py-0.5 rounded font-black ${
                                gameResult.isWin
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : gameResult.isDraw
                                  ? 'bg-slate-700 text-slate-200'
                                  : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                              }`}
                              title={`파트너: ${gameResult.partnerName} / 상대: ${gameResult.oppNames}`}
                            >
                              {gameResult.scoreFor}:{gameResult.scoreAgainst}
                            </span>
                          </td>
                        );
                      })}

                      {/* 승수 */}
                      <td className="py-2.5 px-2.5 font-black text-amber-300 bg-amber-400/10 text-sm">
                        {row.wins}승
                      </td>

                      {/* 게임 득 */}
                      <td className="py-2.5 px-2 text-emerald-400 font-bold">
                        {row.pointsFor}
                      </td>

                      {/* 게임 실 */}
                      <td className="py-2.5 px-2 text-rose-400 font-bold">
                        {row.pointsAgainst}
                      </td>

                      {/* 득실차 */}
                      <td className="py-2.5 px-2.5 font-black text-cyan-300 bg-cyan-400/10 text-sm">
                        {row.pointDiff >= 0 ? `+${row.pointDiff}` : row.pointDiff}
                      </td>

                      {/* 출전 경기수 */}
                      <td className="py-2.5 px-2 text-[11px] text-slate-400">
                        {row.matches}전
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
