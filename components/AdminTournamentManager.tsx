'use client';
import React, { useState, useEffect } from 'react';

export interface ParticipantPlayer {
  id: string;
  name: string;
  grade: string;
  gender: string;
  isGuest?: boolean; // 로그인하지 못하는 임의 추가 선수 여부
  isLoggedInUser?: boolean;
}

export interface AssignedMatch {
  id: string;
  round: number;
  roundName: string;
  courtNumber: number;
  teamA: [ParticipantPlayer, ParticipantPlayer];
  teamB: [ParticipantPlayer, ParticipantPlayer];
  scoreA: number;
  scoreB: number;
  status: 'waiting' | 'playing' | 'completed';
}

export interface TournamentConfig {
  id: string;
  title: string;
  mode: 'TOURNAMENT' | 'KDK';
  assignmentType: 'AUTO' | 'MANUAL';
  courtsCount: number;
  selectedCourts: number[];
  participants: ParticipantPlayer[];
  matches: AssignedMatch[];
  status: 'pending' | 'ongoing' | 'finished';
  createdAt: string;
}

interface AdminTournamentManagerProps {
  registeredUsers: any[];
  currentUser: any;
  activeTournament: TournamentConfig | null;
  onApplyTournament: (config: TournamentConfig) => void;
  onAddCustomUserToClub?: (newUser: ParticipantPlayer) => void;
}

const GRADE_OPTIONS = ['금배', '은배', '동배', '국화', '개나리', '테린이', '고령자부'];

const GRADE_WEIGHTS: Record<string, number> = {
  '금배': 10,
  '은배': 8,
  '국화': 7,
  '동배': 6,
  '개나리': 5,
  '고령자부': 5,
  '테린이': 3,
};

export default function AdminTournamentManager({
  registeredUsers,
  currentUser,
  activeTournament,
  onApplyTournament,
  onAddCustomUserToClub,
}: AdminTournamentManagerProps) {
  // 1단계: 대회명 생성
  const [tournamentTitle, setTournamentTitle] = useState<string>(
    activeTournament?.title || '2026 썬 테니스 클럽 정기 대회'
  );
  const [isTitleConfirmed, setIsTitleConfirmed] = useState<boolean>(Boolean(activeTournament?.title));

  // 2단계: 대회방식 선택 ('TOURNAMENT' | 'KDK' | null)
  const [tournamentMode, setTournamentMode] = useState<'TOURNAMENT' | 'KDK' | null>(
    activeTournament?.mode || null
  );

  // 3단계: 선수 배치 (로그인 회원 선택 + 미로그인 임의 선수 추가)
  const [selectedParticipants, setSelectedParticipants] = useState<ParticipantPlayer[]>(() => {
    if (activeTournament?.participants && activeTournament.participants.length > 0) {
      return activeTournament.participants;
    }
    return registeredUsers.slice(0, 8).map((u) => ({
      id: String(u.id),
      name: u.name,
      grade: u.grade || '은배',
      gender: u.gender === 'F' || u.gender === '여' ? '여' : '남',
      isGuest: false,
      isLoggedInUser: true,
    }));
  });

  // 미로그인(임의) 선수 추가 입력 상태
  const [guestNameInput, setGuestNameInput] = useState<string>('');
  const [guestGradeInput, setGuestGradeInput] = useState<string>('은배');
  const [guestGenderInput, setGuestGenderInput] = useState<string>('남');
  const [guestPool, setGuestPool] = useState<ParticipantPlayer[]>([]);

  // 4단계: 코트 배정 및 자동/수동 배치 방식
  const [selectedCourts, setSelectedCourts] = useState<number[]>(
    activeTournament?.selectedCourts || [1, 2, 3]
  );
  const [kdkRoundsCount, setKdkRoundsCount] = useState<number>(3);
  const [assignmentType, setAssignmentType] = useState<'AUTO' | 'MANUAL'>(
    activeTournament?.assignmentType || 'AUTO'
  );
  const [autoBalanceOption, setAutoBalanceOption] = useState<'BALANCE' | 'RANDOM'>('BALANCE');

  // 배정된 매치 리스트 (자동 생성 후에도 수동 편집 가능)
  const [assignedMatches, setAssignedMatches] = useState<AssignedMatch[]>(
    activeTournament?.matches || []
  );

  // 수동 추가용 개별 매치 슬롯 상태
  const [manualCourt, setManualCourt] = useState<number>(1);
  const [manualRoundName, setManualRoundName] = useState<string>('1라운드');
  const [manualTeamA1, setManualTeamA1] = useState<string>('');
  const [manualTeamA2, setManualTeamA2] = useState<string>('');
  const [manualTeamB1, setManualTeamB1] = useState<string>('');
  const [manualTeamB2, setManualTeamB2] = useState<string>('');

  // 전체 선택 가능한 선수 풀 (가입/로그인 회원 + 임의 추가된 비로그인 선수)
  const allAvailablePlayers: ParticipantPlayer[] = [
    ...registeredUsers.map((u) => ({
      id: String(u.id),
      name: u.name,
      grade: u.grade || '은배',
      gender: u.gender === 'F' || u.gender === '여' ? '여' : '남',
      isGuest: Boolean(u.isGuest),
      isLoggedInUser: !u.isGuest,
    })),
    ...guestPool.filter((g) => !registeredUsers.some((u) => String(u.id) === g.id)),
  ];

  // 수동 슬롯 기본값 동기화
  useEffect(() => {
    if (selectedParticipants.length >= 4) {
      if (!manualTeamA1) setManualTeamA1(selectedParticipants[0]?.id || '');
      if (!manualTeamA2) setManualTeamA2(selectedParticipants[1]?.id || '');
      if (!manualTeamB1) setManualTeamB1(selectedParticipants[2]?.id || '');
      if (!manualTeamB2) setManualTeamB2(selectedParticipants[3]?.id || '');
    }
  }, [selectedParticipants]);

  // 로그인 회원 참가 토글
  const togglePlayerSelection = (player: ParticipantPlayer) => {
    setSelectedParticipants((prev) => {
      const exists = prev.some((p) => p.id === player.id);
      if (exists) {
        return prev.filter((p) => p.id !== player.id);
      } else {
        return [...prev, player];
      }
    });
  };

  // 전체 회원 선택 / 해제
  const handleSelectAllPlayers = () => {
    if (selectedParticipants.length === allAvailablePlayers.length) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants([...allAvailablePlayers]);
    }
  };

  // 로그인하지 못하는 선수(임의 이름) 추가 핸들러 (단일 또는 쉼표 구분 복수 추가 지원)
  const handleAddGuestPlayer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = guestNameInput.trim();
    if (!raw) {
      alert('추가할 선수의 이름을 입력해 주세요.');
      return;
    }

    const names = raw
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    const newGuests: ParticipantPlayer[] = names.map((name, idx) => ({
      id: `guest_${Date.now()}_${idx}`,
      name,
      grade: guestGradeInput,
      gender: guestGenderInput,
      isGuest: true,
      isLoggedInUser: false,
    }));

    setGuestPool((prev) => [...prev, ...newGuests]);
    setSelectedParticipants((prev) => [...prev, ...newGuests]);
    if (onAddCustomUserToClub) {
      newGuests.forEach((g) => onAddCustomUserToClub(g));
    }
    setGuestNameInput('');
  };

  // 코트 번호 토글
  const toggleCourtNumber = (courtNum: number) => {
    setSelectedCourts((prev) => {
      if (prev.includes(courtNum)) {
        if (prev.length <= 1) return prev; // 최소 1개 코트 유지
        return prev.filter((c) => c !== courtNum).sort((a, b) => a - b);
      }
      return [...prev, courtNum].sort((a, b) => a - b);
    });
  };

  // 자동 방식: 대진표 및 코트 자동 배정 실행
  const handleAutoAssign = () => {
    if (!tournamentTitle.trim()) {
      alert('먼저 대회명을 입력해 주세요.');
      return;
    }
    if (!tournamentMode) {
      alert('대회 방식(토너먼트 또는 KDK)을 선택해 주세요.');
      return;
    }
    if (selectedParticipants.length < 4) {
      alert('경기를 진행하려면 최소 4명 이상의 선수를 선택하거나 추가해 주세요.');
      return;
    }

    const courts = selectedCourts.length > 0 ? selectedCourts : [1, 2];
    const generated: AssignedMatch[] = [];

    if (tournamentMode === 'KDK') {
      // KDK 라운드별 파트너 순환 및 코트 자동 배정
      const playHistory: Record<string, { count: number; partners: Set<string> }> = {};
      selectedParticipants.forEach((p) => {
        playHistory[p.id] = { count: 0, partners: new Set() };
      });

      for (let r = 1; r <= kdkRoundsCount; r++) {
        // 경기 수 적은 순 + 밸런스/랜덤 정렬
        const pool = [...selectedParticipants].sort((a, b) => {
          const diff = (playHistory[a.id]?.count || 0) - (playHistory[b.id]?.count || 0);
          if (diff !== 0) return diff;
          return Math.random() - 0.5;
        });

        const maxMatches = Math.min(courts.length, Math.floor(pool.length / 4));
        const activePool = pool.slice(0, maxMatches * 4);

        if (autoBalanceOption === 'BALANCE') {
          // 등급 가중치 순 정렬 후 스네이크(고-저) 페어링 + 라운드별 파트너 로테이션
          activePool.sort(
            (a, b) => (GRADE_WEIGHTS[b.grade] || 5) - (GRADE_WEIGHTS[a.grade] || 5)
          );
        } else {
          activePool.sort(() => Math.random() - 0.5);
        }

        for (let mIdx = 0; mIdx < maxMatches; mIdx++) {
          const base = mIdx * 4;
          const g = activePool.slice(base, base + 4);
          if (g.length < 4) continue;

          // 라운드마다 파트너 조합 변경: R1 (0,3 vs 1,2), R2 (0,2 vs 1,3), R3 (0,1 vs 2,3)
          let teamA: [ParticipantPlayer, ParticipantPlayer];
          let teamB: [ParticipantPlayer, ParticipantPlayer];
          if (r % 3 === 1) {
            teamA = [g[0], g[3]];
            teamB = [g[1], g[2]];
          } else if (r % 3 === 2) {
            teamA = [g[0], g[2]];
            teamB = [g[1], g[3]];
          } else {
            teamA = [g[0], g[1]];
            teamB = [g[2], g[3]];
          }

          g.forEach((p) => {
            if (playHistory[p.id]) playHistory[p.id].count += 1;
          });

          const assignedCourt = courts[mIdx % courts.length];
          generated.push({
            id: `match_kdk_r${r}_c${assignedCourt}_${Date.now()}_${mIdx}`,
            round: r,
            roundName: `제 ${r} 라운드 (KDK 순환)`,
            courtNumber: assignedCourt,
            teamA,
            teamB,
            scoreA: 0,
            scoreB: 0,
            status: r === 1 ? 'playing' : 'waiting',
          });
        }
      }
    } else {
      // TOURNAMENT 모드: 복식 팀 구성 후 토너먼트/예선 경기 및 코트 자동 배정
      const pool = [...selectedParticipants];
      if (autoBalanceOption === 'BALANCE') {
        pool.sort((a, b) => (GRADE_WEIGHTS[b.grade] || 5) - (GRADE_WEIGHTS[a.grade] || 5));
      } else {
        pool.sort(() => Math.random() - 0.5);
      }

      // 2인 1팀으로 묶기 (밸런스인 경우 상위+하위 매칭)
      const teams: [ParticipantPlayer, ParticipantPlayer][] = [];
      const usableCount = Math.floor(pool.length / 2) * 2;
      const half = usableCount / 2;

      if (autoBalanceOption === 'BALANCE' && usableCount >= 4) {
        for (let i = 0; i < half; i++) {
          teams.push([pool[i], pool[usableCount - 1 - i]]);
        }
      } else {
        for (let i = 0; i < usableCount; i += 2) {
          teams.push([pool[i], pool[i + 1]]);
        }
      }

      const roundLabel =
        teams.length >= 8 ? '16강 토너먼트' : teams.length >= 4 ? '4강 준결승' : '결승전';

      let matchOrder = 0;
      for (let i = 0; i + 1 < teams.length; i += 2) {
        const assignedCourt = courts[matchOrder % courts.length];
        generated.push({
          id: `match_tour_${Date.now()}_${matchOrder}`,
          round: 1,
          roundName: `${roundLabel} 제 ${matchOrder + 1}경기`,
          courtNumber: assignedCourt,
          teamA: teams[i],
          teamB: teams[i + 1],
          scoreA: 0,
          scoreB: 0,
          status: matchOrder < courts.length ? 'playing' : 'waiting',
        });
        matchOrder++;
      }
    }

    setAssignedMatches(generated);
  };

  // 수동 방식: 관리자가 직접 선택한 코트와 4명의 선수를 대진에 추가
  const handleAddManualMatch = () => {
    const pA1 = selectedParticipants.find((p) => p.id === manualTeamA1);
    const pA2 = selectedParticipants.find((p) => p.id === manualTeamA2);
    const pB1 = selectedParticipants.find((p) => p.id === manualTeamB1);
    const pB2 = selectedParticipants.find((p) => p.id === manualTeamB2);

    if (!pA1 || !pA2 || !pB1 || !pB2) {
      alert('Team A(2명)와 Team B(2명) 선수를 모두 선택해 주세요.');
      return;
    }

    const uniqueIds = new Set([pA1.id, pA2.id, pB1.id, pB2.id]);
    if (uniqueIds.size < 4) {
      alert('한 경기에 동일한 선수가 중복 배치되었습니다. 서로 다른 4명의 선수를 선택해 주세요.');
      return;
    }

    const newMatch: AssignedMatch = {
      id: `match_manual_${Date.now()}`,
      round: assignedMatches.length + 1,
      roundName:
        manualRoundName.trim() ||
        (tournamentMode === 'TOURNAMENT' ? '토너먼트 본선' : `제 ${assignedMatches.length + 1} 경기`),
      courtNumber: manualCourt,
      teamA: [pA1, pA2],
      teamB: [pB1, pB2],
      scoreA: 0,
      scoreB: 0,
      status: 'playing',
    };

    setAssignedMatches((prev) => [...prev, newMatch]);
    if (!selectedCourts.includes(manualCourt)) {
      setSelectedCourts((prev) => [...prev, manualCourt].sort((a, b) => a - b));
    }
  };

  // 배정된 매치의 코트 번호 또는 선수 개별 변경 (수동 미세조정)
  const handleUpdateMatchCourt = (matchId: string, newCourt: number) => {
    setAssignedMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, courtNumber: newCourt } : m))
    );
  };

  const handleUpdateMatchPlayer = (
    matchId: string,
    team: 'teamA' | 'teamB',
    slotIdx: 0 | 1,
    playerId: string
  ) => {
    const found = selectedParticipants.find((p) => p.id === playerId);
    if (!found) return;
    setAssignedMatches((prev) =>
      prev.map((m) => {
        if (m.id !== matchId) return m;
        const updatedTeam: [ParticipantPlayer, ParticipantPlayer] = [
          m[team][0],
          m[team][1],
        ];
        updatedTeam[slotIdx] = found;
        return { ...m, [team]: updatedTeam };
      })
    );
  };

  const handleRemoveMatch = (matchId: string) => {
    setAssignedMatches((prev) => prev.filter((m) => m.id !== matchId));
  };

  // 최종 대회 생성 & 실시간 코트/대진표 앱 자동 연동
  const handleLaunchTournament = () => {
    if (!tournamentTitle.trim()) {
      alert('대회명을 입력해 주세요.');
      return;
    }
    if (!tournamentMode) {
      alert('대회 방식(토너먼트 또는 KDK)을 선택해 주세요.');
      return;
    }
    if (assignedMatches.length === 0) {
      alert('코트 및 선수 배치가 완료된 경기가 없습니다. 자동 배정을 실행하거나 수동으로 경기를 추가해 주세요.');
      return;
    }

    const config: TournamentConfig = {
      id: activeTournament?.id || `tour_${Date.now()}`,
      title: tournamentTitle.trim(),
      mode: tournamentMode,
      assignmentType,
      courtsCount: selectedCourts.length,
      selectedCourts,
      participants: selectedParticipants,
      matches: assignedMatches,
      status: 'ongoing',
      createdAt: new Date().toISOString(),
    };

    onApplyTournament(config);
  };

  return (
    <div className="space-y-4">
      {/* 상단 관리자 대회 개설 위저드 안내 배너 */}
      <div className="bg-gradient-to-r from-red-950/90 via-slate-900 to-amber-950/80 border border-amber-500/30 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950">
              ADMIN CONSOLE
            </span>
            <span className="text-xs font-extrabold text-amber-300">
              관리자 전용 대회 생성 & 코트/선수 배치 시스템
            </span>
          </div>
          {currentUser && (
            <span className="text-[10px] text-slate-300 bg-slate-950/80 px-2 py-0.5 rounded-lg border border-slate-800">
              👑 {currentUser.name} 관리자
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
          ① 대회명 생성 ➔ ② 대회방식(토너먼트 / KDK) 선택 ➔ ③ 선수 배치(로그인 회원 선택 + 미로그인 선수 이름 직접 입력) ➔ ④ 코트 및 선수 배정(자동/수동) 후 경기를 시작하면 앱 전체에 즉시 자동 연동됩니다.
        </p>
      </div>

      {/* ================================================================= */}
      {/* STEP 1. 대회명 생성 */}
      {/* ================================================================= */}
      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center">
              1
            </span>
            <h3 className="text-sm font-black text-white">대회명 생성</h3>
          </div>
          {isTitleConfirmed && (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
              ✓ 대회명 설정됨
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            '2026년 11월 정기 월례회',
            '제5회 썬 테니스 클럽 챔피언십',
            '주말 번개 KDK 친선대회',
          ].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setTournamentTitle(preset);
                setIsTitleConfirmed(true);
              }}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
            >
              + {preset}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={tournamentTitle}
            onChange={(e) => setTournamentTitle(e.target.value)}
            placeholder="생성할 대회명을 입력하세요 (예: 2026 추계 클럽 챔프전)"
            className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 font-bold"
          />
          <button
            type="button"
            onClick={() => {
              if (!tournamentTitle.trim()) {
                alert('대회명을 입력해 주세요.');
                return;
              }
              setIsTitleConfirmed(true);
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-xs transition shadow-md cursor-pointer shrink-0"
          >
            대회명 확정
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* STEP 2. 대회방식 선택 (토너먼트 vs KDK 버튼) */}
      {/* ================================================================= */}
      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center">
              2
            </span>
            <h3 className="text-sm font-black text-white">대회 방식 선택 (토너먼트 / KDK)</h3>
          </div>
          {tournamentMode && (
            <span className="text-[10px] font-black text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-400/30">
              선택됨: {tournamentMode === 'TOURNAMENT' ? '🏆 토너먼트' : '🔄 KDK 방식'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* 토너먼트 선택 버튼 */}
          <button
            type="button"
            onClick={() => {
              setTournamentMode('TOURNAMENT');
              setManualRoundName('토너먼트 본선');
            }}
            className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer relative overflow-hidden ${
              tournamentMode === 'TOURNAMENT'
                ? 'bg-gradient-to-br from-amber-500/20 via-slate-900 to-orange-500/10 border-amber-400 shadow-lg shadow-amber-500/15 scale-[1.01]'
                : 'bg-slate-950/90 border-slate-800 hover:border-slate-700 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-2xl">🏆</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                  tournamentMode === 'TOURNAMENT'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {tournamentMode === 'TOURNAMENT' ? '✓ 선택됨' : '선택하기'}
              </span>
            </div>
            <p className="text-sm font-black text-white">토너먼트 (Tournament)</p>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              고정 파트너 복식조 편성 · 조별 예선 및 본선 녹아웃(8강/4강/결승) 대진 진행
            </p>
          </button>

          {/* KDK 선택 버튼 */}
          <button
            type="button"
            onClick={() => {
              setTournamentMode('KDK');
              setManualRoundName('제 1 라운드');
            }}
            className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer relative overflow-hidden ${
              tournamentMode === 'KDK'
                ? 'bg-gradient-to-br from-emerald-500/20 via-slate-900 to-teal-500/10 border-emerald-400 shadow-lg shadow-emerald-500/15 scale-[1.01]'
                : 'bg-slate-950/90 border-slate-800 hover:border-slate-700 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-2xl">🔄</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                  tournamentMode === 'KDK'
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {tournamentMode === 'KDK' ? '✓ 선택됨' : '선택하기'}
              </span>
            </div>
            <p className="text-sm font-black text-white">KDK (파트너 순환 리그)</p>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              매 라운드 파트너/상대 자동 교체 · 개인별 승수 및 득실차 랭킹 집계 방식
            </p>
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* STEP 3. 선수 구성 (로그인 회원 선택 + 미로그인 임의 선수 이름 입력) */}
      {/* ================================================================= */}
      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center">
              3
            </span>
            <div>
              <h3 className="text-sm font-black text-white">선수 구성 및 참가자 배치</h3>
              <p className="text-[10px] text-slate-400">
                로그인한 회원을 클릭해 선택하거나, 미로그인 선수는 이름을 직접 입력해 추가하세요.
              </p>
            </div>
          </div>
          <span className="text-xs font-black text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/30">
            참가 확정: {selectedParticipants.length}명
          </span>
        </div>

        {/* 3-A. 로그인/가입된 클럽 회원 선택 영역 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-extrabold text-emerald-300 flex items-center gap-1.5">
              <span>🟢</span> 로그인 / 등록된 클럽 회원에서 선택
            </span>
            <button
              type="button"
              onClick={handleSelectAllPlayers}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold cursor-pointer"
            >
              {selectedParticipants.length === allAvailablePlayers.length ? '전체 해제' : '전체 선택'}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
            {allAvailablePlayers.map((player) => {
              const isSelected = selectedParticipants.some((p) => p.id === player.id);
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => togglePlayerSelection(player)}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-950/70 border-emerald-400 text-white shadow-sm'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="truncate pr-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold truncate">{player.name}</span>
                      {player.isGuest ? (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                          비로그인
                        </span>
                      ) : (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                          회원
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {player.grade} · {player.gender}
                    </span>
                  </div>
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                      isSelected
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isSelected ? '✓' : '+'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3-B. 로그인을 하지 못하는 선수(비로그인/게스트) 관리자 임의 이름 추가 영역 */}
        <div className="bg-slate-950/90 border border-amber-500/30 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
              <span>✍️</span> 로그인을 못하는 선수 (관리자 임의 이름 직접 추가)
            </span>
            <span className="text-[10px] text-slate-400">쉼표(,)로 여러 명 동시 입력 가능</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              type="text"
              value={guestNameInput}
              onChange={(e) => setGuestNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddGuestPlayer();
                }
              }}
              placeholder="이름 입력 (예: 홍길동 또는 홍길동, 이순신)"
              className="sm:col-span-6 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <select
              value={guestGradeInput}
              onChange={(e) => setGuestGradeInput(e.target.value)}
              className="sm:col-span-3 px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-amber-300 font-bold focus:outline-none"
            >
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleAddGuestPlayer()}
              className="sm:col-span-3 py-2 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-xs transition shadow-md cursor-pointer"
            >
              + 임의 선수 추가
            </button>
          </div>

          {/* 현재 선택된 참가 선수 요약 태그 리스트 */}
          {selectedParticipants.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80">
              <p className="text-[10px] text-slate-400 mb-1.5 font-bold">
                현재 대회 출전 명단 ({selectedParticipants.length}명) — 클릭 시 제외:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedParticipants.map((p, idx) => (
                  <span
                    key={p.id}
                    onClick={() => togglePlayerSelection(p)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                      p.isGuest
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-red-500/20'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-red-500/20'
                    }`}
                  >
                    <span>
                      {idx + 1}. {p.name} ({p.grade})
                    </span>
                    {p.isGuest && <span className="text-[9px] text-amber-200">[임의]</span>}
                    <span className="text-[10px] opacity-75">✕</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* STEP 4. 코트 배정 및 선수 배치 (자동방식 vs 수동방식) */}
      {/* ================================================================= */}
      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center">
              4
            </span>
            <div>
              <h3 className="text-sm font-black text-white">코트 배정 및 선수 배치 (자동 / 수동)</h3>
              <p className="text-[10px] text-slate-400">
                사용할 코트를 선택하고 자동 배정 또는 수동 배정으로 대진을 구성하세요.
              </p>
            </div>
          </div>
        </div>

        {/* 가용 코트 번호 선택 */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-300">🎾 사용할 코트 선택 (다중 선택 가능)</span>
            <span className="text-[11px] font-extrabold text-amber-400">
              선택 코트: {selectedCourts.map((c) => `${c}번`).join(', ')}
            </span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {[1, 2, 3, 4, 5, 6].map((cNum) => {
              const active = selectedCourts.includes(cNum);
              return (
                <button
                  key={cNum}
                  type="button"
                  onClick={() => toggleCourtNumber(cNum)}
                  className={`py-2 rounded-xl text-xs font-black border transition cursor-pointer ${
                    active
                      ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {cNum}코트
                </button>
              );
            })}
          </div>
        </div>

        {/* 자동 방식 vs 수동 방식 전환 탭 버튼 */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setAssignmentType('AUTO')}
            className={`py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
              assignmentType === 'AUTO'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>⚡</span>
            <span>자동 방식 (코트·선수 자동배정)</span>
          </button>

          <button
            type="button"
            onClick={() => setAssignmentType('MANUAL')}
            className={`py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
              assignmentType === 'MANUAL'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🖐️</span>
            <span>수동 방식 (코트·선수 직접배치)</span>
          </button>
        </div>

        {/* [A] 자동 방식 설정 패널 */}
        {assignmentType === 'AUTO' && (
          <div className="bg-slate-950/90 border border-emerald-500/30 rounded-2xl p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-300">매칭 알고리즘:</span>
                <button
                  type="button"
                  onClick={() => setAutoBalanceOption('BALANCE')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                    autoBalanceOption === 'BALANCE'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  ⚖️ 급수 밸런스 배정
                </button>
                <button
                  type="button"
                  onClick={() => setAutoBalanceOption('RANDOM')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                    autoBalanceOption === 'RANDOM'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  🎲 완전 랜덤 추첨
                </button>
              </div>

              {tournamentMode === 'KDK' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-bold">진행 라운드:</span>
                  {[2, 3, 4].map((rNum) => (
                    <button
                      key={rNum}
                      type="button"
                      onClick={() => setKdkRoundsCount(rNum)}
                      className={`px-2 py-0.5 rounded text-[11px] font-black border cursor-pointer ${
                        kdkRoundsCount === rNum
                          ? 'bg-amber-400 text-slate-950 border-amber-300'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      {rNum}R
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleAutoAssign}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>⚡</span>
              <span>
                {tournamentMode === 'TOURNAMENT' ? '토너먼트' : 'KDK'} 코트 및 선수 자동 배정 실행 ({selectedParticipants.length}명 / {selectedCourts.length}개 코트)
              </span>
            </button>
          </div>
        )}

        {/* [B] 수동 방식 설정 패널 */}
        {assignmentType === 'MANUAL' && (
          <div className="bg-slate-950/90 border border-amber-500/30 rounded-2xl p-3.5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-amber-300">
                🖐️ 코트별 출전 선수 수동 지정 추가
              </span>
              <span className="text-[10px] text-slate-400">
                로그인 회원 및 비로그인 임의 선수 모두 선택 가능
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">배정 코트 선택</label>
                <select
                  value={manualCourt}
                  onChange={(e) => setManualCourt(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-amber-300 font-bold"
                >
                  {[1, 2, 3, 4, 5, 6].map((c) => (
                    <option key={c} value={c}>
                      {c}번 코트
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">라운드 / 경기명</label>
                <input
                  type="text"
                  value={manualRoundName}
                  onChange={(e) => setManualRoundName(e.target.value)}
                  placeholder="예: 1라운드, 4강 1경기"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Team A 수동 선택 */}
              <div className="bg-slate-900 p-2.5 rounded-xl border border-emerald-500/30 space-y-2">
                <span className="text-[10px] font-black text-emerald-400 block">TEAM A 선수 2명 배치</span>
                <select
                  value={manualTeamA1}
                  onChange={(e) => setManualTeamA1(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                >
                  <option value="">선수 1 선택</option>
                  {selectedParticipants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.grade}) {p.isGuest ? '[임의]' : '[회원]'}
                    </option>
                  ))}
                </select>
                <select
                  value={manualTeamA2}
                  onChange={(e) => setManualTeamA2(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                >
                  <option value="">선수 2 선택</option>
                  {selectedParticipants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.grade}) {p.isGuest ? '[임의]' : '[회원]'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Team B 수동 선택 */}
              <div className="bg-slate-900 p-2.5 rounded-xl border border-amber-500/30 space-y-2">
                <span className="text-[10px] font-black text-amber-400 block">TEAM B 선수 2명 배치</span>
                <select
                  value={manualTeamB1}
                  onChange={(e) => setManualTeamB1(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                >
                  <option value="">선수 3 선택</option>
                  {selectedParticipants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.grade}) {p.isGuest ? '[임의]' : '[회원]'}
                    </option>
                  ))}
                </select>
                <select
                  value={manualTeamB2}
                  onChange={(e) => setManualTeamB2(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                >
                  <option value="">선수 4 선택</option>
                  {selectedParticipants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.grade}) {p.isGuest ? '[임의]' : '[회원]'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddManualMatch}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-xs transition shadow-md cursor-pointer"
            >
              + 이 코트 대진 수동 추가하기
            </button>
          </div>
        )}

        {/* 배정된 코트 & 선수 매치업 미리보기 및 실시간 수정 테이블 */}
        {assignedMatches.length > 0 && (
          <div className="space-y-2.5 pt-2 border-t border-slate-800">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-white flex items-center gap-1.5">
                <span>📋</span> 배정된 코트 & 선수 매치업 ({assignedMatches.length}경기)
              </span>
              <button
                type="button"
                onClick={() => setAssignedMatches([])}
                className="text-[10px] text-red-400 hover:text-red-300 font-bold cursor-pointer"
              >
                전체 초기화
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {assignedMatches.map((m, idx) => (
                <div
                  key={m.id}
                  className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-xs"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <select
                        value={m.courtNumber}
                        onChange={(e) => handleUpdateMatchCourt(m.id, Number(e.target.value))}
                        className="bg-amber-400 text-slate-950 font-black text-[11px] px-2 py-0.5 rounded-lg cursor-pointer"
                      >
                        {[1, 2, 3, 4, 5, 6].map((c) => (
                          <option key={c} value={c}>
                            {c}번 코트
                          </option>
                        ))}
                      </select>
                      <span className="font-bold text-slate-300 text-[11px]">{m.roundName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveMatch(m.id)}
                      className="text-[10px] text-slate-500 hover:text-red-400 font-bold cursor-pointer"
                    >
                      삭제 ✕
                    </button>
                  </div>

                  {/* 각 팀 선수 확인 및 클릭 시 즉시 변경 가능한 드롭다운 */}
                  <div className="grid grid-cols-11 gap-1.5 items-center">
                    <div className="col-span-5 space-y-1">
                      {[0, 1].map((slot) => (
                        <select
                          key={slot}
                          value={m.teamA[slot as 0 | 1]?.id || ''}
                          onChange={(e) =>
                            handleUpdateMatchPlayer(m.id, 'teamA', slot as 0 | 1, e.target.value)
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-emerald-300 font-bold truncate"
                        >
                          {selectedParticipants.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.grade}){p.isGuest ? ' [임의]' : ''}
                            </option>
                          ))}
                        </select>
                      ))}
                    </div>

                    <div className="col-span-1 text-center font-black text-slate-500 text-[10px]">
                      VS
                    </div>

                    <div className="col-span-5 space-y-1">
                      {[0, 1].map((slot) => (
                        <select
                          key={slot}
                          value={m.teamB[slot as 0 | 1]?.id || ''}
                          onChange={(e) =>
                            handleUpdateMatchPlayer(m.id, 'teamB', slot as 0 | 1, e.target.value)
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-amber-300 font-bold truncate"
                        >
                          {selectedParticipants.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.grade}){p.isGuest ? ' [임의]' : ''}
                            </option>
                          ))}
                        </select>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 최종 앱 자동 연동 및 경기 시작 버튼 */}
        <button
          type="button"
          onClick={handleLaunchTournament}
          className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:to-red-600 text-slate-950 font-black rounded-2xl text-sm transition-all shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>🚀</span>
          <span>대회 생성 확정 및 실시간 코트·대진표 자동 연동 시작!</span>
        </button>
      </div>
    </div>
  );
}
