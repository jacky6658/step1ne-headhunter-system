
import React, { useState, useRef, useEffect } from 'react';
import { Lead, LeadStatus, Role, AuditAction } from '../types';
import { STATUS_OPTIONS, STATUS_COLORS } from '../constants';
import Badge from './Badge';
import { updateLead } from '../services/leadService';
import { X } from 'lucide-react';

interface KanbanBoardProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  userRole: Role;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ leads, onSelectLead, userRole }) => {
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [contextMenu, setContextMenu] = useState<{ lead: Lead; x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (lead: Lead) => {
    setDraggedLead(lead);
  };

  const handleDrop = async (e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    if (draggedLead && draggedLead.status !== status) {
      await updateLead(draggedLead.id, { status }, AuditAction.MOVE_STATUS);
    }
    setDraggedLead(null);
  };

  // 處理右鍵選單
  const handleContextMenu = (e: React.MouseEvent, lead: Lead) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 計算選單位置，確保不會超出視窗範圍
    const menuWidth = 200; // 選單寬度
    const menuItemHeight = 42; // 每個選單項目的高度（包含 padding）
    const headerHeight = 40; // 標題區域高度
    const padding = 16; // 上下 padding
    const availableStatuses = STATUS_OPTIONS.filter(status => status !== LeadStatus.TO_IMPORT && status !== lead.status);
    const estimatedMenuHeight = headerHeight + (availableStatuses.length * menuItemHeight) + padding;
    
    let x = e.clientX;
    let y = e.clientY;
    
    // 檢查右邊界
    if (x + menuWidth / 2 > window.innerWidth) {
      x = window.innerWidth - menuWidth / 2 - 10;
    }
    // 檢查左邊界
    if (x - menuWidth / 2 < 0) {
      x = menuWidth / 2 + 10;
    }
    
    // 檢查底邊界 - 如果選單會超出底部，則向上顯示
    const spaceBelow = window.innerHeight - y;
    const spaceAbove = y;
    
    if (spaceBelow < estimatedMenuHeight) {
      // 底部空間不足，向上顯示
      if (spaceAbove >= estimatedMenuHeight) {
        // 上方有足夠空間，從點擊位置向上顯示
        y = e.clientY - estimatedMenuHeight;
      } else {
        // 上方空間也不足，貼近底部顯示，並啟用滾動
        y = window.innerHeight - estimatedMenuHeight - 10;
        if (y < 10) y = 10; // 確保不會超出頂部
      }
    } else {
      // 底部空間足夠，從點擊位置向下顯示
      y = e.clientY;
    }
    
    setContextMenu({
      lead,
      x,
      y
    });
  };

  // 處理狀態變更
  const handleStatusChange = async (lead: Lead, newStatus: LeadStatus) => {
    if (lead.status !== newStatus) {
      await updateLead(lead.id, { status: newStatus }, AuditAction.MOVE_STATUS);
    }
    setContextMenu(null);
  };

  // 點擊外部關閉選單
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-full scrollbar-thin">
      {STATUS_OPTIONS.filter(status => status !== LeadStatus.TO_IMPORT).map((status) => {
        const columnLeads = leads.filter(l => l.status === status);
        return (
          <div 
            key={status}
            className="flex-shrink-0 w-80 flex flex-col"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div className={`p-3 rounded-t-lg border-b-2 bg-white shadow-sm border-indigo-100`}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[status].split(' ')[0].replace('bg-', 'bg-opacity-100 bg-')}`}></span>
                  {status}
                </h3>
                <Badge className="bg-gray-100 text-gray-500">{columnLeads.length}</Badge>
              </div>
              {/* 狀態說明文字 */}
              {status === LeadStatus.CANCELLED && (
                <p className="text-[10px] text-slate-400 font-medium mt-1">未使用 Pro360 索取個資</p>
              )}
              {status === LeadStatus.DECLINED && (
                <p className="text-[10px] text-slate-400 font-medium mt-1">已使用 Pro360 索取個資</p>
              )}
            </div>
            
            <div className="flex-1 bg-gray-50 rounded-b-lg p-2 space-y-3 overflow-y-auto kanban-column scrollbar-hide">
              {columnLeads.map((lead) => (
                <div 
                  key={lead.id}
                  draggable
                  onDragStart={() => handleDragStart(lead)}
                  onClick={() => onSelectLead(lead)}
                  onContextMenu={(e) => handleContextMenu(e, lead)}
                  className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 cursor-move hover:shadow-md transition-shadow group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <Badge className="bg-indigo-50 text-indigo-600">{lead.platform}</Badge>
                    <span className="text-[10px] text-gray-400">{new Date(lead.posted_at || lead.created_at).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 line-clamp-2 mb-2">{lead.need}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500">{lead.budget_text}</span>
                    <div className="flex gap-1">
                      {lead.decision !== 'pending' && (
                        <div className={`w-2 h-2 rounded-full ${lead.decision === 'accept' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      )}
                      <div className={`text-[10px] font-bold ${lead.priority > 3 ? 'text-red-500' : 'text-gray-400'}`}>P{lead.priority}</div>
                    </div>
                  </div>
                </div>
              ))}
              {columnLeads.length === 0 && (
                <div className="h-20 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-xs text-gray-400">尚無案件</span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* 右鍵選單 */}
      {contextMenu && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            ref={contextMenuRef}
            className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 min-w-[200px] max-h-[80vh] overflow-y-auto"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
              transform: 'translate(-50%, 0)',
              maxWidth: 'calc(100vw - 20px)'
            }}
          >
            <div className="px-4 py-2 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">移動到</p>
                <button
                  onClick={() => setContextMenu(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="py-2">
              {STATUS_OPTIONS.filter(status => status !== LeadStatus.TO_IMPORT && status !== contextMenu.lead.status).map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(contextMenu.lead, status)}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[status].split(' ')[0].replace('bg-', 'bg-opacity-100 bg-')}`}></span>
                  {status}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default KanbanBoard;
