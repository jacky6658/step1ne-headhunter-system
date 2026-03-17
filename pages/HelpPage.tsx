import React, { useState } from 'react';
import { BookOpen, Users, Briefcase, Target, FileText, Link as LinkIcon, Download, CheckCircle, XCircle, AlertCircle, Sparkles, Database, Award, Bot, Copy, CheckCheck, Zap } from 'lucide-react';
import { getPublicApiBaseUrl } from '../config/api';

interface HelpPageProps {
  userProfile?: any;
}

const API_HOST = getPublicApiBaseUrl();

const AIBOT_STARTUP_PROMPT = `請先閱讀以下兩份系統文件，學習完畢後立即向我自我介紹你的能力：

1. 系統操作指南（API 操作手冊）：
${API_HOST}/api/guide

2. 履歷分析教學指南：
${API_HOST}/api/resume-guide

讀完後，請用 {顧問名稱}-aibot 作為操作者身份，並告訴我你現在可以幫我做哪些事。`;

const SCORING_BOT_PROMPT = `請讀取以下文件後立即執行評分任務：
${API_HOST}/api/scoring-guide

我是顧問 {顧問名稱}，你的身份為 {顧問名稱}-scoring-bot。
不需要等待進一步指示，直接開始執行。`;

const JOB_IMPORT_PROMPT = `請讀取以下文件後立即執行職缺匯入任務：
${API_HOST}/api/jobs-import-guide

我是顧問 {顧問名稱}，你的身份為 {顧問名稱}-import-bot。
以下是我要匯入的職缺連結：
{貼上 104 或 1111 連結，或直接貼上 JD 文字}
不需要等待進一步指示，直接開始執行。`;

const RESUME_IMPORT_PROMPT = `請讀取以下文件後立即執行履歷匯入與評分任務：
${API_HOST}/api/resume-import-guide

我是顧問 {顧問名稱}，你的身份為 {顧問名稱}-resume-bot。
目標職缺：{填入職缺名稱，例如：Java Developer (後端工程師)}

以下是候選人履歷：
{貼上履歷文字}

不需要等待進一步指示，直接開始執行。`;

const GITHUB_ANALYSIS_BOT_PROMPT = `請讀取以下文件後立即執行 GitHub 分析任務：
${API_HOST}/api/github-analysis-guide

我是顧問 {顧問名稱}，你的身份為 {顧問名稱}-github-bot。
不需要等待進一步指示，直接開始執行。`;

const HelpPage: React.FC<HelpPageProps> = () => {
  const [copied, setCopied] = useState(false);
  const [copiedScoring, setCopiedScoring] = useState(false);
  const [copiedImport, setCopiedImport] = useState(false);
  const [copiedResume, setCopiedResume] = useState(false);
  const [copiedGithub, setCopiedGithub] = useState(false);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(AIBOT_STARTUP_PROMPT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleCopyScoringPrompt = () => {
    navigator.clipboard.writeText(SCORING_BOT_PROMPT).then(() => {
      setCopiedScoring(true);
      setTimeout(() => setCopiedScoring(false), 2500);
    });
  };

  const handleCopyImportPrompt = () => {
    navigator.clipboard.writeText(JOB_IMPORT_PROMPT).then(() => {
      setCopiedImport(true);
      setTimeout(() => setCopiedImport(false), 2500);
    });
  };

  const handleCopyResumePrompt = () => {
    navigator.clipboard.writeText(RESUME_IMPORT_PROMPT).then(() => {
      setCopiedResume(true);
      setTimeout(() => setCopiedResume(false), 2500);
    });
  };

  const handleCopyGithubPrompt = () => {
    navigator.clipboard.writeText(GITHUB_ANALYSIS_BOT_PROMPT).then(() => {
      setCopiedGithub(true);
      setTimeout(() => setCopiedGithub(false), 2500);
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      {/* 標題 */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-center gap-4 mb-4">
          <BookOpen size={48} className="text-white" />
          <div>
            <h1 className="text-3xl font-black mb-2">Step1ne 獵頭系統使用說明</h1>
            <p className="text-indigo-100 text-lg">AI 驅動的智能招聘管理平台</p>
          </div>
        </div>
      </div>

      {/* 快速導覽 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <AlertCircle className="text-indigo-600" size={24} />
          快速導覽
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <a href="#候選人總表" className="p-4 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors">
            <Users className="text-indigo-600 mb-2" size={24} />
            <h3 className="font-black text-slate-900 mb-1">候選人總表</h3>
            <p className="text-sm text-slate-600">管理所有候選人資料</p>
          </a>
          <a href="#職缺管理" className="p-4 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors">
            <Briefcase className="text-purple-600 mb-2" size={24} />
            <h3 className="font-black text-slate-900 mb-1">職缺管理</h3>
            <p className="text-sm text-slate-600">新增和管理招聘職缺</p>
          </a>
          <a href="#AIbot" className="p-4 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors">
            <Bot className="text-indigo-600 mb-2" size={24} />
            <h3 className="font-black text-slate-900 mb-1">AIbot 啟動指南</h3>
            <p className="text-sm text-slate-600">複製指令讓 AIbot 學習系統</p>
          </a>
          <a href="#ScoringBot" className="p-4 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors">
            <Zap className="text-amber-600 mb-2" size={24} />
            <h3 className="font-black text-slate-900 mb-1">評分 Bot 啟動指令</h3>
            <p className="text-sm text-slate-600">openclaw 定時評分任務指令</p>
          </a>
          <a href="#JobImportBot" className="p-4 bg-green-50 rounded-xl hover:bg-green-100 transition-colors">
            <Download className="text-green-600 mb-2" size={24} />
            <h3 className="font-black text-slate-900 mb-1">職缺匯入 Bot 指令</h3>
            <p className="text-sm text-slate-600">貼上 104/1111 連結自動建立職缺</p>
          </a>
          <a href="#ResumeImportBot" className="p-4 bg-rose-50 rounded-xl hover:bg-rose-100 transition-colors">
            <FileText className="text-rose-600 mb-2" size={24} />
            <h3 className="font-black text-slate-900 mb-1">履歷匯入 Bot 指令</h3>
            <p className="text-sm text-slate-600">貼上履歷自動匯入並即時評分</p>
          </a>
          <a href="#GithubAnalysisBot" className="p-4 bg-cyan-50 rounded-xl hover:bg-cyan-100 transition-colors">
            <Target className="text-cyan-600 mb-2" size={24} />
            <h3 className="font-black text-slate-900 mb-1">GitHub 分析 Bot</h3>
            <p className="text-sm text-slate-600">深度分析候選人 GitHub 技術能力</p>
          </a>
          <a href="#客戶管理" className="p-4 bg-teal-50 rounded-xl hover:bg-teal-100 transition-colors">
            <Sparkles className="text-teal-600 mb-2" size={24} />
            <h3 className="font-black text-slate-900 mb-1">客戶管理</h3>
            <p className="text-sm text-slate-600">管理客戶公司資訊與合作關係</p>
          </a>
        </div>
      </div>

      {/* 候選人總表 */}
      <div id="候選人總表" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <Users className="text-indigo-600" size={24} />
          候選人總表
        </h2>
        <div className="space-y-4 text-slate-700">
          <div>
            <h3 className="font-black text-slate-900 mb-2">📋 功能說明</h3>
            <p className="mb-3">候選人總表是系統的核心功能，您可以在此查看、搜尋和管理所有候選人資料。</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>查看所有候選人的詳細資訊</li>
              <li>使用搜尋功能快速找到特定候選人</li>
              <li>點擊表格中的任意行可開啟候選人詳情</li>
              <li>支援按各欄位排序和篩選</li>
              <li>顯示人才等級（S/A+/A/B/C）</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-black text-slate-900 mb-2">
              <LinkIcon className="inline mr-2 text-indigo-600" size={18} />
              LinkedIn 快速查看
            </h3>
            <p className="mb-2">系統支援 LinkedIn 連結快速開啟：</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>候選人列表中的 LinkedIn 資訊會顯示為可點擊連結</li>
              <li>點擊 LinkedIn 圖標會在新分頁開啟候選人檔案</li>
              <li>支援格式：<code className="bg-gray-100 px-1">LinkedIn: username</code> 或完整 URL</li>
            </ul>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">⚡ 快速操作</h3>
            <p className="mb-2">在候選人總表中，每個候選人都有快速操作按鈕：</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>下載履歷</strong>：生成並下載匿名履歷（保護候選人隱私）</li>
              <li><strong>更新狀態</strong>：快速變更候選人狀態（未開始/聯繫階段/面試階段/Offer/on board 等）</li>
              <li><strong>查看詳情</strong>：開啟完整的候選人資料視窗</li>
            </ul>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">
              <Award className="inline mr-2 text-indigo-600" size={18} />
              人才等級（AI 綜合評分）
            </h3>
            <p className="text-sm text-slate-600 mb-3">AI 根據五維度評分（人才畫像 40% + JD 匹配 30% + 公司適配 15% + 可觸達性 10% + 活躍信號 5%）判定等級：</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <span className="font-black text-yellow-700">S 級（90-100）</span>
                <p className="text-xs text-slate-600 mt-1">頂尖人才（稀缺），強烈推薦</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <span className="font-black text-green-700">A+ 級（80-89）</span>
                <p className="text-xs text-slate-600 mt-1">優秀人才，強力推薦</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="font-black text-blue-700">A 級（70-79）</span>
                <p className="text-xs text-slate-600 mt-1">合格人才，可推薦</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="font-black text-gray-700">B 級（60-69）</span>
                <p className="text-xs text-slate-600 mt-1">基本合格，需評估後推薦</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <span className="font-black text-red-700">C 級（&lt;60）</span>
                <p className="text-xs text-slate-600 mt-1">需補強，謹慎推薦</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 職缺管理 */}
      <div id="職缺管理" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <Briefcase className="text-purple-600" size={24} />
          職缺管理
        </h2>
        <div className="space-y-4 text-slate-700">
          <div>
            <h3 className="font-black text-slate-900 mb-2">📊 功能說明</h3>
            <p className="mb-3">職缺管理頁面讓您新增、編輯和管理所有招聘職缺。</p>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">➕ 新增職缺</h3>
            <p className="mb-2">點擊「新增職缺」按鈕，填寫以下資訊：</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>職位名稱</strong>：例如：軟體工程師、產品經理</li>
              <li><strong>部門</strong>：職缺所屬部門</li>
              <li><strong>招聘人數</strong>：計畫招聘的人數</li>
              <li><strong>薪資範圍</strong>：例如：80k-120k</li>
              <li><strong>必備技能</strong>：職缺要求的核心技能</li>
              <li><strong>加分技能</strong>：優先考慮的額外技能</li>
              <li><strong>工作經驗</strong>：要求的年資</li>
              <li><strong>學歷要求</strong>：最低學歷要求</li>
            </ul>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">🔄 職缺狀態</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="font-black text-blue-700">招募中</span>
                <p className="text-xs text-slate-600 mt-1">職缺開放，積極招聘</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <span className="font-black text-amber-700">暫停</span>
                <p className="text-xs text-slate-600 mt-1">暫時停止招聘</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <span className="font-black text-green-700">已滿額</span>
                <p className="text-xs text-slate-600 mt-1">已招募足夠人數</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="font-black text-gray-700">關閉</span>
                <p className="text-xs text-slate-600 mt-1">職缺已關閉</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">🎯 公司資訊</h3>
            <p className="mb-2">職缺可包含詳細的公司資訊（用於 AI 配對）：</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>公司名稱</strong>：職缺所屬公司</li>
              <li><strong>產業別</strong>：例如：科技、金融、製造</li>
              <li><strong>公司規模</strong>：例如：50-200人</li>
              <li><strong>公司階段</strong>：例如：成長期、成熟期</li>
              <li><strong>企業文化</strong>：公司文化描述</li>
              <li><strong>技術棧</strong>：使用的技術和工具</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 客戶管理 */}
      <div id="客戶管理" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <Sparkles className="text-teal-600" size={24} />
          客戶管理
        </h2>
        <div className="space-y-4 text-slate-700">
          <div>
            <h3 className="font-black text-slate-900 mb-2">🏢 功能說明</h3>
            <p className="mb-3">客戶管理頁面讓您管理所有合作客戶的公司資訊，包含聯繫人、合作狀態、開案記錄等。</p>
          </div>
          <div>
            <h3 className="font-black text-slate-900 mb-2">📋 客戶資訊</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>公司名稱</strong>：客戶公司全名</li>
              <li><strong>產業別</strong>：例如：科技、金融、製造</li>
              <li><strong>公司規模</strong>：員工人數</li>
              <li><strong>合作狀態</strong>：開發中 / 合作中 / 暫停 / 結束</li>
              <li><strong>負責顧問</strong>：此客戶的負責人</li>
              <li><strong>開案記錄</strong>：歷次合作職缺記錄</li>
            </ul>
          </div>
          <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
            <p className="text-sm text-teal-900">
              💡 <strong>AI Bot 整合</strong>：AIbot 可透過 <code className="bg-white px-1 rounded">GET /api/clients</code> 取得客戶資料，自動填入 Prompt 模板進行產業分析和公司研究。
            </p>
          </div>
        </div>
      </div>

      {/* 匿名履歷 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <FileText className="text-blue-600" size={24} />
          匿名履歷生成
        </h2>
        <div className="space-y-4 text-slate-700">
          <div>
            <h3 className="font-black text-slate-900 mb-2">🔒 功能說明</h3>
            <p className="mb-3">匿名履歷功能可以生成去除個人識別資訊的候選人履歷，保護候選人隱私的同時提供完整的專業資訊。</p>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">
              <Download className="inline mr-2 text-blue-600" size={18} />
              下載匿名履歷
            </h3>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>在候選人總表中找到目標候選人</li>
              <li>點擊「下載履歷」按鈕</li>
              <li>系統會自動生成匿名履歷（Markdown 格式）</li>
              <li>前端會轉換為 PDF 格式並下載</li>
            </ol>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">🎭 匿名化處理</h3>
            <p className="mb-2">系統會自動處理以下資訊：</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>姓名</strong>：替換為隨機代號（例如：Michael, Sarah）</li>
              <li><strong>公司名稱</strong>：轉換為通用描述（例如：知名科技公司）</li>
              <li><strong>聯絡資訊</strong>：完全移除電話、Email</li>
              <li><strong>個人識別</strong>：移除身分證、地址等敏感資訊</li>
              <li><strong>保留專業資訊</strong>：技能、經歷、學歷等專業內容完整保留</li>
            </ul>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900">
              💡 <strong>提示</strong>：匿名履歷適合初步推薦給客戶公司，待客戶表達興趣後再提供完整履歷。
            </p>
          </div>
        </div>
      </div>


      {/* API 功能 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <Database className="text-slate-600" size={24} />
          API 功能（開發者）
        </h2>
        <div className="space-y-4 text-slate-700">
          <div>
            <h3 className="font-black text-slate-900 mb-2">🔌 完整 CRUD API</h3>
            <p className="mb-3">系統提供完整的 REST API，支援候選人、職缺、客戶的新增、修改、刪除，以及 AI 分析與主動獵才功能。</p>
          </div>

          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 mb-4">
            <p className="text-sm text-amber-900">
              🔒 <strong>API 認證</strong>：所有操作型端點需帶 <code className="bg-white px-1 rounded">Authorization: Bearer {'<API_KEY>'}</code> header。
              指南端點（/api/guide、/api/scoring-guide 等）免認證，AI Bot 可直接讀取。
            </p>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">📡 可用端點</h3>
            <div className="space-y-3">
              <div>
                <p className="font-black text-slate-900 mb-1">Candidates（候選人）</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                  <li><code className="bg-gray-100 px-1">GET /api/candidates?limit=2000</code> - 取得所有候選人（務必帶 limit）</li>
                  <li><code className="bg-gray-100 px-1">GET /api/candidates?created_today=true</code> - 取得今日新增候選人</li>
                  <li><code className="bg-gray-100 px-1">GET /api/candidates/:id</code> - 取得單一候選人完整資料</li>
                  <li><code className="bg-gray-100 px-1">POST /api/candidates</code> - 新增候選人</li>
                  <li><code className="bg-gray-100 px-1">POST /api/candidates/bulk</code> - 批量匯入候選人</li>
                  <li><code className="bg-gray-100 px-1">PATCH /api/candidates/:id</code> - 局部更新候選人資料</li>
                  <li><code className="bg-gray-100 px-1">PUT /api/candidates/:id/pipeline-status</code> - 更新 Pipeline 狀態（自動追加進度記錄）</li>
                  <li><code className="bg-gray-100 px-1">PATCH /api/candidates/batch-status</code> - 批量更新狀態</li>
                  <li><code className="bg-gray-100 px-1">DELETE /api/candidates/:id</code> - 刪除候選人</li>
                  <li><code className="bg-gray-100 px-1">DELETE /api/candidates/batch</code> - 批量刪除候選人</li>
                </ul>
              </div>
              <div>
                <p className="font-black text-slate-900 mb-1">Jobs（職缺）</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                  <li><code className="bg-gray-100 px-1">GET /api/jobs</code> - 取得所有職缺（含三份畫像）</li>
                  <li><code className="bg-gray-100 px-1">GET /api/jobs/:id</code> - 取得單一職缺</li>
                  <li><code className="bg-gray-100 px-1">POST /api/jobs</code> - 新增職缺</li>
                  <li><code className="bg-gray-100 px-1">PUT /api/jobs/:id</code> - 更新職缺</li>
                  <li><code className="bg-gray-100 px-1">DELETE /api/jobs/:id</code> - 刪除職缺</li>
                </ul>
              </div>
              <div>
                <p className="font-black text-slate-900 mb-1">Clients（客戶）</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                  <li><code className="bg-gray-100 px-1">GET /api/clients</code> - 取得所有客戶</li>
                  <li><code className="bg-gray-100 px-1">GET /api/clients/:id</code> - 取得單一客戶</li>
                  <li><code className="bg-gray-100 px-1">POST /api/clients</code> - 新增客戶</li>
                  <li><code className="bg-gray-100 px-1">PATCH /api/clients/:id</code> - 更新客戶</li>
                </ul>
              </div>
              <div>
                <p className="font-black text-slate-900 mb-1">GitHub 分析 & 主動獵才</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                  <li><code className="bg-gray-100 px-1">GET /api/github/analyze/:username</code> - GitHub 技術分析</li>
                  <li><code className="bg-gray-100 px-1">GET /api/github/analyze/:username?jobId=:id</code> - GitHub 職缺匹配分析</li>
                  <li><code className="bg-gray-100 px-1">POST /api/talent-sourcing/find-candidates</code> - 主動獵才（搜尋 GitHub + LinkedIn）</li>
                </ul>
              </div>
              <div>
                <p className="font-black text-slate-900 mb-1">顧問 & 系統</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                  <li><code className="bg-gray-100 px-1">GET /api/users/:name/contact</code> - 取得顧問聯絡資訊</li>
                  <li><code className="bg-gray-100 px-1">GET /api/system-logs</code> - 查詢操作日誌</li>
                  <li><code className="bg-gray-100 px-1">GET /api/health</code> - 系統健康檢查</li>
                </ul>
              </div>
              <div>
                <p className="font-black text-slate-900 mb-1">AI 指南（免認證）</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                  <li><code className="bg-gray-100 px-1">GET /api/guide</code> - AIbot 操作指南</li>
                  <li><code className="bg-gray-100 px-1">GET /api/ai-guide</code> - AI 模組統一入口</li>
                  <li><code className="bg-gray-100 px-1">GET /api/guide/clients</code> - 客戶模組手冊</li>
                  <li><code className="bg-gray-100 px-1">GET /api/guide/jobs</code> - 職缺模組手冊</li>
                  <li><code className="bg-gray-100 px-1">GET /api/guide/candidates</code> - 人選模組手冊</li>
                  <li><code className="bg-gray-100 px-1">GET /api/guide/talent-ops</code> - 人才 AI 模組手冊</li>
                  <li><code className="bg-gray-100 px-1">GET /api/scoring-guide</code> - 評分指南</li>
                  <li><code className="bg-gray-100 px-1">GET /api/jobs-import-guide</code> - 職缺匯入指南</li>
                  <li><code className="bg-gray-100 px-1">GET /api/resume-guide</code> - 履歷分析教學</li>
                  <li><code className="bg-gray-100 px-1">GET /api/resume-import-guide</code> - 履歷匯入指南</li>
                  <li><code className="bg-gray-100 px-1">GET /api/github-analysis-guide</code> - GitHub 分析指南</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-700">
              📚 <strong>詳細 API 文檔</strong>：透過 <code className="bg-gray-100 px-1">GET {API_HOST}/api/guide</code> 取得完整操作手冊（Markdown 格式）
            </p>
          </div>
        </div>
      </div>

      {/* 常見問題 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <AlertCircle className="text-amber-600" size={24} />
          常見問題
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-black text-slate-900 mb-2">Q: AI 配對需要多久時間？</h3>
            <p className="text-slate-700">
              <strong>A:</strong> 每位候選人約需 2 秒，配對 5 位候選人大約需要 10 秒。系統會自動並行處理，提高效率。
            </p>
          </div>
          <div>
            <h3 className="font-black text-slate-900 mb-2">Q: 匿名履歷可以下載為 PDF 嗎？</h3>
            <p className="text-slate-700">
              <strong>A:</strong> 可以！系統會自動將 Markdown 格式的匿名履歷轉換為 PDF 並下載。
            </p>
          </div>
          <div>
            <h3 className="font-black text-slate-900 mb-2">Q: LinkedIn 連結無法開啟怎麼辦？</h3>
            <p className="text-slate-700">
              <strong>A:</strong> 請確認候選人資料中的 LinkedIn 欄位格式正確。支援格式：<code className="bg-gray-100 px-1">LinkedIn: username</code> 或完整 URL。
            </p>
          </div>
          <div>
            <h3 className="font-black text-slate-900 mb-2">Q: 如何修改候選人資訊？</h3>
            <p className="text-slate-700">
              <strong>A:</strong> 在候選人總表中點擊候選人行，即可開啟編輯視窗。
            </p>
          </div>
          <div>
            <h3 className="font-black text-slate-900 mb-2">Q: AI 評分是如何計算的？</h3>
            <p className="text-slate-700">
              <strong>A:</strong> AI 評分由 5 個維度綜合評估：人才畫像符合度（40%）、JD 職責匹配度（30%）、公司適配性（15%）、可觸達性（10%）、活躍信號（5%）。
            </p>
          </div>
        </div>
      </div>

      {/* AIbot 助理啟動指南 */}
      <div id="AIbot" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <Bot className="text-indigo-600" size={24} />
          AIbot 助理啟動指南
        </h2>
        <div className="space-y-4 text-slate-700">
          <div>
            <h3 className="font-black text-slate-900 mb-2">🤖 什麼是 AIbot？</h3>
            <p className="mb-3">
              AIbot 是你的 AI 助理（例如 Claude、ChatGPT），讀取系統文件後可透過終端機或對話窗操作 Step1ne 系統，
              協助顧問新增候選人、更新進度、分析履歷等。
            </p>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">🚀 啟動步驟</h3>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>開啟你的 AI 助理對話視窗（Claude / ChatGPT 等）</li>
              <li>複製下方的「AIbot 啟動指令」，貼到對話框並送出</li>
              <li>等待 AIbot 讀完文件後，它會主動告知你它的能力</li>
              <li>之後直接用自然語言下指令，AIbot 就會操作系統</li>
            </ol>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-3 flex items-center gap-2">
              <Copy size={16} className="text-indigo-600" />
              AIbot 啟動指令
              <span className="text-xs font-normal text-slate-500 ml-1">（複製後貼給你的 AI 助理）</span>
            </h3>
            <div className="relative">
              <pre className="bg-slate-900 text-green-400 text-sm rounded-xl p-4 whitespace-pre-wrap leading-relaxed font-mono overflow-x-auto">
{AIBOT_STARTUP_PROMPT}
              </pre>
              <button
                onClick={handleCopyPrompt}
                className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
                {copied ? '已複製！' : '複製指令'}
              </button>
            </div>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-3">📋 AIbot 可以幫你做的事</h3>
            <div className="space-y-3">

              {/* 候選人管理 */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-semibold text-blue-700 text-sm mb-2">👤 候選人管理</p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside ml-1">
                  <li>查詢全部候選人 / 查詢特定候選人資料</li>
                  <li>新增候選人（提供履歷文字後自動填入所有欄位）</li>
                  <li>批量匯入多位候選人</li>
                  <li>指派或更換負責顧問</li>
                  <li>更新 LinkedIn、GitHub、Email 連結</li>
                </ul>
                <p className="text-xs text-blue-600 mt-2 italic">例：「幫我新增候選人，以下是他的履歷：...」</p>
              </div>

              {/* 履歷分析評分 */}
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <p className="font-semibold text-purple-700 text-sm mb-2">📊 履歷分析評分（只需貼上履歷文字）</p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside ml-1">
                  <li>分析工作經歷，計算<strong>穩定度評分</strong>（20–100分）</li>
                  <li>從 6 大維度評定<strong>綜合評級</strong>（S / A+ / A / B / C）</li>
                  <li>推薦適合職缺，列出優劣勢分析</li>
                  <li>提取教育背景、技能、年資自動寫入系統</li>
                </ul>
                <p className="text-xs text-purple-600 mt-2 italic">例：「幫我分析這份履歷並評分，更新到系統」</p>
              </div>

              {/* 顧問人選追蹤 */}
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="font-semibold text-green-700 text-sm mb-2">🔄 顧問人選追蹤表 — 狀態更新</p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside ml-1">
                  <li>更新候選人進度：未開始 → 聯繫階段 → 面試階段 → Offer → on board</li>
                  <li>標記候選人為「婉拒」並記錄原因</li>
                  <li>自動記錄操作時間與操作者到日誌</li>
                </ul>
                <p className="text-xs text-green-600 mt-2 italic">例：「幫我把 #123 的狀態改為面試階段」</p>
              </div>

              {/* 備註紀錄 */}
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="font-semibold text-amber-700 text-sm mb-2">📝 備註紀錄</p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside ml-1">
                  <li>為候選人追加備註（自動附加時間戳記）</li>
                  <li>記錄每次溝通重點，方便日後查閱</li>
                </ul>
                <p className="text-xs text-amber-600 mt-2 italic">例：「幫 #456 加備註：今天電話聯繫，對方有意願」</p>
              </div>

              {/* 數據查詢 */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-semibold text-slate-700 text-sm mb-2">🔍 數據查詢</p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside ml-1">
                  <li>查詢特定顧問負責的全部候選人</li>
                  <li>查詢特定狀態的候選人清單</li>
                  <li>查看招募漏斗各階段人數統計</li>
                </ul>
                <p className="text-xs text-slate-500 mt-2 italic">例：「查詢 Jacky 負責的所有候選人」</p>
              </div>

            </div>
          </div>

          <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <p className="text-sm text-indigo-900">
              💡 <strong>操作者身份規則</strong>：AIbot 呼叫 API 時，<code className="bg-white px-1 rounded">actor</code> 欄位必須填入
              <code className="bg-white px-1 rounded ml-1">{'{顧問名稱}-aibot'}</code>，例如：
              <code className="bg-white px-1 rounded ml-1">Jacky-aibot</code>、
              <code className="bg-white px-1 rounded ml-1">Phoebe-aibot</code>。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">系統操作指南 URL</p>
              <code className="block bg-gray-100 rounded-lg px-3 py-2 text-xs text-indigo-700 break-all">
                {API_HOST}/api/guide
              </code>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">履歷分析教學 URL</p>
              <code className="block bg-gray-100 rounded-lg px-3 py-2 text-xs text-indigo-700 break-all">
                {API_HOST}/api/resume-guide
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* 評分 Bot 啟動指令 */}
      <div id="ScoringBot" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <Zap className="text-amber-500" size={24} />
          評分 Bot 啟動指令（openclaw 定時任務）
        </h2>
        <div className="space-y-4 text-slate-700">

          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-sm font-semibold text-amber-800 mb-1">🤖 適用對象</p>
            <p className="text-sm text-amber-700">
              給 <strong>openclaw</strong> 或其他本地 AI Agent 設定定時評分任務使用。
              與一般 AIbot 不同，評分 Bot 被觸發後會<strong>自動執行完整評分流程，不需人工下指令</strong>。
            </p>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">🔄 評分 Bot 執行流程</h3>
            <ol className="list-decimal list-inside space-y-2 ml-4 text-sm">
              <li>讀取評分執行指南（學習 API 結構與評分流程）</li>
              <li>呼叫 <code className="bg-gray-100 px-1">GET /api/candidates?created_today=true</code> 取得今日新增候選人</li>
              <li>篩選 status 為「未開始」或「爬蟲初篩」的候選人</li>
              <li>查詢對應職缺，取得人才畫像 / JD / 公司畫像</li>
              <li>五維度 AI 評分 → ≥ 70 分標為「AI推薦」，&lt; 70 分標為「備選人才」</li>
              <li>每評完一位立刻 PATCH 寫回系統，回報評分摘要</li>
            </ol>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-3 flex items-center gap-2">
              <Copy size={16} className="text-amber-500" />
              評分 Bot 啟動指令
              <span className="text-xs font-normal text-slate-500 ml-1">（複製後貼給 openclaw）</span>
            </h3>
            <div className="relative">
              <pre className="bg-slate-900 text-amber-300 text-sm rounded-xl p-4 whitespace-pre-wrap leading-relaxed font-mono overflow-x-auto">
{SCORING_BOT_PROMPT}
              </pre>
              <button
                onClick={handleCopyScoringPrompt}
                className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  copiedScoring
                    ? 'bg-green-500 text-white'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {copiedScoring ? <CheckCheck size={14} /> : <Copy size={14} />}
                {copiedScoring ? '已複製！' : '複製指令'}
              </button>
            </div>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">⚙️ 使用方式</h3>
            <p className="text-sm text-slate-700">
              將啟動指令複製貼給你的 AI 助理即可。建議每天下班前執行一次，評分新匯入的候選人。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">系統操作指南 URL</p>
              <code className="block bg-gray-100 rounded-lg px-3 py-2 text-xs text-indigo-700 break-all">
                {API_HOST}/api/guide
              </code>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">評分執行指南 URL</p>
              <code className="block bg-gray-100 rounded-lg px-3 py-2 text-xs text-amber-700 break-all">
                {API_HOST}/api/scoring-guide
              </code>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-700">
              ⏱️ <strong>執行方式</strong>：將啟動指令複製貼給 AI 助理（Claude / ChatGPT），Bot 會自動完成所有評分流程，無需人工介入。
            </p>
          </div>

        </div>
      </div>

      {/* 職缺匯入 Bot 啟動指令 */}
      <div id="JobImportBot" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <Download className="text-green-500" size={24} />
          職缺匯入 Bot 啟動指令
        </h2>
        <div className="space-y-4 text-slate-700">

          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm font-semibold text-green-800 mb-1">📥 適用場景</p>
            <p className="text-sm text-green-700">
              顧問提供 <strong>104 或 1111 職缺連結</strong>（或直接貼上 JD 文字），AI 自動：
            </p>
            <ul className="mt-2 space-y-1 text-sm text-green-700 ml-4 list-disc">
              <li>讀取頁面 → 提取職位、薪資、技能、JD 等所有欄位</li>
              <li>AI 自動生成公司畫像、人才畫像、爬蟲搜尋關鍵字</li>
              <li>一次呼叫 API 建立完整職缺記錄</li>
            </ul>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">🔄 匯入 Bot 執行流程</h3>
            <ol className="list-decimal list-inside space-y-2 ml-4 text-sm">
              <li>讀取職缺匯入指南（學習流程與 API 格式）</li>
              <li>Fetch 104 / 1111 頁面，提取所有結構化欄位</li>
              <li>AI 分析 JD → 生成公司畫像 / 人才畫像 / 搜尋關鍵字</li>
              <li>呼叫 <code className="bg-gray-100 px-1">POST /api/jobs</code>，一次寫入所有欄位</li>
              <li>回報職缺 ID、已填欄位、建議搜尋詞</li>
            </ol>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-3 flex items-center gap-2">
              <Copy size={16} className="text-green-500" />
              職缺匯入 Bot 啟動指令
              <span className="text-xs font-normal text-slate-500 ml-1">（複製後貼給你的 AI，把名字和連結換掉）</span>
            </h3>
            <div className="relative">
              <pre className="bg-slate-900 text-green-300 text-sm rounded-xl p-4 whitespace-pre-wrap leading-relaxed font-mono overflow-x-auto">
{JOB_IMPORT_PROMPT}
              </pre>
              <button
                onClick={handleCopyImportPrompt}
                className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  copiedImport
                    ? 'bg-green-500 text-white'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {copiedImport ? <CheckCheck size={14} /> : <Copy size={14} />}
                {copiedImport ? '已複製！' : '複製指令'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">職缺匯入指南 URL</p>
              <code className="block bg-gray-100 rounded-lg px-3 py-2 text-xs text-green-700 break-all">
                {API_HOST}/api/jobs-import-guide
              </code>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">職缺新增 API</p>
              <code className="block bg-gray-100 rounded-lg px-3 py-2 text-xs text-green-700 break-all">
                POST {API_HOST}/api/jobs
              </code>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-700">
              💡 <strong>支援的欄位</strong>：職位名稱、公司、部門、薪資、地點、年資、技能、JD、
              公司畫像、人才畫像、搜尋關鍵字（主要/次要）、福利、遠端政策、面試流程、顧問備註…共 <strong>30+ 欄位</strong>一次寫入。
            </p>
          </div>

        </div>
      </div>

      {/* 履歷匯入 + 即時評分 Bot */}
      <div id="ResumeImportBot" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <FileText className="text-rose-500" size={24} />
          履歷匯入 + 即時評分 Bot
        </h2>
        <div className="space-y-5 text-slate-700">

          {/* 功能說明 */}
          <div>
            <h3 className="font-black text-slate-900 mb-2">📋 功能說明</h3>
            <p className="mb-3">
              顧問只需把候選人的<strong>履歷文字</strong>與<strong>目標職缺名稱</strong>貼給 AI，Bot 就會自動完成
              「解析 → 建檔 → 評分 → 寫回系統」的完整流程，全程無需手動填表，<strong>一個指令跑完所有步驟</strong>。
            </p>
            <div className="p-4 bg-rose-50 rounded-lg border border-rose-200">
              <p className="text-sm font-semibold text-rose-800 mb-2">✅ 你只需要準備：</p>
              <ul className="text-sm text-rose-700 space-y-1 list-disc list-inside ml-2">
                <li>候選人的履歷文字（直接貼上即可，不需整理格式）</li>
                <li>目標職缺名稱（例：Java Developer、後端工程師）</li>
              </ul>
            </div>
          </div>

          {/* 顧問操作步驟 */}
          <div>
            <h3 className="font-black text-slate-900 mb-2">🚀 顧問操作步驟</h3>
            <ol className="list-decimal list-inside space-y-2 ml-4 text-sm">
              <li>開啟你的 AI 助理（Claude / ChatGPT 等）</li>
              <li>複製下方「啟動指令」，把 <code className="bg-gray-100 px-1">{'{顧問名稱}'}</code>、職缺名稱、履歷文字填入</li>
              <li>貼到對話框送出，等待 Bot 完成所有步驟</li>
              <li>Bot 完成後會回報候選人 ID、穩定性評分、五維度得分及建議探詢問題</li>
              <li>前往系統「候選人總表」即可看到完整評分結果</li>
            </ol>
          </div>

          {/* Bot 能做的事 */}
          <div>
            <h3 className="font-black text-slate-900 mb-3">🤖 Bot 可以幫你做的事</h3>
            <div className="space-y-3">

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-semibold text-blue-700 text-sm mb-2">📄 履歷解析 → 自動建檔</p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside ml-1">
                  <li>萃取姓名、聯絡資訊、學歷、工作經歷、技能、語言等所有欄位</li>
                  <li>呼叫 API 建立候選人記錄（同名候選人自動去重、補全空白欄位）</li>
                  <li>LinkedIn / GitHub 連結自動寫入系統</li>
                </ul>
                <p className="text-xs text-blue-600 mt-2 italic">不論履歷格式為何，Bot 都能解析純文字內容</p>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <p className="font-semibold text-purple-700 text-sm mb-2">📊 穩定性評分（滿分 100）</p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside ml-1">
                  <li><strong>平均在職年資</strong>（50 分）：每份工作平均待多久</li>
                  <li><strong>換工作頻率</strong>（30 分）：每年平均換工作次數</li>
                  <li><strong>近期空窗期</strong>（20 分）：最近一份工作到現在的空白時間</li>
                </ul>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-semibold">85–100 → S 級</span>
                  <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-semibold">75–84 → A+ 級</span>
                  <span className="bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-semibold">65–74 → A 級</span>
                  <span className="bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full font-semibold">55–64 → B 級</span>
                  <span className="bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-semibold">54 以下 → C 級</span>
                </div>
              </div>

              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="font-semibold text-emerald-700 text-sm mb-2">🎯 五維度 AI 配對評分</p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside ml-1">
                  <li><strong>人才畫像符合度</strong>：與目標職缺人才畫像的吻合程度</li>
                  <li><strong>JD 技能匹配</strong>：必要技能與加分技能的覆蓋率</li>
                  <li><strong>公司文化適配</strong>：工作風格與公司文化的契合度</li>
                  <li><strong>可觸達性</strong>：聯絡方式是否完整、是否在職</li>
                  <li><strong>活躍信號</strong>：GitHub / LinkedIn 近期活躍程度</li>
                </ul>
                <p className="text-xs text-emerald-600 mt-2 italic">評分結果自動寫入系統 ai_match_result 欄位</p>
              </div>

              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="font-semibold text-amber-700 text-sm mb-2">💬 回報完整評估報告</p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside ml-1">
                  <li>優勢分析（matched_skills）、缺口技能（missing_skills）</li>
                  <li>推薦等級與推薦理由</li>
                  <li>3–5 個客製化探詢問題（開場問法建議）</li>
                  <li>候選人系統 ID，方便後續追蹤</li>
                </ul>
                <p className="text-xs text-amber-600 mt-2 italic">例：「推薦指數 82 / 100，具備 8 年 Java 經驗，缺 Kubernetes 實務」</p>
              </div>

            </div>
          </div>

          {/* 啟動指令 */}
          <div>
            <h3 className="font-black text-slate-900 mb-3 flex items-center gap-2">
              <Copy size={16} className="text-rose-500" />
              履歷匯入 Bot 啟動指令
              <span className="text-xs font-normal text-slate-500 ml-1">（複製後貼給你的 AI，把名字和履歷換掉）</span>
            </h3>
            <div className="relative">
              <pre className="bg-slate-900 text-rose-300 text-sm rounded-xl p-4 whitespace-pre-wrap leading-relaxed font-mono overflow-x-auto">
{RESUME_IMPORT_PROMPT}
              </pre>
              <button
                onClick={handleCopyResumePrompt}
                className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  copiedResume
                    ? 'bg-rose-500 text-white'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {copiedResume ? <CheckCheck size={14} /> : <Copy size={14} />}
                {copiedResume ? '已複製！' : '複製指令'}
              </button>
            </div>
          </div>

          {/* API URL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">履歷匯入指南 URL</p>
              <code className="block bg-gray-100 rounded-lg px-3 py-2 text-xs text-rose-700 break-all">
                {API_HOST}/api/resume-import-guide
              </code>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">候選人新增 / 更新 API</p>
              <code className="block bg-gray-100 rounded-lg px-3 py-2 text-xs text-rose-700 break-all">
                POST / PATCH {API_HOST}/api/candidates
              </code>
            </div>
          </div>

        </div>
      </div>

      {/* GitHub 分析 Bot 啟動指令 */}
      <div id="GithubAnalysisBot" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <Target className="text-cyan-500" size={24} />
          GitHub 深度分析 Bot 啟動指令
        </h2>
        <div className="space-y-4 text-slate-700">

          <div className="p-4 bg-cyan-50 rounded-xl border border-cyan-200">
            <p className="text-sm font-semibold text-cyan-800 mb-1">🔬 適用場景</p>
            <p className="text-sm text-cyan-700">
              對有 GitHub 連結的候選人進行<strong>四維度深度技術分析</strong>，由 AI 判斷技術能力與職缺的匹配程度。
              與評分 Bot 不同，GitHub 分析 Bot 專注在<strong>程式碼品質、技術棧匹配、開發活躍度</strong>的深度評估。
            </p>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">🔄 分析 Bot 執行流程</h3>
            <ol className="list-decimal list-inside space-y-2 ml-4 text-sm">
              <li>呼叫 <code className="bg-gray-100 px-1">GET /api/candidates?limit=2000</code> 取得有 GitHub URL 的候選人</li>
              <li>呼叫 <code className="bg-gray-100 px-1">GET /api/github/analyze/{'{username}'}?jobId={'{id}'}</code> 取得結構化分析資料</li>
              <li>AI 深度判斷四維度分數 → 撰寫分析報告</li>
              <li>每分析完一位立刻 <code className="bg-gray-100 px-1">PATCH /api/candidates/{'{id}'}</code> 寫回系統</li>
              <li>回報分析摘要與 TOP 3 技術人才</li>
            </ol>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-3">📊 四維度評分標準</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-semibold text-blue-700 text-sm">🎯 技能匹配（40%）</p>
                <p className="text-xs text-slate-600 mt-1">
                  Repo 語言、Topics、名稱語意 vs 職缺 key_skills。
                  不只看關鍵字，AI 會判斷 repo 內容是否真正相關。
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <p className="font-semibold text-purple-700 text-sm">📦 專案品質（30%）</p>
                <p className="text-xs text-slate-600 mt-1">
                  原創 vs Fork 比例、Star 數量、Repo 實質內容、文檔完整度。
                </p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="font-semibold text-amber-700 text-sm">⚡ 活躍度（20%）</p>
                <p className="text-xs text-slate-600 mt-1">
                  近 6 個月活躍月數、最後 commit 時間、持續開發 vs 偶爾更新。
                </p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="font-semibold text-emerald-700 text-sm">🌟 影響力（10%）</p>
                <p className="text-xs text-slate-600 mt-1">
                  Followers、Total Stars。作為加分項，不會因低分大幅扣分。
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="bg-cyan-200 text-cyan-800 px-2 py-0.5 rounded-full font-semibold">90-100 → S 強力推薦</span>
              <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-semibold">80-89 → A+ 強力推薦</span>
              <span className="bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-semibold">70-79 → A 推薦</span>
              <span className="bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full font-semibold">60-69 → B 觀望</span>
              <span className="bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-semibold">60 以下 → C 不推薦</span>
            </div>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-3 flex items-center gap-2">
              <Copy size={16} className="text-cyan-500" />
              GitHub 分析 Bot 啟動指令
              <span className="text-xs font-normal text-slate-500 ml-1">（複製後貼給 openclaw）</span>
            </h3>
            <div className="relative">
              <pre className="bg-slate-900 text-cyan-300 text-sm rounded-xl p-4 whitespace-pre-wrap leading-relaxed font-mono overflow-x-auto">
{GITHUB_ANALYSIS_BOT_PROMPT}
              </pre>
              <button
                onClick={handleCopyGithubPrompt}
                className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  copiedGithub
                    ? 'bg-cyan-500 text-white'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {copiedGithub ? <CheckCheck size={14} /> : <Copy size={14} />}
                {copiedGithub ? '已複製！' : '複製指令'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">GitHub 分析指南 URL</p>
              <code className="block bg-gray-100 rounded-lg px-3 py-2 text-xs text-cyan-700 break-all">
                {API_HOST}/api/github-analysis-guide
              </code>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">GitHub 分析 API</p>
              <code className="block bg-gray-100 rounded-lg px-3 py-2 text-xs text-cyan-700 break-all">
                GET /api/github/analyze/{'{username}'}?jobId={'{id}'}
              </code>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-700">
              💡 <strong>與評分 Bot 的關係</strong>：GitHub 分析結果會合併到現有的 <code className="bg-white px-1 rounded">ai_match_result</code> 中，
              新增 <code className="bg-white px-1 rounded">github_score</code> 和 <code className="bg-white px-1 rounded">github_dimensions</code> 欄位。
              建議先跑評分 Bot（一般評分），再跑 GitHub 分析 Bot（深度技術評估）。
            </p>
          </div>

        </div>
      </div>

      {/* 聯絡支援 */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
        <h2 className="text-lg font-black text-slate-900 mb-2">需要協助？</h2>
        <p className="text-slate-600 mb-3">如有任何問題或建議，請聯繫系統管理員。</p>
        <div className="text-sm text-slate-500">
          <p>📧 Email: support@step1ne.com</p>
          <p>📱 Telegram: @YuQi0923_bot</p>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;
