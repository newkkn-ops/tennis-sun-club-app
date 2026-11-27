'use client';
import React, { useState, useEffect } from 'react';
import {
  generateKDKSchedule,
  generateCourtKDKGames,
  GRADE_WEIGHTS,
  getCompositeSkillScore,
  resolvePlayerAge,
} from '../lib/kdk';
import { formatManAgeLabel } from '../lib/age';

export interface ParticipantPlayer {
  id: string;
  name: string;
  grade: string;
  gender: string;
  birthDate?: string; // 생년월일 (YYYY-MM-DD)
  age?: number; // 만 나이 (실력 균등 자동 배정 반영)
  experienceYears?: number; // 구력(년)
  isGuest?: boolean; // 미가입 회원 / 임의 등록 선수 여부
  isLoggedInUser?: boolean; // 가입회원 여부
}

export interface AssignedMatch {
  id: string;
  round: number;
  roundName: string;
  courtNumber: number;
  teamA: [ParticipantPlayer, ParticipantPlayer];
  teamB: [ParticipantPlayer, ParticipantPlayer];
  teamAWeight?: number;
  teamBWeight?: number;
  skillDiff?: number;
  scoreA: number;
  scoreB: number;
  status: 'waiting' | 'playing' | 'completed';
}

export interface TournamentConfig {
  id: string;
  title: string;
  mode: 'TOURNAMENT' | 'KDK';
  assignmentType: 'AUTO' | 'MANUAL';
  courtsCount: number;
  selectedCourts: number[];
  participants: ParticipantPlayer[];
  matches: AssignedMatch[];
  status: 'pending' | 'ongoing' | 'finished';
  createdAt: string;
}

interface AdminTournamentManagerProps {
  registeredUsers: any[];
  currentUser: any;
  activeTournament: TournamentConfig | null;
  onApplyTournament: (config: TournamentConfig) => void;
  onAddCustomUserToClub?: (newUser: ParticipantPlayer) => void;
  onClose?: () => void;
  isModal?: boolean;
}

const GRADE_OPTIONS = ['금배', '은배', '국화', '동배', '개나리', '고령자부', '테린이'];

export default function AdminTournamentManager({
  registeredUsers,
  currentUser,
  activeTournament,
  onApplyTournament,
  onAddCustomUserToClub,
  onClose,
  isModal = false,
}: AdminTournamentManagerProps) {
  // 1단계: 새 대회 개설 - 대회명 설정
  const [tournamentTitle, setTournamentTitle] = useState<string>(
    activeTournament?.title || '2026 썬 테니스 클럽 정기 대회'
  );
  const [isTitleConfirmed, setIsTitleConfirmed] = useState<boolean>(true);

  // 2단계: 대회방식 선택 ('TOURNAMENT' | 'KDK')
  const [tournamentMode, setTournamentMode] = useState<'TOURNAMENT' | 'KDK'>(
    activeTournament?.mode || 'KDK'
  );

  // 기본 미가입 회원 샘플 풀 (새 대회 개설 시 바로 선택하거나 추가 가능)
  const [guestPool, setGuestPool] = useState<ParticipantPlayer[]>([
    { id: 'guest_init_1', name: '김태희', grade: '개나리', gender: '여', birthDate: '1981-03-29', isGuest: true, isLoggedInUser: false },
    { id: 'guest_init_2', name: '정우성', grade: '은배', gender: '남', birthDate: '1973-03-20', isGuest: true, isLoggedInUser: false },
    { id: 'guest_init_3', name: '전지현', grade: '국화', gender: '여', birthDate: '1982-10-30', isGuest: true, isLoggedInUser: false },
    { id: 'guest_init_4', name: '현빈', grade: '동배', gender: '남', birthDate: '1983-09-25', isGuest: true, isLoggedInUser: false },
  ]);

  // 선수 필터 탭: 'ALL' | 'MEMBER' (가입회원) | 'GUEST' (미가입/임의선수)
  const [playerFilterTab, setPlayerFilterTab] = useState<'ALL' | 'MEMBER' | 'GUEST'>('ALL');

  // 3단계: 참여선수 선택 상태 (가입회원 + 미가입회원/임의선수 통합)
  const [selectedParticipants, setSelectedParticipants] = useState<ParticipantPlayer[]>(() => {
    if (activeTournament?.participants && activeTournament.participants.length > 0) {
      return activeTournament.participants;
    }
    const safeUsers = (Array.isArray(registeredUsers) ? registeredUsers : []).filter(Boolean);
    return safeUsers.slice(0, 8).map((u) => ({
      id: String(u.id),
      name: u.name,
      grade: u.grade || '은배',
      gender: u.gender === 'F' || u.gender === '여' ? '여' : '남',
      birthDate: u.birthDate,
      age: resolvePlayerAge({ birthDate: u.birthDate, age: u.age }, 46),
      experienceYears: u.experienceYears,
      isGuest: Boolean(u.isGuest),
      isLoggedInUser: !u.isGuest,
    }));
  });

  // 미가입 회원 / 임의 선수 이름 직접 등록 입력 상태
  const [guestNameInput, setGuestNameInput] = useState<string>('');
  const [guestGradeInput, setGuestGradeInput] = useState<string>('은배');
  const [guestGenderInput, setGuestGenderInput] = useState<string>('남');

  // 4단계: 코트 배정 및 자동(실력차 제로 밸런싱)/수동 방식
  const [selectedCourts, setSelectedCourts] = useState<number[]>(
    activeTournament?.selectedCourts || [1, 2, 3]
  );
  const [kdkRoundsCount, setKdkRoundsCount] = useState<number>(3);
  const [assignmentType, setAssignmentType] = useState<'AUTO' | 'MANUAL'>(
    activeTournament?.assignmentType || 'AUTO'
  );
  const [autoBalanceOption, setAutoBalanceOption] = useState<'BALANCE' | 'RANDOM'>('BALANCE');

  // [KDK 코트별 선수 우선 배정 & 시드 관리 상태]
  // 코트별 배정 선수 ID 목록: Record<courtNumber, playerId[]>
  const [courtPlayerMap, setCourtPlayerMap] = useState<Record<number, string[]>>({});
  // 코트별 수동 시드 지정 상태: Record<courtNumber, Record<playerId, 'seed1' | 'seed2' | 'none'>>
  const [courtSeedMap, setCourtSeedMap] = useState<Record<number, Record<string, 'seed1' | 'seed2' | 'none'>>>({});
  // 현재 탭에서 편집 중인 코트 번호
  const [activeEditingCourt, setActiveEditingCourt] = useState<number>(1);

  // 배정된 매치 리스트
  const [assignedMatches, setAssignedMatches] = useState<AssignedMatch[]>(
    activeTournament?.matches || []
  );

  // 선택된 코트 목록이 바뀔 때 courtPlayerMap 초기화/정리 (신규 코트 키 생성, 삭제된 코트 정리)
  useEffect(() => {
    setCourtPlayerMap((prev) => {
      const next: Record<number, string[]> = {};
      selectedCourts.forEach((cNum) => {
        next[cNum] = prev[cNum] || [];
      });
      return next;
    });

    setCourtSeedMap((prev) => {
      const next: Record<number, Record<string, 'seed1' | 'seed2' | 'none'>> = {};
      selectedCourts.forEach((cNum) => {
        next[cNum] = prev[cNum] || {};
      });
      return next;
    });

    if (!selectedCourts.includes(activeEditingCourt) && selectedCourts.length > 0) {
      setActiveEditingCourt(selectedCourts[0]);
    }
  }, [selectedCourts]);

  // 참여 확정 선수(selectedParticipants) 변경 시, 코트 배정 명단 및 시드에서 제외된 선수 자동 정리
  useEffect(() => {
    const validIds = new Set(selectedParticipants.map((p) => p.id));

    setCourtPlayerMap((prev) => {
      let changed = false;
      const next: Record<number, string[]> = {};
      Object.entries(prev).forEach(([cStr, pIds]) => {
        const cNum = Number(cStr);
        const filtered = pIds.filter((id) => validIds.has(id));
        if (filtered.length !== pIds.length) changed = true;
        next[cNum] = filtered;
      });
      return changed ? next : prev;
    });

    setCourtSeedMap((prev) => {
      let changed = false;
      const next: Record<number, Record<string, 'seed1' | 'seed2' | 'none'>> = {};
      Object.entries(prev).forEach(([cStr, sMap]) => {
        const cNum = Number(cStr);
        const nextSub: Record<string, 'seed1' | 'seed2' | 'none'> = {};
        Object.entries(sMap).forEach(([id, seedVal]) => {
          if (validIds.has(id)) {
            nextSub[id] = seedVal;
          } else {
            changed = true;
          }
        });
        next[cNum] = nextSub;
      });
      return changed ? next : prev;
    });
  }, [selectedParticipants]);

  // 특정 코트에 선수 추가/제거 토글
  const togglePlayerInCourt = (courtNum: number, playerId: string) => {
    setCourtPlayerMap((prev) => {
      const currentList = prev[courtNum] || [];
      const exists = currentList.includes(playerId);
      const nextList = exists
        ? currentList.filter((id) => id !== playerId)
        : [...currentList, playerId];

      // 만약 선수가 제거되면 해당 코트의 시드도 초기화
      if (exists) {
        setCourtSeedMap((sPrev) => {
          const sub = { ...(sPrev[courtNum] || {}) };
          delete sub[playerId];
          return { ...sPrev, [courtNum]: sub };
        });
      }

      return {
        ...prev,
        [courtNum]: nextList,
      };
    });
  };

  // 특정 코트의 선수 시드 수동 지정 ('seed1' | 'seed2' | 'none')
  const handleSetPlayerSeed = (
    courtNum: number,
    playerId: string,
    seedType: 'seed1' | 'seed2' | 'none'
  ) => {
    setCourtSeedMap((prev) => {
      const currentSub = { ...(prev[courtNum] || {}) };

      // 동일 코트 내에 이미 해당 시드(seed1 또는 seed2)를 가진 다른 선수가 있다면 그 선수는 'none'으로 변경
      if (seedType === 'seed1' || seedType === 'seed2') {
        Object.keys(currentSub).forEach((otherId) => {
          if (otherId !== playerId && currentSub[otherId] === seedType) {
            currentSub[otherId] = 'none';
          }
        });
      }

      currentSub[playerId] = seedType;
      return {
        ...prev,
        [courtNum]: currentSub,
      };
    });
  };

  // 코트별 선수 자동 분배 (전체 참여자를 코트들에 골고루 배정해주는 편의 버튼)
  const handleAutoDistributeParticipantsToCourts = () => {
    if (selectedParticipants.length < 4) {
      alert('참여선수를 최소 4명 이상 선택해 주세요.');
      return;
    }
    const courts = selectedCourts.length > 0 ? selectedCourts : [1, 2];
    const sorted = [...selectedParticipants].sort(
      (a, b) => getCompositeSkillScore(b) - getCompositeSkillScore(a)
    );

    const newMap: Record<number, string[]> = {};
    courts.forEach((c) => {
      newMap[c] = [];
    });

    // 스네이크 방식으로 코트별 인원 및 실력 고루 분배
    sorted.forEach((p, idx) => {
      const roundIdx = Math.floor(idx / courts.length);
      const pos = idx % courts.length;
      const cIdx = roundIdx % 2 === 0 ? pos : courts.length - 1 - pos;
      const targetCourt = courts[cIdx];
      newMap[targetCourt].push(p.id);
    });

    setCourtPlayerMap(newMap);
  };

  // 수동 추가용 개별 매치 슬롯 상태
  const [manualCourt, setManualCourt] = useState<number>(1);
  const [manualRoundName, setManualRoundName] = useState<string>('제 1 라운드');
  const [manualTeamA1, setManualTeamA1] = useState<string>('');
  const [manualTeamA2, setManualTeamA2] = useState<string>('');
  const [manualTeamB1, setManualTeamB1] = useState<string>('');
  const [manualTeamB2, setManualTeamB2] = useState<string>('');

  // 단계별 및 매치별 접기/펼치기 아코디언 상태 (기본값: 모두 펼쳐진 상태로 한눈에 설정 가능)
  const [openSteps, setOpenSteps] = useState<Record<'step1' | 'step2' | 'step3' | 'step4', boolean>>({
    step1: true,
    step2: true,
    step3: true,
    step4: true,
  });
  const [expandedMatchIds, setExpandedMatchIds] = useState<Record<string, boolean>>({});

  const toggleStep = (stepKey: 'step1' | 'step2' | 'step3' | 'step4') => {
    setOpenSteps((prev) => ({ ...prev, [stepKey]: !prev[stepKey] }));
  };

  const toggleAllSteps = (expand: boolean) => {
    setOpenSteps({ step1: expand, step2: expand, step3: expand, step4: expand });
  };

  const toggleMatchItem = (matchId: string) => {
    setExpandedMatchIds((prev) => ({ ...prev, [matchId]: !prev[matchId] }));
  };

  const safeRegisteredUsers = (Array.isArray(registeredUsers) ? registeredUsers : []).filter(Boolean);

  // 전체 선택 가능한 선수 풀 (가입회원 + 미가입회원/임의선수 · 생년월일 만 나이 자동 반영)
  const allAvailablePlayers: ParticipantPlayer[] = [
    ...safeRegisteredUsers.map((u) => ({
      id: String(u.id),
      name: u.name,
      grade: u.grade || '은배',
      gender: u.gender === 'F' || u.gender === '여' ? '여' : '남',
      birthDate: u.birthDate,
      age: resolvePlayerAge({ birthDate: u.birthDate, age: u.age }, 46),
      experienceYears: u.experienceYears,
      isGuest: Boolean(u.isGuest),
      isLoggedInUser: !u.isGuest,
    })),
    ...guestPool.filter((g) => !safeRegisteredUsers.some((u) => String(u.id) === g.id)),
  ];

  // 외부 회원정보(생년월일·만 나이·등급·이름) 수정 시 선택된 참가자 목록 실시간 동기화
  useEffect(() => {
    const byId = new Map(safeRegisteredUsers.map((u) => [String(u.id), u]));
    setSelectedParticipants((prev) => {
      let changed = false;
      const next = prev.map((p) => {
        const u = byId.get(p.id);
        if (!u) return p;
        const resolvedAge = resolvePlayerAge({ birthDate: u.birthDate, age: u.age }, p.age ?? 46);
        if (
          u.name !== p.name ||
          (u.grade || '은배') !== p.grade ||
          u.birthDate !== p.birthDate ||
          resolvedAge !== p.age
        ) {
          changed = true;
          return {
            ...p,
            name: u.name,
            grade: u.grade || '은배',
            gender: u.gender === 'F' || u.gender === '여' ? '여' : '남',
            birthDate: u.birthDate,
            age: resolvedAge,
            experienceYears: u.experienceYears ?? p.experienceYears,
          };
        }
        return p;
      });
      return changed ? next : prev;
    });
  }, [registeredUsers]);

  const filteredPlayers = allAvailablePlayers.filter((p) => {
    if (playerFilterTab === 'MEMBER') return !p.isGuest;
    if (playerFilterTab === 'GUEST') return Boolean(p.isGuest);
    return true;
  });

  // 수동 슬롯 기본값 동기화
  useEffect(() => {
    if (selectedParticipants.length >= 4) {
      if (!manualTeamA1) setManualTeamA1(selectedParticipants[0]?.id || '');
      if (!manualTeamA2) setManualTeamA2(selectedParticipants[1]?.id || '');
      if (!manualTeamB1) setManualTeamB1(selectedParticipants[2]?.id || '');
      if (!manualTeamB2) setManualTeamB2(selectedParticipants[3]?.id || '');
    }
  }, [selectedParticipants]);

  // 등급 + 구력 + 만 나이 기반 종합 실력 지수 (실력 균등 자동 배정 반영)
  const getPlayerWeight = (p?: ParticipantPlayer) =>
    p ? getCompositeSkillScore(p) : 64;

  const calcMatchWeights = (teamA: [ParticipantPlayer, ParticipantPlayer], teamB: [ParticipantPlayer, ParticipantPlayer]) => {
    const wA = getPlayerWeight(teamA[0]) + getPlayerWeight(teamA[1]);
    const wB = getPlayerWeight(teamB[0]) + getPlayerWeight(teamB[1]);
    return { teamAWeight: wA, teamBWeight: wB, skillDiff: Math.abs(wA - wB) };
  };

  // 선수 참가 선택 토글
  const togglePlayerSelection = (player: ParticipantPlayer) => {
    setSelectedParticipants((prev) => {
      const exists = prev.some((p) => p.id === player.id);
      if (exists) {
        return prev.filter((p) => p.id !== player.id);
      } else {
        return [...prev, player];
      }
    });
  };

  // 전체 선수 선택 / 해제
  const handleSelectAllPlayers = () => {
    if (selectedParticipants.length === allAvailablePlayers.length) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants([...allAvailablePlayers]);
    }
  };

  // 미가입 회원 또는 임의 선수 이름 직접 등록 핸들러
  const handleAddGuestPlayer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = guestNameInput.trim();
    if (!raw) {
      alert('등록할 미가입 회원 또는 임의 선수의 이름을 입력해 주세요.');
      return;
    }

    const names = raw
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    const newGuests: ParticipantPlayer[] = names.map((name, idx) => ({
      id: `guest_${Date.now()}_${idx}`,
      name,
      grade: guestGradeInput,
      gender: guestGenderInput,
      isGuest: true,
      isLoggedInUser: false,
    }));

    setGuestPool((prev) => [...prev, ...newGuests]);
    setSelectedParticipants((prev) => [...prev, ...newGuests]);
    if (onAddCustomUserToClub) {
      newGuests.forEach((g) => onAddCustomUserToClub(g));
    }
    setGuestNameInput('');
  };

  // 코트 번호 토글
  const toggleCourtNumber = (courtNum: number) => {
    setSelectedCourts((prev) => {
      if (prev.includes(courtNum)) {
        if (prev.length <= 1) return prev;
        return prev.filter((c) => c !== courtNum).sort((a, b) => a - b);
      }
      return [...prev, courtNum].sort((a, b) => a - b);
    });
  };

  // ============================================================================
  // [3. 시드 고정 후 나머지 인원 실력균등 자동배치 실행 버튼 엔진]
  // ============================================================================
  const handleAssignKdkWithFixedSeeds = () => {
    if (!tournamentTitle.trim()) {
      alert('먼저 대회명을 입력해 주세요.');
      return;
    }
    const courts = selectedCourts.length > 0 ? selectedCourts : [1, 2];

    // 코트별 최소 인원 검증
    for (const cNum of courts) {
      const assignedIds = courtPlayerMap[cNum] || [];
      if (assignedIds.length < 4) {
        alert(
          `${cNum}번 코트에 배정된 선수가 ${assignedIds.length}명입니다. 경기를 진행하려면 각 코트마다 최소 4명 이상의 선수를 배정해 주세요.`
        );
        return;
      }
    }

    const generated: AssignedMatch[] = [];

    // 각 코트별로 독립적으로 KDK 대진 편성 실행
    courts.forEach((cNum) => {
      const assignedIds = courtPlayerMap[cNum] || [];
      const courtPlayers = assignedIds
        .map((id) => selectedParticipants.find((p) => p.id === id))
        .filter(Boolean) as ParticipantPlayer[];

      // 관리자가 수동 지정한 시드 정보 조회
      const seedMap = courtSeedMap[cNum] || {};
      const seed1Id = Object.keys(seedMap).find((id) => seedMap[id] === 'seed1');
      const seed2Id = Object.keys(seedMap).find((id) => seedMap[id] === 'seed2');

      const manualSeedIds: string[] = [];
      if (seed1Id && courtPlayers.some((p) => p.id === seed1Id)) manualSeedIds.push(seed1Id);
      if (seed2Id && courtPlayers.some((p) => p.id === seed2Id)) manualSeedIds.push(seed2Id);

      // Player 타입 매핑
      const mappedPlayers = courtPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        grade: p.grade,
        birthDate: p.birthDate,
        age: p.age,
        experienceYears: p.experienceYears,
        gender: p.gender,
        isGuest: p.isGuest,
      }));

      // 단일 코트 KDK 게임 생성 함수 호출 (시드 우선 모드 및 수동 시드 ID 목록 전달)
      const games = generateCourtKDKGames(cNum, mappedPlayers, 2, {
        minGamesPerPlayer: 2,
        assignMode: manualSeedIds.length > 0 ? 'SEED_AUTO' : 'AUTO',
        seedPlayerIds: manualSeedIds,
        overrideTotalGames: Math.max(kdkRoundsCount, Math.ceil((mappedPlayers.length * 2) / 4)),
      });

      // AssignedMatch 형식으로 변환하여 추가
      games.forEach((g) => {
        const pA1 = courtPlayers.find((p) => p.id === g.teamA[0].id) || (g.teamA[0] as ParticipantPlayer);
        const pA2 = courtPlayers.find((p) => p.id === g.teamA[1].id) || (g.teamA[1] as ParticipantPlayer);
        const pB1 = courtPlayers.find((p) => p.id === g.teamB[0].id) || (g.teamB[0] as ParticipantPlayer);
        const pB2 = courtPlayers.find((p) => p.id === g.teamB[1].id) || (g.teamB[1] as ParticipantPlayer);

        const weights = calcMatchWeights([pA1, pA2], [pB1, pB2]);
        const seedNote = manualSeedIds.length > 0 ? ` · 시드(${manualSeedIds.length}명) 고정` : '';

        generated.push({
          id: `match_kdk_seed_c${cNum}_g${g.gameNumber}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          round: g.gameNumber,
          roundName: `${cNum}코트 제 ${g.gameNumber}경기 (KDK 실력균등${seedNote})`,
          courtNumber: cNum,
          teamA: [pA1, pA2],
          teamB: [pB1, pB2],
          ...weights,
          scoreA: 0,
          scoreB: 0,
          status: g.gameNumber === 1 ? 'playing' : 'waiting',
        });
      });
    });

    setAssignedMatches(generated);
  };

  // ============================================================================
  // [기존 자동 배정 엔진]: KDK 일괄 실력 차이 최소화(Skill Gap 0) 및 토너먼트 밸런스 배정
  // ============================================================================
  const handleAutoAssign = () => {
    if (!tournamentTitle.trim()) {
      alert('먼저 대회명을 입력해 주세요.');
      return;
    }
    if (selectedParticipants.length < 4) {
      alert('경기를 진행하려면 최소 4명 이상의 참여선수를 선택하거나 임의 선수로 등록해 주세요.');
      return;
    }

    const courts = selectedCourts.length > 0 ? selectedCourts : [1, 2];
    const generated: AssignedMatch[] = [];

    if (tournamentMode === 'KDK') {
      if (autoBalanceOption === 'BALANCE') {
        // KDK 전용 경기 실력 차이 최소화(Skill Gap Zero) 알고리즘 모듈 호출
        const kdkSchedule = generateKDKSchedule(
          selectedParticipants,
          courts.length,
          kdkRoundsCount
        );

        kdkSchedule.forEach((r) => {
          r.matches.forEach((m, mIdx) => {
            const pA1 = selectedParticipants.find((p) => p.id === m.teamA[0].id) || (m.teamA[0] as ParticipantPlayer);
            const pA2 = selectedParticipants.find((p) => p.id === m.teamA[1].id) || (m.teamA[1] as ParticipantPlayer);
            const pB1 = selectedParticipants.find((p) => p.id === m.teamB[0].id) || (m.teamB[0] as ParticipantPlayer);
            const pB2 = selectedParticipants.find((p) => p.id === m.teamB[1].id) || (m.teamB[1] as ParticipantPlayer);

            const assignedCourt = courts[mIdx % courts.length];
            const weights = calcMatchWeights([pA1, pA2], [pB1, pB2]);

            generated.push({
              id: `match_kdk_r${r.round}_c${assignedCourt}_${Date.now()}_${mIdx}`,
              round: r.round,
              roundName: `제 ${r.round} 라운드 (KDK 실력균형)`,
              courtNumber: assignedCourt,
              teamA: [pA1, pA2],
              teamB: [pB1, pB2],
              ...weights,
              scoreA: 0,
              scoreB: 0,
              status: r.round === 1 ? 'playing' : 'waiting',
            });
          });
        });
      } else {
        // 완전 랜덤 배정
        for (let r = 1; r <= kdkRoundsCount; r++) {
          const shuffled = [...selectedParticipants].sort(() => Math.random() - 0.5);
          const maxMatches = Math.min(courts.length, Math.floor(shuffled.length / 4));
          for (let mIdx = 0; mIdx < maxMatches; mIdx++) {
            const g = shuffled.slice(mIdx * 4, mIdx * 4 + 4);
            const assignedCourt = courts[mIdx % courts.length];
            const weights = calcMatchWeights([g[0], g[1]], [g[2], g[3]]);
            generated.push({
              id: `match_kdk_rand_r${r}_${Date.now()}_${mIdx}`,
              round: r,
              roundName: `제 ${r} 라운드 (KDK 랜덤)`,
              courtNumber: assignedCourt,
              teamA: [g[0], g[1]],
              teamB: [g[2], g[3]],
              ...weights,
              scoreA: 0,
              scoreB: 0,
              status: r === 1 ? 'playing' : 'waiting',
            });
          }
        }
      }
    } else {
      // TOURNAMENT 모드: 실력 차이 최소화 팀 구성 후 대진 배정
      const pool = [...selectedParticipants];
      if (autoBalanceOption === 'BALANCE') {
        pool.sort((a, b) => getPlayerWeight(b) - getPlayerWeight(a));
      } else {
        pool.sort(() => Math.random() - 0.5);
      }

      const teams: [ParticipantPlayer, ParticipantPlayer][] = [];
      const usableCount = Math.floor(pool.length / 2) * 2;
      const half = usableCount / 2;

      if (autoBalanceOption === 'BALANCE' && usableCount >= 4) {
        // 고-저 스네이크 매칭으로 모든 복식팀의 전력 합산을 균등화
        for (let i = 0; i < half; i++) {
          teams.push([pool[i], pool[usableCount - 1 - i]]);
        }
      } else {
        for (let i = 0; i < usableCount; i += 2) {
          teams.push([pool[i], pool[i + 1]]);
        }
      }

      const roundLabel =
        teams.length >= 8 ? '16강 토너먼트' : teams.length >= 4 ? '4강 준결승' : '결승전';

      let matchOrder = 0;
      for (let i = 0; i + 1 < teams.length; i += 2) {
        const assignedCourt = courts[matchOrder % courts.length];
        const weights = calcMatchWeights(teams[i], teams[i + 1]);
        generated.push({
          id: `match_tour_${Date.now()}_${matchOrder}`,
          round: 1,
          roundName: `${roundLabel} 제 ${matchOrder + 1}경기`,
          courtNumber: assignedCourt,
          teamA: teams[i],
          teamB: teams[i + 1],
          ...weights,
          scoreA: 0,
          scoreB: 0,
          status: matchOrder < courts.length ? 'playing' : 'waiting',
        });
        matchOrder++;
      }
    }

    setAssignedMatches(generated);
  };

  // 수동 방식: 관리자가 직접 선택한 코트와 4명의 선수를 대진에 추가
  const handleAddManualMatch = () => {
    const pA1 = selectedParticipants.find((p) => p.id === manualTeamA1);
    const pA2 = selectedParticipants.find((p) => p.id === manualTeamA2);
    const pB1 = selectedParticipants.find((p) => p.id === manualTeamB1);
    const pB2 = selectedParticipants.find((p) => p.id === manualTeamB2);

    if (!pA1 || !pA2 || !pB1 || !pB2) {
      alert('Team A(2명)와 Team B(2명) 선수를 모두 선택해 주세요.');
      return;
    }

    const uniqueIds = new Set([pA1.id, pA2.id, pB1.id, pB2.id]);
    if (uniqueIds.size < 4) {
      alert('한 경기에 동일한 선수가 중복 배치되었습니다. 서로 다른 4명의 선수를 선택해 주세요.');
      return;
    }

    const weights = calcMatchWeights([pA1, pA2], [pB1, pB2]);
    const newMatch: AssignedMatch = {
      id: `match_manual_${Date.now()}`,
      round: assignedMatches.length + 1,
      roundName:
        manualRoundName.trim() ||
        (tournamentMode === 'TOURNAMENT' ? '토너먼트 본선' : `제 ${assignedMatches.length + 1} 라운드`),
      courtNumber: manualCourt,
      teamA: [pA1, pA2],
      teamB: [pB1, pB2],
      ...weights,
      scoreA: 0,
      scoreB: 0,
      status: 'playing',
    };

    setAssignedMatches((prev) => [...prev, newMatch]);
    if (!selectedCourts.includes(manualCourt)) {
      setSelectedCourts((prev) => [...prev, manualCourt].sort((a, b) => a - b));
    }
  };

  // 배정된 매치의 코트 번호 또는 선수 수동 변경 시 실력 밸런스 실시간 재계산
  const handleUpdateMatchCourt = (matchId: string, newCourt: number) => {
    setAssignedMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, courtNumber: newCourt } : m))
    );
  };

  const handleUpdateMatchPlayer = (
    matchId: string,
    team: 'teamA' | 'teamB',
    slotIdx: 0 | 1,
    playerId: string
  ) => {
    const found = selectedParticipants.find((p) => p.id === playerId);
    if (!found) return;
    setAssignedMatches((prev) =>
      prev.map((m) => {
        if (m.id !== matchId) return m;
        const updatedTeam: [ParticipantPlayer, ParticipantPlayer] = [
          m[team][0],
          m[team][1],
        ];
        updatedTeam[slotIdx] = found;
        const nextTeamA = team === 'teamA' ? updatedTeam : m.teamA;
        const nextTeamB = team === 'teamB' ? updatedTeam : m.teamB;
        const weights = calcMatchWeights(nextTeamA, nextTeamB);
        return { ...m, [team]: updatedTeam, ...weights };
      })
    );
  };

  const handleRemoveMatch = (matchId: string) => {
    setAssignedMatches((prev) => prev.filter((m) => m.id !== matchId));
  };

  // 최종 대회 생성 & 실시간 코트/대진표 앱 자동 연동
  const handleLaunchTournament = () => {
    if (!tournamentTitle.trim()) {
      alert('대회명을 입력해 주세요.');
      return;
    }
    if (assignedMatches.length === 0) {
      alert('배정된 경기가 없습니다. [자동 배정 실행] 또는 [수동 대진 추가]를 먼저 눌러주세요.');
      return;
    }

    const config: TournamentConfig = {
      id: activeTournament?.id || `tour_${Date.now()}`,
      title: tournamentTitle.trim(),
      mode: tournamentMode,
      assignmentType,
      courtsCount: selectedCourts.length,
      selectedCourts,
      participants: selectedParticipants,
      matches: assignedMatches,
      status: 'ongoing',
      createdAt: new Date().toISOString(),
    };

    onApplyTournament(config);
  };

  const allStepsOpen = openSteps.step1 && openSteps.step2 && openSteps.step3 && openSteps.step4;

  return (
    <div className="space-y-3">
      {/* 상단 안내 배너 & 전체 펼치기/접기 */}
      <div className="bg-gradient-to-r from-red-950/90 via-slate-900 to-amber-950/80 border border-amber-500/30 rounded-2xl p-3.5 shadow-xl">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950">
              NEW TOURNAMENT
            </span>
            <span className="text-xs font-extrabold text-amber-300">
              새 대회 개설 · 코트/선수 배정 콘솔
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => toggleAllSteps(!allStepsOpen)}
              className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-slate-950/90 hover:bg-slate-800 text-amber-300 border border-amber-500/30 cursor-pointer transition"
            >
              {allStepsOpen ? '📁 단계 모두 접기 ▲' : '📂 단계 모두 펼치기 ▼'}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs border border-slate-700 cursor-pointer transition"
                title="닫기"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
          대회명 → 방식 → 참여선수 → 코트·선수 배정 4단계가 모두 펼쳐져 있습니다. 순서대로 설정 후 맨 아래 버튼을 누르면 새 대회가 즉시 개설됩니다.
        </p>
      </div>

      {/* ================================================================= */}
      {/* STEP 1. 대회명 생성 (접기/펼치기) */}
      {/* ================================================================= */}
      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-3">
        <button
          type="button"
          onClick={() => toggleStep('step1')}
          className="w-full flex items-center justify-between text-left cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
              1
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white">새 대회명 입력</h3>
              <p className="text-[10px] text-amber-300 truncate">{tournamentTitle || '미입력'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isTitleConfirmed && (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                ✓ 설정됨
              </span>
            )}
            <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-amber-300">
              {openSteps.step1 ? '접기 ▲' : '수정 ▼'}
            </span>
          </div>
        </button>

        {openSteps.step1 && (
          <div className="space-y-3 pt-2.5 border-t border-slate-800">
            <div className="flex flex-wrap gap-1.5">
              {[
                '2026년 11월 정기 월례회',
                '제5회 썬 테니스 클럽 챔피언십',
                '주말 번개 KDK 실력균형 대회',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setTournamentTitle(preset);
                    setIsTitleConfirmed(true);
                  }}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                >
                  + {preset}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={tournamentTitle}
                onChange={(e) => setTournamentTitle(e.target.value)}
                placeholder="생성할 대회명을 입력하세요"
                className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 font-bold"
              />
              <button
                type="button"
                onClick={() => {
                  if (!tournamentTitle.trim()) {
                    alert('대회명을 입력해 주세요.');
                    return;
                  }
                  setIsTitleConfirmed(true);
                }}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-xs transition shadow-md cursor-pointer shrink-0"
              >
                대회명 확정
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* STEP 2. 대회방식 선택 (접기/펼치기) */}
      {/* ================================================================= */}
      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-3">
        <button
          type="button"
          onClick={() => toggleStep('step2')}
          className="w-full flex items-center justify-between text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
              2
            </span>
            <h3 className="text-sm font-black text-white">대회 방식 선택 (토너먼트 / KDK)</h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-black text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-400/30">
              {tournamentMode === 'TOURNAMENT' ? '🏆 토너먼트' : '🔄 KDK 리그'}
            </span>
            <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-amber-300">
              {openSteps.step2 ? '접기 ▲' : '수정 ▼'}
            </span>
          </div>
        </button>

        {openSteps.step2 && (
          <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setTournamentMode('TOURNAMENT');
                setManualRoundName('토너먼트 본선');
              }}
              className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                tournamentMode === 'TOURNAMENT'
                  ? 'bg-gradient-to-br from-amber-500/20 via-slate-900 to-orange-500/10 border-amber-400 shadow-lg shadow-amber-500/15 scale-[1.01]'
                  : 'bg-slate-950/90 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-2xl">🏆</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    tournamentMode === 'TOURNAMENT'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tournamentMode === 'TOURNAMENT' ? '✓ 선택됨' : '선택하기'}
                </span>
              </div>
              <p className="text-sm font-black text-white">토너먼트 (Tournament)</p>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                고정 파트너 복식조 · 조별 예선 및 본선 4강/결승 브래킷
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setTournamentMode('KDK');
                setManualRoundName('제 1 라운드');
              }}
              className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                tournamentMode === 'KDK'
                  ? 'bg-gradient-to-br from-emerald-500/20 via-slate-900 to-teal-500/10 border-emerald-400 shadow-lg shadow-emerald-500/15 scale-[1.01]'
                  : 'bg-slate-950/90 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-2xl">🔄</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    tournamentMode === 'KDK'
                      ? 'bg-emerald-400 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tournamentMode === 'KDK' ? '✓ 선택됨' : '선택하기'}
                </span>
              </div>
              <p className="text-sm font-black text-white">KDK (실력균형 순환 리그)</p>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                팀 간 경기 실력 차이가 없도록 파트너/상대 자동 밸런싱 매칭
              </p>
            </button>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* STEP 3. 참여선수 선택 (접기/펼치기) */}
      {/* ================================================================= */}
      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-3.5">
        <button
          type="button"
          onClick={() => toggleStep('step3')}
          className="w-full flex items-center justify-between text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
              3
            </span>
            <div>
              <h3 className="text-sm font-black text-white">
                참여선수 선택 (가입 · 미가입 · 임의선수)
              </h3>
              <p className="text-[10px] text-slate-400">
                항목을 눌러 참여 선수를 선택하거나 임의 선수를 등록하세요.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/30">
              {selectedParticipants.length}명
            </span>
            <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-amber-300">
              {openSteps.step3 ? '접기 ▲' : '수정 ▼'}
            </span>
          </div>
        </button>

        {openSteps.step3 && (
          <div className="space-y-3.5 pt-2.5 border-t border-slate-800">

        {/* 가입회원 / 미가입회원 필터 탭 & 전체 선택 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-bold gap-1">
            <button
              type="button"
              onClick={() => setPlayerFilterTab('ALL')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                playerFilterTab === 'ALL'
                  ? 'bg-amber-400 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              전체 ({allAvailablePlayers.length})
            </button>
            <button
              type="button"
              onClick={() => setPlayerFilterTab('MEMBER')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                playerFilterTab === 'MEMBER'
                  ? 'bg-emerald-400 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🟢 가입회원 ({allAvailablePlayers.filter((p) => !p.isGuest).length})
            </button>
            <button
              type="button"
              onClick={() => setPlayerFilterTab('GUEST')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                playerFilterTab === 'GUEST'
                  ? 'bg-amber-400 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🟠 미가입/임의선수 ({allAvailablePlayers.filter((p) => p.isGuest).length})
            </button>
          </div>

          <button
            type="button"
            onClick={handleSelectAllPlayers}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold cursor-pointer"
          >
            {selectedParticipants.length === allAvailablePlayers.length ? '전체 선택 해제' : '전체 선수 선택'}
          </button>
        </div>

        {/* 선수 선택 그리드 (가입회원 + 미가입회원) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto p-1">
          {filteredPlayers.map((player) => {
            const isSelected = selectedParticipants.some((p) => p.id === player.id);
            const pt = getPlayerWeight(player);
            const ageLabel = formatManAgeLabel(player.birthDate, player.age);
            return (
              <button
                key={player.id}
                type="button"
                onClick={() => togglePlayerSelection(player)}
                className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-950/70 border-emerald-400 text-white shadow-sm'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="truncate pr-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold truncate">{player.name}</span>
                    {player.isGuest ? (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                        미가입/임의
                      </span>
                    ) : (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                        가입회원
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {player.grade}{ageLabel ? ` · ${ageLabel}` : ''} (실력 {pt}점)
                  </span>
                </div>
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                    isSelected
                      ? 'bg-emerald-400 text-slate-950'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {isSelected ? '✓' : '+'}
                </span>
              </button>
            );
          })}
        </div>

        {/* 미가입 회원 및 임의 선수 이름 직접 등록 폼 */}
        <div className="bg-slate-950/90 border border-amber-500/30 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
              <span>✍️</span> 미가입 회원 또는 임의 선수 이름 직접 등록
            </span>
            <span className="text-[10px] text-slate-400">쉼표(,)로 여러 명 동시 등록 가능</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              type="text"
              value={guestNameInput}
              onChange={(e) => setGuestNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddGuestPlayer();
                }
              }}
              placeholder="임의 선수 이름 입력 (예: 홍길동 또는 홍길동, 이순신)"
              className="sm:col-span-6 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <select
              value={guestGradeInput}
              onChange={(e) => setGuestGradeInput(e.target.value)}
              className="sm:col-span-3 px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-amber-300 font-bold focus:outline-none"
            >
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g} (실력 {GRADE_WEIGHTS[g] || 6}점)
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleAddGuestPlayer()}
              className="sm:col-span-3 py-2 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-xs transition shadow-md cursor-pointer"
            >
              + 임의 선수 등록
            </button>
          </div>

          {selectedParticipants.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex justify-between items-center mb-1.5">
                <p className="text-[10px] text-slate-400 font-bold">
                  현재 대회 참여 확정 선수 ({selectedParticipants.length}명: 가입회원{' '}
                  {selectedParticipants.filter((p) => !p.isGuest).length}명 / 미가입·임의선수{' '}
                  {selectedParticipants.filter((p) => p.isGuest).length}명):
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedParticipants.map((p, idx) => (
                  <span
                    key={p.id}
                    onClick={() => togglePlayerSelection(p)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                      p.isGuest
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-red-500/20'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-red-500/20'
                    }`}
                  >
                    <span>
                      {idx + 1}. {p.name} ({p.grade}·{getPlayerWeight(p)}점)
                    </span>
                    <span className="text-[9px] opacity-80">
                      {p.isGuest ? '[미가입/임의]' : '[가입회원]'}
                    </span>
                    <span className="text-[10px] opacity-75">✕</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* STEP 4. 코트 배정 및 실력균형 자동배정 / 수동배정 (접기/펼치기) */}
      {/* ================================================================= */}
      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-3.5">
        <button
          type="button"
          onClick={() => toggleStep('step4')}
          className="w-full flex items-center justify-between text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
              4
            </span>
            <div>
              <h3 className="text-sm font-black text-white">
                코트 배정 및 선수 배치 (자동방식 / 수동방식)
              </h3>
              <p className="text-[10px] text-slate-400">
                항목을 눌러 코트 지정 및 자동·수동 배정을 실행/수정하세요.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-400/30">
              {selectedCourts.length}코트·{assignedMatches.length}경기
            </span>
            <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-amber-300">
              {openSteps.step4 ? '접기 ▲' : '수정 ▼'}
            </span>
          </div>
        </button>

        {openSteps.step4 && (
          <div className="space-y-4 pt-2.5 border-t border-slate-800">
        {/* 가용 코트 번호 선택 및 코트 수 조절 (+/-) */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-300">🎾 사용할 코트 지정</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-amber-400 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-700">
                총 {selectedCourts.length}개 코트
              </span>
              <button
                type="button"
                onClick={() => {
                  if (selectedCourts.length <= 1) return;
                  setSelectedCourts((prev) => prev.slice(0, prev.length - 1));
                }}
                disabled={selectedCourts.length <= 1}
                title="코트 1개 줄이기 (-)"
                className="w-7 h-7 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-black text-sm cursor-pointer"
              >
                －
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextNum = selectedCourts.length > 0 ? Math.max(...selectedCourts) + 1 : 1;
                  setSelectedCourts((prev) => [...prev, nextNum].sort((a, b) => a - b));
                }}
                title="코트 1개 늘리기 (+)"
                className="w-7 h-7 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 flex items-center justify-center font-black text-sm cursor-pointer"
              >
                ＋
              </button>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {[1, 2, 3, 4, 5, 6].map((cNum) => {
              const active = selectedCourts.includes(cNum);
              return (
                <button
                  key={cNum}
                  type="button"
                  onClick={() => toggleCourtNumber(cNum)}
                  className={`py-2 rounded-xl text-xs font-black border transition cursor-pointer ${
                    active
                      ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {cNum}코트
                </button>
              );
            })}
          </div>
        </div>

        {/* 자동 방식 vs 수동 방식 전환 탭 버튼 */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setAssignmentType('AUTO')}
            className={`py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
              assignmentType === 'AUTO'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>⚡</span>
            <span>자동 방식 (경기실력 차이 최소화)</span>
          </button>

          <button
            type="button"
            onClick={() => setAssignmentType('MANUAL')}
            className={`py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
              assignmentType === 'MANUAL'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🖐️</span>
            <span>수동 방식 (코트·선수 직접배치)</span>
          </button>
        </div>

        {/* [A] 자동 방식 설정 패널 */}
        {assignmentType === 'AUTO' && (
          <div className="bg-slate-950/90 border border-emerald-500/30 rounded-2xl p-3.5 space-y-3.5">
            {tournamentMode === 'KDK' ? (
              /* KDK 전용: 코트별 선수 우선 배정 및 수동 시드 지정 워크플로우 */
              <div className="space-y-3.5">
                {/* 1. 코트별 참여선수 우선 배정 헤더 & 코트 탭 전환 */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black text-[11px] flex items-center justify-center">
                        1
                      </span>
                      <span className="text-xs font-black text-white">코트별 참여선수 우선 배정</span>
                      <span className="text-[10px] text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20 font-bold">
                        코트 지정 시 자동 생성 방지
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleAutoDistributeParticipantsToCourts}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 cursor-pointer transition"
                        title="전체 참여선수를 선택된 코트들에 실력 스네이크 방식으로 고루 1차 균등 분배합니다."
                      >
                        ⚡ 전체 인원 코트별 1차 균등분배
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    선택된 각 코트({selectedCourts.map((c) => `${c}코트`).join(', ')})별로 참여할 선수들을 먼저 선택하고, 각 코트 내 실적자에게 <strong>1시드 / 2시드</strong>를 지정하세요.
                  </p>

                  {/* 코트 탭 선택 버튼 */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {selectedCourts.map((cNum) => {
                      const count = (courtPlayerMap[cNum] || []).length;
                      const isActive = activeEditingCourt === cNum;
                      const seed1Count = Object.values(courtSeedMap[cNum] || {}).filter((v) => v === 'seed1').length;
                      const seed2Count = Object.values(courtSeedMap[cNum] || {}).filter((v) => v === 'seed2').length;
                      const hasSeeds = seed1Count > 0 || seed2Count > 0;

                      return (
                        <button
                          key={cNum}
                          type="button"
                          onClick={() => setActiveEditingCourt(cNum)}
                          className={`px-3 py-2 rounded-xl text-xs font-black border transition cursor-pointer flex items-center gap-1.5 ${
                            isActive
                              ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md ring-2 ring-amber-400/40'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <span>{cNum}번 코트</span>
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                              isActive
                                ? 'bg-slate-950/20 text-slate-950'
                                : count >= 4
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-red-500/20 text-red-300'
                            }`}
                          >
                            {count}명
                          </span>
                          {hasSeeds && (
                            <span
                              className={`text-[9px] px-1 py-0.2 rounded font-black ${
                                isActive ? 'bg-slate-950 text-amber-300' : 'bg-amber-400/20 text-amber-300'
                              }`}
                            >
                              시드
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. 현재 선택된 코트의 참여선수 체크 & 시드 지정 UI */}
                {selectedCourts.includes(activeEditingCourt) && (
                  <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-amber-300">
                          🎾 {activeEditingCourt}번 코트 참여 명단 & 수동 시드(Seed) 설정
                        </span>
                        <span className="text-[10px] text-slate-400">
                          (현재 {(courtPlayerMap[activeEditingCourt] || []).length}명 배정됨 / 최소 4명 필요)
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        선수 클릭: 코트 배정 토글 | 시드 버튼: 1시드 / 2시드 지정
                      </span>
                    </div>

                    {/* 배정된 선수 태그 및 수동 시드 지정 리스트 */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                        <span>현재 {activeEditingCourt}번 코트에 배정된 선수 목록:</span>
                        <span className="text-[10px] text-amber-400">
                          * 1시드와 2시드는 실력균등 자동배치 시 상대편(Team A vs Team B)으로 자동 분산·고정됩니다.
                        </span>
                      </div>

                      {(courtPlayerMap[activeEditingCourt] || []).length === 0 ? (
                        <div className="p-3 rounded-xl bg-slate-950 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                          현재 {activeEditingCourt}번 코트에 배정된 선수가 없습니다. 아래 [전체 참여 선수 풀]에서 선수를 클릭하여 배정해 주세요.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {(courtPlayerMap[activeEditingCourt] || []).map((pId) => {
                            const p = selectedParticipants.find((item) => item.id === pId);
                            if (!p) return null;
                            const weight = getPlayerWeight(p);
                            const ageLabel = formatManAgeLabel(p.birthDate, p.age);
                            const currentSeed = courtSeedMap[activeEditingCourt]?.[p.id] || 'none';

                            // 누적 승률/득실차 정보 조회 (가입회원 통계 기반)
                            const regUser = safeRegisteredUsers.find((u) => String(u.id) === p.id || u.name === p.name);
                            const winRateStr = regUser?.winRate !== undefined
                              ? `${regUser.winRate}%`
                              : regUser?.winRateStr || (p.isGuest ? '신규/미집계' : '0.0%');
                            const diffVal = regUser?.totalPtsDiff ?? regUser?.ptsDiff ?? 0;
                            const diffStr = typeof diffVal === 'number' ? (diffVal >= 0 ? `+${diffVal}` : `${diffVal}`) : '0';

                            return (
                              <div
                                key={p.id}
                                className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition ${
                                  currentSeed === 'seed1'
                                    ? 'bg-amber-950/60 border-amber-400 text-white'
                                    : currentSeed === 'seed2'
                                    ? 'bg-orange-950/60 border-orange-400 text-white'
                                    : 'bg-slate-950 border-slate-800 text-slate-200'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-black truncate">{p.name}</span>
                                    <span className="text-[10px] font-bold text-amber-300 bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/20">
                                      {p.grade} ({weight}점)
                                    </span>
                                    {ageLabel && (
                                      <span className="text-[9px] text-slate-400 font-mono">
                                        {ageLabel}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                                    <span className="text-emerald-400 font-bold">승률 {winRateStr}</span>
                                    <span>·</span>
                                    <span className="text-amber-400 font-bold">득실 {diffStr}</span>
                                    {p.isGuest && (
                                      <span className="text-[9px] text-slate-500">[임의선수]</span>
                                    )}
                                  </div>
                                </div>

                                {/* 수동 시드(Seed) 지정 드롭다운 / 버튼 */}
                                <div className="flex items-center gap-1 shrink-0">
                                  <select
                                    value={currentSeed}
                                    onChange={(e) =>
                                      handleSetPlayerSeed(
                                        activeEditingCourt,
                                        p.id,
                                        e.target.value as 'seed1' | 'seed2' | 'none'
                                      )
                                    }
                                    className={`px-2 py-1 rounded-lg text-[10px] font-black border cursor-pointer ${
                                      currentSeed === 'seed1'
                                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-extrabold'
                                        : currentSeed === 'seed2'
                                        ? 'bg-orange-500 text-slate-950 border-orange-400 font-extrabold'
                                        : 'bg-slate-900 text-slate-400 border-slate-700'
                                    }`}
                                  >
                                    <option value="none">시드 없음</option>
                                    <option value="seed1">🥇 1시드</option>
                                    <option value="seed2">🥈 2시드</option>
                                  </select>

                                  <button
                                    type="button"
                                    onClick={() => togglePlayerInCourt(activeEditingCourt, p.id)}
                                    className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 flex items-center justify-center text-xs font-bold transition cursor-pointer"
                                    title="이 코트 배정에서 제외"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 전체 참여 선수 풀에서 이 코트로 추가하기 */}
                    <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 block">
                        + 전체 참여 확정 선수 중 {activeEditingCourt}번 코트에 배정할 선수 선택 (클릭 시 즉시 배정/해제):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-0.5">
                        {selectedParticipants.map((p) => {
                          const isAssignedToThisCourt = (courtPlayerMap[activeEditingCourt] || []).includes(p.id);
                          // 다른 코트에 배정되어 있는지 확인
                          const assignedOtherCourt = Object.keys(courtPlayerMap).find(
                            (c) => Number(c) !== activeEditingCourt && courtPlayerMap[Number(c)]?.includes(p.id)
                          );
                          const weight = getPlayerWeight(p);

                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => togglePlayerInCourt(activeEditingCourt, p.id)}
                              className={`p-1.5 rounded-xl text-left border transition text-xs flex items-center justify-between cursor-pointer ${
                                isAssignedToThisCourt
                                  ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow-sm'
                                  : assignedOtherCourt
                                  ? 'bg-slate-950/50 text-slate-500 border-slate-800/80 hover:border-slate-700'
                                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-amber-500/50'
                              }`}
                            >
                              <div className="truncate pr-1">
                                <span className="font-bold truncate block">{p.name}</span>
                                <span className="text-[9px] opacity-80 block">
                                  {p.grade}·{weight}점
                                  {assignedOtherCourt && !isAssignedToThisCourt
                                    ? ` (${assignedOtherCourt}코트)`
                                    : ''}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                                  isAssignedToThisCourt
                                    ? 'bg-slate-950 text-amber-300'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {isAssignedToThisCourt ? '✓' : '+'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. [시드 고정 후 나머지 인원 실력균등 자동배치] 전용 실행 버튼 */}
                <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-emerald-950/40 border border-amber-500/30 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <span>⚖️</span> 시드 고정 및 나머지 인원 실력균등 자동배치
                    </span>
                    <span className="text-[10px] text-slate-400">
                      가중치: 금배 10점 · 은배 8점 · 국화 7점 · 동배 6점 · 개나리 5점 · 테린이 3점
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    관리자가 수동으로 지정한 <strong>1시드·2시드 선수는 상대편으로 자동 분산되어 자리가 고정(유지)</strong>되고, 시드가 미지정된 나머지 인원들만 복식 가중치를 계산하여 <strong>Team A와 Team B의 실력 점수 차이가 최소(0점)</strong>가 되도록 KDK 대진표를 편성합니다.
                  </p>

                  <button
                    type="button"
                    onClick={handleAssignKdkWithFixedSeeds}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 hover:from-amber-600 hover:to-emerald-600 text-slate-950 font-black rounded-xl text-xs transition shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>⚖️</span>
                    <span>시드 고정 및 나머지 인원 실력균등 자동배치 실행 ({selectedCourts.length}개 코트)</span>
                  </button>
                </div>
              </div>
            ) : (
              /* 토너먼트 모드 전용 설정 */
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-300">배정 기준:</span>
                    <button
                      type="button"
                      onClick={() => setAutoBalanceOption('BALANCE')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                        autoBalanceOption === 'BALANCE'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      ⚖️ 경기 실력차 제로(0) 균형 배정 (권장)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoBalanceOption('RANDOM')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                        autoBalanceOption === 'RANDOM'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      🎲 무작위 추첨
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-[11px] text-slate-300">
                  💡 <strong>실력차 제로(0) 자동배정 원리</strong>: 금배(10점)·은배(8점)·국화(7점)·동배(6점)·개나리(5점)·테린이(3점) 가중치를 합산하여 <strong>Team A와 Team B의 실력 합산 점수 차이가 0점(최소)</strong>이 되도록 파트너를 자동 조합합니다.
                </div>

                <button
                  type="button"
                  onClick={handleAutoAssign}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>⚖️</span>
                  <span>
                    토너먼트 코트 및 선수 자동 배정 실행 ({selectedParticipants.length}명 / {selectedCourts.length}개 코트)
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* [B] 수동 방식 설정 패널 */}
        {assignmentType === 'MANUAL' && (
          <div className="bg-slate-950/90 border border-amber-500/30 rounded-2xl p-3.5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-amber-300">
                🖐️ 코트별 출전 선수 수동 지정 추가
              </span>
              <span className="text-[10px] text-slate-400">
                가입회원 · 미가입회원 · 임의등록 선수 모두 배치 가능
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">배정 코트 선택</label>
                <select
                  value={manualCourt}
                  onChange={(e) => setManualCourt(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-amber-300 font-bold"
                >
                  {[1, 2, 3, 4, 5, 6].map((c) => (
                    <option key={c} value={c}>
                      {c}번 코트
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">라운드 / 경기명</label>
                <input
                  type="text"
                  value={manualRoundName}
                  onChange={(e) => setManualRoundName(e.target.value)}
                  placeholder="예: 제 1 라운드, 4강 1경기"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900 p-2.5 rounded-xl border border-emerald-500/30 space-y-2">
                <span className="text-[10px] font-black text-emerald-400 block">TEAM A 선수 2명 배치</span>
                <select
                  value={manualTeamA1}
                  onChange={(e) => setManualTeamA1(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                >
                  <option value="">선수 1 선택</option>
                  {selectedParticipants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.grade}·{getPlayerWeight(p)}점) {p.isGuest ? '[미가입/임의]' : '[가입회원]'}
                    </option>
                  ))}
                </select>
                <select
                  value={manualTeamA2}
                  onChange={(e) => setManualTeamA2(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                >
                  <option value="">선수 2 선택</option>
                  {selectedParticipants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.grade}·{getPlayerWeight(p)}점) {p.isGuest ? '[미가입/임의]' : '[가입회원]'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-900 p-2.5 rounded-xl border border-amber-500/30 space-y-2">
                <span className="text-[10px] font-black text-amber-400 block">TEAM B 선수 2명 배치</span>
                <select
                  value={manualTeamB1}
                  onChange={(e) => setManualTeamB1(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                >
                  <option value="">선수 3 선택</option>
                  {selectedParticipants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.grade}·{getPlayerWeight(p)}점) {p.isGuest ? '[미가입/임의]' : '[가입회원]'}
                    </option>
                  ))}
                </select>
                <select
                  value={manualTeamB2}
                  onChange={(e) => setManualTeamB2(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                >
                  <option value="">선수 4 선택</option>
                  {selectedParticipants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.grade}·{getPlayerWeight(p)}점) {p.isGuest ? '[미가입/임의]' : '[가입회원]'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddManualMatch}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-xs transition shadow-md cursor-pointer"
            >
              + 이 코트 대진 수동 추가하기
            </button>
          </div>
        )}

        {/* 배정된 코트 & 선수 매치업 미리보기 및 실력 균형 지표 + 수동 미세조정 */}
        {assignedMatches.length > 0 && (
          <div className="space-y-2.5 pt-2 border-t border-slate-800">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-white flex items-center gap-1.5">
                <span>📋</span> 배정된 코트 & 실력균형 매치업 ({assignedMatches.length}경기)
              </span>
              <button
                type="button"
                onClick={() => setAssignedMatches([])}
                className="text-[10px] text-red-400 hover:text-red-300 font-bold cursor-pointer"
              >
                전체 초기화
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {assignedMatches.map((m) => {
                const wA = m.teamAWeight ?? getPlayerWeight(m.teamA[0]) + getPlayerWeight(m.teamA[1]);
                const wB = m.teamBWeight ?? getPlayerWeight(m.teamB[0]) + getPlayerWeight(m.teamB[1]);
                const diff = Math.abs(wA - wB);
                const isMatchExpanded = Boolean(expandedMatchIds[m.id]);
                return (
                  <div
                    key={m.id}
                    className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-2 text-xs"
                  >
                    {/* 접힌 요약 헤더: 항목을 누르면 펴져서 코트/선수 수정 가능 */}
                    <button
                      type="button"
                      onClick={() => toggleMatchItem(m.id)}
                      className="w-full flex justify-between items-center gap-2 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-lg shrink-0">
                          {m.courtNumber}번 코트
                        </span>
                        <span className="font-bold text-emerald-300 truncate">
                          {m.teamA[0]?.name}/{m.teamA[1]?.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-black">VS</span>
                        <span className="font-bold text-amber-300 truncate">
                          {m.teamB[0]?.name}/{m.teamB[1]?.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 shrink-0">
                        {isMatchExpanded ? '접기 ▲' : '수정 ▼'}
                      </span>
                    </button>

                    {isMatchExpanded && (
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <select
                              value={m.courtNumber}
                              onChange={(e) => handleUpdateMatchCourt(m.id, Number(e.target.value))}
                              className="bg-amber-400 text-slate-950 font-black text-[11px] px-2 py-0.5 rounded-lg cursor-pointer"
                            >
                              {[1, 2, 3, 4, 5, 6].map((c) => (
                                <option key={c} value={c}>
                                  {c}번 코트
                                </option>
                              ))}
                            </select>
                            <span className="font-bold text-slate-300 text-[11px]">{m.roundName}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold border ${
                                diff <= 2
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              ⚖️ 전력 {wA}점 vs {wB}점 (실력차 {diff}점)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveMatch(m.id)}
                            className="text-[10px] text-slate-500 hover:text-red-400 font-bold cursor-pointer"
                          >
                            삭제 ✕
                          </button>
                        </div>

                        {/* 각 팀 선수 확인 및 클릭 시 수동 변경 가능한 드롭다운 */}
                        <div className="grid grid-cols-11 gap-1.5 items-center">
                          <div className="col-span-5 space-y-1">
                            {[0, 1].map((slot) => (
                              <select
                                key={slot}
                                value={m.teamA[slot as 0 | 1]?.id || ''}
                                onChange={(e) =>
                                  handleUpdateMatchPlayer(m.id, 'teamA', slot as 0 | 1, e.target.value)
                                }
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-emerald-300 font-bold truncate"
                              >
                                {selectedParticipants.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.grade}·{getPlayerWeight(p)}점){p.isGuest ? ' [미가입]' : ''}
                                  </option>
                                ))}
                              </select>
                            ))}
                          </div>

                          <div className="col-span-1 text-center font-black text-slate-500 text-[10px]">
                            VS
                          </div>

                          <div className="col-span-5 space-y-1">
                            {[0, 1].map((slot) => (
                              <select
                                key={slot}
                                value={m.teamB[slot as 0 | 1]?.id || ''}
                                onChange={(e) =>
                                  handleUpdateMatchPlayer(m.id, 'teamB', slot as 0 | 1, e.target.value)
                                }
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-amber-300 font-bold truncate"
                              >
                                {selectedParticipants.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.grade}·{getPlayerWeight(p)}점){p.isGuest ? ' [미가입]' : ''}
                                  </option>
                                ))}
                              </select>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
          </div>
        )}

        {/* 최종 앱 자동 연동 및 경기 시작 버튼 */}
        <button
          type="button"
          onClick={handleLaunchTournament}
          className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:to-red-600 text-slate-950 font-black rounded-2xl text-sm transition-all shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>🚀</span>
          <span>새 대회 개설 확정 및 실시간 코트·대진표 자동 연동 시작!</span>
        </button>
      </div>
    </div>
  );
}
