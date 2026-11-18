/**
 * 테니스 어플 - KDK 대진표 자동 생성 알고리즘 모듈 (경기 실력 차이 최소화 밸런싱 엔진)
 */

const GRADE_WEIGHTS = {
  '금배': 10,
  '은배': 8,
  '국화': 7,
  '동배': 6,
  '개나리': 5,
  '고령자부': 5,
  '테린이': 3,
};

function generateKDKSchedule(players, numCourts, totalRounds = 4) {
  if (!players || players.length < 4) {
    throw new Error('최소 4명 이상의 참가자가 필요합니다.');
  }
  if (!numCourts || numCourts < 1) {
    throw new Error('최소 1개 이상의 코트가 필요합니다.');
  }

  const schedule = [];

  const stats = {};
  players.forEach((p) => {
    stats[p.id] = {
      playCount: 0,
      restCount: 0,
      partners: new Set(),
      opponents: new Set(),
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

    let bestMatches = null;
    let lowestPenalty = Infinity;

    for (let attempt = 0; attempt < 500; attempt++) {
      let candidatePool;
      if (attempt === 0) {
        candidatePool = [...activePlayers].sort(
          (a, b) => stats[b.id].weight - stats[a.id].weight
        );
      } else {
        candidatePool = [...activePlayers].sort(() => Math.random() - 0.5);
      }

      const currentMatches = [];
      let penalty = 0;

      for (let i = 0; i < candidatePool.length; i += 4) {
        const group = candidatePool.slice(i, i + 4);
        const pairings = [
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

  return schedule;
}

function transformKDKToDbMatches(tournamentId, schedule) {
  const dbMatches = [];
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GRADE_WEIGHTS,
    generateKDKSchedule,
    transformKDKToDbMatches,
  };
}
