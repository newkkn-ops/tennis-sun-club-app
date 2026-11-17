'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

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
  name: string;
  email?: string;
  gender: 'M' | 'F' | string;
  grade: string;
  role: 'member' | 'admin';
  phone?: string;
  isGuest?: boolean;
}

interface AdminUserManagementProps {
  externalUsers?: ManagedMember[];
  currentUserId?: string;
  onUpdateMember?: (updated: ManagedMember) => void;
  onCancelMembership?: (userId: string, userName: string) => void;
  onAddMember?: (newMember: ManagedMember) => void;
}

export default function AdminUserManagement({
  externalUsers,
  currentUserId,
  onUpdateMember,
  onCancelMembership,
  onAddMember,
}: AdminUserManagementProps) {
  const [users, setUsers] = useState<ManagedMember[]>(
    externalUsers || [
      { id: 'p1', name: '김철수', email: 'chulsoo@suntc.kr', gender: 'M', grade: '금배', role: 'member' },
      { id: 'p2', name: '강동원', email: 'dongwon@suntc.kr', gender: 'M', grade: '금배', role: 'member' },
      { id: 'p3', name: '박민수', email: 'minsoo@suntc.kr', gender: 'M', grade: '은배', role: 'member' },
      { id: 'p4', name: '정지훈', email: 'jihoon@suntc.kr', gender: 'M', grade: '동배', role: 'member' },
      { id: 'p5', name: '이영희', email: 'younghee@suntc.kr', gender: 'F', grade: '국화', role: 'member' },
      { id: 'p6', name: '한지민', email: 'jimin@suntc.kr', gender: 'F', grade: '은배', role: 'member' },
      { id: 'p7', name: '최수진', email: 'sujin@suntc.kr', gender: 'F', grade: '개나리', role: 'member' },
      { id: 'p8', name: '송중기', email: 'joongki@suntc.kr', gender: 'M', grade: '동배', role: 'member' },
      { id: 'p10', name: '공유', email: 'admin@suntc.kr', gender: 'M', grade: '금배', role: 'admin' },
    ]
  );

  // 검색 필터 상태
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 상세 정보 수정 모달 대상 회원 상태
  const [editingMember, setEditingMember] = useState<ManagedMember | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editGender, setEditGender] = useState<'M' | 'F'>('M');
  const [editGrade, setEditGrade] = useState<string>('은배');
  const [editRole, setEditRole] = useState<'member' | 'admin'>('member');

  // 관리자 신규 회원 직접 등록 폼 토글 및 상태
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
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

  // 회원 정보 수정 모달 열기
  const openEditModal = (member: ManagedMember) => {
    setEditingMember(member);
    setEditName(member.name || '');
    setEditEmail(member.email || '');
    setEditPhone(member.phone || '');
    setEditGender(member.gender === 'F' || member.gender === '여' ? 'F' : 'M');
    setEditGrade(member.grade || '은배');
    setEditRole(member.role || 'member');
  };

  // 회원 정보 수정 저장 핸들러
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    if (!editName.trim()) {
      alert('회원 이름을 입력해 주세요.');
      return;
    }

    const updated: ManagedMember = {
      ...editingMember,
      name: editName.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim(),
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
      const nextSaved = savedList.map((u: any) =>
        u.id === updated.id || (u.email && u.email === editingMember.email)
          ? { ...u, ...updated }
          : u
      );
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
          })
          .eq('id', updated.id);
      } catch {}
    }

    setEditingMember(null);
    alert(`✅ [${updated.name}] 회원의 정보가 수정되었습니다.`);
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
        (u: any) => u.id !== member.id && (!member.email || u.email !== member.email)
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

    const created: ManagedMember = {
      id: `p_${Date.now()}`,
      name: newName.trim(),
      email: newEmail.trim() || `${newName.trim()}@suntc.kr`,
      phone: newPhone.trim(),
      gender: newGender,
      grade: newGrade,
      role: newRole,
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
    setNewPhone('');
    setShowAddForm(false);
    alert(`🎉 [${created.name} (${created.grade})] 회원이 신규 등록되었습니다.`);
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.grade?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3.5">
        {/* 헤더 및 회원 추가 버튼 */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
          <div>
            <h2 className="text-sm font-black text-red-400 flex items-center gap-1.5">
              <span>👑</span> 가입회원 정보 수정 & 회원가입 취소 관리
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              관리자 권한으로 회원의 이름·성별·등급·권한을 수정하거나 회원가입을 취소(탈퇴)할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black rounded-xl text-[11px] shadow-md shrink-0 cursor-pointer"
          >
            {showAddForm ? '닫기' : '+ 회원 직접 등록'}
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
                type="email"
                placeholder="이메일 (선택)"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
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

        {/* 가입회원 리스트 */}
        <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
          {filteredUsers.map((u) => {
            const isMe = currentUserId && String(u.id) === String(currentUserId);
            return (
              <div
                key={u.id}
                className="bg-slate-950 p-3 rounded-2xl border border-slate-800 hover:border-slate-700 transition space-y-2.5 text-xs"
              >
                {/* 상단: 회원 기본 정보 및 빠른 등급/권한 드롭다운 */}
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-black">{u.name}</span>
                      <span className="text-[10px] text-slate-400">
                        ({u.gender === 'F' || u.gender === '여' ? '여' : '남'})
                      </span>
                      {u.isGuest && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                          임의추가
                        </span>
                      )}
                      {isMe && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                          현재 로그인
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>{u.email || `${u.name}@suntc.kr`}</span>
                      {u.phone && <span>· {u.phone}</span>}
                    </div>
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
                <div className="flex gap-2 pt-1.5 border-t border-slate-900">
                  <button
                    type="button"
                    onClick={() => openEditModal(u)}
                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>✎</span>
                    <span>회원정보 수정</span>
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
            );
          })}
        </div>
      </div>

      {/* ================================================================= */}
      {/* [모달]: 가입회원 상세 정보 수정 모달 */}
      {/* ================================================================= */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 text-white">
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
                <label className="block text-[11px] font-bold text-slate-300 mb-1">이메일 주소</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="example@suntc.kr"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
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
