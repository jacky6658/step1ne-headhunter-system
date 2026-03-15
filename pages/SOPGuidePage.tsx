import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Users, Briefcase, Target, Phone, MessageSquare, Award, CheckCircle2, XCircle, Archive, Bot, Zap, ArrowRight, AlertCircle, TrendingUp, Clock, MapPin, DollarSign, Brain, Star, Layers, Lightbulb, GraduationCap, Sparkles, Map, Compass, Rocket, PlayCircle } from 'lucide-react';
import { OnboardingTour, TourStep } from '../components/OnboardingTour';

interface SOPGuidePageProps {
  userProfile?: any;
  onNavigate?: (tab: string) => void;
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

// ── 顧問導覽步驟 ──────────────────────────────────────────
const SOP_TOUR_STEPS: TourStep[] = [
  {
    target: 'sop-header',
    title: '歡迎來到顧問 SOP 手冊！',
    content: '這是你在 Step1ne 系統的操作指南。新人建議依序閱讀，搞懂工作流程後再進入學習中心深造。',
    placement: 'bottom',
  },
  {
    target: 'sop-tab-playbook',
    title: '📖 第一站：獵頭 Playbook',
    content: '先建立獵頭思維框架 — 包含 10 個核心心法：人才地圖、SMT 模型、薪資判斷、候選人分類等。這是你最需要優先讀的內容。',
    placement: 'bottom',
  },
  {
    target: 'sop-tab-pipeline',
    title: '📊 第二站：Pipeline 階段',
    content: '了解系統中 9 個人選追蹤階段（今日新增 → on board → 婉拒），每個階段的用途、SLA 和該做什麼。',
    placement: 'bottom',
  },
  {
    target: 'sop-tab-workflow',
    title: '📅 第三站：日常工作流程',
    content: '了解每天上班該做什麼、看板怎麼操作、SLA 超時怎麼處理。',
    placement: 'bottom',
  },
  {
    target: 'sop-tab-features',
    title: '🛠️ 第四站：系統功能速查',
    content: '快速查找系統各功能的位置和用法：候選人卡片、職缺管理、提示詞資料庫、AI Bot、學習中心。',
    placement: 'bottom',
  },
  {
    target: 'sop-tab-learning-path',
    title: '🎓 第五站：學習路徑',
    content: '看完 SOP 後，這裡有你的 30 天學習路線圖，指引你前往「學習中心」深入了解產業、角色、AI 工具。',
    placement: 'bottom',
  },
  {
    target: 'sop-go-learning-center',
    title: '🚀 進階：前往學習中心',
    content: '學習中心有 6 大模組：30 天速成、產業地圖、角色百科、組織架構、職缺分析器、Prompt 工具箱。搞懂 SOP 後就去那邊繼續學習！',
    placement: 'bottom',
  },
];

export function SOPGuidePage({ userProfile, onNavigate }: SOPGuidePageProps) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'learning-path' | 'pipeline' | 'workflow' | 'features' | 'playbook'>('playbook');
  const [tourActive, setTourActive] = useState(false);

  const goToLearningCenter = () => onNavigate?.('learning-center');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Onboarding Tour */}
      <OnboardingTour
        storageKey="step1ne-sop-guide-tour"
        steps={SOP_TOUR_STEPS}
        active={tourActive}
        onComplete={() => setTourActive(false)}
      />

      {/* Header */}
      <div data-tour="sop-header" className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 rounded-2xl p-5 sm:p-8 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 shrink-0" />
          <h1 className="text-xl sm:text-2xl font-black">獵頭顧問 SOP 使用手冊</h1>
        </div>
        <p className="text-blue-100 mt-2">
          本手冊教你如何使用 Step1ne 系統管理候選人追蹤表，每個 Pipeline 階段的用意、操作方式與最佳實務。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            data-tour="sop-go-learning-center"
            onClick={goToLearningCenter}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95 border border-white/20"
          >
            <GraduationCap className="w-4 h-4" />
            前往學習中心（產業/角色/Prompt 深度學習）
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('step1ne-sop-guide-tour');
              // 先關再開，確保 useEffect 偵測到 false→true 變化
              setTourActive(false);
              requestAnimationFrame(() => setTourActive(true));
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl text-sm font-medium transition-all border border-white/10"
          >
            <PlayCircle className="w-4 h-4" />
            開始導覽
          </button>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 bg-white rounded-xl p-2 shadow-sm border border-gray-100">
        {[
          { id: 'playbook' as const, label: '📖 Playbook', labelFull: '📖 獵頭 Playbook', desc: '操作心法與方法論', tourId: 'sop-tab-playbook' },
          { id: 'pipeline' as const, label: '📊 Pipeline', labelFull: '📊 Pipeline 階段', desc: '每個欄位代表什麼', tourId: 'sop-tab-pipeline' },
          { id: 'workflow' as const, label: '📅 日常流程', labelFull: '📅 日常工作流程', desc: '每天該做什麼', tourId: 'sop-tab-workflow' },
          { id: 'features' as const, label: '🛠️ 功能速查', labelFull: '🛠️ 系統功能速查', desc: '常用功能在哪裡', tourId: 'sop-tab-features' },
          { id: 'learning-path' as const, label: '🎓 學習路徑', labelFull: '🎓 學習路徑', desc: '進入學習中心前看這', tourId: 'sop-tab-learning-path' },
        ].map(s => (
          <button
            key={s.id}
            data-tour={s.tourId}
            onClick={() => setActiveSection(s.id)}
            className={`py-3 px-2 sm:px-4 rounded-lg transition-all text-left ${
              activeSection === s.id
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="font-semibold text-xs sm:text-sm"><span className="sm:hidden">{s.label}</span><span className="hidden sm:inline">{s.labelFull}</span></div>
            <div className={`text-[10px] sm:text-xs mt-0.5 ${activeSection === s.id ? 'text-indigo-200' : 'text-gray-400'}`}>{s.desc}</div>
          </button>
        ))}
      </div>

      {/* ── 🎓 學習路徑 ── */}
      {activeSection === 'learning-path' && (
        <div className="space-y-5">

          {/* 新人 30 天學習路線圖 */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Rocket className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-gray-900">新人必看！你的學習路線圖</h2>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              不知道從哪裡開始？按照以下順序學習，30 天內成為合格的獵頭顧問
            </p>

            <div className="space-y-4">
              {[
                {
                  step: 1, day: 'Day 1-2', title: '📖 先讀這份 SOP 手冊',
                  desc: '了解系統的 Pipeline 流程、日常工作節奏、各功能位置',
                  action: '閱讀本頁「Pipeline 階段」和「日常流程」Tab',
                  where: 'sop',
                  color: 'bg-blue-500',
                },
                {
                  step: 2, day: 'Day 3-7', title: '⚡ 完成學習中心「30 天速成」計畫',
                  desc: '系統化的新人培訓計畫，包含 5 個階段的學習任務與 Checklist',
                  action: '前往學習中心 → 30 天速成 Tab',
                  where: 'learning-center',
                  color: 'bg-emerald-500',
                },
                {
                  step: 3, day: 'Day 3-14', title: '🗺️ 學習產業地圖 — 認識你的市場',
                  desc: '了解 10 大產業的商業模式、組織架構、關鍵角色，建立產業 Sense',
                  action: '前往學習中心 → 產業地圖 Tab',
                  where: 'learning-center',
                  color: 'bg-violet-500',
                },
                {
                  step: 4, day: 'Day 7-21', title: '📚 熟悉角色百科 — 懂你的候選人',
                  desc: '16 個角色卡片：每日工作、必備技能、薪資行情、面試問題、紅旗警示',
                  action: '前往學習中心 → 角色百科 Tab',
                  where: 'learning-center',
                  color: 'bg-amber-500',
                },
                {
                  step: 5, day: 'Day 14-30', title: '🤖 掌握 Prompt 工具箱 — 讓 AI 幫你工作',
                  desc: '20+ 組 Prompt 模板，涵蓋產業分析、公司理解、角色評估、人選判斷',
                  action: '前往學習中心 → Prompt 工具箱 Tab',
                  where: 'learning-center',
                  color: 'bg-rose-500',
                },
                {
                  step: 6, day: '持續精進', title: '🎯 實戰 — 用「職缺分析器」練功',
                  desc: '拿到真實 JD 後，用職缺分析器拆解 JD，搭配 Prompt 產出分析報告',
                  action: '前往學習中心 → 職缺分析 Tab',
                  where: 'learning-center',
                  color: 'bg-cyan-500',
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4 items-start">
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-9 h-9 ${item.color} rounded-full flex items-center justify-center text-white text-sm font-black shadow-md`}>
                      {item.step}
                    </div>
                    {item.step < 6 && <div className="w-0.5 h-8 bg-gray-200 mt-1" />}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-sm">{item.title}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-white rounded-full text-gray-500 border border-gray-200 font-medium">{item.day}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                    {item.where === 'learning-center' ? (
                      <button
                        onClick={goToLearningCenter}
                        className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold hover:underline transition-colors"
                      >
                        <ArrowRight className="w-3 h-3" /> {item.action}
                      </button>
                    ) : (
                      <p className="mt-1.5 text-[11px] text-indigo-600 font-medium">📌 {item.action}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 依情境快速導航 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Compass className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-gray-900">依情境快速導航</h2>
            </div>
            <p className="text-sm text-gray-500 mb-5">遇到什麼問題？我告訴你該看哪裡</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  q: '不知道候選人該放哪個階段？',
                  a: '本頁「Pipeline 階段說明」Tab',
                  click: () => setActiveSection('pipeline'),
                  icon: '📊', color: 'bg-blue-50 border-blue-200',
                },
                {
                  q: '每天上班不知道先做什麼？',
                  a: '本頁「日常工作流程」Tab',
                  click: () => setActiveSection('workflow'),
                  icon: '📅', color: 'bg-amber-50 border-amber-200',
                },
                {
                  q: '接到新 JD，看不懂技術要求？',
                  a: '學習中心 →「角色百科」查技能清單',
                  click: goToLearningCenter,
                  icon: '📚', color: 'bg-violet-50 border-violet-200',
                },
                {
                  q: '不了解客戶所在的產業？',
                  a: '學習中心 →「產業地圖」查產業分析',
                  click: goToLearningCenter,
                  icon: '🗺️', color: 'bg-emerald-50 border-emerald-200',
                },
                {
                  q: '要跟候選人打電話，不知道問什麼？',
                  a: '本頁 Playbook「15 分鐘 SMT 模型」+ 人選卡片「電話腳本」',
                  click: () => setActiveSection('playbook'),
                  icon: '📞', color: 'bg-cyan-50 border-cyan-200',
                },
                {
                  q: '想用 AI 幫我分析 JD / 公司 / 人選？',
                  a: '學習中心 →「Prompt 工具箱」20+ 模板',
                  click: goToLearningCenter,
                  icon: '🤖', color: 'bg-rose-50 border-rose-200',
                },
                {
                  q: '不確定候選人的薪資合不合理？',
                  a: '本頁 Playbook「薪資合理性判斷」+ 角色百科薪資範圍',
                  click: () => setActiveSection('playbook'),
                  icon: '💰', color: 'bg-green-50 border-green-200',
                },
                {
                  q: '公司的組織架構怎麼看？',
                  a: '學習中心 →「組織架構」Tab',
                  click: goToLearningCenter,
                  icon: '🏢', color: 'bg-indigo-50 border-indigo-200',
                },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={item.click}
                  className={`${item.color} border rounded-xl p-4 text-left hover:shadow-md transition-all hover:scale-[1.01] active:scale-[0.99]`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.q}</p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <ArrowRight className="w-3 h-3 shrink-0" /> {item.a}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 學習中心總覽 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-gray-900">學習中心 — 6 大學習模組總覽</h2>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              學習中心是你的「獵頭大學」，涵蓋產業知識、角色理解、AI 工具。點擊任一模組直接前往
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                {
                  icon: '⚡', title: '30 天速成', desc: '新人培訓 5 階段任務',
                  priority: '新人必修', color: 'from-amber-400 to-orange-400',
                },
                {
                  icon: '🗺️', title: '產業地圖', desc: '10 大產業深度分析',
                  priority: '核心知識', color: 'from-emerald-400 to-teal-500',
                },
                {
                  icon: '📖', title: '角色百科', desc: '16 個角色完整攻略',
                  priority: '核心知識', color: 'from-blue-400 to-indigo-500',
                },
                {
                  icon: '🏢', title: '組織架構', desc: '5 種企業組織解析',
                  priority: '進階理解', color: 'from-violet-400 to-purple-500',
                },
                {
                  icon: '🎯', title: '職缺分析器', desc: '拆解真實 JD 練功',
                  priority: '實戰工具', color: 'from-cyan-400 to-blue-500',
                },
                {
                  icon: '🤖', title: 'Prompt 工具箱', desc: '20+ AI 模板即用',
                  priority: '效率武器', color: 'from-rose-400 to-pink-500',
                },
              ].map((mod, i) => (
                <button
                  key={i}
                  onClick={goToLearningCenter}
                  className="rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] text-left group"
                >
                  <div className={`bg-gradient-to-br ${mod.color} p-3 text-white`}>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{mod.icon}</span>
                      <span className="text-[9px] bg-white/25 px-2 py-0.5 rounded-full font-semibold">{mod.priority}</span>
                    </div>
                    <div className="font-bold text-sm mt-2">{mod.title}</div>
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-gray-600">{mod.desc}</p>
                    <p className="text-[10px] text-indigo-500 font-medium mt-2 group-hover:underline flex items-center gap-1">
                      前往學習 <ArrowRight className="w-3 h-3" />
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>
      )}

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
            {
              title: '🎓 學習中心',
              icon: <GraduationCap className="w-5 h-5 text-indigo-500" />,
              items: [
                '30 天速成：新人顧問 5 階段系統化培訓計畫',
                '產業地圖：10 大產業深度分析（SaaS、SI、BIM、金融、餐旅...）',
                '角色百科：16 個角色完整攻略（技能、薪資、面試題、紅旗警示）',
                '組織架構：5 種企業組織類型圖解',
                '職缺分析器：輸入真實 JD → AI 拆解分析',
                'Prompt 工具箱：20+ 組 AI 提示模板（選擇職缺/客戶自動填入變數）',
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

      {/* ── 獵頭 Playbook ── */}
      {activeSection === 'playbook' && (
        <div className="space-y-6">

          {/* 一、獵頭工作的本質 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold text-gray-900">一、獵頭工作的本質</h2>
            </div>
            <p className="text-sm text-gray-500 mb-5">獵頭不是單純「幫公司找人」，而是<strong className="text-gray-800">經營人才市場（Talent Market）</strong></p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: <Users className="w-7 h-7" />, title: '人才庫', sub: 'Candidate Database', color: 'from-blue-500 to-cyan-400', desc: '累積 500-3000 位候選人' },
                { icon: <Briefcase className="w-7 h-7" />, title: '客戶關係', sub: 'Client Relationship', color: 'from-violet-500 to-purple-400', desc: '建立 HR / Hiring Manager 信任' },
                { icon: <TrendingUp className="w-7 h-7" />, title: '市場情報', sub: 'Market Intelligence', color: 'from-amber-500 to-orange-400', desc: '掌握行業薪資與趨勢' },
              ].map((item, i) => (
                <div key={i} className="relative overflow-hidden rounded-xl border border-gray-100 p-5 text-center group hover:shadow-md transition-shadow">
                  <div className={`w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform`}>
                    {item.icon}
                  </div>
                  <div className="font-bold text-gray-900">{item.title}</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">{item.sub}</div>
                  <div className="text-xs text-gray-500 mt-2">{item.desc}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 bg-amber-50 border border-amber-100 rounded-lg p-3 text-center">
              <p className="text-sm text-amber-800 font-medium">成功的獵頭會同時經營 <strong>人才 / 公司 / 市場資訊</strong>，而不是只依賴 JD</p>
            </div>
            <button onClick={goToLearningCenter} className="mt-3 w-full flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors group">
              <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
              <p className="text-xs text-indigo-700 text-left"><strong>延伸學習：</strong>前往學習中心「產業地圖」了解 10 大產業的市場情報，「角色百科」了解 16 個角色的人才分布</p>
              <ArrowRight className="w-4 h-4 text-indigo-400 shrink-0 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* 二、4 個賺錢漏斗 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-bold text-gray-900">二、獵頭的 4 個賺錢漏斗</h2>
            </div>
            <p className="text-sm text-gray-500 mb-5">不同漏斗適合不同階段的獵頭，高手會同時經營多個</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  name: '職缺驅動', sub: 'Job Driven', color: 'border-blue-200 bg-blue-50',
                  tagColor: 'bg-blue-100 text-blue-700',
                  steps: ['Client 提供 JD', '搜尋候選人', '安排面試', 'Offer', '收費'],
                  note: '最基礎，但成交率依賴 JD 品質',
                },
                {
                  name: '人才驅動', sub: 'Talent Driven', color: 'border-emerald-200 bg-emerald-50',
                  tagColor: 'bg-emerald-100 text-emerald-700',
                  steps: ['發現優秀人才', '建立關係', '了解 Demand', '加入人才庫', '未來匹配職缺'],
                  note: '目標：累積 500-3000 位候選人',
                },
                {
                  name: '關係驅動', sub: 'Relationship Driven', color: 'border-violet-200 bg-violet-50',
                  tagColor: 'bg-violet-100 text-violet-700',
                  steps: ['建立 HR 關係', '定期交流', '公司出現需求', '優先委託你'],
                  note: '成功率通常最高',
                },
                {
                  name: '反向開發', sub: 'Reverse Marketing', color: 'border-amber-200 bg-amber-50',
                  tagColor: 'bg-amber-100 text-amber-700',
                  steps: ['發現優秀人才', '尋找適合公司', '推薦候選人', '創造職缺', '成交'],
                  note: '高手常用策略',
                },
              ].map((funnel, i) => (
                <div key={i} className={`rounded-xl border ${funnel.color} p-4`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${funnel.tagColor}`}>{i + 1}</span>
                    <div>
                      <span className="font-bold text-gray-900 text-sm">{funnel.name}</span>
                      <span className="text-[10px] text-gray-400 ml-2 uppercase">{funnel.sub}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mb-3">
                    {funnel.steps.map((step, j) => (
                      <React.Fragment key={j}>
                        <span className="text-[10px] sm:text-xs bg-white/80 px-1.5 sm:px-2 py-1 rounded-md border border-gray-200 text-gray-700">{step}</span>
                        {j < funnel.steps.length - 1 && <ArrowRight className="w-3 h-3 text-gray-400 shrink-0 hidden sm:block" />}
                        {j < funnel.steps.length - 1 && <span className="text-gray-400 text-[10px] sm:hidden">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 italic">{funnel.note}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 三、Candidate Demand */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-5 h-5 text-rose-500" />
              <h2 className="text-lg font-bold text-gray-900">三、Candidate Demand（人選需求）</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">不是 JD，而是<strong className="text-gray-800">人選換工作的動機</strong>，通常包含五個面向：</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {[
                { label: '產業', icon: '🏢', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                { label: '技術內容', icon: '💻', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                { label: '薪資', icon: '💰', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                { label: '公司類型', icon: '🏛️', color: 'bg-violet-50 text-violet-700 border-violet-200' },
                { label: '工作文化', icon: '🤝', color: 'bg-rose-50 text-rose-700 border-rose-200' },
              ].map((d, i) => (
                <span key={i} className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border text-xs sm:text-sm font-medium ${d.color}`}>
                  <span>{d.icon}</span> {d.label}
                </span>
              ))}
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-semibold">範例</div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0">J</div>
                <div>
                  <div className="font-semibold text-sm text-gray-900">John — Current Salary: 120K</div>
                  <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                    <p>Demand: AI 公司 / Cloud Native 技術 / Hybrid 工作 / 期望薪資 150K</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 四、15 分鐘 SMT 模型 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-bold text-gray-900">四、15 分鐘候選人判斷模型</h2>
            </div>
            <p className="text-sm text-gray-500 mb-5">三項越多成立 → 成交機率越高</p>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { letter: 'S', word: 'Skill', desc: '技術能力匹配', color: 'from-blue-500 to-blue-600' },
                { letter: 'M', word: 'Motivation', desc: '轉職動機強度', color: 'from-emerald-500 to-emerald-600' },
                { letter: 'T', word: 'Timing', desc: '時間點適合度', color: 'from-amber-500 to-amber-600' },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center text-white text-2xl sm:text-3xl font-black shadow-lg`}>
                    {item.letter}
                  </div>
                  <div className="font-bold text-gray-900 mt-2 text-sm">{item.word}</div>
                  <div className="text-xs text-gray-500">{item.desc}</div>
                </div>
              ))}
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3">必問 6 個問題</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  '目前主要負責什麼系統或產品？',
                  '團隊規模？',
                  '最近會想看看市場機會嗎？',
                  '下一份工作最希望改善什麼？',
                  '目前薪資與期望薪資？',
                  '預計什麼時候會考慮轉職？',
                ].map((q, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-[10px] font-bold mt-0.5">{i + 1}</span>
                    {q}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 五、30 秒履歷判斷法 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-5 h-5 text-yellow-500" />
              <h2 className="text-lg font-bold text-gray-900">五、30 秒履歷判斷法</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">快速檢查四個元素，公式成立即可聯絡</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: '公司背景', icon: '🏢', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
                { label: '職位角色', icon: '👤', color: 'bg-cyan-50 border-cyan-200 text-cyan-700' },
                { label: '技術能力', icon: '⚙️', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                { label: '年資軌跡', icon: '📈', color: 'bg-amber-50 border-amber-200 text-amber-700' },
              ].map((item, i) => (
                <div key={i} className={`${item.color} border rounded-lg p-3 text-center`}>
                  <div className="text-2xl mb-1">{item.icon}</div>
                  <div className="text-xs font-semibold">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
              <p className="text-sm font-mono text-gray-700">
                <span className="font-bold text-indigo-600">Company</span>
                <span className="mx-2">+</span>
                <span className="font-bold text-emerald-600">Skill</span>
                <span className="mx-3 text-gray-400">或</span>
                <span className="font-bold text-cyan-600">Role</span>
                <span className="mx-2">+</span>
                <span className="font-bold text-emerald-600">Skill</span>
              </p>
              <p className="text-xs text-gray-500 mt-2">成立即可聯絡候選人</p>
            </div>
          </div>

          {/* 六、人才地圖 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-5 h-5 text-emerald-500" />
              <h2 className="text-lg font-bold text-gray-900">六、人才地圖（Talent Map）</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">範例：DevOps / SRE 人才主要分布公司</p>
            <div className="space-y-3">
              {[
                {
                  tier: 'Tier 1',
                  color: 'bg-emerald-600', tagColor: 'bg-emerald-100 text-emerald-800',
                  companies: ['LINE', 'Shopee', 'Garena', 'Trend Micro', 'Appier', 'Shopline', '91APP'],
                },
                {
                  tier: 'Tier 2',
                  color: 'bg-blue-500', tagColor: 'bg-blue-100 text-blue-800',
                  companies: ['KKBOX', 'Pinkoi', 'Klook', 'Lalamove', 'Fintech 公司'],
                },
                {
                  tier: 'Tier 3',
                  color: 'bg-gray-400', tagColor: 'bg-gray-100 text-gray-700',
                  companies: ['SI 公司', 'IT 服務公司', 'ERP 公司'],
                },
              ].map((tier, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`shrink-0 px-2.5 py-1 rounded-md text-white text-xs font-bold ${tier.color}`}>
                    {tier.tier}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tier.companies.map((c, j) => (
                      <span key={j} className={`text-xs px-2 py-1 rounded-md border ${tier.tagColor}`}>{c}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <span className="text-xs text-gray-500 mr-1">相關職稱：</span>
              {['DevOps Engineer', 'SRE', 'Cloud Engineer', 'Platform Engineer', 'Infrastructure Engineer'].map((t, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">{t}</span>
              ))}
            </div>
            <button onClick={goToLearningCenter} className="mt-4 w-full flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors group">
              <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
              <p className="text-xs text-indigo-700 text-left"><strong>延伸學習：</strong>學習中心「角色百科」有 16 個角色的完整來源公司、薪資範圍、技能清單，「產業地圖」有各產業的關鍵招募角色分布</p>
              <ArrowRight className="w-4 h-4 text-indigo-400 shrink-0 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* 七、薪資合理性判斷 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-5 h-5 text-green-500" />
              <h2 className="text-lg font-bold text-gray-900">七、薪資合理性判斷</h2>
            </div>
            <p className="text-sm text-gray-500 mb-5">評估要看：市場行情、技術稀缺度、公司背景、系統規模</p>
            <div className="space-y-3 mb-5">
              {[
                { years: '3 年 DevOps', range: '80K - 100K', pct: 40 },
                { years: '5 年 DevOps', range: '110K - 140K', pct: 60 },
                { years: '7 年 DevOps', range: '140K - 180K', pct: 85 },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-20 sm:w-28 text-xs sm:text-sm font-medium text-gray-700 shrink-0">{row.years}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full flex items-center justify-end pr-2 transition-all"
                      style={{ width: `${row.pct}%` }}
                    >
                      <span className="text-[10px] font-bold text-white">{row.range}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-gray-500 mr-1">高階技能加薪：</span>
              {['Kubernetes', '高併發', 'Multi-region'].map((s, i) => (
                <span key={i} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-md border border-green-200 font-medium">{s}</span>
              ))}
            </div>
            <button onClick={goToLearningCenter} className="mt-4 w-full flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors group">
              <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
              <p className="text-xs text-indigo-700 text-left"><strong>延伸學習：</strong>學習中心「角色百科」每個角色卡片都有初/中/高階的薪資範圍（TWD），可對照具體角色查詢市場行情</p>
              <ArrowRight className="w-4 h-4 text-indigo-400 shrink-0 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* 八、每日工作節奏 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-bold text-gray-900">八、每日工作節奏</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">三段式節奏，高效安排每一天</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  period: '上午', icon: '☀️', color: 'from-amber-400 to-orange-400', focus: '市場開發',
                  tasks: ['搜尋候選人', '發開發信', 'LinkedIn / 104 聯絡', '電話挖角'],
                  target: '目標：30-50 位候選人',
                },
                {
                  period: '下午', icon: '🌤️', color: 'from-blue-400 to-indigo-400', focus: '面談與推薦',
                  tasks: ['Candidate Interview', 'Client Development', '推薦候選人'],
                  target: '',
                },
                {
                  period: '晚上', icon: '🌙', color: 'from-violet-400 to-purple-500', focus: '關係經營',
                  tasks: ['LinkedIn 經營', '候選人聊天', '更新市場資訊'],
                  target: '',
                },
              ].map((slot, i) => (
                <div key={i} className="rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                  <div className={`bg-gradient-to-r ${slot.color} p-3 text-white`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{slot.icon}</span>
                      <div>
                        <div className="font-bold text-sm">{slot.period}</div>
                        <div className="text-[10px] opacity-80">{slot.focus}</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 space-y-1.5">
                    {slot.tasks.map((t, j) => (
                      <div key={j} className="text-xs text-gray-600 flex items-center gap-1.5">
                        <span className="text-gray-300">▸</span> {t}
                      </div>
                    ))}
                    {slot.target && (
                      <div className="text-[10px] text-amber-600 font-semibold mt-2 pt-2 border-t border-gray-100">{slot.target}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 九、候選人分類 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-5 h-5 text-purple-500" />
              <h2 className="text-lg font-bold text-gray-900">九、候選人分類</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">快速判斷候選人優先級</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { grade: 'A', color: 'from-emerald-500 to-emerald-600', traits: ['技能好', '有轉職動機', '3 個月內'], priority: '最優先' },
                { grade: 'B', color: 'from-blue-500 to-blue-600', traits: ['技能好', '暫時不換工作'], priority: '保持關係' },
                { grade: 'C', color: 'from-amber-500 to-amber-600', traits: ['技能普通'], priority: '備選觀察' },
                { grade: 'D', color: 'from-gray-400 to-gray-500', traits: ['市場價值低'], priority: '暫不跟進' },
              ].map((item, i) => (
                <div key={i} className="rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow text-center">
                  <div className={`bg-gradient-to-br ${item.color} p-4`}>
                    <div className="text-3xl font-black text-white">{item.grade}</div>
                    <div className="text-[10px] text-white/80 mt-0.5">{item.priority}</div>
                  </div>
                  <div className="p-3 space-y-1">
                    {item.traits.map((t, j) => (
                      <div key={j} className="text-xs text-gray-600">{t}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 十、頂級獵頭思維 */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 shadow-lg text-white">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold">十、頂級獵頭思維</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div className="bg-white/10 rounded-lg p-4 border border-white/10">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">新人思維</div>
                <p className="text-sm text-gray-300 italic">「這個人適不適合 JD？」</p>
              </div>
              <div className="bg-amber-500/20 rounded-lg p-4 border border-amber-400/30">
                <div className="text-xs text-amber-400 uppercase tracking-wider mb-2 font-semibold">高手思維</div>
                <p className="text-sm text-amber-100 font-medium">「市場上哪家公司會要這個人？」</p>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-5 border border-white/10 text-center">
              <Lightbulb className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-lg font-bold text-amber-300">核心心法</p>
              <p className="text-white/90 mt-2 text-sm leading-relaxed">每一個候選人都可能是未來的成交機會</p>
            </div>
          </div>

          {/* Playbook 底部 — 學習中心整體引導 */}
          <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 rounded-xl p-6 border border-indigo-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="w-6 h-6 text-indigo-600" />
              <h2 className="text-lg font-bold text-gray-900">繼續深造 — 前往學習中心</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Playbook 教你思維框架，學習中心教你實戰工具。兩者搭配使用效果最好：
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { playbook: '人才地圖（Talent Map）', lc: '角色百科 — 16 個角色的來源公司清單', icon: '📚' },
                { playbook: '薪資合理性判斷', lc: '角色百科 — 每個角色初/中/高階薪資', icon: '💰' },
                { playbook: 'Candidate Demand', lc: 'Prompt 工具箱 — 人選評估模板', icon: '🤖' },
                { playbook: '30 秒履歷判斷法', lc: '職缺分析器 — AI 拆解 JD 技能要求', icon: '🎯' },
                { playbook: '4 個賺錢漏斗', lc: '產業地圖 — 各產業獵頭切入策略', icon: '🗺️' },
                { playbook: '每日工作節奏', lc: '30 天速成 — 新人每日學習任務', icon: '⚡' },
              ].map((pair, i) => (
                <div key={i} className="flex items-start gap-2 text-xs bg-white rounded-lg p-3 border border-gray-100">
                  <span className="text-base shrink-0">{pair.icon}</span>
                  <div>
                    <p className="text-gray-500">Playbook「{pair.playbook}」</p>
                    <p className="text-indigo-700 font-semibold mt-0.5">→ 學習中心「{pair.lc}」</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={goToLearningCenter}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-all hover:shadow-lg active:scale-[0.98]"
            >
              <GraduationCap className="w-5 h-5" />
              前往學習中心開始學習
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

export default SOPGuidePage;
