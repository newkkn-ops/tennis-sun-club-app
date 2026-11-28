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

export interface GroupCourtInfo {
  groupId: string;
  groupName: string;
  playerIds: string[];
  assignedCourts: number[];
}

export interface TournamentConfig {
  id: string;
  title: string;
  mode: 'TOURNAMENT' | 'KDK';
  assignmentType: 'AUTO' | 'MANUAL';
  courtsCount: number;
  selectedCourts: number[];
  minGamesPerPlayer?: number;
  participants: ParticipantPlayer[];
  matches: AssignedMatch[];
  groups?: GroupCourtInfo[];
  groupCourtMap?: Record<string, number[]>;
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
  // 인당 게임 수 (최소 2게임 ~ 최대 6게임, 기본 3게임)
  const [minGamesPerPlayer, setMinGamesPerPlayer] = useState<number>(4);
  const [kdkRoundsCount, setKdkRoundsCount] = useState<number>(4);
  const [assignmentType, setAssignmentType] = useState<'AUTO' | 'MANUAL'>(
    activeTournament?.assignmentType || 'AUTO'
  );
  const [autoBalanceOption, setAutoBalanceOption] = useState<'BALANCE' | 'RANDOM'>('BALANCE');

  // [그룹별 참여선수 등록 (A그룹 ~ D그룹) & 코트 매핑 상태]
  // 기본 그룹: A그룹, B그룹, C그룹, D그룹 (그룹 추가/삭제 가능)
  const [groups, setGroups] = useState<string[]>(['A그룹', 'B그룹', 'C그룹', 'D그룹']);
  const [activeGroupTab, setActiveGroupTab] = useState<string>('A그룹');
  // 그룹별 배정 선수 ID 목록: Record<groupName, playerId[]>
  const [groupPlayerMap, setGroupPlayerMap] = useState<Record<string, string[]>>({
    'A그룹': [],
    'B그룹': [],
    'C그룹': [],
    'D그룹': [],
  });
  // 그룹별 지정 코트 목록: Record<groupName, number[]> (예: A그룹 -> [1, 2], B그룹 -> [3])
  const [groupCourtMap, setGroupCourtMap] = useState<Record<string, number[]>>({
    'A그룹': [1],
    'B그룹': [2],
    'C그룹': [3],
    'D그룹': [],
  });
  // 그룹별 수동 시드 지정 상태: Record<groupName, Record<playerId, string>> ('none' | 'seed1' ~ 'seed10')
  const [groupSeedMap, setGroupSeedMap] = useState<Record<string, Record<string, string>>>({
    'A그룹': {},
    'B그룹': {},
    'C그룹': {},
    'D그룹': {},
  });

  // [KDK 코트별 선수 우선 배정 & 시드 관리 상태]
  // 코트별 배정 선수 ID 목록: Record<courtNumber, playerId[]>
  const [courtPlayerMap, setCourtPlayerMap] = useState<Record<number, string[]>>({});
  // 코트별 수동 시드 지정 상태: Record<courtNumber, Record<playerId, string>> ('none' | 'seed1' ~ 'seed10')
  const [courtSeedMap, setCourtSeedMap] = useState<Record<number, Record<string, string>>>({});
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
      const next: Record<number, Record<string, string>> = {};
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
      const next: Record<number, Record<string, string>> = {};
      Object.entries(prev).forEach(([cStr, sMap]) => {
        const cNum = Number(cStr);
        const nextSub: Record<string, string> = {};
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

    // 그룹별 배정 명단에서도 제외된 선수 자동 정리
    setGroupPlayerMap((prev) => {
      let changed = false;
      const next: Record<string, string[]> = {};
      Object.entries(prev).forEach(([gName, pIds]) => {
        const filtered = pIds.filter((id) => validIds.has(id));
        if (filtered.length !== pIds.length) changed = true;
        next[gName] = filtered;
      });
      return changed ? next : prev;
    });

    setGroupSeedMap((prev) => {
      let changed = false;
      const next: Record<string, Record<string, string>> = {};
      Object.entries(prev).forEach(([gName, sMap]) => {
        const nextSub: Record<string, string> = {};
        Object.entries(sMap).forEach(([id, sVal]) => {
          if (validIds.has(id)) {
            nextSub[id] = sVal;
          } else {
            changed = true;
          }
        });
        next[gName] = nextSub;
      });
      return changed ? next : prev;
    });
  }, [selectedParticipants]);

  // 그룹 추가 핸들러
  const handleAddGroup = () => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const currentCount = groups.length;
    const nextLetter = currentCount < letters.length ? letters[currentCount] : `G${currentCount + 1}`;
    const newGroupName = `${nextLetter}그룹`;
    if (groups.includes(newGroupName)) {
      alert(`이미 ${newGroupName}이 존재합니다.`);
      return;
    }
    setGroups((prev) => [...prev, newGroupName]);
    setGroupPlayerMap((prev) => ({ ...prev, [newGroupName]: [] }));
    setGroupCourtMap((prev) => ({ ...prev, [newGroupName]: [] }));
    setGroupSeedMap((prev) => ({ ...prev, [newGroupName]: {} }));
    setActiveGroupTab(newGroupName);
  };

  // 그룹 삭제 핸들러
  const handleRemoveGroup = (groupNameToRemove: string) => {
    if (groups.length <= 1) {
      alert('최소 1개 이상의 그룹이 필요합니다.');
      return;
    }
    const confirmDelete = window.confirm(`[${groupNameToRemove}]을(를) 삭제하시겠습니까? 배정된 선수와 코트 정보가 해제됩니다.`);
    if (!confirmDelete) return;

    const nextGroups = groups.filter((g) => g !== groupNameToRemove);
    setGroups(nextGroups);
    if (activeGroupTab === groupNameToRemove) {
      setActiveGroupTab(nextGroups[0]);
    }
    setGroupPlayerMap((prev) => {
      const copy = { ...prev };
      delete copy[groupNameToRemove];
      return copy;
    });
    setGroupCourtMap((prev) => {
      const copy = { ...prev };
      delete copy[groupNameToRemove];
      return copy;
    });
    setGroupSeedMap((prev) => {
      const copy = { ...prev };
      delete copy[groupNameToRemove];
      return copy;
    });
  };

  // 특정 그룹의 사용 코트 번호 토글
  const toggleGroupCourt = (groupName: string, courtNum: number) => {
    setGroupCourtMap((prev) => {
      const currentList = prev[groupName] || [];
      const exists = currentList.includes(courtNum);
      const nextList = exists
        ? currentList.filter((c) => c !== courtNum)
        : [...currentList, courtNum].sort((a, b) => a - b);
      return { ...prev, [groupName]: nextList };
    });
  };

  // 특정 그룹에 선수 추가/제거 토글 (다른 그룹 배정 시 원천 차단)
  const togglePlayerInGroup = (groupName: string, playerId: string) => {
    const currentList = groupPlayerMap[groupName] || [];
    const isCurrentAssigned = currentList.includes(playerId);

    // 다른 그룹에 이미 배정되어 있는지 확인
    const otherGroup = Object.keys(groupPlayerMap).find(
      (g) => g !== groupName && groupPlayerMap[g]?.includes(playerId)
    );

    if (!isCurrentAssigned && otherGroup) {
      const p = selectedParticipants.find((item) => item.id === playerId);
      alert(`⚠️ [${p?.name || '선수'}] 님은 이미 [${otherGroup}]에 배정되어 있습니다.\n중복 배정을 방지하기 위해 해당 그룹에서 먼저 해제한 후 선택해 주세요.`);
      return;
    }

    setGroupPlayerMap((prev) => {
      const list = prev[groupName] || [];
      const exists = list.includes(playerId);
      const nextList = exists
        ? list.filter((id) => id !== playerId)
        : [...list, playerId];

      // 선수가 제거되면 시드도 초기화
      if (exists) {
        setGroupSeedMap((sPrev) => {
          const sub = { ...(sPrev[groupName] || {}) };
          delete sub[playerId];
          return { ...sPrev, [groupName]: sub };
        });
      }

      return { ...prev, [groupName]: nextList };
    });
  };

  // 그룹 내 특정 선수의 수동 시드 지정 ('none' | 'seed1' ~ 'seed10')
  const handleSetPlayerGroupSeed = (groupName: string, playerId: string, seedType: string) => {
    setGroupSeedMap((prev) => {
      const currentSub = { ...(prev[groupName] || {}) };
      if (seedType && seedType !== 'none') {
        Object.keys(currentSub).forEach((otherId) => {
          if (otherId !== playerId && currentSub[otherId] === seedType) {
            currentSub[otherId] = 'none';
          }
        });
      }
      currentSub[playerId] = seedType;
      return { ...prev, [groupName]: currentSub };
    });
  };

  // 전체 참여 선수를 활성 그룹들에 실력 균등(스네이크) 자동 분배
  const handleAutoDistributeParticipantsToGroups = () => {
    if (selectedParticipants.length < 4) {
      alert('참여선수를 최소 4명 이상 선택해 주세요.');
      return;
    }
    const activeGroups = groups.length > 0 ? groups : ['A그룹', 'B그룹'];
    const sorted = [...selectedParticipants].sort(
      (a, b) => getCompositeSkillScore(b) - getCompositeSkillScore(a)
    );

    const newGroupMap: Record<string, string[]> = {};
    activeGroups.forEach((g) => {
      newGroupMap[g] = [];
    });

    sorted.forEach((p, idx) => {
      const roundIdx = Math.floor(idx / activeGroups.length);
      const pos = idx % activeGroups.length;
      const gIdx = roundIdx % 2 === 0 ? pos : activeGroups.length - 1 - pos;
      const targetGroup = activeGroups[gIdx];
      newGroupMap[targetGroup].push(p.id);
    });

    setGroupPlayerMap(newGroupMap);
    // 시드 초기화
    const resetSeed: Record<string, Record<string, string>> = {};
    activeGroups.forEach((g) => {
      resetSeed[g] = {};
    });
    setGroupSeedMap(resetSeed);
    alert(`⚖️ 전체 ${selectedParticipants.length}명의 선수가 ${activeGroups.length}개 그룹(${activeGroups.join(', ')})에 실력 순위 스네이크 방식으로 균등 분배되었습니다!`);
  };

  // 특정 코트에 선수 추가/제거 토글
  const togglePlayerInCourt = (courtNum: number, playerId: string) => {
    const isCurrentAssigned = (courtPlayerMap[courtNum] || []).includes(playerId);
    const otherCourt = Object.keys(courtPlayerMap).find(
      (c) => Number(c) !== courtNum && courtPlayerMap[Number(c)]?.includes(playerId)
    );

    if (!isCurrentAssigned && otherCourt) {
      const p = selectedParticipants.find((item) => item.id === playerId);
      alert(`⚠️ [${p?.name || '선수'}] 님은 이미 ${otherCourt}번 코트에 배정되어 있습니다.\n해당 코트에서 배정을 먼저 해제한 후 선택해 주세요.`);
      return;
    }

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

  // 특정 코트의 선수 시드 수동 지정 ('none' | 'seed1' ~ 'seed10')
  const handleSetPlayerSeed = (
    courtNum: number,
    playerId: string,
    seedType: string
  ) => {
    setCourtSeedMap((prev) => {
      const currentSub = { ...(prev[courtNum] || {}) };

      // 동일 코트 내에 이미 해당 시드(seed1 ~ seed10)를 가진 다른 선수가 있다면 그 선수는 'none'으로 자동 해제
      if (seedType && seedType !== 'none') {
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
  // [🌟 그룹별(A~D그룹) KDK 대진표 자동 생성 엔진]
  // - 각 그룹에 배정된 선수를 기준으로 V2025 KDK 순환 대진표(인당 minGamesPerPlayer 게임) 생성
  // - 각 그룹에 지정된 사용 코트(예: A그룹 -> [1, 2], B그룹 -> [3])를 경기 번호에 우선 배분
  // - 지정 코트가 없는 그룹은 전체 selectedCourts에서 순환 배정
  // ============================================================================
  const handleGenerateKdkMatchesForGroups = () => {
    if (!tournamentTitle.trim()) {
      alert('먼저 1단계에서 대회명을 입력해 주세요.');
      return;
    }
    const activeGroupsWithPlayers = groups.filter(
      (g) => (groupPlayerMap[g] || []).length >= 4
    );

    if (activeGroupsWithPlayers.length === 0) {
      alert(
        '최소 1개 이상의 그룹에 4명 이상의 선수가 등록되어야 대진표를 생성할 수 있습니다.\n[전체 인원 그룹별 실력 균등 자동 분배]를 누르거나 각 그룹 탭에서 선수를 등록해 주세요.'
      );
      return;
    }

    const parseSeedRank = (s?: string) => {
      if (!s || s === 'none') return 999;
      const match = s.match(/seed(\d+)/);
      return match ? parseInt(match[1], 10) : 999;
    };

    const generated: AssignedMatch[] = [];
    const allCourts = selectedCourts.length > 0 ? selectedCourts : [1, 2];

    activeGroupsWithPlayers.forEach((gName) => {
      const pIds = groupPlayerMap[gName] || [];
      const gPlayers = pIds
        .map((id) => selectedParticipants.find((p) => p.id === id))
        .filter(Boolean) as ParticipantPlayer[];

      if (gPlayers.length < 4) return;

      const groupCourts = (groupCourtMap[gName] || []).filter((c) => allCourts.includes(c));
      const effectiveCourts = groupCourts.length > 0 ? groupCourts : allCourts;

      // 시드 파싱
      const seedMap = groupSeedMap[gName] || {};
      const manualSeedIds = Object.keys(seedMap)
        .filter((id) => seedMap[id] && seedMap[id] !== 'none' && gPlayers.some((p) => p.id === id))
        .sort((a, b) => parseSeedRank(seedMap[a]) - parseSeedRank(seedMap[b]));

      const mappedPlayers = gPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        grade: p.grade,
        birthDate: p.birthDate,
        age: p.age,
        experienceYears: p.experienceYears,
        gender: p.gender,
        isGuest: p.isGuest,
      }));

      // 대표 코트 번호 (그룹의 첫번째 코트 또는 1번)
      const baseCourt = effectiveCourts[0] || 1;

      const games = generateCourtKDKGames(baseCourt, mappedPlayers, minGamesPerPlayer, {
        minGamesPerPlayer,
        assignMode: manualSeedIds.length > 0 ? 'SEED_AUTO' : 'AUTO',
        seedPlayerIds: manualSeedIds,
        overrideTotalGames: Math.max(minGamesPerPlayer, Math.ceil((mappedPlayers.length * minGamesPerPlayer) / 4)),
      });

      games.forEach((g, gIdx) => {
        const pA1 = gPlayers.find((p) => p.id === g.teamA[0].id) || (g.teamA[0] as ParticipantPlayer);
        const pA2 = gPlayers.find((p) => p.id === g.teamA[1].id) || (g.teamA[1] as ParticipantPlayer);
        const pB1 = gPlayers.find((p) => p.id === g.teamB[0].id) || (g.teamB[0] as ParticipantPlayer);
        const pB2 = gPlayers.find((p) => p.id === g.teamB[1].id) || (g.teamB[1] as ParticipantPlayer);

        const weights = calcMatchWeights([pA1, pA2], [pB1, pB2]);
        const assignedCourt = effectiveCourts[gIdx % effectiveCourts.length];
        const seedNote = manualSeedIds.length > 0 ? ` · 시드(${manualSeedIds.length}명) 고정` : '';

        generated.push({
          id: `match_grp_${gName}_g${g.gameNumber}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          round: g.gameNumber,
          roundName: `[${gName}] 제 ${g.gameNumber}경기 (${assignedCourt}코트 배정${seedNote})`,
          courtNumber: assignedCourt,
          teamA: [pA1, pA2],
          teamB: [pB1, pB2],
          ...weights,
          scoreA: 0,
          scoreB: 0,
          status: gIdx === 0 ? 'playing' : 'waiting',
        });
      });
    });

    setAssignedMatches(generated);

    // KdkCourtOperations 호환용 courtPlayerMap 동기화
    const newCourtPlayerMap: Record<number, string[]> = {};
    allCourts.forEach((c) => {
      newCourtPlayerMap[c] = [];
    });
    // 그룹별 지정 코트에 선수들 분산 매핑
    groups.forEach((gName) => {
      const pIds = groupPlayerMap[gName] || [];
      const gCourts = (groupCourtMap[gName] || []).filter((c) => allCourts.includes(c));
      const targetCourts = gCourts.length > 0 ? gCourts : allCourts;
      pIds.forEach((pid, pIdx) => {
        const cTarget = targetCourts[pIdx % targetCourts.length];
        if (newCourtPlayerMap[cTarget] && !newCourtPlayerMap[cTarget].includes(pid)) {
          newCourtPlayerMap[cTarget].push(pid);
        }
      });
    });
    setCourtPlayerMap(newCourtPlayerMap);

    alert(
      `🎉 [그룹별 KDK 대진표 자동 편성 완료]\n\n` +
      `• 생성 그룹: ${activeGroupsWithPlayers.map((g) => `${g}(${(groupPlayerMap[g] || []).length}명)`).join(', ')}\n` +
      `• 인당 게임수: 최소 ${minGamesPerPlayer}게임 보장\n` +
      `• 생성 경기: 총 ${generated.length}경기\n\n` +
      `하단 대진표 미리보기에서 그룹별 매치 구성 및 배정 코트를 확인하세요!`
    );
  };

  // ============================================================================
  // [1. ⚡ 자동 방식: 스네이크 균등 분배 + KDK_V2025 순환 대진표 자동 생성 엔진]
  // ============================================================================
  const handleAutoAssignKdkSnakeAndGenerate = () => {
    if (!tournamentTitle.trim()) {
      alert('먼저 1단계에서 대회명을 입력해 주세요.');
      return;
    }
    if (selectedParticipants.length < 4) {
      alert('KDK 대회를 진행하려면 최소 4명 이상의 참여선수를 선택하거나 등록해 주세요.');
      return;
    }

    const courts = selectedCourts.length > 0 ? selectedCourts : [1, 2];
    if (selectedParticipants.length < courts.length * 4) {
      // 코트 수가 인원 대비 너무 많을 경우 알림 (최소 코트당 4명)
      const maxPossibleCourts = Math.max(1, Math.floor(selectedParticipants.length / 4));
      if (courts.length > maxPossibleCourts) {
        alert(
          `⚠️ 선택된 참여 인원(${selectedParticipants.length}명)으로는 최대 ${maxPossibleCourts}개 코트까지만 운영 가능합니다.\n사용할 코트 수를 ${maxPossibleCourts}개 이하로 조절하거나 참여 선수를 추가해 주세요.`
        );
        return;
      }
    }

    // 1) 전체 참여 선수를 부수(금배>은배>국화>동배>개나리>테린이) 및 보유 점수/실력 순으로 정렬
    const sorted = [...selectedParticipants].sort(
      (a, b) => getCompositeSkillScore(b) - getCompositeSkillScore(a)
    );

    // 2) 지정된 코트들에 스네이크(1→2→3→3→2→1) 방식으로 균등 배분 (중복 원천 차단)
    const newCourtMap: Record<number, string[]> = {};
    courts.forEach((c) => {
      newCourtMap[c] = [];
    });

    sorted.forEach((p, idx) => {
      const roundIdx = Math.floor(idx / courts.length);
      const pos = idx % courts.length;
      const cIdx = roundIdx % 2 === 0 ? pos : courts.length - 1 - pos;
      const targetCourt = courts[cIdx];
      newCourtMap[targetCourt].push(p.id);
    });

    setCourtPlayerMap(newCourtMap);
    // 자동 배정 시 수동 시드는 초기화
    const resetSeedMap: Record<number, Record<string, string>> = {};
    courts.forEach((c) => {
      resetSeedMap[c] = {};
    });
    setCourtSeedMap(resetSeedMap);

    // 3) 각 코트별로 KDK_V2025 고정 순환 대진표(인원별 최소 2~6게임) 자동 생성
    const generated: AssignedMatch[] = [];

    courts.forEach((cNum) => {
      const assignedIds = newCourtMap[cNum] || [];
      const courtPlayers = assignedIds
        .map((id) => selectedParticipants.find((p) => p.id === id))
        .filter(Boolean) as ParticipantPlayer[];

      if (courtPlayers.length < 4) return;

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

      const games = generateCourtKDKGames(cNum, mappedPlayers, minGamesPerPlayer, {
        minGamesPerPlayer,
        assignMode: 'AUTO',
        overrideTotalGames: Math.max(minGamesPerPlayer, Math.ceil((mappedPlayers.length * minGamesPerPlayer) / 4)),
      });

      games.forEach((g) => {
        const pA1 = courtPlayers.find((p) => p.id === g.teamA[0].id) || (g.teamA[0] as ParticipantPlayer);
        const pA2 = courtPlayers.find((p) => p.id === g.teamA[1].id) || (g.teamA[1] as ParticipantPlayer);
        const pB1 = courtPlayers.find((p) => p.id === g.teamB[0].id) || (g.teamB[0] as ParticipantPlayer);
        const pB2 = courtPlayers.find((p) => p.id === g.teamB[1].id) || (g.teamB[1] as ParticipantPlayer);

        const weights = calcMatchWeights([pA1, pA2], [pB1, pB2]);

        generated.push({
          id: `match_kdk_auto_c${cNum}_g${g.gameNumber}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          round: g.gameNumber,
          roundName: `${cNum}코트 제 ${g.gameNumber}경기 (KDK 자동 실력균등)`,
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

    alert(
      `⚡ [자동 방식 KDK 대진표 생성 완료]\n\n` +
      `• 참여 선수: 총 ${selectedParticipants.length}명\n` +
      `• 운영 코트: ${courts.length}개 코트 (${courts.map((c) => `${c}코트(${newCourtMap[c]?.length || 0}명)`).join(', ')})\n` +
      `• 배분 방식: 부수/점수 기준 스네이크 균등 분배\n` +
      `• 생성 경기: 총 ${generated.length}경기 (1인 최소 ${minGamesPerPlayer}게임 보장)\n\n` +
      `하단 대진표 미리보기에서 게임 순서 및 선수별 배정을 확인하세요!`
    );
  };

  // ============================================================================
  // [2. ✋ 수동 방식: 시드 지정 유지 + 나머지 미배정 선수 자동 채우기 & KDK 대진표 생성]
  // ============================================================================
  const handleFillRemainingAndGenerateKdk = () => {
    if (!tournamentTitle.trim()) {
      alert('먼저 1단계에서 대회명을 입력해 주세요.');
      return;
    }
    if (selectedParticipants.length < 4) {
      alert('경기를 진행하려면 최소 4명 이상의 참여선수를 선택하거나 등록해 주세요.');
      return;
    }

    const courts = selectedCourts.length > 0 ? selectedCourts : [1, 2];

    // 현재 이미 특정 코트에 수동 배정된 선수 ID 집합 수집
    const alreadyAssignedIdSet = new Set<string>();
    courts.forEach((cNum) => {
      (courtPlayerMap[cNum] || []).forEach((id) => alreadyAssignedIdSet.add(id));
    });

    // 아직 어떤 코트에도 배정되지 않은 미배정 선수 목록 추출
    const unassignedPlayers = selectedParticipants.filter((p) => !alreadyAssignedIdSet.has(p.id));

    // 미배정 선수들을 실력 순으로 정렬
    const sortedUnassigned = [...unassignedPlayers].sort(
      (a, b) => getCompositeSkillScore(b) - getCompositeSkillScore(a)
    );

    // 각 코트의 현재 인원 수를 기준으로, 가장 인원이 적은 코트부터 균등하게 스네이크 배분
    const nextCourtMap: Record<number, string[]> = {};
    courts.forEach((cNum) => {
      nextCourtMap[cNum] = [...(courtPlayerMap[cNum] || [])];
    });

    // 미배정 선수들을 인원이 적은 코트 우선 + 스네이크 방식으로 채움
    sortedUnassigned.forEach((p) => {
      // 현재 인원이 가장 적은 코트 찾기 (인원이 같으면 코트 번호 순)
      let minCourt = courts[0];
      let minCount = nextCourtMap[minCourt].length;
      courts.forEach((cNum) => {
        if (nextCourtMap[cNum].length < minCount) {
          minCount = nextCourtMap[cNum].length;
          minCourt = cNum;
        }
      });
      nextCourtMap[minCourt].push(p.id);
    });

    // 배정 후 코트별 인원 최소 4명 검증
    for (const cNum of courts) {
      if ((nextCourtMap[cNum] || []).length < 4) {
        alert(
          `⚠️ ${cNum}번 코트의 배정 인원이 ${(nextCourtMap[cNum] || []).length}명입니다.\nKDK 경기를 진행하려면 각 코트마다 최소 4명 이상의 선수가 필요합니다. 참여 선수를 더 추가해 주세요.`
        );
        return;
      }
    }

    setCourtPlayerMap(nextCourtMap);

    // 수동 시드 지정 정보 파싱 및 KDK 대진표 자동 생성
    const parseSeedRank = (s?: string) => {
      if (!s || s === 'none') return 999;
      const match = s.match(/seed(\d+)/);
      return match ? parseInt(match[1], 10) : 999;
    };

    const generated: AssignedMatch[] = [];

    courts.forEach((cNum) => {
      const assignedIds = nextCourtMap[cNum] || [];
      const courtPlayers = assignedIds
        .map((id) => selectedParticipants.find((p) => p.id === id))
        .filter(Boolean) as ParticipantPlayer[];

      // 관리자가 수동 지정한 시드 정보 (1시드 ~ 10시드 순번 정렬)
      const seedMap = courtSeedMap[cNum] || {};
      const manualSeedIds = Object.keys(seedMap)
        .filter((id) => seedMap[id] && seedMap[id] !== 'none' && courtPlayers.some((p) => p.id === id))
        .sort((a, b) => parseSeedRank(seedMap[a]) - parseSeedRank(seedMap[b]));

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

      const games = generateCourtKDKGames(cNum, mappedPlayers, minGamesPerPlayer, {
        minGamesPerPlayer,
        assignMode: manualSeedIds.length > 0 ? 'SEED_AUTO' : 'AUTO',
        seedPlayerIds: manualSeedIds,
        overrideTotalGames: Math.max(minGamesPerPlayer, Math.ceil((mappedPlayers.length * minGamesPerPlayer) / 4)),
      });

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

    alert(
      `🖐️ [시드 고정 및 나머지 선수 자동 채우기 완료]\n\n` +
      `• 지정된 수동 시드 자리는 그대로 유지되었습니다.\n` +
      `• 미배정 선수 ${sortedUnassigned.length}명이 실력 균등 기준으로 각 코트에 자동 분배되었습니다.\n` +
      `• 총 ${generated.length}경기 KDK 대진표가 즉시 편성되었습니다!`
    );
  };

  // ============================================================================
  // [3. 시드 고정 후 나머지 인원 실력균등 자동배치 실행 버튼 엔진]
  // ============================================================================
  const handleAssignKdkWithFixedSeeds = () => {
    handleFillRemainingAndGenerateKdk();
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
          minGamesPerPlayer
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
      minGamesPerPlayer,
      participants: selectedParticipants,
      matches: assignedMatches,
      groups: groups.map((g) => ({
        groupId: g,
        groupName: g,
        playerIds: groupPlayerMap[g] || [],
        assignedCourts: groupCourtMap[g] || [],
      })),
      groupCourtMap,
      status: 'ongoing',
      createdAt: new Date().toISOString(),
    };

    onApplyTournament(config);
  };

  const allStepsOpen = openSteps.step1 && openSteps.step2 && openSteps.step3 && openSteps.step4;

  // [+ 새 대회 개설] 모달(isModal === true) 내부가 아닌 일반 화면에 인라인으로 호출되었을 경우 중복 렌더링 방지
  if (!isModal) {
    return null;
  }

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
          <>
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

          {/* KDK 방식 선택 시: 인당 게임 수 선택 (최소 2게임 ~ 최대 6게임) */}
          {tournamentMode === 'KDK' && (
            <div className="mt-3.5 bg-slate-950/90 border border-emerald-500/30 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                  <span>🎯</span> 참여선수 1인당 게임 수 선택 (최소 2게임 ~ 최대 6게임)
                </span>
                <span className="text-[10px] text-amber-300 font-bold bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                  선택: 인당 {minGamesPerPlayer}게임 (V2025 표준)
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                각 선수의 출전 횟수가 <strong>{minGamesPerPlayer}게임</strong>으로 균등하게 배분되도록 대진표를 자동 생성합니다.
              </p>
              <div className="grid grid-cols-5 gap-2">
                {[2, 3, 4, 5, 6].map((gCount) => {
                  const isSelected = minGamesPerPlayer === gCount;
                  return (
                    <button
                      key={gCount}
                      type="button"
                      onClick={() => {
                        setMinGamesPerPlayer(gCount);
                        setKdkRoundsCount(gCount);
                      }}
                      className={`py-2 px-1 rounded-xl text-xs font-black border transition-all cursor-pointer text-center ${
                        isSelected
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 border-emerald-400 shadow-md font-extrabold scale-[1.02]'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      <div className="text-sm font-black">{gCount}게임</div>
                      <div className="text-[9px] opacity-80 mt-0.5">
                        {gCount === 3 || gCount === 4 ? '추천' : `${gCount}R`}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 홀수/잔여 매치 안내 배지 */}
              {selectedParticipants.length > 0 && (
                <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400 flex-wrap gap-1">
                  <span>
                    총 {selectedParticipants.length}명 참여 시 총 경기 수: 약{' '}
                    <strong className="text-emerald-300">
                      {Math.ceil((selectedParticipants.length * minGamesPerPlayer) / 4)}경기
                    </strong>
                  </span>
                  {(selectedParticipants.length * minGamesPerPlayer) % 4 !== 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                      ℹ️ 인원/경기수 조합에 따라 일부 선수가 1게임 추가 출전할 수 있습니다.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          </>
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
            <span>👥</span>
            <span>그룹별(A~D) 참여선수 등록 & KDK 대진</span>
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
            <span>코트별 선수 직접배치 & 토너먼트 매칭</span>
          </button>
        </div>

        {/* [A] 그룹별(A그룹~D그룹) 참여선수 등록 및 KDK 순서표 생성 패널 */}
        {assignmentType === 'AUTO' && (
          <div className="bg-slate-950/90 border border-emerald-500/30 rounded-2xl p-3.5 space-y-4">
            {tournamentMode === 'KDK' ? (
              <div className="space-y-4">
                {/* 상단 그룹 헤더 & 컨트롤 */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div>
                    <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                      <span>🎾</span>
                      <span>그룹별(A~D) 참여선수 등록 및 코트 지정</span>
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      코트별 선수 직접 등록 대신 그룹별로 참여 선수를 등록하고, 각 그룹이 사용할 코트를 지정합니다.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20 font-bold">
                      1인 최소 {minGamesPerPlayer}게임 KDK 순환
                    </span>
                    <button
                      type="button"
                      onClick={handleAddGroup}
                      className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-[11px] font-black cursor-pointer transition flex items-center gap-1"
                      title="새로운 그룹 추가 (E그룹 등)"
                    >
                      <span>＋</span>
                      <span>그룹 추가</span>
                    </button>
                  </div>
                </div>

                {/* 그룹 탭 버튼 목록 (A그룹, B그룹, C그룹, D그룹...) */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {groups.map((gName) => {
                    const count = (groupPlayerMap[gName] || []).length;
                    const cList = groupCourtMap[gName] || [];
                    const isActive = activeGroupTab === gName;
                    return (
                      <div key={gName} className="flex items-center shrink-0">
                        <button
                          type="button"
                          onClick={() => setActiveGroupTab(gName)}
                          className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                            isActive
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20'
                              : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <span>{gName}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                              isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-emerald-300'
                            }`}
                          >
                            {count}명
                          </span>
                          {cList.length > 0 && (
                            <span
                              className={`text-[9px] px-1 rounded ${
                                isActive ? 'bg-slate-950/30 text-slate-950' : 'text-amber-400'
                              }`}
                            >
                              ({cList.join(',')}코트)
                            </span>
                          )}
                        </button>
                        {groups.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveGroup(gName)}
                            className="ml-1 w-5 h-5 rounded-md text-slate-500 hover:text-red-400 hover:bg-slate-800 text-[10px] font-bold flex items-center justify-center cursor-pointer transition"
                            title={`${gName} 삭제`}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 현재 활성화된 그룹의 상세 설정 카드 */}
                <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-3.5 space-y-3 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-amber-300">
                        🏷️ [{activeGroupTab}] 참여 선수 (
                        {(groupPlayerMap[activeGroupTab] || []).length}명 등록됨)
                      </span>
                      {(groupPlayerMap[activeGroupTab] || []).length < 4 && (
                        <span className="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                          최소 4명 필요
                        </span>
                      )}
                    </div>

                    {/* 이 그룹이 사용할 코트 번호 지정 */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">
                        🏟️ 사용 코트 지정:
                      </span>
                      {selectedCourts.map((cNum) => {
                        const isCourtAssigned = (groupCourtMap[activeGroupTab] || []).includes(cNum);
                        return (
                          <button
                            key={cNum}
                            type="button"
                            onClick={() => toggleGroupCourt(activeGroupTab, cNum)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-black border transition cursor-pointer ${
                              isCourtAssigned
                                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-xs'
                                : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {cNum}코트 {isCourtAssigned ? '✓' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 현재 그룹에 등록된 선수 명단 & 시드 지정 */}
                  {(groupPlayerMap[activeGroupTab] || []).length === 0 ? (
                    <div className="text-center py-5 text-xs text-slate-500 bg-slate-950/60 rounded-xl border border-dashed border-slate-800">
                      아직 {activeGroupTab}에 등록된 선수가 없습니다. 아래 선수 풀에서 클릭하여 추가하세요.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(groupPlayerMap[activeGroupTab] || []).map((pId) => {
                        const player = selectedParticipants.find((p) => p.id === pId);
                        if (!player) return null;
                        const currentSeed = (groupSeedMap[activeGroupTab] || {})[pId] || 'none';
                        return (
                          <div
                            key={pId}
                            className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0 flex items-center gap-1.5">
                              <span className="font-bold text-white truncate">{player.name}</span>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                ({player.grade}·{getPlayerWeight(player)}점)
                              </span>
                              {player.isGuest && (
                                <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded shrink-0">
                                  미가입
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* 시드 선택 드롭다운 */}
                              <select
                                value={currentSeed}
                                onChange={(e) =>
                                  handleSetPlayerGroupSeed(activeGroupTab, pId, e.target.value)
                                }
                                className={`px-2 py-1 rounded-lg text-[10px] font-black border cursor-pointer ${
                                  currentSeed !== 'none'
                                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                                    : 'bg-slate-900 text-slate-400 border-slate-800'
                                }`}
                              >
                                <option value="none">시드 없음</option>
                                <option value="seed1">⭐ 1시드</option>
                                <option value="seed2">⭐ 2시드</option>
                                <option value="seed3">⭐ 3시드</option>
                                <option value="seed4">⭐ 4시드</option>
                                <option value="seed5">5시드</option>
                                <option value="seed6">6시드</option>
                                <option value="seed7">7시드</option>
                                <option value="seed8">8시드</option>
                                <option value="seed9">9시드</option>
                                <option value="seed10">10시드</option>
                              </select>

                              {/* 제거 버튼 */}
                              <button
                                type="button"
                                onClick={() => togglePlayerInGroup(activeGroupTab, pId)}
                                className="w-6 h-6 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-black flex items-center justify-center cursor-pointer transition"
                                title="그룹 배정 해제"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 전체 참여 선수 풀: 현재 그룹 선택 / 타 그룹 배정 disabled 차단 */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2 mt-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-300">
                        ➕ [{activeGroupTab}] 선수 등록 / 해제 (클릭 시 토글)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        미배정 인원:{' '}
                        <strong className="text-emerald-400">
                          {
                            selectedParticipants.filter(
                              (p) =>
                                !Object.values(groupPlayerMap).some((ids) => ids.includes(p.id))
                            ).length
                          }
                        </strong>
                        명 / 총 {selectedParticipants.length}명
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {selectedParticipants.map((p) => {
                        const isAssignedToThisGroup = (
                          groupPlayerMap[activeGroupTab] || []
                        ).includes(p.id);

                        // 다른 그룹에 이미 배정된 경우 확인
                        const assignedOtherGroup = Object.keys(groupPlayerMap).find(
                          (g) => g !== activeGroupTab && groupPlayerMap[g]?.includes(p.id)
                        );

                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              if (assignedOtherGroup) {
                                alert(
                                  `⚠️ [${p.name}] 님은 이미 [${assignedOtherGroup}]에 배정되어 있습니다.\n중복 배정을 방지하기 위해 해당 그룹에서 먼저 해제한 후 선택해 주세요.`
                                );
                                return;
                              }
                              togglePlayerInGroup(activeGroupTab, p.id);
                            }}
                            disabled={Boolean(assignedOtherGroup)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                              isAssignedToThisGroup
                                ? 'bg-emerald-400 text-slate-950 border-emerald-300 font-black shadow-sm'
                                : assignedOtherGroup
                                ? 'bg-slate-950/40 text-slate-600 border-slate-800/80 cursor-not-allowed opacity-45'
                                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <span>{p.name}</span>
                            <span className="text-[9px] opacity-75">
                              ({p.grade}·{getPlayerWeight(p)}점)
                            </span>
                            {isAssignedToThisGroup && (
                              <span className="text-[9px] bg-slate-950/20 px-1 rounded font-black">
                                ✓
                              </span>
                            )}
                            {assignedOtherGroup && (
                              <span className="text-[9px] bg-slate-900 text-amber-500 font-bold px-1 rounded border border-amber-500/20">
                                [{assignedOtherGroup} 배정됨]
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 자동 분배 & 대진표 생성 컨트롤 액션 버튼 */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={handleAutoDistributeParticipantsToGroups}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 font-black rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <span>⚖️</span>
                    <span>
                      전체 인원 그룹별 실력 균등 자동 분배 ({selectedParticipants.length}명 ➔ {groups.length}개 그룹 스네이크 배치)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateKdkMatchesForGroups}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs transition shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>⚡</span>
                    <span>
                      그룹별 KDK 대진표 자동 생성 (선택된 {groups.length}개 그룹 · 1인 최소 {minGamesPerPlayer}게임 보장)
                    </span>
                  </button>
                  <p className="text-[10px] text-center text-slate-400">
                    💡 각 그룹에 배정된 선수를 기준으로 V2025 표준 파트너 순환 대진표가 자동 편성되며, 경기 진행 중 관리자가 지정한 코트로 자동 투입됩니다.
                  </p>
                </div>
              </div>
            ) : (
              /* 토너먼트 모드 전용 */
              <div className="space-y-3">
                <p className="text-xs text-slate-300">토너먼트 자동 배정 설정</p>
                <button
                  type="button"
                  onClick={handleAutoAssign}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black rounded-xl text-xs cursor-pointer"
                >
                  토너먼트 자동 배정 실행
                </button>
              </div>
            )}
          </div>
        )}

        {/* [B] 수동 방식 설정 패널 */}
        {assignmentType === 'MANUAL' && (
          <div className="bg-slate-950/90 border border-amber-500/30 rounded-2xl p-3.5 space-y-3.5">
            {tournamentMode === 'KDK' ? (
              /* KDK 수동 모드: 코트별 선수 지정 + 상위 시드 지정 + [나머지 미배정 선수 자동 채우기 & KDK 대진표 생성] */
              <div className="space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div>
                    <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <span>✋</span>
                      <span>코트별 참여 선수 및 시드(Seed) 수동 지정</span>
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      코트별로 상위 실적자나 시드를 먼저 배정하고, 아래 버튼을 눌러 나머지 선수를 실력 균등으로 채우며 KDK 대진표를 완성하세요.
                    </p>
                  </div>
                  <span className="text-[10px] text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20 font-bold">
                    1인 최소 {minGamesPerPlayer}게임 보장
                  </span>
                </div>

                {/* 코트 탭 전환 버튼 */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <span className="text-[11px] font-bold text-slate-400 shrink-0">선택 코트:</span>
                  {(selectedCourts.length > 0 ? selectedCourts : [1, 2]).map((cNum) => {
                    const assignedCount = (courtPlayerMap[cNum] || []).length;
                    const isActive = activeEditingCourt === cNum;
                    return (
                      <button
                        key={cNum}
                        type="button"
                        onClick={() => setActiveEditingCourt(cNum)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                          isActive
                            ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                            : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span>{cNum}번 코트</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-amber-300'
                          }`}
                        >
                          {assignedCount}명
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* 현재 활성화된 코트의 배정 명단 및 시드 지정 */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-black text-amber-300">
                      🏟️ {activeEditingCourt}번 코트 배정 명단 및 시드 설정 (
                      {(courtPlayerMap[activeEditingCourt] || []).length}명 배정됨)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      * 시드 1~10을 부여하면 대진표 생성 시 우선 랭크로 고정됩니다.
                    </span>
                  </div>

                  {(courtPlayerMap[activeEditingCourt] || []).length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-500 bg-slate-950/50 rounded-xl border border-dashed border-slate-800">
                      아직 {activeEditingCourt}번 코트에 배정된 선수가 없습니다. 아래 선수 풀에서 클릭하여 배정하세요.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(courtPlayerMap[activeEditingCourt] || []).map((pId) => {
                        const player = selectedParticipants.find((p) => p.id === pId);
                        if (!player) return null;
                        const currentSeed = (courtSeedMap[activeEditingCourt] || {})[pId] || 'none';
                        return (
                          <div
                            key={pId}
                            className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0 flex items-center gap-1.5">
                              <span className="font-bold text-white truncate">{player.name}</span>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                ({player.grade}·{getPlayerWeight(player)}점)
                              </span>
                              {player.isGuest && (
                                <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded shrink-0">
                                  미가입
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* 시드 선택 드롭다운 */}
                              <select
                                value={currentSeed}
                                onChange={(e) =>
                                  handleSetPlayerSeed(activeEditingCourt, pId, e.target.value)
                                }
                                className={`px-2 py-1 rounded-lg text-[11px] font-black border cursor-pointer ${
                                  currentSeed !== 'none'
                                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                                    : 'bg-slate-900 text-slate-400 border-slate-800'
                                }`}
                              >
                                <option value="none">시드 없음</option>
                                <option value="seed1">⭐ 1시드</option>
                                <option value="seed2">⭐ 2시드</option>
                                <option value="seed3">⭐ 3시드</option>
                                <option value="seed4">⭐ 4시드</option>
                                <option value="seed5">5시드</option>
                                <option value="seed6">6시드</option>
                                <option value="seed7">7시드</option>
                                <option value="seed8">8시드</option>
                                <option value="seed9">9시드</option>
                                <option value="seed10">10시드</option>
                              </select>

                              {/* 제거 버튼 */}
                              <button
                                type="button"
                                onClick={() => togglePlayerInCourt(activeEditingCourt, pId)}
                                className="w-6 h-6 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-black flex items-center justify-center cursor-pointer transition"
                                title="코트 배정 해제"
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

                {/* 미배정 및 전체 참여 선수 선택 풀 */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-300">
                      ➕ {activeEditingCourt}번 코트에 선수 추가 / 해제 (클릭 시 토글)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      총 {selectedParticipants.length}명 중 미배정{' '}
                      <strong className="text-emerald-400">
                        {
                          selectedParticipants.filter(
                            (p) =>
                              !Object.values(courtPlayerMap).some((ids) => ids.includes(p.id))
                          ).length
                        }
                      </strong>
                      명
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1">
                    {selectedParticipants.map((p) => {
                      const isAssignedToThisCourt = (
                        courtPlayerMap[activeEditingCourt] || []
                      ).includes(p.id);
                      const otherCourt = Object.keys(courtPlayerMap).find(
                        (c) =>
                          Number(c) !== activeEditingCourt &&
                          courtPlayerMap[Number(c)]?.includes(p.id)
                      );

                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePlayerInCourt(activeEditingCourt, p.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                            isAssignedToThisCourt
                              ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow-sm'
                              : otherCourt
                              ? 'bg-slate-950/40 text-slate-600 border-slate-800 cursor-not-allowed opacity-50'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <span>{p.name}</span>
                          <span className="text-[9px] opacity-75">
                            ({p.grade})
                          </span>
                          {otherCourt && (
                            <span className="text-[9px] text-amber-500 font-normal">
                              ({otherCourt}코트)
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 🌟 핵심 실행 버튼: 수동 시드 고정 + 나머지 미배정 선수 자동 채우기 & KDK 대진표 생성 */}
                <div className="space-y-1.5 pt-1">
                  <button
                    type="button"
                    onClick={handleFillRemainingAndGenerateKdk}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs transition shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>⚡</span>
                    <span>
                      나머지 미배정 선수 자동 채우기 & KDK 대진표 생성 (시드 고정 유지)
                    </span>
                  </button>
                  <p className="text-[10px] text-center text-slate-400">
                    💡 관리자가 지정한 시드와 코트 배정 선수는 그대로 고정되고, 남은 선수들만 실력 균등 스네이크 방식으로 자동 분배되어 1인 최소 {minGamesPerPlayer}게임 순환 대진표가 완성됩니다.
                  </p>
                </div>
              </div>
            ) : (
              /* 토너먼트 모드 수동 매치 추가 패널 */
              <div className="space-y-3">
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
          </div>
        )}

        {/* 배정된 코트 & 선수 매치업 미리보기 및 실력 균형 지표 + 수동 미세조정 */}
        {assignedMatches.length > 0 && (
          <div className="space-y-3 pt-2.5 border-t border-slate-800">
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

            {/* 선수별 배정 경기 수 집계 요약 뱃지 */}
            {tournamentMode === 'KDK' && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-amber-300">👥 선수별 출전 경기 수 요약 (목표: {minGamesPerPlayer}게임)</span>
                  <span className="text-[10px] text-slate-400">모든 선수 공평 배정 확인</span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                  {selectedParticipants.map((p) => {
                    const count = assignedMatches.filter(
                      (m) =>
                        m.teamA.some((a) => a.id === p.id) || m.teamB.some((b) => b.id === p.id)
                    ).length;
                    const isMinMet = count >= minGamesPerPlayer;
                    return (
                      <span
                        key={p.id}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1 ${
                          isMinMet
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : count > 0
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-red-500/15 text-red-400 border border-red-500/30'
                        }`}
                      >
                        <span>{p.name}</span>
                        <span className="font-black">({count}경기)</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {assignedMatches.map((m, mIdx) => {
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
                          {m.courtNumber}코트 [게임 {m.round || mIdx + 1}]
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
