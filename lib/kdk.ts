/**
 * 테니스 어플 - KDK 대진표 자동 생성 알고리즘 (TypeScript 정의 포함)
 */

export type UserGrade = '금배' | '은배' | '국화' | '동배' | '개나리' | '테린이' | '고령자부';

export interface Player {
  id: string;
  name: string;
  grade: UserGrade | string;
}

export interface MatchPair {
  courtNumber: number;
  teamA: [Player, Player];
  teamB: [Player, Player];
}

export interface RoundSchedule {
  round: number;
  matches: MatchPair[];
  resting: Player[];
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

interface PlayerStatTracking {
  playCount: number;
  restCount: number;
  partners: Set<string>;
  opponents: Set<string>;
  weight: number;
}

/**
 * KDK 대진표 자동 생성 함수
 * @param players 참가자 목록 [{ id, name, grade }, ...]
 * @param numCourts 사용 가능한 코트 수
 * @param totalRounds 진행할 총 라운드 수 (기본값: 4)
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
      weight: GRADE_WEIGHTS[p.grade] || 5,
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

    for (let attempt = 0; attempt < 300; attempt++) {
      const shuffled = [...activePlayers].sort(() => Math.random() - 0.5);
      const currentMatches: MatchPair[] = [];
      let penalty = 0;

      for (let i = 0; i < shuffled.length; i += 4) {
        const group = shuffled.slice(i, i + 4);
        const pairings: [[[Player, Player], [Player, Player]], [[Player, Player], [Player, Player]], [[Player, Player], [Player, Player]]] = [
          [[[group[0], group[1]], [group[2], group[3]]]],
          [[[group[0], group[2]], [group[1], group[3]]]],
          [[[group[0], group[3]], [group[1], group[2]]]],
        ].map((item) => item[0]) as any;

        let bestPair = pairings[0];
        let bestPairPenalty = Infinity;

        for (const [teamA, teamB] of pairings) {
          let pairPenalty = 0;

          if (stats[teamA[0].id].partners.has(teamA[1].id)) pairPenalty += 100;
          if (stats[teamB[0].id].partners.has(teamB[1].id)) pairPenalty += 100;

          for (const pA of teamA) {
            for (const pB of teamB) {
              if (stats[pA.id].opponents.has(pB.id)) pairPenalty += 20;
            }
          }

          const weightA = stats[teamA[0].id].weight + stats[teamA[1].id].weight;
          const weightB = stats[teamB[0].id].weight + stats[teamB[1].id].weight;
          pairPenalty += Math.abs(weightA - weightB) * 5;

          if (pairPenalty < bestPairPenalty) {
            bestPairPenalty = pairPenalty;
            bestPair = [teamA, teamB];
          }
        }

        penalty += bestPairPenalty;
        currentMatches.push({
          courtNumber: i / 4 + 1,
          teamA: bestPair[0] as [Player, Player],
          teamB: bestPair[1] as [Player, Player],
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

/**
 * DB matches 테이블 포맷 변환 어댑터
 */
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
