/**
 * 테니스 어플 - KDK 대진표 자동 생성 및 코트별 실력균등·나이합산 순위 집계 엔진
 */

export type UserGrade = '금배' | '은배' | '국화' | '동배' | '개나리' | '테린이' | '고령자부';

export interface Player {
  id: string;
  name: string;
  grade: UserGrade | string;
  age?: number; // 동점 시 나이/나이합산 타이브레이커용
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

export function getPlayerWeight(grade: string): number {
  return GRADE_WEIGHTS[grade] || 6;
}

interface PlayerStatTracking {
  playCount: number;
  restCount: number;
  partners: Set<string>;
  opponents: Set<string>;
  weight: number;
}

/**
 * 단일 코트 전용 KDK 실력 균등 자동 대진 생성 함수
 * - 코트에 배정된 선수 인원 수(4명, 5명, 6명, 7명, 8명 등)와 설정 게임 수(최소 2게임 이상)에 맞춰
 *   출전 횟수 균등, 파트너 중복 최소화, 팀 간 실력 차이(Skill Gap) 0 지향 매칭 생성
 */
export function generateCourtKDKGames(
  courtNumber: number,
  courtPlayers: Player[],
  gameCount: number = 2
): CourtKdkGame[] {
  if (!courtPlayers || courtPlayers.length < 4) {
    throw new Error('코트별 KDK 경기를 진행하려면 최소 4명 이상의 선수가 필요합니다.');
  }

  const safeGames = Math.max(2, Math.floor(gameCount));
  const stats: Record<string, PlayerStatTracking> = {};
  courtPlayers.forEach((p) => {
    stats[p.id] = {
      playCount: 0,
      restCount: 0,
      partners: new Set<string>(),
      opponents: new Set<string>(),
      weight: getPlayerWeight(p.grade),
    };
  });

  const games: CourtKdkGame[] = [];

  for (let gNum = 1; gNum <= safeGames; gNum++) {
    // 출전 횟수가 가장 적은 선수 4명을 우선 선발 (인원수가 5명 이상일 때 공평한 순환 보장)
    const sortedByPlays = [...courtPlayers].sort((a, b) => {
      const diff = stats[a.id].playCount - stats[b.id].playCount;
      if (diff !== 0) return diff;
      // 동률일 때는 최근 휴식자가 먼저 나오도록
      const restDiff = stats[b.id].restCount - stats[a.id].restCount;
      if (restDiff !== 0) return restDiff;
      return Math.random() - 0.5;
    });

    // 4명 조합 후보 중 실력 균형 + 파트너 비중복 최적 4인 및 팀 페어링 탐색
    let bestSelection: {
      teamA: [Player, Player];
      teamB: [Player, Player];
      resting: Player[];
      wA: number;
      wB: number;
      penalty: number;
    } | null = null;

    const minPlayCount = stats[sortedByPlays[0].id].playCount;
    const mustInclude = sortedByPlays.filter((p) => stats[p.id].playCount === minPlayCount);
    const attemptLimit = courtPlayers.length === 4 ? 1 : 250;

    for (let attempt = 0; attempt < attemptLimit; attempt++) {
      let active4: Player[];
      if (courtPlayers.length === 4) {
        active4 = [...courtPlayers].sort((a, b) => stats[b.id].weight - stats[a.id].weight);
      } else if (attempt === 0) {
        active4 = sortedByPlays.slice(0, 4).sort((a, b) => stats[b.id].weight - stats[a.id].weight);
      } else {
        // 최소 출전 인원 그룹 내에서 랜덤 조합 시도
        const shuffledMin = [...mustInclude].sort(() => Math.random() - 0.5);
        if (shuffledMin.length >= 4) {
          active4 = shuffledMin.slice(0, 4);
        } else {
          const remaining = sortedByPlays
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

        // 실력 차이 최소화 최우선 + 파트너 중복 방지
        let penalty = skillDiff * 50 + skillDiff * skillDiff * 25;
        if (stats[teamA[0].id].partners.has(teamA[1].id)) penalty += 160;
        if (stats[teamB[0].id].partners.has(teamB[1].id)) penalty += 160;

        for (const pA of teamA) {
          for (const pB of teamB) {
            if (stats[pA.id].opponents.has(pB.id)) penalty += 12;
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
  const map: Record<string, KdkStandingRow> = {};

  players.forEach((p) => {
    const playerAge = typeof p.age === 'number' && !isNaN(p.age) ? p.age : 40;
    map[p.id] = {
      rank: 0,
      playerId: p.id,
      name: p.name,
      grade: p.grade,
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
  const ensurePlayer = (p: Player) => {
    if (!map[p.id]) {
      const playerAge = typeof p.age === 'number' && !isNaN(p.age) ? p.age : 40;
      map[p.id] = {
        rank: 0,
        playerId: p.id,
        name: p.name,
        grade: p.grade,
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

  games.forEach((g) => {
    if (!g.completed && g.scoreA === 0 && g.scoreB === 0) return;

    [...g.teamA, ...g.teamB].forEach(ensurePlayer);

    const aWon = g.scoreA > g.scoreB;
    const bWon = g.scoreB > g.scoreA;
    const isDraw = g.scoreA === g.scoreB;

    const teamAAgeSum = (map[g.teamA[0].id].age || 40) + (map[g.teamA[1].id].age || 40);
    const teamBAgeSum = (map[g.teamB[0].id].age || 40) + (map[g.teamB[1].id].age || 40);

    g.teamA.forEach((p) => {
      const row = map[p.id];
      row.matches += 1;
      row.pointsFor += g.scoreA;
      row.pointsAgainst += g.scoreB;
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
      const row = map[p.id];
      row.matches += 1;
      row.pointsFor += g.scoreB;
      row.pointsAgainst += g.scoreA;
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
      row.tieBreakReason = `동점→나이합산(${row.ageSumWithPartners}세)`;
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
      weight: GRADE_WEIGHTS[p.grade] || 6,
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
