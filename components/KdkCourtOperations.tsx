'use client';
import React, { useState, useEffect } from 'react';
import {
  Player,
  CourtKdkGame,
  KdkStandingRow,
  GRADE_WEIGHTS,
  getPlayerWeight,
  generateCourtKDKGames,
  calculateKdkStandingsWithAgeTiebreak,
} from '../lib/kdk';

export interface KdkCourtState {
  courtNumber: number;
  targetPlayerCount: number; // 코트별 선수 인원 수 (4~8명)
  gameCount: number; // 코트별 게임 수 (최소 2게임 이상, 운영자 설정)
  assignMode: 'AUTO' | 'MANUAL';
  players: Player[];
  games: CourtKdkGame[];
  isFinished: boolean;
}

interface KdkCourtOperationsProps {
  tournamentName: string;
  availablePlayers: any[];
  onSyncCourtsToApp?: (
    syncedCourts: {
      id: number;
      courtNumber: number;
      status: 'playing' | 'completed' | 'waiting';
      teamA: string[];
      teamB: string[];
      teamAWeight?: number;
      teamBWeight?: number;
      skillDiff?: number;
      scoreA: number;
      scoreB: number;
    }[]
  ) => void;
  onAddNewPlayerToClub?: (newPlayer: Player) => void;
}

const GRADE_OPTIONS = ['금배', '은배', '국화', '동배', '개나리', '고령자부', '테린이'];

// 샘플 선수별 기본 나이 매핑 (나이가 없는 기존 회원 데이터 보완용)
const DEFAULT_AGES: Record<string, number> = {
  '김철수': 54,
  '강동원': 45,
  '박민수': 51,
  '정지훈': 43,
  '이영희': 52,
  '한지민': 42,
  '최수진': 48,
  '송중기': 39,
  '조인성': 44,
  '공유': 47,
  '김태희': 45,
  '정우성': 53,
  '전지현': 44,
  '현빈': 43,
};

function normalizePlayer(raw: any, idx: number): Player {
  const ageVal =
    typeof raw.age === 'number' && !isNaN(raw.age)
      ? raw.age
      : DEFAULT_AGES[raw.name] || 40 + ((idx * 3) % 20);
  return {
    id: String(raw.id || `p_${idx}`),
    name: raw.name || `선수${idx + 1}`,
    grade: raw.grade || '은배',
    age: ageVal,
    gender: raw.gender || 'M',
    isGuest: Boolean(raw.isGuest),
  };
}

export default function KdkCourtOperations({
  tournamentName,
  availablePlayers,
  onSyncCourtsToApp,
  onAddNewPlayerToClub,
}: KdkCourtOperationsProps) {
  // 전체 선수 풀 (나이 정보 포함)
  const [playerPool, setPlayerPool] = useState<Player[]>(() =>
    availablePlayers.map((p, i) => normalizePlayer(p, i))
  );

  // 외부 availablePlayers 추가 시 동기화
  useEffect(() => {
    setPlayerPool((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const merged = [...prev];
      availablePlayers.forEach((raw, i) => {
        const np = normalizePlayer(raw, i);
        if (!existingIds.has(np.id)) {
          merged.push(np);
        }
      });
      return merged;
    });
  }, [availablePlayers]);

  // 코트별 KDK 상태 (기본 2개 코트, 각 코트 최소 2게임 이상 시작 — 기본 3게임)
  const [kdkCourts, setKdkCourts] = useState<KdkCourtState[]>(() => {
    const initPool = availablePlayers.map((p, i) => normalizePlayer(p, i));
    const c1Players = initPool.slice(0, 4);
    const c2Players = initPool.slice(4, 8);
    const initialCourts: KdkCourtState[] = [
      {
        courtNumber: 1,
        targetPlayerCount: Math.max(4, c1Players.length),
        gameCount: 2, // 최소 2게임으로 시작 (운영자가 +, -로 자유 증감 가능)
        assignMode: 'AUTO',
        players: c1Players,
        games: c1Players.length >= 4 ? generateCourtKDKGames(1, c1Players, 2) : [],
        isFinished: false,
      },
    ];
    if (c2Players.length >= 4) {
      initialCourts.push({
        courtNumber: 2,
        targetPlayerCount: c2Players.length,
        gameCount: 2,
        assignMode: 'AUTO',
        players: c2Players,
        games: generateCourtKDKGames(2, c2Players, 2),
        isFinished: false,
      });
    }
    return initialCourts;
  });

  // 현재 선택된 코트 탭 번호
  const [selectedCourtNum, setSelectedCourtNum] = useState<number>(1);
  // 코트별 임의 선수 추가 폼 상태
  const [guestName, setGuestName] = useState<string>('');
  const [guestGrade, setGuestGrade] = useState<string>('은배');
  const [guestAge, setGuestAge] = useState<string>('48');

  const activeCourt =
    kdkCourts.find((c) => c.courtNumber === selectedCourtNum) || kdkCourts[0];

  // 앱의 실시간 코트 현황판과 자동 동기화 헬퍼
  const syncToMainApp = (courtsList: KdkCourtState[]) => {
    if (!onSyncCourtsToApp) return;
    const mapped = courtsList.map((c, idx) => {
      // 현재 진행 중인 첫 게임 또는 마지막 완료 게임 표시
      const currentGame =
        c.games.find((g) => !g.completed) || c.games[c.games.length - 1];
      if (!currentGame) {
        return {
          id: idx + 1,
          courtNumber: c.courtNumber,
          status: 'waiting' as const,
          teamA: ['선수 배정 대기', '선수 배정 대기'],
          teamB: ['선수 배정 대기', '선수 배정 대기'],
          scoreA: 0,
          scoreB: 0,
        };
      }
      return {
        id: idx + 1,
        courtNumber: c.courtNumber,
        status: c.isFinished
          ? ('completed' as const)
          : currentGame.completed
          ? ('completed' as const)
          : ('playing' as const),
        teamA: [
          `${currentGame.teamA[0].name} (${currentGame.teamA[0].grade}·${currentGame.teamA[0].age}세)`,
          `${currentGame.teamA[1].name} (${currentGame.teamA[1].grade}·${currentGame.teamA[1].age}세)`,
        ],
        teamB: [
          `${currentGame.teamB[0].name} (${currentGame.teamB[0].grade}·${currentGame.teamB[0].age}세)`,
          `${currentGame.teamB[1].name} (${currentGame.teamB[1].grade}·${currentGame.teamB[1].age}세)`,
        ],
        teamAWeight: currentGame.teamAWeight,
        teamBWeight: currentGame.teamBWeight,
        skillDiff: currentGame.skillDiff,
        scoreA: currentGame.scoreA,
        scoreB: currentGame.scoreB,
      };
    });
    onSyncCourtsToApp(mapped);
  };

  // 특정 코트 상태 업데이트 헬퍼
  const updateCourt = (
    courtNum: number,
    updater: (court: KdkCourtState) => KdkCourtState
  ) => {
    setKdkCourts((prev) => {
      const next = prev.map((c) => (c.courtNumber === courtNum ? updater(c) : c));
      syncToMainApp(next);
      return next;
    });
  };

  // 코트 추가 생성
  const handleAddKdkCourt = () => {
    const nextNum =
      kdkCourts.length > 0
        ? Math.max(...kdkCourts.map((c) => c.courtNumber)) + 1
        : 1;
    // 다른 코트에 아직 배정되지 않은 선수들 우선 추출
    const usedIds = new Set(kdkCourts.flatMap((c) => c.players.map((p) => p.id)));
    const unused = playerPool.filter((p) => !usedIds.has(p.id));
    const initPlayers =
      unused.length >= 4 ? unused.slice(0, 4) : playerPool.slice(0, 4);

    const newCourt: KdkCourtState = {
      courtNumber: nextNum,
      targetPlayerCount: 4,
      gameCount: 2, // 최소 2게임으로 시작
      assignMode: 'AUTO',
      players: initPlayers,
      games:
        initPlayers.length >= 4
          ? generateCourtKDKGames(nextNum, initPlayers, 2)
          : [],
      isFinished: false,
    };

    const next = [...kdkCourts, newCourt];
    setKdkCourts(next);
    setSelectedCourtNum(nextNum);
    syncToMainApp(next);
  };

  // 코트 삭제
  const handleRemoveKdkCourt = (courtNum: number) => {
    if (kdkCourts.length <= 1) {
      alert('최소 1개 이상의 KDK 코트가 유지되어야 합니다.');
      return;
    }
    const next = kdkCourts.filter((c) => c.courtNumber !== courtNum);
    setKdkCourts(next);
    if (selectedCourtNum === courtNum) {
      setSelectedCourtNum(next[0].courtNumber);
    }
    syncToMainApp(next);
  };

  // 코트별 선수 인원 수 선정 (4명, 5명, 6명, 7명, 8명...)
  const handleChangeTargetPlayerCount = (courtNum: number, newCount: number) => {
    const safeCount = Math.max(4, Math.min(12, newCount));
    updateCourt(courtNum, (court) => {
      let nextPlayers = [...court.players];
      if (nextPlayers.length < safeCount) {
        // 다른 코트 미배정 선수 우선 추가 후 부족하면 전체 풀에서 채움
        const currentIds = new Set(nextPlayers.map((p) => p.id));
        const otherUsedIds = new Set(
          kdkCourts
            .filter((c) => c.courtNumber !== courtNum)
            .flatMap((c) => c.players.map((p) => p.id))
        );
        const candidates = [
          ...playerPool.filter((p) => !currentIds.has(p.id) && !otherUsedIds.has(p.id)),
          ...playerPool.filter((p) => !currentIds.has(p.id) && otherUsedIds.has(p.id)),
        ];
        nextPlayers = [...nextPlayers, ...candidates.slice(0, safeCount - nextPlayers.length)];
      } else if (nextPlayers.length > safeCount) {
        nextPlayers = nextPlayers.slice(0, safeCount);
      }

      const nextGames =
        court.assignMode === 'AUTO' && nextPlayers.length >= 4
          ? generateCourtKDKGames(court.courtNumber, nextPlayers, court.gameCount)
          : court.games;

      return {
        ...court,
        targetPlayerCount: safeCount,
        players: nextPlayers,
        games: nextGames,
        isFinished: false,
      };
    });
  };

  // 코트별 게임 수 설정 (최소 2게임 보장, 운영자 자유 설정)
  const handleChangeCourtGameCount = (courtNum: number, newGameCount: number) => {
    const safeGames = Math.max(2, Math.min(12, newGameCount));
    updateCourt(courtNum, (court) => {
      let nextGames: CourtKdkGame[];
      if (court.assignMode === 'AUTO' && court.players.length >= 4) {
        nextGames = generateCourtKDKGames(court.courtNumber, court.players, safeGames);
      } else {
        // 수동모드일 경우 기존 게임 유지하면서 부족분 추가 또는 초과분 제거
        nextGames = [...court.games];
        if (nextGames.length < safeGames && court.players.length >= 4) {
          const extra = generateCourtKDKGames(
            court.courtNumber,
            court.players,
            safeGames - nextGames.length
          );
          extra.forEach((g, idx) => {
            nextGames.push({
              ...g,
              gameNumber: nextGames.length + 1,
              id: `c${court.courtNumber}_g${nextGames.length + 1}_${Date.now()}_${idx}`,
            });
          });
        } else if (nextGames.length > safeGames) {
          nextGames = nextGames.slice(0, safeGames);
        }
      }
      return {
        ...court,
        gameCount: safeGames,
        games: nextGames,
        isFinished: false,
      };
    });
  };

  // 코트에 특정 선수 배정 / 해제 토글
  const handleTogglePlayerInCourt = (courtNum: number, player: Player) => {
    updateCourt(courtNum, (court) => {
      const exists = court.players.some((p) => p.id === player.id);
      const nextPlayers = exists
        ? court.players.filter((p) => p.id !== player.id)
        : [...court.players, player];

      const nextTarget = Math.max(4, nextPlayers.length);
      const nextGames =
        court.assignMode === 'AUTO' && nextPlayers.length >= 4
          ? generateCourtKDKGames(court.courtNumber, nextPlayers, court.gameCount)
          : court.games;

      return {
        ...court,
        targetPlayerCount: nextTarget,
        players: nextPlayers,
        games: nextGames,
        isFinished: false,
      };
    });
  };

  // 코트 내 선수 나이 개별 수정 (동점 시 나이합산 기준)
  const handleUpdatePlayerAge = (playerId: string, newAge: number) => {
    const safeAge = Math.max(10, Math.min(99, newAge || 40));
    setPlayerPool((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, age: safeAge } : p))
    );
    setKdkCourts((prev) =>
      prev.map((c) => ({
        ...c,
        players: c.players.map((p) => (p.id === playerId ? { ...p, age: safeAge } : p)),
        games: c.games.map((g) => ({
          ...g,
          teamA: [
            g.teamA[0].id === playerId ? { ...g.teamA[0], age: safeAge } : g.teamA[0],
            g.teamA[1].id === playerId ? { ...g.teamA[1], age: safeAge } : g.teamA[1],
          ],
          teamB: [
            g.teamB[0].id === playerId ? { ...g.teamB[0], age: safeAge } : g.teamB[0],
            g.teamB[1].id === playerId ? { ...g.teamB[1], age: safeAge } : g.teamB[1],
          ],
        })),
      }))
    );
  };

  // 임의 선수(미가입 회원) 이름 + 급수 + 나이 직접 추가 및 현재 코트 즉시 배치
  const handleAddGuestToActiveCourt = () => {
    const raw = guestName.trim();
    if (!raw) {
      alert('추가할 선수의 이름을 입력해 주세요.');
      return;
    }
    const parsedAge = parseInt(guestAge, 10) || 45;
    const names = raw
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    const newPlayers: Player[] = names.map((name, idx) => ({
      id: `kdk_guest_${Date.now()}_${idx}`,
      name,
      grade: guestGrade,
      age: parsedAge,
      gender: 'M',
      isGuest: true,
    }));

    setPlayerPool((prev) => [...prev, ...newPlayers]);
    if (onAddNewPlayerToClub) {
      newPlayers.forEach((np) => onAddNewPlayerToClub(np));
    }

    if (activeCourt) {
      updateCourt(activeCourt.courtNumber, (court) => {
        const nextPlayers = [...court.players, ...newPlayers];
        const nextGames =
          court.assignMode === 'AUTO' && nextPlayers.length >= 4
            ? generateCourtKDKGames(court.courtNumber, nextPlayers, court.gameCount)
            : court.games;
        return {
          ...court,
          targetPlayerCount: Math.max(4, nextPlayers.length),
          players: nextPlayers,
          games: nextGames,
          isFinished: false,
        };
      });
    }
    setGuestName('');
  };

  // 코트별 KDK 실력균등 자동 편성 실행
  const handleRunCourtAutoBalance = (courtNum: number) => {
    updateCourt(courtNum, (court) => {
      if (court.players.length < 4) {
        alert(`${courtNum}번 코트에 최소 4명 이상의 선수를 배정해 주세요.`);
        return court;
      }
      const generated = generateCourtKDKGames(
        court.courtNumber,
        court.players,
        Math.max(2, court.gameCount)
      );
      return {
        ...court,
        assignMode: 'AUTO',
        games: generated,
        isFinished: false,
      };
    });
  };

  // 수동모드: 특정 게임의 팀 선수 직접 변경
  const handleManualChangeGamePlayer = (
    courtNum: number,
    gameId: string,
    team: 'teamA' | 'teamB',
    slotIdx: 0 | 1,
    newPlayerId: string
  ) => {
    updateCourt(courtNum, (court) => {
      const chosen =
        court.players.find((p) => p.id === newPlayerId) ||
        playerPool.find((p) => p.id === newPlayerId);
      if (!chosen) return court;

      const nextGames = court.games.map((g) => {
        if (g.id !== gameId) return g;
        const nextTeamA: [Player, Player] = [g.teamA[0], g.teamA[1]];
        const nextTeamB: [Player, Player] = [g.teamB[0], g.teamB[1]];
        if (team === 'teamA') nextTeamA[slotIdx] = chosen;
        else nextTeamB[slotIdx] = chosen;

        const wA = getPlayerWeight(nextTeamA[0].grade) + getPlayerWeight(nextTeamA[1].grade);
        const wB = getPlayerWeight(nextTeamB[0].grade) + getPlayerWeight(nextTeamB[1].grade);
        const activeIds = new Set([
          nextTeamA[0].id,
          nextTeamA[1].id,
          nextTeamB[0].id,
          nextTeamB[1].id,
        ]);
        const resting = court.players.filter((p) => !activeIds.has(p.id));

        return {
          ...g,
          teamA: nextTeamA,
          teamB: nextTeamB,
          teamAWeight: wA,
          teamBWeight: wB,
          skillDiff: Math.abs(wA - wB),
          resting,
        };
      });

      return { ...court, games: nextGames };
    });
  };

  // 게임 스코어 조절 (- / +)
  const handleUpdateGameScore = (
    courtNum: number,
    gameId: string,
    deltaA: number,
    deltaB: number
  ) => {
    updateCourt(courtNum, (court) => {
      const nextGames = court.games.map((g) => {
        if (g.id !== gameId) return g;
        return {
          ...g,
          scoreA: Math.max(0, g.scoreA + deltaA),
          scoreB: Math.max(0, g.scoreB + deltaB),
        };
      });
      return { ...court, games: nextGames };
    });
  };

  // 개별 게임 완료 토글 (모든 게임이 완료되면 코트 자동 종료 및 1·2·3등 자동집계!)
  const handleToggleGameComplete = (courtNum: number, gameId: string) => {
    updateCourt(courtNum, (court) => {
      const nextGames = court.games.map((g) =>
        g.id === gameId ? { ...g, completed: !g.completed } : g
      );
      const allDone = nextGames.length >= 2 && nextGames.every((g) => g.completed);
      return {
        ...court,
        games: nextGames,
        isFinished: allDone,
      };
    });
  };

  // 코트 전체 경기 종료 및 1·2·3등 즉시 자동 집계 버튼
  const handleFinishCourtAndAggregate = (courtNum: number) => {
    updateCourt(courtNum, (court) => {
      const completedGames = court.games.map((g) => ({ ...g, completed: true }));
      return {
        ...court,
        games: completedGames,
        isFinished: true,
      };
    });
  };

  // 현재 활성 코트 실시간 순위 (동점 시 나이합산 자동 적용)
  const activeCourtStandings: KdkStandingRow[] = activeCourt
    ? calculateKdkStandingsWithAgeTiebreak(activeCourt.players, activeCourt.games)
    : [];

  // 전체 코트 통합 종합 순위
  const allCourtsPlayers: Player[] = Array.from(
    new Map(kdkCourts.flatMap((c) => c.players).map((p) => [p.id, p])).values()
  );
  const allCourtsGames: CourtKdkGame[] = kdkCourts.flatMap((c) => c.games);
  const overallStandings: KdkStandingRow[] = calculateKdkStandingsWithAgeTiebreak(
    allCourtsPlayers,
    allCourtsGames
  );

  const completedGamesCount = activeCourt
    ? activeCourt.games.filter((g) => g.completed).length
    : 0;

  return (
    <div className="space-y-4">
      {/* 상단 KDK 코트별 운영 헤더 */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-amber-950/60 p-3.5 rounded-2xl border border-emerald-500/30 shadow-lg space-y-2">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
              <span>🔄</span> KDK 코트별 운영 & 실력균등 자동/수동 배정
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {tournamentName} · 코트별 인원·게임수(최소 2게임) 설정 & 종료 시 1·2·3등 자동집계(동점 시 나이합산)
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddKdkCourt}
            className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-[11px] shadow-md cursor-pointer shrink-0"
          >
            + 코트 추가
          </button>
        </div>

        {/* 코트 선택 탭 바 */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {kdkCourts.map((c) => {
            const isActive = activeCourt && c.courtNumber === activeCourt.courtNumber;
            const doneCount = c.games.filter((g) => g.completed).length;
            return (
              <div key={c.courtNumber} className="flex items-center">
                <button
                  type="button"
                  onClick={() => setSelectedCourtNum(c.courtNumber)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black border transition flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span>🏟️ {c.courtNumber}번 코트</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {c.players.length}명·{doneCount}/{c.gameCount}G
                  </span>
                  {c.isFinished && <span>🏆</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {activeCourt && (
        <div className="space-y-4">
          {/* ========================================================== */}
          {/* 1. 선택 코트 설정: 인원 선정 + 게임 수(최소 2게임) + 자동/수동 모드 */}
          {/* ========================================================== */}
          <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3.5">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                <span>⚙️</span> {activeCourt.courtNumber}번 코트 KDK 운영 설정
              </span>
              {kdkCourts.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveKdkCourt(activeCourt.courtNumber)}
                  className="text-[10px] px-2 py-0.5 rounded-lg bg-red-950/70 text-red-300 border border-red-500/30 font-bold cursor-pointer"
                >
                  코트 삭제
                </button>
              )}
            </div>

            {/* 코트별 선수 인원 수 선정 + 코트별 게임 수 설정 (최소 2게임 보장) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 코트별 선수 인원 선정 */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-300">👥 코트별 선수 인원 선정</span>
                  <span className="text-xs font-black text-emerald-400">
                    {activeCourt.players.length}명 배정
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[4, 5, 6, 7, 8].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleChangeTargetPlayerCount(activeCourt.courtNumber, cnt)}
                      className={`py-1.5 rounded-lg text-[11px] font-black border transition cursor-pointer ${
                        activeCourt.players.length === cnt
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {cnt}명
                    </button>
                  ))}
                </div>
              </div>

              {/* 코트별 게임 수 설정 (최소 2게임부터 운영자 자유 설정) */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-300">
                    🎾 코트별 게임 수 <span className="text-amber-400">(최소 2게임~)</span>
                  </span>
                  <span className="text-xs font-black text-amber-400">
                    총 {activeCourt.gameCount}게임
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    disabled={activeCourt.gameCount <= 2}
                    onClick={() =>
                      handleChangeCourtGameCount(
                        activeCourt.courtNumber,
                        activeCourt.gameCount - 1
                      )
                    }
                    className="w-9 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-black text-sm border border-slate-700 cursor-pointer"
                  >
                    －
                  </button>
                  <div className="flex gap-1 flex-1 justify-center">
                    {[2, 3, 4, 5, 6].map((gNum) => (
                      <button
                        key={gNum}
                        type="button"
                        onClick={() =>
                          handleChangeCourtGameCount(activeCourt.courtNumber, gNum)
                        }
                        className={`px-2 py-1 rounded-lg text-[11px] font-black border cursor-pointer ${
                          activeCourt.gameCount === gNum
                            ? 'bg-amber-400 text-slate-950 border-amber-300'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        {gNum}G
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleChangeCourtGameCount(
                        activeCourt.courtNumber,
                        activeCourt.gameCount + 1
                      )
                    }
                    className="w-9 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-black text-sm border border-slate-700 cursor-pointer"
                  >
                    ＋
                  </button>
                </div>
              </div>
            </div>

            {/* 자동모드 vs 수동모드 전환 버튼 */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => handleRunCourtAutoBalance(activeCourt.courtNumber)}
                className={`py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeCourt.assignMode === 'AUTO'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>⚖️</span>
                <span>실력균등 자동모드</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  updateCourt(activeCourt.courtNumber, (c) => ({
                    ...c,
                    assignMode: 'MANUAL',
                  }))
                }
                className={`py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeCourt.assignMode === 'MANUAL'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🖐️</span>
                <span>수동모드 (직접배치)</span>
              </button>
            </div>

            {/* 코트별 선수 배정 목록 (가입/미가입 선택 + 나이 수정 + 임의 선수 추가) */}
            <div className="space-y-2.5 pt-1">
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-white">
                  🎾 {activeCourt.courtNumber}번 코트 배정 선수 선택 (클릭으로 배정/해제)
                </span>
                <span className="text-[10px] text-slate-400">
                  나이 입력값은 동점 시 나이합산 순위 기준에 반영
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto p-0.5">
                {playerPool.map((p) => {
                  const isInCourt = activeCourt.players.some((cp) => cp.id === p.id);
                  const w = getPlayerWeight(p.grade);
                  return (
                    <div
                      key={p.id}
                      className={`p-2 rounded-xl border flex items-center justify-between gap-1 transition ${
                        isInCourt
                          ? 'bg-emerald-950/70 border-emerald-400 text-white'
                          : 'bg-slate-950/70 border-slate-800 text-slate-400'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleTogglePlayerInCourt(activeCourt.courtNumber, p)}
                        className="flex-1 text-left truncate cursor-pointer"
                      >
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold truncate">{p.name}</span>
                          <span className="text-[9px] px-1 rounded bg-slate-800 text-amber-300">
                            {p.grade}({w})
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-400">
                          {p.isGuest ? '미가입/임의' : '가입회원'}
                        </span>
                      </button>

                      {/* 나이 수정 입력 (동점 시 나이합산 계산용) */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <input
                          type="number"
                          min={10}
                          max={99}
                          value={p.age || 45}
                          onChange={(e) =>
                            handleUpdatePlayerAge(p.id, parseInt(e.target.value, 10))
                          }
                          title="선수 나이 (동점 시 나이합산 기준)"
                          className="w-11 px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px] text-center text-amber-300 font-bold"
                        />
                        <span className="text-[9px] text-slate-400">세</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 임의 선수(이름·급수·나이) 코트 바로 추가 */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-amber-500/30 grid grid-cols-12 gap-1.5 items-center">
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddGuestToActiveCourt();
                    }
                  }}
                  placeholder="임의 선수 이름"
                  className="col-span-4 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                />
                <select
                  value={guestGrade}
                  onChange={(e) => setGuestGrade(e.target.value)}
                  className="col-span-3 px-1.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-[11px] text-amber-300 font-bold"
                >
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}({GRADE_WEIGHTS[g] || 6})
                    </option>
                  ))}
                </select>
                <div className="col-span-2 flex items-center gap-0.5">
                  <input
                    type="number"
                    min={10}
                    max={99}
                    value={guestAge}
                    onChange={(e) => setGuestAge(e.target.value)}
                    placeholder="나이"
                    className="w-full px-1.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-center text-white"
                  />
                  <span className="text-[10px] text-slate-400">세</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddGuestToActiveCourt}
                  className="col-span-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-[11px] cursor-pointer"
                >
                  + 코트추가
                </button>
              </div>
            </div>

            {activeCourt.assignMode === 'AUTO' && (
              <button
                type="button"
                onClick={() => handleRunCourtAutoBalance(activeCourt.courtNumber)}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-xs shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>⚖️</span>
                <span>
                  {activeCourt.courtNumber}번 코트 ({activeCourt.players.length}명 · {activeCourt.gameCount}게임) 실력균등 자동 재편성
                </span>
              </button>
            )}
          </div>

          {/* ========================================================== */}
          {/* 2. 코트별 게임 진행 및 스코어 입력 (자동/수동 편집 + 경기 종료) */}
          {/* ========================================================== */}
          <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <div>
                <h4 className="text-xs font-black text-emerald-400">
                  🎾 {activeCourt.courtNumber}번 코트 경기 진행 ({completedGamesCount}/{activeCourt.games.length} 게임 완료)
                </h4>
                <p className="text-[10px] text-slate-400">
                  {activeCourt.assignMode === 'MANUAL'
                    ? '수동모드: 각 게임의 출전 선수를 드롭다운으로 직접 변경할 수 있습니다.'
                    : '자동모드: 인원수에 맞춰 실력 차이가 없도록 균등 편성되었습니다.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleFinishCourtAndAggregate(activeCourt.courtNumber)}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-[11px] shadow-md cursor-pointer"
              >
                🏁 코트 경기 종료·자동집계
              </button>
            </div>

            <div className="space-y-2.5">
              {activeCourt.games.map((g) => {
                const ageSumA = (g.teamA[0].age || 40) + (g.teamA[1].age || 40);
                const ageSumB = (g.teamB[0].age || 40) + (g.teamB[1].age || 40);

                return (
                  <div
                    key={g.id}
                    className={`bg-slate-950 p-3 rounded-xl border space-y-2.5 ${
                      g.completed ? 'border-emerald-500/40' : 'border-slate-800'
                    }`}
                  >
                    <div className="flex flex-wrap justify-between items-center gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-lg bg-amber-400/15 text-amber-300 border border-amber-400/30 font-black text-[10px]">
                          제 {g.gameNumber} 게임
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold border ${
                            g.skillDiff <= 2
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          ⚖️ 전력 {g.teamAWeight} vs {g.teamBWeight} (차이 {g.skillDiff})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleGameComplete(activeCourt.courtNumber, g.id)}
                        className={`text-[10px] px-2.5 py-0.5 rounded-lg font-black border cursor-pointer transition ${
                          g.completed
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {g.completed ? '✓ 경기완료' : '경기완료 처리'}
                      </button>
                    </div>

                    {/* 팀 배치 (수동모드면 드롭다운 직접 배치, 자동모드면 깔끔한 표시) */}
                    {activeCourt.assignMode === 'MANUAL' ? (
                      <div className="grid grid-cols-11 gap-1.5 items-center">
                        <div className="col-span-5 space-y-1">
                          {[0, 1].map((slot) => (
                            <select
                              key={slot}
                              value={g.teamA[slot as 0 | 1].id}
                              onChange={(e) =>
                                handleManualChangeGamePlayer(
                                  activeCourt.courtNumber,
                                  g.id,
                                  'teamA',
                                  slot as 0 | 1,
                                  e.target.value
                                )
                              }
                              className="w-full bg-slate-900 border border-emerald-500/30 rounded-lg px-1.5 py-1 text-[11px] text-emerald-300 font-bold"
                            >
                              {activeCourt.players.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.grade}·{p.age}세)
                                </option>
                              ))}
                            </select>
                          ))}
                        </div>
                        <div className="col-span-1 text-center text-[10px] font-black text-slate-500">
                          VS
                        </div>
                        <div className="col-span-5 space-y-1">
                          {[0, 1].map((slot) => (
                            <select
                              key={slot}
                              value={g.teamB[slot as 0 | 1].id}
                              onChange={(e) =>
                                handleManualChangeGamePlayer(
                                  activeCourt.courtNumber,
                                  g.id,
                                  'teamB',
                                  slot as 0 | 1,
                                  e.target.value
                                )
                              }
                              className="w-full bg-slate-900 border border-amber-500/30 rounded-lg px-1.5 py-1 text-[11px] text-amber-300 font-bold"
                            >
                              {activeCourt.players.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.grade}·{p.age}세)
                                </option>
                              ))}
                            </select>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex-1 text-left">
                          <p className="font-bold text-emerald-300 truncate">
                            {g.teamA[0].name} / {g.teamA[1].name}
                          </p>
                          <span className="text-[9px] text-slate-400">
                            나이합 {ageSumA}세 ({g.teamA[0].age}+{g.teamA[1].age})
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 mx-2 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateGameScore(activeCourt.courtNumber, g.id, -1, 0)
                            }
                            className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                          >
                            -
                          </button>
                          <span className="text-sm font-black text-white w-4 text-center">
                            {g.scoreA}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateGameScore(activeCourt.courtNumber, g.id, 1, 0)
                            }
                            className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                          >
                            +
                          </button>
                          <span className="text-[10px] font-black text-slate-500">:</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateGameScore(activeCourt.courtNumber, g.id, 0, -1)
                            }
                            className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                          >
                            -
                          </button>
                          <span className="text-sm font-black text-white w-4 text-center">
                            {g.scoreB}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateGameScore(activeCourt.courtNumber, g.id, 0, 1)
                            }
                            className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        <div className="flex-1 text-right">
                          <p className="font-bold text-amber-300 truncate">
                            {g.teamB[0].name} / {g.teamB[1].name}
                          </p>
                          <span className="text-[9px] text-slate-400">
                            나이합 {ageSumB}세 ({g.teamB[0].age}+{g.teamB[1].age})
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 수동모드일 때도 스코어 입력 바 표시 */}
                    {activeCourt.assignMode === 'MANUAL' && (
                      <div className="flex items-center justify-center gap-2 bg-slate-900 py-1.5 px-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] font-bold text-emerald-400">TEAM A</span>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateGameScore(activeCourt.courtNumber, g.id, -1, 0)
                          }
                          className="w-6 h-6 rounded bg-slate-800 text-white font-bold cursor-pointer"
                        >
                          -
                        </button>
                        <span className="text-sm font-black text-white w-5 text-center">
                          {g.scoreA}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateGameScore(activeCourt.courtNumber, g.id, 1, 0)
                          }
                          className="w-6 h-6 rounded bg-slate-800 text-white font-bold cursor-pointer"
                        >
                          +
                        </button>
                        <span className="text-xs font-black text-slate-500 mx-1">:</span>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateGameScore(activeCourt.courtNumber, g.id, 0, -1)
                          }
                          className="w-6 h-6 rounded bg-slate-800 text-white font-bold cursor-pointer"
                        >
                          -
                        </button>
                        <span className="text-sm font-black text-white w-5 text-center">
                          {g.scoreB}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateGameScore(activeCourt.courtNumber, g.id, 0, 1)
                          }
                          className="w-6 h-6 rounded bg-slate-800 text-white font-bold cursor-pointer"
                        >
                          +
                        </button>
                        <span className="text-[10px] font-bold text-amber-400">TEAM B</span>
                      </div>
                    )}

                    {g.resting && g.resting.length > 0 && (
                      <div className="text-[10px] text-slate-400 bg-slate-900/70 px-2.5 py-1 rounded-lg border border-slate-800/80">
                        ☕ 휴식 대기자: {g.resting.map((rp) => `${rp.name}(${rp.grade})`).join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================== */}
          {/* 3. 코트별 자동 집계 1등·2등·3등 시상대 & 상세 순위표 (동점 시 나이합산) */}
          {/* ========================================================== */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/30 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <div>
                <h4 className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                  <span>🏆</span> {activeCourt.courtNumber}번 코트 자동 집계 순위 (1등 · 2등 · 3등)
                </h4>
                <p className="text-[10px] text-slate-400">
                  정렬기준: 승수 ➔ 득실차 ➔ 총득점 ➔ <strong className="text-amber-300">동점 시 나이합산 우대</strong>
                </p>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-black border ${
                  activeCourt.isFinished
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
              >
                {activeCourt.isFinished ? '🏁 최종 집계 확정' : '실시간 자동집계'}
              </span>
            </div>

            {/* 1등 / 2등 / 3등 메달 포디움 카드 */}
            {activeCourtStandings.length >= 3 && (
              <div className="grid grid-cols-3 gap-2">
                {/* 1등 */}
                <div className="bg-gradient-to-b from-amber-500/25 to-slate-950 p-3 rounded-2xl border border-amber-400/60 text-center space-y-1 shadow-lg">
                  <span className="text-xl block">🥇</span>
                  <span className="text-[10px] font-black text-amber-300 block">1등 (우승)</span>
                  <p className="text-xs font-black text-white truncate">
                    {activeCourtStandings[0].name}
                  </p>
                  <p className="text-[10px] text-emerald-300 font-bold">
                    {activeCourtStandings[0].wins}승 · 득실{' '}
                    {activeCourtStandings[0].pointDiff >= 0
                      ? `+${activeCourtStandings[0].pointDiff}`
                      : activeCourtStandings[0].pointDiff}
                  </p>
                  <p className="text-[9px] text-amber-200">
                    나이합 {activeCourtStandings[0].ageSumWithPartners}세 ({activeCourtStandings[0].age}세)
                  </p>
                </div>

                {/* 2등 */}
                <div className="bg-gradient-to-b from-slate-400/20 to-slate-950 p-3 rounded-2xl border border-slate-400/50 text-center space-y-1 shadow-md">
                  <span className="text-xl block">🥈</span>
                  <span className="text-[10px] font-black text-slate-300 block">2등 (준우승)</span>
                  <p className="text-xs font-black text-white truncate">
                    {activeCourtStandings[1].name}
                  </p>
                  <p className="text-[10px] text-emerald-300 font-bold">
                    {activeCourtStandings[1].wins}승 · 득실{' '}
                    {activeCourtStandings[1].pointDiff >= 0
                      ? `+${activeCourtStandings[1].pointDiff}`
                      : activeCourtStandings[1].pointDiff}
                  </p>
                  <p className="text-[9px] text-slate-300">
                    나이합 {activeCourtStandings[1].ageSumWithPartners}세 ({activeCourtStandings[1].age}세)
                  </p>
                </div>

                {/* 3등 */}
                <div className="bg-gradient-to-b from-orange-600/20 to-slate-950 p-3 rounded-2xl border border-orange-500/50 text-center space-y-1 shadow-md">
                  <span className="text-xl block">🥉</span>
                  <span className="text-[10px] font-black text-orange-300 block">3등 (입상)</span>
                  <p className="text-xs font-black text-white truncate">
                    {activeCourtStandings[2].name}
                  </p>
                  <p className="text-[10px] text-emerald-300 font-bold">
                    {activeCourtStandings[2].wins}승 · 득실{' '}
                    {activeCourtStandings[2].pointDiff >= 0
                      ? `+${activeCourtStandings[2].pointDiff}`
                      : activeCourtStandings[2].pointDiff}
                  </p>
                  <p className="text-[9px] text-orange-200">
                    나이합 {activeCourtStandings[2].ageSumWithPartners}세 ({activeCourtStandings[2].age}세)
                  </p>
                </div>
              </div>
            )}

            {/* 코트별 상세 순위 테이블 */}
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800 text-[10px]">
                    <th className="py-1.5">순위</th>
                    <th className="py-1.5 text-left px-2">선수(급수·나이)</th>
                    <th className="py-1.5">승-패</th>
                    <th className="py-1.5">득실</th>
                    <th className="py-1.5">득점</th>
                    <th className="py-1.5 text-amber-400">나이합산</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {activeCourtStandings.map((s) => (
                    <tr
                      key={s.playerId}
                      className={s.rank <= 3 ? 'bg-amber-400/5 font-bold' : ''}
                    >
                      <td className="py-2">
                        {s.rank === 1
                          ? '🥇 1등'
                          : s.rank === 2
                          ? '🥈 2등'
                          : s.rank === 3
                          ? '🥉 3등'
                          : `${s.rank}위`}
                      </td>
                      <td className="py-2 text-left px-2 text-white">
                        <div>
                          {s.name}{' '}
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({s.grade}·{s.age}세)
                          </span>
                        </div>
                        {s.tieBreakApplied && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                            ⚖️ {s.tieBreakReason}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-emerald-400">
                        {s.wins}승 {s.losses}패
                      </td>
                      <td className="py-2 text-slate-300">
                        {s.pointDiff >= 0 ? `+${s.pointDiff}` : s.pointDiff}
                      </td>
                      <td className="py-2 text-white font-bold">{s.pointsFor}</td>
                      <td className="py-2 font-black text-amber-400">
                        {s.ageSumWithPartners}세
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================== */}
          {/* 4. 전체 코트 통합 최종 종합 순위 (1등 · 2등 · 3등) */}
          {/* ========================================================== */}
          {kdkCourts.length > 1 && overallStandings.length >= 3 && (
            <div className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-2">
              <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                <span className="text-xs font-black text-emerald-300">
                  🌐 전체 코트 통합 종합 순위 TOP 3 (동점 시 나이합산)
                </span>
                <span className="text-[10px] text-slate-400">
                  총 {kdkCourts.length}개 코트 합산
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {overallStandings.slice(0, 3).map((row, idx) => (
                  <div
                    key={row.playerId}
                    className="bg-slate-950 p-2 rounded-xl border border-slate-800"
                  >
                    <span className="text-sm block">
                      {idx === 0 ? '🥇 1등' : idx === 1 ? '🥈 2등' : '🥉 3등'}
                    </span>
                    <p className="font-black text-white truncate mt-0.5">{row.name}</p>
                    <p className="text-[10px] text-emerald-400">
                      {row.wins}승 (득실 {row.pointDiff >= 0 ? `+${row.pointDiff}` : row.pointDiff})
                    </p>
                    <p className="text-[9px] text-amber-300">
                      나이합 {row.ageSumWithPartners}세
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
