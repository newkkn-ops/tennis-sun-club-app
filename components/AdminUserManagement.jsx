'use client';
import React, { useState, useEffect } from 'react';
import {
  supabase,
  toAuthEmail,
  mapSupabaseUserRow,
  buildSafeUsersPayload,
  updateUserInPublicUsers,
  approveUserInPublicUsers,
} from '../lib/supabase';
import BirthDateSelector from './BirthDateSelector';
import {
  calculateKoreanManAge,
  formatBirthDateDisplay,
  formatManAgeLabel,
} from '../lib/age';

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
  birth_date?: string;
  age?: number; // 만 나이 (자동 계산)
  isGuest?: boolean;
  is_guest?: boolean;
  approvalStatus?: 'pending' | 'approved';
  approval_status?: 'pending' | 'approved';
  status?: string;
  requestedAt?: string;
  requested_at?: string;
}

interface AdminUserManagementProps {
  externalUsers?: ManagedMember[];
  currentUserId?: string;
  onUpdateMember?: (updated: ManagedMember) => void;
  onCancelMembership?: (userId: string, userName: string) => void;
  onAddMember?: (newMember: ManagedMember) => void;
  onApproveMember?: (approved: ManagedMember) => void;
  onRejectMember?: (userId: string, userName: string) => void;
  onRefreshUsers?: () => Promise<void> | void;
}

export default function AdminUserManagement({
  externalUsers,
  currentUserId,
  onUpdateMember,
  onCancelMembership,
  onAddMember,
  onApproveMember,
  onRejectMember,
  onRefreshUsers,
}: AdminUserManagementProps) {
  const [users, setUsers] = useState<ManagedMember[]>(externalUsers || []);

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

  const fetchUsersFromDb = async (): Promise<ManagedMember[] | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('fetchUsersFromDb error:', error.message);
        return null;
      }
      if (Array.isArray(data)) {
        const normalized = data
          .map((row) => mapSupabaseUserRow(row) as ManagedMember | null)
          .filter((u): u is ManagedMember => Boolean(u && u.id));
        setUsers(normalized);
        return normalized;
      }
    } catch (err) {
      console.warn('fetchUsersFromDb notice:', err);
    }
    return null;
  };

  useEffect(() => {
    if (Array.isArray(externalUsers)) {
      setUsers(
        externalUsers
          .filter((u) => Boolean(u && u.id))
          .map((u) => {
            const pending =
              u?.approval_status === 'pending' || u?.approvalStatus === 'pending';
            return {
              ...u,
              name: u?.name || '클럽회원',
              grade: u?.grade || '테린이',
              role: u?.role === 'admin' ? 'admin' : 'member',
              birthDate: u?.birthDate || u?.birth_date,
              approvalStatus: pending ? 'pending' : 'approved',
              approval_status: pending ? 'pending' : 'approved',
            } as ManagedMember;
          })
      );
    }
  }, [externalUsers]);

  // Supabase users 테이블 초기 조회 및 실시간(Realtime) 변경 구독
  useEffect(() => {
    fetchUsersFromDb();

    const channel = supabase
      .channel('public:users:admin-management')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        () => {
          fetchUsersFromDb();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 회원 정보 수정 모달 열기
  const openEditModal = (member: ManagedMember) => {
    setEditingMember(member);
    setEditName(member.name || '');
    setEditEmail(member.username || member.email || '');
    setEditPassword('');
    setShowEditPassword(true);
    setEditPhone(member.phone || '');
    setEditBirthDate(member.birthDate || member.birth_date || '');
    setEditGender(member.gender === 'F' || member.gender === '여' ? 'F' : 'M');
    setEditGrade(member.grade || '은배');
    setEditRole(member.role || 'member');
  };

  // 회원 정보 수정 저장 핸들러 (Supabase users 테이블 실시간 업데이트)
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

    if (trimmedPw.length > 0 && trimmedPw.length < 6) {
      alert('비밀번호는 최소 6자 이상 입력해 주세요. (Supabase 기준)');
      return;
    }

    const computedAge = calculateKoreanManAge(editBirthDate);
    const resolvedEmail = trimmedId
      ? toAuthEmail(trimmedId)
      : editingMember.email || '';

    let { data: updatedRows, error } = await updateUserInPublicUsers(editingMember.id, {
      name: editName.trim(),
      username: trimmedId || editingMember.username || '',
      email: resolvedEmail || '',
      phone: editPhone.trim() || '',
      birth_date: editBirthDate || null,
      age: computedAge !== null ? computedAge : editingMember.age ?? null,
      gender: editGender,
      grade: editGrade,
      role: editRole,
      status: editingMember.approvalStatus === 'pending' ? 'pending' : 'approved',
    });
    const updatedRow = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;

    if (error) {
      alert(`회원 정보 수정 중 오류가 발생했습니다: ${error.message}`);
      return;
    }

    await fetchUsersFromDb();

    const updated: ManagedMember =
      (mapSupabaseUserRow(updatedRow) as ManagedMember) || {
        ...editingMember,
        name: editName.trim(),
        username: trimmedId,
        password: trimmedPw || undefined,
        email: resolvedEmail,
        phone: editPhone.trim(),
        birthDate: editBirthDate || undefined,
        birth_date: editBirthDate || undefined,
        age: computedAge !== null ? computedAge : editingMember.age,
        gender: editGender,
        grade: editGrade,
        role: editRole,
      };

    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    if (onUpdateMember) {
      onUpdateMember(updated);
    }

    setEditingMember(null);
    const ageLabel = formatManAgeLabel(updated.birthDate, updated.age);
    alert(
      `✅ [${updated.name}] 회원의 정보가 Supabase DB에 실시간 반영되었습니다.\n아이디: ${
        updated.username || '미설정'
      }${ageLabel ? ` / 나이: ${ageLabel}` : ''}`
    );
  };

  // 인라인 등급 빠른 변경 (Supabase users 테이블 업데이트)
  const handleQuickGradeChange = async (member: ManagedMember, newGradeVal: string) => {
    const { error } = await supabase
      .from('users')
      .update({ grade: newGradeVal })
      .eq('id', member.id);

    if (error) {
      alert(`등급 변경 실패: ${error.message}`);
      return;
    }

    const updated: ManagedMember = { ...member, grade: newGradeVal };
    setUsers((prev) => prev.map((u) => (u.id === member.id ? updated : u)));
    if (onUpdateMember) onUpdateMember(updated);
  };

  // 인라인 권한 빠른 변경 및 관리자모드 권한 부여/해제 (Supabase users 테이블 실시간 업데이트)
  const handleQuickRoleChange = async (member: ManagedMember, newRoleVal: 'member' | 'admin') => {
    if (member.role === newRoleVal) return;

    const isSelf = currentUserId && String(member.id) === String(currentUserId);
    if (isSelf && newRoleVal === 'member') {
      const selfConfirm = window.confirm(
        `⚠️ 본인(${member.name})의 관리자 권한을 해제하면 운영관리 화면에서 일반회원 모드로 전환됩니다.\n정말 일반회원으로 전환하시겠습니까?`
      );
      if (!selfConfirm) return;
    } else if (newRoleVal === 'admin') {
      const grantConfirm = window.confirm(
        `👑 [${member.name} (${member.username || member.email || '회원'})] 회원에게 관리자모드 권한을 부여하시겠습니까?\n\n부여 시 해당 회원도 관리자 모드로 로그인하여 대회·코트·회원 관리가 가능합니다.`
      );
      if (!grantConfirm) return;
    } else {
      const revokeConfirm = window.confirm(
        `👤 [${member.name}] 회원의 관리자모드 권한을 해제하고 일반회원으로 전환하시겠습니까?`
      );
      if (!revokeConfirm) return;
    }

    const { error } = await supabase
      .from('users')
      .update({ role: newRoleVal })
      .eq('id', member.id);

    if (error) {
      alert(`권한 변경 실패: ${error.message}`);
      return;
    }

    const updated: ManagedMember = { ...member, role: newRoleVal };
    setUsers((prev) => prev.map((u) => (u.id === member.id ? updated : u)));
    if (onUpdateMember) onUpdateMember(updated);
    await fetchUsersFromDb();

    if (newRoleVal === 'admin') {
      alert(
        `👑 [${member.name}] 회원에게 관리자모드 권한이 부여되었습니다!\n이제 해당 계정으로 관리자 모드에 로그인할 수 있습니다.`
      );
    } else {
      alert(`👤 [${member.name}] 회원이 일반회원으로 전환되었습니다.`);
    }
  };

  // 회원가입 승인 핸들러 (public.users.status: 'pending' -> 'approved' 직접 UPDATE 후 즉시 전체 재조회)
  const handleApproveMember = async (member: ManagedMember) => {
    // 1. supabase.from('users').update({ status: 'approved' }).eq('id', targetUserId)
    const { data, error } = await approveUserInPublicUsers(member.id);

    if (error) {
      alert(`❌ 회원가입 승인 처리 실패\n\n회원: ${member.name}\n에러 내용: ${error.message}`);
      return;
    }

    // 2. UPDATE 성공 즉시 public.users 전체 목록을 다시 SELECT하여 최신 DB 기준으로 갱신
    const refreshed = await fetchUsersFromDb();
    if (onRefreshUsers) {
      await onRefreshUsers();
    }

    const approved: ManagedMember =
      (refreshed && refreshed.find((u) => u.id === member.id)) ||
      (mapSupabaseUserRow(data) as ManagedMember) || {
        ...member,
        approvalStatus: 'approved',
        approval_status: 'approved',
        status: 'approved',
      };

    if (!refreshed) {
      setUsers((prev) => prev.map((u) => (u.id === member.id ? approved : u)));
    }
    if (onApproveMember) {
      onApproveMember(approved);
    } else if (onUpdateMember) {
      onUpdateMember(approved);
    }

    alert(
      `✅ [${member.name} (${member.username || member.email || '회원'})] 님의 회원가입이 승인되었습니다!\n이제 모든 기기에서 로그인하여 앱에 접속할 수 있습니다.`
    );
  };

  // 회원가입 신청 거절(취소) 핸들러 (Supabase users 테이블에서 삭제)
  const handleRejectMember = async (member: ManagedMember) => {
    const confirmed = window.confirm(
      `⚠️ [${member.name} (ID: ${member.username || member.email || '미등록'})] 님의 회원가입 신청을 거절(취소)하시겠습니까?`
    );
    if (!confirmed) return;

    const { error } = await supabase.from('users').delete().eq('id', member.id);
    if (error) {
      alert(`가입 거절 처리 실패: ${error.message}`);
      return;
    }

    await fetchUsersFromDb();
    if (onRejectMember) {
      onRejectMember(member.id, member.name);
    } else if (onCancelMembership) {
      onCancelMembership(member.id, member.name);
    }

    alert(`❌ [${member.name}] 님의 회원가입 신청이 거절(삭제)되었습니다.`);
  };

  // 회원가입 취소 (강제 탈퇴 / 계정 삭제) 핸들러 (Supabase users 테이블에서 삭제)
  const handleCancelUserMembership = async (member: ManagedMember) => {
    const confirmed = window.confirm(
      `⚠️ 정말 [${member.name} (${member.grade})] 회원의 회원가입을 취소(탈퇴 처리)하시겠습니까?\n\n취소 시 Supabase 클럽 회원 명부에서 즉시 삭제됩니다.`
    );
    if (!confirmed) return;

    const { error } = await supabase.from('users').delete().eq('id', member.id);
    if (error) {
      alert(`회원 탈퇴 처리 실패: ${error.message}`);
      return;
    }

    await fetchUsersFromDb();
    if (onCancelMembership) {
      onCancelMembership(member.id, member.name);
    }

    alert(`🗑️ [${member.name}] 회원의 회원가입 취소(탈퇴) 처리가 완료되었습니다.`);
  };

  // 관리자 신규 회원 직접 등록 핸들러 (Supabase Auth + users 테이블에 approved 상태로 실시간 등록)
  const handleAdminAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      alert('등록할 회원 이름을 입력해 주세요.');
      return;
    }

    const computedAge = calculateKoreanManAge(newBirthDate);
    const rawLoginId = (newEmail.trim() || newName.trim()).toLowerCase();
    const authEmail = toAuthEmail(rawLoginId);
    const rawPassword = newPassword.trim() || 'tennis1234';

    let newUserId: string | undefined;

    if (newPassword.trim().length >= 4) {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: authEmail,
        password: rawPassword,
        options: {
          data: {
            username: rawLoginId,
            name: newName.trim(),
            gender: newGender,
            grade: newGrade,
            phone: newPhone.trim(),
            birth_date: newBirthDate || null,
            role: newRole,
            approval_status: 'approved',
          },
        },
      });
      if (!signUpErr && signUpData?.user?.id) {
        newUserId = signUpData.user.id;
      }
    }

    const insertPayload: Record<string, any> = {
      ...(newUserId ? { id: newUserId } : {}),
      username: rawLoginId,
      email: authEmail,
      name: newName.trim(),
      phone: newPhone.trim() || '',
      birth_date: newBirthDate || null,
      age: computedAge !== null ? computedAge : null,
      gender: newGender,
      grade: newGrade,
      role: newRole,
      is_guest: false,
      status: 'approved',
      approval_status: 'approved',
      requested_at: new Date().toISOString(),
    };

    // public.users 실제 컬럼(id, name, gender, grade, role, push_subscription)만 전송
    let { data: insertedRow, error: insertError } = await supabase
      .from('users')
      .upsert(buildSafeUsersPayload(insertPayload))
      .select()
      .maybeSingle();

    if (insertError) {
      const minimal = {
        ...(newUserId ? { id: newUserId } : {}),
        name: newName.trim(),
        gender: newGender,
        grade: newGrade,
        role: newRole,
      };
      const retry = await supabase.from('users').upsert(minimal).select().maybeSingle();
      insertedRow = retry.data;
      insertError = retry.error;
    }

    if (insertError) {
      alert(`신규 회원 등록 실패: ${insertError.message}`);
      return;
    }

    const created: ManagedMember =
      (mapSupabaseUserRow(insertedRow) as ManagedMember) || {
        id: newUserId || `u_${Date.now()}`,
        username: rawLoginId,
        name: newName.trim(),
        email: authEmail,
        phone: newPhone.trim(),
        birthDate: newBirthDate || undefined,
        birth_date: newBirthDate || undefined,
        age: computedAge !== null ? computedAge : undefined,
        gender: newGender,
        grade: newGrade,
        role: newRole,
        approvalStatus: 'approved',
        approval_status: 'approved',
      };

    setUsers((prev) => [created, ...prev.filter((u) => u.id !== created.id)]);
    if (onAddMember) {
      onAddMember(created);
    }

    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewPhone('');
    setNewBirthDate('');
    setShowAddForm(false);
    const ageSuffix = computedAge !== null ? ` · 만 ${computedAge}세` : '';
    alert(`🎉 [${created.name} (${created.grade}${ageSuffix})] 회원이 Supabase DB에 정회원으로 등록되었습니다.`);
  };

  const safeUsers: ManagedMember[] = (Array.isArray(users) ? users : []).filter(
    (u): u is ManagedMember => Boolean(u && u.id)
  );
  const pendingUsers = safeUsers.filter(
    (u) => (u?.approval_status || u?.approvalStatus) === 'pending'
  );
  const approvedUsers = safeUsers.filter(
    (u) => (u?.approval_status || u?.approvalStatus) !== 'pending'
  );

  const filteredUsers = approvedUsers.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      String(u?.name || '').toLowerCase().includes(q) ||
      String(u?.grade || '').toLowerCase().includes(q) ||
      String(u?.username || '').toLowerCase().includes(q) ||
      String(u?.email || '').toLowerCase().includes(q)
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
                placeholder="비밀번호 (선택 · 6자 이상)"
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

                    {/* 관리자모드 권한 부여 / 해제 전용 원클릭 버튼 */}
                    <button
                      type="button"
                      onClick={() =>
                        handleQuickRoleChange(u, u.role === 'admin' ? 'member' : 'admin')
                      }
                      className={`w-full py-2 px-3 rounded-xl font-black text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                        u.role === 'admin'
                          ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                          : 'bg-gradient-to-r from-amber-500/20 via-red-500/20 to-orange-500/20 hover:from-amber-500/35 hover:to-red-500/35 text-amber-300 border border-amber-500/45'
                      }`}
                    >
                      <span>{u.role === 'admin' ? '👤' : '👑'}</span>
                      <span>
                        {u.role === 'admin'
                          ? '관리자모드 권한 해제 (일반회원 전환)'
                          : '관리자모드 권한 부여'}
                      </span>
                    </button>

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
                      placeholder="현재 비밀번호 확인 또는 새 비밀번호 (6자 이상)"
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
