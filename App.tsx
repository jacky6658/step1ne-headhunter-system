
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, type User, auth } from './mockBackend';
import { getUserProfile } from './services/userService';
import { UserProfile, Role } from './types';
import Sidebar from './components/Sidebar';
import ProfileSettingsModal from './components/ProfileSettingsModal';
import MembersPage from './pages/MembersPage';
import ImportPage from './pages/ImportPage';
import MigrationPage from './pages/MigrationPage';
import AnalyticsPage from './pages/AnalyticsPage';
import HelpPage from './pages/HelpPage';
import LoginPage from './pages/LoginPage';
// 新增: 候選人管理頁面
import { CandidatesPage } from './pages/CandidatesPage';
import { CandidateKanbanPage } from './pages/CandidateKanbanPage';
import { AIMatchingPage } from './pages/AIMatchingPage';
import { Menu, X as XIcon } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('candidates');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        } else {
          // 如果後端沒有資料，嘗試從 localStorage 讀取（降級方案）
          const savedProfile = localStorage.getItem('caseflow_profile');
          if (savedProfile) {
            try {
              const p = JSON.parse(savedProfile);
              if (p.uid === u.uid) {
                setProfile(p);
              }
            } catch (e) {
              console.error('Failed to parse saved profile', e);
            }
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 權限保護：如果非管理員用戶嘗試訪問受限頁面，自動重定向
  useEffect(() => {
    if (!profile) return;
    
    const adminOnlyTabs = ['members', 'import', 'migration'];
    if (adminOnlyTabs.includes(activeTab) && profile.role !== Role.ADMIN) {
      // 非管理員嘗試訪問管理員專用頁面，重定向到候選人總表
      setActiveTab('candidates');
    }
  }, [activeTab, profile]);

  const handleLogout = async () => {
    signOut(auth);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  if (!user || !profile) return <LoginPage />;

  const renderContent = () => {
    switch (activeTab) {
      // 候選人管理頁面
      case 'candidates': return <CandidatesPage userProfile={profile} />;
      case 'candidate-kanban': return <CandidateKanbanPage userProfile={profile} />;
      // AI 配對推薦
      case 'ai-matching': return <AIMatchingPage userProfile={profile} />;
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
        return <AnalyticsPage leads={[]} userProfile={profile} />;
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
      default: return <CandidatesPage userProfile={profile} />;
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
               activeTab === 'help' ? '使用說明' :
               activeTab === 'jobs' ? '職缺管理' :
               activeTab === 'bd-clients' ? 'BD 客戶開發' :
               activeTab === 'pipeline' ? 'Pipeline 追蹤' :
               activeTab === 'ai-matching' ? 'AI 配對推薦' : 'Step1ne 獵頭系統'}
            </h1>
                <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] sm:tracking-[0.2em] mt-0.5 hidden sm:block">Collaborative Workspace</p>
          </div>
            </div>

            {/* 右側：當前用戶 */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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
