import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 대회 종료 시 해당 대회의 모든 경기 결과를 집계하여 
 * 각 선수의 누적 성적(player_stats)을 업데이트하는 함수
 * @param {string} tournamentId - 종료할 대회의 UUID
 */
export async function finalizeTournamentStats(tournamentId) {
  try {
    // 1. 해당 대회의 완료된 모든 경기(matches) 가져오기
    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('status', 'completed');

    if (matchError) throw matchError;
    if (!matches || matches.length === 0) {
      console.log('집계할 완료된 경기가 없습니다.');
      return { success: false, message: '완료된 경기가 없습니다.' };
    }

    // 2. 선수별 이번 대회 성적 집계용 객체 생성
    // 구조: { userId: { totalMatches, wins, losses, pointDiff } }
    const statsMap = {};

    matches.forEach((match) => {
      const { team_a, team_b, score_a, score_b } = match;
      
      const isTeamAWin = score_a > score_b;
      const isDraw = score_a === score_b; // 테니스는 보통 승부가 나지만 동점 예외 처리

      const diffA = score_a - score_b; // 팀 A 득실차
      const diffB = score_b - score_a; // 팀 B 득실차

      // Team A 소속 선수들 기록 반영
      team_a.forEach((userId) => {
        if (!statsMap[userId]) {
          statsMap[userId] = { totalMatches: 0, wins: 0, losses: 0, pointDiff: 0 };
        }
        statsMap[userId].totalMatches += 1;
        statsMap[userId].pointDiff += diffA;
        if (isTeamAWin) {
          statsMap[userId].wins += 1;
        } else if (!isDraw) {
          statsMap[userId].losses += 1;
        }
      });

      // Team B 소속 선수들 기록 반영
      team_b.forEach((userId) => {
        if (!statsMap[userId]) {
          statsMap[userId] = { totalMatches: 0, wins: 0, losses: 0, pointDiff: 0 };
        }
        statsMap[userId].totalMatches += 1;
        statsMap[userId].pointDiff += diffB;
        if (!isTeamAWin && !isDraw) {
          statsMap[userId].wins += 1;
        } else if (!isDraw) {
          statsMap[userId].losses += 1;
        }
      });
    });

    // 3. 기존 player_stats 데이터를 조회하여 통산 기록에 누적 반영 (Upsert)
    for (const [userId, record] of Object.entries(statsMap)) {
      // 기존 누적 통계 조회
      const { data: existingStat, error: fetchError } = await supabase
        .from('player_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: row not found (기록이 아직 없는 경우)
        console.error(`유저 ${userId} 통계 조회 실패:`, fetchError);
        continue;
      }

      let newTotal = record.totalMatches;
      let newWins = record.wins;
      let newLosses = record.losses;
      let newPointDiff = record.pointDiff;

      if (existingStat) {
        // 기존 통산 기록에 이번 대회 성적을 합산
        newTotal += existingStat.total_matches;
        newWins += existingStat.wins;
        newLosses += existingStat.losses;
        newPointDiff += existingStat.point_diff;
      }

      // 통산 승률 계산 (%) - 소수점 둘째 자리까지
      const winRate = newTotal > 0 ? Number(((newWins / newTotal) * 100).toFixed(2)) : 0.00;

      // player_stats 테이블에 갱신 (없으면 생성, 있으면 업데이트)
      const { error: upsertError } = await supabase
        .from('player_stats')
        .upsert({
          user_id: userId,
          total_matches: newTotal,
          wins: newWins,
          losses: newLosses,
          win_rate: winRate,
          point_diff: newPointDiff,
          updated_at: new Date().toISOString(),
        });

      if (upsertError) {
        console.error(`유저 ${userId} 통계 업데이트 실패:`, upsertError);
      }
    }

    // 4. 대회의 상태를 'finished'로 최종 변경
    const { error: tournamentError } = await supabase
      .from('tournaments')
      .update({ status: 'finished' })
      .eq('id', tournamentId);

    if (tournamentError) throw tournamentError;

    console.log('대회 종료 및 개인별 통산 성적 누적 완료!');
    return { success: true, message: '대회가 성공적으로 종료되고 성적이 누적되었습니다.' };

  } catch (err) {
    console.error('대회 정산 중 오류 발생:', err);
    return { success: false, error: err.message };
  }
}

export default finalizeTournamentStats;
