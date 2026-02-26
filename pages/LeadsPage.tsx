
import React, { useState, useRef, useEffect } from 'react';
import { Lead, UserProfile, Role, LeadStatus, Decision, AuditAction } from '../types';
import Badge from '../components/Badge';
import LeadModal from '../components/LeadModal';
import { STATUS_COLORS } from '../constants';
import { createLead, updateLead, deleteLead } from '../services/leadService';
import { extractLeadFromImage } from '../services/aiService';
import { Plus, Search, Edit2, Trash2, Check, X, Loader2, Camera, Clock, UserCheck, Phone, Mail, MapPin, ChevronDown, ChevronUp, MessageSquare, Paperclip, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface LeadsPageProps {
  leads: Lead[];
  userProfile: UserProfile;
}

const LeadsPage: React.FC<LeadsPageProps> = ({ leads, userProfile }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [search, setSearch] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [expandedNeeds, setExpandedNeeds] = useState<Set<string>>(new Set());
  const [isScrolledToEnd, setIsScrolledToEnd] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);
  
  // 排序狀態
  const [sortField, setSortField] = useState<keyof Lead | 'created_at'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // 當leads更新時，同步更新selectedLead
  useEffect(() => {
    if (selectedLead?.id) {
      const updatedLead = leads.find(l => l.id === selectedLead.id);
      if (updatedLead) {
        setSelectedLead(updatedLead);
      }
    }
  }, [leads, selectedLead?.id]);

  // 切換展開/收合狀態
  const toggleNeed = (id: string) => {
    const newSet = new Set(expandedNeeds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedNeeds(newSet);
  };

  const resizeImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // 所有用戶都可以使用剪貼簿貼圖功能
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) processAiFile(file);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // 檢測表格滑動狀態
  useEffect(() => {
    const scrollContainer = tableScrollRef.current;
    if (!scrollContainer) return;

    const checkScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;
      setIsScrolledToEnd(scrollLeft + clientWidth >= scrollWidth - 10);
    };

    scrollContainer.addEventListener('scroll', checkScroll);
    checkScroll(); // 初始檢查

    return () => scrollContainer.removeEventListener('scroll', checkScroll);
  }, [leads]);

  const processAiFile = async (file: File) => {
    if (!file) return;
    setAiLoading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      let base64String = reader.result as string;
      try {
        base64String = await resizeImage(base64String);
        const extracted = await extractLeadFromImage(base64String);
        const draftLead: Partial<Lead> = {
          ...extracted,
          links: [base64String],
          created_by_name: userProfile.displayName,
          status: LeadStatus.TO_FILTER,
          decision: Decision.PENDING,
          priority: 3
        };
        setSelectedLead(draftLead as Lead);
        setIsModalOpen(true);
      } catch (err: any) {
        console.error('OCR 解析錯誤:', err);
        // 顯示更具體的錯誤訊息
        const errorMessage = err?.message || '未知錯誤';
        if (errorMessage.includes('無法識別') || errorMessage.includes('文字')) {
          alert(`❌ ${errorMessage}\n\n請確認圖片清晰可讀`);
        } else if (errorMessage.includes('worker') || errorMessage.includes('tesseract')) {
          alert(`❌ ${errorMessage}\n\n請重新整理頁面後再試`);
        } else {
          alert(`❌ OCR 解析失敗：${errorMessage}\n\n請確認圖片清晰可讀`);
        }
      } finally {
        setAiLoading(false);
        if (aiFileInputRef.current) aiFileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async (data: Partial<Lead>) => {
    try {
      const result = await createLead(data, false);
      
      if (result.isDuplicate && result.existingLead) {
        // 發現重複案件，詢問用戶是否要合併
        const existing = result.existingLead;
        const duplicateInfo = `
案件編號：${existing.case_code || '無'}
平台：${existing.platform}
案主：${existing.platform_id}
狀態：${existing.status}
建立時間：${new Date(existing.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}
        `.trim();
        
        const userChoice = window.confirm(
          `⚠️ 發現重複案件！\n\n${duplicateInfo}\n\n是否要合併到現有案件？\n\n點擊「確定」合併，點擊「取消」取消新增。`
        );
        
        if (userChoice) {
          // 用戶選擇合併
          const mergeResult = await createLead(data, true);
          if (mergeResult.success) {
            setIsModalOpen(false);
            setSelectedLead(null);
            alert('✅ 案件已成功合併到現有案件！');
            // 打開合併後的案件詳情
            const mergedLead = leads.find(l => l.id === mergeResult.leadId);
            if (mergedLead) {
              setSelectedLead(mergedLead);
              setIsModalOpen(true);
            }
          } else {
            alert('❌ 合併失敗，請稍後再試');
          }
        } else {
          // 用戶取消，不新增
          alert('已取消新增案件');
        }
      } else if (result.success) {
        // 成功新增
        setIsModalOpen(false);
        setSelectedLead(null);
        alert('✅ 案件已成功新增！');
      } else {
        alert('❌ 新增失敗，請稍後再試');
      }
    } catch (err) {
      console.error('新增案件失敗:', err);
      alert('❌ 新增失敗，請稍後再試');
    }
  };

  const handleUpdate = async (data: Partial<Lead>) => {
    if (!selectedLead?.id) return;
    try {
      await updateLead(selectedLead.id, data);
      
      // 如果只更新了 progress_updates，立即更新 selectedLead 以顯示新進度（不關閉 Modal）
      if (data.progress_updates && Object.keys(data).length === 1) {
        setSelectedLead(prev => prev ? {
          ...prev,
          progress_updates: data.progress_updates
        } : null);
        // 進度更新不需要關閉 Modal，也不需要提示（因為已經在進度更新區域顯示了）
        return;
      }
      
      // 其他更新：等待一下讓數據更新，然後從leads中重新獲取
      setTimeout(() => {
        const updatedLead = leads.find(l => l.id === selectedLead.id);
        if (updatedLead) {
          setSelectedLead(updatedLead);
        }
      }, 100);
      
      // 關閉 Modal 並顯示成功訊息
      setIsModalOpen(false);
      setSelectedLead(null);
      alert('✅ 案件已成功更新！');
    } catch (err) {
      console.error('更新案件失敗:', err);
      alert('❌ 更新失敗，請稍後再試');
    }
  };

  const handleDelete = async (id: string) => {
    const lead = leads.find(l => l.id === id);
    const leadInfo = lead ? `${lead.platform_id || '未命名案件'} (${lead.status})` : '此案件';
    
    if (window.confirm(`確定要刪除「${leadInfo}」嗎？\n\n此操作無法復原，請確認後再執行。`)) {
      try {
        await deleteLead(id);
        // 如果正在編輯此案件，關閉編輯視窗
        if (selectedLead?.id === id) {
          setIsModalOpen(false);
          setSelectedLead(null);
        }
      } catch (err) {
        console.error('刪除失敗:', err);
        alert('刪除失敗，請稍後再試');
      }
    }
  };

  const handleQuickDecision = async (lead: Lead, clickedDecision: Decision) => {
    const isCancel = lead.decision === clickedDecision;
    const newDecision = isCancel ? Decision.PENDING : clickedDecision;
    const updates: Partial<Lead> = { 
      decision: newDecision,
      decision_by: isCancel ? undefined : userProfile.displayName 
    };
        if (isCancel) {
          updates.status = LeadStatus.TO_FILTER;
        } else {
          if (clickedDecision === Decision.REJECT) updates.status = LeadStatus.CANCELLED;
          else if (clickedDecision === Decision.ACCEPT) updates.status = LeadStatus.CONTACTED;
        }
    await updateLead(lead.id, updates, AuditAction.DECISION);
  };

  // 處理排序
  const handleSort = (field: keyof Lead | 'created_at') => {
    if (sortField === field) {
      // 如果點擊同一個欄位，切換排序方向
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // 如果點擊不同欄位，設置新的排序欄位，預設降序
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // 獲取排序值
  const getSortValue = (lead: Lead, field: keyof Lead | 'created_at'): string | number => {
    if (field === 'created_at') {
      return new Date(lead.created_at).getTime();
    }
    const value = lead[field];
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.toLowerCase();
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && 'length' in value) return (value as any[]).length;
    return String(value).toLowerCase();
  };

  const filteredLeads = leads
    .filter(l => {
      const searchStr = search.toLowerCase();
      return (l.need.toLowerCase().includes(searchStr) || 
              l.platform_id.toLowerCase().includes(searchStr) ||
              (l.case_code && l.case_code.toLowerCase().includes(searchStr)));
    })
    .sort((a, b) => {
      const aValue = getSortValue(a, sortField);
      const bValue = getSortValue(b, sortField);
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
  };

  return (
    <div className="space-y-6 relative">
          {aiLoading && (
            <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center text-white">
              <Loader2 className="animate-spin mb-4" size={48} />
              <h3 className="text-xl font-black tracking-widest">OCR 正在識別文字...</h3>
              <p className="text-sm text-slate-300 mt-2">首次使用需要載入 OCR 引擎，請稍候</p>
            </div>
          )}

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
        <div className="flex-1 flex items-center gap-4 w-full max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="搜尋案主名稱、需求內容..." 
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-transparent rounded-2xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
              <button 
                onClick={() => aiFileInputRef.current?.click()}
                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
              >
                <Camera size={18} />
                OCR 截圖識別
              </button>
              <input type="file" ref={aiFileInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && processAiFile(e.target.files[0])} />
              
              <button 
                onClick={() => { setSelectedLead(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
            title="手動新增案件"
              >
            <Plus size={18} />
            新增案件
              </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div 
          ref={tableScrollRef}
          className={`table-scroll-container relative overflow-x-auto overflow-y-auto overscroll-contain scrollbar-thin ${isScrolledToEnd ? 'scrolled-to-end' : ''}`}
          style={{ 
            WebkitOverflowScrolling: 'touch',
            maxHeight: 'calc(100vh - 300px)' // 設置最大高度，超出時可上下滾動
          }}
        >
          <table className="min-w-[900px] sm:min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/50 sticky top-0 z-10">
              <tr>
                <th 
                  className="px-4 sm:px-6 py-4 sm:py-6 text-left text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('platform_id')}
                >
                  <div className="flex items-center gap-2">
                    客戶 / 來源
                    {sortField === 'platform_id' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-30" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 sm:px-6 py-4 sm:py-6 text-left text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest min-w-[200px] cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('need')}
                >
                  <div className="flex items-center gap-2">
                    需求內容 (點擊文字展開)
                    {sortField === 'need' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-30" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 sm:px-6 py-4 sm:py-6 text-left text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('phone')}
                >
                  <div className="flex items-center gap-2">
                    聯絡資訊
                    {sortField === 'phone' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-30" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 sm:px-6 py-4 sm:py-6 text-left text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest min-w-[180px] cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('internal_remarks')}
                >
                  <div className="flex items-center gap-2">
                    備註與內部評語
                    {sortField === 'internal_remarks' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-30" />
                    )}
                  </div>
                </th>
                <th className="px-4 sm:px-6 py-4 sm:py-6 text-center text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">快速審核</th>
                <th 
                  className="px-4 sm:px-6 py-4 sm:py-6 text-left text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    當前狀態
                    {sortField === 'status' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-30" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 sm:px-6 py-4 sm:py-6 text-right text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center justify-end gap-2">
                    操作
                    {sortField === 'created_at' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-30" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredLeads.map((lead) => {
                const isExpanded = expandedNeeds.has(lead.id);
                return (
                  <tr 
                    key={lead.id} 
                    onClick={() => { setSelectedLead(lead); setIsModalOpen(true); }}
                    className="hover:bg-slate-50/50 transition-all group align-top cursor-pointer"
                  >
                    <td className="px-4 sm:px-6 py-4 sm:py-6 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-indigo-600">{lead.platform}</span>
                          {lead.links && lead.links.length > 0 && (
                            <div className="flex items-center gap-1 text-emerald-600" title={`有 ${lead.links.length} 個附件`}>
                              <Paperclip size={12} className="text-emerald-500" />
                              <span className="text-[9px] font-black">{lead.links.length}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{lead.platform_id}</span>
                          {lead.case_code && (
                            <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              {lead.case_code}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-black">
                          <Clock size={10} /> {formatDate(lead.posted_at || lead.created_at)}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 sm:py-6 max-w-[200px] sm:max-w-sm">
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleNeed(lead.id);
                        }}
                        className="cursor-pointer group/need relative"
                      >
                        <p className={`text-sm text-slate-700 font-medium leading-relaxed transition-all duration-300 ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
                          {lead.need}
                        </p>
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-black text-indigo-500 opacity-0 group-hover/need:opacity-100 transition-opacity">
                          {isExpanded ? <><ChevronUp size={12}/> 點擊收合內容</> : <><ChevronDown size={12}/> 點擊展開全文</>}
                        </div>
                        <span className="text-[10px] font-black text-emerald-600 mt-2 block bg-emerald-50 px-2 py-1 rounded inline-block">💰 預算：{lead.budget_text || '不詳'}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 sm:py-6 whitespace-nowrap">
                      <div className="flex flex-col gap-2">
                        {lead.phone && (
                          <div className="flex items-center gap-2 text-xs text-slate-600 font-bold bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                            <Phone size={12} className="text-indigo-400"/> {lead.phone}
                          </div>
                        )}
                        {lead.email && (
                          <div className="flex items-center gap-2 text-xs text-slate-600 font-bold bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                            <Mail size={12} className="text-indigo-400"/> {lead.email}
                          </div>
                        )}
                        {lead.location && (
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium px-1.5">
                            <MapPin size={12} className="text-slate-400"/> {lead.location}
                          </div>
                        )}
                        {!lead.phone && !lead.email && !lead.location && <span className="text-xs text-slate-300 italic">無聯絡資訊</span>}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 sm:py-6">
                      <div className="space-y-3 max-w-[180px] sm:max-w-[220px]">
                        {lead.note && (
                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1 flex items-center gap-1">
                              <MessageSquare size={10}/> 原始備註
                            </p>
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{lead.note}</p>
                          </div>
                        )}
                        {lead.internal_remarks && (
                          <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100 shadow-sm">
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter mb-1 flex items-center gap-1">
                              <UserCheck size={10}/> 內部評語 ({lead.remarks_author || '系統'})
                            </p>
                            <p className="text-xs text-indigo-900 font-medium italic line-clamp-2">"{lead.internal_remarks}"</p>
                          </div>
                        )}
                        {!lead.note && !lead.internal_remarks && <span className="text-xs text-slate-300 italic">無任何備註</span>}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 sm:py-6 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickDecision(lead, Decision.ACCEPT);
                          }}
                          className={`p-2.5 rounded-xl border transition-all ${lead.decision === Decision.ACCEPT ? 'bg-green-500 text-white border-green-600' : 'bg-white text-green-600 border-gray-200 hover:bg-green-50'}`}
                        >
                          <Check size={16} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickDecision(lead, Decision.REJECT);
                          }}
                          className={`p-2.5 rounded-xl border transition-all ${lead.decision === Decision.REJECT ? 'bg-red-500 text-white border-red-600' : 'bg-white text-red-600 border-gray-200 hover:bg-red-50'}`}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 sm:py-6 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <Badge className={`${STATUS_COLORS[lead.status]} font-black px-3 py-1 text-[9px] uppercase tracking-wider rounded-lg border border-current`}>
                          {lead.status}
                        </Badge>
                        {lead.decision_by && (
                          <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold italic mt-1">
                            <UserCheck size={10} className="text-indigo-400" />
                            {lead.decision_by} 審核
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 sm:py-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLead(lead);
                            setIsModalOpen(true);
                          }} 
                          className="p-2 bg-slate-100 text-slate-500 hover:bg-slate-900 hover:text-white rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          title="編輯案件"
                        >
                          <Edit2 size={16}/>
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(lead.id);
                          }} 
                          className="p-2 bg-slate-100 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          title="刪除案件"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Search size={48} className="text-slate-200"/>
                      <p className="text-slate-400 font-bold text-sm tracking-widest">找不到符合條件的案件</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LeadModal 
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedLead(null); }}
        onSubmit={selectedLead && selectedLead.id ? handleUpdate : handleCreate}
        initialData={selectedLead?.id ? leads.find(l => l.id === selectedLead.id) || selectedLead : selectedLead}
        userRole={userProfile.role}
        userName={userProfile.displayName}
      />
    </div>
  );
};

export default LeadsPage;
