'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { generateKDKSchedule } from './lib/kdk';
import { generateFullTournamentTree } from './lib/tournament';
import { subscribeUserToPush } from './lib/pushNotification';
import MyPage from './components/MyPage';
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
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpGender, setSignUpGender] = useState('M');
  const [signUpGrade, setSignUpGrade] = useState('테린이');
  const [signUpPhone, setSignUpPhone] = useState('');

  const [activeTab, setActiveTab] = useState('courts');
  const [adminSubTab, setAdminSubTab] = useState('tournament_setup');
  const [role, setRole] = useState('admin');
  const [subTourTab, setSubTourTab] = useState('kdk');

  const [activeTournament, setActiveTournament] = useState(null);

  const [participantsInput, setParticipantsInput] = useState(
    '김철수, 박민수, 이영희, 최수진, 정지훈, 한지민, 송중기, 강동원'
  );
  const [generatedRounds, setGeneratedRounds] = useState([]);
  const [tournamentTree, setTournamentTree] = useState(() =>
    generateFullTournamentTree([
      { id: 't1', name: '김철수 / 강동원', wins: 3 },
      { id: 't2', name: '이영희 / 한지민', wins: 3 },
      { id: 't3', name: '박민수 / 정지훈', wins: 2 },
      { id: 't4', name: '최수진 / 김태희', wins: 2 },
      { id: 't5', name: '송중기 / 조인성', wins: 1 },
      { id: 't6', name: '공유 / 정우성', wins: 1 },
    ])
  );

  const [myStats, setMyStats] = useState({
    total_matches: 12,
    wins: 9,
    losses: 3,
    win_rate: 75.0,
    point_diff: 21,
  });
  const [myMatchHistory, setMyMatchHistory] = useState([
    {
      id: 'm1',
      round_name: '월례회 KDK 결승전',
      court_number: 1,
      score_a: 6,
      score_b: 4,
      is_win: true,
      partner: '강동원 (금배)',
      opponent: '박민수 / 정지훈',
      date: '2026.11.17',
    },
    {
      id: 'm2',
      round_name: '월례회 KDK 예선 R3',
      court_number: 2,
      score_a: 6,
      score_b: 3,
      is_win: true,
      partner: '이영희 (국화)',
      opponent: '최수진 / 한지민',
      date: '2026.11.17',
    },
  ]);

  const [courts, setCourts] = useState([
    {
      id: 1,
      courtNumber: 1,
      roundName: '제 1 라운드',
      status: 'playing',
      teamA: ['김철수 (금배)', '강동원 (금배)'],
      teamB: ['박민수 (은배)', '정지훈 (동배)'],
      scoreA: 5,
      scoreB: 3,
    },
    {
      id: 2,
      courtNumber: 2,
      roundName: '제 1 라운드',
      status: 'playing',
      teamA: ['이영희 (국화)', '한지민 (은배)'],
      teamB: ['최수진 (개나리)', '김태희 (테린이)'],
      scoreA: 2,
      scoreB: 4,
    },
    {
      id: 3,
      courtNumber: 3,
      roundName: '제 1 라운드',
      status: 'waiting',
      teamA: ['송중기 (동배)', '조인성 (은배)'],
      teamB: ['공유 (금배)', '정우성 (은배)'],
      scoreA: 0,
      scoreB: 0,
    },
  ]);

  const [users, setUsers] = useState([
    { id: 'u1', name: '김철수', email: 'chulsoo@suntc.kr', gender: '남', grade: '금배', role: 'admin' },
    { id: 'u2', name: '이영희', email: 'younghee@suntc.kr', gender: '여', grade: '국화', role: 'member' },
    { id: 'u3', name: '박민수', email: 'minsoo@suntc.kr', gender: '남', grade: '은배', role: 'member' },
    { id: 'u4', name: '정지훈', email: 'jihoon@suntc.kr', gender: '남', grade: '동배', role: 'member' },
    { id: 'u5', name: '최수진', email: 'sujin@suntc.kr', gender: '여', grade: '개나리', role: 'member' },
    { id: 'u6', name: '강동원', email: 'dongwon@suntc.kr', gender: '남', grade: '금배', role: 'member' },
    { id: 'u7', name: '한지민', email: 'jimin@suntc.kr', gender: '여', grade: '은배', role: 'member' },
    { id: 'u8', name: '송중기', email: 'joongki@suntc.kr', gender: '남', grade: '동배', role: 'member' },
    { id: 'u9', name: '조인성', email: 'insung@suntc.kr', gender: '남', grade: '은배', role: 'member' },
    { id: 'u10', name: '공유', email: 'admin@suntc.kr', gender: '남', grade: '금배', role: 'admin' },
  ]);

  const [selectedCourt, setSelectedCourt] = useState(null);
  const [inputScoreA, setInputScoreA] = useState(0);
  const [inputScoreB, setInputScoreB] = useState(0);
  const [inputStatus, setInputStatus] = useState('playing');
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    try {
      const savedUsersRaw = localStorage.getItem('sun_tennis_registered_users');
      if (savedUsersRaw) {
        const savedUsers = JSON.parse(savedUsersRaw);
        if (Array.isArray(savedUsers) && savedUsers.length > 0) {
          setUsers((prev) => {
            const existingIds = new Set(prev.map((u) => u.id));
            const merged = [...prev];
            savedUsers.forEach((su) => {
              if (!existingIds.has(su.id)) merged.unshift(su);
            });
            return merged;
          });
        }
      }

      const savedTournamentRaw = localStorage.getItem('sun_tennis_active_tournament');
      if (savedTournamentRaw) {
        const parsedTour = JSON.parse(savedTournamentRaw);
        if (parsedTour && parsedTour.title) {
          setActiveTournament(parsedTour);
        }
      }

      const savedSessionRaw = localStorage.getItem('sun_tennis_current_user');
      if (savedSessionRaw) {
        const savedUser = JSON.parse(savedSessionRaw);
        if (savedUser && savedUser.name) {
          setCurrentUser(savedUser);
          setRole(savedUser.role || 'admin');
        }
      }
    } catch {}

    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          const meta = session.user.user_metadata || {};
          const loggedIn = {
            id: session.user.id,
            name: meta.name || session.user.email?.split('@')[0] || '클럽회원',
            email: session.user.email,
            gender: meta.gender === 'F' ? '여' : '남',
            grade: meta.grade || '테린이',
            role: 'member',
          };
          setCurrentUser(loggedIn);
        }
      });
    }
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthMessage(null);

    if (isSignUp) {
      if (!signUpName.trim()) {
        setAuthMessage({ type: 'error', text: '이름을 입력해 주세요.' });
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
        let userId = `u_${Date.now()}`;

        if (isSupabaseConfigured) {
          const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                name: signUpName.trim(),
                gender: signUpGender,
                grade: signUpGrade,
                phone: signUpPhone.trim(),
              },
            },
          });
          if (error) {
            setAuthMessage({ type: 'error', text: `회원가입 실패: ${error.message}` });
            setAuthLoading(false);
            return;
          }
          if (data?.user?.id) {
            userId = data.user.id;
          }
        }

        const newMember = {
          id: userId,
          name: signUpName.trim(),
          email: email.trim(),
          gender: signUpGender === 'F' ? '여' : '남',
          grade: signUpGrade,
          role: 'member',
          phone: signUpPhone.trim(),
        };

        setUsers((prev) => [newMember, ...prev.filter((u) => u.email !== newMember.email)]);
        try {
          const prevSaved = JSON.parse(localStorage.getItem('sun_tennis_registered_users') || '[]');
          const updatedSaved = [
            { ...newMember, password },
            ...prevSaved.filter((u) => u.email !== newMember.email),
          ];
          localStorage.setItem('sun_tennis_registered_users', JSON.stringify(updatedSaved));
          localStorage.setItem('sun_tennis_current_user', JSON.stringify(newMember));
        } catch {}

        if (!participantsInput.includes(newMember.name)) {
          setParticipantsInput((prev) => `${newMember.name}, ${prev}`);
        }

        setCurrentUser(newMember);
        setRole('member');
        alert(`🎉 환영합니다, ${newMember.name} 회원님! [${newMember.grade}] 등급으로 회원가입 및 로그인이 완료되었습니다.`);
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
        if (isSupabaseConfigured) {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (error) {
            setAuthMessage({ type: 'error', text: `로그인 실패: ${error.message}` });
            setAuthLoading(false);
            return;
          }
          if (data?.user) {
            const meta = data.user.user_metadata || {};
            const loggedUser = {
              id: data.user.id,
              name: meta.name || email.split('@')[0],
              email: data.user.email,
              gender: meta.gender === 'F' ? '여' : '남',
              grade: meta.grade || '금배',
              role: 'member',
            };
            setCurrentUser(loggedUser);
            try {
              localStorage.setItem('sun_tennis_current_user', JSON.stringify(loggedUser));
            } catch {}
            return;
          }
        }

        let matchedUser;
        try {
          const savedList = JSON.parse(localStorage.getItem('sun_tennis_registered_users') || '[]');
          const foundLocal = savedList.find(
            (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
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
          matchedUser = users.find(
            (u) => u.email?.toLowerCase() === email.trim().toLowerCase() || u.name === email.trim()
          );
        }

        const loggedUser = matchedUser || {
          id: `u_${Date.now()}`,
          name: email.split('@')[0] || '김철수',
          email: email.trim(),
          gender: '남',
          grade: '금배',
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

  const handleQuickDemoLogin = () => {
    const demoUser = {
      id: 'u1',
      name: '김철수',
      email: 'chulsoo@suntc.kr',
      gender: '남',
      grade: '금배',
      role: 'admin',
    };
    setCurrentUser(demoUser);
    setRole('admin');
    try {
      localStorage.setItem('sun_tennis_current_user', JSON.stringify(demoUser));
    } catch {}
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    try {
      localStorage.removeItem('sun_tennis_current_user');
    } catch {}
    setCurrentUser(null);
    setPassword('');
    setConfirmPassword('');
    setAuthMessage(null);
  };

  const handleApplyAdminTournament = async (config) => {
    setActiveTournament(config);
    try {
      localStorage.setItem('sun_tennis_active_tournament', JSON.stringify(config));
    } catch {}

    if (config.participants && config.participants.length > 0) {
      setParticipantsInput(config.participants.map((p) => p.name).join(', '));
    }

    const mappedCourts = config.matches.map((m, idx) => ({
      id: m.id || idx + 1,
      courtNumber: m.courtNumber,
      roundName: m.roundName,
      status: m.status || (idx < config.selectedCourts.length ? 'playing' : 'waiting'),
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
    setCourts(mappedCourts);

    const roundMap = new Map();
    config.matches.forEach((m) => {
      const rNum = m.round || 1;
      if (!roundMap.has(rNum)) {
        roundMap.set(rNum, {
          round: rNum,
          roundName: m.roundName,
          matches: [],
        });
      }
      roundMap.get(rNum).matches.push({
        court: m.courtNumber,
        team1: [
          `${m.teamA[0].name} (${m.teamA[0].grade})`,
          `${m.teamA[1].name} (${m.teamA[1].grade})`,
        ],
        team2: [
          `${m.teamB[0].name} (${m.teamB[0].grade})`,
          `${m.teamB[1].name} (${m.teamB[1].grade})`,
        ],
      });
    });

    setGeneratedRounds(Array.from(roundMap.values()));

    if (config.mode === 'TOURNAMENT') {
      setSubTourTab('bracket');
      const bracketTeams = [];
      config.matches.forEach((m, idx) => {
        bracketTeams.push({
          id: `ta_${idx}`,
          name: `${m.teamA[0].name} / ${m.teamA[1].name}`,
          wins: 3,
        });
        bracketTeams.push({
          id: `tb_${idx}`,
          name: `${m.teamB[0].name} / ${m.teamB[1].name}`,
          wins: 2,
        });
      });
      if (bracketTeams.length >= 2) {
        try {
          setTournamentTree(generateFullTournamentTree(bracketTeams));
        } catch {}
      }
    } else {
      setSubTourTab('kdk');
    }

    if (isSupabaseConfigured) {
      try {
        const { data: tourRow } = await supabase
          .from('tournaments')
          .insert({
            title: config.title,
            type: config.mode,
            status: 'ongoing',
            assignment_type: config.assignmentType,
            selected_courts: config.selectedCourts,
          })
          .select()
          .single();

        if (tourRow?.id) {
          const matchRows = config.matches.map((m) => ({
            tournament_id: tourRow.id,
            round_name: m.roundName,
            court_number: m.courtNumber,
            team_a: [],
            team_b: [],
            team_a_names: [m.teamA[0].name, m.teamA[1].name],
            team_b_names: [m.teamB[0].name, m.teamB[1].name],
            score_a: m.scoreA,
            score_b: m.scoreB,
            status: m.status,
          }));
          await supabase.from('matches').insert(matchRows);
        }
      } catch {}
    }

    setActiveTab('courts');
    alert(
      `🚀 [${config.title}] (${config.mode === 'KDK' ? 'KDK 방식' : '토너먼트 방식'}) 대회가 개설되어 실시간 코트(${config.matches.length}경기)와 대진표에 즉시 연동되었습니다!`
    );
  };

  const handleAddCustomUserToClub = (guestPlayer) => {
    setUsers((prev) => {
      if (prev.some((u) => u.id === guestPlayer.id || u.name === guestPlayer.name)) {
        return prev;
      }
      const added = {
        id: guestPlayer.id,
        name: guestPlayer.name,
        gender: guestPlayer.gender,
        grade: guestPlayer.grade,
        role: 'member',
        isGuest: true,
      };
      return [...prev, added];
    });
  };

  const handleGenerateBracket = () => {
    const names = participantsInput
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length < 4) {
      alert('최소 4명 이상의 참가자가 필요합니다.');
      return;
    }

    const playerObjects = names.map((name, idx) => {
      const existing = users.find((u) => u.name === name);
      return {
        id: existing?.id || `p_${idx}`,
        name,
        grade: existing?.grade || '은배',
      };
    });

    try {
      const numCourts = Math.max(1, Math.min(4, Math.floor(names.length / 4)));
      const kdkSchedule = generateKDKSchedule(playerObjects, numCourts, 3);
      const rounds = kdkSchedule.map((r) => ({
        round: r.round,
        roundName: `제 ${r.round} 라운드`,
        matches: r.matches.map((m) => ({
          court: m.courtNumber,
          team1: [`${m.teamA[0].name} (${m.teamA[0].grade})`, `${m.teamA[1].name} (${m.teamA[1].grade})`],
          team2: [`${m.teamB[0].name} (${m.teamB[0].grade})`, `${m.teamB[1].name} (${m.teamB[1].grade})`],
        })),
      }));
      setGeneratedRounds(rounds);
    } catch {
      const rounds = [];
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
        rounds.push({ round: r, matches });
      }
      setGeneratedRounds(rounds);
    }
  };

  const applyGeneratedRoundToCourts = (roundItem) => {
    const newCourts = roundItem.matches.map((m, idx) => ({
      id: idx + 1,
      courtNumber: m.court,
      roundName: roundItem.roundName || `제 ${roundItem.round} 라운드`,
      status: idx === 0 ? 'playing' : 'waiting',
      teamA: m.team1,
      teamB: m.team2,
      scoreA: 0,
      scoreB: 0,
    }));
    setCourts(newCourts);
    setActiveTab('courts');
    alert(`🎾 제 ${roundItem.round} 라운드 대진이 실시간 코트 현황판에 배정되었습니다!`);
  };

  const handleGenerateTournamentTree = () => {
    const names = participantsInput
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    const teams = [];
    for (let i = 0; i < names.length; i += 2) {
      const p1 = names[i];
      const p2 = names[i + 1] || '파트너';
      teams.push({
        id: `team_${teams.length + 1}`,
        name: `${p1} / ${p2}`,
        wins: Math.max(0, 4 - Math.floor(i / 2)),
      });
    }

    if (teams.length < 2) {
      alert('본선 토너먼트 생성을 위해 최소 4명(2팀) 이상이 필요합니다.');
      return;
    }

    const tree = generateFullTournamentTree(teams);
    setTournamentTree(tree);
  };

  const setQuickNames = (count) => {
    if (count === 8) {
      setParticipantsInput('김철수, 박민수, 이영희, 최수진, 정지훈, 한지민, 송중기, 강동원');
    } else {
      setParticipantsInput('김철수, 박민수, 이영희, 최수진, 정지훈, 한지민, 송중기, 강동원, 조인성, 공유, 김태희, 전지현');
    }
  };

  const openScoreModal = (court) => {
    setSelectedCourt(court);
    setInputScoreA(court.scoreA);
    setInputScoreB(court.scoreB);
    setInputStatus(court.status);
  };

  const saveCourtScore = () => {
    if (!selectedCourt) return;
    const numA = Number(inputScoreA);
    const numB = Number(inputScoreB);

    setCourts(
      courts.map((c) =>
        c.id === selectedCourt.id
          ? {
              ...c,
              scoreA: numA,
              scoreB: numB,
              status: inputStatus,
            }
          : c
      )
    );

    if (inputStatus === 'completed') {
      const isWin = numA >= numB;
      const diff = numA - numB;

      setMyStats((prev) => {
        const total = prev.total_matches + 1;
        const wins = prev.wins + (isWin ? 1 : 0);
        const losses = prev.losses + (isWin ? 0 : 1);
        const win_rate = Number(((wins / total) * 100).toFixed(1));
        return {
          total_matches: total,
          wins,
          losses,
          win_rate,
          point_diff: prev.point_diff + diff,
        };
      });

      setMyMatchHistory((prev) => [
        {
          id: `m_${Date.now()}`,
          round_name: selectedCourt.roundName || `실시간 코트 ${selectedCourt.courtNumber}번 매치`,
          court_number: selectedCourt.courtNumber,
          score_a: numA,
          score_b: numB,
          is_win: isWin,
          partner: selectedCourt.teamA[1] || '파트너',
          opponent: selectedCourt.teamB.join(' / '),
          date: '오늘',
        },
        ...prev,
      ]);
    }

    setSelectedCourt(null);
  };

  const handleUserGradeChange = (userId, newGrade) => {
    setUsers(users.map((u) => (u.id === userId ? { ...u, grade: newGrade } : u)));
    if (currentUser && currentUser.id === userId) {
      const updated = { ...currentUser, grade: newGrade };
      setCurrentUser(updated);
      try {
        localStorage.setItem('sun_tennis_current_user', JSON.stringify(updated));
      } catch {}
    }
    if (isSupabaseConfigured) {
      supabase.from('users').update({ grade: newGrade }).eq('id', userId).then(() => {});
    }
  };

  const handleUserRoleChange = (userId, newRole) => {
    setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    if (currentUser && currentUser.id === userId) {
      const updated = { ...currentUser, role: newRole };
      setCurrentUser(updated);
      setRole(newRole);
      try {
        localStorage.setItem('sun_tennis_current_user', JSON.stringify(updated));
      } catch {}
    }
    if (isSupabaseConfigured) {
      supabase.from('users').update({ role: newRole }).eq('id', userId).then(() => {});
    }
  };

  const toggleRole = () => {
    setRole((prev) => (prev === 'admin' ? 'member' : 'admin'));
  };

  const requestPushPermission = async () => {
    if (isSupabaseConfigured && currentUser?.id) {
      const sub = await subscribeUserToPush(currentUser.id, supabase);
      if (sub) {
        setIsPushSubscribed(true);
        return;
      }
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setIsPushSubscribed(true);
        alert('🔔 썬 테니스 클럽 코트 출전 알림이 활성화되었습니다!');
      }
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
              className="w-full h-48 lg:h-[540px] object-cover object-center"
              onError={(e) => {
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
                실시간 코트 스코어 중계 · KDK 복식 대진표 자동 생성 · 개인 승률 및 랭킹 통합 관리 시스템
              </p>
              <div className="hidden lg:grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-800/80 text-center text-xs">
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-amber-400 font-black block text-sm">실시간 코트</span>
                  <span className="text-[11px] text-slate-400">라이브 스코어</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-black block text-sm">KDK / 토너먼트</span>
                  <span className="text-[11px] text-slate-400">자동·수동 배정</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-orange-400 font-black block text-sm">공식 전적</span>
                  <span className="text-[11px] text-slate-400">승률/득실 랭킹</span>
                </div>
              </div>
            </div>
          </div>

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
                  ? '아래 가입 폼을 작성하면 즉시 클럽 회원으로 등록됩니다.'
                  : '로그인하거나 회원가입 버튼을 눌러 새 계정을 만드세요.'}
              </p>
            </div>

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
                        onChange={(e) => setSignUpGender(e.target.value)}
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
        <aside className="hidden lg:flex flex-col w-[380px] shrink-0 sticky top-6 space-y-4">
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-amber-500/20 group">
            <img
              src="/sun-tennis-hero.jpg"
              alt="썬 테니스 클럽"
              className="w-full h-56 object-cover object-center group-hover:scale-105 transition-transform duration-700"
              onError={(e) => {
                e.target.src = '/sun-banner.png';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent flex flex-col justify-end p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 uppercase tracking-wider shadow-sm">
                  Official Club
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  라이브 운영 중
                </span>
              </div>
              <h1 className="text-2xl font-black text-white flex items-center gap-2">
                <span className="text-amber-400 text-3xl">☀️</span>
                <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-orange-400 bg-clip-text text-transparent">
                  썬 테니스 클럽
                </span>
              </h1>
              <p className="text-xs text-slate-300 font-medium mt-1 leading-relaxed">
                태양처럼 뜨거운 열정과 페어플레이! 회원들의 실시간 코트 대진 및 경기 통합 시스템
              </p>
            </div>
          </div>

          <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-4 border border-slate-800 shadow-xl space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <i className="fa-solid fa-location-dot text-amber-400" /> 코트 가동 현황
              </span>
              <span className="text-xs font-extrabold text-amber-400">총 {courts.length}경기 배정</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/50">
                <span className="text-slate-400 block text-[11px]">진행 중인 경기</span>
                <span className="text-lg font-black text-emerald-400">
                  {courts.filter((c) => c.status === 'playing').length} 코트 🔴
                </span>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/50">
                <span className="text-slate-400 block text-[11px]">등록 선수 풀</span>
                <span className="text-lg font-black text-amber-400">{users.length} 명 👥</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-950/50 via-slate-900 to-amber-950/40 rounded-2xl p-4 border border-amber-500/30 shadow-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-300">👑 관리자 대회/코트 배치</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold">
                자동·수동 지원
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              대회명 생성, 토너먼트/KDK 선택, 미로그인 임의 선수 추가 및 코트 배정을 한 곳에서 관리하세요.
            </p>
            <button
              onClick={() => {
                setActiveTab('admin');
                setAdminSubTab('tournament_setup');
              }}
              className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl text-xs shadow-md cursor-pointer"
            >
              ⚙️ 대회 개설 & 선수 배치 콘솔 열기
            </button>
          </div>
        </aside>

        <div className="w-full max-w-md mx-auto bg-slate-900/95 lg:rounded-3xl border-x lg:border border-slate-800/80 shadow-2xl min-h-screen lg:min-h-[840px] pb-24 relative overflow-hidden backdrop-blur-xl">
          <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/80 px-4 py-3.5 border-b border-amber-500/20 sticky top-0 z-40 backdrop-blur-md flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-lime-400 p-0.5 shadow-md shadow-amber-500/20 animate-pulse">
                  <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-lg">
                    ☀️
                  </div>
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full" />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                    SUN TENNIS
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    LIVE
                  </span>
                </div>
                <div className="text-sm font-extrabold text-white flex items-center gap-1.5">
                  <span>{currentUser.name} 회원님</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    {currentUser.grade}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleRole}
                className={`text-[10px] px-2 py-1 rounded-xl font-bold transition border cursor-pointer ${
                  role === 'admin'
                    ? 'bg-red-950/80 text-red-300 border-red-500/40'
                    : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
                }`}
              >
                {role === 'admin' ? '👑 관리자' : '👤 회원'}
              </button>
              <button
                onClick={handleLogout}
                className="text-[10px] px-2 py-1 rounded-xl font-bold bg-slate-800/90 hover:bg-red-950/80 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-500/40 transition cursor-pointer"
              >
                로그아웃
              </button>
            </div>
          </header>

          <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-950/90 via-slate-900 to-slate-950 border-b border-emerald-500/30 flex justify-between items-center text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-medium">
              <i className="fa-solid fa-bell text-amber-400" />
              <span>내 출전 차례 시 실시간 알림 받기</span>
            </div>
            <button
              onClick={requestPushPermission}
              className={`px-2.5 py-1 font-black rounded-lg text-[11px] shadow-sm transition cursor-pointer ${
                isPushSubscribed
                  ? 'bg-slate-800 text-emerald-400'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-950 hover:from-emerald-500 hover:to-teal-500'
              }`}
            >
              {isPushSubscribed ? '알림 켜짐 ✓' : '알림 켜기'}
            </button>
          </div>

          <main className="p-3">
            {activeTab === 'courts' && (
              <div className="space-y-3.5">
                {activeTournament && (
                  <div className="bg-gradient-to-r from-amber-500/20 via-slate-900 to-emerald-500/20 border border-amber-400/40 rounded-2xl p-3 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-black text-amber-300 uppercase block">
                        🏆 진행 중인 공식 대회 ({activeTournament.mode === 'KDK' ? 'KDK 방식' : '토너먼트 방식'})
                      </span>
                      <p className="text-xs font-extrabold text-white mt-0.5">
                        {activeTournament.title}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setActiveTab('admin');
                        setAdminSubTab('tournament_setup');
                      }}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-900 text-amber-300 border border-amber-400/30 font-bold cursor-pointer"
                    >
                      대진 수정
                    </button>
                  </div>
                )}

                <div className="flex justify-between items-center bg-gradient-to-r from-emerald-950/80 via-slate-900 to-amber-950/60 p-3 rounded-2xl border border-emerald-500/20 shadow-md">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </span>
                    <h2 className="text-sm font-extrabold text-white">썬 클럽 실시간 코트 현황</h2>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('admin');
                      setAdminSubTab('tournament_setup');
                    }}
                    className="text-[11px] font-bold text-amber-300 bg-amber-400/15 hover:bg-amber-400/25 px-2.5 py-1 rounded-full border border-amber-400/30 cursor-pointer"
                  >
                    + 대회/코트 배정
                  </button>
                </div>

                <div className="space-y-3.5">
                  {courts.map((court) => {
                    const isPlaying = court.status === 'playing';
                    const isCompleted = court.status === 'completed';
                    return (
                      <div
                        key={court.id}
                        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-750 p-4 shadow-xl hover:border-amber-500/30 transition-all group"
                      >
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-md">
                              {court.courtNumber}
                            </span>
                            <div>
                              <span className="font-extrabold text-sm text-white block leading-tight">
                                {court.courtNumber}번 코트
                              </span>
                              {court.roundName && (
                                <span className="text-[10px] text-amber-300 font-bold">
                                  {court.roundName}
                                </span>
                              )}
                            </div>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                              isPlaying
                                ? 'bg-red-950/80 text-red-300 border-red-500/40 animate-pulse'
                                : isCompleted
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {isPlaying
                              ? '🔴 경기 진행 중'
                              : isCompleted
                              ? '🏁 경기 완료'
                              : '⚪ 다음 경기 대기'}
                          </span>
                        </div>

                        <div className="grid grid-cols-7 gap-2 items-center bg-slate-950/90 p-3.5 rounded-xl border border-slate-800/80 mb-3 shadow-inner">
                          <div className="col-span-3 text-center">
                            <span className="text-[10px] uppercase font-extrabold text-emerald-400 block mb-0.5">TEAM SUN</span>
                            <p className="text-sm font-bold text-white truncate">{court.teamA.join(' / ')}</p>
                          </div>
                          <div className="col-span-1 flex flex-col items-center justify-center">
                            <div className="px-2 py-1 rounded-lg bg-slate-950 border border-amber-500/30 shadow-md">
                              <span className="text-xl font-black text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
                                {court.scoreA} : {court.scoreB}
                              </span>
                            </div>
                            <span className="text-[9px] text-slate-500 font-bold mt-0.5">GAME</span>
                          </div>
                          <div className="col-span-3 text-center">
                            <span className="text-[10px] uppercase font-extrabold text-amber-400 block mb-0.5">TEAM ACE</span>
                            <p className="text-sm font-bold text-white truncate">{court.teamB.join(' / ')}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => openScoreModal(court)}
                          className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>⚡</span>
                          <span>실시간 스코어 입력 / 결과 저장</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'tournament' && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-emerald-500/15 border border-amber-500/30 rounded-2xl p-3.5 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-black text-amber-300 block">
                      👑 대회명 생성 · 토너먼트/KDK · 자동/수동 코트 배치
                    </span>
                    <span className="text-[11px] text-slate-400">
                      로그인 회원 선택 및 미로그인 선수 임의 추가 지원
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('admin');
                      setAdminSubTab('tournament_setup');
                    }}
                    className="px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl text-xs shadow-md shrink-0 cursor-pointer"
                  >
                    대회 관리 콘솔
                  </button>
                </div>

                <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-extrabold text-sm text-white flex items-center gap-1.5">
                      <span className="text-amber-400">☀️</span> 빠른 참가자 명단 입력 (쉼표 구분)
                    </h3>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setQuickNames(8)}
                        className="text-[10px] px-2 py-0.8 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 cursor-pointer"
                      >
                        8명
                      </button>
                      <button
                        onClick={() => setQuickNames(12)}
                        className="text-[10px] px-2 py-0.8 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 cursor-pointer"
                      >
                        12명
                      </button>
                    </div>
                  </div>

                  <textarea
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono leading-relaxed"
                    rows={3}
                    value={participantsInput}
                    onChange={(e) => setParticipantsInput(e.target.value)}
                  />

                  <button
                    onClick={handleGenerateBracket}
                    className="w-full py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>🏓</span>
                    <span>썬 클럽 실시간 KDK 대진표 자동 생성</span>
                  </button>
                </div>

                {generatedRounds.length > 0 && (
                  <div className="space-y-3 animate-fade-in">
                    <div className="flex justify-between items-center px-1">
                      <h4 className="text-xs font-extrabold text-amber-300">
                        ✨ {activeTournament ? `${activeTournament.title} 대진표` : '생성된 실시간 대진표'} ({generatedRounds.length}개 라운드)
                      </h4>
                      <span className="text-[10px] text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                        연동 완료
                      </span>
                    </div>

                    {generatedRounds.map((gr) => (
                      <div key={gr.round} className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-2">
                        <div className="text-xs font-black text-amber-400 border-b border-slate-800 pb-1.5 flex justify-between items-center">
                          <span>{gr.roundName || `제 ${gr.round} 라운드`}</span>
                          <button
                            onClick={() => applyGeneratedRoundToCourts(gr)}
                            className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold cursor-pointer"
                          >
                            ⚡ 이 라운드 코트 배정
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {gr.matches.map((m, idx) => (
                            <div key={idx} className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                              <span className="font-extrabold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20 text-[10px]">
                                코트 {m.court}
                              </span>
                              <span className="font-bold text-white truncate max-w-[115px]">{m.team1[0]} / {m.team1[1]}</span>
                              <span className="font-black text-slate-500 text-[10px]">VS</span>
                              <span className="font-bold text-white truncate max-w-[115px]">{m.team2[0]} / {m.team2[1]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 text-xs font-bold">
                  <button
                    onClick={() => setSubTourTab('kdk')}
                    className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
                      subTourTab === 'kdk'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🎾 KDK 예선 리그
                  </button>
                  <button
                    onClick={() => setSubTourTab('bracket')}
                    className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
                      subTourTab === 'bracket'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🏆 본선 토너먼트
                  </button>
                </div>

                {subTourTab === 'kdk' ? (
                  <div className="space-y-3">
                    <div className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-2">
                      <div className="text-xs font-black text-emerald-400 border-b border-slate-800 pb-1.5 flex justify-between">
                        <span>제 1 라운드 (기본 KDK 밸런싱)</span>
                        <span className="text-slate-400 font-normal text-[11px]">2개 코트 진행</span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                          <span className="font-extrabold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-lg border border-emerald-400/20 text-[10px]">코트 1</span>
                          <span className="font-bold text-white">김철수 / 강동원</span>
                          <span className="font-black text-slate-500 text-[10px]">VS</span>
                          <span className="font-bold text-white">박민수 / 정지훈</span>
                        </div>
                        <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                          <span className="font-extrabold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-lg border border-emerald-400/20 text-[10px]">코트 2</span>
                          <span className="font-bold text-white">이영희 / 한지민</span>
                          <span className="font-black text-slate-500 text-[10px]">VS</span>
                          <span className="font-bold text-white">최수진 / 송중기</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 flex justify-between items-center">
                      <div>
                        <span className="text-xs font-black text-amber-400 block">
                          본선 토너먼트 브래킷 ({tournamentTree?.tournamentSize || 8}강)
                        </span>
                        <span className="text-[11px] text-slate-400">
                          참가 {tournamentTree?.totalTeams || 6}팀 · 부전승(BYE) {tournamentTree?.byeCount || 2}팀 자동 배정
                        </span>
                      </div>
                      <button
                        onClick={handleGenerateTournamentTree}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black shadow-md cursor-pointer"
                      >
                        명단으로 재편성
                      </button>
                    </div>

                    {tournamentTree && (
                      <div className="space-y-3">
                        {tournamentTree.rounds.map((r) => (
                          <div key={r.roundIndex} className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-2">
                            <div className="text-xs font-black text-amber-400 border-b border-slate-800 pb-1.5 flex justify-between">
                              <span>🏆 {r.title}</span>
                              <span className="text-[11px] text-slate-400 font-normal">{r.matches.length}경기</span>
                            </div>
                            <div className="space-y-2">
                              {r.matches.map((m) => (
                                <div key={m.matchNumber} className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 space-y-1 text-xs">
                                  <div className="flex justify-between items-center">
                                    <span className={`font-bold ${m.teamA?.isBye ? 'text-slate-500 italic' : 'text-white'}`}>
                                      {m.teamA?.name || '승자 대기'}
                                    </span>
                                    {m.winner && m.teamA && m.winner.id === m.teamA.id && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-black">
                                        진출
                                      </span>
                                    )}
                                  </div>
                                  <div className="border-t border-slate-800/70 pt-1 flex justify-between items-center">
                                    <span className={`font-bold ${m.teamB?.isBye ? 'text-slate-500 italic' : 'text-white'}`}>
                                      {m.teamB?.name || '승자 대기'}
                                    </span>
                                    {m.winner && m.teamB && m.winner.id === m.teamB.id && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-black">
                                        진출
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'mypage' && (
              <MyPage
                userId={currentUser.id}
                userName={currentUser.name}
                userGrade={currentUser.grade}
                userGender={currentUser.gender}
                customStats={myStats}
                customHistory={myMatchHistory}
              />
            )}

            {activeTab === 'admin' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-black">
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('tournament_setup')}
                    className={`py-2.5 rounded-xl transition cursor-pointer ${
                      adminSubTab === 'tournament_setup'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🏆 대회 생성 & 코트 배치
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('members')}
                    className={`py-2.5 rounded-xl transition cursor-pointer ${
                      adminSubTab === 'members'
                        ? 'bg-gradient-to-r from-red-500 to-orange-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    👑 회원 등급 & 권한 ({users.length})
                  </button>
                </div>

                {adminSubTab === 'tournament_setup' ? (
                  <AdminTournamentManager
                    registeredUsers={users}
                    currentUser={currentUser}
                    activeTournament={activeTournament}
                    onApplyTournament={handleApplyAdminTournament}
                    onAddCustomUserToClub={handleAddCustomUserToClub}
                  />
                ) : (
                  <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <h3 className="text-sm font-black text-red-400 flex items-center gap-1.5">
                        <span>👑</span> 썬 클럽 회원 등급 & 권한 관리
                      </h3>
                      <span className="text-[11px] text-slate-400">총 {users.length}명 등록</span>
                    </div>
                    <div className="space-y-2.5">
                      {users.map((u) => (
                        <div key={u.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                          <div>
                            <div className="font-bold text-white flex items-center gap-1">
                              <span>{u.name}</span>
                              <span className="text-[10px] text-slate-400">({u.gender})</span>
                              {u.isGuest && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  임의추가
                                </span>
                              )}
                              {currentUser.id === u.id && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  나
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-amber-400 font-bold">
                              {u.role === 'admin' ? '👑 운영자' : '일반회원'}
                            </span>
                          </div>
                          <div className="flex gap-1.5 items-center">
                            <select
                              value={u.grade}
                              onChange={(e) => handleUserGradeChange(u.id, e.target.value)}
                              className="bg-slate-900 border border-slate-700 text-amber-300 text-[11px] font-bold rounded-lg px-2 py-1 focus:outline-none"
                            >
                              {GRADE_OPTIONS.map((g) => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                            <select
                              value={u.role}
                              onChange={(e) => handleUserRoleChange(u.id, e.target.value)}
                              className={`border text-[11px] font-bold rounded-lg px-2 py-1 focus:outline-none ${
                                u.role === 'admin'
                                  ? 'bg-red-950/80 text-red-300 border-red-500/40'
                                  : 'bg-slate-900 text-slate-400 border-slate-700'
                              }`}
                            >
                              <option value="member">회원</option>
                              <option value="admin">관리자</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>

          <nav className="fixed lg:absolute bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-950/90 backdrop-blur-md border-t border-slate-800/80 px-3 py-2 flex justify-around items-center z-50 shadow-2xl">
            <button
              onClick={() => setActiveTab('courts')}
              className={`flex flex-col items-center py-1 px-3 rounded-2xl transition-all cursor-pointer ${
                activeTab === 'courts'
                  ? 'text-amber-400 font-bold scale-105 bg-amber-400/10'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <span className="text-lg">🎾</span>
              <span className="text-[10px] mt-0.5">실시간 코트</span>
            </button>

            <button
              onClick={() => setActiveTab('tournament')}
              className={`flex flex-col items-center py-1 px-3 rounded-2xl transition-all cursor-pointer ${
                activeTab === 'tournament'
                  ? 'text-amber-400 font-bold scale-105 bg-amber-400/10'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <span className="text-lg">📊</span>
              <span className="text-[10px] mt-0.5">대진표</span>
            </button>

            <button
              onClick={() => setActiveTab('mypage')}
              className={`flex flex-col items-center py-1 px-3 rounded-2xl transition-all cursor-pointer ${
                activeTab === 'mypage'
                  ? 'text-amber-400 font-bold scale-105 bg-amber-400/10'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <span className="text-lg">👤</span>
              <span className="text-[10px] mt-0.5">마이페이지</span>
            </button>

            <button
              onClick={() => setActiveTab('admin')}
              className={`flex flex-col items-center py-1 px-3 rounded-2xl transition-all cursor-pointer ${
                activeTab === 'admin'
                  ? 'text-red-400 font-bold scale-105 bg-red-400/10'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <span className="text-lg">⚙️</span>
              <span className="text-[10px] mt-0.5">운영관리</span>
            </button>
          </nav>
        </div>
      </div>

      {selectedCourt && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-sm p-5 shadow-2xl text-white space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-amber-400 flex items-center gap-1.5">
                <span>🎾</span> 코트 {selectedCourt.courtNumber}번 스코어 입력
              </h3>
              <button
                onClick={() => setSelectedCourt(null)}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center space-y-2">
                <span className="text-xs font-bold text-emerald-400 block">Team A 게임 스코어</span>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setInputScoreA((prev) => Math.max(0, Number(prev) - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-base"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={inputScoreA}
                    onChange={(e) => setInputScoreA(e.target.value)}
                    className="w-14 text-center font-black text-2xl bg-transparent text-amber-300 focus:outline-none"
                  />
                  <button
                    onClick={() => setInputScoreA((prev) => Number(prev) + 1)}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-base"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center space-y-2">
                <span className="text-xs font-bold text-amber-400 block">Team B 게임 스코어</span>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setInputScoreB((prev) => Math.max(0, Number(prev) - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-base"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={inputScoreB}
                    onChange={(e) => setInputScoreB(e.target.value)}
                    className="w-14 text-center font-black text-2xl bg-transparent text-amber-300 focus:outline-none"
                  />
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
                <option value="completed">🏁 경기 완료 (마이페이지 전적 자동 집계)</option>
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
