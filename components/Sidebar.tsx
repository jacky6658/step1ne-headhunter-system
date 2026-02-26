
import React from 'react';
import { Role, UserProfile } from '../types';
import { LayoutGrid, ClipboardList, CheckSquare, History, Users, Download, Database, LogOut, X, BarChart3, BookOpen, ScrollText, Target, Bot } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  profile: UserProfile;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, profile, onLogout, isOpen, onClose }) => {
  if (!profile) {
    return null; // Safety check
  }
  
  const isAdmin = profile.role === Role.ADMIN;

  const menuItems = [
    // 核心功能
    { id: 'candidates', label: '📋 候選人總表', icon: Users, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    { id: 'candidate-kanban', label: '📊 候選人看板', icon: LayoutGrid, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    
    // 職缺與配對功能
    { id: 'jobs', label: '💼 職缺管理', icon: ClipboardList, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    { id: 'ai-matching', label: '🤖 AI 配對推薦', icon: CheckSquare, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    
    // 未來功能
    { id: 'bd-clients', label: '🎯 BD 客戶開發', icon: Target, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    { id: 'pipeline', label: '📈 顧問人選追蹤表', icon: BarChart3, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    
    // Bot 排程
    { id: 'bot-scheduler', label: '🤖 Bot 排程設定', icon: Bot, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    // 工具
    { id: 'system-log', label: '📋 操作日誌', icon: ScrollText, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    { id: 'help', label: '📖 使用說明', icon: BookOpen, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    { id: 'migration', label: '🛠️ 資料維護', icon: Database, roles: [Role.ADMIN], disabled: false },
  ];

  const handleItemClick = (id: string) => {
    setActiveTab(id);
    // 手機版點擊後關閉抽屜
    if (window.innerWidth < 640) {
      onClose();
    }
  };

  return (
    <>
      {/* 手機版遮罩層 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 sm:hidden"
          onClick={onClose}
        />
      )}

      {/* 側邊欄 */}
      <div className={`
        fixed sm:static inset-y-0 left-0 z-50
        w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}
        shadow-2xl sm:shadow-none
      `}>
        {/* 手機版關閉按鈕 */}
        <div className="p-4 sm:p-6 flex items-center justify-between border-b border-slate-800 sm:border-b-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white text-xs">S1</div>
            <span className="text-xl font-bold text-white tracking-tight">Step1ne 獵頭系統</span>
          </div>
          <button
            onClick={onClose}
            className="sm:hidden text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-all"
          >
            <X size={20} />
          </button>
      </div>
      
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {menuItems.filter(item => item.roles.includes(profile.role)).map((item) => (
          <button
            key={item.id}
              onClick={() => !item.disabled && handleItemClick(item.id)}
            disabled={item.disabled}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              item.disabled
                ? 'opacity-50 cursor-not-allowed text-slate-500'
                : activeTab === item.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <item.icon size={18} />
              {item.label}
            </div>
            {item.badge && (
              <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
        >
          <LogOut size={18} />
          登出
        </button>
      </div>
    </div>
    </>
  );
};

export default Sidebar;
