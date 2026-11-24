'use client';
import React, { useState, useEffect } from 'react';
import {
  Player,
  CourtKdkGame,
  KdkStandingRow,
  KdkAssignMode,
  GRADE_WEIGHTS,
  getPlayerExperienceYears,
  getCompositeSkillScore,
  calculateRequiredCourtGames,
  distributePlayersSeedFirstToCourts,
  generateCourtKDKGames,
  calculateKdkStandingsWithAgeTiebreak,
} from '../lib/kdk';

export interface KdkCourtState {
  courtNumber: number;
  targetPlayerCount: number; // 코트별 선수 인원 수 (최소 4명 ~ 최대 20명, 관리자 지정)
  minGamesPerPlayer: number; // 참여인원 1인당 필수 최소 게임 수 (최소 2게임~, 운영자 설정)
  gameCount: number; // 1인 필수 최소 게임 수 보장을 위해 자동 산출된 코트 총 경기 수
  assignMode: KdkAssignMode; // 'AUTO'(실력균등 자동) | 'SEED_AUTO'(실력자 시드우선 자동) | 'MANUAL'(수동)
  seedPlayerIds: string[]; // 코트별 실력자 우선 시드 선수 ID 목록
  players: Player[];
  games: CourtKdkGame[];
  isFinished: boolean;
}

const MIN_COURT_PLAYERS = 4;
const MAX_COURT_PLAYERS = 20;

interface KdkCourtOperationsProps {
  tournamentName: string;
  availablePlayers: any[];
  isAdmin?: boolean;
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

// 샘플 선수별 기본 구력(년) 매핑
const DEFAULT_EXPERIENCES: Record<string, number> = {
  '김철수': 12,
  '강동원': 9,
  '박민수': 7,
  '정지훈': 5,
  '이영희': 8,
  '한지민': 6,
  '최수진': 3,
  '송중기': 4,
  '조인성': 7,
  '공유': 10,
  '김태희': 1,
  '정우성': 8,
  '전지현': 7,
  '현빈': 5,
};

function normalizePlayer(raw: any, idx: number): Player {
  const ageVal =
    typeof raw.age === 'number' && !isNaN(raw.age)
      ? raw.age
      : DEFAULT_AGES[raw.name] || 40 + ((idx * 3) % 20);
  const gradeVal = raw.grade || '은배';
  const expVal =
    typeof raw.experienceYears === 'number' && !isNaN(raw.experienceYears)
      ? raw.experienceYears
      : DEFAULT_EXPERIENCES[raw.name] ?? getPlayerExperienceYears({ grade: gradeVal });
  return {
    id: String(raw.id || `p_${idx}`),
    name: raw.name || `선수${idx + 1}`,
    grade: gradeVal,
    age: ageVal,
    experienceYears: expVal,
    isSeed: Boolean(raw.isSeed),
    gender: raw.gender || 'M',
    isGuest: Boolean(raw.isGuest),
  };
}

function getDefaultTopSeeds(players: Player[]): string[] {
  const sorted = [...players].sort(
    (a, b) => getCompositeSkillScore(b) - getCompositeSkillScore(a)
  );
  return sorted.slice(0, Math.min(2, sorted.length)).map((p) => p.id);
}

function rebuildGamesForCourt(
  courtNumber: number,
  players: Player[],
  minGamesPerPlayer: number,
  assignMode: KdkAssignMode,
  seedPlayerIds: string[]
): { gameCount: number; games: CourtKdkGame[] } {
  const safeMin = Math.max(2, Math.min(12, Math.floor(minGamesPerPlayer || 2)));
  const requiredGames = calculateRequiredCourtGames(players.length, safeMin);
  if (players.length < 4) {
    return { gameCount: requiredGames, games: [] };
  }
  const games = generateCourtKDKGames(courtNumber, players, safeMin, {
    minGamesPerPlayer: safeMin,
    assignMode,
    seedPlayerIds,
  });
  return { gameCount: games.length, games };
}

export default function KdkCourtOperations({
  tournamentName,
  availablePlayers,
  isAdmin = false,
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

  // 코트별 KDK 상태 (기본 2개 코트, 참여인원 1인당 필수 최소 2게임 이상 보장)
  const [kdkCourts, setKdkCourts] = useState<KdkCourtState[]>(() => {
    const initPool = availablePlayers.map((p, i) => normalizePlayer(p, i));
    const c1Players = initPool.slice(0, 4);
    const c2Players = initPool.slice(4, 8);
    const c1Seeds = getDefaultTopSeeds(c1Players);
    const c1Built = rebuildGamesForCourt(1, c1Players, 2, 'AUTO', c1Seeds);
    const initialCourts: KdkCourtState[] = [
      {
        courtNumber: 1,
        targetPlayerCount: Math.max(4, c1Players.length),
        minGamesPerPlayer: 2, // 참여인원 1인 필수 최소 게임 수
        gameCount: c1Built.gameCount,
        assignMode: 'AUTO',
        seedPlayerIds: c1Seeds,
        players: c1Players,
        games: c1Built.games,
        isFinished: false,
      },
    ];
    if (c2Players.length >= 4) {
      const c2Seeds = getDefaultTopSeeds(c2Players);
      const c2Built = rebuildGamesForCourt(2, c2Players, 2, 'AUTO', c2Seeds);
      initialCourts.push({
        courtNumber: 2,
        targetPlayerCount: c2Players.length,
        minGamesPerPlayer: 2,
        gameCount: c2Built.gameCount,
        assignMode: 'AUTO',
        seedPlayerIds: c2Seeds,
        players: c2Players,
        games: c2Built.games,
        isFinished: false,
      });
    }
    return initialCourts;
  });

  // 현재 선택된 코트 탭 번호
  const [selectedCourtNum, setSelectedCourtNum] = useState<number>(1);
  // 코트별 임의 선수 추가 폼 상태 (이름 + 등급 + 구력 + 나이)
  const [guestName, setGuestName] = useState<string>('');
  const [guestGrade, setGuestGrade] = useState<string>('은배');
  const [guestExp, setGuestExp] = useState<string>('5');
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

  // 코트 추가 생성 (관리자 전용)
  const handleAddKdkCourt = () => {
    if (!isAdmin) return;
    const nextNum =
      kdkCourts.length > 0
        ? Math.max(...kdkCourts.map((c) => c.courtNumber)) + 1
        : 1;
    // 다른 코트에 아직 배정되지 않은 선수들 우선 추출
    const usedIds = new Set(kdkCourts.flatMap((c) => c.players.map((p) => p.id)));
    const unused = playerPool.filter((p) => !usedIds.has(p.id));
    const initPlayers =
      unused.length >= 4 ? unused.slice(0, 4) : playerPool.slice(0, 4);

    const initSeeds = getDefaultTopSeeds(initPlayers);
    const initBuilt = rebuildGamesForCourt(nextNum, initPlayers, 2, 'AUTO', initSeeds);
    const newCourt: KdkCourtState = {
      courtNumber: nextNum,
      targetPlayerCount: 4,
      minGamesPerPlayer: 2,
      gameCount: initBuilt.gameCount,
      assignMode: 'AUTO',
      seedPlayerIds: initSeeds,
      players: initPlayers,
      games: initBuilt.games,
      isFinished: false,
    };

    const next = [...kdkCourts, newCourt];
    setKdkCourts(next);
    setSelectedCourtNum(nextNum);
    syncToMainApp(next);
  };

  // 전체 코트 실력자 우선 시드 배정 후 나머지 인원 자동 균등 배정 (관리자 전용)
  const handleDistributeAllCourtsSeedFirst = () => {
    if (!isAdmin) return;
    if (playerPool.length < 4) {
      alert('시드 우선 자동배정을 진행하려면 최소 4명 이상의 선수가 필요합니다.');
      return;
    }
    const courtNumbers = kdkCourts.map((c) => c.courtNumber);
    const distributed = distributePlayersSeedFirstToCourts(playerPool, courtNumbers, 2);

    const nextCourts: KdkCourtState[] = kdkCourts.map((c) => {
      const bucket = distributed.find((b) => b.courtNumber === c.courtNumber);
      const nextPlayers = bucket && bucket.players.length >= 4 ? bucket.players : c.players;
      const nextSeeds =
        bucket && bucket.seedPlayerIds.length > 0
          ? bucket.seedPlayerIds
          : getDefaultTopSeeds(nextPlayers);
      const built = rebuildGamesForCourt(
        c.courtNumber,
        nextPlayers,
        c.minGamesPerPlayer,
        'SEED_AUTO',
        nextSeeds
      );
      return {
        ...c,
        targetPlayerCount: Math.max(MIN_COURT_PLAYERS, Math.min(MAX_COURT_PLAYERS, nextPlayers.length)),
        assignMode: 'SEED_AUTO',
        seedPlayerIds: nextSeeds,
        players: nextPlayers,
        gameCount: built.gameCount,
        games: built.games,
        isFinished: false,
      };
    });

    setKdkCourts(nextCourts);
    syncToMainApp(nextCourts);
    alert(
      `🌟 전체 ${nextCourts.length}개 코트에 종합 실력(등급+구력+나이) 최상위 시드를 우선 배정하고 나머지 인원을 자동 균등 배치했습니다!`
    );
  };

  // 코트 삭제 (관리자 전용)
  const handleRemoveKdkCourt = (courtNum: number) => {
    if (!isAdmin) return;
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

  // 코트별 참여인원 지정 (관리자 전용 · 최소 4명 ~ 최대 20명)
  const handleChangeTargetPlayerCount = (courtNum: number, newCount: number) => {
    if (!isAdmin) return;
    const safeCount = Math.max(MIN_COURT_PLAYERS, Math.min(MAX_COURT_PLAYERS, newCount));
    updateCourt(courtNum, (court) => {
      let nextPlayers = [...court.players];
      if (nextPlayers.length < safeCount) {
        // 다른 코트 미배정 선수 우선 추가 후 부족하면 전체 풀에서 채움 (최대 20명)
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
        nextPlayers = [
          ...nextPlayers,
          ...candidates.slice(0, safeCount - nextPlayers.length),
        ].slice(0, MAX_COURT_PLAYERS);
      } else if (nextPlayers.length > safeCount) {
        nextPlayers = nextPlayers.slice(0, safeCount);
      }

      const validSeeds = court.seedPlayerIds.filter((id) =>
        nextPlayers.some((p) => p.id === id)
      );
      const nextSeeds = validSeeds.length > 0 ? validSeeds : getDefaultTopSeeds(nextPlayers);
      const requiredGames = calculateRequiredCourtGames(
        nextPlayers.length,
        court.minGamesPerPlayer
      );
      const nextBuilt =
        court.assignMode !== 'MANUAL' && nextPlayers.length >= 4
          ? rebuildGamesForCourt(
              court.courtNumber,
              nextPlayers,
              court.minGamesPerPlayer,
              court.assignMode,
              nextSeeds
            )
          : { gameCount: Math.max(requiredGames, court.games.length), games: court.games };

      return {
        ...court,
        targetPlayerCount: safeCount,
        seedPlayerIds: nextSeeds,
        players: nextPlayers,
        gameCount: nextBuilt.gameCount,
        games: nextBuilt.games,
        isFinished: false,
      };
    });
  };

  // 참여인원 1인당 필수 최소 게임 수 설정 (관리자 전용 · 최소 2게임 ~ 최대 10게임, 필요 코트 경기 수 자동 산출)
  const handleChangeMinGamesPerPlayer = (courtNum: number, newMinGames: number) => {
    if (!isAdmin) return;
    const safeMin = Math.max(2, Math.min(10, newMinGames));
    updateCourt(courtNum, (court) => {
      const requiredGames = calculateRequiredCourtGames(court.players.length, safeMin);
      let nextGames: CourtKdkGame[];
      if (court.assignMode !== 'MANUAL' && court.players.length >= 4) {
        nextGames = generateCourtKDKGames(court.courtNumber, court.players, safeMin, {
          minGamesPerPlayer: safeMin,
          assignMode: court.assignMode,
          seedPlayerIds: court.seedPlayerIds,
        });
      } else {
        nextGames = [...court.games];
        if (nextGames.length < requiredGames && court.players.length >= 4) {
          const extra = generateCourtKDKGames(court.courtNumber, court.players, safeMin, {
            minGamesPerPlayer: safeMin,
            assignMode: 'AUTO',
            overrideTotalGames: requiredGames - nextGames.length,
          });
          extra.forEach((g, idx) => {
            nextGames.push({
              ...g,
              gameNumber: nextGames.length + 1,
              id: `c${court.courtNumber}_g${nextGames.length + 1}_${Date.now()}_${idx}`,
            });
          });
        } else if (nextGames.length > requiredGames) {
          nextGames = nextGames.slice(0, requiredGames);
        }
      }
      return {
        ...court,
        minGamesPerPlayer: safeMin,
        gameCount: Math.max(requiredGames, nextGames.length),
        games: nextGames,
        isFinished: false,
      };
    });
  };

  // 코트에 특정 선수 배정 / 해제 토글 (관리자 전용 · 코트당 최대 20명)
  const handleTogglePlayerInCourt = (courtNum: number, player: Player) => {
    if (!isAdmin) return;
    const targetCourt = kdkCourts.find((c) => c.courtNumber === courtNum);
    if (
      targetCourt &&
      !targetCourt.players.some((p) => p.id === player.id) &&
      targetCourt.players.length >= MAX_COURT_PLAYERS
    ) {
      alert(`코트별 참여인원은 최대 ${MAX_COURT_PLAYERS}명까지 선택할 수 있습니다.`);
      return;
    }

    updateCourt(courtNum, (court) => {
      const exists = court.players.some((p) => p.id === player.id);
      if (!exists && court.players.length >= MAX_COURT_PLAYERS) {
        return court;
      }
      const nextPlayers = exists
        ? court.players.filter((p) => p.id !== player.id)
        : [...court.players, player];

      const nextTarget = Math.max(
        MIN_COURT_PLAYERS,
        Math.min(MAX_COURT_PLAYERS, nextPlayers.length)
      );
      const validSeeds = court.seedPlayerIds.filter((id) =>
        nextPlayers.some((p) => p.id === id)
      );
      const nextSeeds = validSeeds.length > 0 ? validSeeds : getDefaultTopSeeds(nextPlayers);
      const nextBuilt =
        court.assignMode !== 'MANUAL' && nextPlayers.length >= 4
          ? rebuildGamesForCourt(
              court.courtNumber,
              nextPlayers,
              court.minGamesPerPlayer,
              court.assignMode,
              nextSeeds
            )
          : {
              gameCount: calculateRequiredCourtGames(nextPlayers.length, court.minGamesPerPlayer),
              games: court.games,
            };

      return {
        ...court,
        targetPlayerCount: nextTarget,
        seedPlayerIds: nextSeeds,
        players: nextPlayers,
        gameCount: nextBuilt.gameCount,
        games: nextBuilt.games,
        isFinished: false,
      };
    });
  };

  // 코트 내 실력자 시드 지정/해제 토글 (SEED_AUTO 모드용)
  const handleToggleSeedPlayer = (courtNum: number, playerId: string) => {
    if (!isAdmin) return;
    updateCourt(courtNum, (court) => {
      const exists = court.seedPlayerIds.includes(playerId);
      const nextSeeds = exists
        ? court.seedPlayerIds.filter((id) => id !== playerId)
        : [...court.seedPlayerIds, playerId];
      const nextBuilt =
        court.assignMode === 'SEED_AUTO' && court.players.length >= 4
          ? rebuildGamesForCourt(
              court.courtNumber,
              court.players,
              court.minGamesPerPlayer,
              'SEED_AUTO',
              nextSeeds
            )
          : { gameCount: court.gameCount, games: court.games };
      return {
        ...court,
        seedPlayerIds: nextSeeds,
        gameCount: nextBuilt.gameCount,
        games: nextBuilt.games,
      };
    });
  };

  // 코트 내 선수 구력(년) 개별 수정 (관리자 전용 · 종합 실력 지수 반영)
  const handleUpdatePlayerExperience = (playerId: string, newExp: number) => {
    if (!isAdmin) return;
    const safeExp = Math.max(0, Math.min(40, isNaN(newExp) ? 3 : newExp));
    setPlayerPool((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, experienceYears: safeExp } : p))
    );
    setKdkCourts((prev) =>
      prev.map((c) => {
        const nextPlayers = c.players.map((p) =>
          p.id === playerId ? { ...p, experienceYears: safeExp } : p
        );
        const nextGames = c.games.map((g) => {
          const teamA: [Player, Player] = [
            g.teamA[0].id === playerId ? { ...g.teamA[0], experienceYears: safeExp } : g.teamA[0],
            g.teamA[1].id === playerId ? { ...g.teamA[1], experienceYears: safeExp } : g.teamA[1],
          ];
          const teamB: [Player, Player] = [
            g.teamB[0].id === playerId ? { ...g.teamB[0], experienceYears: safeExp } : g.teamB[0],
            g.teamB[1].id === playerId ? { ...g.teamB[1], experienceYears: safeExp } : g.teamB[1],
          ];
          const wA = getCompositeSkillScore(teamA[0]) + getCompositeSkillScore(teamA[1]);
          const wB = getCompositeSkillScore(teamB[0]) + getCompositeSkillScore(teamB[1]);
          return { ...g, teamA, teamB, teamAWeight: wA, teamBWeight: wB, skillDiff: Math.abs(wA - wB) };
        });
        return { ...c, players: nextPlayers, games: nextGames };
      })
    );
  };

  // 코트 내 선수 나이 개별 수정 (관리자 전용 · 종합 실력 지수 및 동점 시 나이합산 기준)
  const handleUpdatePlayerAge = (playerId: string, newAge: number) => {
    if (!isAdmin) return;
    const safeAge = Math.max(10, Math.min(99, newAge || 40));
    setPlayerPool((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, age: safeAge } : p))
    );
    setKdkCourts((prev) =>
      prev.map((c) => ({
        ...c,
        players: c.players.map((p) => (p.id === playerId ? { ...p, age: safeAge } : p)),
        games: c.games.map((g) => {
          const teamA: [Player, Player] = [
            g.teamA[0].id === playerId ? { ...g.teamA[0], age: safeAge } : g.teamA[0],
            g.teamA[1].id === playerId ? { ...g.teamA[1], age: safeAge } : g.teamA[1],
          ];
          const teamB: [Player, Player] = [
            g.teamB[0].id === playerId ? { ...g.teamB[0], age: safeAge } : g.teamB[0],
            g.teamB[1].id === playerId ? { ...g.teamB[1], age: safeAge } : g.teamB[1],
          ];
          const wA = getCompositeSkillScore(teamA[0]) + getCompositeSkillScore(teamA[1]);
          const wB = getCompositeSkillScore(teamB[0]) + getCompositeSkillScore(teamB[1]);
          return { ...g, teamA, teamB, teamAWeight: wA, teamBWeight: wB, skillDiff: Math.abs(wA - wB) };
        }),
      }))
    );
  };

  // 임의 선수(미가입 회원) 이름 + 급수 + 구력 + 나이 직접 추가 및 현재 코트 즉시 배치 (관리자 전용 · 최대 20명)
  const handleAddGuestToActiveCourt = () => {
    if (!isAdmin) return;
    const raw = guestName.trim();
    if (!raw) {
      alert('추가할 선수의 이름을 입력해 주세요.');
      return;
    }
    if (activeCourt && activeCourt.players.length >= MAX_COURT_PLAYERS) {
      alert(`코트별 참여인원은 최대 ${MAX_COURT_PLAYERS}명까지 선택할 수 있습니다.`);
      return;
    }
    const parsedAge = parseInt(guestAge, 10) || 45;
    const parsedExp = Math.max(0, Math.min(40, parseInt(guestExp, 10) || 3));
    const names = raw
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    const remainingSlots = activeCourt
      ? MAX_COURT_PLAYERS - activeCourt.players.length
      : MAX_COURT_PLAYERS;
    const allowedNames = names.slice(0, remainingSlots);
    if (names.length > remainingSlots) {
      alert(`코트별 최대 ${MAX_COURT_PLAYERS}명 제한으로 ${allowedNames.length}명만 추가됩니다.`);
    }

    const newPlayers: Player[] = allowedNames.map((name, idx) => ({
      id: `kdk_guest_${Date.now()}_${idx}`,
      name,
      grade: guestGrade,
      experienceYears: parsedExp,
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
        const nextPlayers = [...court.players, ...newPlayers].slice(0, MAX_COURT_PLAYERS);
        const nextSeeds =
          court.seedPlayerIds.length > 0 ? court.seedPlayerIds : getDefaultTopSeeds(nextPlayers);
        const nextBuilt =
          court.assignMode !== 'MANUAL' && nextPlayers.length >= 4
            ? rebuildGamesForCourt(
                court.courtNumber,
                nextPlayers,
                court.minGamesPerPlayer,
                court.assignMode,
                nextSeeds
              )
            : {
                gameCount: calculateRequiredCourtGames(
                  nextPlayers.length,
                  court.minGamesPerPlayer
                ),
                games: court.games,
              };
        return {
          ...court,
          targetPlayerCount: Math.max(
            MIN_COURT_PLAYERS,
            Math.min(MAX_COURT_PLAYERS, nextPlayers.length)
          ),
          seedPlayerIds: nextSeeds,
          players: nextPlayers,
          gameCount: nextBuilt.gameCount,
          games: nextBuilt.games,
          isFinished: false,
        };
      });
    }
    setGuestName('');
  };

  // 코트별 KDK 실력균등 자동 편성 실행 (구력+등급+나이 종합실력 반영)
  const handleRunCourtAutoBalance = (courtNum: number) => {
    if (!isAdmin) return;
    updateCourt(courtNum, (court) => {
      if (court.players.length < 4) {
        alert(`${courtNum}번 코트에 최소 4명 이상의 선수를 배정해 주세요.`);
        return court;
      }
      const built = rebuildGamesForCourt(
        court.courtNumber,
        court.players,
        court.minGamesPerPlayer,
        'AUTO',
        court.seedPlayerIds
      );
      return {
        ...court,
        assignMode: 'AUTO',
        gameCount: built.gameCount,
        games: built.games,
        isFinished: false,
      };
    });
  };

  // 코트별 실력자 우선 시드배정 후 나머지 인원 자동 편성 실행
  const handleRunCourtSeedAuto = (courtNum: number) => {
    if (!isAdmin) return;
    updateCourt(courtNum, (court) => {
      if (court.players.length < 4) {
        alert(`${courtNum}번 코트에 최소 4명 이상의 선수를 배정해 주세요.`);
        return court;
      }
      const validSeeds = court.seedPlayerIds.filter((id) =>
        court.players.some((p) => p.id === id)
      );
      const nextSeeds = validSeeds.length > 0 ? validSeeds : getDefaultTopSeeds(court.players);
      const built = rebuildGamesForCourt(
        court.courtNumber,
        court.players,
        court.minGamesPerPlayer,
        'SEED_AUTO',
        nextSeeds
      );
      return {
        ...court,
        assignMode: 'SEED_AUTO',
        seedPlayerIds: nextSeeds,
        gameCount: built.gameCount,
        games: built.games,
        isFinished: false,
      };
    });
  };

  // 수동모드: 특정 게임의 팀 선수 직접 변경 (관리자 전용)
  const handleManualChangeGamePlayer = (
    courtNum: number,
    gameId: string,
    team: 'teamA' | 'teamB',
    slotIdx: 0 | 1,
    newPlayerId: string
  ) => {
    if (!isAdmin) return;
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

        const wA = getCompositeSkillScore(nextTeamA[0]) + getCompositeSkillScore(nextTeamA[1]);
        const wB = getCompositeSkillScore(nextTeamB[0]) + getCompositeSkillScore(nextTeamB[1]);
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

  // 게임 스코어 조절 (- / +, 관리자 전용)
  const handleUpdateGameScore = (
    courtNum: number,
    gameId: string,
    deltaA: number,
    deltaB: number
  ) => {
    if (!isAdmin) return;
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

  // 개별 게임 완료 토글 (관리자 전용)
  const handleToggleGameComplete = (courtNum: number, gameId: string) => {
    if (!isAdmin) return;
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

  // 코트 전체 경기 종료 및 1·2·3등 즉시 자동 집계 버튼 (관리자 전용)
  const handleFinishCourtAndAggregate = (courtNum: number) => {
    if (!isAdmin) return;
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

  // 현재 코트 선수별 배정 경기 수 집계 (1인 필수 최소 게임 수 달성 확인용)
  const scheduledCountByPlayer: Record<string, number> = {};
  if (activeCourt) {
    activeCourt.players.forEach((p) => {
      scheduledCountByPlayer[p.id] = 0;
    });
    activeCourt.games.forEach((g) => {
      [...g.teamA, ...g.teamB].forEach((p) => {
        scheduledCountByPlayer[p.id] = (scheduledCountByPlayer[p.id] || 0) + 1;
      });
    });
  }

  return (
    <div className="space-y-4">
      {/* 상단 KDK 코트별 운영 헤더 */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-amber-950/60 p-3.5 rounded-2xl border border-emerald-500/30 shadow-lg space-y-2.5">
        <div className="flex justify-between items-center gap-2">
          <div>
            <h3 className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
              <span>🔄</span> KDK 코트별 운영 · 실력균등 / 시드우선 자동 / 수동 배정
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {tournamentName} · 1인 필수 최소게임수 보장 · 구력+등급+나이 종합실력 반영 · 종료 시 1·2·3등 자동집계(동점 시 나이합산)
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={handleAddKdkCourt}
              className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-[11px] shadow-md cursor-pointer shrink-0"
            >
              + 코트 추가
            </button>
          )}
        </div>

        {/* 전체 코트 실력자 시드 우선 분산 + 나머지 인원 자동 배정 원클릭 버튼 (관리자 전용) */}
        {isAdmin && (
          <button
            type="button"
            onClick={handleDistributeAllCourtsSeedFirst}
            className="w-full py-2 px-3 bg-gradient-to-r from-violet-600/90 via-indigo-600/90 to-amber-500/90 hover:from-violet-500 hover:to-amber-400 text-white font-black rounded-xl text-[11px] shadow-md cursor-pointer flex items-center justify-center gap-1.5 transition"
          >
            <span>🌟</span>
            <span>전체 코트 실력자 우선 시드배정 + 나머지 인원 자동 균등배정</span>
          </button>
        )}

        {/* 코트 선택 탭 바 */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
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
                    {c.players.length}명·필수{c.minGamesPerPlayer}G({doneCount}/{c.games.length})
                  </span>
                  {c.assignMode === 'SEED_AUTO' && <span>🌟</span>}
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
          {/* 1. 선택 코트 설정 (관리자 전용) / 회원 모드 열람전용 안내 */}
          {/* ========================================================== */}
          {isAdmin ? (
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

            {/* 코트별 선수 인원 수 선정 (관리자 지정 · 최대 20명) + 코트별 게임 수 설정 (최소 2게임 보장) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 코트별 참여인원 지정 (최소 4명 ~ 최대 20명) */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-300">
                    👥 코트별 참여인원 지정 <span className="text-emerald-400">(최대 20명)</span>
                  </span>
                  <span className="text-xs font-black text-emerald-400">
                    {activeCourt.players.length} / {MAX_COURT_PLAYERS}명
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={activeCourt.players.length <= MIN_COURT_PLAYERS}
                    onClick={() =>
                      handleChangeTargetPlayerCount(
                        activeCourt.courtNumber,
                        Math.max(MIN_COURT_PLAYERS, activeCourt.players.length - 1)
                      )
                    }
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-black text-sm border border-slate-700 cursor-pointer shrink-0"
                  >
                    －
                  </button>
                  <select
                    value={Math.max(
                      MIN_COURT_PLAYERS,
                      Math.min(MAX_COURT_PLAYERS, activeCourt.players.length)
                    )}
                    onChange={(e) =>
                      handleChangeTargetPlayerCount(
                        activeCourt.courtNumber,
                        parseInt(e.target.value, 10)
                      )
                    }
                    className="flex-1 h-8 px-2 bg-slate-900 border border-emerald-500/40 rounded-lg text-xs text-emerald-300 font-black text-center cursor-pointer"
                  >
                    {Array.from(
                      { length: MAX_COURT_PLAYERS - MIN_COURT_PLAYERS + 1 },
                      (_, i) => MIN_COURT_PLAYERS + i
                    ).map((cnt) => (
                      <option key={cnt} value={cnt}>
                        {cnt}명 참여
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={activeCourt.players.length >= MAX_COURT_PLAYERS}
                    onClick={() =>
                      handleChangeTargetPlayerCount(
                        activeCourt.courtNumber,
                        Math.min(MAX_COURT_PLAYERS, activeCourt.players.length + 1)
                      )
                    }
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-black text-sm border border-slate-700 cursor-pointer shrink-0"
                  >
                    ＋
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {[4, 6, 8, 10, 12, 16, 20].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleChangeTargetPlayerCount(activeCourt.courtNumber, cnt)}
                      className={`py-1 rounded-lg text-[10px] font-black border transition cursor-pointer ${
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

              {/* 참여인원 1인 필수 최소 게임 수 설정 (모든 참여인원이 필수로 해야하는 게임 수 보장) */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-300">
                    🎾 1인 필수 최소 게임 수 <span className="text-amber-400">(전원 필수)</span>
                  </span>
                  <span className="text-xs font-black text-amber-400">
                    1인 {activeCourt.minGamesPerPlayer}G ➔ 코트 {activeCourt.games.length}경기
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    disabled={activeCourt.minGamesPerPlayer <= 2}
                    onClick={() =>
                      handleChangeMinGamesPerPlayer(
                        activeCourt.courtNumber,
                        activeCourt.minGamesPerPlayer - 1
                      )
                    }
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-black text-sm border border-slate-700 cursor-pointer shrink-0"
                  >
                    －
                  </button>
                  <div className="flex gap-1 flex-1 justify-center">
                    {[2, 3, 4, 5, 6].map((gNum) => (
                      <button
                        key={gNum}
                        type="button"
                        onClick={() =>
                          handleChangeMinGamesPerPlayer(activeCourt.courtNumber, gNum)
                        }
                        className={`px-2 py-1 rounded-lg text-[11px] font-black border cursor-pointer ${
                          activeCourt.minGamesPerPlayer === gNum
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
                      handleChangeMinGamesPerPlayer(
                        activeCourt.courtNumber,
                        activeCourt.minGamesPerPlayer + 1
                      )
                    }
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-black text-sm border border-slate-700 cursor-pointer shrink-0"
                  >
                    ＋
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  참여 {activeCourt.players.length}명 전원 최소 <strong className="text-amber-300">{activeCourt.minGamesPerPlayer}게임</strong> 이상 출전 보장 (자동 산출: 총 {calculateRequiredCourtGames(activeCourt.players.length, activeCourt.minGamesPerPlayer)}경기)
                </p>
              </div>
            </div>

            {/* 3가지 운영 모드 전환 버튼: 실력균등 자동 | 실력자 시드우선 자동 | 수동모드 */}
            <div className="space-y-1.5">
              <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleRunCourtAutoBalance(activeCourt.courtNumber)}
                  className={`py-2.5 px-1.5 rounded-xl text-[11px] font-black transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    activeCourt.assignMode === 'AUTO'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>⚖️ 실력균등 자동</span>
                  <span className={`text-[9px] font-bold ${activeCourt.assignMode === 'AUTO' ? 'text-slate-900' : 'text-slate-500'}`}>
                    구력·등급·나이
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRunCourtSeedAuto(activeCourt.courtNumber)}
                  className={`py-2.5 px-1.5 rounded-xl text-[11px] font-black transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    activeCourt.assignMode === 'SEED_AUTO'
                      ? 'bg-gradient-to-r from-violet-500 to-amber-400 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🌟 시드우선 자동</span>
                  <span className={`text-[9px] font-bold ${activeCourt.assignMode === 'SEED_AUTO' ? 'text-slate-900' : 'text-slate-500'}`}>
                    시드후 자동배정
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateCourt(activeCourt.courtNumber, (c) => ({
                      ...c,
                      assignMode: 'MANUAL',
                    }))
                  }
                  className={`py-2.5 px-1.5 rounded-xl text-[11px] font-black transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    activeCourt.assignMode === 'MANUAL'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🖐️ 수동모드</span>
                  <span className={`text-[9px] font-bold ${activeCourt.assignMode === 'MANUAL' ? 'text-slate-900' : 'text-slate-500'}`}>
                    직접 선수배치
                  </span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400 px-1">
                {activeCourt.assignMode === 'AUTO' &&
                  '⚖️ 실력균등 자동모드: 구력(년)·등급(금배~테린이)·나이를 종합 반영해 팀 실력 차이를 최소화합니다.'}
                {activeCourt.assignMode === 'SEED_AUTO' &&
                  '🌟 시드우선 자동모드: 아래 선수 목록에서 [🌟시드]로 지정된 실력자를 양 팀 핵심으로 우선 배치하고 나머지 인원을 자동 매칭합니다.'}
                {activeCourt.assignMode === 'MANUAL' &&
                  '🖐️ 수동모드: 아래 각 경기 카드에서 출전 선수를 드롭다운으로 직접 배치할 수 있습니다.'}
              </p>
            </div>

            {/* 코트별 선수 배정 목록 (가입/미가입 선택 + 구력·나이 수정 + 시드 토글 + 임의 선수 추가) */}
            <div className="space-y-2.5 pt-1">
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-white">
                  🎾 {activeCourt.courtNumber}번 코트 배정 선수 ({activeCourt.players.length}/{MAX_COURT_PLAYERS}명 · 구력·나이·시드 설정)
                </span>
                <span className="text-[10px] text-amber-300 font-bold">
                  시드 {activeCourt.seedPlayerIds.filter((id) => activeCourt.players.some((p) => p.id === id)).length}명
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto p-0.5">
                {playerPool.map((p) => {
                  const isInCourt = activeCourt.players.some((cp) => cp.id === p.id);
                  const isSeed = activeCourt.seedPlayerIds.includes(p.id);
                  const compositeScore = getCompositeSkillScore(p);
                  const expYears = getPlayerExperienceYears(p);
                  const myGames = scheduledCountByPlayer[p.id] || 0;
                  return (
                    <div
                      key={p.id}
                      className={`p-2 rounded-xl border space-y-1.5 transition ${
                        isInCourt
                          ? isSeed
                            ? 'bg-violet-950/60 border-amber-400 text-white'
                            : 'bg-emerald-950/70 border-emerald-400 text-white'
                          : 'bg-slate-950/70 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <button
                          type="button"
                          onClick={() => handleTogglePlayerInCourt(activeCourt.courtNumber, p)}
                          className="flex-1 text-left truncate cursor-pointer"
                        >
                          <div className="flex items-center gap-1 flex-wrap">
                            {isInCourt && isSeed && (
                              <span className="text-[10px] text-amber-300 font-black">🌟</span>
                            )}
                            <span className="text-xs font-bold truncate">{p.name}</span>
                            <span className="text-[9px] px-1 rounded bg-slate-800 text-amber-300 font-bold">
                              {p.grade}
                            </span>
                            <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300 font-black">
                              {compositeScore}점
                            </span>
                            {isInCourt && (
                              <span
                                className={`text-[9px] px-1 rounded font-black ${
                                  myGames >= activeCourt.minGamesPerPlayer
                                    ? 'bg-sky-500/20 text-sky-300'
                                    : 'bg-red-500/20 text-red-300'
                                }`}
                              >
                                {myGames}G
                              </span>
                            )}
                          </div>
                        </button>

                        {isInCourt && (
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleSeedPlayer(activeCourt.courtNumber, p.id)
                            }
                            title="코트 실력자 시드 지정/해제"
                            className={`px-1.5 py-0.5 rounded-lg text-[9px] font-black border cursor-pointer shrink-0 ${
                              isSeed
                                ? 'bg-amber-400 text-slate-950 border-amber-300'
                                : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-amber-300'
                            }`}
                          >
                            {isSeed ? '🌟시드' : '시드'}
                          </button>
                        )}
                      </div>

                      {/* 구력(년) & 나이(세) 개별 수정 (종합 실력 지수 및 동점 나이합산 반영) */}
                      <div className="flex items-center justify-between gap-1.5 text-[10px]">
                        <span className="text-[9px] text-slate-400 truncate">
                          {p.isGuest ? '미가입/임의' : '가입회원'}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <label className="flex items-center gap-0.5">
                            <span className="text-[9px] text-sky-300">구력</span>
                            <input
                              type="number"
                              min={0}
                              max={40}
                              value={expYears}
                              onChange={(e) =>
                                handleUpdatePlayerExperience(
                                  p.id,
                                  parseInt(e.target.value, 10)
                                )
                              }
                              title="구력 (년) — 종합 실력 점수 반영"
                              className="w-10 px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px] text-center text-sky-300 font-bold"
                            />
                            <span className="text-[9px] text-slate-400">년</span>
                          </label>
                          <label className="flex items-center gap-0.5">
                            <input
                              type="number"
                              min={10}
                              max={99}
                              value={p.age || 45}
                              onChange={(e) =>
                                handleUpdatePlayerAge(p.id, parseInt(e.target.value, 10))
                              }
                              title="선수 나이 (종합 실력 및 동점 시 나이합산 기준)"
                              className="w-10 px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px] text-center text-amber-300 font-bold"
                            />
                            <span className="text-[9px] text-slate-400">세</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 임의 선수(이름·급수·구력·나이) 코트 바로 추가 */}
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
                  className="col-span-3 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                />
                <select
                  value={guestGrade}
                  onChange={(e) => setGuestGrade(e.target.value)}
                  className="col-span-3 px-1 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-[11px] text-amber-300 font-bold"
                >
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <div className="col-span-2 flex items-center gap-0.5">
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={guestExp}
                    onChange={(e) => setGuestExp(e.target.value)}
                    placeholder="구력"
                    title="구력(년)"
                    className="w-full px-1 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-center text-sky-300 font-bold"
                  />
                  <span className="text-[9px] text-slate-400">년</span>
                </div>
                <div className="col-span-2 flex items-center gap-0.5">
                  <input
                    type="number"
                    min={10}
                    max={99}
                    value={guestAge}
                    onChange={(e) => setGuestAge(e.target.value)}
                    placeholder="나이"
                    title="나이(세)"
                    className="w-full px-1 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-center text-white"
                  />
                  <span className="text-[9px] text-slate-400">세</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddGuestToActiveCourt}
                  className="col-span-2 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-[11px] cursor-pointer"
                >
                  +추가
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
                  {activeCourt.courtNumber}번 코트 ({activeCourt.players.length}명 · 1인 필수 {activeCourt.minGamesPerPlayer}G / 총 {activeCourt.games.length}경기) 실력균등 재편성
                </span>
              </button>
            )}
            {activeCourt.assignMode === 'SEED_AUTO' && (
              <button
                type="button"
                onClick={() => handleRunCourtSeedAuto(activeCourt.courtNumber)}
                className="w-full py-2.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-amber-500 hover:from-violet-500 hover:to-amber-400 text-white font-black rounded-xl text-xs shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>🌟</span>
                <span>
                  {activeCourt.courtNumber}번 코트 시드우선 자동 재편성 (시드 분산 + 나머지 자동 · 1인 필수 {activeCourt.minGamesPerPlayer}G)
                </span>
              </button>
            )}
          </div>
          ) : (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-emerald-300">
                  🎾 {activeCourt.courtNumber}번 코트 배정 선수 및 운영 현황
                </span>
                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                  {activeCourt.players.length}명 참여 · 1인 필수 {activeCourt.minGamesPerPlayer}G (총 {activeCourt.games.length}경기)
                </span>
              </div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {activeCourt.players.map((p) => (
                  <span
                    key={p.id}
                    className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-bold"
                  >
                    {activeCourt.assignMode === 'SEED_AUTO' && activeCourt.seedPlayerIds.includes(p.id) ? '🌟 ' : ''}
                    {p.name} <span className="text-amber-300">({p.grade}·구력{getPlayerExperienceYears(p)}년)</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* 2. 코트별 게임 진행 및 스코어 */}
          {/* ========================================================== */}
          <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <div>
                <h4 className="text-xs font-black text-emerald-400">
                  🎾 {activeCourt.courtNumber}번 코트 경기 진행 ({completedGamesCount}/{activeCourt.games.length} 게임 완료)
                </h4>
                <p className="text-[10px] text-slate-400">
                  {!isAdmin
                    ? '운영자가 배정한 실시간 경기 진행 현황 및 스코어'
                    : activeCourt.assignMode === 'MANUAL'
                    ? '수동모드: 각 게임의 출전 선수를 드롭다운으로 직접 변경할 수 있습니다.'
                    : activeCourt.assignMode === 'SEED_AUTO'
                    ? '시드우선 자동모드: 🌟 실력자 시드를 양 팀 핵심으로 분산 배치하고 나머지 인원을 자동 균등 매칭했습니다.'
                    : '실력균등 자동모드: 구력·등급·나이를 종합 반영해 전원 필수 게임수를 보장하며 균등 편성했습니다.'}
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleFinishCourtAndAggregate(activeCourt.courtNumber)}
                  className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-[11px] shadow-md cursor-pointer"
                >
                  🏁 코트 경기 종료·자동집계
                </button>
              )}
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
                            g.skillDiff <= 12
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          ⚖️ 종합전력 {g.teamAWeight} vs {g.teamBWeight} (차이 {g.skillDiff})
                        </span>
                      </div>

                      {isAdmin ? (
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
                      ) : (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-lg font-black ${
                            g.completed
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {g.completed ? '✓ 경기완료' : '진행 중'}
                        </span>
                      )}
                    </div>

                    {/* 팀 배치 (관리자 수동모드면 드롭다운 직접 배치, 그 외 깔끔한 표시) */}
                    {isAdmin && activeCourt.assignMode === 'MANUAL' ? (
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
                            {activeCourt.assignMode === 'SEED_AUTO' && activeCourt.seedPlayerIds.includes(g.teamA[0].id) ? '🌟' : ''}
                            {g.teamA[0].name} /{' '}
                            {activeCourt.assignMode === 'SEED_AUTO' && activeCourt.seedPlayerIds.includes(g.teamA[1].id) ? '🌟' : ''}
                            {g.teamA[1].name}
                          </p>
                          <span className="text-[9px] text-slate-400">
                            나이합 {ageSumA}세 ({g.teamA[0].age}+{g.teamA[1].age})
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 mx-2 bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-800">
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateGameScore(activeCourt.courtNumber, g.id, -1, 0)
                              }
                              className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                            >
                              -
                            </button>
                          )}
                          <span className="text-sm font-black text-white w-4 text-center">
                            {g.scoreA}
                          </span>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateGameScore(activeCourt.courtNumber, g.id, 1, 0)
                              }
                              className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                            >
                              +
                            </button>
                          )}
                          <span className="text-[10px] font-black text-slate-500">:</span>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateGameScore(activeCourt.courtNumber, g.id, 0, -1)
                              }
                              className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                            >
                              -
                            </button>
                          )}
                          <span className="text-sm font-black text-white w-4 text-center">
                            {g.scoreB}
                          </span>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateGameScore(activeCourt.courtNumber, g.id, 0, 1)
                              }
                              className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                            >
                              +
                            </button>
                          )}
                        </div>

                        <div className="flex-1 text-right">
                          <p className="font-bold text-amber-300 truncate">
                            {activeCourt.assignMode === 'SEED_AUTO' && activeCourt.seedPlayerIds.includes(g.teamB[0].id) ? '🌟' : ''}
                            {g.teamB[0].name} /{' '}
                            {activeCourt.assignMode === 'SEED_AUTO' && activeCourt.seedPlayerIds.includes(g.teamB[1].id) ? '🌟' : ''}
                            {g.teamB[1].name}
                          </p>
                          <span className="text-[9px] text-slate-400">
                            나이합 {ageSumB}세 ({g.teamB[0].age}+{g.teamB[1].age})
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 관리자 수동모드일 때도 스코어 입력 바 표시 */}
                    {isAdmin && activeCourt.assignMode === 'MANUAL' && (
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
