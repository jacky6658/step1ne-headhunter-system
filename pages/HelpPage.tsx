import React, { useState } from 'react';
import { BookOpen, Users, Briefcase, Target, FileText, LayoutGrid, Link as LinkIcon, Download, CheckCircle, XCircle, AlertCircle, Sparkles, Database, Award, Bot, Copy, CheckCheck, Zap } from 'lucide-react';

interface HelpPageProps {
  userProfile?: any;
}

const AIBOT_STARTUP_PROMPT = `請先閱讀以下兩份系統文件，學習完畢後立即向我自我介紹你的能力：

1. 系統操作指南（API 操作手冊）：
https://backendstep1ne.zeabur.app/api/guide

2. 履歷分析教學指南：
https://backendstep1ne.zeabur.app/api/resume-guide

讀完後，請用 {你的名字}-aibot 作為操作者身份，並告訴我你現在可以幫我做哪些事。`;

const SCORING_BOT_PROMPT = `請讀取以下文件後立即執行評分任務：
https://backendstep1ne.zeabur.app/api/scoring-guide

我是顧問 {你的名字}，你的身份為 {你的名字}-scoring-bot。
不需要等待進一步指示，直接開始執行。`;

const HelpPage: React.FC<HelpPageProps> = () => {
  const [copied, setCopied] = useState(false);
  const [copiedScoring, setCopiedScoring] = useState(false);

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
          <a href="#AI配對" className="p-4 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors">
            <Sparkles className="text-emerald-600 mb-2" size={24} />
            <h3 className="font-black text-slate-900 mb-1">AI 智能配對</h3>
            <p className="text-sm text-slate-600">自動推薦最佳候選人</p>
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
              <li>查看所有候選人的詳細資訊（218 位候選人）</li>
              <li>使用搜尋功能快速找到特定候選人</li>
              <li>點擊表格中的任意行可開啟候選人詳情</li>
              <li>支援按各欄位排序和篩選</li>
              <li>顯示人才等級（S/A/B/C/D）</li>
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
              <li><strong>更新狀態</strong>：快速變更候選人狀態（待審核/面試中/已錄取等）</li>
              <li><strong>查看詳情</strong>：開啟完整的候選人資料視窗</li>
            </ul>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">
              <Award className="inline mr-2 text-indigo-600" size={18} />
              人才等級評分
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <span className="font-black text-purple-700">S 級</span>
                <p className="text-xs text-slate-600 mt-1">卓越人才，立即推薦</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="font-black text-blue-700">A 級</span>
                <p className="text-xs text-slate-600 mt-1">優秀人才，優先推薦</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <span className="font-black text-green-700">B 級</span>
                <p className="text-xs text-slate-600 mt-1">合格人才，符合基本要求</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <span className="font-black text-amber-700">C 級</span>
                <p className="text-xs text-slate-600 mt-1">待觀察，需進一步評估</p>
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

      {/* AI 智能配對 - 智慧人才搜尋系統 */}
      <div id="AI配對" className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl shadow-sm border border-emerald-200 p-6">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <Sparkles className="text-emerald-600" size={24} />
          🚀 智慧人才搜尋系統 - AI 自動配對
        </h2>
        
        <div className="space-y-6 text-slate-700">
          {/* 概述 */}
          <div className="bg-white rounded-xl p-4 border border-emerald-200">
            <h3 className="font-black text-emerald-700 mb-2">🎯 系統概述</h3>
            <p className="text-sm mb-3">全自動化人才搜尋系統，一個命令自動：搜尋候選人（GitHub + LinkedIn）→ AI 評分 → 自動分類 → 上傳系統。</p>
            <div className="bg-emerald-100 text-emerald-700 text-xs rounded-lg p-2 font-mono">
              python3 /Users/user/clawd/hr-tools/talent_sourcing_pipeline.py --job-id 51 --execute
            </div>
          </div>

          {/* 5 階段流程 */}
          <div>
            <h3 className="font-black text-slate-900 mb-3">📊 完整 5 階段流程</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                <div className="font-black text-blue-700 text-lg mb-1">1️⃣</div>
                <p className="text-xs font-semibold text-slate-700">JD 分析</p>
                <p className="text-xs text-slate-500 mt-1">分解職缺</p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 text-center">
                <div className="font-black text-indigo-700 text-lg mb-1">2️⃣</div>
                <p className="text-xs font-semibold text-slate-700">雙管道搜尋</p>
                <p className="text-xs text-slate-500 mt-1">GitHub + LinkedIn</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-center">
                <div className="font-black text-purple-700 text-lg mb-1">3️⃣</div>
                <p className="text-xs font-semibold text-slate-700">智慧去重</p>
                <p className="text-xs text-slate-500 mt-1">自動回退</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
                <div className="font-black text-amber-700 text-lg mb-1">4️⃣</div>
                <p className="text-xs font-semibold text-slate-700">AI 評分</p>
                <p className="text-xs text-slate-500 mt-1">6 維度</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
                <div className="font-black text-emerald-700 text-lg mb-1">5️⃣</div>
                <p className="text-xs font-semibold text-slate-700">批量上傳</p>
                <p className="text-xs text-slate-500 mt-1">自動分類</p>
              </div>
            </div>
          </div>

          {/* AI 評分等級 */}
          <div>
            <h3 className="font-black text-slate-900 mb-3">⭐ AI 評分等級與狀態</h3>
            <div className="space-y-2">
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="flex justify-between items-center">
                  <span className="font-black text-red-700">🎯 S 級（95+）</span>
                  <span className="text-xs bg-red-200 text-red-800 rounded px-2 py-1 font-bold">AI推薦</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">完美契合，立即聯繫</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex justify-between items-center">
                  <span className="font-black text-orange-700">⭐⭐ A+ 級（90-94）</span>
                  <span className="text-xs bg-orange-200 text-orange-800 rounded px-2 py-1 font-bold">AI推薦</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">高度契合</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex justify-between items-center">
                  <span className="font-black text-yellow-700">⭐ A 級（80-89）</span>
                  <span className="text-xs bg-yellow-200 text-yellow-800 rounded px-2 py-1 font-bold">AI推薦</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">符合要求</p>
              </div>
              <div className="p-3 bg-lime-50 rounded-lg border border-lime-200">
                <div className="flex justify-between items-center">
                  <span className="font-black text-lime-700">🔶 B 級（70-79）</span>
                  <span className="text-xs bg-lime-200 text-lime-800 rounded px-2 py-1 font-bold">AI推薦</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">可接受</p>
              </div>
              <div className="p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                <div className="flex justify-between items-center">
                  <span className="font-black text-cyan-700">⚪ C 級（60-69）</span>
                  <span className="text-xs bg-cyan-200 text-cyan-800 rounded px-2 py-1 font-bold">備選人才</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">有潛力</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="font-black text-slate-700">❌ D 級（&lt;60）</span>
                  <span className="text-xs bg-slate-200 text-slate-800 rounded px-2 py-1 font-bold">備選人才</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">低優先</p>
              </div>
            </div>
          </div>

          {/* 6 維度評分 */}
          <div>
            <h3 className="font-black text-slate-900 mb-3">🔬 AI 評分 6 維度</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="font-black text-blue-700">技能匹配（35%）</span>
                <p className="text-xs text-slate-600 mt-1">核心技能符合 + 進階技能加分</p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <span className="font-black text-indigo-700">工作經驗（25%）</span>
                <p className="text-xs text-slate-600 mt-1">相關產業年資 + 層級匹配</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <span className="font-black text-purple-700">產業適配（20%）</span>
                <p className="text-xs text-slate-600 mt-1">文化相似度 + 發展階段</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <span className="font-black text-amber-700">成長信號（10%）</span>
                <p className="text-xs text-slate-600 mt-1">GitHub 提交頻率 + 學習主動性</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="font-black text-emerald-700">文化契合（5%）</span>
                <p className="text-xs text-slate-600 mt-1">工作地點 + 遠端意願</p>
              </div>
              <div className="p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                <span className="font-black text-cyan-700">可觸達性（5%）</span>
                <p className="text-xs text-slate-600 mt-1">LinkedIn 活躍度 + 聯繫方式</p>
              </div>
            </div>
          </div>

          {/* 給新 AI 的提示詞 */}
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
            <h3 className="font-black text-white mb-3 flex items-center gap-2">
              <Bot size={18} className="text-emerald-400" />
              給新 AI 助理的提示詞（複製使用）
            </h3>
            <div className="bg-slate-800 rounded-lg p-3 mb-3">
              <p className="text-xs text-slate-300 mb-2 font-mono">📋 場景：你是 Step1ne 系統的智慧人才搜尋引擎</p>
              <pre className="text-xs text-emerald-300 font-mono whitespace-pre-wrap break-words leading-relaxed">
{`你是 Step1ne 系統的 AI 智能配對引擎。

📚 必讀文檔：
• 系統完整說明：/Users/user/clawd/hr-tools/TALENT_SOURCING_SYSTEM.md
• API 操作指南：https://backendstep1ne.zeabur.app/api/guide

🎯 你的目標：
1. 分析職缺需求（公司 + 職位 + 人才畫像）
2. 自動搜尋候選人（GitHub + LinkedIn Google）
3. 去重 + 智慧回退（如果 0 人則放寬條件）
4. AI 評分（6 維度，0-100 分）
5. 自動分類（B+ → AI推薦，C/D → 備選人才）
6. 批量上傳系統

⚡ 快速命令：
# 先分析（不搜尋）
python3 /Users/user/clawd/hr-tools/talent_sourcing_pipeline.py --job-id {JOB_ID} --dry-run

# 完整執行
python3 /Users/user/clawd/hr-tools/talent_sourcing_pipeline.py --job-id {JOB_ID} --execute

✅ 成功標準：
- 找到 15+ 位候選人
- A-B 級佔 60%+
- 0 個上傳失敗`}
              </pre>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`你是 Step1ne 系統的 AI 智能配對引擎。

📚 必讀文檔：
• 系統完整說明：/Users/user/clawd/hr-tools/TALENT_SOURCING_SYSTEM.md
• API 操作指南：https://backendstep1ne.zeabur.app/api/guide

🎯 你的目標：
1. 分析職缺需求（公司 + 職位 + 人才畫像）
2. 自動搜尋候選人（GitHub + LinkedIn Google）
3. 去重 + 智慧回退（如果 0 人則放寬條件）
4. AI 評分（6 維度，0-100 分）
5. 自動分類（B+ → AI推薦，C/D → 備選人才）
6. 批量上傳系統

⚡ 快速命令：
# 先分析（不搜尋）
python3 /Users/user/clawd/hr-tools/talent_sourcing_pipeline.py --job-id {JOB_ID} --dry-run

# 完整執行
python3 /Users/user/clawd/hr-tools/talent_sourcing_pipeline.py --job-id {JOB_ID} --execute

✅ 成功標準：
- 找到 15+ 位候選人
- A-B 級佔 60%+
- 0 個上傳失敗`);
                alert('✅ 已複製到剪貼板！');
              }}
              className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg transition-colors"
            >
              📋 複製提示詞
            </button>
          </div>

          {/* 系統文檔 */}
          <div>
            <h3 className="font-black text-slate-900 mb-3">📚 完整文檔位置</h3>
            <div className="p-4 bg-white rounded-lg border border-slate-200">
              <p className="text-xs font-mono text-indigo-600 mb-2">
                /Users/user/clawd/hr-tools/TALENT_SOURCING_SYSTEM.md
              </p>
              <p className="text-sm text-slate-700">包含：系統流程、參數配置、反爬蟲防禦、API 上傳格式、效能指標、常見問題</p>
            </div>
          </div>

          {/* 運行模式 */}
          <div>
            <h3 className="font-black text-slate-900 mb-3">🎮 3 種運行模式</h3>
            <div className="space-y-2">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-black text-blue-700 text-sm">DRY-RUN（分析模式）</p>
                <p className="text-xs font-mono text-slate-600 mt-1">--dry-run</p>
                <p className="text-xs text-slate-600 mt-1">只分析 JD，不執行搜尋（查看策略）</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="font-black text-emerald-700 text-sm">EXECUTE（完整執行）</p>
                <p className="text-xs font-mono text-slate-600 mt-1">--execute</p>
                <p className="text-xs text-slate-600 mt-1">搜尋 + 評分 + 上傳（真實爬蟲）</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="font-black text-amber-700 text-sm">TEST（測試回退）</p>
                <p className="text-xs font-mono text-slate-600 mt-1">--execute --test-zero-dedup</p>
                <p className="text-xs text-slate-600 mt-1">驗證智慧回退邏輯</p>
              </div>
            </div>
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

      {/* 候選人看板 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <LayoutGrid className="text-purple-600" size={24} />
          候選人流程看板
        </h2>
        <div className="space-y-4 text-slate-700">
          <div>
            <h3 className="font-black text-slate-900 mb-2">📊 功能說明</h3>
            <p className="mb-3">流程看板以視覺化的方式展示候選人在招聘流程中的進度，讓您一目了然地掌握所有候選人的狀態。</p>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">🔄 招聘流程狀態</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <span className="font-black text-amber-700">待審核</span>
                <p className="text-xs text-slate-600 mt-1">新候選人，等待初步評估</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="font-black text-blue-700">已聯繫</span>
                <p className="text-xs text-slate-600 mt-1">已與候選人建立聯繫</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <span className="font-black text-purple-700">面試中</span>
                <p className="text-xs text-slate-600 mt-1">正在進行面試流程</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="font-black text-emerald-700">已錄取</span>
                <p className="text-xs text-slate-600 mt-1">候選人已收到 offer</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <span className="font-black text-green-700">已到職</span>
                <p className="text-xs text-slate-600 mt-1">候選人已正式入職</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <span className="font-black text-red-700">已拒絕</span>
                <p className="text-xs text-slate-600 mt-1">候選人婉拒 offer</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">🖱️ 操作方式</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>拖放移動</strong>：直接拖動候選人卡片到不同狀態欄位</li>
              <li><strong>點擊查看</strong>：點擊候選人卡片可開啟詳細資訊</li>
              <li><strong>快速評級</strong>：在卡片上直接查看人才等級</li>
            </ul>
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
            <p className="mb-3">系統提供完整的 REST API，支援候選人和職缺的新增、修改、刪除功能。</p>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">📡 可用端點</h3>
            <div className="space-y-3">
              <div>
                <p className="font-black text-slate-900 mb-1">Candidates（候選人）</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                  <li><code className="bg-gray-100 px-1">POST /api/candidates</code> - 新增候選人</li>
                  <li><code className="bg-gray-100 px-1">GET /api/candidates</code> - 取得候選人列表</li>
                  <li><code className="bg-gray-100 px-1">GET /api/candidates/:id</code> - 取得單一候選人</li>
                  <li><code className="bg-gray-100 px-1">PUT /api/candidates/:id</code> - 更新候選人</li>
                  <li><code className="bg-gray-100 px-1">DELETE /api/candidates/:id</code> - 刪除候選人（軟刪除）</li>
                  <li><code className="bg-gray-100 px-1">PUT /api/candidates/:id/status</code> - 更新狀態</li>
                  <li><code className="bg-gray-100 px-1">POST /api/candidates/:id/anonymous-resume</code> - 生成匿名履歷</li>
                </ul>
              </div>
              <div>
                <p className="font-black text-slate-900 mb-1">Jobs（職缺）</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                  <li><code className="bg-gray-100 px-1">POST /api/jobs</code> - 新增職缺</li>
                  <li><code className="bg-gray-100 px-1">GET /api/jobs</code> - 取得職缺列表</li>
                  <li><code className="bg-gray-100 px-1">GET /api/jobs/:id</code> - 取得單一職缺</li>
                  <li><code className="bg-gray-100 px-1">PUT /api/jobs/:id</code> - 更新職缺</li>
                  <li><code className="bg-gray-100 px-1">DELETE /api/jobs/:id</code> - 刪除職缺</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-700">
              📚 <strong>詳細 API 文檔</strong>：請參閱 <code className="bg-gray-100 px-1">docs/API.md</code>
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
              <strong>A:</strong> 在候選人總表中點擊候選人行，或在流程看板中點擊候選人卡片，即可開啟編輯視窗。
            </p>
          </div>
          <div>
            <h3 className="font-black text-slate-900 mb-2">Q: 人才等級是如何計算的？</h3>
            <p className="text-slate-700">
              <strong>A:</strong> 人才等級由 6 個維度綜合評估：技能匹配（25%）、年資經歷（25%）、成長潛力（20%）、穩定度（15%）、學歷背景（10%）、特殊加分（5%）。
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
                  <li>更新候選人進度：未開始 → 已聯繫 → 已面試 → Offer → 已上職</li>
                  <li>標記候選人為「婉拒」並記錄原因</li>
                  <li>自動記錄操作時間與操作者到日誌</li>
                </ul>
                <p className="text-xs text-green-600 mt-2 italic">例：「幫我把 #123 的狀態改為已面試」</p>
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
                https://backendstep1ne.zeabur.app/api/guide
              </code>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">履歷分析教學 URL</p>
              <code className="block bg-gray-100 rounded-lg px-3 py-2 text-xs text-indigo-700 break-all">
                https://backendstep1ne.zeabur.app/api/resume-guide
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
              <li>讀取系統操作指南 + 評分執行指南（學習 API 結構與評分流程）</li>
              <li>呼叫 <code className="bg-gray-100 px-1">GET /api/candidates?status=未開始</code> 確認今日新增人數</li>
              <li>若有候選人 → 在本機執行 <code className="bg-gray-100 px-1">python3 one-bot-pipeline.py --mode score</code></li>
              <li>Playwright 開啟每位候選人的 GitHub / LinkedIn 真實頁面讀取資料</li>
              <li>6 維確定性評分 → ≥ 80 分進 AI推薦欄，&lt; 80 分進備選人才欄</li>
              <li>結果記錄到系統日誌，任務完成</li>
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
            <h3 className="font-black text-slate-900 mb-2">⚙️ 定時任務設定建議</h3>
            <div className="bg-slate-800 rounded-xl p-4 text-sm font-mono">
              <p className="text-slate-400 text-xs mb-2"># 每天凌晨 2 點自動執行評分（候選人通常在白天匯入）</p>
              <p className="text-green-400">0 2 * * * openclaw run --prompt scoring-bot.txt</p>
              <p className="text-slate-500 text-xs mt-3"># 或依你的 openclaw 排程語法調整</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">系統操作指南 URL</p>
              <code className="block bg-gray-100 rounded-lg px-3 py-2 text-xs text-indigo-700 break-all">
                https://backendstep1ne.zeabur.app/api/guide
              </code>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">評分執行指南 URL</p>
              <code className="block bg-gray-100 rounded-lg px-3 py-2 text-xs text-amber-700 break-all">
                https://backendstep1ne.zeabur.app/api/scoring-guide
              </code>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-700">
              ⏱️ <strong>執行時間預估</strong>：10 位候選人約需 <strong>5–8 分鐘</strong>（每位候選人間隔 10–20 秒反爬蟲停頓）。
              若不需 Playwright 讀頁面可加 <code className="bg-white px-1 rounded">--no-profile-read</code> 縮短至約 1 分鐘。
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
