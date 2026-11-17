import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AdminUserManagement() {
  const [users, setUsers] = useState([
    { id: 'u1', name: '김철수', gender: 'M', grade: '금배', role: 'member' },
    { id: 'u2', name: '이영희', gender: 'F', grade: '국화', role: 'member' },
    { id: 'u3', name: '박민수', gender: 'M', grade: '은배', role: 'member' },
    { id: 'u4', name: '정지훈', gender: 'M', grade: '동배', role: 'member' },
    { id: 'u5', name: '최수진', gender: 'F', grade: '개나리', role: 'member' },
    { id: 'u6', name: '강동원', gender: 'M', grade: '금배', role: 'member' },
    { id: 'u7', name: '한지민', gender: 'F', grade: '은배', role: 'member' },
    { id: 'u8', name: '송중기', gender: 'M', grade: '동배', role: 'member' },
    { id: 'u9', name: '공유', gender: 'M', grade: '금배', role: 'admin' },
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        setUsers(data);
      }
    } catch (e) {
      console.warn('유저 목록 조회 알림:', e);
    }
  };

  const handleGradeChange = async (userId, newGrade) => {
    setUsers(users.map((u) => (u.id === userId ? { ...u, grade: newGrade } : u)));
    try {
      await supabase
        .from('users')
        .update({ grade: newGrade })
        .eq('id', userId);
    } catch (e) {}
  };

  const handleRoleChange = async (userId, newRole) => {
    setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    try {
      await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);
    } catch (e) {}
  };

  const GRADE_OPTIONS = ['금배', '은배', '동배', '국화', '개나리', '테린이', '고령자부'];

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h2 className="text-sm font-black text-red-400 flex items-center gap-1.5">
            <span>👑</span> 썬 클럽 회원 등급 & 권한 관리
          </h2>
          <span className="text-[11px] text-slate-400 font-bold">
            총 {users.length}명 회원
          </span>
        </div>

        <div className="space-y-2.5">
          {users.map((u) => (
            <div
              key={u.id}
              className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs"
            >
              <div>
                <div className="font-bold text-white flex items-center gap-1.5">
                  <span>{u.name}</span>
                  <span className="text-[10px] text-slate-400">
                    ({u.gender === 'M' ? '남' : '여'})
                  </span>
                </div>
                <span className="text-[10px] text-amber-400 font-bold block mt-0.5">
                  {u.role === 'admin' ? '👑 클럽 운영자' : '일반 회원'}
                </span>
              </div>

              <div className="flex gap-1.5 items-center">
                {/* 실력 등급 선택 */}
                <select
                  value={u.grade}
                  onChange={(e) => handleGradeChange(u.id, e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-amber-300 text-[11px] font-bold rounded-lg px-2 py-1 focus:outline-none"
                >
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>

                {/* 운영자 권한 토글 */}
                <select
                  value={u.role}
                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
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
    </div>
  );
}
