'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, toAuthEmail, mapSupabaseUserRow } from './lib/supabase';
import AdminTournamentManager, {
  TournamentConfig,
  ParticipantPlayer,
} from './components/AdminTournamentManager';
import AdminUserManagement, { ManagedMember } from './components/AdminUserManagement';
import KdkCourtOperations from './components/KdkCourtOperations';
import AppBackExitOverlay from './components/AppBackExitOverlay';
import BirthDateSelector from './components/BirthDateSelector';
import { useAppBackHandler } from './hooks/useAppBackHandler';
import {
  generateKDKSchedule,
  GRADE_WEIGHTS,
  getCompositeSkillScore,
  resolvePlayerAge,
} from './lib/kdk';
import {
  calculateKoreanManAge,
  formatBirthDateDisplay,
  formatManAgeLabel,
} from './lib/age';

export interface TournamentRecord {
  id: string;
  name: string;
  date: string; // 진행날짜 자동 생성 (YYYY-MM-DD)
  format: 'kdk' | 'tournament'; // 대회 진행 방식: KDK 순환 or 예선/본선 토너먼트
  courtCount: number;
  status: 'in_progress' | 'completed';
}

export interface CourtMatch {
  id: number;
  courtNumber: number;
  status: 'playing' | 'completed' | 'waiting';
  teamA: string[];
  teamB: string[];
  teamAWeight?: number;
  teamBWeight?: number;
  skillDiff?: number;
  scoreA: number;
  scoreB: number;
}

export interface RegisteredPlayer {
  id: string;
  username?: string; // 로그인 아이디 (이메일 형식 불필요)
  password?: string; // 로그인 비밀번호 (관리자 확인/수정 지원)
  name: string;
  email?: string;
  grade: string;
  gender: 'M' | 'F';
  role: 'member' | 'admin';
  phone?: string;
  birthDate?: string; // 출생년월일 (YYYY-MM-DD) -> 만 나이 자동 계산 및 실력 균등 배정용
  age?: number; // 만 나이 (생년월일 기준 자동 계산)
  experienceYears?: number; // 구력(년)
  isGuest?: boolean; // 미가입 회원 또는 임의 등록 선수 여부
  approvalStatus?: 'pending' | 'approved'; // 운영자 회원가입 승인 상태
  requestedAt?: string;
}

const GRADE_OPTIONS = ['금배', '은배', '동배', '국화', '개나리', '테린이', '고령자부'];

const DEFAULT_SAMPLE_BIRTHDATES: Record<string, string> = {
  p1: '1972-05-14',
  p2: '1981-01-18',
  p3: '1975-03-22',
  p4: '1983-06-25',
  p5: '1974-08-10',
  p6: '1984-11-05',
  p7: '1978-04-12',
  p8: '1987-09-19',
  p9: '1982-07-28',
  p10: '1979-07-10',
  p11: '1981-03-29',
  p12: '1973-03-20',
  p13: '1982-10-30',
  p14: '1983-09-25',
};

// ----------------------------------------------------
// 과거 대회 선수별 경기 성적 아카이브 & 누적 승률 집계 모델
// ----------------------------------------------------
export interface PastTournamentPlayerStat {
  matches: number;
  wins: number;
  losses: number;
  ptsFor: number;
  ptsAgainst: number;
  ptsDiff: number;
  rankOrNote: string;
}

export type PastTournamentStatsMap = Record<string, Record<string, PastTournamentPlayerStat>>;

export const DEFAULT_PAST_TOURNAMENT_STATS: PastTournamentStatsMap = {
  'tour-2': {
    '강동원': { matches: 4, wins: 4, losses: 0, ptsFor: 24, ptsAgainst: 14, ptsDiff: 10, rankOrNote: '우승 🥇' },
    '김철수': { matches: 4, wins: 3, losses: 1, ptsFor: 23, ptsAgainst: 17, ptsDiff: 6, rankOrNote: '준우승 🥈' },
    '박민수': { matches: 3, wins: 2, losses: 1, ptsFor: 18, ptsAgainst: 15, ptsDiff: 3, rankOrNote: '3위 🥉' },
    '송중기': { matches: 3, wins: 2, losses: 1, ptsFor: 17, ptsAgainst: 15, ptsDiff: 2, rankOrNote: '4강' },
    '이영희': { matches: 3, wins: 1, losses: 2, ptsFor: 14, ptsAgainst: 15, ptsDiff: -1, rankOrNote: '8강' },
    '한지민': { matches: 3, wins: 1, losses: 2, ptsFor: 13, ptsAgainst: 15, ptsDiff: -2, rankOrNote: '8강' },
    '최수진': { matches: 3, wins: 1, losses: 2, ptsFor: 14, ptsAgainst: 15, ptsDiff: -1, rankOrNote: '8강' },
    '김태희': { matches: 3, wins: 1, losses: 2, ptsFor: 13, ptsAgainst: 15, ptsDiff: -2, rankOrNote: '8강' },
    '공유':   { matches: 2, wins: 0, losses: 2, ptsFor: 7, ptsAgainst: 14, ptsDiff: -7, rankOrNote: '예선' },
    '정지훈': { matches: 2, wins: 0, losses: 2, ptsFor: 6, ptsAgainst: 14, ptsDiff: -8, rankOrNote: '예선' },
    '조인성': { matches: 2, wins: 0, losses: 2, ptsFor: 6, ptsAgainst: 14, ptsDiff: -8, rankOrNote: '예선' },
    '정우성': { matches: 2, wins: 0, losses: 2, ptsFor: 8, ptsAgainst: 14, ptsDiff: -6, rankOrNote: '예선' },
  },
  'tour-3': {
    '이영희': { matches: 4, wins: 4, losses: 0, ptsFor: 24, ptsAgainst: 15, ptsDiff: 9, rankOrNote: '우승 🥇' },
    '김철수': { matches: 4, wins: 3, losses: 1, ptsFor: 22, ptsAgainst: 15, ptsDiff: 7, rankOrNote: '준우승 🥈' },
    '강동원': { matches: 4, wins: 3, losses: 1, ptsFor: 21, ptsAgainst: 16, ptsDiff: 5, rankOrNote: '3위 🥉' },
    '공유':   { matches: 4, wins: 3, losses: 1, ptsFor: 20, ptsAgainst: 16, ptsDiff: 4, rankOrNote: '4위' },
    '송중기': { matches: 4, wins: 2, losses: 2, ptsFor: 19, ptsAgainst: 18, ptsDiff: 1, rankOrNote: '5위' },
    '박민수': { matches: 4, wins: 2, losses: 2, ptsFor: 18, ptsAgainst: 18, ptsDiff: 0, rankOrNote: '6위' },
    '한지민': { matches: 4, wins: 2, losses: 2, ptsFor: 17, ptsAgainst: 18, ptsDiff: -1, rankOrNote: '7위' },
    '최수진': { matches: 4, wins: 1, losses: 3, ptsFor: 14, ptsAgainst: 18, ptsDiff: -4, rankOrNote: '8위' },
    '정지훈': { matches: 4, wins: 1, losses: 3, ptsFor: 14, ptsAgainst: 18, ptsDiff: -4, rankOrNote: '8위' },
    '조인성': { matches: 4, wins: 1, losses: 3, ptsFor: 13, ptsAgainst: 18, ptsDiff: -5, rankOrNote: '9위' },
  },
};

export interface TournamentPlayerPerformance {
  tourId: string;
  tourName: string;
  date: string;
  format: 'kdk' | 'tournament';
  status: 'in_progress' | 'completed';
  matches: number;
  wins: number;
  losses: number;
  ptsDiff: number;
  winRate: number;
  winRateStr: string;
  rankOrNote: string;
  hasPlayed: boolean;
}

export interface CumulativePlayerStats {
  playerName: string;
  totalTournaments: number;
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  totalPtsDiff: number;
  winRate: number;
  winRateStr: string;
  historyBreakdown: TournamentPlayerPerformance[];
}

export function calculatePlayerCumulativeStats(
  targetName: string,
  history: TournamentRecord[],
  curTour: TournamentRecord,
  curCourts: CourtMatch[],
  curKdkStandings: Array<{ name: string; matches: number; wins: number; losses: number; ptsDiff: string | number; rank: number; totalPts?: number }>,
  pastArchive: PastTournamentStatsMap
): CumulativePlayerStats {
  let totalMatches = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let totalPtsDiff = 0;
  let playedTournamentsCount = 0;

  const historyBreakdown: TournamentPlayerPerformance[] = history.map((t) => {
    let m = 0;
    let w = 0;
    let l = 0;
    let diff = 0;
    let note = '';

    if (t.id === curTour.id) {
      const inKdk = curKdkStandings.find((s) => s.name === targetName);
      if (inKdk && inKdk.matches > 0) {
        m = inKdk.matches;
        w = inKdk.wins;
        l = inKdk.losses;
        diff = typeof inKdk.ptsDiff === 'string' ? parseInt(inKdk.ptsDiff, 10) || 0 : inKdk.ptsDiff || 0;
        note = `현재 ${inKdk.rank}위 (${t.status === 'completed' ? '종료' : '진행중'})`;
      } else {
        const myCourts = curCourts.filter(
          (c) =>
            (c.teamA || []).some((p) => p.includes(targetName)) ||
            (c.teamB || []).some((p) => p.includes(targetName))
        );
        const myCompletedCourts = myCourts.filter((c) => c.status === 'completed');
        if (myCompletedCourts.length > 0) {
          m = myCompletedCourts.length;
          myCompletedCourts.forEach((mc) => {
            const inA = (mc.teamA || []).some((p) => p.includes(targetName));
            const myScore = inA ? mc.scoreA : mc.scoreB;
            const oppScore = inA ? mc.scoreB : mc.scoreA;
            if (myScore > oppScore) w++;
            else if (myScore < oppScore) l++;
            diff += myScore - oppScore;
          });
          note = `${w}승 ${l}패 (${t.status === 'completed' ? '종료' : '진행중'})`;
        }
      }
    } else {
      const pastStat = pastArchive[t.id]?.[targetName];
      if (pastStat) {
        m = pastStat.matches;
        w = pastStat.wins;
        l = pastStat.losses;
        diff = pastStat.ptsDiff;
        note = pastStat.rankOrNote;
      }
    }

    const hasPlayed = m > 0;
    if (hasPlayed) {
      playedTournamentsCount++;
      totalMatches += m;
      totalWins += w;
      totalLosses += l;
      totalPtsDiff += diff;
    }

    const tourWinRate = m > 0 ? (w / m) * 100 : 0;
    return {
      tourId: t.id,
      tourName: t.name,
      date: t.date,
      format: t.format,
      status: t.status,
      matches: m,
      wins: w,
      losses: l,
      ptsDiff: diff,
      winRate: Math.round(tourWinRate * 10) / 10,
      winRateStr: tourWinRate.toFixed(1),
      rankOrNote: note || (hasPlayed ? `${w}승 ${l}패` : '미출전'),
      hasPlayed,
    };
  });

  const cumulativeWinRate = totalMatches > 0 ? (totalWins / totalMatches) * 100 : 0;

  return {
    playerName: targetName,
    totalTournaments: playedTournamentsCount,
    totalMatches,
    totalWins,
    totalLosses,
    totalPtsDiff,
    winRate: Math.round(cumulativeWinRate * 10) / 10,
    winRateStr: cumulativeWinRate.toFixed(1),
    historyBreakdown,
  };
}

export default function TennisApp() {
  // ----------------------------------------------------
  // 0. 로그인 / 회원가입 인증 상태
  // ----------------------------------------------------
  const [currentUser, setCurrentUser] = useState<RegisteredPlayer | null>(null);
  const [authHydrated, setAuthHydrated] = useState<boolean>(false);
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authMessage, setAuthMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [loginId, setLoginId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [signUpName, setSignUpName] = useState<string>('');
  const [signUpGender, setSignUpGender] = useState<'M' | 'F'>('M');
  const [signUpGrade, setSignUpGrade] = useState<string>('테린이');
  const [signUpBirthDate, setSignUpBirthDate] = useState<string>('');
  const [signUpPhone, setSignUpPhone] = useState<string>('');

  // 메인 네비게이션 탭: 'courts' | 'kdk' | 'tournament' | 'mypage' | 'admin'
  const [activeTab, setActiveTab] = useState<'courts' | 'kdk' | 'tournament' | 'mypage' | 'admin'>('courts');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const isAdmin = role === 'admin';

  // ----------------------------------------------------
  // 1. 등록된 공식 선수(가입회원 + 승인대기 + 미가입회원/임의선수) 명부 풀 (Supabase public.users 실시간 연동)
  // ----------------------------------------------------
  const [registeredPlayers, setRegisteredPlayers] = useState<RegisteredPlayer[]>([]);

  const pendingApprovalCount = registeredPlayers.filter(
    (p) => p.approvalStatus === 'pending'
  ).length;
  const approvedPlayers = registeredPlayers.filter((p) => p.approvalStatus !== 'pending');

  // ----------------------------------------------------
  // 2. 대회명 생성 및 진행날짜 자동 생성 / 기록 관리 상태
  // ----------------------------------------------------
  const [tournamentHistory, setTournamentHistory] = useState<TournamentRecord[]>([
    {
      id: 'tour-1',
      name: '2026 썬 테니스 11월 공식 월례 챔피언십',
      date: '2026-11-17', // 자동 기록된 날짜
      format: 'kdk',
      courtCount: 3,
      status: 'in_progress',
    },
    {
      id: 'tour-2',
      name: '2026 썬 테니스 추계 조별 풀리그 & 본선 토너먼트',
      date: '2026-10-25',
      format: 'tournament',
      courtCount: 4,
      status: 'completed',
    },
    {
      id: 'tour-3',
      name: '2026 제2회 썬 클럽 오픈 복식 KDK',
      date: '2026-09-18',
      format: 'kdk',
      courtCount: 3,
      status: 'completed',
    },
  ]);

  // 현재 진행 중인 대회
  const EMPTY_TOURNAMENT: TournamentRecord = {
    id: 'tour-empty',
    name: '개설된 대회가 없습니다',
    date: new Date().toISOString().split('T')[0],
    format: 'kdk',
    courtCount: 0,
    status: 'completed',
  };
  const [currentTournament, setCurrentTournament] = useState<TournamentRecord>(tournamentHistory[0]);
  const [adminTourFilter, setAdminTourFilter] = useState<'all' | 'in_progress' | 'completed'>('all');

  // 선택한 대회 방식(KDK vs 토너먼트)에 연계된 화면만 노출되도록 탭 자동 동기화
  useEffect(() => {
    if (activeTab === 'tournament' && currentTournament.format === 'kdk') {
      setActiveTab('kdk');
    } else if (activeTab === 'kdk' && currentTournament.format === 'tournament') {
      setActiveTab('tournament');
    }
  }, [currentTournament.format, activeTab]);
  const [openAdminTourSection, setOpenAdminTourSection] = useState<boolean>(false);
  const [expandedAdminTourIds, setExpandedAdminTourIds] = useState<Record<string, boolean>>({});

  const toggleExpandAdminTour = (tourId: string) => {
    setExpandedAdminTourIds((prev) => ({ ...prev, [tourId]: !prev[tourId] }));
  };

  const handleUpdateTournamentField = (
    tourId: string,
    field: 'name' | 'date' | 'format' | 'courtCount',
    value: any
  ) => {
    setTournamentHistory((prev) => {
      const next = prev.map((t) => (t.id === tourId ? { ...t, [field]: value } : t));
      persistTournamentHistory(next);
      return next;
    });
    if (currentTournament.id === tourId) {
      setCurrentTournament((prev) => ({ ...prev, [field]: value }));
    }
  };

  // 로컬 스토리지에서 저장된 대회 기록 불러오기
  useEffect(() => {
    try {
      const raw = localStorage.getItem('sun_tennis_tournaments');
      if (raw) {
        const parsed: TournamentRecord[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setTournamentHistory(parsed);
          setCurrentTournament(parsed[0] || EMPTY_TOURNAMENT);
        }
      }
    } catch {}
  }, []);

  const persistTournamentHistory = (nextList: TournamentRecord[]) => {
    try {
      localStorage.setItem('sun_tennis_tournaments', JSON.stringify(nextList));
    } catch {}
  };

  // 관리자 전용: 생성된 대회 또는 종료된 대회 개별 삭제
  const handleDeleteTournament = (tourId: string) => {
    if (!isAdmin) return;
    const target = tournamentHistory.find((t) => t.id === tourId);
    if (!target) return;
    const statusLabel = target.status === 'completed' ? '종료된 대회' : '진행 중인 대회';
    if (
      !window.confirm(
        `⚠️ [${target.name}] (${target.date} · ${statusLabel}) 기록을 삭제하시겠습니까?\n\n삭제된 대회는 목록에서 즉시 제거됩니다.`
      )
    ) {
      return;
    }

    const nextList = tournamentHistory.filter((t) => t.id !== tourId);
    setTournamentHistory(nextList);
    persistTournamentHistory(nextList);

    if (currentTournament.id === tourId) {
      setCurrentTournament(nextList[0] || EMPTY_TOURNAMENT);
    }
    alert(`🗑️ [${target.name}] 대회가 삭제되었습니다.`);
  };

  // ----------------------------------------------------
  // 과거 대회 선수별 성적 아카이브 (총 누적 승률 집계용)
  // ----------------------------------------------------
  const [pastTourStats, setPastTourStats] = useState<PastTournamentStatsMap>(() => {
    try {
      const raw = localStorage.getItem('sun_tennis_past_tour_stats');
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_PAST_TOURNAMENT_STATS, ...parsed };
      }
    } catch {}
    return DEFAULT_PAST_TOURNAMENT_STATS;
  });

  const persistPastTourStats = (stats: PastTournamentStatsMap) => {
    try {
      localStorage.setItem('sun_tennis_past_tour_stats', JSON.stringify(stats));
    } catch {}
  };

  // 관리자 전용: 대회 상태 전환 (진행중 <-> 종료됨)
  const handleToggleTournamentStatus = (tourId: string) => {
    if (!isAdmin) return;
    const target = tournamentHistory.find((t) => t.id === tourId);
    if (!target) return;
    const newStatus = target.status === 'completed' ? 'in_progress' : 'completed';
    const nextList: TournamentRecord[] = tournamentHistory.map((t) =>
      t.id === tourId ? { ...t, status: newStatus } : t
    );
    setTournamentHistory(nextList);
    persistTournamentHistory(nextList);

    // 대회가 종료 상태로 변경될 때, 해당 대회의 현재 선수별 경기 기록을 아카이브로 보존
    if (newStatus === 'completed') {
      setPastTourStats((prev) => {
        const updated = { ...prev };
        if (!updated[tourId]) updated[tourId] = {};
        registeredPlayers.forEach((p) => {
          const inKdk = kdkStandings.find((s) => s.name === p.name);
          if (inKdk && inKdk.matches > 0) {
            updated[tourId][p.name] = {
              matches: inKdk.matches,
              wins: inKdk.wins,
              losses: inKdk.losses,
              ptsFor: inKdk.totalPts || 0,
              ptsAgainst: (inKdk.totalPts || 0) - (typeof inKdk.ptsDiff === 'string' ? parseInt(inKdk.ptsDiff, 10) || 0 : inKdk.ptsDiff || 0),
              ptsDiff: typeof inKdk.ptsDiff === 'string' ? parseInt(inKdk.ptsDiff, 10) || 0 : inKdk.ptsDiff || 0,
              rankOrNote: `${inKdk.rank}위 🏆`,
            };
          }
        });
        persistPastTourStats(updated);
        return updated;
      });
    }

    if (currentTournament.id === tourId) {
      const updated = nextList.find((t) => t.id === tourId);
      if (updated) setCurrentTournament(updated);
    }
  };

  // 관리자 전용: 종료된 대회 전체 일괄 삭제
  const handleDeleteCompletedTournaments = () => {
    if (!isAdmin) return;
    const completedList = tournamentHistory.filter((t) => t.status === 'completed');
    if (completedList.length === 0) {
      alert('삭제할 종료된 대회가 없습니다.');
      return;
    }
    if (
      !window.confirm(
        `⚠️ 종료된 대회 총 ${completedList.length}건을 모두 일괄 삭제하시겠습니까?\n\n(${completedList.map((t) => t.name).join(', ')})`
      )
    ) {
      return;
    }

    const nextList = tournamentHistory.filter((t) => t.status !== 'completed');
    setTournamentHistory(nextList);
    persistTournamentHistory(nextList);

    if (currentTournament.status === 'completed') {
      setCurrentTournament(nextList[0] || EMPTY_TOURNAMENT);
    }
    alert(`🗑️ 종료된 대회 ${completedList.length}건이 일괄 삭제되었습니다.`);
  };

  // 새 대회 개설 모달 상태 (가입회원/미가입회원 선택 + 임의선수 등록 + 실력균형 자동/수동 배정)
  const [showNewTourModal, setShowNewTourModal] = useState<boolean>(false);
  const [newTourName, setNewTourName] = useState<string>('');
  const [newTourDate, setNewTourDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [newTourFormat, setNewTourFormat] = useState<'kdk' | 'tournament'>('kdk');
  const [newTourCourts, setNewTourCourts] = useState<number>(3);
  const [newTourAssignMode, setNewTourAssignMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [newTourSelectedPlayerIds, setNewTourSelectedPlayerIds] = useState<string[]>([
    'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12',
  ]);
  const [newTourCustomName, setNewTourCustomName] = useState<string>('');
  const [newTourCustomGrade, setNewTourCustomGrade] = useState<string>('은배');

  // 새 대회 개설 모달 내 참여선수 선택 토글
  const toggleNewTourPlayer = (id: string) => {
    setNewTourSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // 새 대회 개설 모달 내 미가입/임의 선수 이름 등록
  const handleAddNewTourCustomPlayer = () => {
    const raw = newTourCustomName.trim();
    if (!raw) {
      alert('등록할 미가입 회원 또는 임의 선수의 이름을 입력해 주세요.');
      return;
    }
    const names = raw
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    const addedPlayers: RegisteredPlayer[] = names.map((name, idx) => ({
      id: `guest_modal_${Date.now()}_${idx}`,
      name,
      grade: newTourCustomGrade,
      gender: 'M',
      role: 'member',
      isGuest: true,
    }));

    setRegisteredPlayers((prev) => [...prev, ...addedPlayers]);
    setNewTourSelectedPlayerIds((prev) => [...prev, ...addedPlayers.map((p) => p.id)]);
    setNewTourCustomName('');
  };

  // 새 대회 개설 처리 (참여선수 선택/임의선수 포함 + KDK 경기실력차 최소화 자동/수동 배정 연동)
  const handleCreateTournament = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTourName.trim()) {
      alert('대회명을 입력해 주세요.');
      return;
    }

    const selectedPool = registeredPlayers.filter((p) =>
      newTourSelectedPlayerIds.includes(p.id)
    );
    if (selectedPool.length < 4) {
      alert('경기를 진행하려면 최소 4명 이상의 참여선수(가입회원/미가입회원/임의선수)를 선택해 주세요.');
      return;
    }

    const autoDate = newTourDate.trim() || new Date().toISOString().split('T')[0];

    const newTour: TournamentRecord = {
      id: `tour-${Date.now()}`,
      name: newTourName.trim(),
      date: autoDate,
      format: newTourFormat,
      courtCount: newTourCourts,
      status: 'in_progress',
    };

    setTournamentHistory((prev) => {
      const next = [newTour, ...prev];
      persistTournamentHistory(next);
      return next;
    });
    setCurrentTournament(newTour);
    setParticipantsInput(selectedPool.map((p) => p.name).join(', '));

    if (newTourAssignMode === 'AUTO') {
      // KDK 경기 실력 차이 최소화(Skill Gap Zero) 밸런싱 엔진으로 자동 배정
      const schedule = generateKDKSchedule(selectedPool, newTourCourts, 3);
      const r1Matches = schedule[0]?.matches || [];

      const generatedCourts: CourtMatch[] = [];
      for (let i = 1; i <= newTourCourts; i++) {
        const m = r1Matches[(i - 1) % Math.max(1, r1Matches.length)];
        if (m) {
          generatedCourts.push({
            id: i,
            courtNumber: i,
            status: 'playing',
            teamA: [
              `${m.teamA[0].name} (${m.teamA[0].grade}${(m.teamA[0] as any).isGuest ? '·미가입' : ''})`,
              `${m.teamA[1].name} (${m.teamA[1].grade}${(m.teamA[1] as any).isGuest ? '·미가입' : ''})`,
            ],
            teamB: [
              `${m.teamB[0].name} (${m.teamB[0].grade}${(m.teamB[0] as any).isGuest ? '·미가입' : ''})`,
              `${m.teamB[1].name} (${m.teamB[1].grade}${(m.teamB[1] as any).isGuest ? '·미가입' : ''})`,
            ],
            teamAWeight: m.teamAWeight,
            teamBWeight: m.teamBWeight,
            skillDiff: m.skillDiff,
            scoreA: 0,
            scoreB: 0,
          });
        }
      }
      if (generatedCourts.length > 0) {
        setCourts(generatedCourts);
      }

      // KDK 라운드 및 개인 순위표 자동 업데이트
      const newKdkRounds = schedule.map((r) => ({
        round: r.round,
        name: `제 ${r.round} 라운드 (실력균형 자동배정)`,
        matches: r.matches.map((m, mIdx) => ({
          id: `kdk_${Date.now()}_r${r.round}_${mIdx}`,
          court: m.courtNumber,
          teamA: [`${m.teamA[0].name} (${m.teamA[0].grade})`, `${m.teamA[1].name} (${m.teamA[1].grade})`],
          teamB: [`${m.teamB[0].name} (${m.teamB[0].grade})`, `${m.teamB[1].name} (${m.teamB[1].grade})`],
          teamAWeight: m.teamAWeight,
          teamBWeight: m.teamBWeight,
          skillDiff: m.skillDiff,
          scoreA: 0,
          scoreB: 0,
          completed: false,
        })),
      }));
      setKdkRounds(newKdkRounds);
      setKdkStandings(
        selectedPool.map((p, idx) => ({
          rank: idx + 1,
          name: p.name,
          grade: p.grade,
          matches: 0,
          wins: 0,
          losses: 0,
          ptsDiff: '0',
          totalPts: 0,
        }))
      );

      setShowNewTourModal(false);
      setNewTourName('');
      setActiveTab(newTourFormat === 'kdk' ? 'kdk' : 'courts');

      alert(
        `🎉 [${newTour.name}] 대회가 성공적으로 개설되었습니다!\n` +
        `👥 참여 선수: 총 ${selectedPool.length}명 (가입회원 + 미가입/임의선수)\n` +
        `⚖️ 배정 방식: 경기 실력 차이 최소화(Skill Gap 0) 자동 배정\n` +
        `🏟️ 총 ${newTourCourts}개 코트 및 대진표에 즉시 자동 연동되었습니다!`
      );
    } else {
      // 수동 배정 선택 시
      const generated: CourtMatch[] = [];
      for (let i = 1; i <= newTourCourts; i++) {
        generated.push({
          id: i,
          courtNumber: i,
          status: 'waiting',
          teamA: ['선수 수동 배정 필요', '선수 수동 배정 필요'],
          teamB: ['선수 수동 배정 필요', '선수 수동 배정 필요'],
          scoreA: 0,
          scoreB: 0,
        });
      }
      setCourts(generated);
      setShowNewTourModal(false);
      setNewTourName('');
      setActiveTab('courts');
      if (generated[0]) {
        openCourtPlayerEditModal(generated[0]);
      }
      alert(
        `🖐️ [${newTour.name}] 대회가 수동 배정 모드로 개설되었습니다!\n코트별 출전 선수를 직접 선택하여 배치해 주세요.`
      );
    }
  };

  // ----------------------------------------------------
  // 3. 관리자 코트 동적 생성 및 넘버 관리 상태
  // ----------------------------------------------------
  const [courts, setCourts] = useState<CourtMatch[]>([
    {
      id: 1,
      courtNumber: 1,
      status: 'playing',
      teamA: ['김철수 (금배)', '강동원 (금배)'],
      teamB: ['박민수 (은배)', '정지훈 (동배)'],
      scoreA: 5,
      scoreB: 3,
    },
    {
      id: 2,
      courtNumber: 2,
      status: 'playing',
      teamA: ['이영희 (국화)', '한지민 (은배)'],
      teamB: ['최수진 (개나리)', '김태희 (테린이)'],
      scoreA: 2,
      scoreB: 4,
    },
    {
      id: 3,
      courtNumber: 3,
      status: 'waiting',
      teamA: ['송중기 (동배)', '조인성 (은배)'],
      teamB: ['공유 (금배)', '정우성 (은배)'],
      scoreA: 0,
      scoreB: 0,
    },
  ]);

  // 관리자가 코트 넘버를 코트 수에 맞게 계속 생성하는 함수 (+)
  const handleAddCourt = () => {
    setCourts((prev) => {
      const nextNumber = prev.length > 0 ? Math.max(...prev.map((c) => c.courtNumber)) + 1 : 1;
      const newCourt: CourtMatch = {
        id: Date.now(),
        courtNumber: nextNumber,
        status: 'waiting',
        teamA: ['선수 배정 필요', '선수 배정 필요'],
        teamB: ['선수 배정 필요', '선수 배정 필요'],
        scoreA: 0,
        scoreB: 0,
      };
      return [...prev, newCourt];
    });
  };

  // 관리자가 코트 수를 1개 줄이는 함수 (-)
  const handleRemoveCourt = () => {
    if (courts.length <= 1) {
      alert('최소 1개 이상의 코트가 유지되어야 합니다.');
      return;
    }
    setCourts((prev) => prev.slice(0, prev.length - 1));
  };

  // 특정 코트 개별 삭제 함수
  const handleDeleteCourt = (courtId: number) => {
    if (courts.length <= 1) {
      alert('최소 1개 이상의 코트가 유지되어야 합니다.');
      return;
    }
    if (confirm('이 코트를 삭제하시겠습니까?')) {
      setCourts((prev) => prev.filter((c) => c.id !== courtId));
    }
  };

  // ----------------------------------------------------
  // 4. 등록된 선수 자동 / 수동 배정 및 수정 로직
  // ----------------------------------------------------
  // 4-1. 등록 선수(가입회원 + 미가입회원/임의선수) 자동 배정 (경기 실력 차이 최소화 스마트 밸런싱)
  const handleAutoAssignPlayers = () => {
    const selectedPool = registeredPlayers.filter((p) =>
      newTourSelectedPlayerIds.includes(p.id)
    );
    const pool = selectedPool.length >= 4 ? selectedPool : registeredPlayers;
    const schedule = generateKDKSchedule(pool, courts.length, 3);
    const r1Matches = schedule[0]?.matches || [];

    setCourts((prev) =>
      prev.map((court, idx) => {
        const m = r1Matches[idx % Math.max(1, r1Matches.length)];
        if (!m) return court;
        return {
          ...court,
          status: 'playing',
          teamA: [
            `${m.teamA[0].name} (${m.teamA[0].grade}${(m.teamA[0] as any).isGuest ? '·미가입' : ''})`,
            `${m.teamA[1].name} (${m.teamA[1].grade}${(m.teamA[1] as any).isGuest ? '·미가입' : ''})`,
          ],
          teamB: [
            `${m.teamB[0].name} (${m.teamB[0].grade}${(m.teamB[0] as any).isGuest ? '·미가입' : ''})`,
            `${m.teamB[1].name} (${m.teamB[1].grade}${(m.teamB[1] as any).isGuest ? '·미가입' : ''})`,
          ],
          teamAWeight: m.teamAWeight,
          teamBWeight: m.teamBWeight,
          skillDiff: m.skillDiff,
        };
      })
    );

    const newKdkRounds = schedule.map((r) => ({
      round: r.round,
      name: `제 ${r.round} 라운드 (실력균형 자동배정)`,
      matches: r.matches.map((m, mIdx) => ({
        id: `kdk_auto_${Date.now()}_r${r.round}_${mIdx}`,
        court: m.courtNumber,
        teamA: [`${m.teamA[0].name} (${m.teamA[0].grade})`, `${m.teamA[1].name} (${m.teamA[1].grade})`],
        teamB: [`${m.teamB[0].name} (${m.teamB[0].grade})`, `${m.teamB[1].name} (${m.teamB[1].grade})`],
        scoreA: 0,
        scoreB: 0,
        completed: false,
      })),
    }));
    setKdkRounds(newKdkRounds);

    alert(
      `⚖️ 참여 선수 ${pool.length}명 중에서 총 ${courts.length}개 코트에 두 팀 간 경기 실력 차이가 없도록 균형 배정되었습니다!`
    );
  };

  // 4-2. 수동 선수 배정 및 수정 모달 상태
  const [courtEditTarget, setCourtEditTarget] = useState<CourtMatch | null>(null);
  const [manualPlayerA1, setManualPlayerA1] = useState<string>('');
  const [manualPlayerA2, setManualPlayerA2] = useState<string>('');
  const [manualPlayerB1, setManualPlayerB1] = useState<string>('');
  const [manualPlayerB2, setManualPlayerB2] = useState<string>('');

  const openCourtPlayerEditModal = (court: CourtMatch) => {
    setCourtEditTarget(court);
    setManualPlayerA1(court.teamA[0] || '');
    setManualPlayerA2(court.teamA[1] || '');
    setManualPlayerB1(court.teamB[0] || '');
    setManualPlayerB2(court.teamB[1] || '');
  };

  const saveCourtPlayerAssignment = () => {
    if (!courtEditTarget) return;

    setCourts((prev) =>
      prev.map((c) =>
        c.id === courtEditTarget.id
          ? {
              ...c,
              teamA: [manualPlayerA1.trim() || '선수 미지정', manualPlayerA2.trim() || '선수 미지정'],
              teamB: [manualPlayerB1.trim() || '선수 미지정', manualPlayerB2.trim() || '선수 미지정'],
            }
          : c
      )
    );

    setCourtEditTarget(null);
    alert(`${courtEditTarget.courtNumber}번 코트의 선수 배정 및 수정이 완료되었습니다!`);
  };

  // ----------------------------------------------------
  // 5. 토너먼트 서브탭 및 KDK 상태
  // ----------------------------------------------------
  const [tourPhase, setTourPhase] = useState<'qualifying' | 'main'>('qualifying');
  const [participantsInput, setParticipantsInput] = useState<string>(
    '김철수, 강동원, 박민수, 정지훈, 이영희, 한지민, 최수진, 송중기'
  );

  // KDK 라운드 데이터
  const [kdkRounds, setKdkRounds] = useState([
    {
      round: 1,
      name: '제 1 라운드 (오프닝 로테이션)',
      matches: [
        { id: 'k1-1', court: 1, teamA: ['김철수 (금배)', '강동원 (금배)'], teamB: ['박민수 (은배)', '정지훈 (동배)'], scoreA: 6, scoreB: 3, completed: true },
        { id: 'k1-2', court: 2, teamA: ['이영희 (국화)', '한지민 (은배)'], teamB: ['최수진 (개나리)', '송중기 (동배)'], scoreA: 4, scoreB: 6, completed: true },
      ],
    },
    {
      round: 2,
      name: '제 2 라운드 (크로스 파트너 순환)',
      matches: [
        { id: 'k2-1', court: 1, teamA: ['김철수 (금배)', '정지훈 (동배)'], teamB: ['강동원 (금배)', '박민수 (은배)'], scoreA: 5, scoreB: 6, completed: true },
        { id: 'k2-2', court: 2, teamA: ['이영희 (국화)', '최수진 (개나리)'], teamB: ['한지민 (은배)', '송중기 (동배)'], scoreA: 6, scoreB: 2, completed: true },
      ],
    },
    {
      round: 3,
      name: '제 3 라운드 (승부 라운드)',
      matches: [
        { id: 'k3-1', court: 1, teamA: ['김철수 (금배)', '박민수 (은배)'], teamB: ['강동원 (금배)', '정지훈 (동배)'], scoreA: 6, scoreB: 4, completed: false },
        { id: 'k3-2', court: 2, teamA: ['이영희 (국화)', '송중기 (동배)'], teamB: ['한지민 (은배)', '최수진 (개나리)'], scoreA: 3, scoreB: 5, completed: false },
      ],
    },
  ]);

  // KDK 실시간 개인 순위표
  const [kdkStandings, setKdkStandings] = useState([
    { rank: 1, name: '강동원', grade: '금배', matches: 2, wins: 2, losses: 0, ptsDiff: '+4', totalPts: 12 },
    { rank: 2, name: '김철수', grade: '금배', matches: 2, wins: 1, losses: 1, ptsDiff: '+2', totalPts: 11 },
    { rank: 3, name: '이영희', grade: '국화', matches: 2, wins: 1, losses: 1, ptsDiff: '+2', totalPts: 10 },
    { rank: 4, name: '송중기', grade: '동배', matches: 2, wins: 1, losses: 1, ptsDiff: '-2', totalPts: 8 },
    { rank: 5, name: '박민수', grade: '은배', matches: 2, wins: 1, losses: 1, ptsDiff: '-2', totalPts: 9 },
    { rank: 6, name: '정지훈', grade: '동배', matches: 2, wins: 0, losses: 2, ptsDiff: '-4', totalPts: 8 },
  ]);

  // 토너먼트 예선 조별리그
  const [groupAStandings, setGroupAStandings] = useState([
    { rank: 1, team: '김철수 / 강동원', played: 2, wins: 2, losses: 0, diff: '+7', pts: 6, qualified: true },
    { rank: 2, team: '이영희 / 한지민', played: 2, wins: 1, losses: 1, diff: '+1', pts: 3, qualified: true },
    { rank: 3, team: '정지훈 / 조인성', played: 2, wins: 0, losses: 2, diff: '-8', pts: 0, qualified: false },
  ]);

  const [groupBStandings, setGroupBStandings] = useState([
    { rank: 1, team: '박민수 / 송중기', played: 2, wins: 2, losses: 0, diff: '+6', pts: 6, qualified: true },
    { rank: 2, team: '최수진 / 김태희', played: 2, wins: 1, losses: 1, diff: '+2', pts: 3, qualified: true },
    { rank: 3, team: '공유 / 정우성', played: 2, wins: 0, losses: 2, diff: '-8', pts: 0, qualified: false },
  ]);

  // 본선 4강 및 결승전
  const [semiFinal1, setSemiFinal1] = useState({
    name: '4강 1경기',
    teamA: '김철수 / 강동원 (A1)',
    teamB: '최수진 / 김태희 (B2)',
    scoreA: 6,
    scoreB: 3,
    winner: '김철수 / 강동원',
  });

  const [semiFinal2, setSemiFinal2] = useState({
    name: '4강 2경기',
    teamA: '박민수 / 송중기 (B1)',
    teamB: '이영희 / 한지민 (A2)',
    scoreA: 4,
    scoreB: 6,
    winner: '이영희 / 한지민',
  });

  const [finalMatch, setFinalMatch] = useState({
    teamA: '김철수 / 강동원',
    teamB: '이영희 / 한지민',
    scoreA: 6,
    scoreB: 5,
    winner: '',
  });

  const [champion, setChampion] = useState<string>('');

  // 스코어 수정 모달
  const [selectedCourt, setSelectedCourt] = useState<CourtMatch | null>(null);
  const [inputScoreA, setInputScoreA] = useState<number>(0);
  const [inputScoreB, setInputScoreB] = useState<number>(0);
  const [inputStatus, setInputStatus] = useState<string>('playing');

  const openScoreModal = (court: CourtMatch) => {
    setSelectedCourt(court);
    setInputScoreA(court.scoreA);
    setInputScoreB(court.scoreB);
    setInputStatus(court.status);
  };

  const saveCourtScore = () => {
    if (!selectedCourt) return;
    setCourts((prev) =>
      prev.map((c) =>
        c.id === selectedCourt.id
          ? {
              ...c,
              scoreA: Number(inputScoreA),
              scoreB: Number(inputScoreB),
              status: inputStatus as any,
            }
          : c
      )
    );
    setSelectedCourt(null);
  };

  // ----------------------------------------------------
  // 회원 전체 누적 승률 순위표 및 현재 로그인 회원의 누적 성적 계산
  // ----------------------------------------------------
  const clubCumulativeLeaderboard = useMemo(() => {
    const list = registeredPlayers.map((p) => {
      const stats = calculatePlayerCumulativeStats(
        p.name,
        tournamentHistory,
        currentTournament,
        courts,
        kdkStandings,
        pastTourStats
      );
      return {
        id: p.id,
        name: p.name,
        grade: p.grade,
        role: p.role,
        ...stats,
      };
    });

    list.sort((a, b) => {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
      if (b.totalPtsDiff !== a.totalPtsDiff) return b.totalPtsDiff - a.totalPtsDiff;
      return b.totalMatches - a.totalMatches;
    });

    return list.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }, [registeredPlayers, tournamentHistory, currentTournament, courts, kdkStandings, pastTourStats]);

  const currentUserCumulative = useMemo(() => {
    if (!currentUser) return null;
    return calculatePlayerCumulativeStats(
      currentUser.name,
      tournamentHistory,
      currentTournament,
      courts,
      kdkStandings,
      pastTourStats
    );
  }, [currentUser, tournamentHistory, currentTournament, courts, kdkStandings, pastTourStats]);

  const currentUserRank = useMemo(() => {
    if (!currentUser) return 1;
    const found = clubCumulativeLeaderboard.find((p) => p.name === currentUser.name);
    return found ? found.rank : 1;
  }, [currentUser, clubCumulativeLeaderboard]);

  // Supabase public.users 테이블에서 전체 회원(승인 대기 pending + 정회원 approved) 실시간 조회
  const fetchUsersFromSupabase = useCallback(async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const mapped: RegisteredPlayer[] = data
        .map((row) => {
          const norm = mapSupabaseUserRow(row);
          if (!norm) return null;
          const resolvedBirthDate = norm.birthDate || DEFAULT_SAMPLE_BIRTHDATES[norm.id];
          const resolvedAge =
            calculateKoreanManAge(resolvedBirthDate) ?? norm.age;
          return {
            ...norm,
            birthDate: resolvedBirthDate,
            age: resolvedAge,
          } as RegisteredPlayer;
        })
        .filter((u): u is RegisteredPlayer => Boolean(u))
        .sort((a, b) => {
          if (a.approvalStatus === 'pending' && b.approvalStatus !== 'pending') return -1;
          if (a.approvalStatus !== 'pending' && b.approvalStatus === 'pending') return 1;
          return 0;
        });

      setRegisteredPlayers(mapped);
    }
  }, []);

  // 초기 Supabase Auth 세션 및 public.users 회원 목록 실시간 연동 (로컬 스토리지 회원 관리 제거)
  useEffect(() => {
    let isMounted = true;

    const hydrateAuthAndUsers = async () => {
      try {
        await fetchUsersFromSupabase();

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user && isMounted) {
          const { data: userRow } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          const norm = mapSupabaseUserRow(userRow);
          if (norm && norm.approvalStatus === 'pending') {
            await supabase.auth.signOut();
            setCurrentUser(null);
            setRole('member');
          } else if (norm) {
            const resolvedRole: 'member' | 'admin' =
              norm.role === 'admin' ? 'admin' : 'member';
            const resolvedBirthDate =
              norm.birthDate || DEFAULT_SAMPLE_BIRTHDATES[norm.id];
            const resolvedAge =
              calculateKoreanManAge(resolvedBirthDate) ?? norm.age;
            setCurrentUser({
              ...(norm as RegisteredPlayer),
              role: resolvedRole,
              birthDate: resolvedBirthDate,
              age: resolvedAge,
            });
            setRole(resolvedRole);

            const savedSessionRaw = localStorage.getItem('sun_tennis_session_state');
            if (savedSessionRaw) {
              const parsedSession = JSON.parse(savedSessionRaw);
              const validTabs = ['courts', 'kdk', 'tournament', 'mypage', 'admin'];
              if (parsedSession?.activeTab && validTabs.includes(parsedSession.activeTab)) {
                const safeTab =
                  parsedSession.activeTab === 'admin' && resolvedRole !== 'admin'
                    ? 'courts'
                    : parsedSession.activeTab;
                setActiveTab(safeTab);
              } else {
                setActiveTab(resolvedRole === 'admin' ? 'admin' : 'courts');
              }
              if (
                parsedSession?.tourPhase === 'qualifying' ||
                parsedSession?.tourPhase === 'main'
              ) {
                setTourPhase(parsedSession.tourPhase);
              }
            } else {
              setActiveTab(resolvedRole === 'admin' ? 'admin' : 'courts');
            }
          }
        }
      } catch {
      } finally {
        if (isMounted) setAuthHydrated(true);
      }
    };

    hydrateAuthAndUsers();

    // Supabase Auth 세션 변경 실시간 구독
    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        if (isMounted) {
          setCurrentUser(null);
          setRole('member');
        }
        return;
      }
      const { data: userRow } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      const norm = mapSupabaseUserRow(userRow);
      if (norm && norm.approvalStatus !== 'pending' && isMounted) {
        const resolvedBreakBirth =
          norm.birthDate || DEFAULT_SAMPLE_BIRTHDATES[norm.id];
        setCurrentUser({
          ...(norm as RegisteredPlayer),
          birthDate: resolvedBreakBirth,
          age: calculateKoreanManAge(resolvedBreakBirth) ?? norm.age,
        });
      }
    });

    // Supabase public.users 테이블 실시간(Realtime) 변경 구독 (다른 기기에서 가입/승인/수정 시 즉시 반영)
    const usersChannel = supabase
      .channel('public:users:tennis-app')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        async () => {
          await fetchUsersFromSupabase();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      authSub?.unsubscribe();
      supabase.removeChannel(usersChannel);
    };
  }, [fetchUsersFromSupabase]);

  // 로그인 상태에서 현재 탭/토너먼트 단계 자동 저장 (새로고침 시 동일 화면 유지)
  useEffect(() => {
    if (!authHydrated || !currentUser) return;
    try {
      localStorage.setItem(
        'sun_tennis_session_state',
        JSON.stringify({ activeTab, tourPhase })
      );
    } catch {}
  }, [authHydrated, currentUser, activeTab, tourPhase]);

  // 로그인 & 회원가입 제출 핸들러 (Supabase Auth + public.users 실시간 연동 · 회원가입은 pending 승인 대기 후 접속)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMessage(null);

    const trimmedId = loginId.trim();

    if (isSignUp) {
      if (!trimmedId || trimmedId.length < 2) {
        setAuthMessage({ type: 'error', text: '사용할 아이디를 2자 이상 입력해 주세요. (이메일 형식 불필요)' });
        return;
      }
      if (!signUpName.trim()) {
        setAuthMessage({ type: 'error', text: '이름(실명)을 입력해 주세요.' });
        return;
      }
      if (password.length < 6) {
        setAuthMessage({ type: 'error', text: '비밀번호는 최소 6자 이상 입력해 주세요.' });
        return;
      }
      if (password !== confirmPassword) {
        setAuthMessage({ type: 'error', text: '비밀번호와 비밀번호 확인이 일치하지 않습니다.' });
        return;
      }

      const signUpManAge = calculateKoreanManAge(signUpBirthDate);
      if (!signUpBirthDate || signUpManAge === null) {
        setAuthMessage({
          type: 'error',
          text: '생년월일(출생년도, 월, 일)을 모두 선택해 주세요. 만 나이가 자동 계산되어 실력 균등 배정에 반영됩니다.',
        });
        return;
      }

      const authEmail = toAuthEmail(trimmedId);

      setAuthLoading(true);
      try {
        // 1. Supabase public.users 테이블에서 중복 아이디/이메일 실시간 검사
        const { data: existingRows } = await supabase
          .from('users')
          .select('id, username, email')
          .or(`username.ilike.${trimmedId},email.ilike.${authEmail}`);

        if (Array.isArray(existingRows) && existingRows.length > 0) {
          setAuthMessage({
            type: 'error',
            text: `이미 사용 중이거나 승인 대기 중인 아이디(${trimmedId})입니다. 다른 아이디를 입력해 주세요.`,
          });
          return;
        }

        // 2. Supabase Auth 회원가입 요청 (supabase.auth.signUp)
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: authEmail,
          password,
          options: {
            data: {
              username: trimmedId,
              name: signUpName.trim(),
              gender: signUpGender,
              grade: signUpGrade,
              phone: signUpPhone.trim(),
              birth_date: signUpBirthDate,
              age: signUpManAge,
              role: 'member',
              approval_status: 'pending',
            },
          },
        });

        if (signUpError) {
          setAuthMessage({
            type: 'error',
            text: `회원가입 실패: ${signUpError.message}`,
          });
          return;
        }

        const createdUserId = signUpData?.user?.id;
        const nowIso = new Date().toISOString();

        // 3. public.users 테이블에 승인 대기(status: 'pending' / role: 'member') 상태로 실시간 저장 (localStorage 저장 로직 배제)
        const userInsertPayload: Record<string, any> = {
          ...(createdUserId ? { id: createdUserId } : {}),
          username: trimmedId,
          email: authEmail,
          name: signUpName.trim(),
          grade: signUpGrade,
          gender: signUpGender,
          role: 'member',
          phone: signUpPhone.trim() || null,
          birth_date: signUpBirthDate || null,
          age: signUpManAge ?? null,
          is_guest: false,
          approval_status: 'pending',
          status: 'pending',
          requested_at: nowIso,
        };

        let { error: upsertError } = await supabase.from('users').upsert(userInsertPayload);
        if (upsertError) {
          if (
            upsertError.message.includes('approval_status') ||
            upsertError.message.includes('schema cache')
          ) {
            const fallback = { ...userInsertPayload };
            delete fallback.approval_status;
            const retry = await supabase.from('users').upsert(fallback);
            upsertError = retry.error;
          } else if (
            upsertError.message.includes('status') ||
            upsertError.message.includes('schema cache')
          ) {
            const fallback = { ...userInsertPayload };
            delete fallback.status;
            const retry = await supabase.from('users').upsert(fallback);
            upsertError = retry.error;
          }
        }

        if (upsertError) {
          setAuthMessage({
            type: 'error',
            text: `회원 프로필 저장 실패: ${upsertError.message}`,
          });
          return;
        }

        // 승인 대기(pending) 상태이므로 자동 로그인 세션을 즉시 해제
        if (signUpData?.session) {
          await supabase.auth.signOut();
        }

        await fetchUsersFromSupabase();

        // 승인 대기 안내 표시 후 로그인 화면으로 전환
        const appliedName = signUpName.trim();
        const appliedGrade = signUpGrade;
        setIsSignUp(false);
        setPassword('');
        setConfirmPassword('');
        setSignUpName('');
        setSignUpBirthDate('');
        setSignUpPhone('');
        setAuthMessage({
          type: 'success',
          text: `⏳ [${appliedName} · 만 ${signUpManAge}세] 님의 회원가입 신청(ID: ${trimmedId})이 Supabase DB에 접수되었습니다! 운영자(관리자)가 확인 후 승인하면 어느 기기에서나 로그인할 수 있습니다.`,
        });
        alert(
          `✅ 회원가입 신청이 완료되었습니다!\n\n신청 아이디: ${trimmedId}\n이름/등급: ${appliedName} (${appliedGrade} · 만 ${signUpManAge}세)\n\n⏳ 운영자(관리자)의 확인 및 승인 후 모든 기기에서 로그인하여 접속하실 수 있습니다.`
        );
      } finally {
        setAuthLoading(false);
      }
    } else {
      if (!trimmedId || !password) {
        setAuthMessage({ type: 'error', text: '아이디와 비밀번호를 입력해 주세요.' });
        return;
      }

      setAuthLoading(true);
      try {
        // 1. public.users 테이블에서 username 또는 email로 회원 이메일 조회
        const { data: lookupRow } = await supabase
          .from('users')
          .select('*')
          .or(`username.ilike.${trimmedId},email.ilike.${trimmedId}`)
          .maybeSingle();

        const resolvedEmail = lookupRow?.email || toAuthEmail(trimmedId);

        // 2. Supabase Auth 로그인 검증 (supabase.auth.signInWithPassword)
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: resolvedEmail,
            password,
          });

        if (signInError || !signInData?.user) {
          setAuthMessage({
            type: 'error',
            text: '아이디 또는 비밀번호가 일치하지 않거나 등록되지 않은 계정입니다.',
          });
          return;
        }

        // 3. public.users 테이블에서 최신 회원 프로필 및 승인 상태(pending / approved) 확인
        const { data: userRow } = await supabase
          .from('users')
          .select('*')
          .eq('id', signInData.user.id)
          .maybeSingle();

        const profile = mapSupabaseUserRow(userRow || lookupRow || {
          id: signInData.user.id,
          email: signInData.user.email,
          ...signInData.user.user_metadata,
        });

        // 4. 운영자 승인 대기(pending / 미승인) 중인 계정 접속 차단 및 로그아웃
        if (profile && profile.approvalStatus === 'pending') {
          await supabase.auth.signOut();
          setAuthMessage({
            type: 'error',
            text: `⏳ [${profile.name}] 님의 계정은 현재 운영자(관리자) 승인 대기 중입니다. 승인 완료 후 로그인하여 접속할 수 있습니다.`,
          });
          return;
        }

        // 5. 승인 완료 회원: role('admin' 또는 'member')에 맞는 화면으로 정상 연결
        const resolvedRole: 'member' | 'admin' =
          profile?.role === 'admin' ? 'admin' : 'member';
        const loggedUser: RegisteredPlayer = {
          ...(profile as RegisteredPlayer),
          role: resolvedRole,
          approvalStatus: 'approved',
        };

        setCurrentUser(loggedUser);
        setRole(resolvedRole);
        setActiveTab(resolvedRole === 'admin' ? 'admin' : 'courts');
      } finally {
        setAuthLoading(false);
      }
    }
  };

  // 관리자 전용 로그인 모달 상태 (관리자 아이디·비번 미입력/불일치 시 입장 불가)
  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);
  const [adminLoginId, setAdminLoginId] = useState<string>('');
  const [adminLoginPw, setAdminLoginPw] = useState<string>('');
  const [adminLoginError, setAdminLoginError] = useState<string>('');

  // 마이페이지 내 정보 수정 상태 (관리자/일반회원 공통 · 기본 비활성화, 수정 버튼 클릭 시 활성화)
  const [isEditingMyProfile, setIsEditingMyProfile] = useState<boolean>(false);
  // 마이페이지 '대회별 참가 성적 & 승률 반영 히스토리' 아코디언 상태 (기본값: 닫힘)
  const [showMyHistoryAccordion, setShowMyHistoryAccordion] = useState<boolean>(false);
  const [editMyUsername, setEditMyUsername] = useState<string>('');
  const [editMyName, setEditMyName] = useState<string>('');
  const [editMyGender, setEditMyGender] = useState<'M' | 'F'>('M');
  const [editMyGrade, setEditMyGrade] = useState<string>('은배');
  const [editMyBirthDate, setEditMyBirthDate] = useState<string>('');
  const [editMyPhone, setEditMyPhone] = useState<string>('');
  const [editMyPassword, setEditMyPassword] = useState<string>('');
  const [editMyConfirmPassword, setEditMyConfirmPassword] = useState<string>('');
  const [showMyPassword, setShowMyPassword] = useState<boolean>(false);
  const [myInfoSavedMsg, setMyInfoSavedMsg] = useState<string>('');

  const resetMyProfileFormFromUser = (user: RegisteredPlayer) => {
    setEditMyUsername(user.username || user.email || '');
    setEditMyName(user.name || '');
    setEditMyGender(user.gender === 'F' ? 'F' : 'M');
    setEditMyGrade(user.grade || '은배');
    setEditMyBirthDate(user.birthDate || '');
    setEditMyPhone(user.phone || '');
    setEditMyPassword('');
    setEditMyConfirmPassword('');
    setShowMyPassword(false);
  };

  useEffect(() => {
    if (currentUser) {
      resetMyProfileFormFromUser(currentUser);
      setIsEditingMyProfile(false);
      setShowMyHistoryAccordion(false);
      setMyInfoSavedMsg('');
    }
  }, [currentUser?.id]);

  // 본인 정보(아이디 · 비밀번호 · 이름 · 성별 · 등급 · 연락처) 수정 저장 핸들러 (Supabase Auth + public.users 실시간 반영)
  const handleSaveMyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const trimmedId = editMyUsername.trim();
    const trimmedName = editMyName.trim();
    const trimmedPw = editMyPassword.trim();
    const trimmedConfirmPw = editMyConfirmPassword.trim();

    if (trimmedId.length < 2) {
      alert('아이디(ID)는 최소 2자 이상 입력해 주세요. (이메일 형식 불필요)');
      return;
    }

    const isDuplicateId = registeredPlayers.some(
      (p) =>
        p.id !== currentUser.id &&
        ((p.username && p.username.toLowerCase() === trimmedId.toLowerCase()) ||
          (p.email && p.email.toLowerCase() === trimmedId.toLowerCase()))
    );
    if (isDuplicateId) {
      alert(`이미 다른 회원이 사용 중인 아이디(${trimmedId})입니다. 다른 아이디를 입력해 주세요.`);
      return;
    }

    if (!trimmedName) {
      alert('이름을 입력해 주세요.');
      return;
    }

    if (trimmedPw.length > 0) {
      if (trimmedPw.length < 6) {
        alert('새 비밀번호는 최소 6자 이상 입력해 주세요.');
        return;
      }
      if (trimmedPw !== trimmedConfirmPw) {
        alert('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
        return;
      }
    }

    const computedManAge = calculateKoreanManAge(editMyBirthDate);
    const resolvedEmail = toAuthEmail(trimmedId);

    // 1. Supabase public.users 테이블 프로필 업데이트
    const { data: updatedRow, error: updateError } = await supabase
      .from('users')
      .update({
        username: trimmedId,
        email: resolvedEmail,
        name: trimmedName,
        gender: editMyGender,
        grade: editMyGrade,
        birth_date: editMyBirthDate || null,
        age: computedManAge !== null ? computedManAge : currentUser.age ?? null,
        phone: editMyPhone.trim() || null,
      })
      .eq('id', currentUser.id)
      .select()
      .single();

    if (updateError) {
      alert(`내 정보 저장 중 오류가 발생했습니다: ${updateError.message}`);
      return;
    }

    // 2. 비밀번호 변경 요청 시 Supabase Auth 비밀번호 업데이트
    if (trimmedPw.length > 0) {
      const { error: pwErr } = await supabase.auth.updateUser({
        password: trimmedPw,
      });
      if (pwErr) {
        alert(`비밀번호 변경 중 오류가 발생했습니다: ${pwErr.message}`);
        return;
      }
    }

    const normalized = mapSupabaseUserRow(updatedRow);
    const updatedUser: RegisteredPlayer = {
      ...currentUser,
      ...(normalized as RegisteredPlayer),
      username: trimmedId,
      email: resolvedEmail,
      name: trimmedName,
      gender: editMyGender,
      grade: editMyGrade,
      birthDate: editMyBirthDate || undefined,
      age: computedManAge !== null ? computedManAge : currentUser.age,
      phone: editMyPhone.trim(),
    };

    setCurrentUser(updatedUser);
    await fetchUsersFromSupabase();
    setEditMyPassword('');
    setEditMyConfirmPassword('');
    setShowMyPassword(false);
    setIsEditingMyProfile(false);
    const savedAgeLabel = formatManAgeLabel(updatedUser.birthDate, updatedUser.age);
    setMyInfoSavedMsg(
      `✅ 내 정보가 Supabase DB에 실시간 저장되었습니다! (아이디: ${updatedUser.username}${
        savedAgeLabel ? ` · ${savedAgeLabel} 실력균등 반영` : ''
      }${trimmedPw ? ' · 비밀번호 변경 완료' : ''})`
    );
  };

  // 관리자 아이디·비밀번호 엄격 인증 후 관리자 모드 입장 (Supabase Auth + public.users role='admin' 검증)
  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError('');
    const trimmedAdminId = adminLoginId.trim().toLowerCase();
    const trimmedAdminPw = adminLoginPw.trim();

    if (!trimmedAdminId || !trimmedAdminPw) {
      setAdminLoginError('관리자 아이디와 비밀번호를 모두 입력해야 관리자 모드로 입장할 수 있습니다.');
      return;
    }

    const { data: lookupAdmin } = await supabase
      .from('users')
      .select('*')
      .or(`username.ilike.${trimmedAdminId},email.ilike.${trimmedAdminId}`)
      .maybeSingle();

    const resolvedAdminEmail = lookupAdmin?.email || toAuthEmail(trimmedAdminId);

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: resolvedAdminEmail,
        password: trimmedAdminPw,
      });

    if (signInError || !signInData?.user) {
      setAdminLoginError(
        '❌ 관리자 아이디 또는 비밀번호가 일치하지 않습니다. 관리자 인증 없이는 입장할 수 없습니다.'
      );
      return;
    }

    const { data: adminRow } = await supabase
      .from('users')
      .select('*')
      .eq('id', signInData.user.id)
      .maybeSingle();

    const adminProfile = mapSupabaseUserRow(adminRow || lookupAdmin);

    if (!adminProfile || adminProfile.role !== 'admin') {
      await supabase.auth.signOut();
      setAdminLoginError('❌ 관리자(admin) 권한이 부여되지 않은 계정입니다.');
      return;
    }

    const adminUser: RegisteredPlayer = {
      ...(adminProfile as RegisteredPlayer),
      role: 'admin',
      approvalStatus: 'approved',
    };

    setCurrentUser(adminUser);
    setRole('admin');
    setActiveTab('admin');
    setShowAdminLoginModal(false);
    setAdminLoginId('');
    setAdminLoginPw('');
    setAdminLoginError('');
  };

  // 로그아웃 핸들러 (Supabase Auth 세션 종료)
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('sun_tennis_session_state');
    } catch {}
    setCurrentUser(null);
    setRole('member');
    setActiveTab('courts');
    setPassword('');
    setConfirmPassword('');
    setAuthMessage(null);
  };

  // ============================================================================
  // [백버튼 단계별 뒤로가기 히스토리 스택 & 2회 연속 입력 시 앱 종료 확인 알람]
  // ============================================================================
  const navHistoryRef = useRef<
    Array<{ tab: 'courts' | 'kdk' | 'tournament' | 'mypage' | 'admin'; phase: 'qualifying' | 'main' }>
  >([]);
  const prevRouteRef = useRef<{
    tab: 'courts' | 'kdk' | 'tournament' | 'mypage' | 'admin';
    phase: 'qualifying' | 'main';
  }>({ tab: activeTab, phase: tourPhase });
  const isGoingBackRef = useRef<boolean>(false);
  const [navHistoryCount, setNavHistoryCount] = useState<number>(0);

  // 로그인 상태가 바뀔 때(로그인/로그아웃) 이전 화면 히스토리 초기화
  useEffect(() => {
    navHistoryRef.current = [];
    setNavHistoryCount(0);
    prevRouteRef.current = { tab: activeTab, phase: tourPhase };
  }, [currentUser?.id]);

  // 탭 또는 토너먼트 단계가 변경될 때마다 이전 단계 자동 기록
  useEffect(() => {
    if (!currentUser) return;
    if (isGoingBackRef.current) {
      isGoingBackRef.current = false;
      prevRouteRef.current = { tab: activeTab, phase: tourPhase };
      return;
    }
    const prev = prevRouteRef.current;
    if (prev.tab !== activeTab || prev.phase !== tourPhase) {
      navHistoryRef.current = [...navHistoryRef.current.slice(-29), prev];
      setNavHistoryCount(navHistoryRef.current.length);
      prevRouteRef.current = { tab: activeTab, phase: tourPhase };
    }
  }, [activeTab, tourPhase, currentUser]);

  const handleGoPreviousStep = useCallback((): boolean => {
    // 1) 열려 있는 모달/팝업이 있으면 최상단 모달부터 닫기
    if (showAdminLoginModal) {
      setShowAdminLoginModal(false);
      return true;
    }
    if (selectedCourt) {
      setSelectedCourt(null);
      return true;
    }
    if (courtEditTarget) {
      setCourtEditTarget(null);
      return true;
    }
    if (showNewTourModal) {
      setShowNewTourModal(false);
      return true;
    }

    // 2) 로그인 전 화면: 회원가입 탭이면 로그인 탭으로 전단계 이동
    if (!currentUser) {
      if (isSignUp) {
        setIsSignUp(false);
        setAuthMessage(null);
        return true;
      }
      return false; // 로그인 첫 화면(루트) -> 2회 백버튼 앱 종료 확인 흐름으로
    }

    // 3) 로그인 후 화면: 저장된 직전 단계 히스토리로 순차 이동
    if (navHistoryRef.current.length > 0) {
      const nextStack = [...navHistoryRef.current];
      const prevStep = nextStack.pop()!;
      navHistoryRef.current = nextStack;
      setNavHistoryCount(nextStack.length);
      isGoingBackRef.current = true;
      const safeTab = prevStep.tab === 'admin' && !isAdmin ? 'courts' : prevStep.tab;
      setActiveTab(safeTab);
      setTourPhase(prevStep.phase);
      return true;
    }

    // 4) 히스토리가 비어 있어도 하위 단계(토너먼트 본선)나 기본 홈 탭 외 화면이면 기본 탭으로 복귀
    if (activeTab === 'tournament' && tourPhase === 'main') {
      isGoingBackRef.current = true;
      setTourPhase('qualifying');
      return true;
    }

    const homeTab = isAdmin ? 'admin' : 'courts';
    if (activeTab !== homeTab) {
      isGoingBackRef.current = true;
      setActiveTab(homeTab);
      return true;
    }

    // 5) 더 이상 돌아갈 전단계가 없는 최상위 화면 -> false 반환 (2회 입력 시 종료 확인 알람)
    return false;
  }, [
    showAdminLoginModal,
    selectedCourt,
    courtEditTarget,
    showNewTourModal,
    currentUser,
    isSignUp,
    isAdmin,
    activeTab,
    tourPhase,
  ]);

  const {
    showExitConfirmModal,
    backToastMessage,
    isAppExited,
    triggerBackAction,
    cancelExitApp,
    confirmExitApp,
    restartApp,
  } = useAppBackHandler({
    onGoPreviousStep: handleGoPreviousStep,
    doublePressWindowMs: 2500,
  });

  // 앱 종료 확인 후 브라우저 환경 종료 완료 화면
  if (isAppExited) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-2xl shadow-lg">
            ☀️
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-black text-white">앱이 종료되었습니다</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              썬 테니스 클럽 앱을 이용해 주셔서 감사합니다.
              <br />
              브라우저 탭을 닫거나 아래 버튼으로 다시 실행할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={restartApp}
            className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs transition shadow-md cursor-pointer"
          >
            🔄 앱 다시 실행하기
          </button>
        </div>
      </div>
    );
  }

  // 새로고침 직후 로컬 로그인 세션 복원 중일 때 깜빡임/초기화 방지
  if (!authHydrated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-2xl shadow-lg animate-pulse">
            ☀️
          </div>
          <p className="text-xs font-bold text-slate-400">썬 테니스 클럽 화면을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // [로그인 & 회원가입 화면]: 로그인하지 않은 경우 첫 화면으로 표시
  // ============================================================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          
          {/* 좌측 클럽 브랜딩 배너 */}
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-amber-500/20 bg-slate-900">
            <img
              src="/sun-tennis-hero.jpg"
              alt="썬 테니스 클럽"
              className="w-full h-48 lg:h-[540px] object-cover object-center"
              onError={(e: any) => {
                e.target.src = '/sun-banner.png';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent flex flex-col justify-end p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 uppercase tracking-wider">
                  Official Club
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  실시간 코트 연동
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-black text-white flex items-center gap-2">
                <span className="text-amber-400 text-3xl">☀️</span>
                <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-orange-400 bg-clip-text text-transparent">
                  썬 테니스 클럽
                </span>
              </h1>
              <p className="text-xs lg:text-sm text-slate-300 font-medium mt-2 leading-relaxed">
                실시간 코트 스코어 중계 · KDK 복식 대진표 자동 생성 · 예선/본선 토너먼트 및 개인 랭킹 통합 관리 시스템
              </p>
              <div className="hidden lg:grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-800/80 text-center text-xs">
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-amber-400 font-black block text-sm">실시간 코트</span>
                  <span className="text-[11px] text-slate-400">자동·수동 배정</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-black block text-sm">KDK / 토너먼트</span>
                  <span className="text-[11px] text-slate-400">대회 기록 관리</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-orange-400 font-black block text-sm">공식 전적</span>
                  <span className="text-[11px] text-slate-400">승률/득실 랭킹</span>
                </div>
              </div>
            </div>
          </div>

          {/* 우측 로그인 / 회원가입 카드 폼 */}
          <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 backdrop-blur-xl">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-extrabold mb-1">
                <span>🎾</span>
                <span>SUN TENNIS CLUB MEMBERSHIP</span>
              </div>
              <h2 className="text-xl font-black text-white">
                {isSignUp ? '신규 클럽 회원가입' : '클럽 회원 로그인'}
              </h2>
              <p className="text-xs text-slate-400">
                {isSignUp
                  ? '이메일 없이 사용할 아이디와 비밀번호만 입력해 간편하게 가입하세요.'
                  : '아이디와 비밀번호를 입력해 로그인하거나 회원가입 버튼을 눌러주세요.'}
              </p>
            </div>

            {authMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-bold border ${
                  authMessage.type === 'error'
                    ? 'bg-red-950/60 border-red-500/40 text-red-300'
                    : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                }`}
              >
                {authMessage.text}
              </div>
            )}

            {/* 로그인 & 회원가입 통합 폼 (아이디 + 비밀번호 기반, 이메일 형식 불필요) */}
            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              {/* 아이디 입력 (이메일 주소 불필요) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  아이디 (ID) <span className="text-amber-400">*</span>
                  <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                    (이메일 형식 불필요 · 영문/숫자/한글 가능)
                  </span>
                </label>
                <input
                  type="text"
                  placeholder={isSignUp ? '사용할 아이디 입력 (예: sun01, chulsoo)' : '아이디 입력 (예: chulsoo, admin)'}
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  required
                />
              </div>

              {/* 비밀번호 입력 */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  비밀번호 <span className="text-amber-400">*</span>
                </label>
                <input
                  type="password"
                  placeholder="비밀번호 입력 (4자 이상)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={4}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  required
                />
              </div>

              {isSignUp && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      비밀번호 확인 <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="password"
                      placeholder="비밀번호 다시 입력"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={4}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      이름 (실명) <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="예: 홍길동"
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      required
                    />
                  </div>

                  <BirthDateSelector
                    value={signUpBirthDate}
                    onChange={setSignUpBirthDate}
                    required
                    accent="emerald"
                    label="생년월일 (출생년도 · 월 · 일)"
                    helperText="출생년월일을 입력하면 만 나이가 자동 계산되어 KDK·대회 실력 균등 배정에 반영됩니다."
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        성별 <span className="text-amber-400">*</span>
                      </label>
                      <select
                        value={signUpGender}
                        onChange={(e) => setSignUpGender(e.target.value as 'M' | 'F')}
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      >
                        <option value="M">남성 (남)</option>
                        <option value="F">여성 (여)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        테니스 등급(부수) <span className="text-amber-400">*</span>
                      </label>
                      <select
                        value={signUpGrade}
                        onChange={(e) => setSignUpGrade(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-amber-300 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      >
                        {GRADE_OPTIONS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      휴대폰 번호 <span className="text-slate-500 font-normal">(선택)</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="010-1234-5678"
                      value={signUpPhone}
                      onChange={(e) => setSignUpPhone(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>
                </>
              )}

              {/* 중복 없는 단일 로그인 · 회원가입 버튼 영역 */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {!isSignUp ? (
                  <>
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="py-3 font-black rounded-xl text-sm shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 shadow-amber-500/20"
                    >
                      <span>🔑</span>
                      <span>{authLoading ? '처리 중...' : '로그인'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(true);
                        setAuthMessage(null);
                      }}
                      className="py-3 font-black rounded-xl text-sm transition flex items-center justify-center gap-1.5 cursor-pointer bg-emerald-950/50 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-500/40"
                    >
                      <span>✨</span>
                      <span>회원가입</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(false);
                        setAuthMessage(null);
                      }}
                      className="py-3 font-black rounded-xl text-sm transition flex items-center justify-center gap-1.5 cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                    >
                      <span>🔑</span>
                      <span>로그인</span>
                    </button>
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="py-3 font-black rounded-xl text-sm shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 shadow-emerald-500/20"
                    >
                      <span>✨</span>
                      <span>{authLoading ? '처리 중...' : '회원가입 신청'}</span>
                    </button>
                  </>
                )}
              </div>
              {isSignUp && (
                <p className="text-[11px] text-center text-amber-300/90 bg-amber-950/40 border border-amber-500/30 rounded-xl py-2 px-3">
                  ⏳ 회원가입 신청 후 운영자(관리자)의 확인 및 승인이 완료되면 로그인하여 접속할 수 있습니다.
                </p>
              )}
            </form>

            {/* 하단 관리자 전용 입장 버튼 (관리자 아이디·비번 인증 필수) */}
            <div className="pt-3 border-t border-slate-800 space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setAdminLoginId('');
                  setAdminLoginPw('');
                  setAdminLoginError('');
                  setShowAdminLoginModal(true);
                }}
                className="w-full py-2.5 bg-gradient-to-r from-red-500/20 via-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/40 font-black rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span>👑</span>
                <span>관리자 입장 (관리자 아이디·비밀번호 인증)</span>
              </button>

              <p className="text-[10px] text-center text-slate-500 pt-0.5">
                💡 일반 로그인 시 회원전용으로 접속되며, 관리자 모드는 관리자 계정 인증 후 입장 가능합니다.
              </p>
            </div>
          </div>
        </div>

        {/* [관리자 전용 아이디·비밀번호 인증 모달] */}
        {showAdminLoginModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-amber-500/40 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-black text-amber-400 flex items-center gap-1.5">
                    <span>👑</span> 관리자 전용 인증 로그인
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    관리자 아이디와 비밀번호를 정확히 입력해야 입장됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdminLoginModal(false)}
                  className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center font-bold text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {adminLoginError && (
                <div className="p-2.5 rounded-xl bg-red-950/70 border border-red-500/40 text-red-300 text-xs font-bold">
                  {adminLoginError}
                </div>
              )}

              <form onSubmit={handleAdminLoginSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    관리자 아이디 <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={adminLoginId}
                    onChange={(e) => setAdminLoginId(e.target.value)}
                    placeholder="관리자 아이디 입력"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    관리자 비밀번호 <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="password"
                    value={adminLoginPw}
                    onChange={(e) => setAdminLoginPw(e.target.value)}
                    placeholder="관리자 비밀번호 입력"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAdminLoginModal(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-xs shadow-lg cursor-pointer"
                  >
                    👑 관리자 인증 입장
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <AppBackExitOverlay
          backToastMessage={backToastMessage}
          showExitConfirmModal={showExitConfirmModal}
          onCancelExit={cancelExitApp}
          onConfirmExit={confirmExitApp}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-900">
      <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row justify-center items-start lg:gap-8 lg:p-6 min-h-screen">
        
        {/* ======================================================== */}
        {/* [PC 전용 사이드바: 브랜드 & 대회 기록 & 퀵 컨트롤러] */}
        {/* ======================================================== */}
        <aside className="hidden lg:flex flex-col w-[380px] shrink-0 sticky top-6 space-y-4">
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-amber-500/20 group">
            <img
              src="/sun-tennis-hero.jpg"
              alt="썬 테니스 클럽"
              className="w-full h-56 object-cover object-center group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent flex flex-col justify-end p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 uppercase tracking-wider shadow-sm">
                  Official Club
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  실시간 가동 중
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2 drop-shadow-md">
                <span className="text-amber-400">☀️</span> 썬 테니스 클럽
              </h1>
              <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                태양처럼 뜨거운 열정! 관리자 코트 생성, 자동/수동 선수 배정 및 대회 기록 관리 시스템
              </p>
            </div>
          </div>

          {/* 현재 진행 대회 안내 카드 */}
          <div className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 rounded-3xl p-4 shadow-xl space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                ACTIVE TOURNAMENT
              </span>
              {isAdmin && (
                <button
                  onClick={() => setShowNewTourModal(true)}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <span>+</span> 새 대회 개설
                </button>
              )}
            </div>

            <div>
              <h3 className="text-sm font-black text-white leading-snug">{currentTournament.name}</h3>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                <span>📅 진행일: <strong className="text-amber-300">{currentTournament.date}</strong></span>
                <span>•</span>
                <span>방식: <strong className="text-emerald-300">{currentTournament.format === 'kdk' ? 'KDK 순환' : '예선/본선'}</strong></span>
              </div>
            </div>

            {/* 대회 히스토리 셀렉터 */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400">
                  📜 대회 기록 관리 ({tournamentHistory.length}개)
                </label>
                {isAdmin && tournamentHistory.length > 0 && currentTournament.id !== 'tour-empty' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteTournament(currentTournament.id)}
                    className="text-[10px] px-2 py-0.5 rounded-lg bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-500/40 font-bold cursor-pointer transition"
                  >
                    🗑️ 선택 대회 삭제
                  </button>
                )}
              </div>
              <select
                value={currentTournament.id}
                onChange={(e) => {
                  const selected = tournamentHistory.find((t) => t.id === e.target.value);
                  if (selected) setCurrentTournament(selected);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white focus:outline-none"
              >
                {tournamentHistory.length === 0 ? (
                  <option value="tour-empty">개설된 대회가 없습니다</option>
                ) : (
                  tournamentHistory.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.status === 'completed' ? '종료' : '진행중'}] {t.name} ({t.date})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* PC 메뉴 바로가기 */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">시스템 메뉴 바로가기</p>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                onClick={() => setActiveTab('courts')}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left ${
                  activeTab === 'courts'
                    ? 'bg-amber-400/10 text-amber-300 border border-amber-400/30 shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="text-base">🎾</span>
                <div className="flex-1">
                  <p className="leading-tight">코트 현황 & 선수 배정</p>
                  <p className="text-[10px] text-slate-500 font-normal">총 {courts.length}개 코트 가동 중</p>
                </div>
              </button>

              {currentTournament.format === 'kdk' && (
                <button
                  onClick={() => setActiveTab('kdk')}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left ${
                    activeTab === 'kdk'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-base">🔄</span>
                  <div className="flex-1">
                    <p className="leading-tight">KDK 파트너 순환 진행</p>
                    <p className="text-[10px] text-slate-500 font-normal">개인 승점제 월례회 대진표</p>
                  </div>
                </button>
              )}

              {currentTournament.format === 'tournament' && (
                <button
                  onClick={() => setActiveTab('tournament')}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left ${
                    activeTab === 'tournament'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30 shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-base">🏆</span>
                  <div className="flex-1">
                    <p className="leading-tight">예선 & 본선 토너먼트</p>
                    <p className="text-[10px] text-slate-500 font-normal">조별 풀리그 & 4강/결승</p>
                  </div>
                </button>
              )}

              <button
                onClick={() => setActiveTab('mypage')}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left ${
                  activeTab === 'mypage'
                    ? 'bg-amber-400/10 text-amber-300 border border-amber-400/30 shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="text-base">👤</span>
                <div className="flex-1">
                  <p className="leading-tight">VIP 마이페이지</p>
                  <p className="text-[10px] text-slate-500 font-normal">개인 전적 & 승률 랭킹</p>
                </div>
              </button>

              {isAdmin && (
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left cursor-pointer ${
                    activeTab === 'admin'
                      ? 'bg-red-400/10 text-red-300 border border-red-400/30 shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-base">⚙️</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="leading-tight">운영자 관리 센터</p>
                      {pendingApprovalCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black animate-pulse">
                          승인대기 {pendingApprovalCount}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 font-normal">가입승인 · 회원수정·취소 & 대회관리</p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* ======================================================== */}
        {/* [모바일 프레임 / 메인 모바일 네이티브 레이아웃] */}
        {/* ======================================================== */}
        <main className="w-full max-w-md bg-slate-950 min-h-screen lg:min-h-[900px] lg:rounded-[42px] lg:border-[8px] lg:border-slate-800/80 shadow-2xl overflow-hidden flex flex-col relative pb-24">
          
          {/* 상단 썬 클럽 모바일 헤더 */}
          <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={triggerBackAction}
                title={navHistoryCount > 0 ? '이전 단계로 이동' : '뒤로가기 (2회 누르면 앱 종료 확인)'}
                className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-amber-300 flex items-center justify-center text-sm font-black transition cursor-pointer shrink-0"
              >
                ←
              </button>
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-lg shrink-0">
                ☀️
              </div>
              <div>
                <h2 className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
                  {currentUser.name} 회원님
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    {currentUser.grade}
                  </span>
                </h2>
                <p className="text-[10px] text-slate-400 font-medium">
                  {isAdmin ? '👑 관리자 전용 운영 모드' : '🎾 썬 테니스 클럽 회원 전용 뷰'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className={`px-2 py-1 rounded-xl text-[10px] font-extrabold border ${
                  isAdmin
                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}
              >
                {isAdmin ? '👑 관리자 모드' : '👤 회원전용'}
              </span>
              <button
                onClick={handleLogout}
                className="px-2 py-1 rounded-xl text-[10px] font-bold bg-slate-800 hover:bg-red-950/80 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-500/40 transition cursor-pointer"
              >
                로그아웃
              </button>
            </div>
          </header>

          {/* 메인 탭 컨텐츠 영역 */}
          <div className="p-4 space-y-4 flex-1">
            
            {/* 대회 정보 상단 배너 & 관리자 새 대회 개설 버튼 */}
            <div className="bg-gradient-to-r from-amber-950/70 via-slate-900 to-slate-900 p-3.5 rounded-2xl border border-amber-500/30 shadow-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                  🏆 현재 진행 대회
                </span>
                {isAdmin && (
                  <button
                    onClick={() => setShowNewTourModal(true)}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-[11px] font-black transition flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <span>+</span>
                    <span>새 대회 개설</span>
                  </button>
                )}
              </div>

              <div>
                <h3 className="text-sm font-black text-white truncate">{currentTournament.name}</h3>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                  <span>📅 진행일: <strong className="text-amber-300">{currentTournament.date}</strong></span>
                  <span>•</span>
                  <span>방식: <strong className="text-emerald-300">{currentTournament.format === 'kdk' ? 'KDK 순환' : '예선/본선'}</strong></span>
                  <span>•</span>
                  <span className={currentTournament.status === 'completed' ? 'text-slate-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {currentTournament.status === 'completed' ? '🏁 종료됨' : '🔴 진행중'}
                  </span>
                </div>
              </div>

              {tournamentHistory.length > 1 && (
                <div className="pt-1.5 border-t border-slate-800/80 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 shrink-0">📜 대회 기록 보기:</span>
                  <select
                    value={currentTournament.id}
                    onChange={(e) => {
                      const selected = tournamentHistory.find((t) => t.id === e.target.value);
                      if (selected) setCurrentTournament(selected);
                    }}
                    className="flex-1 bg-slate-950/90 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-amber-200 font-bold focus:outline-none"
                  >
                    {tournamentHistory.map((t) => (
                      <option key={t.id} value={t.id}>
                        [{t.status === 'completed' ? '과거/종료' : '현재진행'}] {t.name} ({t.date})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* ---------------------------------------------------- */}
            {/* [탭 1]: 실시간 코트 현황 & 관리자 코트/선수 배정 패널 */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'courts' && (
              <div className="space-y-3.5">
                
                {/* 관리자 코트 추가 생성 및 선수 자동 배정 툴바 (관리자 전용) / 회원 모드 읽기전용 현황 */}
                {isAdmin ? (
                  <div className="bg-slate-900 border border-slate-750 rounded-2xl p-3 shadow-xl space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-white flex items-center gap-1.5">
                        <span className="text-amber-400">🏟️</span> 코트 배정 & 관리자 제어기
                      </span>
                      <span className="text-[11px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md">
                        총 {courts.length}개 코트 운영 중
                      </span>
                    </div>

                    {/* 코트 수 증감 (+ / -) 스텝퍼 조절 바 */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-inner">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-300">코트 수 조절:</span>
                        <span className="text-sm font-black text-amber-400 bg-slate-900 px-2.5 py-0.5 rounded-lg border border-slate-700 shadow-xs">
                          {courts.length}개 코트
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* 코트 수 1개 줄이기 (-) 버튼 */}
                        <button
                          type="button"
                          onClick={handleRemoveCourt}
                          disabled={courts.length <= 1}
                          title="코트 1개 줄이기 (-)"
                          className={`w-9 h-8 rounded-xl font-black text-base flex items-center justify-center transition shadow-sm ${
                            courts.length <= 1
                              ? 'bg-slate-850 text-slate-600 border border-slate-800 cursor-not-allowed'
                              : 'bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 hover:text-white cursor-pointer active:scale-95'
                          }`}
                        >
                          －
                        </button>

                        {/* 코트 수 1개 늘리기 (+) 버튼 */}
                        <button
                          type="button"
                          onClick={handleAddCourt}
                          title="코트 1개 추가하기 (+)"
                          className="w-9 h-8 rounded-xl font-black text-base flex items-center justify-center bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 hover:text-white cursor-pointer active:scale-95 transition shadow-sm"
                        >
                          ＋
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      {/* 코트 넘버를 코트 수에 맞게 계속 생성하는 버튼 */}
                      <button
                        onClick={handleAddCourt}
                        className="py-2 px-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-xs transition flex items-center justify-center gap-1 shadow-md cursor-pointer"
                      >
                        <span className="text-sm">+</span>
                        <span>코트 추가 ({courts.length + 1}번)</span>
                      </button>

                      {/* 등록된 선수를 코트에 자동 배정하는 버튼 */}
                      <button
                        onClick={handleAutoAssignPlayers}
                        className="py-2 px-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-xs transition flex items-center justify-center gap-1 shadow-md cursor-pointer"
                      >
                        <span>🎲</span>
                        <span>선수 자동 배정</span>
                      </button>
                    </div>

                    <button
                      onClick={() => setActiveTab('admin')}
                      className="w-full py-2 bg-slate-950/90 hover:bg-slate-800 text-amber-300 font-bold rounded-xl text-xs border border-amber-500/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>⚙️</span>
                      <span>운영관리 창에서 대회·방식·선수·코트 종합 설정 ➔</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-md flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20 flex items-center justify-center text-sm font-bold">
                        🏟️
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-white">실시간 코트 운영 현황</span>
                          <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded font-bold">
                            총 {courts.length}개 코트 가동 중
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          대회 생성, 방식 설정, 코트 증감 및 선수 배정은 관리자 전용 기능입니다.
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-2 py-1 rounded-lg shrink-0">
                      🔴 LIVE 실시간
                    </span>
                  </div>
                )}

                {/* 현재 선택된 대회 방식(KDK 또는 토너먼트)에 연계된 빠른 이동 버튼만 단독 노출 */}
                <div>
                  {currentTournament.format === 'kdk' ? (
                    <button
                      onClick={() => setActiveTab('kdk')}
                      className="w-full p-3 bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30 hover:border-emerald-400 rounded-2xl text-left transition group shadow-md cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-white group-hover:text-emerald-300 flex items-center gap-1.5">
                          <span>🔄</span>
                          <span>KDK 파트너 순환 대진표 & 순위 보기</span>
                        </span>
                        <span className="text-[10px] font-black bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-md">
                          KDK 바로가기 ➔
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        현재 대회({currentTournament.name})는 KDK 방식으로 진행됩니다.
                      </p>
                    </button>
                  ) : (
                    <button
                      onClick={() => setActiveTab('tournament')}
                      className="w-full p-3 bg-gradient-to-br from-amber-950/60 to-slate-900 border border-amber-500/30 hover:border-amber-400 rounded-2xl text-left transition group shadow-md cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-white group-hover:text-amber-300 flex items-center gap-1.5">
                          <span>🏆</span>
                          <span>예선 조별리그 & 본선 토너먼트 대진표 보기</span>
                        </span>
                        <span className="text-[10px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md">
                          토너먼트 바로가기 ➔
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        현재 대회({currentTournament.name})는 토너먼트 방식으로 진행됩니다.
                      </p>
                    </button>
                  )}
                </div>

                {/* 코트 카드 리스트 (동적 생성된 모든 코트 출력) */}
                <div className="space-y-3">
                  {courts.map((court) => {
                    const isMyAssignedCourt =
                      Boolean(currentUser?.name) &&
                      (court.teamA.some((m) => m.includes(currentUser.name)) ||
                        court.teamB.some((m) => m.includes(currentUser.name)));
                    return (
                    <div
                      key={court.id}
                      className={`bg-slate-900/90 border rounded-2xl p-4 shadow-xl space-y-3 relative overflow-hidden transition-all ${
                        isMyAssignedCourt
                          ? 'border-emerald-500/50 ring-1 ring-emerald-500/20'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-amber-400 text-slate-950">
                            {court.courtNumber}번 코트
                          </span>
                          <span
                            className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                              court.status === 'playing'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                                : court.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {court.status === 'playing' ? '🔴 LIVE 경기 중' : court.status === 'completed' ? '🏁 경기 완료' : '⚪ 대기 중'}
                          </span>
                          {isMyAssignedCourt && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                              🎾 내 배정 코트
                            </span>
                          )}
                        </div>

                        {isAdmin && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => openScoreModal(court)}
                              className="text-[11px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold border border-slate-700 transition cursor-pointer"
                            >
                              점수 수정 ✎
                            </button>
                            {courts.length > 1 && (
                              <button
                                onClick={() => handleDeleteCourt(court.id)}
                                className="text-[11px] px-2 py-1 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 font-bold border border-red-500/30 transition cursor-pointer"
                                title="코트 삭제"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 팀 선수 정보 (관리자일 때만 클릭 수정 가능) */}
                      <div className="grid grid-cols-2 gap-3 items-center">
                        {/* 팀 A */}
                        <div
                          onClick={() => {
                            if (isAdmin) openCourtPlayerEditModal(court);
                          }}
                          className={`bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1 transition group ${
                            isAdmin ? 'cursor-pointer hover:border-amber-400/50' : ''
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-amber-400">TEAM A</span>
                            <span className="text-xl font-black text-white">{court.scoreA}</span>
                          </div>
                          <div className="text-xs font-bold text-slate-200">
                            {court.teamA.map((m, idx) => (
                              <p key={idx} className="truncate group-hover:text-amber-300">{m}</p>
                            ))}
                          </div>
                          {isAdmin && (
                            <span className="text-[9px] text-slate-500 block text-right pt-0.5">선수 수정 ✎</span>
                          )}
                        </div>

                        {/* 팀 B */}
                        <div
                          onClick={() => {
                            if (isAdmin) openCourtPlayerEditModal(court);
                          }}
                          className={`bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1 transition group ${
                            isAdmin ? 'cursor-pointer hover:border-emerald-400/50' : ''
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-emerald-400">TEAM B</span>
                            <span className="text-xl font-black text-white">{court.scoreB}</span>
                          </div>
                          <div className="text-xs font-bold text-slate-200">
                            {court.teamB.map((m, idx) => (
                              <p key={idx} className="truncate group-hover:text-emerald-300">{m}</p>
                            ))}
                          </div>
                          {isAdmin && (
                            <span className="text-[9px] text-slate-500 block text-right pt-0.5">선수 수정 ✎</span>
                          )}
                        </div>
                      </div>

                      {/* 하단 수동 배정/수정 바 (관리자 전용) */}
                      {isAdmin && (
                        <button
                          onClick={() => openCourtPlayerEditModal(court)}
                          className="w-full py-1.5 bg-slate-950/90 hover:bg-slate-800 text-slate-300 font-bold rounded-xl text-[11px] border border-slate-800 transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>👤</span>
                          <span>{court.courtNumber}번 코트 선수 수동 배정 및 수정</span>
                        </button>
                      )}
                    </div>
                  );
                  })}
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* [탭 2]: KDK 파트너 순환 진행 (KDK 방식 대회 선택 시에만 노출) */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'kdk' && currentTournament.format === 'kdk' && (
              <div className="space-y-4">
                <KdkCourtOperations
                  tournamentName={`${currentTournament.name} (${currentTournament.date})`}
                  availablePlayers={approvedPlayers}
                  isAdmin={isAdmin}
                  viewMode="PLAY"
                  onNavigateToTab={setActiveTab}
                  onSyncCourtsToApp={(syncedCourts) => {
                    setCourts(syncedCourts);
                  }}
                  onAddNewPlayerToClub={(newPlayer) => {
                    setRegisteredPlayers((prev) => {
                      if (prev.some((p) => p.id === newPlayer.id)) return prev;
                      return [
                        ...prev,
                        {
                          id: newPlayer.id,
                          name: newPlayer.name,
                          grade: newPlayer.grade,
                          gender: newPlayer.gender === 'F' || newPlayer.gender === '여' ? 'F' : 'M',
                          birthDate: newPlayer.birthDate,
                          age: resolvePlayerAge(newPlayer, 45),
                          experienceYears: newPlayer.experienceYears,
                          role: 'member',
                          isGuest: true,
                        },
                      ];
                    });
                  }}
                />
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* [탭 3]: 예선전 & 본선 토너먼트 진행 전용 화면 (토너먼트 방식 대회 선택 시에만 노출) */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'tournament' && currentTournament.format === 'tournament' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 p-3 rounded-2xl border border-amber-500/30 shadow-md">
                  <div>
                    <h3 className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <span>🏆</span> 정규 대회 토너먼트
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {currentTournament.name} ({currentTournament.date})
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-[10px] font-black">
                    예선/본선 토너먼트
                  </span>
                </div>

                {/* 예선전 / 본선 토너먼트 서브 탭 버튼 2개 */}
                <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold gap-1">
                  <button
                    onClick={() => setTourPhase('qualifying')}
                    className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
                      tourPhase === 'qualifying'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🥇</span>
                    <span>1단계: 예선 조별리그</span>
                  </button>

                  <button
                    onClick={() => setTourPhase('main')}
                    className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
                      tourPhase === 'main'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🏅</span>
                    <span>2단계: 본선 토너먼트 (4강/결승)</span>
                  </button>
                </div>

                {/* 1단계 예선 조별리그 */}
                {tourPhase === 'qualifying' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                      {/* A조 */}
                      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-2">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                          <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                            <span>🅰️</span> 예선 A조 순위표 (상위 2팀 본선 진출)
                          </span>
                          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30">
                            풀리그
                          </span>
                        </div>
                        <table className="w-full text-center text-xs">
                          <thead>
                            <tr className="text-slate-400 text-[10px] border-b border-slate-800/80">
                              <th className="py-1">순위</th>
                              <th className="py-1 text-left px-2">팀명</th>
                              <th className="py-1">승-패</th>
                              <th className="py-1">득실</th>
                              <th className="py-1 font-bold text-amber-400">승점</th>
                              <th className="py-1">진출</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {groupAStandings.map((t) => (
                              <tr key={t.team} className={t.qualified ? 'bg-amber-400/5 font-bold' : ''}>
                                <td className="py-2">{t.rank}</td>
                                <td className="py-2 text-left px-2 text-white">{t.team}</td>
                                <td className="py-2 text-emerald-400">{t.wins}승 {t.losses}패</td>
                                <td className="py-2 text-slate-300">{t.diff}</td>
                                <td className="py-2 font-black text-amber-400">{t.pts}</td>
                                <td className="py-2">
                                  {t.qualified ? (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                                      본선진출
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-500">탈락</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* B조 */}
                      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-2">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                          <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                            <span>🅱️</span> 예선 B조 순위표 (상위 2팀 본선 진출)
                          </span>
                          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30">
                            풀리그
                          </span>
                        </div>
                        <table className="w-full text-center text-xs">
                          <thead>
                            <tr className="text-slate-400 text-[10px] border-b border-slate-800/80">
                              <th className="py-1">순위</th>
                              <th className="py-1 text-left px-2">팀명</th>
                              <th className="py-1">승-패</th>
                              <th className="py-1">득실</th>
                              <th className="py-1 font-bold text-amber-400">승점</th>
                              <th className="py-1">진출</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {groupBStandings.map((t) => (
                              <tr key={t.team} className={t.qualified ? 'bg-emerald-400/5 font-bold' : ''}>
                                <td className="py-2">{t.rank}</td>
                                <td className="py-2 text-left px-2 text-white">{t.team}</td>
                                <td className="py-2 text-emerald-400">{t.wins}승 {t.losses}패</td>
                                <td className="py-2 text-slate-300">{t.diff}</td>
                                <td className="py-2 font-black text-amber-400">{t.pts}</td>
                                <td className="py-2">
                                  {t.qualified ? (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                                      본선진출
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-500">탈락</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          setTourPhase('main');
                          alert('🏆 예선 조별 1, 2위가 확정되어 본선 4강 토너먼트 브래킷에 자동 배치되었습니다!');
                        }}
                        className="w-full py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-2xl text-xs transition shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span className="text-base">🚀</span>
                        <span>조별 1, 2위 본선 진출 확정 & 본선 토너먼트 브래킷 생성</span>
                      </button>
                    )}
                  </div>
                )}

                {/* 2단계 본선 토너먼트 */}
                {tourPhase === 'main' && (
                  <div className="space-y-4">
                    {champion && (
                      <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 text-slate-950 p-4 rounded-3xl shadow-2xl text-center space-y-1 animate-bounce">
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-900/80">🏆 2026 SUN TENNIS TOURNAMENT CHAMPION</p>
                        <h3 className="text-xl font-black">{champion}</h3>
                        <p className="text-xs font-extrabold text-slate-900">영예의 썬 테니스 클럽 챔피언십 우승을 축하합니다!</p>
                      </div>
                    )}

                    <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <span className="text-xs font-black text-amber-400">🏆 본선 4강 및 결승전 브래킷</span>
                        <span className="text-[10px] text-slate-400">정규 6게임 세트</span>
                      </div>

                      {/* 4강 1경기 */}
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                          <span>{semiFinal1.name} (코트 1)</span>
                          <span className="text-emerald-400">승자 결승 진출</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-amber-400">{semiFinal1.teamA}</span>
                          <span className="text-sm font-black text-white px-2 py-0.5 bg-slate-900 rounded border border-slate-800">
                            {semiFinal1.scoreA} : {semiFinal1.scoreB}
                          </span>
                          <span className="font-bold text-slate-400">{semiFinal1.teamB}</span>
                        </div>
                      </div>

                      {/* 4강 2경기 */}
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                          <span>{semiFinal2.name} (코트 2)</span>
                          <span className="text-emerald-400">승자 결승 진출</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-400">{semiFinal2.teamA}</span>
                          <span className="text-sm font-black text-white px-2 py-0.5 bg-slate-900 rounded border border-slate-800">
                            {semiFinal2.scoreA} : {semiFinal2.scoreB}
                          </span>
                          <span className="font-bold text-amber-400">{semiFinal2.teamB}</span>
                        </div>
                      </div>

                      {/* 결승전 */}
                      <div className="bg-gradient-to-br from-amber-950/80 via-slate-950 to-slate-950 p-4 rounded-2xl border-2 border-amber-500/50 shadow-2xl space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                            <span>👑</span> 🏆 결승전 (FINAL)
                          </span>
                          <span className="text-[10px] font-extrabold text-amber-400 bg-amber-400/20 px-2 py-0.5 rounded-full border border-amber-400/40 animate-pulse">
                            CHAMPIONSHIP
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                          <div className="text-center flex-1">
                            <p className="font-black text-white text-sm">{finalMatch.teamA}</p>
                            <span className="text-[10px] text-amber-400 font-bold">(A조 1위)</span>
                          </div>

                          <div className="flex flex-col items-center mx-2 bg-slate-900 p-2 rounded-2xl border border-amber-500/30">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xl font-black text-amber-400">{finalMatch.scoreA}</span>
                              <span className="font-black text-slate-500 text-xs">:</span>
                              <span className="text-xl font-black text-amber-400">{finalMatch.scoreB}</span>
                            </div>
                            <span className="text-[9px] text-slate-400 font-bold mt-0.5">매치포인트</span>
                          </div>

                          <div className="text-center flex-1">
                            <p className="font-black text-white text-sm">{finalMatch.teamB}</p>
                            <span className="text-[10px] text-amber-400 font-bold">(A조 2위)</span>
                          </div>
                        </div>

                        {isAdmin && (
                          <div className="pt-2 border-t border-slate-800/80 flex gap-2">
                            <button
                              onClick={() => {
                                setChampion(finalMatch.teamA);
                                alert(`🎉 [${finalMatch.teamA}] 우승이 확정되었습니다! 🏆`);
                              }}
                              className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs transition shadow-md cursor-pointer"
                            >
                              🥇 {finalMatch.teamA} 우승 확정
                            </button>
                            <button
                              onClick={() => {
                                setChampion(finalMatch.teamB);
                                alert(`🎉 [${finalMatch.teamB}] 우승이 확정되었습니다! 🏆`);
                              }}
                              className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-black rounded-xl text-xs transition border border-amber-500/30 cursor-pointer"
                            >
                              🥇 {finalMatch.teamB} 우승 확정
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* [탭 4]: VIP 마이페이지 (상단 이름 옆 수정 버튼 클릭 시에만 개인정보 확인/수정 창 노출) */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'mypage' && (
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700 p-5 text-slate-950 shadow-2xl">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-950/70 block">
                        SUN TENNIS VIP CLUB
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-black text-slate-950 flex items-center gap-1.5">
                          <span>{isAdmin ? '👑' : '☀️'}</span> {currentUser.name} {isAdmin ? '관리자님' : '회원님'}
                        </h2>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isEditingMyProfile) {
                              resetMyProfileFormFromUser(currentUser);
                              setMyInfoSavedMsg('');
                              setIsEditingMyProfile(true);
                            } else {
                              resetMyProfileFormFromUser(currentUser);
                              setIsEditingMyProfile(false);
                            }
                          }}
                          className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-slate-950/90 hover:bg-slate-900 text-amber-300 border border-slate-800 shadow-md cursor-pointer transition shrink-0"
                        >
                          {isEditingMyProfile ? '✕ 수정 닫기' : '✏️ 내 정보 수정'}
                        </button>
                      </div>
                      <div className="flex gap-1.5 pt-0.5 flex-wrap items-center">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-950 text-amber-300 shadow-sm">
                          {currentUser.grade}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/40 text-slate-950">
                          {isAdmin ? '관리자 모드' : '정회원'} ({currentUser.gender === 'F' ? '여' : '남'})
                        </span>
                        {formatManAgeLabel(currentUser.birthDate, currentUser.age) ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-950/85 text-emerald-300 shadow-sm">
                            🎂 {formatManAgeLabel(currentUser.birthDate, currentUser.age)}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-950/50 text-amber-200">
                            생년월일 미입력
                          </span>
                        )}
                      </div>
                      {currentUser.birthDate && (
                        <p className="text-[10px] font-bold text-slate-950/75">
                          생년월일: {formatBirthDateDisplay(currentUser.birthDate)} (만 나이 실력균등 자동반영)
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-extrabold text-slate-950/70 block">전체 누적 랭킹</span>
                      <span className="text-2xl font-black text-slate-950">TOP {currentUserRank}위 🏆</span>
                      <span className="text-[10px] font-black text-slate-950/80 block">
                        누적 승률 {currentUserCumulative?.winRateStr || '0.0'}% ({currentUserCumulative?.totalWins || 0}승 {currentUserCumulative?.totalLosses || 0}패)
                      </span>
                    </div>
                  </div>
                </div>

                {myInfoSavedMsg && (
                  <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-md">
                    {myInfoSavedMsg}
                  </div>
                )}

                {/* 상단 회원 이름 옆 [✏️ 내 정보 수정] 버튼을 눌렀을 때만 개인정보 확인 및 수정 창 노출 */}
                {isEditingMyProfile && (
                  <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-4 shadow-xl space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
                      <div>
                        <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                          <span>👤</span> 내 개인정보 확인 및 수정 ({isAdmin ? '관리자' : '일반회원'})
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          현재 아이디: <strong className="text-amber-300">{currentUser.username || currentUser.email || currentUser.id}</strong> · 정보를 확인하거나 수정한 뒤 저장하세요.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          resetMyProfileFormFromUser(currentUser);
                          setIsEditingMyProfile(false);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold rounded-xl text-[11px] cursor-pointer shrink-0 transition"
                      >
                        ✕ 닫기
                      </button>
                    </div>

                    <form onSubmit={handleSaveMyProfile} className="space-y-3 text-xs">
                      <div className="bg-slate-950/90 border border-amber-500/35 rounded-xl p-3 space-y-2.5">
                        <span className="text-[11px] font-black text-amber-300 flex items-center gap-1">
                          <span>🔐</span> 아이디 · 비밀번호 확인 및 변경
                        </span>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 mb-1">
                            아이디 (ID) <span className="text-amber-400">*</span>{' '}
                            <span className="font-normal text-slate-500">(이메일 형식 불필요)</span>
                          </label>
                          <input
                            type="text"
                            value={editMyUsername}
                            onChange={(e) => setEditMyUsername(e.target.value)}
                            placeholder="사용할 아이디 입력 (2자 이상)"
                            minLength={2}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 mb-1">
                              새 비밀번호 <span className="font-normal text-slate-500">(변경 시)</span>
                            </label>
                            <div className="flex gap-1">
                              <input
                                type={showMyPassword ? 'text' : 'password'}
                                value={editMyPassword}
                                onChange={(e) => setEditMyPassword(e.target.value)}
                                placeholder="4자 이상 (미입력 시 유지)"
                                className="flex-1 px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-emerald-300 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400"
                              />
                              <button
                                type="button"
                                onClick={() => setShowMyPassword((prev) => !prev)}
                                className="px-2 py-2 bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-[10px] font-bold cursor-pointer shrink-0"
                              >
                                {showMyPassword ? '🙈' : '👁️'}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 mb-1">
                              새 비밀번호 확인
                            </label>
                            <input
                              type={showMyPassword ? 'text' : 'password'}
                              value={editMyConfirmPassword}
                              onChange={(e) => setEditMyConfirmPassword(e.target.value)}
                              placeholder="새 비밀번호 다시 입력"
                              className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-emerald-300 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 mb-1">이름</label>
                          <input
                            type="text"
                            value={editMyName}
                            onChange={(e) => setEditMyName(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 mb-1">성별</label>
                          <select
                            value={editMyGender}
                            onChange={(e) => setEditMyGender(e.target.value as 'M' | 'F')}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                          >
                            <option value="M">남성 (남)</option>
                            <option value="F">여성 (여)</option>
                          </select>
                        </div>
                      </div>

                      <BirthDateSelector
                        key={`${currentUser.id}_${isEditingMyProfile}`}
                        value={editMyBirthDate}
                        onChange={setEditMyBirthDate}
                        compact
                        label="생년월일 (출생년도 · 월 · 일)"
                        helperText="만 나이가 자동 계산되어 KDK·대회 실력 균등 배정 및 동점자 순위에 반영됩니다."
                      />

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 mb-1">테니스 등급(부수)</label>
                          <select
                            value={editMyGrade}
                            onChange={(e) => setEditMyGrade(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-amber-300 font-bold"
                          >
                            {GRADE_OPTIONS.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 mb-1">휴대폰 번호</label>
                          <input
                            type="tel"
                            value={editMyPhone}
                            onChange={(e) => setEditMyPhone(e.target.value)}
                            placeholder="010-0000-0000"
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            resetMyProfileFormFromUser(currentUser);
                            setIsEditingMyProfile(false);
                          }}
                          className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                        >
                          취소
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-xs shadow-md cursor-pointer"
                        >
                          💾 내 정보 수정 저장
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* 2. 내 코트 배정 & 실시간 게임 진행사항 / 스코어 (운영자 배정 연동) */}
                {(() => {
                  const myName = currentUser.name;
                  const myCourts = courts.filter(
                    (c) =>
                      c.teamA.some((m) => m.includes(myName)) ||
                      c.teamB.some((m) => m.includes(myName))
                  );
                  const myKdkMatches = kdkRounds.flatMap((r) =>
                    r.matches
                      .filter((m) => m.teamA.includes(myName) || m.teamB.includes(myName))
                      .map((m) => ({ ...m, roundName: r.name }))
                  );
                  const myStanding = kdkStandings.find((s) => s.name === myName);

                  return (
                    <>
                      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                          <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                            <span>🏟️</span> 내 코트 배정 & 실시간 게임 진행사항
                          </span>
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            {myCourts.length > 0 ? `${myCourts.length}개 코트 배정됨` : '전체 코트 보기 가능'}
                          </span>
                        </div>

                        {myCourts.length === 0 ? (
                          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                            <span>현재 코트에 직접 배정된 경기가 없습니다.</span>
                            <button
                              type="button"
                              onClick={() => setActiveTab('courts')}
                              className="text-[11px] font-bold text-amber-300 underline cursor-pointer"
                            >
                              코트현황 보기 ➔
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {myCourts.map((mc) => {
                              const inTeamA = mc.teamA.some((m) => m.includes(myName));
                              return (
                                <div
                                  key={mc.id}
                                  className="bg-slate-950 p-3 rounded-xl border border-emerald-500/40 space-y-1.5 text-xs"
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[11px]">
                                      {mc.courtNumber}번 코트 ({inTeamA ? 'TEAM A' : 'TEAM B'})
                                    </span>
                                    <span className="text-[10px] font-extrabold text-emerald-300">
                                      {mc.status === 'playing'
                                        ? '🔴 LIVE 경기 진행중'
                                        : mc.status === 'completed'
                                        ? '🏁 경기 완료'
                                        : '⚪ 경기 대기중'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center pt-1">
                                    <span className={`font-bold truncate flex-1 ${inTeamA ? 'text-amber-300' : 'text-slate-200'}`}>
                                      {mc.teamA.join(' / ')}
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 border border-slate-700 font-black text-sm text-white mx-2">
                                      {mc.scoreA} : {mc.scoreB}
                                    </span>
                                    <span className={`font-bold truncate flex-1 text-right ${!inTeamA ? 'text-amber-300' : 'text-slate-200'}`}>
                                      {mc.teamB.join(' / ')}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {myKdkMatches.length > 0 && (
                          <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                            <span className="text-[11px] font-bold text-slate-400 block">
                              🔄 내 라운드별 대진 & 스코어 기록 ({myKdkMatches.length}경기)
                            </span>
                            {myKdkMatches.map((m, idx) => (
                              <div
                                key={idx}
                                className="bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 flex justify-between items-center text-[11px]"
                              >
                                <span className="text-amber-400 font-bold shrink-0">
                                  {m.court}코트
                                </span>
                                <span className="text-slate-200 font-bold truncate mx-2">
                                  {m.teamA} vs {m.teamB}
                                </span>
                                <span className="font-black text-emerald-300 shrink-0">
                                  {m.scoreA} : {m.scoreB} ({m.completed ? '완료' : '진행'})
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 3. 전 대회 종합 개인 누적 성적 & 승률 집계 */}
                      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                          <div>
                            <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                              <span>📊</span> 전 대회 종합 개인 누적 성적 & 승률 집계
                            </span>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              참가한 모든 공식 대회(총 {currentUserCumulative?.totalTournaments || 0}개 대회)의 경기 결과가 누적으로 자동 합산되었습니다.
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] text-slate-400 block">누적 승률</span>
                            <span className="text-sm font-black text-amber-400">
                              {currentUserCumulative?.winRateStr || '0.0'}%
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-extrabold">
                            <span className="text-slate-400">누적 승률 달성도</span>
                            <span className="text-emerald-300">
                              {currentUserCumulative?.winRateStr || '0.0'}% ({currentUserCumulative?.totalWins || 0}승 {currentUserCumulative?.totalLosses || 0}패)
                            </span>
                          </div>
                          <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800">
                            <div
                              className="bg-gradient-to-r from-amber-400 via-orange-500 to-emerald-400 h-3 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(0, currentUserCumulative?.winRate || 0))}%` }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2 pt-1 text-center text-xs">
                          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                            <p className="text-[10px] text-slate-400">총 출전 경기</p>
                            <p className="text-base font-black text-white">
                              {currentUserCumulative?.totalMatches || 0}전
                            </p>
                          </div>
                          <div className="bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/20">
                            <p className="text-[10px] text-emerald-400 font-bold">누적 승리</p>
                            <p className="text-base font-black text-emerald-300">
                              {currentUserCumulative?.totalWins || 0}승
                            </p>
                          </div>
                          <div className="bg-red-950/40 p-2.5 rounded-xl border border-red-500/20">
                            <p className="text-[10px] text-red-400 font-bold">누적 패배</p>
                            <p className="text-base font-black text-red-300">
                              {currentUserCumulative?.totalLosses || 0}패
                            </p>
                          </div>
                          <div className="bg-amber-950/40 p-2.5 rounded-xl border border-amber-500/20">
                            <p className="text-[10px] text-amber-400 font-bold">누적 득실차</p>
                            <p className="text-base font-black text-amber-300">
                              {(currentUserCumulative?.totalPtsDiff || 0) >= 0
                                ? `+${currentUserCumulative?.totalPtsDiff || 0}`
                                : currentUserCumulative?.totalPtsDiff || 0}점
                            </p>
                          </div>
                        </div>

                        {/* 상세 히스토리 아코디언 토글 버튼 */}
                        <button
                          type="button"
                          aria-expanded={showMyHistoryAccordion}
                          onClick={() => setShowMyHistoryAccordion((prev) => !prev)}
                          className="w-full mt-1 py-2.5 px-3.5 rounded-xl bg-slate-950/90 hover:bg-slate-800/90 border border-slate-700/80 hover:border-amber-400/40 text-amber-300 font-bold text-xs transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <span>
                            {showMyHistoryAccordion
                              ? '📜 상세 히스토리 접기 ▲'
                              : '📜 상세 히스토리 보기 ▼'}
                          </span>
                        </button>
                      </div>

                      {/* 4. 대회별 참가 성적 & 승률 반영 히스토리 (아코디언 · 기본 숨김) */}
                      <div
                        aria-hidden={!showMyHistoryAccordion}
                        className={`grid transition-all duration-300 ease-in-out ${
                          showMyHistoryAccordion
                            ? 'grid-rows-[1fr] opacity-100'
                            : 'grid-rows-[0fr] opacity-0 !mt-0 pointer-events-none'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
                            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                              <div>
                                <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                                  <span>📜</span> 대회별 참가 성적 & 승률 반영 히스토리
                                </span>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  각 대회별 본인 경기 성적과 총 누적 승률 합산 내역입니다.
                                </p>
                              </div>
                              <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 shrink-0">
                                총 {tournamentHistory.length}개 대회 (참가 {currentUserCumulative?.totalTournaments || 0}개)
                              </span>
                            </div>

                            <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                              {currentUserCumulative?.historyBreakdown.map((item) => {
                                const isCur = currentTournament.id === item.tourId;
                                return (
                                  <div
                                    key={item.tourId}
                                    className={`p-3 rounded-xl border text-xs space-y-2 transition ${
                                      isCur
                                        ? 'bg-amber-950/30 border-amber-500/40 shadow-sm'
                                        : 'bg-slate-950 border-slate-800'
                                    }`}
                                  >
                                    <div className="flex justify-between items-center gap-2">
                                      <div className="flex items-center gap-1.5 truncate">
                                        <span
                                          className={`text-[9px] px-1.5 py-0.5 rounded font-black shrink-0 ${
                                            item.status === 'completed'
                                              ? 'bg-slate-800 text-slate-300'
                                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                          }`}
                                        >
                                          {item.status === 'completed' ? '🏁 종료' : '🔴 진행중'}
                                        </span>
                                        <span className="font-black text-white truncate">{item.tourName}</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const targetTour = tournamentHistory.find((t) => t.id === item.tourId);
                                          if (targetTour) {
                                            setCurrentTournament(targetTour);
                                            setActiveTab(targetTour.format === 'kdk' ? 'kdk' : 'tournament');
                                          }
                                        }}
                                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[10px] shrink-0 cursor-pointer"
                                      >
                                        대진·기록 ➔
                                      </button>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-slate-400 flex-wrap gap-1">
                                      <span>
                                        📅 {item.date} · {item.format === 'kdk' ? 'KDK 순환' : '예선/본선 토너먼트'}
                                      </span>
                                      {item.hasPlayed ? (
                                        <span className="text-emerald-300 font-bold bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30">
                                          대회 성적: {item.matches}전 {item.wins}승 {item.losses}패 ({item.ptsDiff >= 0 ? `+${item.ptsDiff}` : item.ptsDiff} · {item.rankOrNote} · 승률 {item.winRateStr}%)
                                        </span>
                                      ) : (
                                        <span className="text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                          대회 미출전
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/20 text-[11px] text-slate-300">
                              ✓ 위 {currentUserCumulative?.totalTournaments || 0}개 참가 대회의 모든 경기({currentUserCumulative?.totalMatches || 0}전 {currentUserCumulative?.totalWins || 0}승 {currentUserCumulative?.totalLosses || 0}패)가 합산되어 누적 승률({currentUserCumulative?.winRateStr || '0.0'}%)에 즉시 반영됩니다.
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 5. 썬 클럽 회원 전체 누적 승률 랭킹 TOP 5 */}
                      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                          <div>
                            <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                              <span>🏆</span> 썬 클럽 회원 전체 누적 승률 랭킹 (TOP 5)
                            </span>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              전체 회원의 전 대회 누적 성적에 따른 실시간 공식 랭킹 순위표입니다.
                            </p>
                          </div>
                          <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            내 순위: {currentUserRank}위
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead>
                              <tr className="border-b border-slate-800 text-slate-400 text-[10px]">
                                <th className="py-2 px-1 text-center">순위</th>
                                <th className="py-2 px-1.5">선수명 (부수)</th>
                                <th className="py-2 px-1 text-center">참가</th>
                                <th className="py-2 px-1 text-center">전적</th>
                                <th className="py-2 px-1 text-center">누적 승률</th>
                                <th className="py-2 px-1 text-right">득실</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                              {clubCumulativeLeaderboard.slice(0, 5).map((player) => {
                                const isMe = player.name === currentUser.name;
                                const medal =
                                  player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : player.rank === 3 ? '🥉' : `${player.rank}위`;
                                return (
                                  <tr
                                    key={player.name}
                                    className={`transition ${
                                      isMe
                                        ? 'bg-amber-950/40 text-amber-200 font-bold border-l-2 border-amber-400'
                                        : 'hover:bg-slate-800/40'
                                    }`}
                                  >
                                    <td className="py-2.5 px-1 text-center font-black">{medal}</td>
                                    <td className="py-2.5 px-1.5">
                                      <div className="flex items-center gap-1">
                                        <span className={isMe ? 'text-amber-300 font-black' : 'text-white'}>
                                          {player.name}
                                        </span>
                                        <span className="text-[10px] text-slate-400">({player.grade})</span>
                                        {isMe && (
                                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-400 text-slate-950 font-black">
                                            MY
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-1 text-center text-slate-400 text-[11px]">
                                      {player.totalTournaments}개
                                    </td>
                                    <td className="py-2.5 px-1 text-center text-slate-300 font-mono text-[11px]">
                                      {player.totalWins}승 {player.totalLosses}패
                                    </td>
                                    <td className="py-2.5 px-1 text-center">
                                      <span className="font-black text-emerald-300">{player.winRateStr}%</span>
                                    </td>
                                    <td className="py-2.5 px-1 text-right font-mono font-bold text-amber-300">
                                      {player.totalPtsDiff >= 0 ? `+${player.totalPtsDiff}` : player.totalPtsDiff}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-[10px] text-slate-500 pt-0.5">
                          ※ 모든 공식 대회(조별 풀리그, 본선 토너먼트, KDK) 결과가 실시간 누적 합산 반영됩니다.
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* [탭 5]: 운영자 관리 센터 (관리자 로그인 시에만 표시 · 항목 클릭 시 펼쳐서 수정) */}
            {/* ---------------------------------------------------- */}
            {isAdmin && activeTab === 'admin' && (
              <div className="space-y-3">
                {/* 0. 생성된 대회 & 종료된 대회 목록 관리 (접기/펼치기 + 항목 클릭 시 펼쳐서 수정/종료/삭제) */}
                <div className="bg-slate-900 border border-amber-500/35 rounded-2xl p-3.5 shadow-xl space-y-3">
                  <div className="flex justify-between items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenAdminTourSection((prev) => !prev)}
                      className="flex-1 text-left cursor-pointer"
                    >
                      <h3 className="text-sm font-black text-amber-300 flex items-center gap-1.5 flex-wrap">
                        <span>🏆</span> 생성된 대회 & 종료된 대회 관리
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950 text-amber-300 border border-amber-500/30 font-black">
                          {tournamentHistory.length}개
                        </span>
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        항목을 눌러 펼친 뒤, 각 대회를 클릭하면 대회명·방식·날짜 수정 및 종료/삭제가 가능합니다.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenAdminTourSection((prev) => !prev)}
                      className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-amber-300 shrink-0 cursor-pointer"
                    >
                      {openAdminTourSection ? '접기 ▲' : '펼치기 ▼'}
                    </button>
                  </div>

                  {openAdminTourSection && (
                    <div className="space-y-3 pt-2.5 border-t border-slate-800">
                      <div className="flex flex-wrap justify-between items-center gap-1.5">
                        {/* 상태 필터 탭 */}
                        <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px] font-bold flex-1">
                          <button
                            type="button"
                            onClick={() => setAdminTourFilter('all')}
                            className={`py-1.5 px-2 rounded-lg cursor-pointer transition ${
                              adminTourFilter === 'all'
                                ? 'bg-amber-400 text-slate-950 font-black'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            전체 ({tournamentHistory.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdminTourFilter('in_progress')}
                            className={`py-1.5 px-2 rounded-lg cursor-pointer transition ${
                              adminTourFilter === 'in_progress'
                                ? 'bg-emerald-500 text-slate-950 font-black'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            🔴 진행중 ({tournamentHistory.filter((t) => t.status !== 'completed').length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdminTourFilter('completed')}
                            className={`py-1.5 px-2 rounded-lg cursor-pointer transition ${
                              adminTourFilter === 'completed'
                                ? 'bg-slate-600 text-white font-black'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            🏁 종료됨 ({tournamentHistory.filter((t) => t.status === 'completed').length})
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setShowNewTourModal(true)}
                            className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-[10px] cursor-pointer"
                          >
                            + 새 대회
                          </button>
                          {tournamentHistory.some((t) => t.status === 'completed') && (
                            <button
                              type="button"
                              onClick={handleDeleteCompletedTournaments}
                              className="px-2 py-1.5 bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-500/40 font-bold rounded-xl text-[10px] cursor-pointer"
                            >
                              🗑️ 종료 일괄삭제
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 대회 목록 (각 대회 항목도 기본 접힘 ➔ 클릭 시 펼쳐서 수정/종료/삭제) */}
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
                        {tournamentHistory.filter((t) =>
                          adminTourFilter === 'all'
                            ? true
                            : adminTourFilter === 'completed'
                            ? t.status === 'completed'
                            : t.status !== 'completed'
                        ).length === 0 ? (
                          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center text-xs text-slate-400">
                            해당 조건의 대회가 없습니다.
                          </div>
                        ) : (
                          tournamentHistory
                            .filter((t) =>
                              adminTourFilter === 'all'
                                ? true
                                : adminTourFilter === 'completed'
                                ? t.status === 'completed'
                                : t.status !== 'completed'
                            )
                            .map((t) => {
                              const isCurrent = currentTournament.id === t.id;
                              const isCompleted = t.status === 'completed';
                              const isExpanded = Boolean(expandedAdminTourIds[t.id]);
                              return (
                                <div
                                  key={t.id}
                                  className={`p-2.5 rounded-xl border space-y-2 text-xs transition ${
                                    isCurrent
                                      ? 'bg-amber-950/30 border-amber-500/50'
                                      : 'bg-slate-950 border-slate-800'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandAdminTour(t.id)}
                                    className="w-full flex justify-between items-center gap-2 text-left cursor-pointer"
                                  >
                                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                      <span
                                        className={`text-[9px] px-1.5 py-0.5 rounded font-black shrink-0 ${
                                          isCompleted
                                            ? 'bg-slate-800 text-slate-300 border border-slate-700'
                                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                        }`}
                                      >
                                        {isCompleted ? '🏁 종료됨' : '🔴 진행중'}
                                      </span>
                                      {isCurrent && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black shrink-0">
                                          현재 선택
                                        </span>
                                      )}
                                      <span className="font-black text-white truncate">{t.name}</span>
                                    </div>
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 shrink-0">
                                      {isExpanded ? '접기 ▲' : '수정 ▼'}
                                    </span>
                                  </button>

                                  {isExpanded && (
                                    <div className="space-y-2 pt-2 border-t border-slate-800/90">
                                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5">
                                        <input
                                          type="text"
                                          value={t.name}
                                          onChange={(e) =>
                                            handleUpdateTournamentField(t.id, 'name', e.target.value)
                                          }
                                          placeholder="대회명 수정"
                                          className="sm:col-span-6 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-bold"
                                        />
                                        <input
                                          type="date"
                                          value={t.date}
                                          onChange={(e) =>
                                            handleUpdateTournamentField(t.id, 'date', e.target.value)
                                          }
                                          className="sm:col-span-3 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-[11px] text-amber-300 font-mono"
                                        />
                                        <select
                                          value={t.format}
                                          onChange={(e) =>
                                            handleUpdateTournamentField(
                                              t.id,
                                              'format',
                                              e.target.value as 'kdk' | 'tournament'
                                            )
                                          }
                                          className="sm:col-span-3 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-[11px] text-emerald-300 font-bold"
                                        >
                                          <option value="kdk">KDK 순환</option>
                                          <option value="tournament">토너먼트</option>
                                        </select>
                                      </div>

                                      <div className="flex gap-1.5">
                                        {!isCurrent && (
                                          <button
                                            type="button"
                                            onClick={() => setCurrentTournament(t)}
                                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[11px] cursor-pointer"
                                          >
                                            보기 선택
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => handleToggleTournamentStatus(t.id)}
                                          className="flex-1 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-[11px] cursor-pointer"
                                        >
                                          {isCompleted ? '🔄 진행중으로 복원' : '🏁 대회 종료 처리'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteTournament(t.id)}
                                          className="px-3 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-500/40 font-black text-[11px] cursor-pointer"
                                        >
                                          🗑️ 삭제
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 0-B. KDK 코트별 참가인원 · 1인 필수 게임수 · 시드/자동/수동 설정 관리 (운영자 관리 센터로 이관) */}
                <KdkCourtOperations
                  tournamentName={`${currentTournament.name} (${currentTournament.date})`}
                  availablePlayers={approvedPlayers}
                  isAdmin={isAdmin}
                  viewMode="ADMIN_CONFIG"
                  onNavigateToTab={setActiveTab}
                  onSyncCourtsToApp={(syncedCourts) => {
                    setCourts(syncedCourts);
                  }}
                  onAddNewPlayerToClub={(newPlayer) => {
                    setRegisteredPlayers((prev) => {
                      if (prev.some((p) => p.id === newPlayer.id)) return prev;
                      return [
                        ...prev,
                        {
                          id: newPlayer.id,
                          name: newPlayer.name,
                          grade: newPlayer.grade,
                          gender: newPlayer.gender === 'F' || newPlayer.gender === '여' ? 'F' : 'M',
                          birthDate: newPlayer.birthDate,
                          age: resolvePlayerAge(newPlayer, 45),
                          experienceYears: newPlayer.experienceYears,
                          role: 'member',
                          isGuest: true,
                        },
                      ];
                    });
                  }}
                />

                {/* 1. 회원가입 승인 · 정보 수정 & 회원가입 취소(탈퇴) 관리 컴포넌트 */}
                <AdminUserManagement
                  externalUsers={registeredPlayers}
                  currentUserId={currentUser?.id}
                  onApproveMember={(approved: ManagedMember) => {
                    setRegisteredPlayers((prev) =>
                      prev.map((p) =>
                        p.id === approved.id ? { ...p, approvalStatus: 'approved' } : p
                      )
                    );
                    if (!participantsInput.includes(approved.name)) {
                      setParticipantsInput((prev) => `${approved.name}, ${prev}`);
                    }
                  }}
                  onRejectMember={(rejectedId: string) => {
                    setRegisteredPlayers((prev) => prev.filter((p) => p.id !== rejectedId));
                  }}
                  onUpdateMember={(updated: ManagedMember) => {
                    const updatedAge =
                      calculateKoreanManAge(updated.birthDate) ?? updated.age;
                    setRegisteredPlayers((prev) =>
                      prev.map((p) =>
                        p.id === updated.id
                          ? {
                              ...p,
                              username: updated.username ?? p.username,
                              password:
                                updated.password !== undefined ? updated.password : p.password,
                              name: updated.name,
                              email: updated.email,
                              phone: updated.phone,
                              birthDate: updated.birthDate ?? p.birthDate,
                              age: updatedAge ?? p.age,
                              gender: updated.gender === 'F' || updated.gender === '여' ? 'F' : 'M',
                              grade: updated.grade,
                              role: updated.role,
                            }
                          : p
                      )
                    );
                    if (currentUser && currentUser.id === updated.id) {
                      const nextCurrentUser: RegisteredPlayer = {
                        ...currentUser,
                        username: updated.username ?? currentUser.username,
                        password:
                          updated.password !== undefined
                            ? updated.password
                            : currentUser.password,
                        name: updated.name,
                        email: updated.email,
                        phone: updated.phone,
                        birthDate: updated.birthDate ?? currentUser.birthDate,
                        age: updatedAge ?? currentUser.age,
                        gender: updated.gender === 'F' || updated.gender === '여' ? 'F' : 'M',
                        grade: updated.grade,
                        role: updated.role,
                      };
                      setCurrentUser(nextCurrentUser);
                    }
                  }}
                  onCancelMembership={(cancelledId: string, cancelledName: string) => {
                    setRegisteredPlayers((prev) => prev.filter((p) => p.id !== cancelledId));
                    setParticipantsInput((prev) =>
                      prev
                        .split(',')
                        .map((n) => n.trim())
                        .filter((n) => n.length > 0 && n !== cancelledName)
                        .join(', ')
                    );
                    if (currentUser && currentUser.id === cancelledId) {
                      handleLogout();
                    }
                  }}
                  onAddMember={(newMember: ManagedMember) => {
                    const added: RegisteredPlayer = {
                      id: newMember.id,
                      username: newMember.username,
                      password: newMember.password,
                      name: newMember.name,
                      email: newMember.email,
                      phone: newMember.phone,
                      birthDate: newMember.birthDate,
                      age: calculateKoreanManAge(newMember.birthDate) ?? newMember.age,
                      gender: newMember.gender === 'F' || newMember.gender === '여' ? 'F' : 'M',
                      grade: newMember.grade,
                      role: newMember.role,
                      approvalStatus: 'approved',
                    };
                    setRegisteredPlayers((prev) => [added, ...prev]);
                    if (!participantsInput.includes(added.name)) {
                      setParticipantsInput((prev) => `${added.name}, ${prev}`);
                    }
                  }}
                />

                {/* 2. 관리자 대회 생성 & 코트/선수 배치 콘솔 */}
                <AdminTournamentManager
                  registeredUsers={approvedPlayers}
                  currentUser={currentUser}
                  activeTournament={null}
                  onApplyTournament={(config: TournamentConfig) => {
                    const autoDate = new Date().toISOString().split('T')[0];
                    const newTour: TournamentRecord = {
                      id: config.id || `tour-${Date.now()}`,
                      name: config.title,
                      date: autoDate,
                      format: config.mode === 'KDK' ? 'kdk' : 'tournament',
                      courtCount: config.selectedCourts.length || 3,
                      status: 'in_progress',
                    };
                    setTournamentHistory((prev) => {
      const next = [newTour, ...prev];
      persistTournamentHistory(next);
      return next;
    });
                    setCurrentTournament(newTour);

                    const mappedCourts: CourtMatch[] = config.matches.map((m, idx) => ({
                      id: idx + 1,
                      courtNumber: m.courtNumber,
                      status: m.status || 'playing',
                      teamA: [
                        `${m.teamA[0].name} (${m.teamA[0].grade})`,
                        `${m.teamA[1].name} (${m.teamA[1].grade})`,
                      ],
                      teamB: [
                        `${m.teamB[0].name} (${m.teamB[0].grade})`,
                        `${m.teamB[1].name} (${m.teamB[1].grade})`,
                      ],
                      scoreA: m.scoreA ?? 0,
                      scoreB: m.scoreB ?? 0,
                    }));
                    if (mappedCourts.length > 0) {
                      setCourts(mappedCourts);
                    }
                    setActiveTab('courts');
                    alert(
                      `🚀 [${config.title}] (${config.mode === 'KDK' ? 'KDK 방식' : '토너먼트 방식'}) 대회가 개설되어 실시간 코트(${config.matches.length}경기)와 대진표에 즉시 연동되었습니다!`
                    );
                  }}
                  onAddCustomUserToClub={(newGuest: ParticipantPlayer) => {
                    setRegisteredPlayers((prev) => [
                      ...prev,
                      {
                        id: newGuest.id,
                        name: newGuest.name,
                        grade: newGuest.grade,
                        gender: newGuest.gender === '여' ? 'F' : 'M',
                        birthDate: newGuest.birthDate,
                        age: resolvePlayerAge(newGuest, 46),
                        experienceYears: newGuest.experienceYears,
                        role: 'member',
                        isGuest: true,
                      },
                    ]);
                  }}
                />
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* [하단 5대 고정 네비게이션 탭바] */}
          {/* ======================================================== */}
          <nav className="fixed lg:absolute bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-2 py-2 flex justify-around items-center z-50 shadow-2xl">
            <button
              onClick={() => setActiveTab('courts')}
              className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
                activeTab === 'courts'
                  ? 'text-amber-400 font-bold scale-105 bg-amber-400/10'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <span className="text-base">🎾</span>
              <span className="text-[10px] mt-0.5">코트현황</span>
            </button>

            {currentTournament.format === 'kdk' && (
              <button
                onClick={() => setActiveTab('kdk')}
                className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
                  activeTab === 'kdk'
                    ? 'text-emerald-400 font-bold scale-105 bg-emerald-400/10'
                    : 'text-slate-400 hover:text-slate-200 font-medium'
                }`}
              >
                <span className="text-base">🔄</span>
                <span className="text-[10px] mt-0.5">KDK진행</span>
              </button>
            )}

            {currentTournament.format === 'tournament' && (
              <button
                onClick={() => setActiveTab('tournament')}
                className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
                  activeTab === 'tournament'
                    ? 'text-amber-400 font-bold scale-105 bg-amber-400/10'
                    : 'text-slate-400 hover:text-slate-200 font-medium'
                }`}
              >
                <span className="text-base">🏆</span>
                <span className="text-[10px] mt-0.5">토너먼트</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('mypage')}
              className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
                activeTab === 'mypage'
                  ? 'text-amber-400 font-bold scale-105 bg-amber-400/10'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <span className="text-base">👤</span>
              <span className="text-[10px] mt-0.5">마이페이지</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`relative flex flex-col items-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'admin'
                    ? 'text-red-400 font-bold scale-105 bg-red-400/10'
                    : 'text-slate-400 hover:text-slate-200 font-medium'
                }`}
              >
                {pendingApprovalCount > 0 && (
                  <span className="absolute -top-1 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center animate-bounce">
                    {pendingApprovalCount}
                  </span>
                )}
                <span className="text-base">⚙️</span>
                <span className="text-[10px] mt-0.5">운영관리</span>
              </button>
            )}
          </nav>
        </main>
      </div>

      {/* ======================================================== */}
      {/* [모달 1]: 새 대회 개설 모달 (참여선수 선택/임의등록 & 실력균형 자동/수동 배정) */}
      {/* ======================================================== */}
      {isAdmin && showNewTourModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-750 w-full max-w-lg rounded-3xl p-5 shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-amber-400 flex items-center gap-1.5">
                  <span>🏆</span> 새로운 대회 개설 & 참여선수/코트 배정
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  가입회원·미가입회원 선택 및 임의 선수 등록, KDK 실력차 제로 자동/수동 배정
                </p>
              </div>
              <button
                onClick={() => setShowNewTourModal(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTournament} className="space-y-3.5">
              {/* 1. 대회명 & 진행날짜 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    대회명 입력 <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: 2026 썬 테니스 12월 윈터 챔피언십"
                    value={newTourName}
                    onChange={(e) => setNewTourName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    진행 날짜 <span className="text-emerald-400 font-normal">(자동)</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newTourDate}
                    onChange={(e) => setNewTourDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                  />
                </div>
              </div>

              {/* 2. 대회 진행 방식 선택 */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  대회 진행 방식 선택 <span className="text-amber-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => setNewTourFormat('kdk')}
                    className={`p-3 rounded-2xl border cursor-pointer transition ${
                      newTourFormat === 'kdk'
                        ? 'bg-emerald-950/60 border-emerald-400 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs text-emerald-400">
                      <span>🔄</span>
                      <span>KDK 실력균형 순환 리그</span>
                    </div>
                    <p className="text-[10px] text-slate-300 mt-1 leading-snug">
                      경기 실력 차이가 없도록 팀 밸런스 자동/수동 배정
                    </p>
                  </div>

                  <div
                    onClick={() => setNewTourFormat('tournament')}
                    className={`p-3 rounded-2xl border cursor-pointer transition ${
                      newTourFormat === 'tournament'
                        ? 'bg-amber-950/60 border-amber-400 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs text-amber-400">
                      <span>🏆</span>
                      <span>예선/본선 토너먼트</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                      조별 풀리그 ➔ 4강/결승 녹아웃 토너먼트
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. 참여선수 선택 (가입회원 & 미가입회원) + 임의 선수 이름 직접 등록 */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <span>👥</span> 참여선수 선택 (가입회원 & 미가입회원)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                      참여 {newTourSelectedPlayerIds.length}명
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setNewTourSelectedPlayerIds(
                          newTourSelectedPlayerIds.length === registeredPlayers.length
                            ? []
                            : registeredPlayers.map((p) => p.id)
                        )
                      }
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 cursor-pointer"
                    >
                      {newTourSelectedPlayerIds.length === registeredPlayers.length ? '전체해제' : '전체선택'}
                    </button>
                  </div>
                </div>

                {/* 가입회원 / 미가입회원 선택 그리드 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-0.5">
                  {registeredPlayers.map((p) => {
                    const isSelected = newTourSelectedPlayerIds.includes(p.id);
                    const pt = getCompositeSkillScore(p);
                    const ageLabel = formatManAgeLabel(p.birthDate, p.age);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleNewTourPlayer(p.id)}
                        className={`p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-950/80 border-emerald-400 text-white'
                            : 'bg-slate-900/70 border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="truncate pr-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-bold truncate">{p.name}</span>
                            <span
                              className={`text-[8px] px-1 rounded ${
                                p.isGuest
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-emerald-500/20 text-emerald-300'
                              }`}
                            >
                              {p.isGuest ? '미가입' : '가입'}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-400 block">
                            {p.grade}{ageLabel ? `·${ageLabel}` : ''} (실력 {pt}점)
                          </span>
                        </div>
                        <span
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${
                            isSelected ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {isSelected ? '✓' : '+'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* 미가입 회원 / 임의 선수 이름 직접 등록 입력창 */}
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <label className="text-[11px] font-extrabold text-amber-300 block">
                    ✍️ 미가입 회원 또는 임의 선수 이름 직접 등록 (쉼표로 복수 입력 가능)
                  </label>
                  <div className="grid grid-cols-12 gap-1.5">
                    <input
                      type="text"
                      value={newTourCustomName}
                      onChange={(e) => setNewTourCustomName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNewTourCustomPlayer();
                        }
                      }}
                      placeholder="예: 홍길동 또는 홍길동, 이순신"
                      className="col-span-6 px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                    />
                    <select
                      value={newTourCustomGrade}
                      onChange={(e) => setNewTourCustomGrade(e.target.value)}
                      className="col-span-3 px-2 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-amber-300 font-bold"
                    >
                      {GRADE_OPTIONS.map((g) => (
                        <option key={g} value={g}>
                          {g}({GRADE_WEIGHTS[g] || 6}점)
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddNewTourCustomPlayer}
                      className="col-span-3 py-2 px-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl text-[11px] cursor-pointer"
                    >
                      + 선수 등록
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. 코트 및 선수 배정 방식 선택 (자동 vs 수동) */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  코트 및 선수 배정 방식 선택 <span className="text-amber-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTourAssignMode('AUTO')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      newTourAssignMode === 'AUTO'
                        ? 'bg-emerald-950/70 border-emerald-400 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="font-black text-xs text-emerald-300">⚖️ 자동 배정 (실력균형)</div>
                    <p className="text-[10px] text-slate-300 mt-0.5">
                      두 팀의 경기 실력 차이가 0이 되도록 자동 매칭
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTourAssignMode('MANUAL')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      newTourAssignMode === 'MANUAL'
                        ? 'bg-amber-950/70 border-amber-400 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="font-black text-xs text-amber-300">🖐️ 수동 배정 (직접배치)</div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      관리자가 코트별 출전 선수를 직접 선택/수정
                    </p>
                  </button>
                </div>
              </div>

              {/* 5. 초기 코트 수 설정 */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  초기 코트 수 설정 (관리자가 언제든 +, -로 조절 가능)
                </label>
                <div className="flex items-center gap-2 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setNewTourCourts((prev) => Math.max(1, prev - 1))}
                    disabled={newTourCourts <= 1}
                    className="w-7 h-7 rounded-lg bg-slate-850 hover:bg-slate-750 text-slate-200 font-black disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sm border border-slate-700 cursor-pointer"
                  >
                    －
                  </button>
                  <input
                    type="range"
                    min={1}
                    max={12}
                    value={newTourCourts}
                    onChange={(e) => setNewTourCourts(Number(e.target.value))}
                    className="flex-1 accent-amber-400 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setNewTourCourts((prev) => Math.min(12, prev + 1))}
                    disabled={newTourCourts >= 12}
                    className="w-7 h-7 rounded-lg bg-slate-850 hover:bg-slate-750 text-slate-200 font-black disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sm border border-slate-700 cursor-pointer"
                  >
                    ＋
                  </button>
                  <span className="text-xs font-black text-amber-300 w-16 text-center bg-slate-900 p-1.5 rounded-lg border border-slate-750">
                    {newTourCourts}개 코트
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewTourModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-xs transition shadow-lg shadow-amber-500/20"
                >
                  대회 개설 및 앱 자동 연동 ➔
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* [모달 2]: 코트 선수 수동 배정 및 직접 수정 모달 */}
      {/* ======================================================== */}
      {isAdmin && courtEditTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-amber-400 flex items-center gap-1.5">
                  <span>👤</span> {courtEditTarget.courtNumber}번 코트 선수 수동 배정 및 수정
                </h3>
                <p className="text-[10px] text-slate-400">등록된 공식 선수를 선택하거나 이름을 직접 수정할 수 있습니다.</p>
              </div>
              <button
                onClick={() => setCourtEditTarget(null)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              {/* TEAM A 배정 */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-amber-500/30 space-y-2">
                <span className="text-[11px] font-black text-amber-400 block">TEAM A 선수 구성</span>
                
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">선수 1 (드롭다운 선택 또는 직접 수정)</label>
                  <div className="flex gap-1.5">
                    <select
                      onChange={(e) => {
                        if (e.target.value) setManualPlayerA1(e.target.value);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-300 w-28"
                    >
                      <option value="">등록선수</option>
                      {registeredPlayers.map((p) => (
                        <option key={p.id} value={`${p.name} (${p.grade})`}>
                          {p.name} ({p.grade})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={manualPlayerA1}
                      onChange={(e) => setManualPlayerA1(e.target.value)}
                      placeholder="김철수 (금배)"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">선수 2</label>
                  <div className="flex gap-1.5">
                    <select
                      onChange={(e) => {
                        if (e.target.value) setManualPlayerA2(e.target.value);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-300 w-28"
                    >
                      <option value="">등록선수</option>
                      {registeredPlayers.map((p) => (
                        <option key={p.id} value={`${p.name} (${p.grade})`}>
                          {p.name} ({p.grade})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={manualPlayerA2}
                      onChange={(e) => setManualPlayerA2(e.target.value)}
                      placeholder="강동원 (금배)"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* TEAM B 배정 */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-emerald-500/30 space-y-2">
                <span className="text-[11px] font-black text-emerald-400 block">TEAM B 선수 구성</span>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">선수 1</label>
                  <div className="flex gap-1.5">
                    <select
                      onChange={(e) => {
                        if (e.target.value) setManualPlayerB1(e.target.value);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-300 w-28"
                    >
                      <option value="">등록선수</option>
                      {registeredPlayers.map((p) => (
                        <option key={p.id} value={`${p.name} (${p.grade})`}>
                          {p.name} ({p.grade})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={manualPlayerB1}
                      onChange={(e) => setManualPlayerB1(e.target.value)}
                      placeholder="박민수 (은배)"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">선수 2</label>
                  <div className="flex gap-1.5">
                    <select
                      onChange={(e) => {
                        if (e.target.value) setManualPlayerB2(e.target.value);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-300 w-28"
                    >
                      <option value="">등록선수</option>
                      {registeredPlayers.map((p) => (
                        <option key={p.id} value={`${p.name} (${p.grade})`}>
                          {p.name} ({p.grade})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={manualPlayerB2}
                      onChange={(e) => setManualPlayerB2(e.target.value)}
                      placeholder="정지훈 (동배)"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setCourtEditTarget(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
              >
                닫기
              </button>
              <button
                onClick={saveCourtPlayerAssignment}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-xs transition shadow-lg shadow-amber-500/20"
              >
                배정 저장 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* [모달 3]: 실시간 점수 수정 모달 */}
      {/* ======================================================== */}
      {isAdmin && selectedCourt && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-amber-400 flex items-center gap-1.5">
                <span>🎾</span> {selectedCourt.courtNumber}번 코트 점수 실시간 조절
              </h3>
              <button
                onClick={() => setSelectedCourt(null)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center space-y-2">
                <span className="text-[11px] font-black text-amber-400 block">TEAM A</span>
                <span className="text-3xl font-black text-white block">{inputScoreA}</span>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => setInputScoreA((prev) => Math.max(0, Number(prev) - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-base"
                  >
                    -
                  </button>
                  <button
                    onClick={() => setInputScoreA((prev) => Number(prev) + 1)}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-base"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center space-y-2">
                <span className="text-[11px] font-black text-emerald-400 block">TEAM B</span>
                <span className="text-3xl font-black text-white block">{inputScoreB}</span>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => setInputScoreB((prev) => Math.max(0, Number(prev) - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-base"
                  >
                    -
                  </button>
                  <button
                    onClick={() => setInputScoreB((prev) => Number(prev) + 1)}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-base"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 block">경기 상태</label>
              <select
                value={inputStatus}
                onChange={(e) => setInputStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white focus:outline-none"
              >
                <option value="playing">🔴 경기 진행 중</option>
                <option value="completed">🏁 경기 완료</option>
                <option value="waiting">⚪ 대기 중</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSelectedCourt(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
              >
                닫기
              </button>
              <button
                onClick={saveCourtScore}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-xs transition shadow-lg shadow-amber-500/20"
              >
                저장 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 백버튼 뒤로가기 안내 토스트 & 2회 연속 입력 앱 종료 확인 모달 */}
      <AppBackExitOverlay
        backToastMessage={backToastMessage}
        showExitConfirmModal={showExitConfirmModal}
        onCancelExit={cancelExitApp}
        onConfirmExit={confirmExitApp}
      />
    </div>
  );
}
