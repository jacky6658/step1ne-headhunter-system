/**
 * ResumeImportPage.tsx
 * 履歷批量匯入頁面
 *
 * 功能：
 * 1. 拖放 / 選擇多個 LinkedIn PDF
 * 2. 呼叫 POST /api/resume/batch-parse 解析
 * 3. 顯示解析結果表格，含候選人比對狀態
 * 4. 批量 PATCH（更新）或 POST（新增）候選人資料
 */

import React, { useState, useCallback, useRef } from 'react';
import { apiPatch, apiPost, getApiUrl, getAuthHeaders } from '../config/api';
import { toast } from '../components/Toast';

// ── 型別 ──────────────────────────────────────────────────────

interface ParsedResult {
  filename: string;
  status: 'ok' | 'error';
  error?: string;
  parsed?: any;
  existingMatch?: { id: number; name: string } | null;
}

interface RowState {
  selected: boolean;
  action: 'update' | 'create';   // update = PATCH 現有候選人, create = POST 新增
}

// ── 元件 ──────────────────────────────────────────────────────

export default function ResumeImportPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [results, setResults] = useState<ParsedResult[]>([]);
  const [rowStates, setRowStates] = useState<Record<number, RowState>>({});
  const [applying, setApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState<{ done: number; total: number } | null>(null);
  const [applyLog, setApplyLog] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 拖放處理 ──

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (files.length > 0) uploadFiles(files);
  }, []);

  // ── 上傳解析 ──

  const uploadFiles = async (files: File[]) => {
    setParsing(true);
    setResults([]);
    setRowStates({});
    setApplyLog([]);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));

      const authH = getAuthHeaders();
      delete authH['Content-Type']; // Let browser set multipart boundary
      const resp = await fetch(getApiUrl('/api/resume/batch-parse'), {
        method: 'POST',
        headers: authH,
        body: formData,
      });
      const json = await resp.json();
      if (!json.success) throw new Error(json.error || '解析失敗');

      const parsed: ParsedResult[] = json.results;
      setResults(parsed);

      // 初始化每行狀態：預設全選，有比對到 → update，否則 → create
      const initStates: Record<number, RowState> = {};
      parsed.forEach((r, i) => {
        if (r.status === 'ok') {
          initStates[i] = {
            selected: true,
            action: r.existingMatch ? 'update' : 'create',
          };
        }
      });
      setRowStates(initStates);
    } catch (e: any) {
      toast.error('批量解析失敗：' + e.message);
    } finally {
      setParsing(false);
    }
  };

  // ── 全選切換 ──

  const toggleAll = (checked: boolean) => {
    setRowStates(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        next[Number(k)] = { ...next[Number(k)], selected: checked };
      });
      return next;
    });
  };

  // ── 套用 ──

  const handleApply = async () => {
    const toProcess = results
      .map((r, i) => ({ r, i, state: rowStates[i] }))
      .filter(({ r, state }) => r.status === 'ok' && state?.selected);

    if (toProcess.length === 0) {
      toast.warning('請至少勾選一筆記錄');
      return;
    }

    setApplying(true);
    setApplyProgress({ done: 0, total: toProcess.length });
    setApplyLog([]);

    for (let idx = 0; idx < toProcess.length; idx++) {
      const { r, state } = toProcess[idx];
      const p = r.parsed!;

      try {
        const payload: any = {
          name: p.name,
          position: p.position,
          location: p.location,
          years: p.years,
          skills: Array.isArray(p.skills) ? p.skills.join('、') : (p.skills || ''),
          education: p.education,
          notes: p.notes,
          actor: 'resume-import',
        };
        if (p.linkedinUrl) payload.linkedin_url = p.linkedinUrl;
        if (p.workHistory?.length) payload.work_history = JSON.stringify(p.workHistory);
        if (p.educationJson?.length) payload.education_details = JSON.stringify(p.educationJson);

        if (state.action === 'update' && r.existingMatch) {
          await apiPatch(`/api/candidates/${r.existingMatch.id}`, payload);
          setApplyLog(prev => [...prev, `✅ 更新「${p.name || r.filename}」(#${r.existingMatch!.id})`]);
        } else {
          // 新增候選人
          const newPayload = { ...payload, status: '未開始', source: 'LinkedIn PDF' };
          await apiPost('/api/candidates', newPayload);
          setApplyLog(prev => [...prev, `🆕 新增「${p.name || r.filename}」`]);
        }
      } catch (e: any) {
        setApplyLog(prev => [...prev, `❌ 失敗「${r.filename}」：${e.message}`]);
      }

      setApplyProgress({ done: idx + 1, total: toProcess.length });
    }

    setApplying(false);
  };

  // ── UI ──────────────────────────────────────────────────────

  const selectedCount = Object.values(rowStates).filter(s => s.selected).length;
  const okResults = results.filter(r => r.status === 'ok');
  const errResults = results.filter(r => r.status === 'error');

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* 標題 */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">📄 履歷批量匯入</h1>
        <p className="text-sm text-gray-500 mt-1">
          上傳從 LinkedIn 下載的 PDF 履歷，系統自動解析並比對現有候選人。
        </p>
      </div>

      {/* 拖放區 */}
      {results.length === 0 && !parsing && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-colors ${
            isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
          }`}
        >
          <div className="text-5xl mb-4">📂</div>
          <p className="text-base font-medium text-gray-600">拖放 PDF 履歷到此處</p>
          <p className="text-sm text-gray-400 mt-1">或點擊選擇（最多 20 份，每份最大 10 MB）</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={e => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) uploadFiles(files);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {/* 解析中 */}
      {parsing && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-blue-600">
          <svg className="animate-spin w-10 h-10" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <p className="text-sm font-medium">批量解析 PDF 中，請稍候...</p>
        </div>
      )}

      {/* 結果表格 */}
      {results.length > 0 && !parsing && (
        <div className="space-y-4">
          {/* 摘要列 */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-gray-500">共 <b>{results.length}</b> 份 PDF</span>
            <span className="text-sm text-green-600">✅ 成功解析：{okResults.length}</span>
            {errResults.length > 0 && (
              <span className="text-sm text-red-500">❌ 解析失敗：{errResults.length}</span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => { setResults([]); setRowStates({}); setApplyLog([]); setApplyProgress(null); }}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50"
              >
                重新上傳
              </button>
              <button
                onClick={handleApply}
                disabled={applying || selectedCount === 0}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {applying ? '套用中...' : `套用選取 (${selectedCount})`}
              </button>
            </div>
          </div>

          {/* 進度條 */}
          {applyProgress && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>套用進度</span>
                <span>{applyProgress.done} / {applyProgress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${(applyProgress.done / applyProgress.total) * 100}%` }}
                />
              </div>
              {applyLog.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-40 overflow-y-auto space-y-1">
                  {applyLog.map((log, i) => (
                    <p key={i} className="text-xs text-gray-600">{log}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 表格 */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="w-10 px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedCount === okResults.length && okResults.length > 0}
                      onChange={e => toggleAll(e.target.checked)}
                    />
                  </th>
                  <th className="px-4 py-3 text-left">姓名 / 檔名</th>
                  <th className="px-4 py-3 text-left">職稱</th>
                  <th className="px-4 py-3 text-left">技能（前3）</th>
                  <th className="px-4 py-3 text-left">比對結果</th>
                  <th className="px-4 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map((r, i) => {
                  const state = rowStates[i];

                  if (r.status === 'error') {
                    return (
                      <tr key={i} className="bg-red-50">
                        <td className="px-3 py-3 text-center">—</td>
                        <td className="px-4 py-3 text-gray-500 text-xs" colSpan={4}>{r.filename}</td>
                        <td className="px-4 py-3 text-red-500 text-xs">{r.error}</td>
                      </tr>
                    );
                  }

                  const p = r.parsed!;
                  const topSkills = (Array.isArray(p.skills) ? p.skills : []).slice(0, 3);

                  return (
                    <tr key={i} className={`hover:bg-gray-50 ${state?.selected ? '' : 'opacity-50'}`}>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={state?.selected ?? false}
                          onChange={e => setRowStates(prev => ({
                            ...prev,
                            [i]: { ...prev[i], selected: e.target.checked },
                          }))}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{p.name || '—'}</div>
                        <div className="text-xs text-gray-400">{r.filename}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{p.position || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {topSkills.length > 0 ? topSkills.map((s: string, si: number) => (
                            <span key={si} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{s}</span>
                          )) : <span className="text-xs text-gray-400">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.existingMatch ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                            🟢 更新「{r.existingMatch.name}」#{r.existingMatch.id}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                            🔵 新增人選
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {/* 操作：切換更新/新增 */}
                        {r.existingMatch && state && (
                          <select
                            value={state.action}
                            onChange={e => setRowStates(prev => ({
                              ...prev,
                              [i]: { ...prev[i], action: e.target.value as 'update' | 'create' },
                            }))}
                            className="text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-600"
                          >
                            <option value="update">更新現有</option>
                            <option value="create">另建新筆</option>
                          </select>
                        )}
                        {!r.existingMatch && (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
