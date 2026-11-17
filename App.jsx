'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import AdminTournamentManager from './components/AdminTournamentManager';

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

const GRADE_OPTIONS = ['금배', '은배', '동배', '국화', '개나리', '테린이', '고령자부'];

export default function TennisApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [authMessage, setAuthMessage] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpGender, setSignUpGender] = useState('M');
  const [signUpGrade, setSignUpGrade] = useState('은배');
  const [signUpRole, setSignUpRole] = useState('member');

  const [activeTab, setActiveTab] = useState('courts');
  const [role, setRole] = useState('member');
  const [adminSubTab, setAdminSubTab] = useState('tournament_builder');
  const [activeTournament, setActiveTournament] = useState(null);
  const [tourPhase, setTourPhase] = useState('qualifying');

  const [users, setUsers] = useState([
    { id: '1', name: '김철수', email: 'chulsoo@suntc.kr', gender: 'M', grade: '금배', role: 'member', status: 'playing', isLoggedIn: true },
    { id: '2', name: '강동원', email: 'dongwon@suntc.kr', gender: 'M', grade: '금배', role: 'member', status: 'playing', isLoggedIn: true },
    { id: '3', name: '박민수', email: 'minsoo@suntc.kr', gender: 'M', grade: '은배', role: 'member', status: 'playing', isLoggedIn: true },
    { id: '4', name: '정지훈', email: 'jihoon@suntc.kr', gender: 'M', grade: '동배', role: 'member', status: 'waiting', isLoggedIn: true },
    { id: '5', name: '이영희', email: 'younghee@suntc.kr', gender: 'F', grade: '국화', role: 'member', status: 'playing', isLoggedIn: true },
    { id: '6', name: '한지민', email: 'jimin@suntc.kr', gender: 'F', grade: '은배', role: 'member', status: 'playing', isLoggedIn: true },
    { id: '7', name: '최수진', email: 'sujin@suntc.kr', gender: 'F', grade: '개나리', role: 'member', status: 'playing', isLoggedIn: true },
    { id: '8', name: '송중기', email: 'joongki@suntc.kr', gender: 'M', grade: '동배', role: 'member', status: 'playing', isLoggedIn: true },
    { id: '9', name: '조인성', email: 'insung@suntc.kr', gender: 'M', grade: '은배', role: 'member', status: 'waiting', isLoggedIn: true },
    { id: '10', name: '공유', email: 'admin@suntc.kr', gender: 'M', grade: '금배', role: 'admin', status: 'waiting', isLoggedIn: true },
  ]);

  const [participantsInput, setParticipantsInput] = useState(
    '김철수, 강동원, 박민수, 정지훈, 이영희, 한지민, 최수진, 송중기'
  );

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

  const [kdkStandings, setKdkStandings] = useState([
    { rank: 1, name: '강동원', grade: '금배', matches: 2, wins: 2, losses: 0, ptsDiff: '+4', totalPts: 12 },
    { rank: 2, name: '김철수', grade: '금배', matches: 2, wins: 1, losses: 1, ptsDiff: '+2', totalPts: 11 },
    { rank: 3, name: '이영희', grade: '국화', matches: 2, wins: 1, losses: 1, ptsDiff: '+2', totalPts: 10 },
    { rank: 4, name: '송중기', grade: '동배', matches: 2, wins: 1, losses: 1, ptsDiff: '-2', totalPts: 8 },
    { rank: 5, name: '박민수', grade: '은배', matches: 2, wins: 1, losses: 1, ptsDiff: '-2', totalPts: 9 },
    { rank: 6, name: '정지훈', grade: '동배', matches: 2, wins: 0, losses: 2, ptsDiff: '-4', totalPts: 8 },
    { rank: 7, name: '한지민', grade: '은배', matches: 2, wins: 0, losses: 2, ptsDiff: '-6', totalPts: 6 },
    { rank: 8, name: '최수진', grade: '개나리', matches: 2, wins: 0, losses: 2, ptsDiff: '-2', totalPts: 8 },
  ]);

  const recalculateKdkStandings = (roundsData) => {
    const map = {};
    const parsePlayerLabel = (label) => {
      const m = label.match(/^(.+?)\s*\((.+?)\)/);
      if (m) return { name: m[1].trim(), grade: m[2].trim() };
      return { name: label.trim(), grade: '일반' };
    };

    roundsData.forEach((r) => {
      r.matches.forEach((m) => {
        [...m.teamA, ...m.teamB].forEach((pLabel) => {
          const { name, grade } = parsePlayerLabel(pLabel);
          if (!map[name]) {
            map[name] = { name, grade, matches: 0, wins: 0, losses: 0, diff: 0, pts: 0 };
          }
        });

        if (m.completed || m.scoreA > 0 || m.scoreB > 0) {
          const aWon = m.scoreA > m.scoreB;
          const bWon = m.scoreB > m.scoreA;
          m.teamA.forEach((pLabel) => {
            const { name } = parsePlayerLabel(pLabel);
            map[name].matches += 1;
            if (aWon) map[name].wins += 1;
            else if (bWon) map[name].losses += 1;
            map[name].diff += m.scoreA - m.scoreB;
            map[name].pts += m.scoreA;
          });
          m.teamB.forEach((pLabel) => {
            const { name } = parsePlayerLabel(pLabel);
            map[name].matches += 1;
            if (bWon) map[name].wins += 1;
            else if (aWon) map[name].losses += 1;
            map[name].diff += m.scoreB - m.scoreA;
            map[name].pts += m.scoreB;
          });
        }
      });
    });

    const sorted = Object.values(map).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.diff !== a.diff) return b.diff - a.diff;
      return b.pts - a.pts;
    });

    if (sorted.length > 0) {
      setKdkStandings(
        sorted.map((s, idx) => ({
          rank: idx + 1,
          name: s.name,
          grade: s.grade,
          matches: s.matches,
          wins: s.wins,
          losses: s.losses,
          ptsDiff: s.diff >= 0 ? `+${s.diff}` : `${s.diff}`,
          totalPts: s.pts,
        }))
      );
    }
  };

  const updateKdkMatchScore = (roundIdx, matchIdx, deltaA, deltaB) => {
    setKdkRounds((prev) => {
      const next = prev.map((r, rI) => {
        if (rI !== roundIdx) return r;
        return {
          ...r,
          matches: r.matches.map((m, mI) => {
            if (mI !== matchIdx) return m;
            return {
              ...m,
              scoreA: Math.max(0, m.scoreA + deltaA),
              scoreB: Math.max(0, m.scoreB + deltaB),
            };
          }),
        };
      });
      recalculateKdkStandings(next);
      return next;
    });
  };

  const toggleKdkMatchComplete = (roundIdx, matchIdx) => {
    setKdkRounds((prev) => {
      const next = prev.map((r, rI) => {
        if (rI !== roundIdx) return r;
        return {
          ...r,
          matches: r.matches.map((m, mI) => {
            if (mI !== matchIdx) return m;
            return { ...m, completed: !m.completed };
          }),
        };
      });
      recalculateKdkStandings(next);
      return next;
    });
  };

  const handleGenerateKdk = () => {
    const names = participantsInput
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length < 4) {
      alert('KDK 편성을 위해서는 최소 4명 이상의 참가자가 필요합니다.');
      return;
    }

    const generated = [];
    for (let r = 1; r <= 3; r++) {
      const shuffled = [...names].sort(() => Math.random() - 0.5);
      const matches = [];
      for (let i = 0; i < shuffled.length; i += 4) {
        if (i + 3 < shuffled.length) {
          matches.push({
            id: `gen-r${r}-m${matches.length + 1}`,
            court: matches.length + 1,
            teamA: [shuffled[i], shuffled[i + 1]],
            teamB: [shuffled[i + 2], shuffled[i + 3]],
            scoreA: 0,
            scoreB: 0,
            completed: false,
          });
        }
      }
      generated.push({
        round: r,
        name: `제 ${r} 라운드 (자동 매칭)`,
        matches,
      });
    }

    setKdkRounds(generated);
    recalculateKdkStandings(generated);
    alert(`🎉 ${names.length}명의 참가자로 총 3개 라운드 KDK 순환 대진표가 새로 편성되었습니다!`);
  };

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

  const [groupMatches, setGroupMatches] = useState([
    { id: 'ga-1', group: 'A조', matchNum: 1, court: 1, teamA: '김철수 / 강동원', teamB: '이영희 / 한지민', scoreA: 6, scoreB: 3, status: '종료' },
    { id: 'ga-2', group: 'A조', matchNum: 2, court: 2, teamA: '이영희 / 한지민', teamB: '정지훈 / 조인성', scoreA: 6, scoreB: 2, status: '종료' },
    { id: 'ga-3', group: 'A조', matchNum: 3, court: 1, teamA: '김철수 / 강동원', teamB: '정지훈 / 조인성', scoreA: 6, scoreB: 2, status: '종료' },
    { id: 'gb-1', group: 'B조', matchNum: 1, court: 3, teamA: '박민수 / 송중기', teamB: '최수진 / 김태희', scoreA: 6, scoreB: 4, status: '종료' },
    { id: 'gb-2', group: 'B조', matchNum: 2, court: 1, teamA: '최수진 / 김태희', teamB: '공유 / 정우성', scoreA: 6, scoreB: 2, status: '종료' },
    { id: 'gb-3', group: 'B조', matchNum: 3, court: 2, teamA: '박민수 / 송중기', teamB: '공유 / 정우성', scoreA: 6, scoreB: 2, status: '종료' },
  ]);

  const [semiFinal1, setSemiFinal1] = useState({
    name: '4강 제 1경기',
    teamA: '김철수 / 강동원 (A조 1위)',
    teamB: '최수진 / 김태희 (B조 2위)',
    scoreA: 6,
    scoreB: 3,
    winner: '김철수 / 강동원',
    court: 1,
  });

  const [semiFinal2, setSemiFinal2] = useState({
    name: '4강 제 2경기',
    teamA: '박민수 / 송중기 (B조 1위)',
    teamB: '이영희 / 한지민 (A조 2위)',
    scoreA: 4,
    scoreB: 6,
    winner: '이영희 / 한지민',
    court: 2,
  });

  const [finalMatch, setFinalMatch] = useState({
    name: '🏆 결승전 (FINAL)',
    teamA: '김철수 / 강동원',
    teamB: '이영희 / 한지민',
    scoreA: 6,
    scoreB: 5,
    winner: '',
    court: 1,
  });

  const [thirdPlaceMatch] = useState({
    name: '🥉 3·4위 결정전',
    teamA: '최수진 / 김태희',
    teamB: '박민수 / 송중기',
    scoreA: 6,
    scoreB: 4,
    winner: '최수진 / 김태희',
    court: 3,
  });

  const [champion, setChampion] = useState('');

  const handleAdvanceToMain = () => {
    setSemiFinal1((prev) => ({
      ...prev,
      teamA: `${groupAStandings[0]?.team || 'Team 1'} (A조 1위)`,
      teamB: `${groupBStandings[1]?.team || 'Team 2'} (B조 2위)`,
    }));
    setSemiFinal2((prev) => ({
      ...prev,
      teamA: `${groupBStandings[0]?.team || 'Team 3'} (B조 1위)`,
      teamB: `${groupAStandings[1]?.team || 'Team 4'} (A조 2위)`,
    }));
    setTourPhase('main');
    alert('🏆 예선 조별 1, 2위가 확정되어 본선 4강 토너먼트 브래킷에 자동 배치되었습니다!');
  };

  const handleDeclareChampion = (teamName) => {
    setChampion(teamName);
    setFinalMatch((prev) => ({ ...prev, winner: teamName }));
    alert(`🎉 축하합니다! [${teamName}] 조가 ${activeTournament?.title || '썬 테니스 클럽'} 공식 챔피언에 등극했습니다! 🏆`);
  };

  const [courts, setCourts] = useState([
    {
      id: 1,
      courtNumber: 1,
      roundName: '제 1 라운드',
      status: 'playing',
      teamA: ['김철수 (금배)', '강동원 (금배)'],
      teamB: ['이영희 (국화)', '한지민 (은배)'],
      scoreA: 5,
      scoreB: 5,
    },
    {
      id: 2,
      courtNumber: 2,
      roundName: '제 1 라운드',
      status: 'playing',
      teamA: ['박민수 (은배)', '송중기 (동배)'],
      teamB: ['최수진 (개나리)', '김태희 (테린이)'],
      scoreA: 6,
      scoreB: 4,
    },
    {
      id: 3,
      courtNumber: 3,
      roundName: '대기 매치',
      status: 'waiting',
      teamA: ['정지훈 (동배)', '조인성 (은배)'],
      teamB: ['공유 (금배)', '정우성 (은배)'],
      scoreA: 0,
      scoreB: 0,
    },
  ]);

  const [selectedCourt, setSelectedCourt] = useState(null);
  const [inputScoreA, setInputScoreA] = useState(0);
  const [inputScoreB, setInputScoreB] = useState(0);
  const [inputStatus, setInputStatus] = useState('playing');

  useEffect(() => {
    try {
      const savedUsersRaw = localStorage.getItem('sun_tennis_registered_users');
      if (savedUsersRaw) {
        const savedUsers = JSON.parse(savedUsersRaw);
        if (Array.isArray(savedUsers) && savedUsers.length > 0) {
          setUsers((prev) => {
            const existingIds = new Set(prev.map((u) => String(u.id)));
            const merged = [...prev];
            savedUsers.forEach((su) => {
              if (!existingIds.has(String(su.id))) merged.push(su);
            });
            return merged;
          });
        }
      }

      const savedTourRaw = localStorage.getItem('sun_tennis_active_tournament');
      if (savedTourRaw) {
        const parsedTour = JSON.parse(savedTourRaw);
        if (parsedTour && parsedTour.title) {
          applyTournamentToAppState(parsedTour, false);
        }
      }
    } catch {}
  }, []);

  const applyTournamentToAppState = async (config, showNotification = true) => {
    setActiveTournament(config);
    try {
      localStorage.setItem('sun_tennis_active_tournament', JSON.stringify(config));
    } catch {}

    const formatPlayerLabel = (p) => `${p.name} (${p.grade}${p.isGuest ? '·임의' : ''})`;

    const courtMap = new Map();
    config.matches.forEach((m) => {
      if (!courtMap.has(m.courtNumber)) {
        courtMap.set(m.courtNumber, m);
      }
    });

    const newCourts = Array.from(courtMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([courtNum, m], idx) => ({
        id: idx + 1,
        matchId: m.id,
        courtNumber: courtNum,
        roundName: m.roundName,
        status: m.status === 'completed' ? 'completed' : 'playing',
        teamA: [formatPlayerLabel(m.teamA[0]), formatPlayerLabel(m.teamA[1])],
        teamB: [formatPlayerLabel(m.teamB[0]), formatPlayerLabel(m.teamB[1])],
        scoreA: m.scoreA,
        scoreB: m.scoreB,
      }));

    if (newCourts.length > 0) {
      setCourts(newCourts);
    }

    setParticipantsInput(config.participants.map((p) => p.name).join(', '));

    if (config.mode === 'KDK') {
      const roundsGroup = new Map();
      config.matches.forEach((m) => {
        const rNum = m.round || 1;
        if (!roundsGroup.has(rNum)) roundsGroup.set(rNum, []);
        roundsGroup.get(rNum).push(m);
      });

      const formattedKdkRounds = Array.from(roundsGroup.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([rNum, mList]) => ({
          round: rNum,
          name: mList[0]?.roundName || `제 ${rNum} 라운드 (${config.title})`,
          matches: mList.map((m) => ({
            id: m.id,
            court: m.courtNumber,
            teamA: [formatPlayerLabel(m.teamA[0]), formatPlayerLabel(m.teamA[1])],
            teamB: [formatPlayerLabel(m.teamB[0]), formatPlayerLabel(m.teamB[1])],
            scoreA: m.scoreA,
            scoreB: m.scoreB,
            completed: m.status === 'completed',
          })),
        }));

      setKdkRounds(formattedKdkRounds);
      recalculateKdkStandings(formattedKdkRounds);
    } else {
      const tourMatches = config.matches.map((m, idx) => ({
        id: m.id,
        group: idx % 2 === 0 ? 'A조' : 'B조',
        matchNum: idx + 1,
        court: m.courtNumber,
        teamA: `${m.teamA[0].name} / ${m.teamA[1].name}`,
        teamB: `${m.teamB[0].name} / ${m.teamB[1].name}`,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        status: m.status === 'completed' ? '종료' : '진행중',
      }));
      setGroupMatches(tourMatches);
    }

    if (showNotification) {
      alert(
        `🎉 [${config.title}] 대회가 (${config.mode === 'KDK' ? 'KDK 방식' : '토너먼트 방식'} · ${
          config.assignmentType === 'AUTO' ? '자동배정' : '수동배정'
        })으로 생성되어 실시간 코트 및 대진표에 자동 연동되었습니다!`
      );
      setActiveTab('courts');
    }
  };

  const handleAddCustomUserToClub = (guestPlayer) => {
    setUsers((prev) => {
      if (prev.some((u) => String(u.id) === guestPlayer.id)) return prev;
      const updated = [
        ...prev,
        {
          id: guestPlayer.id,
          name: guestPlayer.name,
          gender: guestPlayer.gender === '여' ? 'F' : 'M',
          grade: guestPlayer.grade,
          role: 'member',
          status: 'playing',
          isGuest: true,
          isLoggedIn: false,
        },
      ];
      try {
        localStorage.setItem('sun_tennis_registered_users', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthMessage(null);

    if (isSignUp) {
      if (!signUpName.trim()) {
        setAuthMessage({ type: 'error', text: '이름을 입력해 주세요.' });
        return;
      }
      if (password !== confirmPassword) {
        setAuthMessage({ type: 'error', text: '비밀번호 확인이 일치하지 않습니다.' });
        return;
      }

      const newUser = {
        id: `u_${Date.now()}`,
        name: signUpName.trim(),
        email: email.trim(),
        gender: signUpGender,
        grade: signUpGrade,
        role: signUpRole,
        status: 'playing',
        isLoggedIn: true,
      };

      setUsers((prev) => [newUser, ...prev]);
      setCurrentUser(newUser);
      setRole(newUser.role);
      if (newUser.role === 'admin') {
        setActiveTab('admin');
        setAdminSubTab('tournament_builder');
      } else {
        setActiveTab('courts');
      }
      return;
    }

    const trimmed = email.trim().toLowerCase();
    const isAdminAccount =
      trimmed.includes('admin') || trimmed === '공유' || trimmed === '운영자' || trimmed === '관리자';

    const matched = users.find(
      (u) => u.email?.toLowerCase() === trimmed || u.name === email.trim()
    );

    const loggedUser = matched
      ? { ...matched, role: isAdminAccount ? 'admin' : matched.role, isLoggedIn: true }
      : {
          id: `u_${Date.now()}`,
          name: isAdminAccount ? '공유 (총괄관리자)' : email.split('@')[0] || '김철수',
          email: email.trim(),
          gender: 'M',
          grade: '금배',
          role: isAdminAccount ? 'admin' : 'member',
          isLoggedIn: true,
        };

    setCurrentUser(loggedUser);
    setRole(loggedUser.role);
    if (loggedUser.role === 'admin') {
      setActiveTab('admin');
      setAdminSubTab('tournament_builder');
    } else {
      setActiveTab('courts');
    }
  };

  const handleQuickAdminLogin = () => {
    const adminUser = {
      id: '10',
      name: '공유',
      email: 'admin@suntc.kr',
      gender: 'M',
      grade: '금배',
      role: 'admin',
      isLoggedIn: true,
    };
    setCurrentUser(adminUser);
    setRole('admin');
    setActiveTab('admin');
    setAdminSubTab('tournament_builder');
    try {
      localStorage.setItem('sun_tennis_current_user', JSON.stringify(adminUser));
    } catch {}
  };

  const handleQuickMemberLogin = () => {
    const memberUser = {
      id: '1',
      name: '김철수',
      email: 'chulsoo@suntc.kr',
      gender: 'M',
      grade: '금배',
      role: 'member',
      isLoggedIn: true,
    };
    setCurrentUser(memberUser);
    setRole('member');
    setActiveTab('courts');
    try {
      localStorage.setItem('sun_tennis_current_user', JSON.stringify(memberUser));
    } catch {}
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('sun_tennis_current_user');
    } catch {}
  };

  const openScoreModal = (court) => {
    setSelectedCourt(court);
    setInputScoreA(court.scoreA);
    setInputScoreB(court.scoreB);
    setInputStatus(court.status);
  };

  const saveCourtScore = () => {
    if (!selectedCourt) return;
    const newScoreA = Number(inputScoreA);
    const newScoreB = Number(inputScoreB);

    setCourts((prev) =>
      prev.map((c) =>
        c.id === selectedCourt.id
          ? {
              ...c,
              scoreA: newScoreA,
              scoreB: newScoreB,
              status: inputStatus,
            }
          : c
      )
    );
    setSelectedCourt(null);
  };

  const setQuickNames = (count) => {
    if (count === 8) {
      setParticipantsInput('김철수, 강동원, 박민수, 정지훈, 이영희, 한지민, 최수진, 송중기');
    } else {
      setParticipantsInput('김철수, 강동원, 박민수, 정지훈, 이영희, 한지민, 최수진, 송중기, 조인성, 공유, 김태희, 정우성');
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-amber-500/20 bg-slate-900">
            <img
              src="/sun-tennis-hero.jpg"
              alt="썬 테니스 클럽"
              className="w-full h-48 lg:h-[520px] object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent flex flex-col justify-end p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 uppercase">
                  Official Club
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  실시간 대회 연동
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-black text-white flex items-center gap-2">
                <span className="text-amber-400 text-3xl">☀️</span>
                <span>썬 테니스 클럽</span>
              </h1>
              <p className="text-xs lg:text-sm text-slate-300 font-medium mt-2 leading-relaxed">
                관리자 로그인 시 <strong>대회명 생성 ➔ 대회방식(토너먼트/KDK) 선택 ➔ 코트 및 선수 자동/수동 배치(미로그인 임의 선수 포함)</strong>를 즉시 진행할 수 있습니다.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-extrabold">
                🎾 SUN TENNIS TOURNAMENT SYSTEM
              </span>
              <h2 className="text-xl font-black text-white">
                {isSignUp ? '클럽 회원가입' : '관리자 및 회원 로그인'}
              </h2>
            </div>

            <div className="bg-slate-950 p-3 rounded-2xl border border-amber-500/30 space-y-2">
              <p className="text-[11px] font-extrabold text-amber-300 text-center">
                ⚡ 빠른 접속 (관리자 로그인 시 대회 생성 화면으로 즉시 이동)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleQuickAdminLogin}
                  className="py-2.5 px-3 bg-gradient-to-r from-red-500 via-amber-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-xs transition shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>👑</span>
                  <span>관리자 즉시 로그인</span>
                </button>
                <button
                  type="button"
                  onClick={handleQuickMemberLogin}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-black rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>👤</span>
                  <span>일반회원 로그인</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-extrabold">
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className={`py-2 rounded-xl transition cursor-pointer ${
                  !isSignUp
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🔑 계정 로그인
              </button>
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                className={`py-2 rounded-xl transition cursor-pointer ${
                  isSignUp
                    ? 'bg-emerald-500 text-slate-950 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ✨ 신규 회원가입
              </button>
            </div>

            {authMessage && (
              <div className="p-2.5 rounded-xl text-xs font-bold bg-red-950/60 border border-red-500/40 text-red-300">
                {authMessage.text}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              {isSignUp && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">이름 *</label>
                    <input
                      type="text"
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      placeholder="실명 입력 (예: 홍길동)"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">성별</label>
                      <select
                        value={signUpGender}
                        onChange={(e) => setSignUpGender(e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                      >
                        <option value="M">남성</option>
                        <option value="F">여성</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">등급</label>
                      <select
                        value={signUpGrade}
                        onChange={(e) => setSignUpGrade(e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-amber-300 font-bold"
                      >
                        {GRADE_OPTIONS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">권한</label>
                      <select
                        value={signUpRole}
                        onChange={(e) => setSignUpRole(e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-red-300 font-bold"
                      >
                        <option value="member">일반회원</option>
                        <option value="admin">관리자</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  이메일 또는 이름 (관리자는 admin@suntc.kr 입력)
                </label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@suntc.kr 또는 이름"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">비밀번호</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  required
                />
              </div>

              {isSignUp && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">비밀번호 확인</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="비밀번호 다시 입력"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-xs transition shadow-lg cursor-pointer"
              >
                {isSignUp ? '✨ 가입 및 시작하기' : '🎾 로그인하기'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-900">
      <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row justify-center items-start lg:gap-8 lg:p-6 min-h-screen">
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
                  실시간 운영 중
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2 drop-shadow-md">
                <span className="text-amber-400">☀️</span> 썬 테니스 클럽
              </h1>
              <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                {activeTournament
                  ? `현재 진행 대회: ${activeTournament.title} (${
                      activeTournament.mode === 'KDK' ? 'KDK 방식' : '토너먼트'
                    })`
                  : '태양처럼 뜨거운 열정! KDK 파트너 순환 리그와 정규 예선/본선 토너먼트를 스마트하게 운영합니다.'}
              </p>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">시스템 메뉴 바로가기</p>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                onClick={() => {
                  setRole('admin');
                  setActiveTab('admin');
                  setAdminSubTab('tournament_builder');
                }}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-red-500/15 text-red-300 border border-red-400/40 shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="text-base">👑</span>
                <div className="flex-1">
                  <p className="leading-tight">관리자 대회 생성 & 코트/선수 배치</p>
                  <p className="text-[10px] text-slate-400 font-normal">대회명·토너먼트/KDK·자동/수동 선수배치</p>
                </div>
                <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-md font-extrabold">관리자</span>
              </button>

              <button
                onClick={() => setActiveTab('courts')}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left cursor-pointer ${
                  activeTab === 'courts'
                    ? 'bg-amber-400/10 text-amber-300 border border-amber-400/30 shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="text-base">🎾</span>
                <div className="flex-1">
                  <p className="leading-tight">실시간 코트 현황</p>
                  <p className="text-[10px] text-slate-500 font-normal">배정된 코트 라이브 스코어</p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('kdk')}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left cursor-pointer ${
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
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left cursor-pointer ${
                  activeTab === 'tournament'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30 shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="text-base">🏆</span>
                <div className="flex-1">
                  <p className="leading-tight">예선 & 본선 토너먼트</p>
                  <p className="text-[10px] text-slate-500 font-normal">조별 풀리그 & 4강/결승 브래킷</p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('mypage')}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left cursor-pointer ${
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
            </div>
          </div>
        </aside>

        <main className="w-full max-w-md bg-slate-950 min-h-screen lg:min-h-[900px] lg:rounded-[42px] lg:border-[8px] lg:border-slate-800/80 shadow-2xl overflow-hidden flex flex-col relative pb-24">
          <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-lg">
                ☀️
              </div>
              <div>
                <h2 className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
                  {currentUser?.name || '썬 테니스'}님
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    {currentUser?.grade || 'SUN'}
                  </span>
                </h2>
                <p className="text-[10px] text-slate-400 font-medium truncate max-w-[160px]">
                  {activeTournament ? `🏆 ${activeTournament.title}` : '태양처럼 뜨거운 코트의 열정'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const nextRole = role === 'member' ? 'admin' : 'member';
                  setRole(nextRole);
                  if (nextRole === 'admin') {
                    setActiveTab('admin');
                    setAdminSubTab('tournament_builder');
                  }
                }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold border transition-all cursor-pointer ${
                  role === 'admin'
                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}
              >
                {role === 'admin' ? '👑 관리자 모드' : '👤 회원 모드'}
              </button>
              <button
                onClick={handleLogout}
                className="px-2 py-1 rounded-xl text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
              >
                로그아웃
              </button>
            </div>
          </header>

          {activeTournament && (
            <div className="bg-gradient-to-r from-amber-500/20 via-slate-900 to-emerald-500/20 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[10px] shrink-0">
                  {activeTournament.mode === 'KDK' ? 'KDK 진행중' : '토너먼트 진행중'}
                </span>
                <span className="text-xs font-extrabold text-white truncate">
                  {activeTournament.title}
                </span>
              </div>
              <button
                onClick={() => {
                  setActiveTab('admin');
                  setAdminSubTab('tournament_builder');
                }}
                className="text-[10px] font-bold text-amber-300 hover:underline shrink-0 ml-2 cursor-pointer"
              >
                대진/코트 수정 ⚙
              </button>
            </div>
          )}

          <div className="p-4 space-y-4 flex-1">
            {activeTab === 'courts' && (
              <div className="space-y-3.5">
                <div className="flex justify-between items-center bg-gradient-to-r from-emerald-950/80 via-slate-900 to-amber-950/60 p-3 rounded-2xl border border-emerald-500/20 shadow-md">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </span>
                    <span className="text-xs font-bold text-white">
                      {activeTournament ? `${activeTournament.title} 코트 현황` : '실시간 코트 가동 중'}
                    </span>
                  </div>
                  <span className="text-[11px] text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/30 font-extrabold">
                    총 {courts.length}개 코트
                  </span>
                </div>

                {courts.map((court) => (
                  <div
                    key={court.id}
                    className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3"
                  >
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-amber-400 text-slate-950">
                          {court.courtNumber}번 코트
                        </span>
                        <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                          {court.status === 'playing' ? '🔴 LIVE 경기 중' : '⚪ 대기 중'}
                        </span>
                      </div>
                      <button
                        onClick={() => openScoreModal(court)}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold border border-slate-700 cursor-pointer"
                      >
                        점수 수정 ✎
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 items-center">
                      <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-amber-400">TEAM A</span>
                          <span className="text-xl font-black text-white">{court.scoreA}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-200">
                          {court.teamA.map((m, idx) => (
                            <p key={idx} className="truncate">{m}</p>
                          ))}
                        </div>
                      </div>

                      <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-emerald-400">TEAM B</span>
                          <span className="text-xl font-black text-white">{court.scoreB}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-200">
                          {court.teamB.map((m, idx) => (
                            <p key={idx} className="truncate">{m}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'kdk' && (
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-xs text-white">🎾 KDK 참가자 명단</span>
                    <div className="flex gap-1.5">
                      <button onClick={() => setQuickNames(8)} className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded-lg">8명</button>
                      <button onClick={() => setQuickNames(12)} className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded-lg">12명</button>
                    </div>
                  </div>
                  <textarea
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    rows={2}
                    value={participantsInput}
                    onChange={(e) => setParticipantsInput(e.target.value)}
                  />
                  <button
                    onClick={handleGenerateKdk}
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black rounded-xl text-xs cursor-pointer"
                  >
                    🏓 KDK 대진표 자동 편성
                  </button>
                </div>

                {kdkRounds.map((r, rIdx) => (
                  <div key={r.round} className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-2.5">
                    <div className="text-xs font-black text-emerald-400 border-b border-slate-800 pb-1.5 flex justify-between">
                      <span>{r.name}</span>
                      <span className="text-[10px] text-slate-400">{r.matches.length}개 코트</span>
                    </div>
                    <div className="space-y-2">
                      {r.matches.map((m, mIdx) => (
                        <div key={m.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-amber-400 font-bold">코트 {m.court}</span>
                            <button
                              onClick={() => toggleKdkMatchComplete(rIdx, mIdx)}
                              className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-emerald-300"
                            >
                              {m.completed ? '✓ 완료' : '진행중'}
                            </button>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-white truncate flex-1">{m.teamA.join(' / ')}</span>
                            <span className="font-black text-amber-400 mx-2">{m.scoreA} : {m.scoreB}</span>
                            <span className="font-bold text-white truncate flex-1 text-right">{m.teamB.join(' / ')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'tournament' && (
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-2.5">
                  <div className="text-xs font-black text-amber-400 border-b border-slate-800 pb-1.5">
                    🏆 배정된 토너먼트 경기 목록
                  </div>
                  <div className="space-y-2">
                    {groupMatches.map((m) => (
                      <div key={m.id} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                        <span className="text-[10px] font-bold text-amber-300">{m.court}코트</span>
                        <span className="font-bold text-white truncate">{m.teamA}</span>
                        <span className="font-black text-amber-400">{m.scoreA} : {m.scoreB}</span>
                        <span className="font-bold text-white truncate">{m.teamB}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'mypage' && (
              <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
                <h2 className="text-base font-black text-amber-400">☀️ {currentUser?.name} 회원님 마이페이지</h2>
                <p className="text-xs text-slate-300">등급: {currentUser?.grade} · 권한: {role === 'admin' ? '관리자' : '정회원'}</p>
              </div>
            )}

            {activeTab === 'admin' && (
              <AdminTournamentManager
                registeredUsers={users}
                currentUser={currentUser}
                activeTournament={activeTournament}
                onApplyTournament={(config) => applyTournamentToAppState(config, true)}
                onAddCustomUserToClub={handleAddCustomUserToClub}
              />
            )}
          </div>

          <nav className="fixed lg:absolute bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-2 py-2 flex justify-around items-center z-50 shadow-2xl">
            <button onClick={() => setActiveTab('courts')} className={`flex flex-col items-center py-1 px-2 rounded-xl cursor-pointer ${activeTab === 'courts' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
              <span className="text-base">🎾</span>
              <span className="text-[10px] mt-0.5">코트현황</span>
            </button>
            <button onClick={() => setActiveTab('kdk')} className={`flex flex-col items-center py-1 px-2 rounded-xl cursor-pointer ${activeTab === 'kdk' ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
              <span className="text-base">🔄</span>
              <span className="text-[10px] mt-0.5">KDK진행</span>
            </button>
            <button onClick={() => setActiveTab('tournament')} className={`flex flex-col items-center py-1 px-2 rounded-xl cursor-pointer ${activeTab === 'tournament' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
              <span className="text-base">🏆</span>
              <span className="text-[10px] mt-0.5">토너먼트</span>
            </button>
            <button onClick={() => setActiveTab('mypage')} className={`flex flex-col items-center py-1 px-2 rounded-xl cursor-pointer ${activeTab === 'mypage' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
              <span className="text-base">👤</span>
              <span className="text-[10px] mt-0.5">마이페이지</span>
            </button>
            <button
              onClick={() => {
                setRole('admin');
                setActiveTab('admin');
              }}
              className={`flex flex-col items-center py-1 px-2 rounded-xl cursor-pointer ${activeTab === 'admin' ? 'text-red-400 font-bold' : 'text-slate-400'}`}
            >
              <span className="text-base">👑</span>
              <span className="text-[10px] mt-0.5">대회·운영관리</span>
            </button>
          </nav>
        </main>
      </div>
    </div>
  );
}
