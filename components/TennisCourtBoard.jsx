import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 초기화 (환경 변수 적용)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function TennisCourtBoard() {
  const [courts, setCourts] = useState([]);
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [inputScoreA, setInputScoreA] = useState('');
  const [inputScoreB, setInputScoreB] = useState('');

  // 1. 초기 데이터 로드 및 Supabase Realtime 구독 설정
  useEffect(() => {
    fetchCourts();

    // Supabase Realtime 채널 구독 (matches 테이블 변경 감지)
    const channel = supabase
      .channel('public:matches')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE 모든 변경 감지
          schema: 'public',
          table: 'matches',
        },
        (payload) => {
          console.log('실시간 데이터 변경 감지:', payload);
          // 변경이 발생하면 최신 코트 데이터를 다시 불러옴
          fetchCourts();
        }
      )
      .subscribe();

    // 컴포넌트 종료 시 채널 구독 해제 (메모리 누수 방지)
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // DB에서 코트/경기 데이터 불러오기
  const fetchCourts = async () => {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .order('court_number', { ascending: true });

    if (error) {
      console.error('코트 데이터를 불러오는 중 오류 발생:', error);
    } else {
      setCourts(data || []);
    }
  };

  // 스코어 수정 모달 오픈
  const handleOpenModal = (court) => {
    setSelectedCourt(court);
    setInputScoreA(court.score_a ?? 0);
    setInputScoreB(court.score_b ?? 0);
  };

  // 점수 업데이트 함수 (Supabase DB에 반영 -> 실시간으로 모든 사용자에게 전파됨)
  const handleSaveScore = async () => {
    if (!selectedCourt) return;

    const { error } = await supabase
      .from('matches')
      .update({
        score_a: Number(inputScoreA),
        score_b: Number(inputScoreB),
        status: 'playing',
      })
      .eq('id', selectedCourt.id);

    if (error) {
      console.error('점수 업데이트 실패:', error);
      alert('점수 저장에 실패했습니다.');
    } else {
      // 코트 경기 배정/상태 변경 시 해당 선수들에게 푸시 알림 발송 시도
      try {
        const playerIds = [
          selectedCourt.player_a1_id,
          selectedCourt.player_a2_id,
          selectedCourt.player_b1_id,
          selectedCourt.player_b2_id,
        ].filter(Boolean);

        if (playerIds.length > 0) {
          fetch('/api/send-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userIds: playerIds,
              title: `🎾 [코트 ${selectedCourt.court_number}번] 경기 스코어 업데이트`,
              body: `코트 ${selectedCourt.court_number}번 스코어가 (${inputScoreA} : ${inputScoreB})로 갱신되었습니다.`,
              url: '/',
            }),
          }).catch(() => {});
        }
      } catch (pushErr) {
        console.warn('알림 전송 오류:', pushErr);
      }

      setSelectedCourt(null); // 모달 닫기
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 bg-gray-50 min-h-screen font-sans">
      {/* 상단 타이틀 및 상태 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-green-800">🎾 테니스 실시간 중계</h1>
        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full animate-pulse">
          🔴 실시간 연동 중
        </span>
      </div>

      {/* 코트 카드 리스트 */}
      <div className="space-y-4">
        {courts.map((court) => (
          <div key={court.id} className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
            {/* 코트 번호 및 진행 상태 */}
            <div className="flex justify-between items-center border-b pb-2 mb-3">
              <span className="font-extrabold text-lg text-gray-800">
                코트 {court.court_number}번
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                court.status === 'playing' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
              }`}>
                {court.status === 'playing' ? '🔴 경기 진행 중' : '⚪ 대기 중'}
              </span>
            </div>

            {/* 실시간 스코어 보드 */}
            <div className="grid grid-cols-7 gap-2 items-center bg-gray-50 p-3 rounded-lg text-center mb-3">
              <div className="col-span-3">
                <p className="text-xs text-gray-500 font-medium">Team A</p>
                <p className="text-sm font-bold text-gray-900 truncate">
                  {Array.isArray(court.team_a) ? court.team_a.join(', ') : '팀 A'}
                </p>
              </div>

              <div className="col-span-1 text-xl font-black text-green-700">
                {court.score_a ?? 0} : {court.score_b ?? 0}
              </div>

              <div className="col-span-3">
                <p className="text-xs text-gray-500 font-medium">Team B</p>
                <p className="text-sm font-bold text-gray-900 truncate">
                  {Array.isArray(court.team_b) ? court.team_b.join(', ') : '팀 B'}
                </p>
              </div>
            </div>

            {/* 점수 입력 및 수정 버튼 */}
            <button
              onClick={() => handleOpenModal(court)}
              className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm"
            >
              실시간 점수 입력 / 수정
            </button>
          </div>
        ))}
      </div>

      {/* 스코어 입력 모달 */}
      {selectedCourt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl animate-fade-in">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              코트 {selectedCourt.court_number}번 점수 입력
            </h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Team A 게임 스코어</label>
                <input
                  type="number"
                  value={inputScoreA}
                  onChange={(e) => setInputScoreA(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-center font-bold text-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Team B 게임 스코어</label>
                <input
                  type="number"
                  value={inputScoreB}
                  onChange={(e) => setInputScoreB(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-center font-bold text-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setSelectedCourt(null)}
                className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg text-sm"
              >
                취소
              </button>
              <button
                onClick={handleSaveScore}
                className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-sm"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
