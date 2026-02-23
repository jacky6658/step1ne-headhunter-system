import React, { useState, useEffect } from 'react';
import { auth, signInAnonymously } from '../mockBackend';
import { createUserProfile, getAllUsers, getUserProfile } from '../services/userService';
import { setUserOnline } from '../services/onlineService';
import { Role, UserProfile } from '../types';
import { ArrowRight, AlertCircle, Loader2, User, Shield } from 'lucide-react';

const LoginPage: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      let allUsers = await getAllUsers();
      
      // 如果沒有用戶，嘗試初始化預設用戶
      if (allUsers.length === 0) {
        console.log('未找到用戶，初始化預設用戶...');
        // 創建預設用戶
        await createUserProfile('admin', 'admin@aijob.internal', Role.ADMIN, 'Admin', 'admin123');
        await createUserProfile('phoebe', 'phoebe@aijob.internal', Role.REVIEWER, 'Phoebe', 'phoebe123');
        await createUserProfile('jacky', 'jacky@aijob.internal', Role.REVIEWER, 'Jacky', 'jacky123');
        await createUserProfile('jim', 'jim@aijob.internal', Role.REVIEWER, 'Jim', 'jim123');
        
        // 重新獲取用戶列表
        allUsers = await getAllUsers();
      }
      
      setUsers(allUsers);
    } catch (error) {
      console.error('載入用戶失敗:', error);
      setError('載入用戶資料失敗，請重新整理頁面');
    }
  };

  const handleCardClick = async (user: UserProfile) => {
    setLoading(true);
    setError('');

    try {
      // 直接登入，無需密碼
      const virtualEmail = `${user.displayName.toLowerCase()}@caseflow.internal`;
      
      // 使用用戶的原始 uid 作為登入 uid，確保一致性
      const loginUid = user.uid;
      
      // 先創建或更新用戶資料（如果不存在）
      let profile = await getUserProfile(loginUid);
      if (!profile) {
        profile = await createUserProfile(loginUid, virtualEmail, user.role, user.displayName);
      } else {
        // 更新現有 profile 到 localStorage
        localStorage.setItem('caseflow_profile', JSON.stringify(profile));
      }
      
      // 使用用戶的 uid 執行登入
      const userCredential = await signInAnonymously(auth, loginUid);
      
      // 確保 profile 已保存
      if (profile) {
        localStorage.setItem('caseflow_profile', JSON.stringify(profile));
        // 設置在線狀態
        await setUserOnline(loginUid);
      }
      
      // 登入完成，認證狀態會自動更新
      // 不需要手動設置 loading，因為認證狀態更新會觸發 App 重新渲染
    } catch (err: any) {
      console.error("Auth Error:", err);
      setError('登入處理失敗，請稍後再試。');
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name || name.length === 0) return '??';
    return name.substring(0, Math.min(2, name.length)).toUpperCase();
  };

  const getCardColor = (user: UserProfile) => {
    if (user.role === Role.ADMIN) {
      return 'from-purple-500 to-indigo-600';
    }
    return 'from-blue-500 to-cyan-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-6 sm:mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl sm:rounded-3xl shadow-2xl shadow-indigo-200 text-white font-black text-lg sm:text-xl mb-3 sm:mb-4 transform hover:scale-105 transition-transform">
            AI
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-1 sm:mb-2">AI案件管理系統</h1>
          <p className="text-slate-500 text-sm sm:text-base md:text-lg px-4">內部協作系統 · 請選擇您的身份</p>
        </div>

        {loading && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100 p-6 sm:p-10">
              <div className="flex flex-col items-center justify-center gap-3 sm:gap-4">
                <Loader2 className="animate-spin text-indigo-600" size={40} />
                <p className="text-base sm:text-lg font-black text-slate-700">登入中...</p>
              </div>
            </div>
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {users.map((user) => (
              <div
                key={user.uid}
                onClick={() => handleCardClick(user)}
                className="group relative bg-white rounded-2xl sm:rounded-3xl shadow-xl hover:shadow-2xl border-2 border-transparent hover:border-indigo-300 transition-all duration-300 cursor-pointer transform hover:scale-105 hover:-translate-y-2 overflow-hidden active:scale-95"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${getCardColor(user)} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                <div className="p-6 sm:p-8 relative z-10">
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-4 rounded-xl sm:rounded-2xl bg-gradient-to-br ${getCardColor(user)} flex items-center justify-center text-white text-xl sm:text-2xl font-black shadow-lg transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 overflow-hidden border-2 border-white/20`}>
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{getInitials(user.displayName)}</span>
                    )}
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 text-center mb-2 group-hover:text-indigo-600 transition-colors">
                    {user.displayName}
                  </h3>
                  <div className="flex items-center justify-center gap-2 text-[10px] sm:text-xs font-bold text-slate-500">
                    {user.role === Role.ADMIN ? (
                      <>
                        <Shield size={12} className="sm:w-[14px] sm:h-[14px]" />
                        <span>管理員</span>
                      </>
                    ) : (
                      <>
                        <User size={12} className="sm:w-[14px] sm:h-[14px]" />
                        <span>內部員工</span>
                      </>
                    )}
                  </div>
                  {user.status && (
                    <div className="mt-2 text-center">
                      <span className="text-[9px] sm:text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full">
                        {user.status}
                      </span>
                    </div>
                  )}
                  <div className="mt-3 sm:mt-4 flex items-center justify-center text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight size={16} className="sm:w-[18px] sm:h-[18px] transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
                {/* 點擊動畫效果 */}
                <div className="absolute inset-0 bg-indigo-500 opacity-0 group-active:opacity-20 transition-opacity duration-150 rounded-2xl sm:rounded-3xl"></div>
              </div>
            ))}
              </div>
        )}

        {error && !loading && (
          <div className="max-w-md mx-auto mt-4 sm:mt-6 px-4">
            <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-red-50 border border-red-100 rounded-xl">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <p className="text-xs text-red-600 font-medium">{error}</p>
            </div>
              </div>
            )}

        <div className="mt-8 sm:mt-12 text-center text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] sm:tracking-[0.3em] px-4">
          AI案件管理系統 v3.0.0
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
