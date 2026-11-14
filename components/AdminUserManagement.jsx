import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AdminUserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  // 1. 전체 회원 목록 조회
  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('회원 목록 조회 실패:', error);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  // 2. 회원 실력 등급 변경 핸들러
  const handleGradeChange = async (userId, newGrade) => {
    const { error } = await supabase
      .from('users')
      .update({ grade: newGrade })
      .eq('id', userId);

    if (error) {
      alert('등급 변경 실패: ' + error.message);
    } else {
      // 로컬 상태 즉시 갱신
      setUsers(users.map(u => u.id === userId ? { ...u, grade: newGrade } : u));
    }
  };

  // 3. 회원 권한(Role) 변경 핸들러
  const handleRoleChange = async (userId, newRole) => {
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      alert('권한 변경 실패: ' + error.message);
    } else {
      // 로컬 상태 즉시 갱신
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 font-medium">회원 목록을 불러오는 중...</div>;
  }

  return (
    <div className="max-w-md mx-auto p-4 bg-gray-50 min-h-screen font-sans">
      {/* 상단 헤더 */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-green-800">⚙️ 회원 등급 및 권한 관리</h1>
        <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
          관리자 전용
        </span>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        클럽원들의 등급을 수정하면 KDK 밸런싱 알고리즘에 즉시 반영됩니다.
      </p>

      {/* 회원 카드 리스트 */}
      <div className="space-y-3">
        {users.map((user) => (
          <div key={user.id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            {/* 회원 이름 및 권한 설정 */}
            <div className="flex justify-between items-center mb-3">
              <div>
                <span className="font-bold text-gray-900 text-base">{user.name}</span>
                <span className="ml-2 text-xs text-gray-500">
                  ({user.gender === 'M' ? '남성' : '여성'})
                </span>
              </div>
              
              {/* 운영자 / 일반 회원 권한 드롭다운 */}
              <select
                value={user.role}
                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                className={`text-xs font-bold px-2 py-1 rounded-lg border outline-none ${
                  user.role === 'admin' 
                    ? 'bg-red-50 text-red-700 border-red-200' 
                    : 'bg-gray-50 text-gray-700 border-gray-200'
                }`}
              >
                <option value="member">일반 회원</option>
                <option value="admin">운영자 (Admin)</option>
              </select>
            </div>

            {/* 실력 등급 선택 드롭다운 */}
            <div className="flex items-center justify-between pt-3 border-t text-xs text-gray-600">
              <span className="font-semibold">실력 등급 설정:</span>
              <select
                value={user.grade}
                onChange={(e) => handleGradeChange(user.id, e.target.value)}
                className="px-3 py-1 bg-green-50 text-green-800 font-bold rounded-lg border border-green-200 outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="금배">금배</option>
                <option value="은배">은배</option>
                <option value="동배">동배</option>
                <option value="국화">국화</option>
                <option value="개나리">개나리</option>
                <option value="테린이">테린이</option>
                <option value="고령자부">고령자부</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
