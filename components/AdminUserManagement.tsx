'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import BirthDateSelector from './BirthDateSelector';
import {
  calculateKoreanManAge,
  formatBirthDateDisplay,
  formatManAgeLabel,
} from '../lib/age';

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

export interface ManagedMember {
  id: string;
  username?: string;
  password?: string;
  name: string;
  email?: string;
  gender: 'M' | 'F' | string;
  grade: string;
  role: 'member' | 'admin';
  phone?: string;
  birthDate?: string; // 생년월일 (YYYY-MM-DD)
  age?: number; // 만 나이 (자동 계산)
  isGuest?: boolean;
  approvalStatus?: 'pending' | 'approved';
  requestedAt?: string;
}

interface AdminUserManagementProps {
  externalUsers?: ManagedMember[];
  currentUserId?: string;
  onUpdateMember?: (updated: ManagedMember) => void;
  onCancelMembership?: (userId: string, userName: string) => void;
  onAddMember?: (newMember: ManagedMember) => void;
  onApproveMember?: (approved: ManagedMember) => void;
  onRejectMember?: (userId: string, userName: string) => void;
}

export default function AdminUserManagement({
  externalUsers,
  currentUserId,
  onUpdateMember,
  onCancelMembership,
  onAddMember,
  onApproveMember,
  onRejectMember,
}: AdminUserManagementProps) {
  const [users, setUsers] = useState<ManagedMember[]>(
    externalUsers || [
      { id: 'p1', name: '김철수', email: 'chulsoo@suntc.kr', gender: 'M', grade: '금배', role: 'member', birthDate: '1972-05-14' },
      { id: 'p2', name: '강동원', email: 'dongwon@suntc.kr', gender: 'M', grade: '금배', role: 'member', birthDate: '1981-01-18' },
      { id: 'p3', name: '박민수', email: 'minsoo@suntc.kr', gender: 'M', grade: '은배', role: 'member', birthDate: '1975-03-22' },
      { id: 'p4', name: '정지훈', email: 'jihoon@suntc.kr', gender: 'M', grade: '동배', role: 'member', birthDate: '1983-06-25' },
      { id: 'p5', name: '이영희', email: 'younghee@suntc.kr', gender: 'F', grade: '국화', role: 'member', birthDate: '1974-08-10' },
      { id: 'p6', name: '한지민', email: 'jimin@suntc.kr', gender: 'F', grade: '은배', role: 'member', birthDate: '1984-11-05' },
      { id: 'p7', name: '최수진', email: 'sujin@suntc.kr', gender: 'F', grade: '개나리', role: 'member', birthDate: '1978-04-12' },
      { id: 'p8', name: '송중기', email: 'joongki@suntc.kr', gender: 'M', grade: '동배', role: 'member', birthDate: '1987-09-19' },
      { id: 'p10', name: '공유', email: 'admin@suntc.kr', gender: 'M', grade: '금배', role: 'admin', birthDate: '1979-07-10' },
    ]
  );

  // 검색 필터 상태
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 섹션별 및 개별 회원 항목 접기/펼치기 상태 (기본값: 접힌 상태, 항목 클릭 시 펼쳐서 수정)
  const [isPendingSectionOpen, setIsPendingSectionOpen] = useState<boolean>(false);
  const [isMemberSectionOpen, setIsMemberSectionOpen] = useState<boolean>(false);
  const [expandedMemberIds, setExpandedMemberIds] = useState<Record<string, boolean>>({});

  const toggleExpandMember = (memberId: string) => {
    setExpandedMemberIds((prev) => ({ ...prev, [memberId]: !prev[memberId] }));
  };

  // 상세 정보 수정 모달 대상 회원 상태
  const [editingMember, setEditingMember] = useState<ManagedMember | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');
  const [showEditPassword, setShowEditPassword] = useState<boolean>(true);
  const [editPhone, setEditPhone] = useState<string>('');
  const [editBirthDate, setEditBirthDate] = useState<string>('');
  const [editGender, setEditGender] = useState<'M' | 'F'>('M');
  const [editGrade, setEditGrade] = useState<string>('은배');
  const [editRole, setEditRole] = useState<'member' | 'admin'>('member');

  // 관리자 신규 회원 직접 등록 폼 토글 및 상태
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newBirthDate, setNewBirthDate] = useState<string>('');
  const [newGender, setNewGender] = useState<'M' | 'F'>('M');
  const [newGrade, setNewGrade] = useState<string>('테린이');
  const [newRole, setNewRole] = useState<'member' | 'admin'>('member');

  useEffect(() => {
    if (externalUsers) {
      setUsers(externalUsers);
    } else if (isSupabaseConfigured) {
      fetchUsersFromDb();
    }
  }, [externalUsers]);

  const fetchUsersFromDb = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        setUsers(data as ManagedMember[]);
      }
    } catch {}
  };

  // 회원 정보 수정 모달 열기 (아이디 및 저장된 비밀번호까지 불러오기)
  const openEditModal = (member: ManagedMember) => {
    let resolvedPassword = member.password || '';
    if (!resolvedPassword) {
      try {
        const savedList = JSON.parse(localStorage.getItem('sun_tennis_registered_users') || '[]');
        const found = savedList.find(
          (u: any) =>
            u.id === member.id ||
            (member.username && u.username?.toLowerCase() === member.username.toLowerCase()) ||
            (member.email && u.email?.toLowerCase() === member.email.toLowerCase())
        );
        if (found?.password) {
          resolvedPassword = found.password;
        }
      } catch {}
    }

    setEditingMember({ ...member, password: resolvedPassword || member.password });
    setEditName(member.name || '');
    setEditEmail(member.username || member.email || '');
    setEditPassword(resolvedPassword);
    setShowEditPassword(true);
    setEditPhone(member.phone || '');
    setEditBirthDate(member.birthDate || '');
    setEditGender(member.gender === 'F' || member.gender === '여' ? 'F' : 'M');
    setEditGrade(member.grade || '은배');
    setEditRole(member.role || 'member');
  };

  // 회원 정보 수정 저장 핸들러 (아이디 중복 검사 + 비밀번호 수정 포함)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    if (!editName.trim()) {
      alert('회원 이름을 입력해 주세요.');
      return;
    }

    const trimmedId = editEmail.trim();
    const trimmedPw = editPassword.trim();

    if (trimmedId && trimmedId.length < 2) {
      alert('아이디는 2자 이상 입력해 주세요.');
      return;
    }

    if (trimmedId) {
      const duplicate = users.some(
        (u) =>
          u.id !== editingMember.id &&
          ((u.username && u.username.toLowerCase() === trimmedId.toLowerCase()) ||
            (u.email && u.email.toLowerCase() === trimmedId.toLowerCase()))
      );
      if (duplicate) {
        alert(`이미 다른 회원이 사용 중인 아이디(${trimmedId})입니다.`);
        return;
      }
    }

    if (trimmedPw.length > 0 && trimmedPw.length < 4) {
      alert('비밀번호는 최소 4자 이상 입력해 주세요.');
      return;
    }

    const computedAge = calculateKoreanManAge(editBirthDate);
    const updated: ManagedMember = {
      ...editingMember,
      name: editName.trim(),
      username: trimmedId,
      password: trimmedPw,
      email: trimmedId.includes('@') ? trimmedId : editingMember.email || '',
      phone: editPhone.trim(),
      birthDate: editBirthDate || undefined,
      age: computedAge !== null ? computedAge : editingMember.age,
      gender: editGender,
      grade: editGrade,
      role: editRole,
    };

    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    if (onUpdateMember) {
      onUpdateMember(updated);
    }

    try {
      const savedList = JSON.parse(localStorage.getItem('sun_tennis_registered_users') || '[]');
      const existsInStorage = savedList.some(
        (u: any) =>
          u.id === updated.id ||
          (editingMember.username && u.username?.toLowerCase() === editingMember.username.toLowerCase()) ||
          (editingMember.email && u.email && u.email === editingMember.email)
      );
      const nextSaved = existsInStorage
        ? savedList.map((u: any) =>
            u.id === updated.id ||
            (editingMember.username && u.username?.toLowerCase() === editingMember.username.toLowerCase()) ||
            (editingMember.email && u.email && u.email === editingMember.email)
              ? { ...u, ...updated }
              : u
          )
        : [updated, ...savedList];
      localStorage.setItem('sun_tennis_registered_users', JSON.stringify(nextSaved));
    } catch {}

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('users')
          .update({
            name: updated.name,
            gender: updated.gender,
            grade: updated.grade,
            role: updated.role,
            birth_date: updated.birthDate || null,
          })
          .eq('id', updated.id);
      } catch {}
    }

    setEditingMember(null);
    const ageLabel = formatManAgeLabel(updated.birthDate, updated.age);
    alert(
      `✅ [${updated.name}] 회원의 정보가 수정되었습니다.\n아이디: ${updated.username || '미설정'} / 비밀번호: ${
        updated.password ? '변경(저장) 완료' : '미설정'
      }${ageLabel ? ` / 나이: ${ageLabel}` : ''}`
    );
  };

  // 인라인 등급 빠른 변경
  const handleQuickGradeChange = async (member: ManagedMember, newGradeVal: string) => {
    const updated: ManagedMember = { ...member, grade: newGradeVal };
    setUsers((prev) => prev.map((u) => (u.id === member.id ? updated : u)));
    if (onUpdateMember) onUpdateMember(updated);

    try {
      const savedList = JSON.parse(localStorage.getItem('sun_tennis_registered_users') || '[]');
      const nextSaved = savedList.map((u: any) =>
        u.id === member.id ? { ...u, grade: newGradeVal } : u
      );
      localStorage.setItem('sun_tennis_registered_users', JSON.stringify(nextSaved));
    } catch {}

    if (isSupabaseConfigured) {
      try {
        await supabase.from('users').update({ grade: newGradeVal }).eq('id', member.id);
      } catch {}
    }
  };

  // 인라인 권한 빠른 변경
  const handleQuickRoleChange = async (member: ManagedMember, newRoleVal: 'member' | 'admin') => {
    const updated: ManagedMember = { ...member, role: newRoleVal };
    setUsers((prev) => prev.map((u) => (u.id === member.id ? updated : u)));
    if (onUpdateMember) onUpdateMember(updated);

    try {
      const savedList = JSON.parse(localStorage.getItem('sun_tennis_registered_users') || '[]');
      const nextSaved = savedList.map((u: any) =>
        u.id === member.id ? { ...u, role: newRoleVal } : u
      );
      localStorage.setItem('sun_tennis_registered_users', JSON.stringify(nextSaved));
    } catch {}

    if (isSupabaseConfigured) {
      try {
        await supabase.from('users').update({ role: newRoleVal }).eq('id', member.id);
      } catch {}
    }
  };

  // 회원가입 승인 핸들러 (대기 -> 정회원 승인)
  const handleApproveMember = async (member: ManagedMember) => {
    const approved: ManagedMember = { ...member, approvalStatus: 'approved' };
    setUsers((prev) => prev.map((u) => (u.id === member.id ? approved : u)));
    if (onApproveMember) {
      onApproveMember(approved);
    } else if (onUpdateMember) {
      onUpdateMember(approved);
    }

    try {
      const savedList = JSON.parse(localStorage.getItem('sun_tennis_registered_users') || '[]');
      const exists = savedList.some(
        (u: any) =>
          u.id === member.id ||
          (member.username && u.username?.toLowerCase() === member.username.toLowerCase())
      );
      const nextSaved = exists
        ? savedList.map((u: any) =>
            u.id === member.id ||
            (member.username && u.username?.toLowerCase() === member.username.toLowerCase())
              ? { ...u, approvalStatus: 'approved' }
              : u
          )
        : [approved, ...savedList];
      localStorage.setItem('sun_tennis_registered_users', JSON.stringify(nextSaved));
    } catch {}

    if (isSupabaseConfigured) {
      try {
        await supabase.from('users').update({ approval_status: 'approved' }).eq('id', member.id);
      } catch {}
    }

    alert(
      `✅ [${member.name} (${member.username || member.email || '회원'})] 님의 회원가입이 승인되었습니다!\n지금부터 로그인하여 앱에 접속할 수 있습니다.`
    );
  };

  // 회원가입 신청 거절(취소) 핸들러
  const handleRejectMember = async (member: ManagedMember) => {
    const confirmed = window.confirm(
      `⚠️ [${member.name} (ID: ${member.username || member.email || '미등록'})] 님의 회원가입 신청을 거절(취소)하시겠습니까?`
    );
    if (!confirmed) return;

    setUsers((prev) => prev.filter((u) => u.id !== member.id));
    if (onRejectMember) {
      onRejectMember(member.id, member.name);
    } else if (onCancelMembership) {
      onCancelMembership(member.id, member.name);
    }

    try {
      const savedList = JSON.parse(localStorage.getItem('sun_tennis_registered_users') || '[]');
      const filtered = savedList.filter(
        (u: any) =>
          u.id !== member.id &&
          (!member.username || u.username?.toLowerCase() !== member.username.toLowerCase()) &&
          (!member.email || u.email !== member.email)
      );
      localStorage.setItem('sun_tennis_registered_users', JSON.stringify(filtered));
    } catch {}

    if (isSupabaseConfigured) {
      try {
        await supabase.from('users').delete().eq('id', member.id);
      } catch {}
    }

    alert(`❌ [${member.name}] 님의 회원가입 신청이 거절(삭제)되었습니다.`);
  };

  // 회원가입 취소 (강제 탈퇴 / 계정 삭제) 핸들러
  const handleCancelUserMembership = async (member: ManagedMember) => {
    const confirmed = window.confirm(
      `⚠️ 정말 [${member.name} (${member.grade})] 회원의 회원가입을 취소(탈퇴 처리)하시겠습니까?\n\n취소 시 클럽 회원 명부 및 로그인 계정에서 즉시 삭제됩니다.`
    );
    if (!confirmed) return;

    setUsers((prev) => prev.filter((u) => u.id !== member.id));
    if (onCancelMembership) {
      onCancelMembership(member.id, member.name);
    }

    try {
      const savedList = JSON.parse(localStorage.getItem('sun_tennis_registered_users') || '[]');
      const filtered = savedList.filter(
        (u: any) =>
          u.id !== member.id &&
          (!member.username || u.username?.toLowerCase() !== member.username.toLowerCase()) &&
          (!member.email || u.email !== member.email)
      );
      localStorage.setItem('sun_tennis_registered_users', JSON.stringify(filtered));
    } catch {}

    if (isSupabaseConfigured) {
      try {
        await supabase.from('users').delete().eq('id', member.id);
      } catch {}
    }

    alert(`🗑️ [${member.name}] 회원의 회원가입 취소(탈퇴) 처리가 완료되었습니다.`);
  };

  // 관리자 신규 회원 직접 등록 핸들러
  const handleAdminAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      alert('등록할 회원 이름을 입력해 주세요.');
      return;
    }

    const computedAge = calculateKoreanManAge(newBirthDate);
    const created: ManagedMember = {
      id: `p_${Date.now()}`,
      username: newEmail.trim() || newName.trim(),
      password: newPassword.trim() || undefined,
      name: newName.trim(),
      email: newEmail.trim().includes('@') ? newEmail.trim() : '',
      phone: newPhone.trim(),
      birthDate: newBirthDate || undefined,
      age: computedAge !== null ? computedAge : undefined,
      gender: newGender,
      grade: newGrade,
      role: newRole,
      approvalStatus: 'approved',
    };

    setUsers((prev) => [created, ...prev]);
    if (onAddMember) {
      onAddMember(created);
    }

    try {
      const savedList = JSON.parse(localStorage.getItem('sun_tennis_registered_users') || '[]');
      localStorage.setItem(
        'sun_tennis_registered_users',
        JSON.stringify([created, ...savedList])
      );
    } catch {}

    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewPhone('');
    setNewBirthDate('');
    setShowAddForm(false);
    const ageSuffix = computedAge !== null ? ` · 만 ${computedAge}세` : '';
    alert(`🎉 [${created.name} (${created.grade}${ageSuffix})] 회원이 신규 등록되었습니다.`);
  };

  const pendingUsers = users.filter((u) => u.approvalStatus === 'pending');
  const approvedUsers = users.filter((u) => u.approvalStatus !== 'pending');

  const filteredUsers = approvedUsers.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.grade?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-3">
      {/* ================================================================= */}
      {/* [섹션 0]: 신규 회원가입 승인 대기 목록 (접기/펼치기 · 항목 클릭 시 승인/거절) */}
      {/* ================================================================= */}
      <div
        className={`rounded-2xl p-3.5 shadow-xl space-y-3 border ${
          pendingUsers.length > 0
            ? 'bg-gradient-to-br from-amber-950/60 via-slate-900 to-slate-900 border-amber-500/50'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        <button
          type="button"
          onClick={() => setIsPendingSectionOpen((prev) => !prev)}
          className="w-full flex justify-between items-center text-left cursor-pointer"
        >
          <div>
            <h2 className="text-sm font-black text-amber-300 flex items-center gap-1.5">
              <span>⏳</span> 회원가입 승인 대기 목록
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  pendingUsers.length > 0
                    ? 'bg-amber-400 text-slate-950 animate-pulse'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {pendingUsers.length}명 대기
              </span>
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              항목을 누르면 펼쳐져서 신규 가입 신청 회원을 확인·승인할 수 있습니다.
            </p>
          </div>
          <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-amber-300 shrink-0">
            {isPendingSectionOpen ? '접기 ▲' : '펼치기 ▼'}
          </span>
        </button>

        {isPendingSectionOpen && (
          <div className="pt-2.5 border-t border-slate-800">
            {pendingUsers.length === 0 ? (
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 text-center text-[11px] text-slate-400">
                현재 승인 대기 중인 회원가입 신청이 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {pendingUsers.map((u) => {
                  const isExpanded = Boolean(expandedMemberIds[u.id]);
                  const manAgeBadge = formatManAgeLabel(u.birthDate, u.age);
                  const birthStr = formatBirthDateDisplay(u.birthDate);
                  return (
                    <div
                      key={u.id}
                      className="bg-slate-950/90 border border-amber-500/40 rounded-2xl p-2.5 space-y-2 text-xs shadow-md"
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpandMember(u.id)}
                        className="w-full flex justify-between items-center gap-2 text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-black text-white">{u.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                            {u.grade}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({u.gender === 'F' || u.gender === '여' ? '여' : '남'})
                          </span>
                          {manAgeBadge && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                              {manAgeBadge}
                            </span>
                          )}
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/40 font-black">
                            승인 대기중
                          </span>
                        </div>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 shrink-0">
                          {isExpanded ? '접기 ▲' : '확인·승인 ▼'}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="space-y-2 pt-2 border-t border-slate-800/80">
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 flex-wrap">
                            <span>
                              신청 ID: <strong className="text-slate-200">{u.username || u.email || '미등록'}</strong>
                            </span>
                            {birthStr && (
                              <span>
                                · 생년월일: <strong className="text-emerald-300">{birthStr} ({manAgeBadge})</strong>
                              </span>
                            )}
                            {u.phone && <span>· 연락처: {u.phone}</span>}
                            {u.requestedAt && <span>· 신청일시: {u.requestedAt}</span>}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleApproveMember(u)}
                              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-[11px] shadow-md transition flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span>✅</span>
                              <span>가입 승인 (접속 허용)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectMember(u)}
                              className="py-2 px-3 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-500/40 font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span>❌</span>
                              <span>거절</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* [섹션 1]: 가입회원 정보 수정 & 회원가입 취소 관리 (접기/펼치기 + 개별 회원 접기/펼치기) */}
      {/* ================================================================= */}
      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-3.5 shadow-xl space-y-3">
        <div className="flex justify-between items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMemberSectionOpen((prev) => !prev)}
            className="flex-1 text-left cursor-pointer"
          >
            <h2 className="text-sm font-black text-red-400 flex items-center gap-1.5 flex-wrap">
              <span>👑</span> 가입회원 정보 수정 & 회원가입 취소 관리
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950 text-amber-300 border border-amber-500/30 font-black">
                총 {approvedUsers.length}명
              </span>
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              항목을 눌러 펼친 뒤, 수정할 회원을 클릭하면 등급·권한·비밀번호 수정 및 탈퇴 처리가 가능합니다.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setIsMemberSectionOpen((prev) => !prev)}
            className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-amber-300 shrink-0 cursor-pointer"
          >
            {isMemberSectionOpen ? '접기 ▲' : '펼치기 ▼'}
          </button>
        </div>

        {isMemberSectionOpen && (
          <div className="space-y-3 pt-2.5 border-t border-slate-800">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black rounded-xl text-[11px] shadow-md shrink-0 cursor-pointer"
              >
                {showAddForm ? '신규 등록 닫기 ▲' : '+ 회원 직접 등록 ▼'}
              </button>
            </div>

        {/* 관리자 신규 회원 직접 등록 폼 */}
        {showAddForm && (
          <form
            onSubmit={handleAdminAddMember}
            className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-3.5 space-y-3"
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-emerald-300">✨ 관리자 신규 회원 직접 추가</span>
              <span className="text-[10px] text-slate-400">즉시 정회원으로 등록됩니다</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="이름 (필수)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                required
              />
              <input
                type="text"
                placeholder="아이디 (선택 · 이메일 불필요)"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="비밀번호 (선택 · 4자 이상)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
              <input
                type="tel"
                placeholder="휴대폰 번호 (선택)"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
            <BirthDateSelector
              value={newBirthDate}
              onChange={setNewBirthDate}
              compact
              accent="emerald"
              label="생년월일 (출생년·월·일 ➔ 만 나이 자동 계산)"
              helperText="만 나이가 자동 계산되어 KDK·대회 실력 균등 배정에 반영됩니다."
            />
            <div className="grid grid-cols-3 gap-2">
              <select
                value={newGender}
                onChange={(e) => setNewGender(e.target.value as 'M' | 'F')}
                className="px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              >
                <option value="M">남성 (남)</option>
                <option value="F">여성 (여)</option>
              </select>
              <select
                value={newGrade}
                onChange={(e) => setNewGrade(e.target.value)}
                className="px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-amber-300 font-bold"
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'member' | 'admin')}
                className="px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-red-300 font-bold"
              >
                <option value="member">일반회원</option>
                <option value="admin">관리자</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black rounded-xl text-xs cursor-pointer"
            >
              + 클럽 회원 명부에 등록하기
            </button>
          </form>
        )}

        {/* 검색바 & 인원 통계 */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="🔍 회원 이름, 등급(금배/은배 등), 이메일 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <span className="text-[11px] text-amber-300 font-extrabold bg-amber-500/10 border border-amber-500/20 px-2.5 py-2 rounded-xl shrink-0">
            총 {filteredUsers.length}명
          </span>
        </div>

        {/* 가입회원 리스트 (각 회원 항목도 기본 접힘 ➔ 클릭 시 펼쳐서 수정/탈퇴) */}
        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {filteredUsers.map((u) => {
            const isMe = currentUserId && String(u.id) === String(currentUserId);
            const isExpanded = Boolean(expandedMemberIds[u.id]);
            const manAgeBadge = formatManAgeLabel(u.birthDate, u.age);
            const birthStr = formatBirthDateDisplay(u.birthDate);
            return (
              <div
                key={u.id}
                className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 hover:border-slate-700 transition space-y-2 text-xs"
              >
                {/* 접힌 요약 헤더: 항목을 누르면 펴져서 수정 가능 */}
                <button
                  type="button"
                  onClick={() => toggleExpandMember(u.id)}
                  className="w-full flex justify-between items-center gap-2 text-left cursor-pointer"
                >
                  <div className="font-bold text-white flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="text-sm font-black truncate">{u.name}</span>
                    <span className="text-[10px] text-slate-400">
                      ({u.gender === 'F' || u.gender === '여' ? '여' : '남'})
                    </span>
                    {manAgeBadge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                        {manAgeBadge}
                      </span>
                    )}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-extrabold">
                      {u.grade}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        u.role === 'admin'
                          ? 'bg-red-950/80 text-red-300 border border-red-500/40'
                          : 'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {u.role === 'admin' ? '👑 관리자' : '일반회원'}
                    </span>
                    {u.isGuest && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                        임의추가
                      </span>
                    )}
                    {isMe && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                        본인
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 shrink-0">
                    {isExpanded ? '접기 ▲' : '수정 ▼'}
                  </span>
                </button>

                {isExpanded && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-800/90">
                    <div className="flex justify-between items-center gap-2 flex-wrap">
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 flex-wrap">
                        <span>ID: <strong className="text-slate-200">{u.username || u.email || '미등록'}</strong></span>
                        {birthStr ? (
                          <span>
                            · 생년월일: <strong className="text-emerald-300">{birthStr} ({manAgeBadge})</strong>
                          </span>
                        ) : (
                          <span className="text-amber-400/80">· 생년월일 미등록</span>
                        )}
                        {u.phone && <span>· {u.phone}</span>}
                      </div>

                      {/* 빠른 등급 & 권한 변경 셀렉트 */}
                      <div className="flex gap-1.5 items-center shrink-0">
                        <select
                          value={u.grade}
                          onChange={(e) => handleQuickGradeChange(u, e.target.value)}
                          className="bg-slate-900 border border-slate-700 text-amber-300 text-[11px] font-bold rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                        >
                          {GRADE_OPTIONS.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>

                        <select
                          value={u.role}
                          onChange={(e) =>
                            handleQuickRoleChange(u, e.target.value as 'member' | 'admin')
                          }
                          className={`border text-[11px] font-bold rounded-lg px-2 py-1 focus:outline-none cursor-pointer ${
                            u.role === 'admin'
                              ? 'bg-red-950/80 text-red-300 border-red-500/40'
                              : 'bg-slate-900 text-slate-300 border-slate-700'
                          }`}
                        >
                          <option value="member">일반회원</option>
                          <option value="admin">👑 관리자</option>
                        </select>
                      </div>
                    </div>

                    {/* 하단: [회원정보 수정] 버튼 & [회원가입 취소(탈퇴)] 버튼 */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(u)}
                        className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>✎</span>
                        <span>상세 정보·비밀번호 수정</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCancelUserMembership(u)}
                        className="flex-1 py-1.5 px-2.5 rounded-xl bg-red-950/50 hover:bg-red-900/80 text-red-300 border border-red-500/30 font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>🗑️</span>
                        <span>회원가입 취소 (탈퇴)</span>
                      </button>
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

      {/* ================================================================= */}
      {/* [모달]: 가입회원 상세 정보 수정 모달 */}
      {/* ================================================================= */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 text-white my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-amber-400 flex items-center gap-1.5">
                <span>✎</span> [{editingMember.name}] 회원 정보 수정
              </h3>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              {/* 로그인 계정 정보 (아이디 · 비밀번호 확인 및 수정) */}
              <div className="bg-slate-950/90 border border-amber-500/35 rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-amber-300 flex items-center gap-1">
                    <span>🔐</span> 로그인 아이디 · 비밀번호 확인 및 수정
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    아이디 (ID) <span className="text-[10px] text-slate-500 font-normal">이메일 형식 불필요</span>
                  </label>
                  <input
                    type="text"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="아이디 입력 (2자 이상)"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-300">
                      비밀번호 확인 및 수정
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {editingMember.password ? '설정됨' : '미설정'}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type={showEditPassword ? 'text' : 'password'}
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="현재 비밀번호 확인 또는 새 비밀번호 (4자 이상)"
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-emerald-300 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword((prev) => !prev)}
                      className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-[11px] font-bold shrink-0 cursor-pointer"
                    >
                      {showEditPassword ? '🙈 숨김' : '👁️ 보기'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {editingMember.password
                      ? `현재 저장된 비밀번호를 바로 확인하거나 새 비밀번호로 변경할 수 있습니다.`
                      : `현재 비밀번호가 미설정 상태입니다. 입력 후 저장하면 해당 비밀번호로 로그인됩니다.`}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  이름 (실명) <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  required
                />
              </div>

              <BirthDateSelector
                key={editingMember.id}
                value={editBirthDate}
                onChange={setEditBirthDate}
                compact
                label="생년월일 (출생년·월·일 ➔ 만 나이 자동 계산)"
                helperText="생년월일 기준 만 나이가 자동 반영되어 KDK·대회 실력 균등 배정에 적용됩니다."
              />

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">성별</label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value as 'M' | 'F')}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    <option value="M">남성 (남)</option>
                    <option value="F">여성 (여)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    테니스 등급(부수)
                  </label>
                  <select
                    value={editGrade}
                    onChange={(e) => setEditGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-amber-300 font-bold"
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
                <label className="block text-[11px] font-bold text-slate-300 mb-1">회원 권한</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as 'member' | 'admin')}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-red-300 font-bold"
                >
                  <option value="member">👤 일반 클럽 회원 (member)</option>
                  <option value="admin">👑 클럽 운영자 / 관리자 (admin)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">휴대폰 번호</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="010-1234-5678"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl text-xs transition shadow-lg cursor-pointer"
                >
                  수정 내용 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
