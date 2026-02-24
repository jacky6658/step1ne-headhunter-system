import React from 'react';
import { BookOpen, Users, Briefcase, Target, FileText, LayoutGrid, Link as LinkIcon, Download, CheckCircle, XCircle, AlertCircle, Sparkles, Database, Award } from 'lucide-react';

interface HelpPageProps {
  userProfile?: any;
}

const HelpPage: React.FC<HelpPageProps> = () => {
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* AI 智能配對 */}
      <div id="AI配對" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <Sparkles className="text-emerald-600" size={24} />
          AI 智能配對
        </h2>
        <div className="space-y-4 text-slate-700">
          <div>
            <h3 className="font-black text-slate-900 mb-2">🤖 功能說明</h3>
            <p className="mb-3">AI 配對系統使用先進的演算法，自動分析候選人與職缺的匹配度，並提供詳細的推薦報告。</p>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">🎯 配對流程</h3>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li><strong>選擇職缺</strong>：從職缺清單中選擇要配對的職位</li>
              <li><strong>選擇候選人</strong>：勾選要參與配對的候選人（建議 5-30 位）</li>
              <li><strong>執行配對</strong>：點擊「開始 AI 配對」按鈕</li>
              <li><strong>查看結果</strong>：系統會自動生成配對報告</li>
            </ol>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">📊 配對維度（4 大面向）</h3>
            <div className="space-y-2 mt-2">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="font-black text-blue-700">技能匹配（35%）</span>
                <p className="text-xs text-slate-600 mt-1">評估候選人技能與職缺要求的契合度</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <span className="font-black text-green-700">成長匹配（25%）</span>
                <p className="text-xs text-slate-600 mt-1">評估候選人的學習能力和發展潛力</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <span className="font-black text-purple-700">文化匹配（25%）</span>
                <p className="text-xs text-slate-600 mt-1">評估候選人與公司文化的適配度</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <span className="font-black text-amber-700">動機匹配（15%）</span>
                <p className="text-xs text-slate-600 mt-1">評估候選人的轉職動機與職缺的吸引力</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">🏆 推薦優先級</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="font-black text-emerald-700">P0 必推</span>
                <p className="text-xs text-slate-600 mt-1">80 分以上，S/A 級人才</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="font-black text-blue-700">P1 優先</span>
                <p className="text-xs text-slate-600 mt-1">70-79 分，B 級人才</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <span className="font-black text-amber-700">P2 備選</span>
                <p className="text-xs text-slate-600 mt-1">60-69 分，C 級人才</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">📄 配對報告內容</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>總分與等級</strong>：0-100 分評分與 S/A/B/C/D 等級</li>
              <li><strong>維度評分</strong>：4 大維度的詳細分數</li>
              <li><strong>適配亮點</strong>：候選人的優勢與特色</li>
              <li><strong>風險提示</strong>：需要注意的潛在問題</li>
              <li><strong>面試建議</strong>：面試重點與評估要點</li>
              <li><strong>薪資策略</strong>：建議的薪資範圍</li>
              <li><strong>留任策略</strong>：如何提高錄取接受率</li>
            </ul>
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
