import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, Role, Prompt, PromptCategory } from '../types';
import { apiGet, apiPost, apiPatch, apiDelete } from '../config/api';
import { Plus, ThumbsUp, Pin, Copy, Check, Trash2, Edit3, X, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  userProfile: UserProfile;
}

const CATEGORIES: { id: PromptCategory; icon: string; short: string }[] = [
  { id: '客戶需求理解',        icon: '1️⃣', short: '客戶需求' },
  { id: '職缺分析',            icon: '2️⃣', short: '職缺分析' },
  { id: '人才市場 Mapping',     icon: '3️⃣', short: '市場 Mapping' },
  { id: '人才搜尋',            icon: '4️⃣', short: '人才搜尋' },
  { id: '陌生開發（開發信）',   icon: '5️⃣', short: '陌生開發' },
  { id: '人選訪談',            icon: '6️⃣', short: '人選訪談' },
  { id: '人選評估',            icon: '7️⃣', short: '人選評估' },
  { id: '客戶推薦',            icon: '8️⃣', short: '客戶推薦' },
  { id: '面試與 Offer 管理',   icon: '9️⃣', short: '面試 & Offer' },
];

export function PromptLibraryPage({ userProfile }: Props) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<PromptCategory>('客戶需求理解');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [addForm, setAddForm] = useState({ title: '', content: '' });
  const [editForm, setEditForm] = useState({ title: '', content: '' });
  const [saving, setSaving] = useState(false);

  const isAdmin = userProfile.role === Role.ADMIN;
  const viewer = userProfile.displayName;

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ success: boolean; data: Prompt[] }>(
        `/prompts?category=${encodeURIComponent(activeCategory)}&viewer=${encodeURIComponent(viewer)}`
      );
      if (data.success) setPrompts(data.data || []);
    } catch (e) {
      console.error('載入提示詞失敗:', e);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, viewer]);

  useEffect(() => { loadPrompts(); }, [loadPrompts]);

  // ── 新增提示詞 ──
  const handleAdd = async () => {
    if (!addForm.title.trim() || !addForm.content.trim()) return alert('請填寫標題和內容');
    setSaving(true);
    try {
      const result = await apiPost<{ success: boolean; data: Prompt }>('/prompts', {
        category: activeCategory,
        title: addForm.title.trim(),
        content: addForm.content.trim(),
        author: viewer,
      });
      if (result.success) {
        setPrompts(prev => [result.data, ...prev]);
        setShowAddModal(false);
        setAddForm({ title: '', content: '' });
      }
    } catch (e) {
      alert('新增失敗');
    } finally {
      setSaving(false);
    }
  };

  // ── 編輯提示詞 ──
  const handleEdit = async () => {
    if (!editingPrompt || !editForm.title.trim() || !editForm.content.trim()) return;
    setSaving(true);
    try {
      const result = await apiPatch<{ success: boolean; data: Prompt }>(`/prompts/${editingPrompt.id}`, {
        title: editForm.title.trim(),
        content: editForm.content.trim(),
        actor: viewer,
      });
      if (result.success) {
        setPrompts(prev => prev.map(p => p.id === editingPrompt.id ? result.data : p));
        setEditingPrompt(null);
      }
    } catch (e) {
      alert('更新失敗');
    } finally {
      setSaving(false);
    }
  };

  // ── 刪除提示詞 ──
  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除這條提示詞嗎？')) return;
    try {
      await apiDelete(`/prompts/${id}`);
      setPrompts(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      alert('刪除失敗');
    }
  };

  // ── 投票 ──
  const handleUpvote = async (id: number) => {
    try {
      const result = await apiPost<{ success: boolean; data: Prompt }>(`/prompts/${id}/upvote`, { voter: viewer });
      if (result.success) {
        setPrompts(prev => prev.map(p => p.id === id ? result.data : p));
      }
    } catch (e) {
      console.error('投票失敗:', e);
    }
  };

  // ── 置頂 ──
  const handlePin = async (id: number, action: 'pin' | 'unpin') => {
    try {
      await apiPost(`/prompts/${id}/pin`, { action, actor: viewer });
      loadPrompts();
    } catch (e) {
      alert('置頂操作失敗');
    }
  };

  // ── 複製 ──
  const handleCopy = (content: string, id: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const pinnedPrompt = prompts.find(p => p.is_pinned);
  const communityPrompts = prompts.filter(p => !p.is_pinned);

  return (
    <div className="max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">💡 提示詞資料庫</h1>
          <p className="text-sm text-slate-500 mt-1">團隊共享最佳提示詞，按工作流程分類</p>
        </div>
        <button
          onClick={() => { setAddForm({ title: '', content: '' }); setShowAddModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={18} /> 新增提示詞
        </button>
      </div>

      {/* ── Category Tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
              activeCategory === cat.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {cat.icon} {cat.short}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">載入中...</div>
      ) : (
        <>
          {/* ── 置頂提示詞 ── */}
          {pinnedPrompt && (
            <div className="mb-6">
              <h2 className="text-sm font-bold text-amber-600 mb-3 flex items-center gap-2">
                <Pin size={14} /> 置頂提示詞
              </h2>
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">⭐ {pinnedPrompt.title}</h3>
                    <span className="text-xs text-slate-500">
                      by {pinnedPrompt.author} · {new Date(pinnedPrompt.created_at).toLocaleDateString('zh-TW')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpvote(pinnedPrompt.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        pinnedPrompt.has_voted
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-white text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      <ThumbsUp size={14} /> {pinnedPrompt.upvote_count}
                    </button>
                    <button
                      onClick={() => handleCopy(pinnedPrompt.content, pinnedPrompt.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 rounded-lg text-sm text-slate-600 transition-colors"
                    >
                      {copiedId === pinnedPrompt.id ? <><Check size={14} className="text-green-600" /> 已複製</> : <><Copy size={14} /> 複製</>}
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handlePin(pinnedPrompt.id, 'unpin')}
                        className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-500 rounded-lg text-sm transition-colors"
                      >
                        取消置頂
                      </button>
                    )}
                  </div>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-slate-700 bg-white/60 rounded-xl p-4 font-sans leading-relaxed max-h-[400px] overflow-y-auto">
                  {pinnedPrompt.content}
                </pre>
              </div>
            </div>
          )}

          {/* ── 社群提示詞 ── */}
          <div>
            <h2 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2">
              💬 社群提示詞 ({communityPrompts.length})
            </h2>

            {communityPrompts.length === 0 && !pinnedPrompt && (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
                <p className="text-slate-400 text-lg mb-2">這個分類還沒有提示詞</p>
                <p className="text-slate-400 text-sm">點擊「新增提示詞」來分享你的第一個提示詞！</p>
              </div>
            )}

            <div className="space-y-3">
              {communityPrompts.map(prompt => {
                const isExpanded = expandedId === prompt.id;
                const isAuthor = prompt.author === viewer;
                const canEdit = isAuthor || isAdmin;

                return (
                  <div
                    key={prompt.id}
                    className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all shadow-sm"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : prompt.id)}>
                          <h3 className="font-bold text-slate-900 truncate">{prompt.title}</h3>
                          <span className="text-xs text-slate-400">
                            by {prompt.author} · {new Date(prompt.created_at).toLocaleDateString('zh-TW')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                          <button
                            onClick={() => handleUpvote(prompt.id)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                              prompt.has_voted
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            <ThumbsUp size={12} /> {prompt.upvote_count}
                          </button>
                          <button
                            onClick={() => handleCopy(prompt.content, prompt.id)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                            title="複製"
                          >
                            {copiedId === prompt.id ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handlePin(prompt.id, 'pin')}
                              className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition-colors"
                              title="置頂"
                            >
                              <Pin size={14} />
                            </button>
                          )}
                          {canEdit && (
                            <>
                              <button
                                onClick={() => { setEditingPrompt(prompt); setEditForm({ title: prompt.title, content: prompt.content }); }}
                                className="p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-lg transition-colors"
                                title="編輯"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(prompt.id)}
                                className="p-1.5 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded-lg transition-colors"
                                title="刪除"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : prompt.id)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>

                      {/* 預覽 / 展開 */}
                      {isExpanded ? (
                        <pre className="whitespace-pre-wrap text-sm text-slate-700 bg-slate-50 rounded-xl p-4 mt-3 font-sans leading-relaxed max-h-[400px] overflow-y-auto">
                          {prompt.content}
                        </pre>
                      ) : (
                        <p className="text-sm text-slate-500 mt-2 line-clamp-2">{prompt.content}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── 新增 Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-bold text-slate-900">新增提示詞</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">分類</label>
                <div className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium">
                  {CATEGORIES.find(c => c.id === activeCategory)?.icon} {activeCategory}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">標題 *</label>
                <input
                  type="text"
                  value={addForm.title}
                  onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="例：客戶需求訪談提問模板"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">提示詞內容 *</label>
                <textarea
                  value={addForm.content}
                  onChange={e => setAddForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="輸入完整的提示詞內容..."
                  rows={12}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y font-mono text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t bg-slate-50 rounded-b-2xl">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-sm">取消</button>
              <button
                onClick={handleAdd}
                disabled={saving || !addForm.title.trim() || !addForm.content.trim()}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {saving ? '儲存中...' : '新增'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 編輯 Modal ── */}
      {editingPrompt && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => setEditingPrompt(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-bold text-slate-900">編輯提示詞</h3>
              <button onClick={() => setEditingPrompt(null)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">標題</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">提示詞內容</label>
                <textarea
                  value={editForm.content}
                  onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                  rows={12}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y font-mono text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t bg-slate-50 rounded-b-2xl">
              <button onClick={() => setEditingPrompt(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-sm">取消</button>
              <button
                onClick={handleEdit}
                disabled={saving}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {saving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
