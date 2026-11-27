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
  resolvePlayerAge,
  calculateRequiredCourtGames,
  distributePlayersSeedFirstToCourts,
  generateCourtKDKGames,
  calculateKdkStandingsWithAgeTiebreak,
} from '../lib/kdk';
import { calculateKoreanManAge } from '../lib/age';
import { recordMatchResultToSupabase } from '../lib/supabase';

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
  /** 'PLAY': KDK 파트너 순환 진행 화면(스코어 입력·게임종료·다음 대기자 자동연동 전용) | 'ADMIN_CONFIG': 운영자 관리 센터(코트별 참가인원·게임수·선수·모드 설정 전용) */
  viewMode?: 'PLAY' | 'ADMIN_CONFIG';
  onNavigateToTab?: (tab: 'courts' | 'kdk' | 'tournament' | 'mypage' | 'admin') => void;
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
  const fromBirth = calculateKoreanManAge(raw.birthDate);
  const ageVal =
    fromBirth !== null
      ? fromBirth
      : typeof raw.age === 'number' && !isNaN(raw.age) && raw.age > 0
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
    birthDate: raw.birthDate || undefined,
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

const KDK_COURTS_STORAGE_KEY = 'sun_tennis_kdk_courts_v3';
const KDK_POOL_STORAGE_KEY = 'sun_tennis_kdk_pool_v3';
const KDK_SYNC_EVENT = 'sun-tennis-kdk-sync';

function sanitizeCourtState(raw: any, index: number): KdkCourtState {
  const courtNumber = typeof raw?.courtNumber === 'number' ? raw.courtNumber : index + 1;
  const rawPlayers = Array.isArray(raw?.players) ? raw.players : [];
  const players: Player[] = rawPlayers
    .filter(Boolean)
    .map((p: any, i: number) => normalizePlayer(p, i));
  const minGamesPerPlayer = Math.max(2, Math.floor(raw?.minGamesPerPlayer || 2));
  const rawGames = Array.isArray(raw?.games) ? raw.games : [];
  const games: CourtKdkGame[] = rawGames.filter(
    (g: any) =>
      g &&
      Array.isArray(g.teamA) &&
      g.teamA[0] &&
      g.teamA[1] &&
      Array.isArray(g.teamB) &&
      g.teamB[0] &&
      g.teamB[1]
  );
  const seedPlayerIds = Array.isArray(raw?.seedPlayerIds) ? raw.seedPlayerIds : [];
  const targetPlayerCount = Math.max(4, typeof raw?.targetPlayerCount === 'number' ? raw.targetPlayerCount : players.length);
  const gameCount = typeof raw?.gameCount === 'number' ? raw.gameCount : Math.max(games.length, calculateRequiredCourtGames(players.length, minGamesPerPlayer));

  return {
    courtNumber,
    targetPlayerCount,
    minGamesPerPlayer,
    gameCount,
    assignMode: raw?.assignMode || 'AUTO',
    seedPlayerIds,
    players,
    games,
    isFinished: Boolean(raw?.isFinished),
  };
}

export default function KdkCourtOperations({
  tournamentName,
  availablePlayers,
  isAdmin = false,
  viewMode = 'PLAY',
  onNavigateToTab,
  onSyncCourtsToApp,
  onAddNewPlayerToClub,
}: KdkCourtOperationsProps) {
  // 운영관리 탭 아코디언 접기/펼치기 상태 (기본 접힘 -> 항목 클릭 시 펼쳐서 수정)
  const [isAdminConfigOpen, setIsAdminConfigOpen] = useState<boolean>(false);
  // 게임 종료 시 다음 대기자 자동 연동 알림 메시지
  const [autoRotationNotice, setAutoRotationNotice] = useState<string>('');

  // 전체 선수 풀 (나이·구력 정보 포함, 로컬스토리지 연동)
  const [playerPool, setPlayerPool] = useState<Player[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(KDK_POOL_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length >= 4) {
            return parsed.map((p, i) => normalizePlayer(p, i));
          }
        }
      } catch {}
    }
    return availablePlayers.map((p, i) => normalizePlayer(p, i));
  });

  // 외부 availablePlayers 추가 및 개인정보(생년월일·만 나이·등급·이름) 수정 시 실시간 동기화
  useEffect(() => {
    const incomingMap = new Map<string, Player>();
    availablePlayers.forEach((raw, i) => {
      const np = normalizePlayer(raw, i);
      incomingMap.set(np.id, np);
    });

    const mergeWithIncoming = (existing: Player): Player => {
      const inc = incomingMap.get(existing.id);
      if (!inc) return existing;
      const nextBirthDate = inc.birthDate || existing.birthDate;
      const manAgeFromBirth = calculateKoreanManAge(nextBirthDate);
      const nextAge =
        manAgeFromBirth !== null
          ? manAgeFromBirth
          : inc.age ?? existing.age;
      return {
        ...existing,
        name: inc.name,
        grade: inc.grade,
        gender: inc.gender,
        birthDate: nextBirthDate,
        age: nextAge,
      };
    };

    setPlayerPool((prev) => {
      let changed = false;
      const updated = prev.map((p) => {
        const merged = mergeWithIncoming(p);
        if (
          merged.name !== p.name ||
          merged.grade !== p.grade ||
          merged.gender !== p.gender ||
          merged.birthDate !== p.birthDate ||
          merged.age !== p.age
        ) {
          changed = true;
        }
        return merged;
      });
      const existingIds = new Set(updated.map((p) => p.id));
      incomingMap.forEach((np) => {
        if (!existingIds.has(np.id)) {
          updated.push(np);
          changed = true;
        }
      });
      return changed ? updated : prev;
    });

    setKdkCourts((prev) => {
      let courtsChanged = false;
      const nextCourts = prev.map((c) => {
        let courtChanged = false;
        const nextPlayers = c.players.map((p) => {
          const merged = mergeWithIncoming(p);
          if (
            merged.name !== p.name ||
            merged.grade !== p.grade ||
            merged.birthDate !== p.birthDate ||
            merged.age !== p.age
          ) {
            courtChanged = true;
          }
          return merged;
        });

        const nextGames = c.games.map((g) => {
          const tA0 = mergeWithIncoming(g.teamA[0]);
          const tA1 = mergeWithIncoming(g.teamA[1]);
          const tB0 = mergeWithIncoming(g.teamB[0]);
          const tB1 = mergeWithIncoming(g.teamB[1]);
          const nextResting = (g.resting || []).map(mergeWithIncoming);
          const wA = getCompositeSkillScore(tA0) + getCompositeSkillScore(tA1);
          const wB = getCompositeSkillScore(tB0) + getCompositeSkillScore(tB1);
          const diff = Math.abs(wA - wB);
          if (
            tA0.age !== g.teamA[0].age ||
            tA1.age !== g.teamA[1].age ||
            tB0.age !== g.teamB[0].age ||
            tB1.age !== g.teamB[1].age ||
            tA0.grade !== g.teamA[0].grade ||
            tA1.grade !== g.teamA[1].grade ||
            tB0.grade !== g.teamB[0].grade ||
            tB1.grade !== g.teamB[1].grade ||
            tA0.name !== g.teamA[0].name ||
            tA1.name !== g.teamA[1].name ||
            tB0.name !== g.teamB[0].name ||
            tB1.name !== g.teamB[1].name ||
            wA !== g.teamAWeight ||
            wB !== g.teamBWeight
          ) {
            courtChanged = true;
            return {
              ...g,
              teamA: [tA0, tA1] as [Player, Player],
              teamB: [tB0, tB1] as [Player, Player],
              resting: nextResting,
              teamAWeight: wA,
              teamBWeight: wB,
              skillDiff: diff,
            };
          }
          return g;
        });

        if (courtChanged) {
          courtsChanged = true;
          return { ...c, players: nextPlayers, games: nextGames };
        }
        return c;
      });
      if (courtsChanged && typeof window !== 'undefined') {
        try {
          localStorage.setItem(KDK_COURTS_STORAGE_KEY, JSON.stringify(nextCourts));
        } catch {}
      }
      return courtsChanged ? nextCourts : prev;
    });
  }, [availablePlayers]);

  // 코트별 KDK 상태 (운영관리 센터와 KDK 진행 화면 간 실시간 로컬스토리지 동기화)
  const [kdkCourts, setKdkCourts] = useState<KdkCourtState[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedRaw = localStorage.getItem(KDK_COURTS_STORAGE_KEY);
        if (savedRaw) {
          const parsed = JSON.parse(savedRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((c, i) => sanitizeCourtState(c, i));
          }
        }
      } catch {}
    }
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

  // 운영관리 센터 <-> KDK 진행 화면 간 변경사항 동기화
  const persistAndBroadcastKdk = (nextCourts: KdkCourtState[], nextPool?: Player[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(KDK_COURTS_STORAGE_KEY, JSON.stringify(nextCourts));
      if (nextPool) {
        localStorage.setItem(KDK_POOL_STORAGE_KEY, JSON.stringify(nextPool));
      }
      window.dispatchEvent(new CustomEvent(KDK_SYNC_EVENT));
    } catch {}
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleSync = () => {
      try {
        const rawCourts = localStorage.getItem(KDK_COURTS_STORAGE_KEY);
        if (rawCourts) {
          const parsed = JSON.parse(rawCourts);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setKdkCourts(parsed.map((c, i) => sanitizeCourtState(c, i)));
          }
        }
        const rawPool = localStorage.getItem(KDK_POOL_STORAGE_KEY);
        if (rawPool) {
          const parsedPool = JSON.parse(rawPool);
          if (Array.isArray(parsedPool) && parsedPool.length > 0) {
            setPlayerPool(parsedPool);
          }
        }
      } catch {}
    };
    window.addEventListener(KDK_SYNC_EVENT, handleSync);
    return () => window.removeEventListener(KDK_SYNC_EVENT, handleSync);
  }, []);

  // 현재 선택된 코트 탭 번호
  const [selectedCourtNum, setSelectedCourtNum] = useState<number>(1);
  // 코트별 임의 선수 추가 폼 상태 (이름 + 등급 + 구력 + 나이)
  const [guestName, setGuestName] = useState<string>('');
  const [guestGrade, setGuestGrade] = useState<string>('은배');
  const [guestExp, setGuestExp] = useState<string>('5');
  const [guestAge, setGuestAge] = useState<string>('48');

  const activeCourt =
    kdkCourts.find((c) => c.courtNumber === selectedCourtNum) || kdkCourts[0];

  // 앱의 실시간 코트 현황판과 자동 동기화 헬퍼 (진행 중인 게임이 종료되면 다음 대기자 게임으로 즉시 자동 연동)
  const syncToMainApp = (courtsList: KdkCourtState[], updatedPool?: Player[]) => {
    persistAndBroadcastKdk(courtsList, updatedPool);
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
          `${currentGame.teamA[0].name} (${currentGame.teamA[0].grade}·만 ${resolvePlayerAge(currentGame.teamA[0], 40)}세)`,
          `${currentGame.teamA[1].name} (${currentGame.teamA[1].grade}·만 ${resolvePlayerAge(currentGame.teamA[1], 40)}세)`,
        ],
        teamB: [
          `${currentGame.teamB[0].name} (${currentGame.teamB[0].grade}·만 ${resolvePlayerAge(currentGame.teamB[0], 40)}세)`,
          `${currentGame.teamB[1].name} (${currentGame.teamB[1].grade}·만 ${resolvePlayerAge(currentGame.teamB[1], 40)}세)`,
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
    const nextPool = playerPool.map((p) =>
      p.id === playerId ? { ...p, experienceYears: safeExp } : p
    );
    setPlayerPool(nextPool);
    setKdkCourts((prev) => {
      const nextCourts = prev.map((c) => {
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
      });
      syncToMainApp(nextCourts, nextPool);
      return nextCourts;
    });
  };

  // 코트 내 선수 나이 개별 수정 (관리자 전용 · 종합 실력 지수 및 동점 시 만 나이합산 기준)
  const handleUpdatePlayerAge = (playerId: string, newAge: number) => {
    if (!isAdmin) return;
    const safeAge = Math.max(10, Math.min(99, newAge || 40));
    const nextPool = playerPool.map((p) =>
      p.id === playerId ? { ...p, age: safeAge, birthDate: undefined } : p
    );
    setPlayerPool(nextPool);
    setKdkCourts((prev) => {
      const nextCourts = prev.map((c) => ({
        ...c,
        players: c.players.map((p) =>
          p.id === playerId ? { ...p, age: safeAge, birthDate: undefined } : p
        ),
        games: c.games.map((g) => {
          const teamA: [Player, Player] = [
            g.teamA[0].id === playerId ? { ...g.teamA[0], age: safeAge, birthDate: undefined } : g.teamA[0],
            g.teamA[1].id === playerId ? { ...g.teamA[1], age: safeAge, birthDate: undefined } : g.teamA[1],
          ];
          const teamB: [Player, Player] = [
            g.teamB[0].id === playerId ? { ...g.teamB[0], age: safeAge, birthDate: undefined } : g.teamB[0],
            g.teamB[1].id === playerId ? { ...g.teamB[1], age: safeAge, birthDate: undefined } : g.teamB[1],
          ];
          const wA = getCompositeSkillScore(teamA[0]) + getCompositeSkillScore(teamA[1]);
          const wB = getCompositeSkillScore(teamB[0]) + getCompositeSkillScore(teamB[1]);
          return { ...g, teamA, teamB, teamAWeight: wA, teamBWeight: wB, skillDiff: Math.abs(wA - wB) };
        }),
      }));
      syncToMainApp(nextCourts, nextPool);
      return nextCourts;
    });
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

  // 개별 게임 종료 및 다음 대기자 선수 자동 연동 토글 (관리자 전용)
  const handleToggleGameComplete = (courtNum: number, gameId: string) => {
    if (!isAdmin) return;
    let rotationMsg = '';
    updateCourt(courtNum, (court) => {
      const targetGame = court.games.find((g) => g.id === gameId);
      const willComplete = targetGame ? !targetGame.completed : true;
      const nextGames = court.games.map((g) =>
        g.id === gameId ? { ...g, completed: willComplete } : g
      );
      const allDone = nextGames.length >= 2 && nextGames.every((g) => g.completed);

      if (willComplete && targetGame) {
        // Supabase matches 테이블 및 player_stats 누적 집계에 경기 결과 실시간 저장
        recordMatchResultToSupabase({
          roundName: `${tournamentName} - ${court.courtNumber}번 코트 제 ${targetGame.gameNumber} 게임`,
          courtNumber: court.courtNumber,
          teamAPlayerIds: [targetGame.teamA[0]?.id, targetGame.teamA[1]?.id].filter(Boolean),
          teamBPlayerIds: [targetGame.teamB[0]?.id, targetGame.teamB[1]?.id].filter(Boolean),
          scoreA: targetGame.scoreA,
          scoreB: targetGame.scoreB,
        }).catch(() => {});

        // 방금 종료된 게임 다음으로 대기 중인 미완료 게임 탐색
        const nextWaitingGame = nextGames.find((g) => !g.completed);
        if (nextWaitingGame) {
          rotationMsg = `🔄 [${court.courtNumber}번 코트] 제 ${targetGame.gameNumber} 게임(${targetGame.scoreA}:${targetGame.scoreB}) 종료! 다음 대기자 [${nextWaitingGame.teamA[0].name}/${nextWaitingGame.teamA[1].name} vs ${nextWaitingGame.teamB[0].name}/${nextWaitingGame.teamB[1].name}] 선수가 제 ${nextWaitingGame.gameNumber} 게임으로 코트에 자동 연동·투입되었습니다.`;
        } else if (allDone) {
          rotationMsg = `🏆 [${court.courtNumber}번 코트] 전체 ${nextGames.length}게임이 모두 종료되어 1등·2등·3등 최종 순위(동점 시 나이합산)가 자동 집계되었습니다!`;
        }
      }

      return {
        ...court,
        games: nextGames,
        isFinished: allDone,
      };
    });
    if (rotationMsg) {
      setAutoRotationNotice(rotationMsg);
    }
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

  // 현재 코트에서 진행 중인 게임 & 그 다음 대기 중인 게임 (다음 대기자 선수 자동 연동용)
  const uncompletedGames = activeCourt
    ? activeCourt.games.filter((g) => !g.completed)
    : [];
  const currentPlayingGame = uncompletedGames[0] || null;
  const nextQueuedGame = uncompletedGames[1] || null;

  // [KDK_V2025 시트 스타일] 선수별 라운드(경기)별 득점/실점/결과 매핑
  const playerRoundMap: Record<string, { round: number; scoreFor: number; scoreAgainst: number; isWin: boolean; isDraw: boolean; partnerName: string; oppNames: string; completed: boolean }[]> = {};
  if (activeCourt) {
    activeCourt.players.forEach((p) => {
      playerRoundMap[p.id] = [];
    });
    activeCourt.games.forEach((g) => {
      const isTeamA0 = g.teamA[0]?.id;
      const isTeamA1 = g.teamA[1]?.id;
      const isTeamB0 = g.teamB[0]?.id;
      const isTeamB1 = g.teamB[1]?.id;

      const recordPlayerGame = (pId: string, partnerName: string, oppNames: string, sf: number, sa: number) => {
        if (!playerRoundMap[pId]) playerRoundMap[pId] = [];
        playerRoundMap[pId].push({
          round: g.gameNumber,
          scoreFor: sf,
          scoreAgainst: sa,
          isWin: g.completed && sf > sa,
          isDraw: g.completed && sf === sa,
          partnerName,
          oppNames,
          completed: g.completed,
        });
      };

      if (isTeamA0) recordPlayerGame(isTeamA0, g.teamA[1]?.name || '', `${g.teamB[0]?.name || ''}/${g.teamB[1]?.name || ''}`, g.scoreA, g.scoreB);
      if (isTeamA1) recordPlayerGame(isTeamA1, g.teamA[0]?.name || '', `${g.teamB[0]?.name || ''}/${g.teamB[1]?.name || ''}`, g.scoreA, g.scoreB);
      if (isTeamB0) recordPlayerGame(isTeamB0, g.teamB[1]?.name || '', `${g.teamA[0]?.name || ''}/${g.teamA[1]?.name || ''}`, g.scoreB, g.scoreA);
      if (isTeamB1) recordPlayerGame(isTeamB1, g.teamB[0]?.name || '', `${g.teamA[0]?.name || ''}/${g.teamA[1]?.name || ''}`, g.scoreB, g.scoreA);
    });
  }

  // ============================================================================
  // [A] 운영자 관리 센터 전용 뷰 (viewMode === 'ADMIN_CONFIG')
  // - 코트별 참가인원 설정, 1인 필수 최소 게임 수, 자동/시드우선/수동 모드, 선수 배정·구력·나이·시드 관리
  // - 접혀 있다가 항목을 누르면 펼쳐져서 수정 가능
  // ============================================================================
  if (viewMode === 'ADMIN_CONFIG') {
    return (
      <div className="bg-slate-900 border border-emerald-500/35 rounded-2xl p-3.5 shadow-xl space-y-3">
        <button
          type="button"
          onClick={() => setIsAdminConfigOpen((prev) => !prev)}
          className="w-full flex justify-between items-center gap-2 text-left cursor-pointer"
        >
          <div>
            <h3 className="text-sm font-black text-emerald-300 flex items-center gap-1.5 flex-wrap">
              <span>🔄</span> KDK 코트별 참가인원 · 필수 게임수 · 시드/자동/수동 설정 관리
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950 text-amber-300 border border-amber-500/30 font-black">
                총 {kdkCourts.length}코트
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              항목을 누르면 펼쳐져서 코트별 참가인원, 1인 필수 게임수, 실력균등/시드우선/수동 배정 및 선수 구력·나이를 수정할 수 있습니다.
            </p>
          </div>
          <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-amber-300 shrink-0">
            {isAdminConfigOpen ? '접기 ▲' : '수정 ▼'}
          </span>
        </button>

        {isAdminConfigOpen && activeCourt && (
          <div className="space-y-3.5 pt-2.5 border-t border-slate-800">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div className="flex flex-wrap gap-1.5">
                {kdkCourts.map((c) => {
                  const isActive = c.courtNumber === activeCourt.courtNumber;
                  return (
                    <button
                      key={c.courtNumber}
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
                        {c.players.length}명·필수{c.minGamesPerPlayer}G
                      </span>
                      {c.assignMode === 'SEED_AUTO' && <span>🌟</span>}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleAddKdkCourt}
                  className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-[11px] shadow-md cursor-pointer"
                >
                  + 코트 추가
                </button>
                {kdkCourts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveKdkCourt(activeCourt.courtNumber)}
                    className="text-[11px] px-2.5 py-1.5 rounded-xl bg-red-950/70 text-red-300 border border-red-500/30 font-bold cursor-pointer"
                  >
                    코트 삭제
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleDistributeAllCourtsSeedFirst}
              className="w-full py-2 px-3 bg-gradient-to-r from-violet-600/90 via-indigo-600/90 to-amber-500/90 hover:from-violet-500 hover:to-amber-400 text-white font-black rounded-xl text-[11px] shadow-md cursor-pointer flex items-center justify-center gap-1.5 transition"
            >
              <span>🌟</span>
              <span>전체 코트 실력자 우선 시드배정 + 나머지 인원 자동 균등배정</span>
            </button>

            {/* 코트별 참여인원 지정 + 1인 필수 최소 게임 수 설정 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  참여 {activeCourt.players.length}명 전원 최소 <strong className="text-amber-300">{activeCourt.minGamesPerPlayer}게임</strong> 이상 출전 보장 (총 {calculateRequiredCourtGames(activeCourt.players.length, activeCourt.minGamesPerPlayer)}경기)
                </p>
              </div>
            </div>

            {/* 3가지 운영 모드 전환 버튼 */}
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
            </div>

            {/* 코트별 선수 배정 목록 (구력·나이·시드 설정 + 임의 선수 추가) */}
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

                      <div className="flex items-center justify-between gap-1.5 text-[10px]">
                        <span className="text-[9px] text-slate-400 truncate" title={p.birthDate ? `생년월일: ${p.birthDate}` : undefined}>
                          {p.isGuest ? '미가입/임의' : '가입회원'}
                          {p.birthDate ? ` · 🎂${p.birthDate.slice(2).replace(/-/g, '.')}` : ''}
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
                              className="w-10 px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px] text-center text-sky-300 font-bold"
                            />
                            <span className="text-[9px] text-slate-400">년</span>
                          </label>
                          <label className="flex items-center gap-0.5">
                            <span className="text-[9px] text-amber-300">만</span>
                            <input
                              type="number"
                              min={10}
                              max={99}
                              value={resolvePlayerAge(p, 45)}
                              onChange={(e) =>
                                handleUpdatePlayerAge(p.id, parseInt(e.target.value, 10))
                              }
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

              {/* 임의 선수 추가 */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-amber-500/30 grid grid-cols-12 gap-1.5 items-center">
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
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

            {/* 수동모드일 때 각 게임별 출전 선수 직접 변경 패널 */}
            {activeCourt.assignMode === 'MANUAL' && (
              <div className="bg-slate-950 p-3 rounded-xl border border-amber-500/30 space-y-2">
                <span className="text-xs font-black text-amber-300 block">
                  🖐️ {activeCourt.courtNumber}번 코트 게임별 출전 선수 수동 배치
                </span>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {activeCourt.games.map((g) => (
                    <div key={g.id} className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-black text-amber-300">제 {g.gameNumber} 게임</span>
                        <span className="text-emerald-300">종합전력 {g.teamAWeight} vs {g.teamBWeight}</span>
                      </div>
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
                              className="w-full bg-slate-950 border border-emerald-500/30 rounded-lg px-1.5 py-1 text-[11px] text-emerald-300 font-bold"
                            >
                              {activeCourt.players.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.grade}·만 {resolvePlayerAge(p, 40)}세)
                                </option>
                              ))}
                            </select>
                          ))}
                        </div>
                        <div className="col-span-1 text-center text-[10px] font-black text-slate-500">VS</div>
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
                              className="w-full bg-slate-950 border border-amber-500/30 rounded-lg px-1.5 py-1 text-[11px] text-amber-300 font-bold"
                            >
                              {activeCourt.players.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.grade}·만 {resolvePlayerAge(p, 40)}세)
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

            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('kdk')}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>🎾</span>
                <span>설정 적용 완료 · KDK 파트너 순환 진행 화면으로 이동 ➔</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // [B] KDK 파트너 순환 진행 전용 뷰 (viewMode === 'PLAY')
  // - 코트별 참가인원/게임수 설정은 운영관리 센터로 이관됨
  // - 이 화면에서는 경기 결과 스코어 입력 + 게임 종료 + 종료 시 다음 대기자 선수 자동 연동만 수행
  // ============================================================================
  return (
    <div className="space-y-4">
      {/* 상단 KDK 파트너 순환 진행 헤더 */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-amber-950/60 p-3.5 rounded-2xl border border-emerald-500/30 shadow-lg space-y-2.5">
        <div className="flex justify-between items-center gap-2">
          <div>
            <h3 className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
              <span>🔄</span> KDK 파트너 순환 진행 (스코어 입력 · 게임종료 · 다음 대기자 자동연동)
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {tournamentName} · 게임 종료 시 다음 대기자 선수가 코트에 즉시 자동 연동됩니다.
            </p>
          </div>
          {isAdmin && onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab('admin')}
              className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-amber-300 border border-amber-500/40 font-black rounded-xl text-[10px] shadow-md cursor-pointer shrink-0"
            >
              ⚙️ 인원·게임수 설정 (운영관리) ➔
            </button>
          )}
        </div>

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
                    {c.players.length}명·{doneCount}/{c.games.length}G
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
          {/* 게임 종료 시 다음 대기자 자동 연동 실시간 알림 배너 */}
          {autoRotationNotice && (
            <div className="bg-emerald-950/80 border border-emerald-400/50 rounded-2xl p-3 text-xs font-extrabold text-emerald-200 flex items-center justify-between gap-2 shadow-lg">
              <span>{autoRotationNotice}</span>
              <button
                type="button"
                onClick={() => setAutoRotationNotice('')}
                className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-300 shrink-0 cursor-pointer"
              >
                닫기
              </button>
            </div>
          )}

          {/* ========================================================== */}
          {/* [KDK_V2025 시트 스타일] 상단 라운드/게임별 대진표 */}
          {/* ========================================================== */}
          <div className="bg-slate-900 border border-emerald-500/35 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                  <span>📅</span> KDK_V2025 라운드/게임별 대진표 ({activeCourt.courtNumber}번 코트)
                </span>
                <span className="text-[10px] text-slate-400">
                  (총 {activeCourt.games.length}경기 · 완료 {completedGamesCount}경기)
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span> 진행중
                </span>
                <span className="flex items-center gap-1 text-amber-300 font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span> 대기(예정)
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-500"></span> 완료
                </span>
              </div>
            </div>

            {/* KDK_V2025 라운드별 경기 카드 / 테이블 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {activeCourt.games.map((g) => {
                const isCurrentLive = !g.completed && currentPlayingGame && currentPlayingGame.id === g.id;
                const isNextWaiting = !g.completed && nextQueuedGame && nextQueuedGame.id === g.id;
                const statusLabel = g.completed ? '완료' : isCurrentLive ? '진행중' : '예정';
                const statusBadgeClass = g.completed
                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                  : isCurrentLive
                  ? 'bg-emerald-500 text-slate-950 font-black animate-pulse'
                  : isNextWaiting
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold'
                  : 'bg-slate-900 text-slate-400 border border-slate-800';

                return (
                  <div
                    key={g.id}
                    className={`rounded-xl border p-3 transition ${
                      isCurrentLive
                        ? 'bg-gradient-to-r from-emerald-950/60 via-slate-950 to-slate-950 border-emerald-400 shadow-lg ring-1 ring-emerald-400/40'
                        : g.completed
                        ? 'bg-slate-950/80 border-slate-800/80 opacity-90'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    {/* 상단: 게임 번호, 코트 번호, 상태 배지 */}
                    <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-800/70 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                          게임 {g.gameNumber}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {g.courtNumber}코트
                        </span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusBadgeClass}`}>
                        {statusLabel}
                      </span>
                    </div>

                    {/* 중단: Team A vs Team B 매치업 및 점수 */}
                    <div className="py-2 flex items-center justify-between gap-2 text-xs">
                      {/* Team A */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-black text-slate-400 mb-0.5">TEAM A</div>
                        <div className="font-black text-emerald-300 truncate">
                          {activeCourt.assignMode === 'SEED_AUTO' && activeCourt.seedPlayerIds.includes(g.teamA[0].id) && '🌟'}
                          {g.teamA[0].name}
                          <span className="text-[10px] text-slate-400 font-normal ml-1">({g.teamA[0].grade})</span>
                        </div>
                        <div className="font-black text-emerald-300 truncate">
                          {activeCourt.assignMode === 'SEED_AUTO' && activeCourt.seedPlayerIds.includes(g.teamA[1].id) && '🌟'}
                          {g.teamA[1].name}
                          <span className="text-[10px] text-slate-400 font-normal ml-1">({g.teamA[1].grade})</span>
                        </div>
                      </div>

                      {/* 점수 디스플레이 */}
                      <div className="shrink-0 flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-center">
                        <span className={`text-base font-black ${g.completed && g.scoreA > g.scoreB ? 'text-amber-300' : 'text-white'}`}>
                          {g.scoreA}
                        </span>
                        <span className="text-xs font-black text-slate-500">:</span>
                        <span className={`text-base font-black ${g.completed && g.scoreB > g.scoreA ? 'text-amber-300' : 'text-white'}`}>
                          {g.scoreB}
                        </span>
                      </div>

                      {/* Team B */}
                      <div className="flex-1 min-w-0 text-right">
                        <div className="text-[10px] font-black text-slate-400 mb-0.5">TEAM B</div>
                        <div className="font-black text-amber-300 truncate">
                          {activeCourt.assignMode === 'SEED_AUTO' && activeCourt.seedPlayerIds.includes(g.teamB[0].id) && '🌟'}
                          {g.teamB[0].name}
                          <span className="text-[10px] text-slate-400 font-normal ml-1">({g.teamB[0].grade})</span>
                        </div>
                        <div className="font-black text-amber-300 truncate">
                          {activeCourt.assignMode === 'SEED_AUTO' && activeCourt.seedPlayerIds.includes(g.teamB[1].id) && '🌟'}
                          {g.teamB[1].name}
                          <span className="text-[10px] text-slate-400 font-normal ml-1">({g.teamB[1].grade})</span>
                        </div>
                      </div>
                    </div>

                    {/* 하단: 휴식/대기 인원 */}
                    {g.resting && g.resting.length > 0 && (
                      <div className="pt-1.5 border-t border-slate-800/60 text-[10px] text-slate-400 flex items-center gap-1.5 truncate">
                        <span className="text-amber-300">☕ 휴식:</span>
                        <span className="truncate">{g.resting.map((rp) => `${rp.name}(${rp.grade})`).join(', ')}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================== */}
          {/* 1. 현재 진행 경기 & 다음 대기자 선수 자동 연동 현황 카드 */}
          {/* ========================================================== */}
          <div className="bg-slate-900 border border-emerald-500/35 rounded-2xl p-3.5 shadow-xl space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                <span>🔴</span> {activeCourt.courtNumber}번 코트 실시간 진행 & 다음 대기자 자동연동 현황
              </span>
              <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                {activeCourt.players.length}명 참여 · 1인 필수 {activeCourt.minGamesPerPlayer}G (총 {activeCourt.games.length}경기)
              </span>
            </div>

            {currentPlayingGame ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-emerald-500/40 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500 text-slate-950">
                      🔴 현재 코트 경기 중 (제 {currentPlayingGame.gameNumber} 게임)
                    </span>
                    <span className="text-xs font-black text-white">
                      {currentPlayingGame.scoreA} : {currentPlayingGame.scoreB}
                    </span>
                  </div>
                  <p className="font-black text-white">
                    <span className="text-emerald-300">
                      {currentPlayingGame.teamA[0].name}/{currentPlayingGame.teamA[1].name}
                    </span>
                    {' '}VS{' '}
                    <span className="text-amber-300">
                      {currentPlayingGame.teamB[0].name}/{currentPlayingGame.teamB[1].name}
                    </span>
                  </p>
                  {currentPlayingGame.resting && currentPlayingGame.resting.length > 0 && (
                    <p className="text-[10px] text-amber-200">
                      ☕ 현재 코트 대기(휴식) 선수:{' '}
                      <strong>{currentPlayingGame.resting.map((rp) => rp.name).join(', ')}</strong>
                    </p>
                  )}
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-amber-500/35 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      ⏳ 게임 종료 시 자동 투입 (다음 대기자)
                    </span>
                    {nextQueuedGame && (
                      <span className="text-[10px] font-bold text-slate-400">
                        제 {nextQueuedGame.gameNumber} 게임
                      </span>
                    )}
                  </div>
                  {nextQueuedGame ? (
                    <>
                      <p className="font-black text-white">
                        <span className="text-emerald-300">
                          {nextQueuedGame.teamA[0].name}/{nextQueuedGame.teamA[1].name}
                        </span>
                        {' '}VS{' '}
                        <span className="text-amber-300">
                          {nextQueuedGame.teamB[0].name}/{nextQueuedGame.teamB[1].name}
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-400">
                        현재 게임 종료 버튼을 누르면 위 대기자 조가 코트에 자동 연동됩니다.
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-400 pt-1">
                      현재 게임이 이 코트의 마지막 경기입니다. 종료 시 최종 순위가 확정됩니다.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 text-center text-xs text-emerald-300 font-bold">
                🏁 이 코트의 모든 경기가 완료되어 아래 1등 · 2등 · 3등 최종 순위 집계가 확정되었습니다!
              </div>
            )}
          </div>

          {/* ========================================================== */}
          {/* 2. 코트별 게임 스코어 입력 & 게임 종료 (종료 시 다음 대기자 자동 연동) */}
          {/* ========================================================== */}
          <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <div>
                <h4 className="text-xs font-black text-emerald-400">
                  🎾 {activeCourt.courtNumber}번 코트 경기 스코어 입력 & 게임 종료 ({completedGamesCount}/{activeCourt.games.length} 게임 완료)
                </h4>
                <p className="text-[10px] text-slate-400">
                  {isAdmin
                    ? '경기 결과에 따른 스코어를 입력하고 [🏁 게임 종료]를 누르면 다음 대기자 선수가 자동 연동됩니다.'
                    : '운영자가 입력하는 실시간 경기 진행 현황 및 스코어'}
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleFinishCourtAndAggregate(activeCourt.courtNumber)}
                  className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-[11px] shadow-md cursor-pointer"
                >
                  🏁 코트 전체종료·자동집계
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {activeCourt.games.map((g) => {
                const ageA0 = resolvePlayerAge(g.teamA[0], 40);
                const ageA1 = resolvePlayerAge(g.teamA[1], 40);
                const ageB0 = resolvePlayerAge(g.teamB[0], 40);
                const ageB1 = resolvePlayerAge(g.teamB[1], 40);
                const ageSumA = ageA0 + ageA1;
                const ageSumB = ageB0 + ageB1;
                const isCurrentLive =
                  !g.completed && currentPlayingGame && currentPlayingGame.id === g.id;
                const isNextWaiting =
                  !g.completed && nextQueuedGame && nextQueuedGame.id === g.id;

                return (
                  <div
                    key={g.id}
                    className={`bg-slate-950 p-3 rounded-xl border space-y-2.5 ${
                      g.completed
                        ? 'border-emerald-500/40 opacity-85'
                        : isCurrentLive
                        ? 'border-amber-400 ring-1 ring-amber-400/30'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex flex-wrap justify-between items-center gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-lg bg-amber-400/15 text-amber-300 border border-amber-400/30 font-black text-[10px]">
                          제 {g.gameNumber} 게임
                        </span>
                        {isCurrentLive && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px]">
                            🔴 현재 코트 진행 중
                          </span>
                        )}
                        {isNextWaiting && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 font-black text-[10px]">
                            ⏳ 다음 대기 투입 예정
                          </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold border bg-slate-900 text-slate-300 border-slate-700">
                          ⚖️ 종합전력 {g.teamAWeight} vs {g.teamBWeight}
                        </span>
                      </div>

                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleToggleGameComplete(activeCourt.courtNumber, g.id)}
                          className={`text-[10px] px-2.5 py-1 rounded-lg font-black border cursor-pointer transition ${
                            g.completed
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                              : 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 border-amber-300 shadow-sm'
                          }`}
                        >
                          {g.completed ? '✓ 게임종료됨 (재수정)' : '🏁 게임 종료 · 다음 대기자 연동'}
                        </button>
                      ) : (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-lg font-black ${
                            g.completed
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : isCurrentLive
                              ? 'bg-amber-400/20 text-amber-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {g.completed ? '✓ 경기완료' : isCurrentLive ? '🔴 진행 중' : '대기 중'}
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <div className="flex-1 text-left">
                        <p className="font-bold text-emerald-300 truncate">
                          {activeCourt.assignMode === 'SEED_AUTO' && activeCourt.seedPlayerIds.includes(g.teamA[0].id) ? '🌟' : ''}
                          {g.teamA[0].name} /{' '}
                          {activeCourt.assignMode === 'SEED_AUTO' && activeCourt.seedPlayerIds.includes(g.teamA[1].id) ? '🌟' : ''}
                          {g.teamA[1].name}
                        </p>
                        <span className="text-[9px] text-slate-400">
                          만 나이합 {ageSumA}세 ({ageA0}+{ageA1})
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mx-2 bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-800">
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateGameScore(activeCourt.courtNumber, g.id, -1, 0)
                            }
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-black cursor-pointer"
                          >
                            -
                          </button>
                        )}
                        <span className="text-base font-black text-white w-5 text-center">
                          {g.scoreA}
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateGameScore(activeCourt.courtNumber, g.id, 1, 0)
                            }
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-black cursor-pointer"
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
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-black cursor-pointer"
                          >
                            -
                          </button>
                        )}
                        <span className="text-base font-black text-white w-5 text-center">
                          {g.scoreB}
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateGameScore(activeCourt.courtNumber, g.id, 0, 1)
                            }
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-black cursor-pointer"
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
                          만 나이합 {ageSumB}세 ({ageB0}+{ageB1})
                        </span>
                      </div>
                    </div>

                    {g.resting && g.resting.length > 0 && (
                      <div className="text-[10px] text-slate-400 bg-slate-900/70 px-2.5 py-1 rounded-lg border border-slate-800/80">
                        ☕ 휴식 대기자 (다음 게임 우선 연동): {g.resting.map((rp) => `${rp.name}(${rp.grade})`).join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================== */}
          {/* 3. 코트별 자동 집계 1등·2등·3등 시상대 & 상세 순위표 (5단계 동점자 우선순위) */}
          {/* ========================================================== */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/30 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <div>
                <h4 className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                  <span>🏆</span> {activeCourt.courtNumber}번 코트 자동 집계 순위 (1등 · 2등 · 3등)
                </h4>
                <p className="text-[10px] text-slate-400">
                  정렬기준: ① 승수 ➔ ② 득실차 ➔ ③ 다득점 ➔ ④ <strong className="text-amber-300">연장자순</strong> ➔ ⑤ <strong className="text-emerald-300">하위부수순</strong>
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
                    만 나이합 {activeCourtStandings[0].ageSumWithPartners}세 (만 {activeCourtStandings[0].age}세)
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
                    만 나이합 {activeCourtStandings[1].ageSumWithPartners}세 (만 {activeCourtStandings[1].age}세)
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
                    만 나이합 {activeCourtStandings[2].ageSumWithPartners}세 (만 {activeCourtStandings[2].age}세)
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
                    <th className="py-1.5 text-left px-2">선수(급수·만나이)</th>
                    <th className="py-1.5">승-패</th>
                    <th className="py-1.5">득실</th>
                    <th className="py-1.5">득점</th>
                    <th className="py-1.5 text-amber-400">만 나이합산</th>
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
                            ({s.grade}·만 {s.age}세)
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

            {/* ========================================================== */}
            {/* [KDK_V2025 시트 하단 전용 양식] 개인별 라운드 기록표 */}
            {/* 번호/시드 | 이름 | 1round ~ Nround | 승수 | 게임 득 | 게임 실 | 득실차 | 순위 */}
            {/* ========================================================== */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                  <span>📊</span> KDK_V2025 개인별 라운드 종합 기록표 (5단계 순위 산정 기준 실시간 집계)
                </span>
                <span className="text-[10px] text-slate-400">
                  선택 게임 수({activeCourt.minGamesPerPlayer}G) 기준 동적 라운드 표시
                </span>
              </div>

              {/* 순위 산정 기준 공식 안내 배너 */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 text-[10px] text-slate-300 flex items-center justify-between flex-wrap gap-1">
                <span>
                  ※ <strong className="text-amber-300">순위 산정 기준</strong>: ① 승수 ➔ ② 득실차 ➔ ③ 다득점 ➔ ④ 연장자순(만 나이) ➔ ⑤ 하위부수순(테린이&gt;개나리&gt;동배&gt;국화&gt;은배&gt;금배)
                </span>
                <span className="text-[9px] text-slate-400">
                  * 1~3순위 동률 시 연장자/하위부수 우대 배지 표기
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/90">
                <table className="w-full text-center text-xs whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-900/90 text-slate-300 border-b border-slate-800 text-[10px] font-black">
                      <th className="py-2 px-2">번호/시드</th>
                      <th className="py-2 px-2.5 text-left">이름</th>
                      {Array.from({ length: Math.max(activeCourt.minGamesPerPlayer, 2) }).map((_, rIdx) => (
                        <th key={rIdx} className="py-2 px-2 text-emerald-300">
                          {rIdx + 1}round
                        </th>
                      ))}
                      <th className="py-2 px-2 text-amber-300 bg-amber-400/5">승수</th>
                      <th className="py-2 px-2 text-emerald-400">게임 득</th>
                      <th className="py-2 px-2 text-rose-400">게임 실</th>
                      <th className="py-2 px-2 text-cyan-300 font-extrabold bg-cyan-400/5">득실차</th>
                      <th className="py-2 px-2.5 text-amber-400 font-black">결과 순위</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-[11px]">
                    {activeCourtStandings.map((s, idx) => {
                      const roundsCount = Math.max(activeCourt.minGamesPerPlayer, 2);
                      const myRoundList = playerRoundMap[s.playerId] || [];
                      const isSeed = activeCourt.seedPlayerIds.includes(s.playerId);
                      const seedRank = activeCourt.seedPlayerIds.indexOf(s.playerId) + 1;

                      return (
                        <tr
                          key={s.playerId}
                          className={s.rank <= 3 ? 'bg-amber-400/5 font-semibold' : 'hover:bg-slate-900/40'}
                        >
                          {/* 번호 / 시드 */}
                          <td className="py-2 px-2 font-mono text-slate-400">
                            {isSeed ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[9px]">
                                {seedRank}시드
                              </span>
                            ) : (
                              <span>{idx + 1}</span>
                            )}
                          </td>

                          {/* 이름 및 등급 */}
                          <td className="py-2 px-2.5 text-left font-black text-white">
                            <span className="truncate">{s.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal ml-1">
                              ({s.grade}·만{s.age}세)
                            </span>
                          </td>

                          {/* 1round ~ Nround 동적 표시 */}
                          {Array.from({ length: roundsCount }).map((_, rIdx) => {
                            const rData = myRoundList[rIdx];
                            if (!rData) {
                              return (
                                <td key={rIdx} className="py-2 px-2 text-slate-600 font-mono text-[10px]">
                                  -
                                </td>
                              );
                            }
                            if (!rData.completed) {
                              return (
                                <td key={rIdx} className="py-2 px-2 font-mono text-[10px] text-amber-400/70 bg-amber-400/5">
                                  대기
                                </td>
                              );
                            }
                            return (
                              <td
                                key={rIdx}
                                className={`py-2 px-2 font-mono font-bold text-[10px] ${
                                  rData.isWin
                                    ? 'text-emerald-300 bg-emerald-500/10'
                                    : rData.isDraw
                                    ? 'text-slate-300'
                                    : 'text-rose-300 bg-rose-500/5'
                                }`}
                                title={`파트너: ${rData.partnerName} / 상대: ${rData.oppNames}`}
                              >
                                {rData.scoreFor}:{rData.scoreAgainst}
                              </td>
                            );
                          })}

                          {/* 승수 */}
                          <td className="py-2 px-2 font-black text-amber-300 bg-amber-400/5">
                            {s.wins}승
                          </td>

                          {/* 게임 득 */}
                          <td className="py-2 px-2 font-bold text-emerald-400">
                            {s.pointsFor}
                          </td>

                          {/* 게임 실 */}
                          <td className="py-2 px-2 font-bold text-rose-400">
                            {s.pointsAgainst}
                          </td>

                          {/* 득실차 */}
                          <td className="py-2 px-2 font-black text-cyan-300 bg-cyan-400/5">
                            {s.pointDiff >= 0 ? `+${s.pointDiff}` : s.pointDiff}
                          </td>

                          {/* 결과 순위 + 동점 사유 배지 */}
                          <td className="py-2 px-2.5 font-black text-amber-400 text-center">
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              <span>
                                {s.rank === 1 ? '🥇 1' : s.rank === 2 ? '🥈 2' : s.rank === 3 ? '🥉 3' : `${s.rank}`}
                              </span>
                              {s.tieBreakApplied && s.tieBreakReason && (
                                <span
                                  className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 font-bold"
                                  title={`동점자 판정 근거: ${s.tieBreakReason}`}
                                >
                                  {s.tieBreakReason.includes('연장자')
                                    ? '연장자 우세'
                                    : s.tieBreakReason.includes('부수')
                                    ? '부수 우세'
                                    : '동점 우대'}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
