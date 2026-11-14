import React, { useState } from 'react';
import { generateKDKSchedule } from '../lib/kdk';
import { generateFullTournamentTree } from '../lib/tournament';

export default function TournamentScheduleView() {
  const [mode, setMode] = useState('kdk'); // 'kdk' | 'bracket'

  // 샘플 데이터
  const [samplePlayers] = useState([
    { id: 'u1', name: '김철수', grade: '금배' },
    { id: 'u2', name: '이영희', grade: '국화' },
    { id: 'u3', name: '박민수', grade: '은배' },
    { id: 'u4', name: '정지훈', grade: '동배' },
    { id: 'u5', name: '최수진', grade: '개나리' },
    { id: 'u6', name: '강동원', grade: '금배' },
    { id: 'u7', name: '한지민', grade: '은배' },
    { id: 'u8', name: '송중기', grade: '동배' },
  ]);

  const [kdkSchedule] = useState(() => generateKDKSchedule(samplePlayers, 2, 3));
  const [tourTree] = useState(() => generateFullTournamentTree([
    { id: 't1', name: '김철수/강동원', wins: 3 },
    { id: 't2', name: '이영희/한지민', wins: 3 },
    { id: 't3', name: '박민수/정지훈', wins: 2 },
    { id: 't4', name: '최수진/김태희', wins: 2 },
    { id: 't5', name: '송중기/정우성', wins: 1 },
    { id: 't6', name: '팀 알파', wins: 0 },
  ]));

  return (
    <div className="space-y-4">
      {/* 서브 탭 */}
      <div className="flex bg-gray-200 p-1 rounded-xl text-xs font-semibold">
        <button
          onClick={() => setMode('kdk')}
          className={`flex-1 py-1.5 rounded-lg transition ${mode === 'kdk' ? 'bg-white text-green-800 shadow-sm' : 'text-gray-500'}`}
        >
          🎾 KDK 예선 리그
        </button>
        <button
          onClick={() => setMode('bracket')}
          className={`flex-1 py-1.5 rounded-lg transition ${mode === 'bracket' ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-500'}`}
        >
          🏆 본선 토너먼트
        </button>
      </div>

      {mode === 'kdk' ? (
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-sm font-bold text-gray-800">월례회 KDK 대진표 (총 3라운드)</h2>
            <span className="text-[11px] text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-semibold">실력 밸런싱 적용</span>
          </div>
          {kdkSchedule.map((round) => (
            <div key={round.round} className="bg-white rounded-xl shadow-xs border border-gray-100 p-3">
              <div className="text-xs font-bold text-gray-700 mb-2 pb-1 border-b flex justify-between">
                <span>제 {round.round} 라운드</span>
                <span className="text-gray-400 font-normal">{round.matches.length}개 코트 진행</span>
              </div>
              <div className="space-y-2">
                {round.matches.map((m) => (
                  <div key={m.courtNumber} className="bg-gray-50 p-2 rounded-lg text-xs flex justify-between items-center">
                    <span className="font-bold text-green-700 w-12 text-center bg-green-100 rounded py-0.5">코트 {m.courtNumber}</span>
                    <span className="font-semibold text-gray-800 truncate">{m.teamA[0].name}/{m.teamA[1].name}</span>
                    <span className="text-gray-400 font-bold text-[10px]">VS</span>
                    <span className="font-semibold text-gray-800 truncate">{m.teamB[0].name}/{m.teamB[1].name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-sm font-bold text-gray-800">본선 토너먼트 브래킷 ({tourTree.tournamentSize}강)</h2>
            <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-semibold">상위 시드 Bye 배정</span>
          </div>
          <div className="space-y-3">
            {tourTree.rounds.map((round) => (
              <div key={round.roundIndex} className="bg-white rounded-xl shadow-xs border border-gray-100 p-3">
                <div className="text-xs font-bold text-blue-800 mb-2 pb-1 border-b">
                  {round.title}
                </div>
                <div className="space-y-2">
                  {round.matches.map((m) => (
                    <div key={m.matchNumber} className="bg-gray-50 p-2.5 rounded-lg text-xs space-y-1 border border-gray-100">
                      <div className="flex justify-between items-center font-medium">
                        <span className={m.teamA?.isBye ? 'text-amber-600' : 'text-gray-800'}>
                          {m.teamA?.name || '승자 대기'}
                        </span>
                        {m.winner && m.winner.id === m.teamA?.id && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded font-bold">승리</span>
                        )}
                      </div>
                      <div className="border-t border-gray-200/50 pt-1 flex justify-between items-center font-medium">
                        <span className={m.teamB?.isBye ? 'text-amber-600' : 'text-gray-800'}>
                          {m.teamB?.name || '승자 대기'}
                        </span>
                        {m.winner && m.winner.id === m.teamB?.id && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded font-bold">승리</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
