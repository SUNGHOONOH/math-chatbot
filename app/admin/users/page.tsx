'use client';

import { useState, useEffect } from 'react';
import { Shield, User, GraduationCap, Search, CheckCircle2, MoreHorizontal } from 'lucide-react';

type UserProfile = {
  id: string;
  nickname: string;
  role: string;
  has_consented: boolean;
  grade_level?: string | null;
  created_at: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState('');
  const [editRole, setEditRole] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/admin/api/users');
      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.error || '사용자 목록을 불러오지 못했습니다.');
      }

      setUsers(payload.users ?? []);
    } catch (err) {
      console.error(err);
      setUsers([]);
      setErrorMessage(err instanceof Error ? err.message : '사용자 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  const startEdit = (up: UserProfile) => {
    setEditingId(up.id);
    setEditNickname(up.nickname);
    setEditRole(up.role);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditNickname('');
    setEditRole('');
  };

  const handleUpdate = async (userId: string) => {
    setUpdating(true);
    try {
      const res = await fetch('/admin/api/users/update', {
        method: 'PATCH',
        body: JSON.stringify({
          targetUserId: userId,
          newNickname: editNickname,
          newRole: editRole
        })
      });

      if (res.ok) {
        setUsers((currentUsers) =>
          currentUsers.map((user) =>
            user.id === userId ? { ...user, nickname: editNickname, role: editRole } : user,
          ),
        );
        setEditingId(null);
      } else {
        const d = await res.json();
        alert(`수정 실패: ${d.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.nickname.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.id.includes(searchQuery)
  );

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight flex items-center gap-3">
          <User className="text-blue-600" size={32} />
          사용자 / 권한 관리
        </h1>
        <p className="text-zinc-500 mt-2 text-sm">
          가입한 학생의 프로필을 조회하고, 권한(학생, 튜터, 관리자)을 승격하거나 닉네임을 변경할 수 있습니다.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input 
              type="text" 
              placeholder="이름 또는 ID 검색..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div className="text-xs text-zinc-500 font-mono">
            총 {users.length} 명
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 text-xs">
              <tr>
                <th className="px-6 py-4 font-semibold w-1/4">가입일시 (ID)</th>
                <th className="px-6 py-4 font-semibold w-1/4">이름 / 닉네임</th>
                <th className="px-6 py-4 font-semibold w-1/4">권한 (Role)</th>
                <th className="px-6 py-4 font-semibold">데이터 동의</th>
                <th className="px-6 py-4 font-semibold text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-400">데이터를 불러오는 중입니다...</td>
                </tr>
              ) : errorMessage ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-rose-500">{errorMessage}</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-400">검색 결과가 없습니다.</td>
                </tr>
              ) : filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-zinc-900 font-medium">{new Date(user.created_at).toLocaleDateString()}</p>
                    <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{user.id.split('-')[0]}</p>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {editingId === user.id ? (
                        <input 
                          type="text" 
                          value={editNickname} 
                          onChange={(e) => setEditNickname(e.target.value)}
                          className="px-3 py-1.5 border border-zinc-300 rounded text-sm w-full max-w-[200px]"
                        />
                      ) : (
                        <span className="font-semibold text-zinc-800">{user.nickname}</span>
                      )}
                      <p className="text-[10px] text-zinc-400">{user.grade_level || '학년 정보 없음'}</p>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    {editingId === user.id ? (
                      <select 
                        value={editRole} 
                        onChange={(e) => setEditRole(e.target.value)}
                        className="px-3 py-1.5 border border-zinc-300 rounded text-sm bg-white"
                      >
                        <option value="student">Student (학생)</option>
                        <option value="tutor">Tutor (강사)</option>
                        <option value="admin">Admin (관리자)</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                        user.role === 'admin' ? 'bg-red-50 text-red-700 border border-red-100' :
                        user.role === 'tutor' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                        'bg-blue-50 text-blue-700 border border-blue-100'
                      }`}>
                        {user.role === 'admin' && <Shield size={12} />}
                        {user.role === 'tutor' && <GraduationCap size={12} />}
                        {user.role === 'student' && <User size={12} />}
                        {user.role.toUpperCase()}
                      </span>
                    )}
                  </td>
                  
                  <td className="px-6 py-4">
                    {user.has_consented ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                        <CheckCircle2 size={14} /> 동의완료
                      </span>
                    ) : (
                      <span className="text-zinc-400 text-xs">미동의</span>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 text-right">
                    {editingId === user.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={cancelEdit} className="px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 rounded transition-colors">취소</button>
                        <button onClick={() => handleUpdate(user.id)} disabled={updating} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50">저장</button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(user)} className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <MoreHorizontal size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
