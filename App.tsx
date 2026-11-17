'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  scoreA: number;
  scoreB: number;
}

export interface RegisteredPlayer {
  id: string;
  name: string;
  email?: string;
  grade: string;
  gender: 'M' | 'F';
  role: 'member' | 'admin';
  phone?: string;
}

const GRADE_OPTIONS = ['금배', '은배', '동배', '국화', '개나리', '테린이', '고령자부'];

export default function TennisApp() {
  // ----------------------------------------------------
  // 0. 로그인 / 회원가입 인증 상태
  // ----------------------------------------------------
  const [currentUser, setCurrentUser] = useState<RegisteredPlayer | null>(null);
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authMessage, setAuthMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [signUpName, setSignUpName] = useState<string>('');
  const [signUpGender, setSignUpGender] = useState<'M' | 'F'>('M');
  const [signUpGrade, setSignUpGrade] = useState<string>('테린이');
  const [signUpPhone, setSignUpPhone] = useState<string>('');

  // 메인 네비게이션 탭: 'courts' | 'kdk' | 'tournament' | 'mypage' | 'admin'
  const [activeTab, setActiveTab] = useState<'courts' | 'kdk' | 'tournament' | 'mypage' | 'admin'>('courts');
  const [role, setRole] = useState<'member' | 'admin'>('admin'); // 기본 관리자 권한으로 설정하여 코트/대회 기능 바로 활용 가능

  // ----------------------------------------------------
  // 1. 등록된 공식 선수(회원) 명부 풀
  // ----------------------------------------------------
  const [registeredPlayers, setRegisteredPlayers] = useState<RegisteredPlayer[]>([
    { id: 'p1', name: '김철수', grade: '금배', gender: 'M', role: 'member' },
    { id: 'p2', name: '강동원', grade: '금배', gender: 'M', role: 'member' },
    { id: 'p3', name: '박민수', grade: '은배', gender: 'M', role: 'member' },
    { id: 'p4', name: '정지훈', grade: '동배', gender: 'M', role: 'member' },
    { id: 'p5', name: '이영희', grade: '국화', gender: 'F', role: 'member' },
    { id: 'p6', name: '한지민', grade: '은배', gender: 'F', role: 'member' },
    { id: 'p7', name: '최수진', grade: '개나리', gender: 'F', role: 'member' },
    { id: 'p8', name: '송중기', grade: '동배', gender: 'M', role: 'member' },
    { id: 'p9', name: '조인성', grade: '은배', gender: 'M', role: 'member' },
    { id: 'p10', name: '공유', grade: '금배', gender: 'M', role: 'admin' },
    { id: 'p11', name: '김태희', grade: '테린이', gender: 'F', role: 'member' },
    { id: 'p12', name: '정우성', grade: '은배', gender: 'M', role: 'member' },
    { id: 'p13', name: '전지현', grade: '국화', gender: 'F', role: 'member' },
    { id: 'p14', name: '현빈', grade: '동배', gender: 'M', role: 'member' },
  ]);

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
  const [currentTournament, setCurrentTournament] = useState<TournamentRecord>(tournamentHistory[0]);

  // 새 대회 개설 모달 상태
  const [showNewTourModal, setShowNewTourModal] = useState<boolean>(false);
  const [newTourName, setNewTourName] = useState<string>('');
  // 대회명 생성 시 진행날짜 자동 생성 (오늘 날짜 YYYY-MM-DD)
  const [newTourDate, setNewTourDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [newTourFormat, setNewTourFormat] = useState<'kdk' | 'tournament'>('kdk');
  const [newTourCourts, setNewTourCourts] = useState<number>(3);

  // 새 대회 개설 처리
  const handleCreateTournament = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTourName.trim()) {
      alert('대회명을 입력해 주세요.');
      return;
    }

    // 오늘 날짜가 없을 경우 자동 보정
    const autoDate = newTourDate.trim() || new Date().toISOString().split('T')[0];

    const newTour: TournamentRecord = {
      id: `tour-${Date.now()}`,
      name: newTourName.trim(),
      date: autoDate, // 진행날짜 자동 기록
      format: newTourFormat,
      courtCount: newTourCourts,
      status: 'in_progress',
    };

    // 대회 히스토리에 자동 추가 (기록 관리)
    setTournamentHistory((prev) => [newTour, ...prev]);
    setCurrentTournament(newTour);

    // 사용자가 지정한 코트 수에 맞게 코트 동적 생성!
    const generated: CourtMatch[] = [];
    for (let i = 1; i <= newTourCourts; i++) {
      generated.push({
        id: i,
        courtNumber: i,
        status: 'playing',
        teamA: ['선수 배정 필요', '선수 배정 필요'],
        teamB: ['선수 배정 필요', '선수 배정 필요'],
        scoreA: 0,
        scoreB: 0,
      });
    }
    setCourts(generated);

    // 모달 닫기 및 폼 초기화
    setShowNewTourModal(false);
    setNewTourName('');

    // 선택한 대회 방식 화면으로 자동 이동
    if (newTourFormat === 'kdk') {
      setActiveTab('kdk');
    } else {
      setActiveTab('tournament');
    }

    alert(
      `🎉 [${newTour.name}] 대회가 성공적으로 개설되었습니다!\n` +
      `📅 진행 날짜: ${newTour.date} (자동 기록됨)\n` +
      `⚙️ 진행 방식: ${newTour.format === 'kdk' ? 'KDK 파트너 순환 리그' : '예선 조별리그 & 본선 토너먼트'}\n` +
      `🏟️ 생성된 코트: 총 ${newTourCourts}개 코트`
    );
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
  // 4-1. 등록 선수 자동 배정 (스마트 밸런싱)
  const handleAutoAssignPlayers = () => {
    const shuffled = [...registeredPlayers].sort(() => Math.random() - 0.5);
    let pIdx = 0;

    setCourts((prev) =>
      prev.map((court) => {
        const p1 = shuffled[pIdx % shuffled.length];
        const p2 = shuffled[(pIdx + 1) % shuffled.length];
        const p3 = shuffled[(pIdx + 2) % shuffled.length];
        const p4 = shuffled[(pIdx + 3) % shuffled.length];
        pIdx += 4;

        return {
          ...court,
          status: 'playing',
          teamA: [`${p1.name} (${p1.grade})`, `${p2.name} (${p2.grade})`],
          teamB: [`${p3.name} (${p3.grade})`, `${p4.name} (${p4.grade})`],
        };
      })
    );

    alert(
      `🎲 등록된 공식 선수 ${registeredPlayers.length}명 중에서 총 ${courts.length}개 코트에 선수가 자동으로 균형 배정되었습니다!`
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

  // 초기 로컬 스토리지 가입 회원 불러오기
  useEffect(() => {
    try {
      const savedUsersRaw = localStorage.getItem('sun_tennis_registered_users');
      if (savedUsersRaw) {
        const savedUsers: RegisteredPlayer[] = JSON.parse(savedUsersRaw);
        if (Array.isArray(savedUsers) && savedUsers.length > 0) {
          setRegisteredPlayers((prev) => {
            const existingIds = new Set(prev.map((u) => u.id));
            const merged = [...prev];
            savedUsers.forEach((su) => {
              if (!existingIds.has(su.id)) merged.unshift(su);
            });
            return merged;
          });
        }
      }
    } catch {}
  }, []);

  // 로그인 & 회원가입 제출 핸들러
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMessage(null);

    if (isSignUp) {
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

      setAuthLoading(true);
      try {
        const newPlayer: RegisteredPlayer = {
          id: `p_${Date.now()}`,
          name: signUpName.trim(),
          email: email.trim(),
          grade: signUpGrade,
          gender: signUpGender,
          role: 'member',
          phone: signUpPhone.trim(),
        };

        setRegisteredPlayers((prev) => [newPlayer, ...prev.filter((p) => p.email !== newPlayer.email)]);
        try {
          const prevSaved = JSON.parse(localStorage.getItem('sun_tennis_registered_users') || '[]');
          const updatedSaved = [
            { ...newPlayer, password },
            ...prevSaved.filter((u: any) => u.email !== newPlayer.email),
          ];
          localStorage.setItem('sun_tennis_registered_users', JSON.stringify(updatedSaved));
          localStorage.setItem('sun_tennis_current_user', JSON.stringify(newPlayer));
        } catch {}

        if (!participantsInput.includes(newPlayer.name)) {
          setParticipantsInput((prev) => `${newPlayer.name}, ${prev}`);
        }

        setCurrentUser(newPlayer);
        alert(`🎉 환영합니다, ${newPlayer.name} 회원님! [${newPlayer.grade}] 등급으로 회원가입 및 로그인이 완료되었습니다.`);
      } finally {
        setAuthLoading(false);
      }
    } else {
      if (!email.trim() || !password) {
        setAuthMessage({ type: 'error', text: '이메일과 비밀번호를 입력해 주세요.' });
        return;
      }

      setAuthLoading(true);
      try {
        let matchedUser: RegisteredPlayer | undefined;
        try {
          const savedList = JSON.parse(localStorage.getItem('sun_tennis_registered_users') || '[]');
          const foundLocal = savedList.find(
            (u: any) => u.email?.toLowerCase() === email.trim().toLowerCase()
          );
          if (foundLocal) {
            if (foundLocal.password && foundLocal.password !== password) {
              setAuthMessage({ type: 'error', text: '비밀번호가 일치하지 않습니다.' });
              setAuthLoading(false);
              return;
            }
            matchedUser = foundLocal;
          }
        } catch {}

        if (!matchedUser) {
          matchedUser = registeredPlayers.find(
            (u) => u.email?.toLowerCase() === email.trim().toLowerCase() || u.name === email.trim()
          );
        }

        const loggedUser: RegisteredPlayer = matchedUser || {
          id: `p_${Date.now()}`,
          name: email.split('@')[0] || '김철수',
          email: email.trim(),
          grade: '금배',
          gender: 'M',
          role: 'admin',
        };

        setCurrentUser(loggedUser);
        setRole(loggedUser.role);
        try {
          localStorage.setItem('sun_tennis_current_user', JSON.stringify(loggedUser));
        } catch {}
      } finally {
        setAuthLoading(false);
      }
    }
  };

  // 체험 계정 빠른 입장
  const handleQuickDemoLogin = () => {
    const demoUser: RegisteredPlayer = {
      id: 'p1',
      name: '김철수',
      email: 'chulsoo@suntc.kr',
      grade: '금배',
      gender: 'M',
      role: 'admin',
    };
    setCurrentUser(demoUser);
    setRole('admin');
    try {
      localStorage.setItem('sun_tennis_current_user', JSON.stringify(demoUser));
    } catch {}
  };

  // 로그아웃 핸들러
  const handleLogout = () => {
    try {
      localStorage.removeItem('sun_tennis_current_user');
    } catch {}
    setCurrentUser(null);
    setPassword('');
    setConfirmPassword('');
    setAuthMessage(null);
  };

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
                  ? '아래 가입 폼을 작성하면 즉시 클럽 공식 선수로 등록됩니다.'
                  : '로그인하거나 회원가입 버튼을 눌러 새 계정을 만드세요.'}
              </p>
            </div>

            {/* 상단 로그인 / 회원가입 탭 전환 버튼 */}
            <div className="grid grid-cols-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-extrabold">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setAuthMessage(null);
                }}
                className={`py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  !isSignUp
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🔑</span>
                <span>로그인</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setAuthMessage(null);
                }}
                className={`py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  isSignUp
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>✨</span>
                <span>회원가입</span>
              </button>
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

            {/* 로그인 & 회원가입 통합 폼 */}
            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              {isSignUp && (
                <>
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

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  이메일 주소 <span className="text-amber-400">*</span>
                </label>
                <input
                  type="email"
                  placeholder="example@suntc.kr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  비밀번호 <span className="text-amber-400">*</span>
                </label>
                <input
                  type="password"
                  placeholder="비밀번호 입력 (6자 이상)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  required
                />
              </div>

              {isSignUp && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    비밀번호 확인 <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="비밀번호 다시 입력"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className={`w-full py-3 font-black rounded-xl text-sm shadow-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                  isSignUp
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 shadow-emerald-500/20'
                    : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 shadow-amber-500/20'
                }`}
              >
                <span>{isSignUp ? '✨' : '🎾'}</span>
                <span>
                  {authLoading
                    ? '처리 중...'
                    : isSignUp
                    ? '회원가입 완료 및 시작하기'
                    : '로그인하기'}
                </span>
              </button>
            </form>

            {/* 하단 회원가입 전환 버튼 & 빠른 체험 입장 버튼 */}
            <div className="pt-3 border-t border-slate-800 space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setAuthMessage(null);
                }}
                className="w-full py-2.5 bg-emerald-950/40 hover:bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 font-extrabold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{isSignUp ? '🔑' : '📝'}</span>
                <span>
                  {isSignUp
                    ? '이미 계정이 있으신가요? 로그인 화면으로 이동'
                    : '아직 회원이 아니신가요? 회원가입 하기'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleQuickDemoLogin}
                className="w-full py-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>⚡</span>
                <span>체험 계정(김철수 · 관리자)으로 바로 입장</span>
              </button>
            </div>
          </div>
        </div>
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
              <button
                onClick={() => setShowNewTourModal(true)}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1 shadow-xs"
              >
                <span>+</span> 새 대회 개설
              </button>
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
            <div className="pt-2 border-t border-slate-800">
              <label className="text-[10px] font-bold text-slate-400 block mb-1">📜 이전 대회 기록 관리 ({tournamentHistory.length}개)</label>
              <select
                value={currentTournament.id}
                onChange={(e) => {
                  const selected = tournamentHistory.find((t) => t.id === e.target.value);
                  if (selected) setCurrentTournament(selected);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white focus:outline-none"
              >
                {tournamentHistory.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.date})
                  </option>
                ))}
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

              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left ${
                  activeTab === 'admin'
                    ? 'bg-red-400/10 text-red-300 border border-red-400/30 shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="text-base">⚙️</span>
                <div className="flex-1">
                  <p className="leading-tight">운영자 관리 센터</p>
                  <p className="text-[10px] text-slate-500 font-normal">회원 등급 및 권한 설정</p>
                </div>
              </button>
            </div>
          </div>
        </aside>

        {/* ======================================================== */}
        {/* [모바일 프레임 / 메인 모바일 네이티브 레이아웃] */}
        {/* ======================================================== */}
        <main className="w-full max-w-md bg-slate-950 min-h-screen lg:min-h-[900px] lg:rounded-[42px] lg:border-[8px] lg:border-slate-800/80 shadow-2xl overflow-hidden flex flex-col relative pb-24">
          
          {/* 상단 썬 클럽 모바일 헤더 */}
          <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-lg">
                ☀️
              </div>
              <div>
                <h2 className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
                  {currentUser.name} 회원님
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    {currentUser.grade}
                  </span>
                </h2>
                <p className="text-[10px] text-slate-400 font-medium">썬 테니스 클럽 공식 운영 시스템</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setRole((r) => (r === 'member' ? 'admin' : 'member'))}
                className={`px-2 py-1 rounded-xl text-[10px] font-extrabold border transition-all cursor-pointer ${
                  role === 'admin'
                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}
              >
                {role === 'admin' ? '👑 운영자' : '👤 회원'}
              </button>
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
                <button
                  onClick={() => setShowNewTourModal(true)}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-[11px] font-black transition flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <span>+</span>
                  <span>새 대회 개설</span>
                </button>
              </div>

              <div>
                <h3 className="text-sm font-black text-white truncate">{currentTournament.name}</h3>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                  <span>📅 진행일: <strong className="text-amber-300">{currentTournament.date}</strong></span>
                  <span>•</span>
                  <span>방식: <strong className="text-emerald-300">{currentTournament.format === 'kdk' ? 'KDK 순환' : '예선/본선'}</strong></span>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* [탭 1]: 실시간 코트 현황 & 관리자 코트/선수 배정 패널 */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'courts' && (
              <div className="space-y-3.5">
                
                {/* 관리자 코트 추가 생성 및 선수 자동 배정 툴바 */}
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
                      <span>등록 선수 자동 배정</span>
                    </button>
                  </div>
                </div>

                {/* 대진 방식 빠른 이동 버튼 2개 */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setActiveTab('kdk')}
                    className="p-3 bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30 hover:border-emerald-400 rounded-2xl text-left transition group shadow-md"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base">🔄</span>
                      <span className="text-[10px] font-black bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded-md">바로가기</span>
                    </div>
                    <p className="text-xs font-black text-white group-hover:text-emerald-300">KDK 파트너 순환 진행</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">매 라운드 파트너 자동 변경</p>
                  </button>

                  <button
                    onClick={() => setActiveTab('tournament')}
                    className="p-3 bg-gradient-to-br from-amber-950/60 to-slate-900 border border-amber-500/30 hover:border-amber-400 rounded-2xl text-left transition group shadow-md"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base">🏆</span>
                      <span className="text-[10px] font-black bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-md">바로가기</span>
                    </div>
                    <p className="text-xs font-black text-white group-hover:text-amber-300">예선 & 본선 토너먼트</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">조별리그 & 결승 브래킷</p>
                  </button>
                </div>

                {/* 코트 카드 리스트 (동적 생성된 모든 코트 출력) */}
                <div className="space-y-3">
                  {courts.map((court) => (
                    <div
                      key={court.id}
                      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3 relative overflow-hidden transition-all hover:border-slate-700"
                    >
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
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
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openScoreModal(court)}
                            className="text-[11px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold border border-slate-700 transition"
                          >
                            점수 수정 ✎
                          </button>
                          {courts.length > 1 && (
                            <button
                              onClick={() => handleDeleteCourt(court.id)}
                              className="text-[11px] px-2 py-1 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 font-bold border border-red-500/30 transition"
                              title="코트 삭제"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 팀 선수 정보 및 수동 배정/수정 버튼 */}
                      <div className="grid grid-cols-2 gap-3 items-center">
                        {/* 팀 A */}
                        <div
                          onClick={() => openCourtPlayerEditModal(court)}
                          className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1 cursor-pointer hover:border-amber-400/50 transition group"
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
                          <span className="text-[9px] text-slate-500 block text-right pt-0.5">선수 수정 ✎</span>
                        </div>

                        {/* 팀 B */}
                        <div
                          onClick={() => openCourtPlayerEditModal(court)}
                          className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1 cursor-pointer hover:border-emerald-400/50 transition group"
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
                          <span className="text-[9px] text-slate-500 block text-right pt-0.5">선수 수정 ✎</span>
                        </div>
                      </div>

                      {/* 하단 수동 배정/수정 바 */}
                      <button
                        onClick={() => openCourtPlayerEditModal(court)}
                        className="w-full py-1.5 bg-slate-950/90 hover:bg-slate-800 text-slate-300 font-bold rounded-xl text-[11px] border border-slate-800 transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>👤</span>
                        <span>{court.courtNumber}번 코트 선수 수동 배정 및 수정</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* [탭 2]: KDK 파트너 순환 진행 전용 화면 */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'kdk' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 p-3 rounded-2xl border border-emerald-500/30 shadow-md">
                  <div>
                    <h3 className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                      <span>🔄</span> KDK 파트너 순환 리그
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {currentTournament.name} ({currentTournament.date})
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('tournament')}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-[11px] font-black transition flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <span>🏆</span>
                    <span>토너먼트로</span>
                  </button>
                </div>

                {/* KDK 참가자 명단 입력 및 대진표 자동 편성 */}
                <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-xs text-white flex items-center gap-1.5">
                      <span className="text-amber-400">🎾</span> KDK 참가 선수 명단 ({registeredPlayers.length}명 등록됨)
                    </span>
                    <button
                      onClick={() => {
                        const names = registeredPlayers.map((p) => p.name).join(', ');
                        setParticipantsInput(names);
                      }}
                      className="text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg border border-slate-700"
                    >
                      등록회원 전체 불러오기
                    </button>
                  </div>

                  <textarea
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono leading-relaxed"
                    rows={2}
                    value={participantsInput}
                    onChange={(e) => setParticipantsInput(e.target.value)}
                  />

                  <button
                    onClick={() => {
                      alert('🎉 KDK 파트너 순환 대진표가 새로 편성되었습니다!');
                    }}
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>🏓</span>
                    <span>KDK 대진표 자동 편성 & 랭킹 초기화</span>
                  </button>
                </div>

                {/* KDK 실시간 개인 순위표 */}
                <div className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-2.5">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <span>🥇</span> KDK 실시간 개인 순위표
                    </span>
                    <span className="text-[10px] text-slate-400">승수 &gt; 득실차 &gt; 승점 순</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-center text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800/80 text-[10px]">
                          <th className="py-1">순위</th>
                          <th className="py-1 text-left px-2">선수(등급)</th>
                          <th className="py-1">경기</th>
                          <th className="py-1">승-패</th>
                          <th className="py-1">득실</th>
                          <th className="py-1 font-bold text-amber-400">승점</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {kdkStandings.map((s) => (
                          <tr key={s.name} className={s.rank <= 3 ? 'bg-amber-400/5 font-bold' : ''}>
                            <td className="py-2">
                              {s.rank === 1 ? '🥇 1' : s.rank === 2 ? '🥈 2' : s.rank === 3 ? '🥉 3' : s.rank}
                            </td>
                            <td className="py-2 text-left px-2 text-white">
                              {s.name} <span className="text-[10px] text-slate-400 font-normal">({s.grade})</span>
                            </td>
                            <td className="py-2 text-slate-300">{s.matches}</td>
                            <td className="py-2 text-emerald-400">{s.wins}승 {s.losses}패</td>
                            <td className="py-2 text-slate-300">{s.ptsDiff}</td>
                            <td className="py-2 font-black text-amber-400">{s.totalPts}점</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* KDK 라운드별 경기 리스트 */}
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-300 px-1 flex items-center gap-1">
                    <span>🎾</span> KDK 라운드별 경기 진행 & 스코어
                  </h4>

                  {kdkRounds.map((r) => (
                    <div key={r.round} className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-2.5">
                      <div className="text-xs font-black text-emerald-400 border-b border-slate-800 pb-1.5 flex justify-between">
                        <span>{r.name}</span>
                        <span className="text-[10px] text-slate-400">{r.matches.length}개 경기</span>
                      </div>

                      <div className="space-y-2">
                        {r.matches.map((m) => (
                          <div key={m.id} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                            <span className="font-extrabold text-amber-400 text-[10px]">코트 {m.court}</span>
                            <span className="font-bold text-white truncate max-w-[90px]">{m.teamA.join(' / ')}</span>
                            <span className="text-sm font-black text-white px-2 py-0.5 bg-slate-900 rounded border border-slate-800">
                              {m.scoreA} : {m.scoreB}
                            </span>
                            <span className="font-bold text-white truncate max-w-[90px]">{m.teamB.join(' / ')}</span>
                            <span className={`text-[10px] font-bold ${m.completed ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {m.completed ? '완료' : '진행'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* [탭 3]: 예선전 & 본선 토너먼트 진행 전용 화면 */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'tournament' && (
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
                  <button
                    onClick={() => setActiveTab('kdk')}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-black transition flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <span>🔄</span>
                    <span>KDK 진행으로</span>
                  </button>
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

                        <div className="pt-2 border-t border-slate-800/80 flex gap-2">
                          <button
                            onClick={() => {
                              setChampion(finalMatch.teamA);
                              alert(`🎉 [${finalMatch.teamA}] 우승이 확정되었습니다! 🏆`);
                            }}
                            className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs transition shadow-md"
                          >
                            🥇 {finalMatch.teamA} 우승 확정
                          </button>
                          <button
                            onClick={() => {
                              setChampion(finalMatch.teamB);
                              alert(`🎉 [${finalMatch.teamB}] 우승이 확정되었습니다! 🏆`);
                            }}
                            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-black rounded-xl text-xs transition border border-amber-500/30"
                          >
                            🥇 {finalMatch.teamB} 우승 확정
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* [탭 4]: VIP 마이페이지 */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'mypage' && (
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700 p-5 text-slate-950 shadow-2xl">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-950/70 block">
                        SUN TENNIS VIP CLUB
                      </span>
                      <h2 className="text-xl font-black text-slate-950 flex items-center gap-1.5">
                        <span>☀️</span> {currentUser.name} 회원님
                      </h2>
                      <div className="flex gap-1.5 pt-1">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-950 text-amber-300 shadow-sm">
                          {currentUser.grade}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/40 text-slate-950">
                          정회원 ({currentUser.gender === 'F' ? '여' : '남'})
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
                      <span>📊</span> 공식 대회 누적 전적 ({currentTournament.name})
                    </span>
                    <span className="text-xs font-extrabold text-amber-400">승률 75.0%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                    <div className="bg-gradient-to-r from-amber-400 to-emerald-400 h-2.5 rounded-full" style={{ width: '75%' }} />
                  </div>
                  <div className="grid grid-cols-4 gap-2 pt-1 text-center text-xs">
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <p className="text-[10px] text-slate-400">총 경기</p>
                      <p className="text-base font-black text-white">12</p>
                    </div>
                    <div className="bg-emerald-950/40 p-2 rounded-xl border border-emerald-500/20">
                      <p className="text-[10px] text-emerald-400 font-bold">승리</p>
                      <p className="text-base font-black text-emerald-300">9</p>
                    </div>
                    <div className="bg-red-950/40 p-2 rounded-xl border border-red-500/20">
                      <p className="text-[10px] text-red-400 font-bold">패배</p>
                      <p className="text-base font-black text-red-300">3</p>
                    </div>
                    <div className="bg-amber-950/40 p-2 rounded-xl border border-amber-500/20">
                      <p className="text-[10px] text-amber-400 font-bold">득실차</p>
                      <p className="text-base font-black text-amber-300">+21</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* [탭 5]: 운영자 관리 센터 */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'admin' && (
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h3 className="text-sm font-black text-red-400 flex items-center gap-1.5">
                      <span>👑</span> 썬 클럽 등록 공식 선수 명부
                    </h3>
                    <span className="text-[11px] text-slate-400">총 {registeredPlayers.length}명 등록</span>
                  </div>

                  <div className="divide-y divide-slate-800/80">
                    {registeredPlayers.map((u) => (
                      <div key={u.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{u.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                            {u.grade}
                          </span>
                          <span className="text-[10px] text-slate-400">({u.gender === 'M' ? '남' : '여'})</span>
                        </div>
                        <span className="text-[10px] text-slate-400">{u.role === 'admin' ? '운영진' : '정회원'}</span>
                      </div>
                    ))}
                  </div>
                </div>
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

            <button
              onClick={() => setActiveTab('admin')}
              className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
                activeTab === 'admin'
                  ? 'text-red-400 font-bold scale-105 bg-red-400/10'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <span className="text-base">⚙️</span>
              <span className="text-[10px] mt-0.5">운영관리</span>
            </button>
          </nav>
        </main>
      </div>

      {/* ======================================================== */}
      {/* [모달 1]: 새 대회 개설 모달 (진행날짜 자동 생성 & 방식 선택) */}
      {/* ======================================================== */}
      {showNewTourModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-amber-400 flex items-center gap-1.5">
                <span>🏆</span> 새 공식 테니스 대회 개설
              </h3>
              <button
                onClick={() => setShowNewTourModal(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTournament} className="space-y-3.5">
              {/* 1. 대회명 입력 */}
              <div>
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

              {/* 2. 진행날짜 자동 생성 & 기록 관리 */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-300 block">
                    진행 날짜 <span className="text-emerald-400 font-normal">(자동 생성됨)</span>
                  </label>
                  <span className="text-[10px] text-amber-400">오늘 일자 자동 기록</span>
                </div>
                <input
                  type="date"
                  required
                  value={newTourDate}
                  onChange={(e) => setNewTourDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                />
              </div>

              {/* 3. 대회 진행 방식 선택 */}
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
                      <span>KDK 순환 리그</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                      매 라운드 파트너 자동 교체 & 개인 승점 누적 집계
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

              {/* 4. 초기 코트 수 설정 */}
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
                  대회 개설 및 코트 배정 ➔
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* [모달 2]: 코트 선수 수동 배정 및 직접 수정 모달 */}
      {/* ======================================================== */}
      {courtEditTarget && (
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
      {selectedCourt && (
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
    </div>
  );
}
