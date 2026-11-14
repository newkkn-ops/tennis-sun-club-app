/**
 * 테니스 어플 - KDK 대진표 자동 생성 알고리즘 모듈
 */

/**
 * 등급별 실력 가중치 정의 (밸런스 매칭용)
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

/**
 * KDK 대진표 자동 생성 함수
 * @param {Array} players - [{ id, name, grade }, ...]
 * @param {number} numCourts - 사용 가능한 코트 수
 * @param {number} totalRounds - 진행할 총 라운드 수 (기본 4라운드)
 * @returns {Array} 라운드별 코트 매칭 및 휴식자 명단
 */
function generateKDKSchedule(players, numCourts, totalRounds = 4) {
  if (!players || players.length < 4) {
    throw new Error('최소 4명 이상의 참가자가 필요합니다.');
  }
  if (!numCourts || numCourts < 1) {
    throw new Error('최소 1개 이상의 코트가 필요합니다.');
  }

  const schedule = [];
  
  // 개인별 누적 경기 수, 휴식 횟수, 파트너 이력, 상대 이력 추적
  const stats = {};
  players.forEach((p) => {
    stats[p.id] = {
      playCount: 0,
      restCount: 0,
      partners: new Set(),
      opponents: new Set(),
      weight: GRADE_WEIGHTS[p.grade] || 5,
    };
  });

  // 코트당 4명씩, 한 라운드에 경기에 참여할 수 있는 최대 인원
  const maxPlayersPerRound = Math.min(players.length, numCourts * 4);
  // 복식이므로 4의 배수로 맞춤
  const activeCount = Math.floor(maxPlayersPerRound / 4) * 4;

  for (let round = 1; round <= totalRounds; round++) {
    // 1. 출전 우선순위 정렬 (경기 수가 적은 사람 우선, 동률 시 랜덤)
    const sortedPlayers = [...players].sort((a, b) => {
      if (stats[a.id].playCount !== stats[b.id].playCount) {
        return stats[a.id].playCount - stats[b.id].playCount;
      }
      return Math.random() - 0.5;
    });

    const activePlayers = sortedPlayers.slice(0, activeCount);
    const restingPlayers = sortedPlayers.slice(activeCount);

    // 휴식자 카운트 증가
    restingPlayers.forEach((p) => stats[p.id].restCount++);

    // 2. 최적의 4인 1조 및 팀 조합 탐색 (몬테카를로 시뮬레이션)
    let bestMatches = null;
    let lowestPenalty = Infinity;

    for (let attempt = 0; attempt < 300; attempt++) {
      // 무작위로 섞은 뒤 4명씩 묶음
      const shuffled = [...activePlayers].sort(() => Math.random() - 0.5);
      const currentMatches = [];
      let penalty = 0;

      for (let i = 0; i < shuffled.length; i += 4) {
        const group = shuffled.slice(i, i + 4);
        // 4명 중 가장 실력 밸런스가 맞는 팀 조합 선택
        // 조합 1: (0,1) vs (2,3) / 조합 2: (0,2) vs (1,3) / 조합 3: (0,3) vs (1,2)
        const pairings = [
          [[group[0], group[1]], [group[2], group[3]]],
          [[group[0], group[2]], [group[1], group[3]]],
          [[group[0], group[3]], [group[1], group[2]]],
        ];

        let bestPair = pairings[0];
        let bestPairPenalty = Infinity;

        for (const [teamA, teamB] of pairings) {
          let pairPenalty = 0;

          // (1) 파트너 중복 페널티 (가장 높은 가중치 부여)
          if (stats[teamA[0].id].partners.has(teamA[1].id)) pairPenalty += 100;
          if (stats[teamB[0].id].partners.has(teamB[1].id)) pairPenalty += 100;

          // (2) 상대방 중복 페널티
          for (const pA of teamA) {
            for (const pB of teamB) {
              if (stats[pA.id].opponents.has(pB.id)) pairPenalty += 20;
            }
          }

          // (3) 팀 간 실력(등급 가중치) 불균형 페널티
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
          teamA: bestPair[0],
          teamB: bestPair[1],
        });
      }

      if (penalty < lowestPenalty) {
        lowestPenalty = penalty;
        bestMatches = currentMatches;
      }
      if (lowestPenalty === 0) break; // 완벽한 조합 발견 시 조기 종료
    }

    // 3. 확정된 대진표의 이력(경기 수, 파트너, 상대방) 업데이트
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

/**
 * DB matches 테이블 포맷으로 변환하는 헬퍼 함수
 * @param {string} tournamentId - 대회 UUID
 * @param {Array} schedule - generateKDKSchedule 결과
 * @returns {Array} matches 테이블에 바로 INSERT 가능한 객체 배열
 */
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

// Node.js(CommonJS) 및 브라우저/ESM 호환 export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GRADE_WEIGHTS,
    generateKDKSchedule,
    transformKDKToDbMatches,
  };
}
