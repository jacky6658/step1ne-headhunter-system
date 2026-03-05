import React, { useState } from 'react';
import { X, Zap, Plus, Trash2 } from 'lucide-react';
import { generateKeywords } from '../../services/crawlerService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: any) => void;
}

export const CreateTaskModal: React.FC<Props> = ({ isOpen, onClose, onSubmit }) => {
  const [clientName, setClientName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [primarySkills, setPrimarySkills] = useState<string[]>([]);
  const [secondarySkills, setSecondarySkills] = useState<string[]>([]);
  const [location, setLocation] = useState('Taiwan');
  const [pages, setPages] = useState(3);
  const [scheduleType, setScheduleType] = useState('once');
  const [newPrimary, setNewPrimary] = useState('');
  const [newSecondary, setNewSecondary] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleAutoGenerate = async () => {
    if (!jobTitle.trim()) return;
    setGenerating(true);
    try {
      const result = await generateKeywords(jobTitle);
      if (result.primary_skills) setPrimarySkills(result.primary_skills);
      if (result.secondary_skills) setSecondarySkills(result.secondary_skills);
    } catch { /* ignore */ }
    setGenerating(false);
  };

  const addSkill = (type: 'primary' | 'secondary') => {
    if (type === 'primary' && newPrimary.trim()) {
      setPrimarySkills([...primarySkills, newPrimary.trim()]);
      setNewPrimary('');
    } else if (type === 'secondary' && newSecondary.trim()) {
      setSecondarySkills([...secondarySkills, newSecondary.trim()]);
      setNewSecondary('');
    }
  };

  const removeSkill = (type: 'primary' | 'secondary', index: number) => {
    if (type === 'primary') {
      setPrimarySkills(primarySkills.filter((_, i) => i !== index));
    } else {
      setSecondarySkills(secondarySkills.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = () => {
    if (!clientName.trim() || !jobTitle.trim()) return;
    onSubmit({
      client_name: clientName,
      job_title: jobTitle,
      primary_skills: primarySkills,
      secondary_skills: secondarySkills,
      location,
      pages,
      schedule_type: scheduleType,
    });
    // reset
    setClientName('');
    setJobTitle('');
    setPrimarySkills([]);
    setSecondarySkills([]);
    setPages(3);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-slate-900">新增爬蟲任務</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* 客戶名稱 */}
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1 block">客戶名稱 *</label>
            <input
              type="text"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="例如：一通數位"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
          </div>

          {/* 職缺名稱 + 自動生成 */}
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1 block">職缺名稱 *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={jobTitle}
                onChange={e => setJobTitle(e.target.value)}
                placeholder="例如：Java 後端工程師"
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              />
              <button
                onClick={handleAutoGenerate}
                disabled={generating || !jobTitle.trim()}
                className="flex items-center gap-1 px-3 py-2 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50 whitespace-nowrap"
              >
                <Zap size={13} className={generating ? 'animate-pulse' : ''} />
                自動生成
              </button>
            </div>
          </div>

          {/* 主技能 */}
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1 block">主要技能 (AND)</label>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {primarySkills.map((s, i) => (
                <span key={i} className="flex items-center gap-1 text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg">
                  {s}
                  <button onClick={() => removeSkill('primary', i)} className="hover:text-red-500"><Trash2 size={10} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newPrimary}
                onChange={e => setNewPrimary(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSkill('primary')}
                placeholder="輸入技能後按 Enter"
                className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button onClick={() => addSkill('primary')} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Plus size={14} /></button>
            </div>
          </div>

          {/* 次技能 */}
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1 block">次要技能 (OR)</label>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {secondarySkills.map((s, i) => (
                <span key={i} className="flex items-center gap-1 text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-lg">
                  {s}
                  <button onClick={() => removeSkill('secondary', i)} className="hover:text-red-500"><Trash2 size={10} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newSecondary}
                onChange={e => setNewSecondary(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSkill('secondary')}
                placeholder="輸入技能後按 Enter"
                className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button onClick={() => addSkill('secondary')} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><Plus size={14} /></button>
            </div>
          </div>

          {/* 地區 + 頁數 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">搜尋地區</label>
              <select
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white"
              >
                <option value="Taiwan">台灣</option>
                <option value="Taipei">台北</option>
                <option value="Remote">遠端</option>
                <option value="">不限</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">搜尋頁數</label>
              <input
                type="number"
                min={1}
                max={10}
                value={pages}
                onChange={e => setPages(parseInt(e.target.value) || 3)}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          {/* 排程 */}
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1 block">排程方式</label>
            <select
              value={scheduleType}
              onChange={e => setScheduleType(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value="once">一次性</option>
              <option value="daily">每日執行</option>
              <option value="weekly">每週執行</option>
              <option value="interval">定時間隔</option>
            </select>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!clientName.trim() || !jobTitle.trim()}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            建立任務
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateTaskModal;
