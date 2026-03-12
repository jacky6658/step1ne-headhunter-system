import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Users, Briefcase, Target, Phone, MessageSquare, Award, CheckCircle2, XCircle, Archive, Bot, Zap, ArrowRight, AlertCircle } from 'lucide-react';

interface SOPGuidePageProps {
  userProfile?: any;
}

// ── 階段資料定義 ──────────────────────────────────────────
interface StageInfo {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  sla: string;
  description: string;
  howToEnter: string[];
  whatToDo: string[];
  tips: string[];
  nextStage: string;
}

const PIPELINE_STAGES: StageInfo[] = [
  {
    id: 'today-new',
    name: '今日新增',
    icon: <Zap className="w-5 h-5" />,
    color: 'text-sky-700',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    sla: '即時',
    description: '今天由顧問手動匯入、AI Bot 自動匯入、或爬蟲自動新增的候選人。系統依據 createdAt 日期自動判斷，不是一個實際的 status 值。',
    howToEnter: [
      '手動新增候選人（候選人總表 → 新增）',
      'AIbot 透過 API 自動匯入（POST /api/candidates）',
      '爬蟲自動匯入',
      'PDF 履歷上傳解析後匯入',
    ],
    whatToDo: [
      '確認候選人資料是否完整（姓名、技能、聯絡方式）',
      '指派負責顧問（若尚未指派）',
      '指定目標職缺',
      '等待 AI 評分（Scoring Bot）或手動評分',
    ],
    tips: [
      '候選人匯入後會自動出現在此欄，隔天就會消失',
      '建議每天上班時先看「今日新增」，掌握新進案件',
    ],
    nextStage: '未開始 或 AI推薦（視評分結果）',
  },
  {
    id: 'not-started',
    name: '未開始',
    icon: <AlertCircle className="w-5 h-5" />,
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    sla: '2 天',
    description: '匯入系統但尚未被顧問處理的候選人。這是所有新候選人的預設初始狀態。',
    howToEnter: [
      '新匯入的候選人預設狀態',
      'AI 評分為 B/C 級但顧問認為值得跟進',
    ],
    whatToDo: [
      '查看候選人基本資料與技能',
      '確認是否有指派目標職缺',
      '判斷是否值得聯繫 → 移到「聯繫階段」',
      '若不適合 → 移到「備選人才」',
    ],
    tips: [
      '停留超過 2 天 SLA 會顯示逾期警示',
      '建議每天清理「未開始」欄位，避免案件堆積',
    ],
    nextStage: '聯繫階段',
  },
  {
    id: 'ai-recommended',
    name: 'AI推薦',
    icon: <Bot className="w-5 h-5" />,
    color: 'text-violet-700',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    sla: '3 天',
    description: 'AI Scoring Bot 評分後，綜合分數 ≥ 70 分（A 級以上）自動推薦的候選人。這些人才經 AI 判斷與目標職缺高度匹配。',
    howToEnter: [
      'AI Scoring Bot 評分完成，評級為 S / A+ / A',
      'AI 配對評分 ≥ 70 分',
    ],
    whatToDo: [
      '優先查看 AI 匹配結語（人選卡片 → AI 匹配結語 tab）',
      '閱讀 AI 的優勢分析與建議詢問問題',
      '確認匹配度合理後 → 開始聯繫人選',
      '若 AI 判斷有誤 → 可移到「備選人才」並備註原因',
    ],
    tips: [
      'S 級和 A+ 級建議當天聯繫，搶先其他獵頭',
      '可使用人選卡片上的「電話腳本」按鈕快速生成對話引導',
      'AI 推薦不代表一定適合，顧問的人工判斷永遠是最終決定',
    ],
    nextStage: '聯繫階段',
  },
  {
    id: 'contacted',
    name: '聯繫階段',
    icon: <Phone className="w-5 h-5" />,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    sla: '3 天',
    description: '顧問已主動聯繫候選人（LinkedIn InMail / Email / 電話 / LINE），等待回覆或正在溝通中。',
    howToEnter: [
      '從「未開始」或「AI推薦」手動移過來',
      '在看板上拖拉卡片',
      '在人選卡片 → 進度追蹤 tab 新增進度',
    ],
    whatToDo: [
      '記錄聯繫方式與結果（在進度追蹤填寫原因）',
      '使用電話腳本進行結構化篩選',
      '了解人選的求職狀態、薪資期望、到職時間',
      '確認人選對目標職缺的興趣程度',
      '未回覆 → 2-3 天後再次跟進',
    ],
    tips: [
      '聯繫時務必填寫備註原因，例如「已加 LinkedIn 待回覆」',
      '多渠道並行（LinkedIn + Email + LINE）提高回覆率',
      '電話篩選後立即填寫通話 Checklist',
    ],
    nextStage: '面試階段',
  },
  {
    id: 'interview',
    name: '面試階段',
    icon: <MessageSquare className="w-5 h-5" />,
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    sla: '7 天',
    description: '候選人已進入客戶端面試流程（電話面試 / 視訊面試 / 現場面試），等待面試結果。',
    howToEnter: [
      '從「聯繫階段」確認人選有興趣後移過來',
      '人選同意參加客戶面試',
    ],
    whatToDo: [
      '協調雙方面試時間',
      '提供面試準備建議給候選人',
      '面試後追蹤雙方回饋',
      '記錄面試結果與評價',
      '如需多輪面試，持續追蹤進度',
    ],
    tips: [
      '面試前先跟客戶 HR 確認面試重點',
      '面試後 24 小時內向雙方追蹤回饋',
      'SLA 7 天，多輪面試可適當延長',
    ],
    nextStage: 'Offer 或 婉拒',
  },
  {
    id: 'offer',
    name: 'Offer',
    icon: <Award className="w-5 h-5" />,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    sla: '5 天',
    description: '客戶端已發出正式 Offer，等待候選人接受或議價中。',
    howToEnter: [
      '客戶面試通過後決定發 Offer',
      '從「面試階段」移過來',
    ],
    whatToDo: [
      '確認 Offer 條件（薪資、職稱、報到日期）',
      '與候選人溝通 Offer 內容',
      '如有 Counter Offer → 協助議價',
      '如有競爭 Offer → 分析利弊，引導決策',
      '追蹤候選人最終決定時間',
    ],
    tips: [
      'Offer 期是最脆弱的階段，密切關注候選人心態變化',
      '提醒候選人不要拖太久，以免客戶撤 Offer',
      '預留 Counter Offer 的議價空間',
    ],
    nextStage: 'on board 或 婉拒',
  },
  {
    id: 'onboard',
    name: 'on board',
    icon: <CheckCircle2 className="w-5 h-5" />,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    sla: '不計算',
    description: '候選人已接受 Offer 並確認到職日，或已正式到職。這是成功結案的狀態。',
    howToEnter: [
      '候選人正式接受 Offer',
      '候選人已到職報到',
    ],
    whatToDo: [
      '確認到職日期並通知客戶',
      '協助入職準備（如需要）',
      '到職後 1-2 週追蹤適應狀況',
      '確認保證期內無異常',
    ],
    tips: [
      '到職後記得跟進候選人，維護長期關係',
      '成功案例可作為推薦信或案例分享',
    ],
    nextStage: '結案（恭喜！🎉）',
  },
  {
    id: 'rejected',
    name: '婉拒',
    icon: <XCircle className="w-5 h-5" />,
    color: 'text-rose-700',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    sla: '不計算',
    description: '候選人或客戶端決定不繼續推進。可能發生在任何階段。',
    howToEnter: [
      '候選人婉拒（薪資不符 / 接受其他 Offer / 不想換工作等）',
      '客戶端婉拒（技術不符 / 文化不符 / 預算不符等）',
    ],
    whatToDo: [
      '記錄婉拒原因（重要！在進度追蹤中選擇或填寫具體原因）',
      '評估是否適合其他職缺 → 可移到「備選人才」',
      '保持良好關係，未來有合適機會可再聯繫',
    ],
    tips: [
      '務必填寫婉拒原因，方便日後分析案例與改進',
      '婉拒不代表永遠拒絕，保持專業態度',
    ],
    nextStage: '備選人才（如適合其他職缺）',
  },
  {
    id: 'alternative',
    name: '備選人才',
    icon: <Archive className="w-5 h-5" />,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    sla: '不計算',
    description: '暫時不適合目前職缺但有潛力的候選人。未來有新職缺時可從此人才庫中篩選。',
    howToEnter: [
      'AI 評分 B/C 級',
      '顧問判斷暫不適合目前職缺但值得保留',
      '候選人目前不看機會但技術背景優秀',
    ],
    whatToDo: [
      '定期（每 2-4 週）檢視備選人才庫',
      '有新職缺時優先從備選庫篩選',
      '保持與優質備選人才的關係',
    ],
    tips: [
      '備選人才是重要資產，不要忽視此人才庫',
      '可在人選卡片備註中記錄適合的職缺類型',
    ],
    nextStage: '有合適職缺時 → 聯繫階段',
  },
];

// ── 日常工作流程 ──────────────────────────────────────────
const DAILY_WORKFLOW = [
  { time: '上班第一件事', task: '查看「今日新增」人選', detail: '確認新進候選人，指派顧問、指定目標職缺' },
  { time: '上午', task: '處理「AI推薦」人選', detail: '閱讀 AI 匹配結語，判斷是否聯繫，優先處理 S/A+ 級' },
  { time: '上午', task: '清理「未開始」欄位', detail: '超過 2 天的人選需處理：聯繫或歸入備選' },
  { time: '全天', task: '跟進「聯繫階段」人選', detail: '發送 InMail/Email，打電話，使用電話腳本' },
  { time: '全天', task: '安排及追蹤面試', detail: '協調面試時間、準備候選人、追蹤面試結果' },
  { time: '下午', task: '處理 Offer & 議價', detail: '與候選人溝通 Offer 條件，處理 Counter Offer' },
  { time: '週五', task: '週報整理', detail: '查看營運儀表板，整理本週成果，規劃下週計畫' },
];

export function SOPGuidePage({ userProfile }: SOPGuidePageProps) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'pipeline' | 'workflow' | 'features'>('pipeline');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 rounded-2xl p-8 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-8 h-8" />
          <h1 className="text-2xl font-black">獵頭顧問 SOP 使用手冊</h1>
        </div>
        <p className="text-blue-100 mt-2">
          本手冊教你如何使用 Step1ne 系統管理候選人追蹤表，每個 Pipeline 階段的用意、操作方式與最佳實務。
        </p>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 bg-white rounded-xl p-2 shadow-sm border border-gray-100">
        {[
          { id: 'pipeline' as const, label: '📊 Pipeline 階段說明', desc: '每個欄位代表什麼' },
          { id: 'workflow' as const, label: '📅 日常工作流程', desc: '每天該做什麼' },
          { id: 'features' as const, label: '🛠️ 系統功能速查', desc: '常用功能在哪裡' },
        ].map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex-1 py-3 px-4 rounded-lg transition-all text-left ${
              activeSection === s.id
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="font-semibold text-sm">{s.label}</div>
            <div className={`text-xs mt-0.5 ${activeSection === s.id ? 'text-indigo-200' : 'text-gray-400'}`}>{s.desc}</div>
          </button>
        ))}
      </div>

      {/* Pipeline 階段說明 */}
      {activeSection === 'pipeline' && (
        <div className="space-y-4">
          {/* Pipeline 流程圖 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">📈 人選追蹤 Pipeline 流程</h2>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {['今日新增', '未開始', 'AI推薦', '聯繫階段', '面試階段', 'Offer', 'on board'].map((s, i) => (
                <React.Fragment key={s}>
                  <span className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">{s}</span>
                  {i < 6 && <ArrowRight className="w-4 h-4 text-gray-400" />}
                </React.Fragment>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
              <span className="px-3 py-1.5 bg-rose-100 text-rose-700 rounded-full font-medium">婉拒</span>
              <span className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full font-medium">備選人才</span>
              <span className="text-xs ml-2">← 可在任何階段轉入</span>
            </div>
          </div>

          {/* 每個階段詳細說明 */}
          {PIPELINE_STAGES.map(stage => (
            <div
              key={stage.id}
              className={`${stage.bgColor} rounded-xl border ${stage.borderColor} overflow-hidden shadow-sm`}
            >
              <button
                onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
                className="w-full flex items-center justify-between p-4 text-left hover:opacity-90 transition-opacity"
              >
                <div className="flex items-center gap-3">
                  <span className={stage.color}>{stage.icon}</span>
                  <div>
                    <span className={`font-bold text-lg ${stage.color}`}>{stage.name}</span>
                    <span className="ml-3 text-xs px-2 py-0.5 bg-white/60 rounded-full text-gray-600">
                      SLA: {stage.sla}
                    </span>
                  </div>
                </div>
                {expandedStage === stage.id
                  ? <ChevronDown className={`w-5 h-5 ${stage.color}`} />
                  : <ChevronRight className={`w-5 h-5 ${stage.color}`} />
                }
              </button>

              {expandedStage === stage.id && (
                <div className="px-4 pb-4 space-y-4">
                  {/* 說明 */}
                  <p className="text-sm text-gray-700 leading-relaxed">{stage.description}</p>

                  {/* 如何進入 */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">📥 如何進入此階段</h4>
                    <ul className="space-y-1">
                      {stage.howToEnter.map((item, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-gray-400 mt-0.5">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 該做什麼 */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">✅ 在此階段該做什麼</h4>
                    <ul className="space-y-1">
                      {stage.whatToDo.map((item, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 小提醒 */}
                  <div className="bg-white/50 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">💡 顧問小提醒</h4>
                    <ul className="space-y-1">
                      {stage.tips.map((tip, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-amber-400 mt-0.5">⚡</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 下一步 */}
                  <div className="flex items-center gap-2 text-sm">
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">下一步：</span>
                    <span className="font-medium text-gray-700">{stage.nextStage}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 日常工作流程 */}
      {activeSection === 'workflow' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">📅 顧問每日工作流程</h2>
            <div className="space-y-3">
              {DAILY_WORKFLOW.map((item, i) => (
                <div key={i} className="flex gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="shrink-0 w-20">
                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                      {item.time}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{item.task}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">📊 SLA 停留天數對照表</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Pipeline 階段</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">SLA 天數上限</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">逾期處理</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { stage: '未開始', sla: '2 天', action: '必須聯繫或歸入備選' },
                    { stage: 'AI推薦', sla: '3 天', action: '確認 AI 判斷，決定是否聯繫' },
                    { stage: '聯繫階段', sla: '3 天', action: '再次跟進或標記婉拒' },
                    { stage: '面試階段', sla: '7 天', action: '追蹤面試結果' },
                    { stage: 'Offer', sla: '5 天', action: '催促候選人決定' },
                    { stage: 'on board', sla: '—', action: '結案' },
                    { stage: '婉拒', sla: '—', action: '記錄原因，評估備選' },
                    { stage: '備選人才', sla: '—', action: '定期回顧' },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 px-3 font-medium">{row.stage}</td>
                      <td className="py-2 px-3">{row.sla}</td>
                      <td className="py-2 px-3 text-gray-500">{row.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 看板操作教學 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">🎯 看板操作方式</h2>
            <div className="space-y-4 text-sm text-gray-700">
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">1</span>
                <div>
                  <div className="font-semibold">拖拉卡片更新階段</div>
                  <p className="text-gray-500 mt-0.5">在「顧問人選追蹤表」中直接拖拉候選人卡片到目標欄位，系統自動更新狀態與進度記錄。</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">2</span>
                <div>
                  <div className="font-semibold">人選卡片 → 進度追蹤 tab</div>
                  <p className="text-gray-500 mt-0.5">在候選人卡片中切到「進度追蹤」tab，選擇目標階段，填寫原因備註（可用快速按鈕），確認新增。</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">3</span>
                <div>
                  <div className="font-semibold">AIbot 自動更新</div>
                  <p className="text-gray-500 mt-0.5">AI 評分 Bot 會自動將評分完成的候選人移到「AI推薦」或「備選人才」。</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 系統功能速查 */}
      {activeSection === 'features' && (
        <div className="space-y-4">
          {[
            {
              title: '📋 候選人總表',
              icon: <Users className="w-5 h-5 text-blue-500" />,
              items: [
                '查看所有候選人清單，支援搜尋、排序、篩選',
                '點擊候選人姓名 → 開啟人選卡片',
                '快速檢視 LinkedIn、人才等級、狀態',
                '右上角可新增候選人、匯入 PDF 履歷',
              ]
            },
            {
              title: '👤 人選卡片',
              icon: <Target className="w-5 h-5 text-amber-500" />,
              items: [
                '基本資訊 tab：查看/編輯所有候選人資料',
                '進度追蹤 tab：查看歷史進度、新增進度（含快速原因按鈕）',
                '備註紀錄 tab：新增文字備註',
                'AI 總結 tab：查看 AI 廣度分析報告',
                'AI 匹配結語 tab：查看 AI 深度匹配分析',
                '「電話腳本」按鈕：一鍵生成對應職缺的電話篩選指南',
                '「匯入履歷」按鈕：上傳 PDF 自動解析並填入資料',
              ]
            },
            {
              title: '💼 職缺管理',
              icon: <Briefcase className="w-5 h-5 text-emerald-500" />,
              items: [
                '查看所有職缺清單',
                '新增職缺（手動或由 AI 職缺匯入 Bot）',
                '編輯職缺資訊、人才畫像、公司畫像',
                '依客戶公司篩選職缺',
              ]
            },
            {
              title: '📈 顧問人選追蹤表（看板）',
              icon: <Target className="w-5 h-5 text-violet-500" />,
              items: [
                '看板模式：拖拉卡片快速移動階段',
                '每個欄位顯示候選人數量',
                '支援依顧問篩選（只看自己負責的人選）',
                '卡片顯示候選人姓名、職位、停留天數',
              ]
            },
            {
              title: '💡 提示詞資料庫',
              icon: <BookOpen className="w-5 h-5 text-indigo-500" />,
              items: [
                '9 大類別提示詞模板',
                '選擇候選人 + 職缺 → 自動填入模板',
                '支援多職缺模式（一家客戶多個職缺一起詢問）',
                '複製提示詞貼到 AI 對話視窗使用',
              ]
            },
            {
              title: '🤖 AI Bot 使用',
              icon: <Bot className="w-5 h-5 text-cyan-500" />,
              items: [
                '使用說明頁面 → 複製 Bot 啟動提示詞',
                '五種 Bot：通用 AIbot、評分 Bot、職缺匯入 Bot、履歷匯入 Bot、GitHub 分析 Bot',
                '貼到 OpenClaw / ChatGPT / Claude 即可使用',
                '詳細操作見「AI API 使用教學」頁面',
              ]
            },
          ].map((section, i) => (
            <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                {section.icon}
                <h3 className="font-bold text-gray-900">{section.title}</h3>
              </div>
              <ul className="space-y-1.5">
                {section.items.map((item, j) => (
                  <li key={j} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-gray-300 mt-0.5">▸</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SOPGuidePage;
