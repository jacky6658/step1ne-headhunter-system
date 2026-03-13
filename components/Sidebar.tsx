
import React from 'react';
import { Role, UserProfile } from '../types';
import { LayoutGrid, ClipboardList, CheckSquare, History, Users, Download, Database, LogOut, X, BarChart3, BookOpen, ScrollText, Target, Bot, Upload, Activity, ChevronsLeft, ChevronsRight, Globe } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  profile: UserProfile;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, profile, onLogout, isOpen, onClose, collapsed, onToggleCollapse }) => {
  if (!profile) {
    return null; // Safety check
  }

  const isAdmin = profile.role === Role.ADMIN;

  const menuItems = [
    // 總攬看板
    { id: 'overview-dashboard', label: '📊 總攬看板', icon: BarChart3, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    // 運營總覽
    { id: 'ops-dashboard', label: '📈 運營儀表板', icon: BarChart3, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    // 核心功能
    { id: 'candidates', label: '候選人總表', shortLabel: '總表', icon: Users, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    { id: 'candidate-kanban', label: '候選人看板', shortLabel: '看板', icon: LayoutGrid, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },

    // 職缺與配對功能
    { id: 'jobs', label: '職缺管理', shortLabel: '職缺', icon: ClipboardList, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    { id: 'ai-matching', label: 'AI 配對推薦', shortLabel: 'AI', icon: CheckSquare, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },

    // 未來功能
    { id: 'bd-clients', label: 'BD 客戶開發', shortLabel: 'BD', icon: Target, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    { id: 'pipeline', label: '顧問人選追蹤表', shortLabel: '追蹤', icon: BarChart3, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },

    // Bot 排程
    { id: 'bot-scheduler', label: 'Bot 排程設定', shortLabel: 'Bot', icon: Bot, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    { id: 'resume-import', label: '履歷批量匯入', shortLabel: '匯入', icon: Upload, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },

    // 爬蟲 & AI
    { id: 'crawler-dashboard', label: '爬蟲整合儀表板', shortLabel: '爬蟲', icon: Activity, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    { id: 'ai-progress', label: 'AI 工作進度', shortLabel: 'AI進度', icon: Bot, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },

    // 對外頁面
    { id: 'site-config', label: '我的對外頁面', shortLabel: '頁面', icon: Globe, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },

    // 工具
    { id: 'prompt-library', label: '提示詞資料庫', shortLabel: '提示詞', icon: BookOpen, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    { id: 'system-log', label: '操作日誌', shortLabel: '日誌', icon: ScrollText, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    { id: 'sop-guide', label: '顧問 SOP 手冊', shortLabel: 'SOP', icon: BookOpen, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    { id: 'ai-guide', label: 'AI Bot 使用教學', shortLabel: 'AI教學', icon: Bot, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    { id: 'help', label: '使用說明', shortLabel: '說明', icon: BookOpen, roles: [Role.ADMIN, Role.REVIEWER], disabled: false },
    { id: 'migration', label: '資料維護', shortLabel: '維護', icon: Database, roles: [Role.ADMIN], disabled: false },
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
        ${collapsed ? 'w-[68px]' : 'w-64'} bg-slate-900 text-slate-300 flex flex-col shrink-0
        transform transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}
        shadow-2xl sm:shadow-none
      `}>
        {/* Logo 區域 */}
        <div className={`${collapsed ? 'p-3' : 'p-4 sm:p-6'} flex items-center justify-between border-b border-slate-800 sm:border-b-0`}>
          <div className={`flex items-center ${collapsed ? 'justify-center w-full' : 'gap-3'}`}>
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0">S1</div>
            {!collapsed && (
              <span className="text-xl font-bold text-white tracking-tight whitespace-nowrap">Step1ne 獵頭系統</span>
            )}
          </div>
          {/* 手機版關閉按鈕 */}
          {!collapsed && (
            <button
              onClick={onClose}
              className="sm:hidden text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-all"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* 導航選單 */}
        <nav className={`flex-1 ${collapsed ? 'px-2' : 'px-4'} py-4 space-y-1 overflow-y-auto`}>
          {menuItems.filter(item => item.roles.includes(profile.role)).map((item) => (
            <button
              key={item.id}
              onClick={() => !item.disabled && handleItemClick(item.id)}
              disabled={item.disabled}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-between'} gap-3 ${collapsed ? 'px-2' : 'px-3'} py-2.5 rounded-lg text-sm font-medium transition-all group relative ${
                item.disabled
                  ? 'opacity-50 cursor-not-allowed text-slate-500'
                  : activeTab === item.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                    : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className={`flex items-center ${collapsed ? '' : 'gap-3'}`}>
                <item.icon size={18} className="shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </div>
              {!collapsed && item.badge && (
                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                  {item.badge}
                </span>
              )}
              {/* 收合模式下的 tooltip */}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg
                  opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200
                  whitespace-nowrap z-[60] shadow-lg pointer-events-none">
                  {item.label}
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* 底部：收合按鈕 + 登出 */}
        <div className={`${collapsed ? 'p-2' : 'p-4'} border-t border-slate-800 space-y-1`}>
          {/* 收合/展開按鈕（桌面版才顯示） */}
          <button
            onClick={onToggleCollapse}
            className="hidden sm:flex w-full items-center justify-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-800 hover:text-white transition-all"
            title={collapsed ? '展開側邊欄' : '收合側邊欄'}
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            {!collapsed && <span className="text-xs">收合側邊欄</span>}
          </button>

          {/* 登出按鈕 */}
          <button
            onClick={onLogout}
            title={collapsed ? '登出' : undefined}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-3 ${collapsed ? 'px-2' : 'px-3'} py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all group relative`}
          >
            <LogOut size={18} className="shrink-0" />
            {!collapsed && <span>登出</span>}
            {collapsed && (
              <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg
                opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200
                whitespace-nowrap z-[60] shadow-lg pointer-events-none">
                登出
              </div>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
