
import React from 'react';
import { Role, UserProfile } from '../types';
import { LayoutGrid, ClipboardList, CheckSquare, History, Users, Download, Database, LogOut, X, BarChart3, BookOpen } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  profile: UserProfile;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, profile, onLogout, isOpen, onClose }) => {
  const isAdmin = profile.role === Role.ADMIN;

  const menuItems = [
    { id: 'leads', label: '案件總表', icon: ClipboardList, roles: [Role.ADMIN, Role.REVIEWER] },
    { id: 'review', label: '待我審核', icon: CheckSquare, roles: [Role.ADMIN, Role.REVIEWER] },
    { id: 'kanban', label: '流程看板', icon: LayoutGrid, roles: [Role.ADMIN, Role.REVIEWER] },
    { id: 'import', label: '匯入案件', icon: Download, roles: [Role.ADMIN] },
    { id: 'analytics', label: '財務分析', icon: BarChart3, roles: [Role.ADMIN, Role.REVIEWER] },
    { id: 'audit', label: '操作紀錄', icon: History, roles: [Role.ADMIN, Role.REVIEWER] },
    { id: 'members', label: '成員管理', icon: Users, roles: [Role.ADMIN] },
    { id: 'migration', label: '資料遷移', icon: Database, roles: [Role.ADMIN] },
    { id: 'help', label: '使用說明', icon: BookOpen, roles: [Role.ADMIN, Role.REVIEWER] },
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
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white text-xs">AI</div>
            <span className="text-xl font-bold text-white tracking-tight">AI案件管理系統</span>
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
              onClick={() => handleItemClick(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === item.id 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
              : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon size={18} />
            {item.label}
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
