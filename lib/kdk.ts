/**
 * 테니스 어플 - KDK 대진표 자동 생성 및 코트별 실력균등·나이합산 순위 집계 엔진
 */

import { calculateKoreanManAge } from './age';

export type UserGrade = '금배' | '은배' | '국화' | '동배' | '개나리' | '테린이' | '고령자부';
export type KdkAssignMode = 'AUTO' | 'SEED_AUTO' | 'MANUAL';

export interface Player {
  id: string;
  name: string;
  grade: UserGrade | string;
  birthDate?: string; // 생년월일 (YYYY-MM-DD) — 만 나이 자동 계산 및 실력 균등 배정용
  age?: number; // 만 나이 (실력 종합지수 보정 및 동점 시 나이합산 타이브레이커용)
  experienceYears?: number; // 구력(년) — 실력 균등 자동모드·시드배정 반영
  isSeed?: boolean; // 코트별 실력자 우선 시드 여부
  gender?: string;
  isGuest?: boolean;
}

export interface MatchPair {
  courtNumber: number;
  gameNumber?: number;
  teamA: [Player, Player];
  teamB: [Player, Player];
  teamAWeight?: number;
  teamBWeight?: number;
  skillDiff?: number;
  resting?: Player[];
}

export interface RoundSchedule {
  round: number;
  matches: MatchPair[];
  resting: Player[];
}

export interface CourtKdkGame {
  id: string;
  courtNumber: number;
  gameNumber: number;
  teamA: [Player, Player];
  teamB: [Player, Player];
  teamAWeight: number;
  teamBWeight: number;
  skillDiff: number;
  resting: Player[];
  scoreA: number;
  scoreB: number;
  completed: boolean;
}

export interface KdkStandingRow {
  rank: number;
  playerId: string;
  name: string;
  grade: string;
  age: number;
  ageSumWithPartners: number; // 함께 경기한 파트너 나이 포함 합산 (동점 타이브레이커)
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  winPoints: number; // 승점 (승 3, 무 1, 패 0)
  tieBreakApplied?: boolean;
  tieBreakReason?: string;
}

export interface DbMatchInsert {
  tournament_id: string;
  round_name: string;
  court_number: number;
  team_a: [string, string];
  team_b: [string, string];
  score_a: number;
  score_b: number;
  status: 'waiting' | 'playing' | 'completed';
}

export const GRADE_WEIGHTS: Record<string, number> = {
  '금배': 10,
  '은배': 8,
  '국화': 7,
  '동배': 6,
  '개나리': 5,
  '고령자부': 5,
  '테린이': 3,
};

// 종합 실력 지수 산출용 등급 기본 점수 (금배·은배·국화·동배·개나리·고령자부·테린이)
export const GRADE_COMPOSITE_BASE: Record<string, number> = {
  '금배': 100,
  '은배': 84,
  '국화': 76,
  '동배': 68,
  '개나리': 58,
  '고령자부': 54,
  '테린이': 36,
};

// 구력(년) 미입력 시 등급별 기본 추정 구력
export const DEFAULT_EXPERIENCE_BY_GRADE: Record<string, number> = {
  '금배': 10,
  '은배': 7,
  '국화': 7,
  '동배': 5,
  '개나리': 3,
  '고령자부': 8,
  '테린이': 1,
};

export function getPlayerWeight(grade: string): number {
  return GRADE_WEIGHTS[grade] || 6;
}

export function getPlayerExperienceYears(player: Pick<Player, 'grade' | 'experienceYears'>): number {
  if (typeof player.experienceYears === 'number' && !isNaN(player.experienceYears)) {
    return Math.max(0, Math.min(40, Math.round(player.experienceYears)));
  }
  return DEFAULT_EXPERIENCE_BY_GRADE[player.grade] ?? 4;
}

/**
 * 선수의 생년월일(birthDate) 기준 만 나이를 최우선 산출하고, 미입력 시 age 또는 기본값 반환
 */
export function resolvePlayerAge(
  player?: Pick<Player, 'birthDate' | 'age'> | null,
  fallback: number = 46
): number {
  if (!player) return fallback;
  const fromBirth = calculateKoreanManAge(player.birthDate);
  if (fromBirth !== null) return fromBirth;
  if (typeof player.age === 'number' && !isNaN(player.age) && player.age > 0) {
    return Math.round(player.age);
  }
  return fallback;
}

/**
 * 종합 실력 지수 계산 (구력 + 등급[금배·은배·동배·국화·개나리·테린이·고령자부] + 만 나이 반영)
 * - 등급 기본점수: 36 ~ 100점
 * - 구력 가산점: 구력 1년당 +1.5점 (최대 +30점)
 * - 만 나이 보정: 만 50세 기준, 젊을수록 체력 보정(+), 연장자 체력 보정(-) (-10 ~ +8점)
 */
export function getCompositeSkillScore(
  player?: Pick<Player, 'grade' | 'age' | 'birthDate' | 'experienceYears'> | null
): number {
  if (!player) return 64;
  const gradeBase = GRADE_COMPOSITE_BASE[player.grade] ?? 64;
  const expYears = getPlayerExperienceYears(player);
  const expBonus = Math.min(20, expYears) * 1.5;
  const ageVal = resolvePlayerAge(player, 46);
  const ageAdjust = Math.max(-10, Math.min(8, Math.round((50 - ageVal) * 0.28)));
  return Math.max(20, Math.round(gradeBase + expBonus + ageAdjust));
}

/**
 * 참여인원 수(N)와 1인 필수 최소 게임 수(M)를 바탕으로
 * 모든 참여 인원이 필수로 M게임 이상 출전하기 위해 필요한 코트 총 경기 수 계산
 * - 복식 1경기당 4명 출전 ➔ 필요 경기 수 = ceil(N * M / 4)
 */
export function calculateRequiredCourtGames(
  playerCount: number,
  minGamesPerPlayer: number = 2
): number {
  const safeMinPerPlayer = Math.max(2, Math.floor(minGamesPerPlayer || 2));
  if (!playerCount || playerCount < 4) return safeMinPerPlayer;
  return Math.max(safeMinPerPlayer, Math.ceil((playerCount * safeMinPerPlayer) / 4));
}

export interface GenerateCourtKdkOptions {
  /** 참여인원 1인당 필수로 해야 하는 최소 게임 수 (기본 2게임) */
  minGamesPerPlayer?: number;
  /** 대진 편성 모드: 실력균등 자동('AUTO') | 실력자 시드우선 자동('SEED_AUTO') | 수동('MANUAL') */
  assignMode?: KdkAssignMode;
  /** SEED_AUTO 모드에서 코트별 실력자 우선 시드 선수 ID 목록 (미지정 시 종합실력 상위 2명 자동 시드) */
  seedPlayerIds?: string[];
  /** 운영자가 필요 최소 경기 수 이상으로 추가 경기를 늘리고 싶을 때 지정 */
  overrideTotalGames?: number;
}

export interface SeedDistributedCourtResult {
  courtNumber: number;
  seedPlayerIds: string[];
  players: Player[];
}

/**
 * 전체 코트 대상: 코트별 실력자 우선 시드 배정 후 나머지 인원 자동 균등 배정
 * 1단계: 종합 실력(등급+구력+나이) 최상위 실력자들을 각 코트의 1·2번 시드로 우선 분산 배치
 * 2단계: 나머지 인원들을 스네이크 드래프트 방식으로 각 코트에 자동 균등 배정
 */
export function distributePlayersSeedFirstToCourts(
  allPlayers: Player[],
  courtNumbers: number[],
  seedsPerCourt: number = 2
): SeedDistributedCourtResult[] {
  if (!courtNumbers || courtNumbers.length === 0) return [];
  const sortedBySkill = [...allPlayers].sort(
    (a, b) => getCompositeSkillScore(b) - getCompositeSkillScore(a)
  );

  const buckets: SeedDistributedCourtResult[] = courtNumbers.map((num) => ({
    courtNumber: num,
    seedPlayerIds: [],
    players: [],
  }));

  const numCourts = buckets.length;
  const maxSeeds = Math.min(sortedBySkill.length, numCourts * Math.max(1, seedsPerCourt));

  // 1단계: 실력자 우선 시드 배정 (1번 시드 정순, 2번 시드 역순 스네이크)
  for (let i = 0; i < maxSeeds; i++) {
    const roundIdx = Math.floor(i / numCourts);
    const posInRound = i % numCourts;
    const courtIdx = roundIdx % 2 === 0 ? posInRound : numCourts - 1 - posInRound;
    const p = { ...sortedBySkill[i], isSeed: true };
    buckets[courtIdx].players.push(p);
    buckets[courtIdx].seedPlayerIds.push(p.id);
  }

  // 2단계: 나머지 인원 자동 균등 배정 (스네이크 방식으로 코트별 인원·실력 균형)
  const remaining = sortedBySkill.slice(maxSeeds);
  remaining.forEach((rawPlayer, idx) => {
    const roundIdx = Math.floor(idx / numCourts);
    const posInRound = idx % numCourts;
    const courtIdx = roundIdx % 2 === 0 ? posInRound : numCourts - 1 - posInRound;
    buckets[courtIdx].players.push({ ...rawPlayer, isSeed: false });
  });

  return buckets;
}

interface PlayerStatTracking {
  playCount: number;
  restCount: number;
  partners: Set<string>;
  opponents: Set<string>;
  weight: number;
  isSeed: boolean;
}

/**
 * 단일 코트 전용 KDK 대진 자동 생성 함수
 * - minGamesPerPlayer(참여인원 1인당 필수 최소 게임 수)를 모든 참여 선수가 필수로 채우도록 총 경기 수 자동 산출 및 출전 우선 배정
 * - 실력 균등 자동모드('AUTO'): 구력 + 등급(금배·은배·동배·국화·개나리·테린이·고령자부) + 나이 종합 실력 지수 기반 팀 실력차 최소화
 * - 시드 우선 자동모드('SEED_AUTO'): 코트별 실력자 시드를 양 팀 핵심으로 우선 배치하고 나머지 인원을 실력 균등 자동 매칭
 */
export function generateCourtKDKGames(
  courtNumber: number,
  courtPlayers: Player[],
  minGamesPerPlayer: number = 2,
  options?: GenerateCourtKdkOptions
): CourtKdkGame[] {
  if (!courtPlayers || courtPlayers.length < 4) {
    throw new Error('코트별 KDK 경기를 진행하려면 최소 4명 이상의 선수가 필요합니다.');
  }

  const mandatoryPerPlayer = Math.max(
    2,
    Math.floor(options?.minGamesPerPlayer ?? minGamesPerPlayer ?? 2)
  );
  const requiredCourtGames = calculateRequiredCourtGames(
    courtPlayers.length,
    mandatoryPerPlayer
  );
  const totalGames = Math.max(
    requiredCourtGames,
    Math.floor(options?.overrideTotalGames ?? requiredCourtGames)
  );
  const mode: KdkAssignMode = options?.assignMode || 'AUTO';

  // 시드 우선 모드 시드 선수 결정 (지정 시드가 있으면 우선 사용, 없으면 종합실력 상위 2명 자동 지정)
  const sortedBySkill = [...courtPlayers].sort(
    (a, b) => getCompositeSkillScore(b) - getCompositeSkillScore(a)
  );
  const explicitSeedIds = (options?.seedPlayerIds || []).filter((id) =>
    courtPlayers.some((p) => p.id === id)
  );
  const autoSeedCount = courtPlayers.length >= 6 ? 2 : Math.min(2, courtPlayers.length);
  const resolvedSeedList =
    mode === 'SEED_AUTO'
      ? explicitSeedIds.length > 0
        ? explicitSeedIds
        : sortedBySkill.slice(0, autoSeedCount).map((p) => p.id)
      : [];
  const resolvedSeedSet = new Set<string>(resolvedSeedList);

  // 시드 순번(0-based rank) 매핑: 0 = 1시드, 1 = 2시드, ...
  const seedRankMap: Record<string, number> = {};
  resolvedSeedList.forEach((id, idx) => {
    seedRankMap[id] = idx;
  });

  const stats: Record<string, PlayerStatTracking> = {};
  courtPlayers.forEach((p) => {
    stats[p.id] = {
      playCount: 0,
      restCount: 0,
      partners: new Set<string>(),
      opponents: new Set<string>(),
      weight: getCompositeSkillScore(p),
      isSeed: resolvedSeedSet.has(p.id),
    };
  });

  const games: CourtKdkGame[] = [];

  for (let gNum = 1; gNum <= totalGames; gNum++) {
    // 1순위: 아직 1인 필수 최소 게임 수(mandatoryPerPlayer)를 못 채운 선수 최우선
    // 2순위: 출전 횟수가 가장 적은 선수 우선
    // 3순위: 휴식 횟수가 많은 선수 우선
    const sortedByNeed = [...courtPlayers].sort((a, b) => {
      const aNeedsMandatory = stats[a.id].playCount < mandatoryPerPlayer ? 0 : 1;
      const bNeedsMandatory = stats[b.id].playCount < mandatoryPerPlayer ? 0 : 1;
      if (aNeedsMandatory !== bNeedsMandatory) return aNeedsMandatory - bNeedsMandatory;

      const diff = stats[a.id].playCount - stats[b.id].playCount;
      if (diff !== 0) return diff;

      const restDiff = stats[b.id].restCount - stats[a.id].restCount;
      if (restDiff !== 0) return restDiff;

      return Math.random() - 0.5;
    });

    let bestSelection: {
      teamA: [Player, Player];
      teamB: [Player, Player];
      resting: Player[];
      wA: number;
      wB: number;
      penalty: number;
    } | null = null;

    const minPlayCount = stats[sortedByNeed[0].id].playCount;
    const mustInclude = sortedByNeed.filter((p) => stats[p.id].playCount === minPlayCount);
    const attemptLimit = courtPlayers.length === 4 ? 1 : 260;

    for (let attempt = 0; attempt < attemptLimit; attempt++) {
      let active4: Player[];
      if (courtPlayers.length === 4) {
        active4 = [...courtPlayers].sort((a, b) => stats[b.id].weight - stats[a.id].weight);
      } else if (attempt === 0) {
        active4 = sortedByNeed.slice(0, 4).sort((a, b) => stats[b.id].weight - stats[a.id].weight);
      } else {
        const shuffledMin = [...mustInclude].sort(() => Math.random() - 0.5);
        if (shuffledMin.length >= 4) {
          active4 = shuffledMin.slice(0, 4);
        } else {
          const remaining = sortedByNeed
            .filter((p) => !shuffledMin.some((m) => m.id === p.id))
            .sort(() => Math.random() - 0.5);
          active4 = [...shuffledMin, ...remaining.slice(0, 4 - shuffledMin.length)];
        }
        active4.sort((a, b) => stats[b.id].weight - stats[a.id].weight);
      }

      const activeIds = new Set(active4.map((p) => p.id));
      const resting = courtPlayers.filter((p) => !activeIds.has(p.id));

      const pairings: [[Player, Player], [Player, Player]][] = [
        [[active4[0], active4[3]], [active4[1], active4[2]]], // 고+저 vs 중+중
        [[active4[0], active4[2]], [active4[1], active4[3]]],
        [[active4[0], active4[1]], [active4[2], active4[3]]],
      ];

      for (const [teamA, teamB] of pairings) {
        const wA = stats[teamA[0].id].weight + stats[teamA[1].id].weight;
        const wB = stats[teamB[0].id].weight + stats[teamB[1].id].weight;
        const skillDiff = Math.abs(wA - wB);

        // 종합 실력(등급+구력+나이) 차이 최소화 + 파트너 중복 방지
        let penalty = skillDiff * 24 + skillDiff * skillDiff * 3;

        // SEED_AUTO 모드: 시드 선수가 2명 이상 출전한 경기에서 시드끼리 한 팀에 몰리지 않고 양 팀으로 균형 분산 배치
        if (mode === 'SEED_AUTO') {
          const seedsA = teamA.filter((p) => resolvedSeedSet.has(p.id));
          const seedsB = teamB.filter((p) => resolvedSeedSet.has(p.id));
          const totalSeedsInGame = seedsA.length + seedsB.length;

          if (totalSeedsInGame >= 2) {
            // 양 팀 간 시드 선수 수의 차이가 벌어지면 매우 강한 페널티 (2:0, 3:1 등 몰림 방지)
            const countDiff = Math.abs(seedsA.length - seedsB.length);
            if (countDiff > 0) {
              penalty += countDiff * 950;
            }

            // 시드 순번(Rank) 기준 균형 분산 (예: 1시드와 2시드가 상대편으로 갈라지도록, 또는 홀수/짝수 균형)
            // 각 팀 시드 순번의 합격 페널티 비교
            const seedRanksA = seedsA.map((p) => seedRankMap[p.id] ?? 99);
            const seedRanksB = seedsB.map((p) => seedRankMap[p.id] ?? 99);

            // 1시드와 2시드가 동시에 들어왔는데 같은 팀이면 추가 페널티
            const hasSeed0InA = seedRanksA.includes(0);
            const hasSeed1InA = seedRanksA.includes(1);
            const hasSeed0InB = seedRanksB.includes(0);
            const hasSeed1InB = seedRanksB.includes(1);
            if ((hasSeed0InA && hasSeed1InA) || (hasSeed0InB && hasSeed1InB)) {
              penalty += 600;
            }

            // 3시드와 4시드가 같은 팀일 때도 완만한 페널티
            const hasSeed2InA = seedRanksA.includes(2);
            const hasSeed3InA = seedRanksA.includes(3);
            const hasSeed2InB = seedRanksB.includes(2);
            const hasSeed3InB = seedRanksB.includes(3);
            if ((hasSeed2InA && hasSeed3InA) || (hasSeed2InB && hasSeed3InB)) {
              penalty += 300;
            }
          }
        }

        if (stats[teamA[0].id].partners.has(teamA[1].id)) penalty += 320;
        if (stats[teamB[0].id].partners.has(teamB[1].id)) penalty += 320;

        for (const pA of teamA) {
          for (const pB of teamB) {
            if (stats[pA.id].opponents.has(pB.id)) penalty += 25;
          }
        }

        if (!bestSelection || penalty < bestSelection.penalty) {
          bestSelection = { teamA, teamB, resting, wA, wB, penalty };
        }
      }

      if (bestSelection && bestSelection.penalty === 0) break;
    }

    if (bestSelection) {
      const { teamA, teamB, resting, wA, wB } = bestSelection;
      [...teamA, ...teamB].forEach((p) => stats[p.id].playCount++);
      resting.forEach((p) => stats[p.id].restCount++);

      stats[teamA[0].id].partners.add(teamA[1].id);
      stats[teamA[1].id].partners.add(teamA[0].id);
      stats[teamB[0].id].partners.add(teamB[1].id);
      stats[teamB[1].id].partners.add(teamB[0].id);

      for (const pA of teamA) {
        for (const pB of teamB) {
          stats[pA.id].opponents.add(pB.id);
          stats[pB.id].opponents.add(pA.id);
        }
      }

      games.push({
        id: `c${courtNumber}_g${gNum}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        courtNumber,
        gameNumber: gNum,
        teamA,
        teamB,
        teamAWeight: wA,
        teamBWeight: wB,
        skillDiff: Math.abs(wA - wB),
        resting,
        scoreA: 0,
        scoreB: 0,
        completed: false,
      });
    }
  }

  return games;
}

/**
 * 코트별 또는 전체 KDK 경기 결과 자동 집계 및 1등/2등/3등 순위 산출
 * - 정렬 기준:
 *   1) 승수(wins) 높은 순
 *   2) 득실차(pointDiff) 높은 순
 *   3) 총 득점(pointsFor) 높은 순
 *   4) 동점 시 나이합산(ageSumWithPartners: 본인 나이 + 파트너 나이 합산, 동률 시 본인 나이 연장자 우선)
 */
export function calculateKdkStandingsWithAgeTiebreak(
  players: Player[],
  games: CourtKdkGame[]
): KdkStandingRow[] {
  const safePlayers = Array.isArray(players) ? players.filter((p): p is Player => Boolean(p && p.id)) : [];
  const safeGames = Array.isArray(games) ? games.filter(Boolean) : [];
  const map: Record<string, KdkStandingRow> = {};

  safePlayers.forEach((p) => {
    const playerAge = resolvePlayerAge(p, 40);
    map[p.id] = {
      rank: 0,
      playerId: p.id,
      name: p.name || '선수',
      grade: p.grade || '동배',
      age: playerAge,
      ageSumWithPartners: 0,
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
      winPoints: 0,
      tieBreakApplied: false,
    };
  });

  // 경기 내 등장한 선수 중 players 배열에 누락된 선수가 있으면 자동 보완
  const ensurePlayer = (p?: Player | null) => {
    if (!p || !p.id) return;
    if (!map[p.id]) {
      const playerAge = resolvePlayerAge(p, 40);
      map[p.id] = {
        rank: 0,
        playerId: p.id,
        name: p.name || '선수',
        grade: p.grade || '동배',
        age: playerAge,
        ageSumWithPartners: 0,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDiff: 0,
        winPoints: 0,
        tieBreakApplied: false,
      };
    }
  };

  safeGames.forEach((g) => {
    if (!g || !Array.isArray(g.teamA) || !Array.isArray(g.teamB)) return;
    if (!g.teamA[0] || !g.teamA[1] || !g.teamB[0] || !g.teamB[1]) return;
    if (!g.completed && g.scoreA === 0 && g.scoreB === 0) return;

    [...g.teamA, ...g.teamB].forEach(ensurePlayer);

    const aWon = g.scoreA > g.scoreB;
    const bWon = g.scoreB > g.scoreA;
    const isDraw = g.scoreA === g.scoreB;

    const teamAAgeSum = (map[g.teamA[0].id]?.age || 40) + (map[g.teamA[1].id]?.age || 40);
    const teamBAgeSum = (map[g.teamB[0].id]?.age || 40) + (map[g.teamB[1].id]?.age || 40);

    g.teamA.forEach((p) => {
      if (!p || !map[p.id]) return;
      const row = map[p.id];
      row.matches += 1;
      row.pointsFor += Number(g.scoreA || 0);
      row.pointsAgainst += Number(g.scoreB || 0);
      row.pointDiff = row.pointsFor - row.pointsAgainst;
      row.ageSumWithPartners += teamAAgeSum;
      if (aWon) {
        row.wins += 1;
        row.winPoints += 3;
      } else if (isDraw) {
        row.draws += 1;
        row.winPoints += 1;
      } else {
        row.losses += 1;
      }
    });

    g.teamB.forEach((p) => {
      if (!p || !map[p.id]) return;
      const row = map[p.id];
      row.matches += 1;
      row.pointsFor += Number(g.scoreB || 0);
      row.pointsAgainst += Number(g.scoreA || 0);
      row.pointDiff = row.pointsFor - row.pointsAgainst;
      row.ageSumWithPartners += teamBAgeSum;
      if (bWon) {
        row.wins += 1;
        row.winPoints += 3;
      } else if (isDraw) {
        row.draws += 1;
        row.winPoints += 1;
      } else {
        row.losses += 1;
      }
    });
  });

  // 경기를 아직 치르지 않은 경우 기본 ageSumWithPartners는 본인 나이로 초기화
  Object.values(map).forEach((row) => {
    if (row.matches === 0) {
      row.ageSumWithPartners = row.age;
    }
  });

  const sorted = Object.values(map).sort((a, b) => {
    // 1. 승수
    if (b.wins !== a.wins) return b.wins - a.wins;
    // 2. 득실차
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
    // 3. 총 득점
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    // 4. 동점 시 나이합산(팀 나이합산 누적 높은 순 -> 동률 시 개인 연장자 순)
    if (b.ageSumWithPartners !== a.ageSumWithPartners) {
      return b.ageSumWithPartners - a.ageSumWithPartners;
    }
    return b.age - a.age;
  });

  // 동점(승수·득실차·득점 동일)으로 나이합산 타이브레이커가 적용된 선수 표시
  sorted.forEach((row, idx) => {
    row.rank = idx + 1;
    const prev = idx > 0 ? sorted[idx - 1] : null;
    const next = idx < sorted.length - 1 ? sorted[idx + 1] : null;
    const tiedWithPrev =
      prev &&
      prev.matches > 0 &&
      prev.wins === row.wins &&
      prev.pointDiff === row.pointDiff &&
      prev.pointsFor === row.pointsFor;
    const tiedWithNext =
      next &&
      next.matches > 0 &&
      next.wins === row.wins &&
      next.pointDiff === row.pointDiff &&
      next.pointsFor === row.pointsFor;

    if (tiedWithPrev || tiedWithNext) {
      row.tieBreakApplied = true;
      row.tieBreakReason = `동점→만 나이합산(${row.ageSumWithPartners}세)`;
    }
  });

  return sorted;
}

/**
 * 전체 다중 코트 KDK 대진표 자동 생성 함수 (팀 간 경기 실력 차이 0 지향 밸런스 매칭)
 */
export function generateKDKSchedule(
  players: Player[],
  numCourts: number,
  totalRounds: number = 4
): RoundSchedule[] {
  if (!players || players.length < 4) {
    throw new Error('최소 4명 이상의 참가자가 필요합니다.');
  }
  if (!numCourts || numCourts < 1) {
    throw new Error('최소 1개 이상의 코트가 필요합니다.');
  }

  const schedule: RoundSchedule[] = [];

  const stats: Record<string, PlayerStatTracking> = {};
  players.forEach((p) => {
    stats[p.id] = {
      playCount: 0,
      restCount: 0,
      partners: new Set<string>(),
      opponents: new Set<string>(),
      weight: getCompositeSkillScore(p),
      isSeed: Boolean(p.isSeed),
    };
  });

  const maxPlayersPerRound = Math.min(players.length, numCourts * 4);
  const activeCount = Math.floor(maxPlayersPerRound / 4) * 4;

  for (let round = 1; round <= totalRounds; round++) {
    const sortedPlayers = [...players].sort((a, b) => {
      if (stats[a.id].playCount !== stats[b.id].playCount) {
        return stats[a.id].playCount - stats[b.id].playCount;
      }
      return Math.random() - 0.5;
    });

    const activePlayers = sortedPlayers.slice(0, activeCount);
    const restingPlayers = sortedPlayers.slice(activeCount);

    restingPlayers.forEach((p) => stats[p.id].restCount++);

    let bestMatches: MatchPair[] | null = null;
    let lowestPenalty = Infinity;

    for (let attempt = 0; attempt < 500; attempt++) {
      let candidatePool: Player[];
      if (attempt === 0) {
        candidatePool = [...activePlayers].sort(
          (a, b) => stats[b.id].weight - stats[a.id].weight
        );
      } else {
        candidatePool = [...activePlayers].sort(() => Math.random() - 0.5);
      }

      const currentMatches: MatchPair[] = [];
      let penalty = 0;

      for (let i = 0; i < candidatePool.length; i += 4) {
        const group = candidatePool.slice(i, i + 4);
        const pairings: [[Player, Player], [Player, Player]][] = [
          [[group[0], group[3]], [group[1], group[2]]],
          [[group[0], group[2]], [group[1], group[3]]],
          [[group[0], group[1]], [group[2], group[3]]],
        ];

        let bestPair = pairings[0];
        let bestPairPenalty = Infinity;
        let bestWeightA = 0;
        let bestWeightB = 0;

        for (const [teamA, teamB] of pairings) {
          let pairPenalty = 0;

          const weightA = stats[teamA[0].id].weight + stats[teamA[1].id].weight;
          const weightB = stats[teamB[0].id].weight + stats[teamB[1].id].weight;
          const diff = Math.abs(weightA - weightB);
          pairPenalty += diff * 45 + diff * diff * 20;

          if (stats[teamA[0].id].partners.has(teamA[1].id)) pairPenalty += 150;
          if (stats[teamB[0].id].partners.has(teamB[1].id)) pairPenalty += 150;

          for (const pA of teamA) {
            for (const pB of teamB) {
              if (stats[pA.id].opponents.has(pB.id)) pairPenalty += 15;
            }
          }

          if (pairPenalty < bestPairPenalty) {
            bestPairPenalty = pairPenalty;
            bestPair = [teamA, teamB];
            bestWeightA = weightA;
            bestWeightB = weightB;
          }
        }

        penalty += bestPairPenalty;
        currentMatches.push({
          courtNumber: i / 4 + 1,
          teamA: bestPair[0],
          teamB: bestPair[1],
          teamAWeight: bestWeightA,
          teamBWeight: bestWeightB,
          skillDiff: Math.abs(bestWeightA - bestWeightB),
        });
      }

      if (penalty < lowestPenalty) {
        lowestPenalty = penalty;
        bestMatches = currentMatches;
      }
      if (lowestPenalty === 0) break;
    }

    if (bestMatches) {
      bestMatches.forEach(({ teamA, teamB }) => {
        [...teamA, ...teamB].forEach((p) => stats[p.id].playCount++);

        stats[teamA[0].id].partners.add(teamA[1].id);
        stats[teamA[1].id].partners.add(teamA[0].id);
        stats[teamB[0].id].partners.add(teamB[1].id);
        stats[teamB[1].id].partners.add(teamB[0].id);

        for (const pA of teamA) {
          for (const pB of teamB) {
            stats[pA.id].opponents.add(pB.id);
            stats[pB.id].opponents.add(pA.id);
          }
        }
      });

      schedule.push({
        round,
        matches: bestMatches,
        resting: restingPlayers,
      });
    }
  }

  return schedule;
}

export function transformKDKToDbMatches(tournamentId: string, schedule: RoundSchedule[]): DbMatchInsert[] {
  const dbMatches: DbMatchInsert[] = [];
  schedule.forEach((r) => {
    r.matches.forEach((m) => {
      dbMatches.push({
        tournament_id: tournamentId,
        round_name: `${r.round}라운드`,
        court_number: m.courtNumber,
        team_a: [m.teamA[0].id, m.teamA[1].id],
        team_b: [m.teamB[0].id, m.teamB[1].id],
        score_a: 0,
        score_b: 0,
        status: 'waiting',
      });
    });
  });
  return dbMatches;
}
