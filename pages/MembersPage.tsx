import React, { useState, useEffect } from 'react';
import { UserProfile, Role } from '../types';
import { getAllUsers, setUserRole, createUserProfile, updateUserProfile, deleteUser } from '../services/userService';
import { Users, Shield, User, ChevronRight, Plus, Edit2, Trash2, X, Lock, Save, Download } from 'lucide-react';
import Badge from '../components/Badge';

interface MembersPageProps {
  userProfile: UserProfile;
}

interface UserFormData {
  displayName: string;
  password: string;
  role: Role;
  email: string;
}

const MembersPage: React.FC<MembersPageProps> = ({ userProfile }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    displayName: '',
    password: '',
    role: Role.REVIEWER,
    email: ''
  });

  useEffect(() => {
    loadUsers();
  }, []);

    const loadUsers = async () => {
      const data = await getAllUsers();
      setUsers(data);
      setLoading(false);
    };

  const handleToggleRole = async (uid: string, currentRole: Role) => {
    if (uid === userProfile.uid) return;
    const newRole = currentRole === Role.ADMIN ? Role.REVIEWER : Role.ADMIN;
    await setUserRole(uid, newRole);
    setUsers(users.map(u => u.uid === uid ? { ...u, role: newRole } : u));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.displayName || !formData.password) {
      alert('請填寫完整資訊');
      return;
    }

    try {
      const uid = formData.displayName.toLowerCase().replace(/\s+/g, '_');
      const email = formData.email || `${formData.displayName.toLowerCase()}@caseflow.internal`;
      
      await createUserProfile(uid, email, formData.role, formData.displayName, formData.password);
      await loadUsers();
      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      console.error('創建用戶失敗', err);
      alert('創建用戶失敗');
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updates: Partial<UserProfile> = {
        displayName: formData.displayName,
        email: formData.email || editingUser.email,
        role: formData.role
      };
      
      if (formData.password) {
        updates.password = formData.password;
      }

      await updateUserProfile(editingUser.uid, updates);
      await loadUsers();
      setEditingUser(null);
      resetForm();
    } catch (err) {
      console.error('更新用戶失敗', err);
      alert('更新用戶失敗');
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (uid === userProfile.uid) {
      alert('無法刪除自己的帳號');
      return;
    }

    if (!window.confirm('確定要刪除此用戶嗎？此操作無法復原。')) {
      return;
    }

    try {
      await deleteUser(uid);
      await loadUsers();
    } catch (err) {
      console.error('刪除用戶失敗', err);
      alert('刪除用戶失敗');
    }
  };

  const openEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({
      displayName: user.displayName,
      password: '',
      role: user.role,
      email: user.email
    });
  };

  const resetForm = () => {
    setFormData({
      displayName: '',
      password: '',
      role: Role.REVIEWER,
      email: ''
    });
  };

  // 備份所有資料到本地
  const handleBackupData = () => {
    try {
      // 讀取所有 localStorage 資料
      const leads = JSON.parse(localStorage.getItem('caseflow_leads_db') || '[]');
      const users = JSON.parse(localStorage.getItem('caseflow_users_db') || '{}');
      const auditLogs = JSON.parse(localStorage.getItem('caseflow_audit_db') || '[]');
      const onlineUsers = JSON.parse(localStorage.getItem('caseflow_online_users') || '[]');
      
      // 組織備份資料
      const backupData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        exportedBy: userProfile.displayName,
        data: {
          users: users,
          leads: leads,
          auditLogs: auditLogs,
          onlineUsers: onlineUsers
        },
        statistics: {
          userCount: Object.keys(users).length,
          leadCount: leads.length,
          auditLogCount: auditLogs.length,
          onlineUserCount: onlineUsers.length
        }
      };

      // 轉換為 JSON 字串並格式化
      const jsonString = JSON.stringify(backupData, null, 2);
      
      // 創建 Blob 並下載
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `caseflow_backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 顯示成功訊息
      alert(`備份成功！\n\n統計資訊：\n- 使用者：${backupData.statistics.userCount} 個\n- 案件：${backupData.statistics.leadCount} 筆\n- 審計日誌：${backupData.statistics.auditLogCount} 筆\n\n檔案已下載到您的下載資料夾。`);
    } catch (error) {
      console.error('備份失敗', error);
      alert('備份失敗，請稍後再試');
    }
  };

  const isAdmin = userProfile.role === Role.ADMIN;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900">團隊成員管理</h2>
              <p className="text-sm text-gray-500 mt-1">管理系統中的所有使用者與權限等級</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-indigo-100 text-indigo-700 font-black px-4 py-2">
              {users.length} 名成員
            </Badge>
            {isAdmin && (
              <>
                <button
                  onClick={handleBackupData}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
                  title="備份所有資料到本地"
                >
                  <Download size={18} />
                  備份資料
                </button>
                <button
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                  }}
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-2xl font-black hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg active:scale-95"
                >
                  <Plus size={18} />
                  新增成員
                </button>
              </>
            )}
          </div>
        </div>
        
        <div className="divide-y divide-gray-100">
          {users.map((user) => (
            <div key={user.uid} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white shadow-lg ${
                  user.role === Role.ADMIN 
                    ? 'bg-gradient-to-br from-purple-500 to-indigo-600' 
                    : 'bg-gradient-to-br from-blue-500 to-cyan-600'
                }`}>
                  {(user.displayName || '??').substring(0, Math.min(2, (user.displayName || '').length)).toUpperCase()}
                </div>
                <div>
                  <p className="text-base font-black text-gray-900">{user.displayName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {user.role === Role.ADMIN ? (
                      <span className="flex items-center gap-1.5 text-[10px] text-purple-600 font-black uppercase tracking-widest bg-purple-50 px-2 py-1 rounded-lg">
                        <Shield size={10} /> 管理員
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[10px] text-blue-600 font-black uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-lg">
                        <User size={10} /> 內部員工
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {isAdmin && user.uid !== userProfile.uid && (
                  <>
                    <button 
                      onClick={() => openEditModal(user)}
                      className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      title="編輯"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeleteUser(user.uid)}
                      className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      title="刪除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                )}
                {!isAdmin && user.uid !== userProfile.uid && (
                <button 
                  onClick={() => handleToggleRole(user.uid, user.role)}
                    className="px-4 py-2 text-xs font-bold border border-gray-200 rounded-lg hover:border-indigo-500 hover:text-indigo-600 transition-all flex items-center gap-2 opacity-0 group-hover:opacity-100"
                >
                  切換角色
                  <ChevronRight size={14} />
                </button>
              )}
                {user.uid === userProfile.uid && (
                  <span className="text-xs text-gray-400 italic font-medium px-4">目前登入</span>
              )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="p-20 text-center text-gray-400">載入成員中...</div>
          )}
        </div>
      </div>

      {/* 創建用戶模態框 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md border border-white/20">
            <div className="flex items-center justify-between p-8 border-b">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl">
                  <Plus size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">新增成員</h3>
                  <p className="text-xs text-slate-500">建立新的用戶卡片</p>
                </div>
              </div>
              <button onClick={() => { setShowCreateModal(false); resetForm(); }} className="text-slate-300 hover:text-slate-900 p-2">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-8 space-y-6">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">姓名</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl font-bold"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="例如：張三"
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Email</label>
                <input
                  type="email"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl font-bold"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="可選，留空將自動生成"
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">密碼</label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl font-bold"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="設定登入密碼"
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">角色</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl font-bold"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                >
                  <option value={Role.REVIEWER}>內部員工</option>
                  <option value={Role.ADMIN}>管理員</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className="flex-1 px-6 py-3 text-slate-600 font-black hover:bg-slate-50 rounded-2xl transition-all"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg"
                >
                  建立
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 編輯用戶模態框 */}
      {editingUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md border border-white/20">
            <div className="flex items-center justify-between p-8 border-b">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl">
                  <Edit2 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">編輯成員</h3>
                  <p className="text-xs text-slate-500">修改用戶資訊</p>
                </div>
              </div>
              <button onClick={() => { setEditingUser(null); resetForm(); }} className="text-slate-300 hover:text-slate-900 p-2">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleEditUser} className="p-8 space-y-6">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">姓名</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl font-bold"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Email</label>
                <input
                  type="email"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl font-bold"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block flex items-center gap-2">
                  <Lock size={12} />
                  新密碼（留空則不變更）
                </label>
                <input
                  type="password"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl font-bold"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="留空則不變更密碼"
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">角色</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl font-bold"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                >
                  <option value={Role.REVIEWER}>內部員工</option>
                  <option value={Role.ADMIN}>管理員</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setEditingUser(null); resetForm(); }}
                  className="flex-1 px-6 py-3 text-slate-600 font-black hover:bg-slate-50 rounded-2xl transition-all"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  儲存變更
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembersPage;
