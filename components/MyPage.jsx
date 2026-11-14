import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function MyPage({ userId }) {
  const [stats, setStats] = useState(null);
  const [matchHistory, setMatchHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  const fetchUserData = async () => {
    setLoading(true);

    // 1. 회원별 통산 성적(player_stats) 조회
    const { data: statData, error: statError } = await supabase
      .from('player_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!statError) {
      setStats(statData);
    }

    // 2. 상세 경기 이력 조회 (team_a 또는 team_b 배열에 내 userId가 포함된 완료된 경기)
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('*, tournaments(title)')
      .or(`team_a.cs.{${userId}},team_b.cs.{${userId}}`)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (!matchError) {
      setMatchHistory(matchData || []);
    }

    setLoading(false);
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 font-medium">전적 데이터를 불러오는 중...</div>;
  }

  return (
    <div className="max-w-md mx-auto p-4 bg-gray-50 min-h-screen font-sans">
      <h1 className="text-xl font-bold text-green-800 mb-4">👤 마이페이지 & 전적 관리</h1>

      {/* 통산 성적 요약 카드 */}
      <div className="bg-white rounded-2xl shadow-md p-5 mb-6 border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-500 mb-3">통산 누적 전적</h2>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-gray-50 p-2 rounded-xl">
            <p className="text-xs text-gray-500">총 경기</p>
            <p className="text-lg font-bold text-gray-800">{stats?.total_matches || 0}</p>
          </div>
          <div className="bg-green-50 p-2 rounded-xl">
            <p className="text-xs text-green-600">승</p>
            <p className="text-lg font-bold text-green-700">{stats?.wins || 0}</p>
          </div>
          <div className="bg-red-50 p-2 rounded-xl">
            <p className="text-xs text-red-600">패</p>
            <p className="text-lg font-bold text-red-700">{stats?.losses || 0}</p>
          </div>
          <div className="bg-blue-50 p-2 rounded-xl">
            <p className="text-xs text-blue-600">승률</p>
            <p className="text-lg font-bold text-blue-700">{stats?.win_rate || 0}%</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t text-right text-xs text-gray-500">
          총 득실차: <span className="font-bold text-gray-700">
            {stats?.point_diff >= 0 ? `+${stats?.point_diff}` : stats?.point_diff || 0}
          </span>
        </div>
      </div>

      {/* 상세 경기 이력 리스트 */}
      <h2 className="text-md font-bold text-gray-800 mb-3">📋 상세 경기 이력</h2>
      <div className="space-y-3">
        {matchHistory.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center shadow-sm border border-gray-100">
            <p className="text-sm text-gray-400">아직 완료된 경기 이력이 없습니다.</p>
          </div>
        ) : (
          matchHistory.map((match) => {
            // 내가 속한 팀이 Team A인지 Team B인지 판별
            const isTeamA = Array.isArray(match.team_a) && match.team_a.includes(userId);
            const myScore = isTeamA ? match.score_a : match.score_b;
            const oppScore = isTeamA ? match.score_b : match.score_a;
            const isWin = myScore > oppScore;

            return (
              <div key={match.id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-400 block mb-1 font-medium">
                    {match.tournaments?.title || '테니스 월례회'} • {match.round_name} (코트 {match.court_number})
                  </span>
                  <p className="text-sm font-semibold text-gray-800">
                    {isTeamA ? 'Team A (내 팀)' : 'Team B (내 팀)'} vs {isTeamA ? 'Team B (상대 팀)' : 'Team A (상대 팀)'}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    isWin ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {isWin ? '승리' : '패배'}
                  </span>
                  <p className="text-sm font-bold text-gray-800 mt-1">
                    {myScore} : {oppScore}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
