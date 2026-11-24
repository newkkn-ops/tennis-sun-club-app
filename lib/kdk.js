/**
 * 테니스 어플 - KDK 대진표 자동 생성 및 코트별 실력균등(등급+구력+나이)·시드우선·1인 필수 최소게임수·나이합산 순위 집계 엔진 (JS)
 */

export const GRADE_WEIGHTS = {
  '금배': 10,
  '은배': 8,
  '국화': 7,
  '동배': 6,
  '개나리': 5,
  '고령자부': 5,
  '테린이': 3,
};

export const GRADE_COMPOSITE_BASE = {
  '금배': 100,
  '은배': 84,
  '국화': 76,
  '동배': 68,
  '개나리': 58,
  '고령자부': 54,
  '테린이': 36,
};

export const DEFAULT_EXPERIENCE_BY_GRADE = {
  '금배': 10,
  '은배': 7,
  '국화': 7,
  '동배': 5,
  '개나리': 3,
  '고령자부': 8,
  '테린이': 1,
};

export function getPlayerWeight(grade) {
  return GRADE_WEIGHTS[grade] || 6;
}

export function getPlayerExperienceYears(player) {
  if (player && typeof player.experienceYears === 'number' && !isNaN(player.experienceYears)) {
    return Math.max(0, Math.min(40, Math.round(player.experienceYears)));
  }
  return (player && DEFAULT_EXPERIENCE_BY_GRADE[player.grade]) ?? 4;
}

export function getCompositeSkillScore(player) {
  const gradeBase = (player && GRADE_COMPOSITE_BASE[player.grade]) ?? 64;
  const expYears = getPlayerExperienceYears(player);
  const expBonus = Math.min(20, expYears) * 1.5;
  const ageVal = player && typeof player.age === 'number' && !isNaN(player.age) ? player.age : 46;
  const ageAdjust = Math.max(-10, Math.min(8, Math.round((50 - ageVal) * 0.28)));
  return Math.max(20, Math.round(gradeBase + expBonus + ageAdjust));
}

export function calculateRequiredCourtGames(playerCount, minGamesPerPlayer = 2) {
  const safeMinPerPlayer = Math.max(2, Math.floor(minGamesPerPlayer || 2));
  if (!playerCount || playerCount < 4) return safeMinPerPlayer;
  return Math.max(safeMinPerPlayer, Math.ceil((playerCount * safeMinPerPlayer) / 4));
}

export function distributePlayersSeedFirstToCourts(allPlayers, courtNumbers, seedsPerCourt = 2) {
  if (!courtNumbers || courtNumbers.length === 0) return [];
  const sortedBySkill = [...allPlayers].sort(
    (a, b) => getCompositeSkillScore(b) - getCompositeSkillScore(a)
  );

  const buckets = courtNumbers.map((num) => ({
    courtNumber: num,
    seedPlayerIds: [],
    players: [],
  }));

  const numCourts = buckets.length;
  const maxSeeds = Math.min(sortedBySkill.length, numCourts * Math.max(1, seedsPerCourt));

  for (let i = 0; i < maxSeeds; i++) {
    const roundIdx = Math.floor(i / numCourts);
    const posInRound = i % numCourts;
    const courtIdx = roundIdx % 2 === 0 ? posInRound : numCourts - 1 - posInRound;
    const p = { ...sortedBySkill[i], isSeed: true };
    buckets[courtIdx].players.push(p);
    buckets[courtIdx].seedPlayerIds.push(p.id);
  }

  const remaining = sortedBySkill.slice(maxSeeds);
  remaining.forEach((rawPlayer, idx) => {
    const roundIdx = Math.floor(idx / numCourts);
    const posInRound = idx % numCourts;
    const courtIdx = roundIdx % 2 === 0 ? posInRound : numCourts - 1 - posInRound;
    buckets[courtIdx].players.push({ ...rawPlayer, isSeed: false });
  });

  return buckets;
}

export function generateCourtKDKGames(courtNumber, courtPlayers, minGamesPerPlayer = 2, options = {}) {
  if (!courtPlayers || courtPlayers.length < 4) {
    throw new Error('코트별 KDK 경기를 진행하려면 최소 4명 이상의 선수가 필요합니다.');
  }

  const mandatoryPerPlayer = Math.max(
    2,
    Math.floor((options && options.minGamesPerPlayer) ?? minGamesPerPlayer ?? 2)
  );
  const requiredCourtGames = calculateRequiredCourtGames(courtPlayers.length, mandatoryPerPlayer);
  const totalGames = Math.max(
    requiredCourtGames,
    Math.floor((options && options.overrideTotalGames) ?? requiredCourtGames)
  );
  const mode = (options && options.assignMode) || 'AUTO';

  const sortedBySkill = [...courtPlayers].sort(
    (a, b) => getCompositeSkillScore(b) - getCompositeSkillScore(a)
  );
  const explicitSeedIds = ((options && options.seedPlayerIds) || []).filter((id) =>
    courtPlayers.some((p) => p.id === id)
  );
  const autoSeedCount = courtPlayers.length >= 6 ? 2 : Math.min(2, courtPlayers.length);
  const resolvedSeedSet = new Set(
    mode === 'SEED_AUTO'
      ? explicitSeedIds.length > 0
        ? explicitSeedIds
        : sortedBySkill.slice(0, autoSeedCount).map((p) => p.id)
      : []
  );

  const stats = {};
  courtPlayers.forEach((p) => {
    stats[p.id] = {
      playCount: 0,
      restCount: 0,
      partners: new Set(),
      opponents: new Set(),
      weight: getCompositeSkillScore(p),
      isSeed: resolvedSeedSet.has(p.id),
    };
  });

  const games = [];

  for (let gNum = 1; gNum <= totalGames; gNum++) {
    const sortedByNeed = [...courtPlayers].sort((a, b) => {
      const aNeeds = stats[a.id].playCount < mandatoryPerPlayer ? 0 : 1;
      const bNeeds = stats[b.id].playCount < mandatoryPerPlayer ? 0 : 1;
      if (aNeeds !== bNeeds) return aNeeds - bNeeds;
      const diff = stats[a.id].playCount - stats[b.id].playCount;
      if (diff !== 0) return diff;
      const restDiff = stats[b.id].restCount - stats[a.id].restCount;
      if (restDiff !== 0) return restDiff;
      return Math.random() - 0.5;
    });

    let bestSelection = null;
    const minPlayCount = stats[sortedByNeed[0].id].playCount;
    const mustInclude = sortedByNeed.filter((p) => stats[p.id].playCount === minPlayCount);
    const attemptLimit = courtPlayers.length === 4 ? 1 : 260;

    for (let attempt = 0; attempt < attemptLimit; attempt++) {
      let active4;
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

      const pairings = [
        [[active4[0], active4[3]], [active4[1], active4[2]]],
        [[active4[0], active4[2]], [active4[1], active4[3]]],
        [[active4[0], active4[1]], [active4[2], active4[3]]],
      ];

      for (const [teamA, teamB] of pairings) {
        const wA = stats[teamA[0].id].weight + stats[teamA[1].id].weight;
        const wB = stats[teamB[0].id].weight + stats[teamB[1].id].weight;
        const skillDiff = Math.abs(wA - wB);

        let penalty = skillDiff * 24 + skillDiff * skillDiff * 3;

        if (mode === 'SEED_AUTO') {
          const seedsInA = (stats[teamA[0].id].isSeed ? 1 : 0) + (stats[teamA[1].id].isSeed ? 1 : 0);
          const seedsInB = (stats[teamB[0].id].isSeed ? 1 : 0) + (stats[teamB[1].id].isSeed ? 1 : 0);
          if ((seedsInA === 2 && seedsInB === 0) || (seedsInB === 2 && seedsInA === 0)) {
            penalty += 900;
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

export function calculateKdkStandingsWithAgeTiebreak(players, games) {
  const map = {};
  const ensurePlayer = (p) => {
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

  players.forEach(ensurePlayer);

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
      if (aWon) { row.wins += 1; row.winPoints += 3; }
      else if (isDraw) { row.draws += 1; row.winPoints += 1; }
      else { row.losses += 1; }
    });

    g.teamB.forEach((p) => {
      const row = map[p.id];
      row.matches += 1;
      row.pointsFor += g.scoreB;
      row.pointsAgainst += g.scoreA;
      row.pointDiff = row.pointsFor - row.pointsAgainst;
      row.ageSumWithPartners += teamBAgeSum;
      if (bWon) { row.wins += 1; row.winPoints += 3; }
      else if (isDraw) { row.draws += 1; row.winPoints += 1; }
      else { row.losses += 1; }
    });
  });

  Object.values(map).forEach((row) => {
    if (row.matches === 0) row.ageSumWithPartners = row.age;
  });

  const sorted = Object.values(map).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    if (b.ageSumWithPartners !== a.ageSumWithPartners) return b.ageSumWithPartners - a.ageSumWithPartners;
    return b.age - a.age;
  });

  sorted.forEach((row, idx) => {
    row.rank = idx + 1;
    const prev = idx > 0 ? sorted[idx - 1] : null;
    const next = idx < sorted.length - 1 ? sorted[idx + 1] : null;
    const tiedPrev = prev && prev.matches > 0 && prev.wins === row.wins && prev.pointDiff === row.pointDiff && prev.pointsFor === row.pointsFor;
    const tiedNext = next && next.matches > 0 && next.wins === row.wins && next.pointDiff === row.pointDiff && next.pointsFor === row.pointsFor;
    if (tiedPrev || tiedNext) {
      row.tieBreakApplied = true;
      row.tieBreakReason = `동점→나이합산(${row.ageSumWithPartners}세)`;
    }
  });

  return sorted;
}

export function generateKDKSchedule(players, numCourts, totalRounds = 4) {
  if (!players || players.length < 4) throw new Error('최소 4명 이상의 참가자가 필요합니다.');
  if (!numCourts || numCourts < 1) throw new Error('최소 1개 이상의 코트가 필요합니다.');

  const schedule = [];
  const stats = {};
  players.forEach((p) => {
    stats[p.id] = {
      playCount: 0,
      restCount: 0,
      partners: new Set(),
      opponents: new Set(),
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

    let bestMatches = null;
    let lowestPenalty = Infinity;

    for (let attempt = 0; attempt < 500; attempt++) {
      const candidatePool =
        attempt === 0
          ? [...activePlayers].sort((a, b) => stats[b.id].weight - stats[a.id].weight)
          : [...activePlayers].sort(() => Math.random() - 0.5);

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
          pairPenalty += diff * 24 + diff * diff * 3;
          if (stats[teamA[0].id].partners.has(teamA[1].id)) pairPenalty += 300;
          if (stats[teamB[0].id].partners.has(teamB[1].id)) pairPenalty += 300;
          for (const pA of teamA) {
            for (const pB of teamB) {
              if (stats[pA.id].opponents.has(pB.id)) pairPenalty += 25;
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

      schedule.push({ round, matches: bestMatches, resting: restingPlayers });
    }
  }

  return schedule;
}

export function transformKDKToDbMatches(tournamentId, schedule) {
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
