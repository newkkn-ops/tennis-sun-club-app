import React, { useState } from 'react';
import { generateKDKSchedule } from '../lib/kdk';
import { generateFullTournamentTree } from '../lib/tournament';

export default function TournamentScheduleView() {
  const [mode, setMode] = useState('kdk'); // 'kdk' | 'bracket'

  // 참가자 명단 입력 상태
  const [participantsInput, setParticipantsInput] = useState(
    '김철수, 박민수, 이영희, 최수진, 정지훈, 한지민, 송중기, 강동원'
  );
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
  const [tourTree] = useState(() =>
    generateFullTournamentTree([
      { id: 't1', name: '김철수/강동원', wins: 3 },
      { id: 't2', name: '이영희/한지민', wins: 3 },
      { id: 't3', name: '박민수/정지훈', wins: 2 },
      { id: 't4', name: '최수진/김태희', wins: 2 },
      { id: 't5', name: '송중기/정우성', wins: 1 },
      { id: 't6', name: '팀 알파', wins: 0 },
    ])
  );

  // 대진표 자동 생성 함수 (KDK/복식 매칭)
  const generateBracket = () => {
    const names = participantsInput
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length < 4) {
      alert('최소 4명 이상의 참가자가 필요합니다.');
      return;
    }

    const generatedRounds = [];
    for (let r = 1; r <= 3; r++) {
      const shuffled = [...names].sort(() => Math.random() - 0.5);
      const matches = [];
      for (let i = 0; i < shuffled.length; i += 4) {
        if (i + 3 < shuffled.length) {
          matches.push({
            court: matches.length + 1,
            team1: [shuffled[i], shuffled[i + 1]],
            team2: [shuffled[i + 2], shuffled[i + 3]],
          });
        }
      }
      generatedRounds.push({ round: r, matches });
    }
    setRounds(generatedRounds);

    const dynamicPlayers = names.map((name, idx) => ({
      id: `p-${idx}`,
      name,
      grade: '테린이',
    }));
    try {
      const courtsNeeded = Math.max(1, Math.floor(names.length / 4));
      const newKdk = generateKDKSchedule(dynamicPlayers, courtsNeeded, 3);
      setKdkSchedule(newKdk);
    } catch (e) {
      console.warn('KDK 일정 생성 알림:', e);
    }
  };

  const setSamplePreset = (presetType) => {
    if (presetType === 8) {
      setParticipantsInput('김철수, 박민수, 이영희, 최수진, 정지훈, 한지민, 송중기, 강동원');
    } else if (presetType === 12) {
      setParticipantsInput('김철수, 박민수, 이영희, 최수진, 정지훈, 한지민, 송중기, 강동원, 조인성, 공유, 김태희, 전지현');
    }
  };

  return (
    <div className="space-y-4">
      {/* 썬 클럽 스마트 매칭 콘솔 입력 폼 */}
      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-extrabold text-sm text-white flex items-center gap-1.5">
            <span className="text-amber-400">☀️</span> 참가자 명단 입력 (쉼표 구분)
          </h3>
          <div className="flex gap-1.5">
            <button
              onClick={() => setSamplePreset(8)}
              className="text-[10px] px-2 py-0.8 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700"
            >
              8명 예시
            </button>
            <button
              onClick={() => setSamplePreset(12)}
              className="text-[10px] px-2 py-0.8 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700"
            >
              12명 예시
            </button>
          </div>
        </div>

        <textarea
          className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono leading-relaxed"
          rows={3}
          value={participantsInput}
          onChange={(e) => setParticipantsInput(e.target.value)}
          placeholder="김철수, 박민수, 이영희, 최수진, 정지훈, 한지민, 송중기, 강동원..."
        />

        <button
          onClick={generateBracket}
          className="w-full py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>🏓</span>
          <span>썬 클럽 실시간 대진표 자동 생성</span>
        </button>
      </div>

      {/* 생성된 대진표 결과 카드 */}
      {rounds.length > 0 && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex justify-between items-center px-1">
            <h4 className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
              <span>✨</span> 자동 생성된 라운드 대진표 ({rounds.length}개 라운드)
            </h4>
            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
              생성 완료
            </span>
          </div>

          {rounds.map((round) => (
            <div key={round.round} className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-2">
              <div className="text-xs font-black text-amber-400 border-b border-slate-800 pb-1.5 flex justify-between">
                <span>제 {round.round} 라운드</span>
                <span className="text-slate-400 font-normal text-[11px]">{round.matches.length}개 코트 진행</span>
              </div>
              <div className="space-y-1.5">
                {round.matches.map((m, idx) => (
                  <div key={idx} className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                    <span className="font-extrabold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20 text-[10px]">
                      코트 {m.court}
                    </span>
                    <span className="font-bold text-white truncate max-w-[100px] text-center">
                      {m.team1[0]} / {m.team1[1]}
                    </span>
                    <span className="font-black text-slate-500 text-[10px]">VS</span>
                    <span className="font-bold text-white truncate max-w-[100px] text-center">
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
      <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 text-xs font-bold">
        <button
          onClick={() => setMode('kdk')}
          className={`flex-1 py-2 rounded-xl transition ${
            mode === 'kdk'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          🎾 KDK 예선 리그
        </button>
        <button
          onClick={() => setMode('bracket')}
          className={`flex-1 py-2 rounded-xl transition ${
            mode === 'bracket'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          🏆 본선 토너먼트
        </button>
      </div>

      {mode === 'kdk' ? (
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xs font-extrabold text-slate-300">월례회 정규 KDK (실력 밸런싱 순환)</h2>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold">
              파트너 중복 최소화
            </span>
          </div>

          {kdkSchedule.map((round) => (
            <div key={round.round} className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-2">
              <div className="text-xs font-black text-emerald-400 border-b border-slate-800 pb-1.5 flex justify-between">
                <span>제 {round.round} 라운드</span>
                <span className="text-slate-400 font-normal text-[11px]">{round.matches.length}개 코트 진행</span>
              </div>
              <div className="space-y-1.5">
                {round.matches.map((m) => (
                  <div key={m.courtNumber} className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                    <span className="font-extrabold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-lg border border-emerald-400/20 text-[10px]">
                      코트 {m.courtNumber}
                    </span>
                    <span className="font-bold text-white truncate">
                      {m.teamA[0].name} / {m.teamA[1].name}
                    </span>
                    <span className="font-black text-slate-500 text-[10px]">VS</span>
                    <span className="font-bold text-white truncate">
                      {m.teamB[0].name} / {m.teamB[1].name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xs font-extrabold text-slate-300">본선 토너먼트 브래킷 ({tourTree.tournamentSize}강)</h2>
            <span className="text-[10px] text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">
              상위 시드 Bye 배정
            </span>
          </div>

          <div className="space-y-3">
            {tourTree.rounds.map((round) => (
              <div key={round.roundIndex} className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-2">
                <div className="text-xs font-black text-amber-400 border-b border-slate-800 pb-1.5">
                  {round.title}
                </div>
                <div className="space-y-2">
                  {round.matches.map((m) => (
                    <div key={m.matchNumber} className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span className={`font-semibold ${m.teamA?.isBye ? 'text-amber-500/70 italic' : 'text-slate-200'}`}>
                          {m.teamA?.name || '승자 대기'}
                        </span>
                        {m.winner && m.winner.id === m.teamA?.id && (
                          <span className="text-[10px] bg-amber-500 text-slate-950 px-1.5 rounded font-black">WIN</span>
                        )}
                      </div>
                      <div className="border-t border-slate-800/60 pt-1 flex justify-between items-center">
                        <span className={`font-semibold ${m.teamB?.isBye ? 'text-amber-500/70 italic' : 'text-slate-200'}`}>
                          {m.teamB?.name || '승자 대기'}
                        </span>
                        {m.winner && m.winner.id === m.teamB?.id && (
                          <span className="text-[10px] bg-amber-500 text-slate-950 px-1.5 rounded font-black">WIN</span>
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
