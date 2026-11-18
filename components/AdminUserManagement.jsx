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

export default function AdminUserManagement({
  externalUsers,
  currentUserId,
  onUpdateMember,
  onCancelMembership,
  onAddMember,
  onApproveMember,
  onRejectMember,
}) {
  const [users, setUsers] = useState(
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

  const [searchQuery, setSearchQuery] = useState('');

  const [editingMember, setEditingMember] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(true);
  const [editPhone, setEditPhone] = useState('');
  const [editGender, setEditGender] = useState('M');
  const [editGrade, setEditGrade] = useState('은배');
  const [editRole, setEditRole] = useState('member');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newGender, setNewGender] = useState('M');
  const [newGrade, setNewGrade] = useState('테린이');
  const [newRole, setNewRole] = useState('member');

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
        setUsers(data);
      }
    } catch {}
  };

  const openEditModal = (member) => {
    let resolvedPassword = member.password || '';
    if (!resolvedPassword) {
      try {
        const savedList = JSON.parse(localStorage.getItem('sun_tennis_registered_users') || '[]');
        const found = savedList.find(
          (u) =>
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
    setEditGender(member.gender === 'F' || member.gender === '여' ? 'F' : 'M');
    setEditGrade(member.grade || '은배');
    setEditRole(member.role || 'member');
  };

  const handleSaveEdit = async (e) => {
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

    const updated = {
      ...editingMember,
      name: editName.trim(),
      username: trimmedId,
      password: trimmedPw,
      email: trimmedId.includes('@') ? trimmedId : editingMember.email || '',
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
      const existsInStorage = savedList.some(
        (u) =>
          u.id === updated.id ||
          (editingMember.username && u.username?.toLowerCase() === editingMember.username.toLowerCase()) ||
          (editingMember.email && u.email && u.email === editingMember.email)
      );
      const nextSaved = existsInStorage
        ? savedList.map((u) =>
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
          })
          .eq('id', updated.id);
      } catch {}
    }

    setEditingMember(null);
    alert(
      `✅ [${updated.name}] 회원의 정보가 수정되었습니다.\n아이디: ${updated.username || '미설정'} / 비밀번호: ${
        updated.password ? '변경(저장) 완료' : '미설정'
      }`
    );
  };

  const handleQuickGradeChange = async (member, newGradeVal) => {
    const updated = { ...member, grade: newGradeVal };
    setUsers((prev) => prev.map((u) => (u.id === member.id ? updated : u)));
    if (onUpdateMember) onUpdateMember(updated);

    try {
      const savedList = JSON.parse(localStorage.getItem('sun_tennis_registered_users') || '[]');
      const nextSaved = savedList.map((u) =>
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

  const handleQuickRoleChange = async (member, newRoleVal) => {
    const updated = { ...member, role: newRoleVal };
    setUsers((prev) => prev.map((u) => (u.id === member.id ? updated : u)));
    if (onUpdateMember) onUpdateMember(updated);

    try {
      const savedList = JSON.parse(localStorage.getItem('sun_tennis_registered_users') || '[]');
      const nextSaved = savedList.map((u) =>
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

  const handleApproveMember = async (member) => {
    const approved = { ...member, approvalStatus: 'approved' };
    setUsers((prev) => prev.map((u) => (u.id === member.id ? approved : u)));
    if (onApproveMember) {
      onApproveMember(approved);
    } else if (onUpdateMember) {
      onUpdateMember(approved);
    }

    try {
      const savedList = JSON.parse(localStorage.getItem('sun_tennis_registered_users') || '[]');
      const exists = savedList.some(
        (u) =>
          u.id === member.id ||
          (member.username && u.username?.toLowerCase() === member.username.toLowerCase())
      );
      const nextSaved = exists
        ? savedList.map((u) =>
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

  const handleRejectMember = async (member) => {
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
        (u) =>
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

  const handleCancelUserMembership = async (member) => {
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
        (u) =>
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

  const handleAdminAddMember = (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      alert('등록할 회원 이름을 입력해 주세요.');
      return;
    }

    const created = {
      id: `p_${Date.now()}`,
      username: newEmail.trim() || newName.trim(),
      password: newPassword.trim() || undefined,
      name: newName.trim(),
      email: newEmail.trim().includes('@') ? newEmail.trim() : '',
      phone: newPhone.trim(),
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
    setShowAddForm(false);
    alert(`🎉 [${created.name} (${created.grade})] 회원이 신규 등록되었습니다.`);
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
    <div className="space-y-4">
      <div
        className={`rounded-2xl p-4 shadow-xl space-y-3 border ${
          pendingUsers.length > 0
            ? 'bg-gradient-to-br from-amber-950/60 via-slate-900 to-slate-900 border-amber-500/50'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <div>
            <h2 className="text-sm font-black text-amber-300 flex items-center gap-1.5">
              <span>⏳</span> 회원가입 승인 대기 목록
              {pendingUsers.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black animate-pulse">
                  {pendingUsers.length}명 대기
                </span>
              )}
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              신규 가입 신청 회원을 운영자가 확인 후 승인하면 정회원으로 등록되어 앱에 접속할 수 있습니다.
            </p>
          </div>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 text-center text-[11px] text-slate-400">
            현재 승인 대기 중인 회원가입 신청이 없습니다.
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingUsers.map((u) => (
              <div
                key={u.id}
                className="bg-slate-950/90 border border-amber-500/40 rounded-2xl p-3 space-y-2.5 text-xs shadow-md"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-black text-white">{u.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                        {u.grade}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        ({u.gender === 'F' || u.gender === '여' ? '여' : '남'})
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/40 font-black">
                        승인 대기중
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                      <span>신청 ID: <strong className="text-slate-200">{u.username || u.email || '미등록'}</strong></span>
                      {u.phone && <span>· 연락처: {u.phone}</span>}
                      {u.requestedAt && <span>· 신청일시: {u.requestedAt}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-1 border-t border-slate-800/80">
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
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3.5">
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
            <div className="grid grid-cols-3 gap-2">
              <select
                value={newGender}
                onChange={(e) => setNewGender(e.target.value)}
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
                onChange={(e) => setNewRole(e.target.value)}
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

        <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
          {filteredUsers.map((u) => {
            const isMe = currentUserId && String(u.id) === String(currentUserId);
            return (
              <div
                key={u.id}
                className="bg-slate-950 p-3 rounded-2xl border border-slate-800 hover:border-slate-700 transition space-y-2.5 text-xs"
              >
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
                      <span>ID: {u.username || u.email || '미등록'}</span>
                      {u.phone && <span>· {u.phone}</span>}
                    </div>
                  </div>

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
                      onChange={(e) => handleQuickRoleChange(u, e.target.value)}
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

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">성별</label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
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
                  onChange={(e) => setEditRole(e.target.value)}
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
