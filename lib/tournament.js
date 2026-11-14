/**
 * 테니스 어플 - 본선 토너먼트 자동 생성 및 시드 배정 알고리즘
 */

/**
 * 예선 성적 순으로 정렬된 팀 리스트를 받아 부전승(Bye)을 포함한 본선 토너먼트 대진표를 생성합니다.
 * @param {Array} rankedTeams - [{ id, name, wins, goalDiff }, ...] (예선 순위별 정렬됨)
 * @returns {Object} 1라운드 대진표 및 부전승 팀 목록
 */
function generateTournamentBracket(rankedTeams) {
  if (!rankedTeams || rankedTeams.length < 2) {
    throw new Error('토너먼트를 생성하려면 최소 2팀 이상이 필요합니다.');
  }

  const totalTeams = rankedTeams.length;
  
  // 1. 2의 거듭제곱(2, 4, 8, 16, 32...) 중 현재 팀 수보다 크거나 같은 토너먼트 크기 결정
  let bracketSize = 2;
  while (bracketSize < totalTeams) {
    bracketSize *= 2;
  }

  // 2. 부전승(Bye)을 받을 팀 수 계산
  const byeCount = bracketSize - totalTeams;

  // 3. 토너먼트 슬롯 생성 (상위 시드 순으로 배치)
  // 토너먼트 표준 시드 배치 알고리즘에 따른 순서 정렬
  let slots = [...rankedTeams];
  
  // 부족한 슬롯만큼 'BYE(부전승)' 객체 추가 (상위 시드부터 부전승 부여)
  for (let i = 0; i < byeCount; i++) {
    // 표준 토너먼트 규칙상 상위 시드(0번, 1번...) 순으로 Bye 배정
    slots.splice(i * 2 + 1, 0, { id: 'BYE', name: '부전승 (Bye)', isBye: true });
  }

  // 4. 1라운드 매치업(Match) 구성
  const round1Matches = [];
  for (let i = 0; i < slots.length; i += 2) {
    const teamA = slots[i];
    const teamB = slots[i + 1];
    
    let matchStatus = 'scheduled';
    let winner = null;

    // 만약 한쪽이 'BYE(부전승)'라면 반대편 팀이 자동 승리 처리
    if (teamA.isBye) {
      matchStatus = 'completed';
      winner = teamB;
    } else if (teamB.isBye) {
      matchStatus = 'completed';
      winner = teamA;
    }

    round1Matches.push({
      matchNumber: round1Matches.length + 1,
      teamA: teamA,
      teamB: teamB,
      winner: winner,
      status: matchStatus, // 'scheduled' 또는 'completed' (BYE 자동 승리)
    });
  }

  // 라운드 이름 명명 헬퍼 (예: 16 -> '16강', 8 -> '8강', 4 -> '4강', 2 -> '결승')
  const getRoundTitle = (size) => {
    if (size === 2) return '결승';
    if (size === 4) return '준결승(4강)';
    return `${size}강`;
  };

  return {
    tournamentSize: bracketSize,
    roundTitle: getRoundTitle(bracketSize),
    totalTeams: totalTeams,
    byeCount: byeCount,
    round1: round1Matches,
  };
}

/**
 * 표준 테니스 토너먼트 시드 배치(1번과 2번이 결승에서 만나는 트리 구조)를 생성하는 고급 브래킷 함수
 * @param {Array} rankedTeams - 예선 순위 정렬 팀 리스트
 * @returns {Object} 전체 라운드(16강 -> 8강 -> 4강 -> 결승) 트리 구조
 */
function generateFullTournamentTree(rankedTeams) {
  const basicBracket = generateTournamentBracket(rankedTeams);
  const totalRounds = Math.log2(basicBracket.tournamentSize);
  const rounds = [];

  // 1라운드 등록
  rounds.push({
    roundIndex: 1,
    title: basicBracket.roundTitle,
    size: basicBracket.tournamentSize,
    matches: basicBracket.round1,
  });

  // 이후 라운드(8강, 4강, 결승 등)의 빈 슬롯 미리 구성
  let currentSize = basicBracket.tournamentSize / 2;
  let roundIdx = 2;

  while (currentSize >= 2) {
    const numMatches = currentSize / 2;
    const nextMatches = [];
    
    for (let m = 0; m < numMatches; m++) {
      nextMatches.push({
        matchNumber: m + 1,
        teamA: null, // 이전 라운드 경기 승자가 진출
        teamB: null,
        winner: null,
        status: 'waiting',
      });
    }

    const roundTitle = currentSize === 2 ? '결승' : (currentSize === 4 ? '준결승(4강)' : `${currentSize}강`);
    rounds.push({
      roundIndex: roundIdx,
      title: roundTitle,
      size: currentSize,
      matches: nextMatches,
    });

    currentSize /= 2;
    roundIdx++;
  }

  // 1라운드 부전승(BYE)으로 자동 승리한 팀들을 2라운드 슬롯에 즉시 전진 배치
  if (rounds.length > 1) {
    const r1 = rounds[0].matches;
    const r2 = rounds[1].matches;
    
    r1.forEach((m, idx) => {
      if (m.winner) {
        const nextMatchIdx = Math.floor(idx / 2);
        const isTeamA = idx % 2 === 0;
        if (isTeamA) {
          r2[nextMatchIdx].teamA = m.winner;
        } else {
          r2[nextMatchIdx].teamB = m.winner;
        }
      }
    });
  }

  return {
    tournamentSize: basicBracket.tournamentSize,
    totalTeams: basicBracket.totalTeams,
    byeCount: basicBracket.byeCount,
    totalRounds: totalRounds,
    rounds: rounds,
  };
}

/**
 * 토너먼트 1라운드 매치를 DB matches 테이블 형태로 변환
 * @param {string} tournamentId - 대회 UUID
 * @param {Object} bracket - generateTournamentBracket 결과
 * @param {number} startCourtNumber - 시작 코트 번호 (기본 1)
 */
function transformTournamentToDbMatches(tournamentId, bracket, startCourtNumber = 1) {
  const dbMatches = [];
  bracket.round1.forEach((m, idx) => {
    if (!m.teamA.isBye && !m.teamB.isBye) {
      dbMatches.push({
        tournament_id: tournamentId,
        round_name: bracket.roundTitle,
        court_number: startCourtNumber + (idx % 4), // 코트 순환 배정
        team_a: Array.isArray(m.teamA.playerIds) ? m.teamA.playerIds : [m.teamA.id],
        team_b: Array.isArray(m.teamB.playerIds) ? m.teamB.playerIds : [m.teamB.id],
        score_a: 0,
        score_b: 0,
        status: m.status === 'completed' ? 'completed' : 'waiting',
      });
    }
  });
  return dbMatches;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateTournamentBracket,
    generateFullTournamentTree,
    transformTournamentToDbMatches,
  };
}
