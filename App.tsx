
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, type User, auth } from './mockBackend';
import { getUserProfile } from './services/userService';
import { setUserOnline, setUserOffline, getOnlineUserProfiles } from './services/onlineService';
import { UserProfile, Role, Lead } from './types';
import Sidebar from './components/Sidebar';
import ProfileSettingsModal from './components/ProfileSettingsModal';
import LeadsPage from './pages/LeadsPage';
import ReviewPage from './pages/ReviewPage';
import KanbanPage from './pages/KanbanPage';
import AuditLogsPage from './pages/AuditLogsPage';
import MembersPage from './pages/MembersPage';
import ImportPage from './pages/ImportPage';
import MigrationPage from './pages/MigrationPage';
import AnalyticsPage from './pages/AnalyticsPage';
import HelpPage from './pages/HelpPage';
import LoginPage from './pages/LoginPage';
// 新增: 候選人管理頁面
import { CandidatesPage } from './pages/CandidatesPage';
import { CandidateKanbanPage } from './pages/CandidateKanbanPage';
import { subscribeToLeads } from './services/leadService';
import { Menu, X as XIcon } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<UserProfile[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedUser, setExpandedUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // 在 API 模式下，總是從後端獲取最新的用戶資料
        // 這樣可以確保看到最新的頭貼和狀態
        const p = await getUserProfile(u.uid);
        if (p) {
          setProfile(p);
          // 同步更新 localStorage（用於降級方案）
          localStorage.setItem('caseflow_profile', JSON.stringify(p));
          // 設置在線狀態
          await setUserOnline(p.uid);
        } else {
          // 如果後端沒有資料，嘗試從 localStorage 讀取（降級方案）
          const savedProfile = localStorage.getItem('caseflow_profile');
          if (savedProfile) {
            try {
              const p = JSON.parse(savedProfile);
              if (p.uid === u.uid) {
        setProfile(p);
                await setUserOnline(p.uid);
              }
            } catch (e) {
              console.error('Failed to parse saved profile', e);
            }
          }
        }
      } else {
        // 登出時設置離線
        if (profile) {
          await setUserOffline(profile.uid);
        }
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 定期更新在線用戶列表（包括頭貼和狀態）
  useEffect(() => {
    if (!profile) return;

    const updateOnlineUsers = async () => {
      try {
        const online = await getOnlineUserProfiles();
        setOnlineUsers(online);
      } catch (error) {
        console.error('更新在線用戶列表失敗:', error);
      }
    };

    updateOnlineUsers();
    const interval = setInterval(updateOnlineUsers, 5000); // 每5秒更新一次

    return () => clearInterval(interval);
  }, [profile]);

  useEffect(() => {
    if (user) {
      const unsubLeads = subscribeToLeads((loadedLeads) => {
        setLeads(loadedLeads);
      });
      return () => unsubLeads();
    } else {
      setLeads([]);
    }
  }, [user]);

  // 權限保護：如果非管理員用戶嘗試訪問受限頁面，自動重定向
  useEffect(() => {
    if (!profile) return;
    
    const adminOnlyTabs = ['members', 'import', 'migration'];
    if (adminOnlyTabs.includes(activeTab) && profile.role !== Role.ADMIN) {
      // 非管理員嘗試訪問管理員專用頁面，重定向到案件總表
      setActiveTab('leads');
    }
  }, [activeTab, profile]);

  const handleLogout = async () => {
    if (profile) {
      await setUserOffline(profile.uid);
    }
    signOut(auth);
  };

  const handleUserAvatarClick = (user: UserProfile) => {
    // 如果點擊的是已展開的用戶，則收起
    if (expandedUser?.uid === user.uid) {
      setExpandedUser(null);
    } else {
      setExpandedUser(user);
    }
  };

  const getInitials = (name: string) => {
    if (!name || name.length === 0) return '??';
    return name.substring(0, Math.min(2, name.length)).toUpperCase();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  if (!user || !profile) return <LoginPage />;

  const renderContent = () => {
    switch (activeTab) {
      // 新增: 候選人管理頁面
      case 'candidates': return <CandidatesPage userProfile={profile} />;
      case 'candidate-kanban': return <CandidateKanbanPage userProfile={profile} />;
      // 舊的案件管理頁面（保留）
      case 'leads': return <LeadsPage leads={leads} userProfile={profile} />;
      case 'review': return <ReviewPage leads={leads} userProfile={profile} />;
      case 'kanban': return <KanbanPage leads={leads} userProfile={profile} />;
      case 'audit': return <AuditLogsPage leads={leads} userProfile={profile} />;
      case 'members': 
        // 只有管理員可以訪問成員管理
        if (profile.role !== Role.ADMIN) {
          return (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
                <h2 className="text-xl font-black text-slate-900 mb-2">權限不足</h2>
                <p className="text-slate-500">只有管理員可以訪問此頁面</p>
              </div>
            </div>
          );
        }
        return <MembersPage userProfile={profile} />;
      case 'import': 
        // 只有管理員可以訪問匯入案件
        if (profile.role !== Role.ADMIN) {
          return (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
                <h2 className="text-xl font-black text-slate-900 mb-2">權限不足</h2>
                <p className="text-slate-500">只有管理員可以訪問此頁面</p>
              </div>
            </div>
          );
        }
        return <ImportPage userProfile={profile} />;
      case 'analytics': 
        // 所有用戶都可以查看財務分析
        return <AnalyticsPage leads={leads} userProfile={profile} />;
      case 'help':
        // 所有用戶都可以查看使用說明
        return <HelpPage userProfile={profile} />;
      case 'migration': 
        // 只有管理員可以訪問資料遷移
        if (profile.role !== Role.ADMIN) {
          return (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
                <h2 className="text-xl font-black text-slate-900 mb-2">權限不足</h2>
                <p className="text-slate-500">只有管理員可以訪問此頁面</p>
              </div>
            </div>
          );
        }
        return <MigrationPage userProfile={profile} />;
      default: return <LeadsPage leads={leads} userProfile={profile} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        profile={profile} 
        onLogout={handleLogout} 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1 flex flex-col overflow-hidden sm:ml-0">
        <header className="h-auto bg-white/80 backdrop-blur-md border-b border-gray-100 flex flex-col shadow-sm z-30">
          {/* 頂部欄 */}
          <div className="flex items-center justify-between px-4 sm:px-6 md:px-10 py-3 sm:py-0 sm:h-20">
            {/* 左側：漢堡選單 + 標題 */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="sm:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all active:scale-95"
              >
                <Menu size={24} />
              </button>
              <div className="flex flex-col min-w-0 flex-1">
                <h1 className="text-base sm:text-lg md:text-xl font-black text-slate-900 tracking-tight truncate">
              {activeTab === 'candidates' ? 'Step1ne 候選人總表' : 
               activeTab === 'candidate-kanban' ? 'Step1ne 候選人看板' :
               activeTab === 'leads' ? '案件總表' : 
               activeTab === 'review' ? '待我審核' :
               activeTab === 'kanban' ? '流程看板' :
               activeTab === 'audit' ? '操作紀錄' :
               activeTab === 'members' ? '成員管理' : 
               activeTab === 'import' ? '匯入案件' :
               activeTab === 'migration' ? '資料遷移' : 'Step1ne 獵頭系統'}
            </h1>
                <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] sm:tracking-[0.2em] mt-0.5 hidden sm:block">Collaborative Workspace</p>
          </div>
            </div>

            {/* 右側：在線成員 + 當前用戶 */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* 在線成員 */}
              {onlineUsers.length > 0 ? (
                <div className="flex items-center gap-2 -space-x-2">
                  {onlineUsers
                    .filter(u => u.uid !== profile?.uid) // 過濾掉當前用戶自己
                    .slice(0, 4)
                    .map((onlineUser) => (
                      <div
                        key={onlineUser.uid}
                        onClick={() => handleUserAvatarClick(onlineUser)}
                        className={`relative cursor-pointer transition-transform active:scale-95 ${
                          expandedUser?.uid === onlineUser.uid ? 'scale-110 z-10' : 'hover:scale-110'
                        }`}
                        title={onlineUser.displayName}
                      >
                        {onlineUser.avatar ? (
                          <img
                            src={onlineUser.avatar}
                            alt={onlineUser.displayName}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl object-cover border-2 border-white shadow-md"
                            onError={(e) => {
                              console.error(`頭貼載入失敗: ${onlineUser.displayName}`, onlineUser.avatar?.substring(0, 50));
                              // 如果圖片載入失敗，隱藏圖片元素，顯示預設頭像
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs sm:text-sm font-black border-2 border-white shadow-md">
                            {getInitials(onlineUser.displayName)}
                          </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-4 sm:h-4 bg-green-500 border-2 border-white rounded-full shadow-sm"></div>
                      </div>
                    ))}
                  {onlineUsers.filter(u => u.uid !== profile?.uid).length > 4 && (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-600 text-xs sm:text-sm font-black border-2 border-white shadow-md">
                      +{onlineUsers.filter(u => u.uid !== profile?.uid).length - 4}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">無其他在線成員</div>
              )}

              {/* 當前用戶 */}
              <div 
                onClick={() => setShowProfileModal(true)}
                className="flex items-center gap-2 sm:gap-3 md:gap-4 p-1.5 sm:p-2 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100 shadow-inner cursor-pointer hover:bg-slate-100 transition-all active:scale-95"
              >
                {profile.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile.displayName}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-slate-800 rounded-lg sm:rounded-xl flex items-center justify-center font-black text-white text-[10px] sm:text-xs">
                    {profile.displayName ? profile.displayName[0] : '?'}
                  </div>
                )}
                <div className="flex flex-col pr-1 sm:pr-2 hidden sm:block">
                  <span className="text-[10px] sm:text-xs font-black text-slate-800 leading-none truncate max-w-[80px] md:max-w-none">
                {profile.displayName}
              </span>
                  <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase mt-0.5 sm:mt-1 truncate max-w-[80px] md:max-w-none">
                    {profile.status || profile.role}
              </span>
                </div>
              </div>
            </div>
          </div>

          {/* 展開的用戶詳細資料（手機版顯示在下方） */}
          {expandedUser && (
            <div className="border-t border-gray-100 bg-white p-4 sm:p-6 animate-in slide-in-from-top-2">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {expandedUser.avatar ? (
                      <img
                        src={expandedUser.avatar}
                        alt={expandedUser.displayName}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-slate-200 shadow-lg"
                      />
                    ) : (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl sm:text-3xl font-black border-2 border-slate-200 shadow-lg">
                        {getInitials(expandedUser.displayName)}
                      </div>
                    )}
                    {expandedUser.isOnline && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-green-500 border-3 border-white rounded-full shadow-lg"></div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-1">{expandedUser.displayName}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {expandedUser.role === Role.ADMIN ? (
                        <span className="text-xs text-purple-600 font-black uppercase tracking-widest bg-purple-50 px-2 py-1 rounded-full">
                          管理員
                        </span>
                      ) : (
                        <span className="text-xs text-blue-600 font-black uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-full">
                          內部員工
                        </span>
                      )}
                      {expandedUser.isOnline && (
                        <span className="text-xs text-green-600 font-black uppercase tracking-widest bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          在線
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedUser(null)}
                  className="text-slate-400 hover:text-slate-900 p-2 rounded-lg hover:bg-slate-100 transition-all"
                >
                  <XIcon size={20} />
                </button>
              </div>

              {expandedUser.status && (
                <div className="mb-4 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                  <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-1">個人狀態</p>
                  <p className="text-sm font-bold text-indigo-900">{expandedUser.status}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email</p>
                  <p className="text-sm font-bold text-slate-700">{expandedUser.email}</p>
                </div>
                {expandedUser.createdAt && (
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">加入時間</p>
                    <p className="text-sm font-bold text-slate-700">
                      {new Date(expandedUser.createdAt).toLocaleDateString('zh-TW')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </header>
        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-10 bg-slate-50/50">
          {renderContent()}
        </div>
      </main>

      {/* 個人化設定模態框 */}
      {profile && (
        <ProfileSettingsModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          userProfile={profile}
          onUpdate={(updatedProfile) => {
            setProfile(updatedProfile);
            // 更新 localStorage
            localStorage.setItem('caseflow_profile', JSON.stringify(updatedProfile));
          }}
        />
      )}

    </div>
  );
};

export default App;
