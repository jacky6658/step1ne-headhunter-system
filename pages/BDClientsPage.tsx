// Step1ne 獵頭系統 - BD 客戶開發頁面
import React, { useState, useEffect } from 'react';
import { Client, BDContact, BDStatus, BD_STATUS_CONFIG, UserProfile, SubmissionRule } from '../types';
import { apiGet, apiPost, apiPatch, apiDelete, apiPut } from '../config/api';
import { Target, Plus, X, Phone, Mail, Globe, Building2, Users, Briefcase, ChevronRight, RefreshCw, FileText, Clock, Edit3, Trash2, Pencil, Check, ClipboardCheck } from 'lucide-react';
import { SubmissionRulesEditor } from '../components/SubmissionRulesEditor';

interface BDClientsPageProps {
  userProfile: UserProfile;
  onNavigateToJobs?: () => void;
}

const BD_STAGES: BDStatus[] = ['開發中', '接洽中', '提案中', '合約階段', '合作中', '暫停', '流失'];

const CONTACT_TYPES = ['電話', 'Email', '拜訪', '視訊', 'LINE', '其他'];

const emptyForm = {
  company_name: '', industry: '', company_size: '', website: '',
  bd_status: '開發中' as BDStatus, bd_source: '',
  contact_name: '', contact_title: '', contact_email: '', contact_phone: '', contact_linkedin: '',
  consultant: '', contract_type: '', fee_percentage: '', notes: '',
  url_104: '', url_1111: '',
};

export function BDClientsPage({ userProfile, onNavigateToJobs }: BDClientsPageProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'contacts' | 'jobs' | 'rules'>('info');
  const [contacts, setContacts] = useState<BDContact[]>([]);
  const [clientJobs, setClientJobs] = useState<any[]>([]);
  const [submissionRules, setSubmissionRules] = useState<SubmissionRule[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [addLoading, setAddLoading] = useState(false);
  const [contactForm, setContactForm] = useState({
    contact_date: new Date().toISOString().slice(0, 10),
    contact_type: '電話', summary: '', next_action: '', next_action_date: '', by_user: userProfile.displayName,
  });
  const [contactLoading, setContactLoading] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<BDStatus | null>(null);
  const [renamingTitle, setRenamingTitle] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => { loadClients(); }, []);

  useEffect(() => {
    if (selectedClient) {
      loadContacts(selectedClient.id);
      loadClientJobs(selectedClient.id);
      loadSubmissionRules(selectedClient.id);
    }
  }, [selectedClient]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ success: boolean; data: Client[] }>('/clients');
      if (data.success) setClients(data.data);
    } catch (e) { console.error('載入客戶失敗:', e); }
    finally { setLoading(false); }
  };

  const loadContacts = async (clientId: string) => {
    try {
      const data = await apiGet<{ success: boolean; data: BDContact[] }>(`/clients/${clientId}/contacts`);
      if (data.success) setContacts(data.data);
    } catch (e) { setContacts([]); }
  };

  const loadClientJobs = async (clientId: string) => {
    try {
      const data = await apiGet<{ success: boolean; data: any[] }>(`/clients/${clientId}/jobs`);
      if (data.success) setClientJobs(data.data);
    } catch (e) { setClientJobs([]); }
  };

  const loadSubmissionRules = async (clientId: string) => {
    try {
      const data = await apiGet<{ success: boolean; data: SubmissionRule[] }>(`/clients/${clientId}/submission-rules`);
      if (data.success) setSubmissionRules(data.data);
    } catch (e) { setSubmissionRules([]); }
  };

  const handleStatusChange = async (client: Client, newStatus: BDStatus) => {
    try {
      const result = await apiPatch<any>(`/clients/${client.id}/status`, {
        bd_status: newStatus, actor: userProfile.displayName,
      });
      if (result.success) {
        setClients(prev => prev.map(c => c.id === client.id ? { ...c, bd_status: newStatus } : c));
        if (selectedClient?.id === client.id) setSelectedClient({ ...selectedClient, bd_status: newStatus });
        if (result.prompt_add_job) {
          const ok = window.confirm(`🎉 ${client.company_name} 已進入合作中！\n\n是否前往職缺管理新增職缺？`);
          if (ok && onNavigateToJobs) onNavigateToJobs();
        }
      }
    } catch (e) { alert('❌ 更新狀態失敗'); }
  };

  const handleAddClient = async () => {
    if (!addForm.company_name.trim()) { alert('請填寫公司名稱'); return; }
    setAddLoading(true);
    try {
      const result = await apiPost<any>('/clients', {
        ...addForm,
        fee_percentage: addForm.fee_percentage ? parseFloat(addForm.fee_percentage) : undefined,
      });
      if (result.success) {
        setShowAddModal(false);
        setAddForm(emptyForm);
        await loadClients();
      }
    } catch (e) { alert('❌ 新增失敗：' + (e as Error).message); }
    finally { setAddLoading(false); }
  };

  const handleStartEdit = () => {
    if (!selectedClient) return;
    setEditForm({
      company_name: selectedClient.company_name || '',
      industry: selectedClient.industry || '',
      company_size: selectedClient.company_size || '',
      website: selectedClient.website || '',
      bd_source: selectedClient.bd_source || '',
      contact_name: selectedClient.contact_name || '',
      contact_title: selectedClient.contact_title || '',
      contact_email: selectedClient.contact_email || '',
      contact_phone: selectedClient.contact_phone || '',
      contact_linkedin: selectedClient.contact_linkedin || '',
      consultant: selectedClient.consultant || '',
      contract_type: selectedClient.contract_type || '',
      fee_percentage: selectedClient.fee_percentage ?? undefined,
      notes: selectedClient.notes || '',
      url_104: selectedClient.url_104 || '',
      url_1111: selectedClient.url_1111 || '',
    });
    setEditingInfo(true);
  };

  const handleSaveInfo = async () => {
    if (!selectedClient) return;
    setSaveLoading(true);
    try {
      const result = await apiPatch<any>(`/clients/${selectedClient.id}`, editForm);
      if (result.success) {
        const updated = { ...selectedClient, ...result.data };
        setSelectedClient(updated);
        setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
        setEditingInfo(false);
      }
    } catch (e) { alert('❌ 儲存失敗'); }
    finally { setSaveLoading(false); }
  };

  const handleAddContact = async () => {
    if (!selectedClient) return;
    setContactLoading(true);
    try {
      const result = await apiPost<any>(`/clients/${selectedClient.id}/contacts`, contactForm);
      if (result.success) {
        setShowContactModal(false);
        setContactForm({ contact_date: new Date().toISOString().slice(0, 10), contact_type: '電話', summary: '', next_action: '', next_action_date: '', by_user: userProfile.displayName });
        await loadContacts(selectedClient.id);
      }
    } catch (e) { alert('❌ 新增失敗'); }
    finally { setContactLoading(false); }
  };

  const handleDeleteClient = async (client: Client) => {
    const confirmed = window.confirm(`⚠️ 確定要刪除客戶「${client.company_name}」嗎？\n\n此操作將同時刪除該客戶的所有聯絡記錄，且無法復原。`);
    if (!confirmed) return;
    setDeleteLoading(true);
    try {
      const result = await apiDelete<any>(`/clients/${client.id}`);
      if (result.success) {
        setClients(prev => prev.filter(c => c.id !== client.id));
        setSelectedClient(null);
      }
    } catch (e) { alert('❌ 刪除失敗：' + (e as Error).message); }
    finally { setDeleteLoading(false); }
  };

  const handleStartRename = () => {
    if (!selectedClient) return;
    setRenameValue(selectedClient.company_name);
    setRenamingTitle(true);
  };

  const handleSaveRename = async () => {
    if (!selectedClient || !renameValue.trim()) { alert('公司名稱不能為空'); return; }
    setSaveLoading(true);
    try {
      const result = await apiPatch<any>(`/clients/${selectedClient.id}`, { company_name: renameValue.trim() });
      if (result.success) {
        const updated = { ...selectedClient, company_name: renameValue.trim() };
        setSelectedClient(updated);
        setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
        setRenamingTitle(false);
      }
    } catch (e) { alert('❌ 重命名失敗'); }
    finally { setSaveLoading(false); }
  };

  const getClientsByStatus = (status: BDStatus) => clients.filter(c => c.bd_status === status);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入客戶資料中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-7 h-7 text-indigo-600" />
            BD 客戶開發
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            共 {clients.length} 家客戶 · 合作中 {clients.filter(c => c.bd_status === '合作中').length} 家
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={loadClients} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
            <RefreshCw className="w-4 h-4" />
            重新整理
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
            <Plus className="w-4 h-4" />
            新增客戶
          </button>
        </div>
      </div>

      {/* 統計列 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {(['合作中', '合約階段', '提案中', '接洽中'] as BDStatus[]).map(s => {
          const cfg = BD_STATUS_CONFIG[s];
          return (
            <div key={s} className={`rounded-xl border p-3 ${cfg.bg}`}>
              <p className={`text-xs font-medium ${cfg.color}`}>{cfg.icon} {cfg.label}</p>
              <p className={`text-2xl font-black mt-1 ${cfg.color}`}>{getClientsByStatus(s).length}</p>
            </div>
          );
        })}
      </div>

      {/* 看板 - 手機版只顯示非空欄位 */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {BD_STAGES.map(stage => {
            const stageClients = getClientsByStatus(stage);
            const cfg = BD_STATUS_CONFIG[stage];
            return (
              <div
                key={stage}
                className={`w-64 sm:w-72 bg-white border rounded-2xl shadow-sm flex flex-col max-h-[70vh] transition-all ${
                  dragOverStage === stage && draggedClientId ? 'border-indigo-400 ring-2 ring-indigo-300 ring-offset-1' : 'border-slate-200'
                }`}
                onDragOver={e => { e.preventDefault(); setDragOverStage(stage); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null); }}
                onDrop={async e => {
                  e.preventDefault();
                  if (draggedClientId) {
                    const client = clients.find(c => c.id === draggedClientId);
                    if (client && client.bd_status !== stage) {
                      await handleStatusChange(client, stage);
                    }
                  }
                  setDraggedClientId(null);
                  setDragOverStage(null);
                }}
              >
                <div className={`px-4 py-3 border-b border-slate-100 rounded-t-2xl ${cfg.bg}`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`font-black text-sm ${cfg.color}`}>{cfg.icon} {cfg.label}</h3>
                    <span className="text-xs px-2 py-1 rounded-lg bg-white/70 text-slate-700 font-semibold">{stageClients.length}</span>
                  </div>
                </div>
                <div className="p-3 space-y-3 overflow-y-auto flex-1">
                  {stageClients.length === 0 ? (
                    <div className={`text-center text-sm py-6 transition-colors ${dragOverStage === stage && draggedClientId ? 'text-indigo-400' : 'text-slate-400'}`}>
                      {dragOverStage === stage && draggedClientId ? '放開以移入' : '暫無客戶'}
                    </div>
                  ) : (
                    stageClients.map(client => (
                      <div
                        key={client.id}
                        draggable
                        onDragStart={() => setDraggedClientId(client.id)}
                        onDragEnd={() => { setDraggedClientId(null); setDragOverStage(null); }}
                        onClick={() => { setSelectedClient(client); setActiveTab('info'); setEditingInfo(false); }}
                        className={`w-full text-left rounded-xl border bg-slate-50 hover:bg-white hover:shadow-sm transition p-3 cursor-pointer select-none ${
                          draggedClientId === client.id ? 'opacity-50 scale-95' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <p className="font-bold text-slate-900 text-sm">{client.company_name}</p>
                          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                        </div>
                        {client.industry && <p className="text-xs text-slate-500 mt-0.5">{client.industry}</p>}
                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                          {client.contact_name && <p>👤 {client.contact_name}{client.contact_title ? ` · ${client.contact_title}` : ''}</p>}
                          {client.consultant && <p>🧑‍💼 {client.consultant}</p>}
                          {(client.job_count ?? 0) > 0 && <p>💼 {client.job_count} 個職缺</p>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 客戶詳情 Modal */}
      {selectedClient && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setSelectedClient(null)}>
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-2xl h-[92vh] sm:h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 sm:p-6 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {renamingTitle ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveRename(); if (e.key === 'Escape') setRenamingTitle(false); }}
                        className="text-lg font-bold bg-white/20 border border-white/40 rounded-lg px-3 py-1 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 w-full"
                        placeholder="公司名稱"
                      />
                      <button onClick={handleSaveRename} disabled={saveLoading} className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition flex-shrink-0" title="儲存">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setRenamingTitle(false)} className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition flex-shrink-0" title="取消">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <h2 className="text-lg sm:text-xl font-bold truncate">{selectedClient.company_name}</h2>
                      <button onClick={handleStartRename} className="p-1 rounded-lg bg-white/0 hover:bg-white/20 transition opacity-0 group-hover:opacity-100" title="重新命名">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {selectedClient.industry && <p className="text-indigo-200 text-sm mt-0.5">{selectedClient.industry}</p>}
                  <div className="mt-3 flex items-center gap-2">
                    <select
                      value={selectedClient.bd_status}
                      onChange={e => handleStatusChange(selectedClient, e.target.value as BDStatus)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-white/20 text-white border border-white/30 cursor-pointer"
                    >
                      {BD_STAGES.map(s => <option key={s} value={s} className="text-gray-900">{BD_STATUS_CONFIG[s].icon} {s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => handleDeleteClient(selectedClient)}
                    disabled={deleteLoading}
                    className="p-1.5 text-white/60 hover:text-red-300 hover:bg-white/10 rounded-lg transition"
                    title="刪除客戶"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button onClick={() => { setSelectedClient(null); setRenamingTitle(false); }} className="text-white/80 hover:text-white p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex overflow-x-auto whitespace-nowrap">
                {([
                  { key: 'info', label: '基本資料', icon: <FileText className="w-4 h-4" /> },
                  { key: 'contacts', label: `聯絡記錄 (${contacts.length})`, icon: <Clock className="w-4 h-4" /> },
                  { key: 'jobs', label: `關聯職缺 (${clientJobs.length})`, icon: <Briefcase className="w-4 h-4" /> },
                  { key: 'rules', label: `送件規範 (${submissionRules.filter(r => r.enabled).length})`, icon: <ClipboardCheck className="w-4 h-4" /> },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-5 py-3 text-sm font-medium transition-all flex items-center gap-2 flex-shrink-0 ${
                      activeTab === tab.key ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {activeTab === 'info' && (
                <div className="space-y-5">
                  {/* 編輯按鈕列 */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">基本資料</h3>
                    {!editingInfo ? (
                      <button onClick={handleStartEdit} className="flex items-center gap-1 text-xs px-3 py-1.5 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition">
                        <Edit3 className="w-3 h-3" /> 編輯
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => setEditingInfo(false)} className="text-xs px-3 py-1.5 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">取消</button>
                        <button onClick={handleSaveInfo} disabled={saveLoading} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                          {saveLoading ? '儲存中...' : '儲存'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 公司資訊 */}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">公司資訊</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {editingInfo ? (
                        <>
                          {([
                            { key: 'industry', label: '產業別', placeholder: '遊戲 / 科技 / 醫療...' },
                            { key: 'company_size', label: '公司規模', placeholder: '50-200 人' },
                            { key: 'website', label: '官方網站', placeholder: 'https://...' },
                            { key: 'bd_source', label: 'BD 來源', placeholder: 'LinkedIn / 推薦...' },
                            { key: 'url_104', label: '104 人力銀行', placeholder: 'https://www.104.com.tw/company/...' },
                            { key: 'url_1111', label: '1111 人力銀行', placeholder: 'https://www.1111.com.tw/corp/...' },
                          ] as { key: keyof Client; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
                            <div key={key}>
                              <label className="text-xs font-medium text-slate-500">{label}</label>
                              <input
                                value={(editForm[key] as string) ?? ''}
                                onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder={placeholder}
                              />
                            </div>
                          ))}
                        </>
                      ) : (
                        <>
                          {[
                            { icon: <Building2 className="w-4 h-4 text-slate-400" />, label: '產業別', value: selectedClient.industry },
                            { icon: <Users className="w-4 h-4 text-slate-400" />, label: '公司規模', value: selectedClient.company_size },
                            { icon: <Globe className="w-4 h-4 text-slate-400" />, label: '官方網站', value: selectedClient.website, link: true },
                            { icon: <Target className="w-4 h-4 text-slate-400" />, label: 'BD 來源', value: selectedClient.bd_source },
                            { icon: <span className="text-xs font-black text-blue-600 w-4 text-center">104</span>, label: '104 人力銀行', value: selectedClient.url_104, link: true },
                            { icon: <span className="text-xs font-black text-orange-500 w-4 text-center">1111</span>, label: '1111 人力銀行', value: selectedClient.url_1111, link: true },
                          ].map(({ icon, label, value, link }) => (
                            <div key={label} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                              {icon}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-slate-500">{label}</p>
                                {value ? (
                                  link ? (
                                    <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline truncate block">{value}</a>
                                  ) : (
                                    <p className="text-sm font-medium text-slate-900">{value}</p>
                                  )
                                ) : (
                                  <p className="text-sm text-slate-400 italic">未填寫</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  {/* 聯絡人資訊 */}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">聯絡人資訊</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {editingInfo ? (
                        <>
                          {([
                            { key: 'contact_name', label: '姓名', placeholder: '王總監' },
                            { key: 'contact_title', label: '職稱', placeholder: 'HR Director' },
                            { key: 'contact_email', label: 'Email', placeholder: 'hr@company.com' },
                            { key: 'contact_phone', label: '電話', placeholder: '02-1234-5678' },
                            { key: 'contact_linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/...' },
                          ] as { key: keyof Client; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
                            <div key={key}>
                              <label className="text-xs font-medium text-slate-500">{label}</label>
                              <input
                                value={(editForm[key] as string) ?? ''}
                                onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder={placeholder}
                              />
                            </div>
                          ))}
                        </>
                      ) : (
                        <>
                          {[
                            { icon: <Users className="w-4 h-4 text-slate-400" />, label: '聯絡人', value: selectedClient.contact_name ? `${selectedClient.contact_name}${selectedClient.contact_title ? ` · ${selectedClient.contact_title}` : ''}` : null },
                            { icon: <Phone className="w-4 h-4 text-slate-400" />, label: '電話', value: selectedClient.contact_phone },
                            { icon: <Mail className="w-4 h-4 text-slate-400" />, label: 'Email', value: selectedClient.contact_email },
                            { icon: <Globe className="w-4 h-4 text-slate-400" />, label: 'LinkedIn', value: selectedClient.contact_linkedin, link: true },
                          ].map(({ icon, label, value, link }) => (
                            <div key={label} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                              {icon}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-slate-500">{label}</p>
                                {value ? (
                                  link ? (
                                    <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline truncate block">{value}</a>
                                  ) : (
                                    <p className="text-sm font-medium text-slate-900">{value}</p>
                                  )
                                ) : (
                                  <p className="text-sm text-slate-400 italic">未填寫</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  {/* 合約資訊 */}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">合約資訊</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {editingInfo ? (
                        <>
                          <div>
                            <label className="text-xs font-medium text-slate-500">負責顧問</label>
                            <input
                              value={editForm.consultant ?? ''}
                              onChange={e => setEditForm(p => ({ ...p, consultant: e.target.value }))}
                              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="顧問姓名"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-500">合約類型</label>
                            <input
                              value={editForm.contract_type ?? ''}
                              onChange={e => setEditForm(p => ({ ...p, contract_type: e.target.value }))}
                              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="Retainer / Contingency"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-500">成功報酬 %</label>
                            <input
                              type="number"
                              value={editForm.fee_percentage ?? ''}
                              onChange={e => setEditForm(p => ({ ...p, fee_percentage: e.target.value ? parseFloat(e.target.value) : undefined }))}
                              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="20"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          {[
                            { icon: <Target className="w-4 h-4 text-slate-400" />, label: '負責顧問', value: selectedClient.consultant },
                            { icon: <FileText className="w-4 h-4 text-slate-400" />, label: '合約類型', value: selectedClient.contract_type },
                            { icon: <FileText className="w-4 h-4 text-slate-400" />, label: '成功報酬', value: selectedClient.fee_percentage ? `${selectedClient.fee_percentage}%` : null },
                          ].map(({ icon, label, value }) => (
                            <div key={label} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                              {icon}
                              <div>
                                <p className="text-xs text-slate-500">{label}</p>
                                <p className={`text-sm ${value ? 'font-medium text-slate-900' : 'text-slate-400 italic'}`}>{value ?? '未填寫'}</p>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  {/* 備註 */}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">備註</p>
                    {editingInfo ? (
                      <textarea
                        value={editForm.notes ?? ''}
                        onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        rows={3}
                        placeholder="備註內容..."
                      />
                    ) : (
                      <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 min-h-[60px]">
                        {selectedClient.notes ? (
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedClient.notes}</p>
                        ) : (
                          <p className="text-sm text-slate-400 italic">未填寫</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'contacts' && (
                <div>
                  <button
                    onClick={() => setShowContactModal(true)}
                    className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-indigo-300 text-indigo-600 rounded-xl hover:bg-indigo-50 transition text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    新增聯絡記錄
                  </button>
                  {contacts.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm">尚無聯絡記錄</div>
                  ) : (
                    <div className="space-y-3">
                      {contacts.map(c => (
                        <div key={c.id} className="border border-slate-200 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full">{c.contact_type}</span>
                              <span className="text-xs text-slate-500">{c.contact_date}</span>
                            </div>
                            {c.by_user && <span className="text-xs text-slate-400">{c.by_user}</span>}
                          </div>
                          {c.summary && <p className="text-sm text-slate-700 mb-2">{c.summary}</p>}
                          {c.next_action && (
                            <div className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg">
                              <ChevronRight className="w-3 h-3" />
                              下一步：{c.next_action}
                              {c.next_action_date && <span className="text-indigo-500 ml-1">({c.next_action_date})</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'jobs' && (
                <div>
                  {clientJobs.length === 0 ? (
                    <div className="text-center py-10">
                      <Briefcase className="mx-auto w-10 h-10 text-slate-300 mb-2" />
                      <p className="text-slate-400 text-sm">尚無關聯職缺</p>
                      {selectedClient.bd_status === '合作中' && onNavigateToJobs && (
                        <button onClick={onNavigateToJobs} className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                          前往職缺管理新增
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {clientJobs.map(job => (
                        <div key={job.id} className="border border-slate-200 rounded-xl p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-slate-900 text-sm">{job.position_name || '未命名職缺'}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{job.department || ''}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                              job.job_status?.includes('開放') || job.job_status?.includes('招募') ? 'bg-green-100 text-green-700 border-green-300' : 'bg-slate-100 text-slate-600 border-slate-300'
                            }`}>{job.job_status}</span>
                          </div>
                          {job.salary_range && <p className="text-xs text-slate-500 mt-2">💰 {job.salary_range}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'rules' && (
                <SubmissionRulesEditor
                  clientId={selectedClient.id}
                  rules={submissionRules}
                  onSave={async (rules) => {
                    await apiPut<any>(`/clients/${selectedClient.id}/submission-rules`, { rules });
                    setSubmissionRules(rules);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* 新增客戶 Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-900">新增客戶</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'company_name', label: '公司名稱 *', placeholder: '遊戲橘子集團' },
                  { key: 'industry', label: '產業別', placeholder: '遊戲/科技/醫療...' },
                  { key: 'company_size', label: '公司規模', placeholder: '50-200 人' },
                  { key: 'website', label: '網站', placeholder: 'https://...' },
                  { key: 'contact_name', label: '聯絡人', placeholder: '王總監' },
                  { key: 'contact_title', label: '職稱', placeholder: 'HR Director' },
                  { key: 'contact_email', label: '聯絡 Email', placeholder: 'hr@company.com' },
                  { key: 'contact_phone', label: '聯絡電話', placeholder: '02-1234-5678' },
                  { key: 'consultant', label: '負責顧問', placeholder: 'Jacky' },
                  { key: 'url_104', label: '104 人力銀行', placeholder: 'https://www.104.com.tw/company/...' },
                  { key: 'url_1111', label: '1111 人力銀行', placeholder: 'https://www.1111.com.tw/corp/...' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-slate-600">{label}</label>
                    <input
                      value={(addForm as any)[key]}
                      onChange={e => setAddForm(p => ({ ...p, [key]: e.target.value }))}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder={placeholder}
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-medium text-slate-600">BD 狀態</label>
                  <select value={addForm.bd_status} onChange={e => setAddForm(p => ({ ...p, bd_status: e.target.value as BDStatus }))}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {BD_STAGES.map(s => <option key={s} value={s}>{BD_STATUS_CONFIG[s].icon} {s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">備註</label>
                <textarea value={addForm.notes} onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" rows={3} />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 sm:p-6 border-t flex-shrink-0">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">取消</button>
              <button onClick={handleAddClient} disabled={addLoading} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {addLoading ? '新增中...' : '新增客戶'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新增聯絡記錄 Modal */}
      {showContactModal && selectedClient && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-slate-900">新增聯絡記錄</h3>
              <button onClick={() => setShowContactModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">日期</label>
                  <input type="date" value={contactForm.contact_date} onChange={e => setContactForm(p => ({ ...p, contact_date: e.target.value }))}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">聯絡方式</label>
                  <select value={contactForm.contact_type} onChange={e => setContactForm(p => ({ ...p, contact_type: e.target.value }))}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {CONTACT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">溝通摘要</label>
                <textarea value={contactForm.summary} onChange={e => setContactForm(p => ({ ...p, summary: e.target.value }))}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" rows={3} placeholder="本次溝通內容..." />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">下一步行動</label>
                <input value={contactForm.next_action} onChange={e => setContactForm(p => ({ ...p, next_action: e.target.value }))}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="下次要做什麼..." />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">預計日期</label>
                <input type="date" value={contactForm.next_action_date} onChange={e => setContactForm(p => ({ ...p, next_action_date: e.target.value }))}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button onClick={() => setShowContactModal(false)} className="px-4 py-2 text-sm text-slate-600 border rounded-lg hover:bg-slate-50">取消</button>
              <button onClick={handleAddContact} disabled={contactLoading} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {contactLoading ? '新增中...' : '新增'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
