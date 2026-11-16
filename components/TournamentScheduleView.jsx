import React, { useState } from 'react';
import { generateKDKSchedule } from '../lib/kdk';
import { generateFullTournamentTree } from '../lib/tournament';

export default function TournamentScheduleView() {
  const [mode, setMode] = useState('kdk'); // 'kdk' | 'bracket'

  // 1. 참가자 명단 입력 상태(State) 추가하기
  const [participantsInput, setParticipantsInput] = useState('김철수, 박민수, 이영희, 최수진, 정지훈, 한지민, 송중기, 강동원');
  const [rounds, setRounds] = useState([]);

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

  const [kdkSchedule, setKdkSchedule] = useState(() => generateKDKSchedule(samplePlayers, 2, 3));
  const [tourTree] = useState(() => generateFullTournamentTree([
    { id: 't1', name: '김철수/강동원', wins: 3 },
    { id: 't2', name: '이영희/한지민', wins: 3 },
    { id: 't3', name: '박민수/정지훈', wins: 2 },
    { id: 't4', name: '최수진/김태희', wins: 2 },
    { id: 't5', name: '송중기/정우성', wins: 1 },
    { id: 't6', name: '팀 알파', wins: 0 },
  ]));

  // 2. 대진표 자동 생성 함수(KDK/복식 매칭) 구현하기
  const generateBracket = () => {
    const names = participantsInput
      .split(',')
      .map(n => n.trim())
      .filter(n => n.length > 0);

    if (names.length < 4) {
      alert('최소 4명 이상의 참가자가 필요합니다.');
      return;
    }

    // 간단한 예시: 입력된 순서대로 4명씩 묶어서 3라운드 매칭 생성
    const generatedRounds = [];
    for (let r = 1; r <= 3; r++) {
      const shuffled = [...names].sort(() => Math.random() - 0.5);
      const matches = [];
      for (let i = 0; i < shuffled.length; i += 4) {
        if (i + 3 < shuffled.length) {
          matches.push({
            court: matches.length + 1,
            team1: [shuffled[i], shuffled[i+1]],
            team2: [shuffled[i+2], shuffled[i+3]]
          });
        }
      }
      generatedRounds.push({ round: r, matches });
    }
    setRounds(generatedRounds);

    // KDK 엔진에도 실시간 반영
    const dynamicPlayers = names.map((name, idx) => ({
      id: `p-${idx}`,
      name,
      grade: '테린이'
    }));
    try {
      const courtsNeeded = Math.max(1, Math.floor(names.length / 4));
      const newKdk = generateKDKSchedule(dynamicPlayers, courtsNeeded, 3);
      setKdkSchedule(newKdk);
    } catch (e) {
      console.warn('KDK 일정 생성 알림:', e);
    }
  };

  return (
    <div className="space-y-4">
      {/* 3. 화면에 입력 폼 및 생성 버튼 UI 배치하기 */}
      <div className="p-4 bg-white rounded-xl shadow-xs border border-gray-100">
        <h3 className="font-bold text-base text-gray-800 mb-2">참가자 명단 입력 (쉼표로 구분)</h3>
        <textarea 
          className="w-full p-2.5 border border-gray-200 rounded-lg mb-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows="3"
          value={participantsInput}
          onChange={(e) => setParticipantsInput(e.target.value)}
          placeholder="김철수, 박민수, 이영희, 최수진, 정지훈, 한지민, 송중기, 강동원"
        />
        <button 
          onClick={generateBracket}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-blue-700 transition shadow-xs"
        >
          🏓 실시간 대진표 자동 생성
        </button>
      </div>

      {/* 실시간 자동 생성된 대진표 결과 출력 (생성 버튼 클릭 시) */}
      {rounds.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-sm font-bold text-blue-900">✨ 자동 생성된 실시간 대진표 (총 {rounds.length}라운드)</h2>
            <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-semibold">자동 셔플 매칭 완료</span>
          </div>

          {rounds.map((round) => (
            <div key={round.round} className="bg-white rounded-xl shadow-xs border border-blue-100 p-3">
              <div className="text-xs font-bold text-blue-800 mb-2 pb-1 border-b flex justify-between">
                <span>제 {round.round} 라운드</span>
                <span className="text-gray-400 font-normal">{round.matches.length}개 코트 진행</span>
              </div>
              <div className="space-y-2">
                {round.matches.map((m, idx) => (
                  <div key={idx} className="bg-blue-50/50 p-2.5 rounded-lg text-xs flex justify-between items-center">
                    <span className="font-bold text-blue-700 w-14 text-center bg-blue-100 rounded py-0.5">
                      코트 {m.court}
                    </span>
                    <span className="font-semibold text-gray-800 truncate max-w-[100px] text-center">
                      {m.team1[0]} / {m.team1[1]}
                    </span>
                    <span className="text-gray-400 font-bold text-[10px]">VS</span>
                    <span className="font-semibold text-gray-800 truncate max-w-[100px] text-center">
                      {m.team2[0]} / {m.team2[1]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 서브 탭 (KDK 예선 리그 / 본선 토너먼트 상세) */}
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
