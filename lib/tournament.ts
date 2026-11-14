/**
 * 테니스 어플 - 본선 토너먼트 자동 생성 및 시드 배정 알고리즘 (TypeScript 정의 포함)
 */

export interface RankedTeam {
  id: string;
  name: string;
  wins?: number;
  goalDiff?: number;
  isBye?: boolean;
  playerIds?: string[]; // 복식인 경우 2명의 선수 UUID
}

export interface TournamentMatch {
  matchNumber: number;
  teamA: RankedTeam | null;
  teamB: RankedTeam | null;
  winner: RankedTeam | null;
  status: 'scheduled' | 'waiting' | 'playing' | 'completed';
}

export interface TournamentRound {
  roundIndex: number;
  title: string;
  size: number;
  matches: TournamentMatch[];
}

export interface TournamentBracketResult {
  tournamentSize: number;
  roundTitle: string;
  totalTeams: number;
  byeCount: number;
  round1: TournamentMatch[];
}

export interface FullTournamentTreeResult {
  tournamentSize: number;
  totalTeams: number;
  byeCount: number;
  totalRounds: number;
  rounds: TournamentRound[];
}

/**
 * 예선 성적 순으로 정렬된 팀 리스트를 받아 부전승(Bye)을 포함한 본선 토너먼트 대진표를 생성합니다.
 */
export function generateTournamentBracket(rankedTeams: RankedTeam[]): TournamentBracketResult {
  if (!rankedTeams || rankedTeams.length < 2) {
    throw new Error('토너먼트를 생성하려면 최소 2팀 이상이 필요합니다.');
  }

  const totalTeams = rankedTeams.length;
  
  let bracketSize = 2;
  while (bracketSize < totalTeams) {
    bracketSize *= 2;
  }

  const byeCount = bracketSize - totalTeams;

  let slots: RankedTeam[] = [...rankedTeams];
  
  for (let i = 0; i < byeCount; i++) {
    slots.splice(i * 2 + 1, 0, { id: 'BYE', name: '부전승 (Bye)', isBye: true });
  }

  const round1Matches: TournamentMatch[] = [];
  for (let i = 0; i < slots.length; i += 2) {
    const teamA = slots[i];
    const teamB = slots[i + 1];
    
    let matchStatus: 'scheduled' | 'completed' = 'scheduled';
    let winner: RankedTeam | null = null;

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
      status: matchStatus,
    });
  }

  const getRoundTitle = (size: number): string => {
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
 * 결승까지 이어지는 전체 라운드 토너먼트 트리 생성 함수
 */
export function generateFullTournamentTree(rankedTeams: RankedTeam[]): FullTournamentTreeResult {
  const basicBracket = generateTournamentBracket(rankedTeams);
  const totalRounds = Math.log2(basicBracket.tournamentSize);
  const rounds: TournamentRound[] = [];

  rounds.push({
    roundIndex: 1,
    title: basicBracket.roundTitle,
    size: basicBracket.tournamentSize,
    matches: basicBracket.round1,
  });

  let currentSize = basicBracket.tournamentSize / 2;
  let roundIdx = 2;

  while (currentSize >= 2) {
    const numMatches = currentSize / 2;
    const nextMatches: TournamentMatch[] = [];
    
    for (let m = 0; m < numMatches; m++) {
      nextMatches.push({
        matchNumber: m + 1,
        teamA: null,
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

  // 1라운드 부전승 승자 2라운드 자동 배치
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
