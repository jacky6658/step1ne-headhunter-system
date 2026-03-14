
import React, { useState, useEffect } from 'react';
import { Role, UserProfile } from '../types';
import {
  LayoutGrid, ClipboardList, Users, Database, LogOut, X, BarChart3,
  BookOpen, ScrollText, Target, Bot, Upload, Activity, ChevronsLeft,
  ChevronsRight, Globe, ChevronDown, Wrench, GraduationCap, Zap, Eye
} from 'lucide-react';

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

interface MenuItem {
  id: string;
  label: string;
  shortLabel?: string;
  icon: React.ElementType;
  roles: Role[];
}

interface MenuGroup {
  key: string;
  label: string;
  icon: React.ElementType;
  items: MenuItem[];
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, profile, onLogout, isOpen, onClose, collapsed, onToggleCollapse }) => {
  if (!profile) return null;

  const menuGroups: MenuGroup[] = [
    {
      key: 'overview',
      label: '總覽',
      icon: Eye,
      items: [
        { id: 'overview-dashboard', label: '總攬看板', shortLabel: '總攬', icon: BarChart3, roles: [Role.ADMIN, Role.REVIEWER] },
        { id: 'ops-dashboard', label: '運營儀表板', shortLabel: '運營', icon: BarChart3, roles: [Role.ADMIN, Role.REVIEWER] },
      ],
    },
    {
      key: 'talent',
      label: '人才管理',
      icon: Users,
      items: [
        { id: 'candidates', label: '候選人總表', shortLabel: '總表', icon: Users, roles: [Role.ADMIN, Role.REVIEWER] },
        { id: 'candidate-kanban', label: '人才看板', shortLabel: '看板', icon: LayoutGrid, roles: [Role.ADMIN, Role.REVIEWER] },
        { id: 'talent-map', label: '人才地圖', shortLabel: '地圖', icon: BarChart3, roles: [Role.ADMIN, Role.REVIEWER] },
        { id: 'pipeline', label: '顧問追蹤表', shortLabel: '追蹤', icon: BarChart3, roles: [Role.ADMIN, Role.REVIEWER] },
      ],
    },
    {
      key: 'business',
      label: '職缺 & BD',
      icon: ClipboardList,
      items: [
        { id: 'jobs', label: '職缺管理', shortLabel: '職缺', icon: ClipboardList, roles: [Role.ADMIN, Role.REVIEWER] },
        { id: 'bd-clients', label: 'BD 客戶開發', shortLabel: 'BD', icon: Target, roles: [Role.ADMIN, Role.REVIEWER] },
      ],
    },
    {
      key: 'automation',
      label: 'AI & 自動化',
      icon: Zap,
      items: [
        { id: 'crawler-dashboard', label: '爬蟲儀表板', shortLabel: '爬蟲', icon: Activity, roles: [Role.ADMIN, Role.REVIEWER] },
        { id: 'ai-progress', label: 'AI 工作進度', shortLabel: 'AI', icon: Bot, roles: [Role.ADMIN, Role.REVIEWER] },
        { id: 'bot-scheduler', label: 'Bot 排程設定', shortLabel: 'Bot', icon: Bot, roles: [Role.ADMIN, Role.REVIEWER] },
      ],
    },
    {
      key: 'tools',
      label: '工具',
      icon: Wrench,
      items: [
        { id: 'resume-import', label: '履歷批量匯入', shortLabel: '匯入', icon: Upload, roles: [Role.ADMIN, Role.REVIEWER] },
        { id: 'prompt-library', label: '提示詞資料庫', shortLabel: '提示詞', icon: BookOpen, roles: [Role.ADMIN, Role.REVIEWER] },
        { id: 'site-config', label: '對外頁面', shortLabel: '頁面', icon: Globe, roles: [Role.ADMIN, Role.REVIEWER] },
        { id: 'system-log', label: '操作日誌', shortLabel: '日誌', icon: ScrollText, roles: [Role.ADMIN, Role.REVIEWER] },
      ],
    },
    {
      key: 'learn',
      label: '學習中心',
      icon: GraduationCap,
      items: [
        { id: 'sop-guide', label: '顧問 SOP 手冊', shortLabel: 'SOP', icon: BookOpen, roles: [Role.ADMIN, Role.REVIEWER] },
        { id: 'ai-guide', label: 'AI Bot 教學', shortLabel: 'AI教學', icon: Bot, roles: [Role.ADMIN, Role.REVIEWER] },
        { id: 'help', label: '使用說明', shortLabel: '說明', icon: BookOpen, roles: [Role.ADMIN, Role.REVIEWER] },
      ],
    },
    {
      key: 'admin',
      label: '管理',
      icon: Database,
      items: [
        { id: 'migration', label: '資料維護', shortLabel: '維護', icon: Database, roles: [Role.ADMIN] },
      ],
    },
  ];

  // Filter groups by role
  const visibleGroups = menuGroups
    .map(g => ({ ...g, items: g.items.filter(i => i.roles.includes(profile.role)) }))
    .filter(g => g.items.length > 0);

  // Track which groups are expanded — auto-expand the group containing activeTab
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('step1ne_sidebar_groups');
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    // Default: expand the group containing the active tab
    const activeGroup = visibleGroups.find(g => g.items.some(i => i.id === activeTab));
    return new Set(activeGroup ? [activeGroup.key] : ['overview']);
  });

  // Auto-expand group when activeTab changes
  useEffect(() => {
    const group = visibleGroups.find(g => g.items.some(i => i.id === activeTab));
    if (group && !expandedGroups.has(group.key)) {
      setExpandedGroups(prev => {
        const next = new Set(prev);
        next.add(group.key);
        return next;
      });
    }
  }, [activeTab]);

  // Persist expanded state
  useEffect(() => {
    try {
      localStorage.setItem('step1ne_sidebar_groups', JSON.stringify([...expandedGroups]));
    } catch {}
  }, [expandedGroups]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleItemClick = (id: string) => {
    setActiveTab(id);
    if (window.innerWidth < 640) onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 sm:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed sm:static inset-y-0 left-0 z-50
        ${collapsed ? 'w-[68px]' : 'w-60'} bg-slate-900 text-slate-300 flex flex-col shrink-0
        transform transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}
        shadow-2xl sm:shadow-none
      `}>
        {/* Logo */}
        <div className={`${collapsed ? 'p-3' : 'p-4 sm:p-5'} flex items-center justify-between border-b border-slate-800`}>
          <div className={`flex items-center ${collapsed ? 'justify-center w-full' : 'gap-3'}`}>
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0">S1</div>
            {!collapsed && (
              <span className="text-lg font-bold text-white tracking-tight whitespace-nowrap">Step1ne</span>
            )}
          </div>
          {!collapsed && (
            <button onClick={onClose} className="sm:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 ${collapsed ? 'px-1.5' : 'px-3'} py-3 overflow-y-auto`}>
          {visibleGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.key);
            const hasActiveItem = group.items.some(i => i.id === activeTab);
            const GroupIcon = group.icon;

            return (
              <div key={group.key} className="mb-1">
                {/* Group header */}
                {collapsed ? (
                  // Collapsed: show group icon, clicking shows first item or tooltip
                  <div className="relative group py-1">
                    <button
                      onClick={() => {
                        // If only 1 item, navigate directly
                        if (group.items.length === 1) {
                          handleItemClick(group.items[0].id);
                        } else {
                          // Show the group items — navigate to first item
                          handleItemClick(group.items[0].id);
                        }
                      }}
                      className={`w-full flex items-center justify-center p-2 rounded-lg transition-all ${
                        hasActiveItem
                          ? 'bg-indigo-600/20 text-indigo-400'
                          : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                      }`}
                      title={group.label}
                    >
                      <GroupIcon size={18} />
                    </button>
                    {/* Tooltip with items */}
                    <div className="absolute left-full ml-2 top-0 py-1.5 bg-slate-800 rounded-lg
                      opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200
                      whitespace-nowrap z-[60] shadow-xl min-w-[160px]">
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {group.label}
                      </div>
                      {group.items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => handleItemClick(item.id)}
                          className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                            activeTab === item.id
                              ? 'text-indigo-400 bg-indigo-600/10'
                              : 'text-slate-300 hover:text-white hover:bg-slate-700'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  // Expanded sidebar: clickable group header
                  <>
                    <button
                      onClick={() => toggleGroup(group.key)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                        hasActiveItem
                          ? 'text-indigo-400'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <GroupIcon size={14} />
                        <span>{group.label}</span>
                      </div>
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {/* Group items */}
                    <div
                      className={`overflow-hidden transition-all duration-200 ${
                        isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      {group.items.map(item => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleItemClick(item.id)}
                            className={`w-full flex items-center gap-2.5 pl-7 pr-3 py-2 rounded-lg text-sm transition-all ${
                              activeTab === item.id
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 font-medium'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <Icon size={15} className="shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={`${collapsed ? 'p-2' : 'p-3'} border-t border-slate-800 space-y-1`}>
          <button
            onClick={onToggleCollapse}
            className="hidden sm:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-800 hover:text-white transition-all"
            title={collapsed ? '展開側邊欄' : '收合側邊欄'}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            {!collapsed && <span>收合</span>}
          </button>

          <button
            onClick={onLogout}
            title={collapsed ? '登出' : undefined}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-2.5 ${collapsed ? 'px-2' : 'px-3'} py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-all group relative`}
          >
            <LogOut size={16} className="shrink-0" />
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
