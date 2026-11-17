'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  supabaseUrl !== 'YOUR_SUPABASE_URL' &&
  !supabaseUrl.includes('your-project');

const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key'
);

export default function MyPage({
  userId,
  userName = '김철수',
  userGrade = '금배',
  userGender = '남',
  customStats,
  customHistory,
}) {
  const [stats, setStats] = useState(
    customStats || {
      total_matches: 12,
      wins: 9,
      losses: 3,
      win_rate: 75.0,
      point_diff: 21,
    }
  );
  const [matchHistory, setMatchHistory] = useState(
    customHistory || [
      {
        id: 'm1',
        round_name: '월례회 KDK 결승',
        court_number: 1,
        score_a: 6,
        score_b: 4,
        is_win: true,
        partner: '강동원 (금배)',
        opponent: '박민수 / 정지훈',
        date: '2026.03.15',
      },
      {
        id: 'm2',
        round_name: '월례회 KDK 예선 R3',
        court_number: 2,
        score_a: 6,
        score_b: 3,
        is_win: true,
        partner: '이영희 (국화)',
        opponent: '최수진 / 한지민',
        date: '2026.03.15',
      },
      {
        id: 'm3',
        round_name: '월례회 KDK 예선 R2',
        court_number: 1,
        score_a: 4,
        score_b: 6,
        is_win: false,
        partner: '송중기 (동배)',
        opponent: '조인성 / 공유',
        date: '2026.03.15',
      },
    ]
  );

  useEffect(() => {
    if (customStats) setStats(customStats);
  }, [customStats]);

  useEffect(() => {
    if (customHistory) setMatchHistory(customHistory);
  }, [customHistory]);

  useEffect(() => {
    if (isSupabaseConfigured && userId && !userId.startsWith('u_')) {
      fetchUserData();
    }
  }, [userId]);

  const fetchUserData = async () => {
    try {
      const { data: statData } = await supabase
        .from('player_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (statData) {
        setStats(statData);
      }

      const { data: matchData } = await supabase
        .from('matches')
        .select('*, tournaments(title)')
        .or(`team_a.cs.{${userId}},team_b.cs.{${userId}}`)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (matchData && matchData.length > 0) {
        setMatchHistory(matchData);
      }
    } catch (e) {
      console.warn('전적 로딩 알림:', e);
    }
  };

  const winRate = Number(
    stats?.win_rate ??
      (stats?.total_matches ? ((stats.wins / stats.total_matches) * 100).toFixed(1) : 0)
  );

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700 p-5 text-slate-950 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 rounded-full bg-white/20 blur-xl pointer-events-none" />
        <div className="relative z-10 flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-950/70 block">
              SUN TENNIS VIP CLUB
            </span>
            <h2 className="text-xl font-black text-slate-950 flex items-center gap-1.5">
              <span>☀️</span> {userName} 회원님
            </h2>
            <div className="flex gap-1.5 pt-1">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-950 text-amber-300 shadow-sm">
                {userGrade}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/40 text-slate-950">
                정회원 ({userGender})
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-extrabold text-slate-950/70 block">승률 랭킹</span>
            <span className="text-2xl font-black text-slate-950">TOP 3 🏆</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
            <span>📊</span> 통산 누적 공식 전적
          </span>
          <span className="text-xs font-extrabold text-amber-400">승률 {winRate}%</span>
        </div>

        <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
          <div
            className="bg-gradient-to-r from-amber-400 to-emerald-400 h-2.5 rounded-full transition-all duration-1000"
            style={{ width: `${Math.min(100, winRate)}%` }}
          />
        </div>

        <div className="grid grid-cols-4 gap-2 pt-1">
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-center">
            <p className="text-[10px] text-slate-400">총 경기</p>
            <p className="text-base font-black text-white">{stats?.total_matches || 0}</p>
          </div>
          <div className="bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/20 text-center">
            <p className="text-[10px] text-emerald-400 font-bold">승리</p>
            <p className="text-base font-black text-emerald-300">{stats?.wins || 0}</p>
          </div>
          <div className="bg-red-950/40 p-2.5 rounded-xl border border-red-500/20 text-center">
            <p className="text-[10px] text-red-400 font-bold">패배</p>
            <p className="text-base font-black text-red-300">{stats?.losses || 0}</p>
          </div>
          <div className="bg-amber-950/40 p-2.5 rounded-xl border border-amber-500/20 text-center">
            <p className="text-[10px] text-amber-400 font-bold">득실차</p>
            <p className="text-base font-black text-amber-300">
              {(stats?.point_diff || 0) > 0 ? `+${stats.point_diff}` : stats?.point_diff || 0}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        <h3 className="text-xs font-extrabold text-slate-300 px-1 flex items-center gap-1.5">
          <span>🎾</span> 최근 경기 이력 타임라인
        </h3>

        <div className="space-y-2">
          {matchHistory.map((m, idx) => (
            <div
              key={m.id || idx}
              className="bg-slate-900 border border-slate-750 p-3 rounded-2xl shadow-md flex items-center justify-between text-xs"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white">{m.round_name || '월례회 매치'}</span>
                  <span className="text-[10px] text-slate-400">코트 {m.court_number}번</span>
                </div>
                <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
                  파트너: {m.partner || '클럽회원'} vs {m.opponent || '상대팀'}
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-sm font-black text-white">
                  {m.score_a} : {m.score_b}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                    m.is_win !== false
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}
                >
                  {m.is_win !== false ? 'WIN' : 'LOSE'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
