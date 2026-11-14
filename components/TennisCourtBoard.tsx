import React, { useState } from 'react';

export type CourtStatus = 'playing' | 'waiting' | 'completed';

export interface CourtData {
  id: number | string;
  courtNumber: number;
  status: CourtStatus;
  teamA: string[];
  teamB: string[];
  scoreA: number;
  scoreB: number;
  waitingNext: string[];
}

export default function TennisCourtBoard() {
  // 더미 코트 데이터 (실제 서비스에서는 Supabase Realtime 상태와 연동)
  const [courts, setCourts] = useState<CourtData[]>([
    {
      id: 1,
      courtNumber: 1,
      status: 'playing',
      teamA: ['김철수', '강동원'],
      teamB: ['이영희', '한지민'],
      scoreA: 4,
      scoreB: 3,
      waitingNext: ['박민수', '정지훈', '최수진', '김태희']
    },
    {
      id: 2,
      courtNumber: 2,
      status: 'playing',
      teamA: ['송중기', '정우성'],
      teamB: ['팀 알파', '팀 베타'],
      scoreA: 5,
      scoreB: 5,
      waitingNext: ['정국', '뷔', '지민', '진']
    }
  ]);

  // 스코어 입력 모달 상태
  const [selectedCourt, setSelectedCourt] = useState<CourtData | null>(null);
  const [inputScoreA, setInputScoreA] = useState<string | number>('');
  const [inputScoreB, setInputScoreB] = useState<string | number>('');
  const [inputStatus, setInputStatus] = useState<CourtStatus>('playing');

  // 스코어 수정 모달 오픈
  const handleOpenModal = (court: CourtData) => {
    setSelectedCourt(court);
    setInputScoreA(court.scoreA);
    setInputScoreB(court.scoreB);
    setInputStatus(court.status);
  };

  // 스코어 저장 및 승패 확정 처리
  const handleSaveScore = () => {
    if (!selectedCourt) return;
    
    setCourts(courts.map(c => {
      if (c.id === selectedCourt.id) {
        return {
          ...c,
          scoreA: Number(inputScoreA),
          scoreB: Number(inputScoreB),
          status: inputStatus,
        };
      }
      return c;
    }));
    setSelectedCourt(null);
  };

  return (
    <div className="max-w-md mx-auto p-4 bg-gray-50 min-h-screen font-sans">
      {/* 상단 타이틀 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-green-800">🎾 실시간 코트 현황판</h1>
        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full animate-pulse">
          LIVE 실시간 중계 중
        </span>
      </div>

      {/* 코트 카드 리스트 */}
      <div className="space-y-4">
        {courts.map((court) => (
          <div key={court.id} className="bg-white rounded-xl shadow-md p-4 border border-gray-100 transition-all hover:shadow-lg">
            {/* 코트 번호 및 상태 */}
            <div className="flex justify-between items-center border-b pb-2 mb-3">
              <span className="font-extrabold text-lg text-gray-800">
                코트 {court.courtNumber}번
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                court.status === 'playing'
                  ? 'bg-red-100 text-red-600'
                  : court.status === 'completed'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {court.status === 'playing' ? '🔴 경기 진행 중' : court.status === 'completed' ? '🏁 경기 종료' : '⚪ 대기 중'}
              </span>
            </div>

            {/* 대진 및 실시간 스코어 보드 */}
            <div className="grid grid-cols-7 gap-2 items-center bg-gray-50 p-3 rounded-lg text-center mb-3">
              {/* 팀 A */}
              <div className="col-span-3">
                <p className="text-xs text-gray-500 font-medium">Team A</p>
                <p className="text-sm font-bold text-gray-900 truncate">{court.teamA.join(', ')}</p>
              </div>

              {/* 점수 */}
              <div className="col-span-1 text-xl font-black text-green-700">
                {court.scoreA} : {court.scoreB}
              </div>

              {/* 팀 B */}
              <div className="col-span-3">
                <p className="text-xs text-gray-500 font-medium">Team B</p>
                <p className="text-sm font-bold text-gray-900 truncate">{court.teamB.join(', ')}</p>
              </div>
            </div>

            {/* 다음 대기 선수 표시 */}
            <div className="text-xs text-gray-500 mb-3 flex items-center">
              <span className="font-semibold text-gray-700 mr-2">🔜 다음 대기:</span>
              <span className="truncate">{court.waitingNext.slice(0, 2).join(', ')} 등</span>
            </div>

            {/* 점수 입력 버튼 (운영자 / 코트 대표용) */}
            <button
              onClick={() => handleOpenModal(court)}
              className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm"
            >
              실시간 점수 입력 / 수정
            </button>
          </div>
        ))}
      </div>

      {/* 스코어 입력 팝업 모달 */}
      {selectedCourt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl animate-fade-in">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              코트 {selectedCourt.courtNumber}번 점수 입력
            </h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Team A ({selectedCourt.teamA.join(', ')}) 게임 스코어
                </label>
                <input
                  type="number"
                  value={inputScoreA}
                  onChange={(e) => setInputScoreA(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-center font-bold text-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Team B ({selectedCourt.teamB.join(', ')}) 게임 스코어
                </label>
                <input
                  type="number"
                  value={inputScoreB}
                  onChange={(e) => setInputScoreB(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-center font-bold text-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  경기 진행 상태
                </label>
                <select
                  value={inputStatus}
                  onChange={(e) => setInputStatus(e.target.value as CourtStatus)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="playing">🔴 경기 진행 중</option>
                  <option value="completed">🏁 경기 완료 (종료)</option>
                  <option value="waiting">⚪ 경기 대기 중</option>
                </select>
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
