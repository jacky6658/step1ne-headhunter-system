import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { apiGet, apiPost, apiDelete } from '../config/api';
import { Prompt } from '../types';
import { OnboardingTour, TourStep } from '../components/OnboardingTour';
import {
  GraduationCap, BookOpen, Map as MapIcon, Layers, Building2, Target, Bot,
  ChevronDown, ChevronRight, Copy, Check, Search, Briefcase,
  DollarSign, AlertTriangle, Star, Users, Code, ArrowRight, ArrowLeft,
  CheckCircle2, XCircle, Clock, Brain, Zap, Filter, Eye,
  Shield, Smartphone, Database, Palette, Package, Utensils, Car,
  FileText, TrendingUp, MessageSquare, UserCheck, Coffee
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface LearningCenterProps {
  userProfile: any;
}

type LearningTab = 'quick-start' | 'industry-map' | 'role-encyclopedia' | 'org-chart' | 'job-analyzer' | 'prompt-toolbox' | 'prompt-collection';

interface RoleCard {
  id: string;
  family: string;
  title: string;
  titleEn: string;
  emoji: string;
  whyExists: string;
  dailyWork: string[];
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  techStack?: string[];
  salaryRange: { junior: string; mid: string; senior: string; currency: string };
  sourceCompanies: string[];
  relatedRoles: string[];
  interviewQuestions: string[];
  redFlags: string[];
  howToVerify: string[];
  commonMistakes: string[];
  careerPath: string;
  promptTemplate: string;
}

interface IndustryCard {
  id: string; name: string; emoji: string; description: string;
  businessModels: string[]; typicalCompanies: string[];
  keyDepartments: string[]; commonRoles: string[];
  recruitingChallenges: string[]; promptTemplate: string;
}

interface OrgChartNode {
  title: string; roles: string[]; children?: OrgChartNode[];
}

interface OrgChartData {
  id: string; name: string; emoji: string; description: string; tree: OrgChartNode;
}

type PromptCategory = 'industry' | 'company' | 'role' | 'evaluation';

interface PromptItem {
  id: string; category: PromptCategory; title: string;
  description: string; template: string;
}

interface LearningTask {
  id: string; text: string; relatedTab?: LearningTab;
}

interface LearningPhase {
  id: string; name: string; emoji: string; days: string;
  description: string; tasks: LearningTask[];
}

// ============================================================
// HELPER: parseSalaryMid
// ============================================================
function parseSalaryMid(range: string): number {
  const nums = range.match(/\d+/g);
  if (!nums || nums.length === 0) return 0;
  if (nums.length === 1) return parseInt(nums[0]);
  return (parseInt(nums[0]) + parseInt(nums[1])) / 2;
}

// ============================================================
// HELPER: fillLearningPrompt — 智能填入 Prompt 變數
// ============================================================
function fillLearningPrompt(
  template: string,
  job: any | null,
  client: any | null,
  manualIndustry?: string,
): { filled: string; replacementCount: number } {
  let result = template;
  let count = 0;

  const doReplace = (pattern: RegExp, value: string) => {
    if (!value) return;
    const before = result;
    result = result.replace(pattern, value);
    if (result !== before) count++;
  };

  // 從 job 提取欄位（與 Job Analyzer 同款映射）
  const jobTitle = job?.position_name || job?.title || '';
  const company = job?.client_company || job?.company?.name || '';
  const salary = job?.salary_range || (job?.salary_min ? `${job.salary_min}~${job.salary_max}` : '');
  const description = job?.job_description || job?.description || '';
  const skillsRaw = job?.key_skills || job?.requirements || job?.must_have_skills || [];
  const skills = typeof skillsRaw === 'string'
    ? skillsRaw.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean)
    : Array.isArray(skillsRaw) ? skillsRaw : [];
  const department = job?.department || '';
  const teamSize = job?.team_size || '';
  const experience = job?.experience_required || '';

  // 從 client 提取欄位（manualIndustry 優先）
  const clientCompany = client?.company_name || company;
  const clientIndustry = manualIndustry || client?.industry || job?.industry || '';
  const clientSize = client?.company_size || '';

  // --- 格式 A: [填入XXX，如 YYY] ---
  doReplace(/\[填入公司名稱[^\]]*\]/g, clientCompany || company);
  doReplace(/\[填入產品類型[^\]]*\]/g, clientIndustry);
  doReplace(/\[填入公司階段[^\]]*\]/g, '');
  doReplace(/\[填入技術棧[^\]]*\]/g, skills.join(', '));
  doReplace(/\[填入公司規模[^\]]*\]/g, clientSize || teamSize);
  doReplace(/\[填入產業別[^\]]*\]/g, clientIndustry);
  doReplace(/\[填入客戶類型[^\]]*\]/g, clientIndustry);
  doReplace(/\[填入團隊人數[^\]]*\]/g, teamSize);
  doReplace(/\[填入框架[^\]]*\]/g, skills.join(', '));
  doReplace(/\[填入雲端環境[^\]]*\]/g, '');
  doReplace(/\[填入開發流程[^\]]*\]/g, '');
  doReplace(/\[填入合規需求[^\]]*\]/g, '');
  doReplace(/\[填入使用者規模[^\]]*\]/g, '');
  doReplace(/\[填入設計團隊現況[^\]]*\]/g, '');
  doReplace(/\[填入資料規模[^\]]*\]/g, '');
  doReplace(/\[填入應用場景[^\]]*\]/g, '');
  doReplace(/\[填入App類型[^\]]*\]/g, '');
  doReplace(/\[填入最低支援版本[^\]]*\]/g, '');
  doReplace(/\[填入專案類型[^\]]*\]/g, '');
  doReplace(/\[填入BIM[^\]]*\]/g, '');
  doReplace(/\[填入餐廳類型[^\]]*\]/g, '');
  doReplace(/\[填入廚房規模[^\]]*\]/g, '');
  doReplace(/\[填入公司類型[^\]]*\]/g, clientIndustry);
  doReplace(/\[填入主管層級[^\]]*\]/g, '');
  doReplace(/\[填入團隊現況[^\]]*\]/g, teamSize);
  doReplace(/\[填入飯店等級[^\]]*\]/g, '');
  doReplace(/\[填入營運規模[^\]]*\]/g, clientSize);
  doReplace(/\[填入電商模式[^\]]*\]/g, '');
  doReplace(/\[填入年營收規模[^\]]*\]/g, '');
  doReplace(/\[填入AI應用領域[^\]]*\]/g, '');
  doReplace(/\[填入研究vs應用比重[^\]]*\]/g, '');
  doReplace(/\[填入產品類別[^\]]*\]/g, '');
  doReplace(/\[填入法規市場[^\]]*\]/g, '');
  doReplace(/\[填入物流類型[^\]]*\]/g, '');
  doReplace(/\[填入數位化程度[^\]]*\]/g, '');
  doReplace(/\[填入製程類型[^\]]*\]/g, '');
  doReplace(/\[填入業務類型[^\]]*\]/g, clientIndustry);
  doReplace(/\[填入數位轉型階段[^\]]*\]/g, '');
  doReplace(/\[填入工作時間[^\]]*\]/g, '');
  doReplace(/\[貼上完整職缺描述[^\]]*\]/g, description || jobTitle);

  // --- 最終兜底：把剩餘的 [填入XXX，如 YYY] 用範例值 YYY 自動補上 ---
  result = result.replace(/\[填入[^\]]*[，,]如\s*([^\]]+)\]/g, (match, example) => {
    count++;
    return example.trim();
  });
  // 去除剩餘沒有「如」範例的 [填入...] — 用 _____ 標記讓使用者知道需手動填
  result = result.replace(/\[填入([^\]]*)\]/g, (match, content) => {
    count++;
    return `_____`;
  });
  // 去除剩餘的 [貼上...]
  result = result.replace(/\[貼上([^\]]*)\]/g, (match) => {
    count++;
    return `_____`;
  });

  // --- 格式 B: {{XXX}} ---
  doReplace(/\{\{產業名稱\}\}/g, clientIndustry);
  doReplace(/\{\{公司名稱\}\}/g, clientCompany || company);
  doReplace(/\{\{公司A名稱\}\}/g, clientCompany || company);
  doReplace(/\{\{公司B名稱\}\}/g, '');
  doReplace(/\{\{職位名稱\}\}/g, jobTitle);
  doReplace(/\{\{職缺描述或 JD\}\}/g, description || jobTitle);
  doReplace(/\{\{貼上完整 JD\}\}/g, description || '');
  doReplace(/\{\{員工人數\}\}/g, clientSize || teamSize);
  doReplace(/\{\{產品描述\}\}/g, description || '');
  doReplace(/\{\{職缺列表\}\}/g, jobTitle);
  doReplace(/\{\{核心技能\}\}/g, skills.join('、'));
  doReplace(/\{\{核心需求\}\}/g, skills.join('、'));
  doReplace(/\{\{核心需求摘要\}\}/g, skills.join('、'));
  doReplace(/\{\{薪資預算\}\}/g, salary);
  doReplace(/\{\{年資範圍\}\}/g, experience);
  doReplace(/\{\{職缺類型\}\}/g, jobTitle);
  doReplace(/\{\{職缺描述\}\}/g, description || jobTitle);
  doReplace(/\{\{期限\}\}/g, '');
  doReplace(/\{\{公開資訊\/評價摘要\}\}/g, '');
  doReplace(/\{\{候選人履歷摘要\}\}/g, '');
  doReplace(/\{\{候選人簡介\}\}/g, '');
  doReplace(/\{\{確認重點\}\}/g, skills.join('、'));
  doReplace(/\{\{現有薪資\}\}/g, '');
  doReplace(/\{\{期望薪資\}\}/g, '');
  doReplace(/\{\{技術權重\}\}/g, '40');
  doReplace(/\{\{問題解決權重\}\}/g, '20');
  doReplace(/\{\{溝通權重\}\}/g, '15');
  doReplace(/\{\{文化權重\}\}/g, '15');
  doReplace(/\{\{成長權重\}\}/g, '10');

  // --- 最終兜底：剩餘的 {{XXX}} 用 _____ 標記 ---
  result = result.replace(/\{\{([^}]+)\}\}/g, (match) => {
    count++;
    return '_____';
  });

  return { filled: result, replacementCount: count };
}

// ============================================================
// DATA: ROLE_KNOWLEDGE_BASE (16 cards)
// ============================================================
const ROLE_KNOWLEDGE_BASE: RoleCard[] = [
  {
    id: 'backend-engineer',
    family: 'Backend',
    title: '後端工程師',
    titleEn: 'Backend Engineer',
    emoji: '⚙️',
    whyExists: '負責系統核心邏輯、API 設計與資料處理。白話來說，就是使用者看不到但整個系統能運作的引擎。',
    dailyWork: [
      '開發 RESTful API 並撰寫 API 文件',
      '設計與優化資料庫 Schema 與查詢效能',
      '撰寫單元測試與整合測試',
      '參與 Code Review，確保程式碼品質',
      '系統效能監控與瓶頸優化',
      '排查線上 Bug 並進行 Hotfix',
      '參與系統架構討論與技術選型',
    ],
    mustHaveSkills: [
      '至少精通一種後端語言（Java / Python / Go / Node.js）',
      'SQL 資料庫操作與設計（PostgreSQL / MySQL）',
      'RESTful API 設計原則與實作',
      'Git 版本控制與分支管理策略',
      'Linux 基礎操作與 Shell 指令',
      '基本資料結構與演算法觀念',
    ],
    niceToHaveSkills: [
      '微服務架構設計與實踐',
      'Docker / Kubernetes 容器化部署',
      '訊息佇列系統（Kafka / RabbitMQ）',
      '雲端服務經驗（AWS / GCP / Azure）',
      'CI/CD 流程建置（GitHub Actions / Jenkins）',
      'NoSQL 資料庫（MongoDB / Redis / Elasticsearch）',
    ],
    techStack: ['Java + Spring Boot', 'Python + Django / FastAPI', 'Go + Gin / Fiber', 'Node.js + Express / NestJS', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'Kafka'],
    salaryRange: { junior: '45K-65K', mid: '70K-100K', senior: '100K-160K+', currency: 'TWD/月' },
    sourceCompanies: ['Shopline', 'Appier', '91APP', 'LINE', 'Gogolook', 'PChome', 'KKday', 'Dcard', '趨勢科技', '國泰金控', '富邦金控', 'Garena'],
    relatedRoles: ['Frontend Engineer', 'DevOps Engineer', 'DBA', 'System Architect', 'QA Engineer'],
    interviewQuestions: [
      '請描述你設計過最複雜的 API 架構，如何處理高併發場景？',
      '資料庫讀寫分離的實作方式與需要注意的一致性問題？',
      '如何設計一個可水平擴展的微服務系統？請畫出架構圖。',
      '分散式系統中如何處理分散式事務？CAP 定理的取捨？',
      '你如何做效能調優？舉例說明從發現問題到解決的完整過程。',
    ],
    redFlags: [
      '只會 CRUD 卻自稱精通系統架構設計',
      '無法解釋所用框架的底層原理與設計模式',
      '沒有寫測試的習慣，認為測試是 QA 的事',
      '完全不了解部署流程，只負責「寫完丟給 DevOps」',
      '面對效能問題只會說「加機器」而無具體優化思路',
    ],
    howToVerify: [
      '請候選人畫出最近專案的系統架構圖並解釋設計考量',
      '追問具體 QPS / TPS 數據與壓力測試結果',
      '給一段有問題的 SQL，請候選人優化並解釋 Execution Plan',
      '討論一個 race condition 場景，看解決思路',
      '請說明從 commit 到 production 的完整部署流程',
    ],
    commonMistakes: [
      '只看語言不看系統設計能力，錯過跨語言優秀人才',
      '過度強調演算法題，忽略實際工程經驗',
      '混淆 Junior 與 Mid-level 的職責範圍',
      '忽略 soft skills 如溝通能力與文件撰寫習慣',
    ],
    careerPath: 'Junior → Mid → Senior → Staff → Principal / Architect → CTO',
    promptTemplate: `你是一位資深獵頭顧問，正在為客戶尋找後端工程師。請根據以下職缺需求，幫我：
1. 分析這個後端工程師職缺的核心技能需求（必備 vs 加分）
2. 建議 5 個最適合挖角的目標公司及原因
3. 列出面試中應該深入追問的 3 個技術問題
4. 提供紅旗警示清單（哪些回答代表候選人可能不適合）

職缺描述：[貼上完整職缺描述 JD]
公司規模：[填入公司規模，如 50-200人]
技術棧：[填入技術棧，如 Java, Spring Boot]`,
  },
  {
    id: 'frontend-engineer',
    family: 'Frontend',
    title: '前端工程師',
    titleEn: 'Frontend Engineer',
    emoji: '🎨',
    whyExists: '負責使用者介面開發與互動體驗，是產品與使用者之間的橋樑。白話來說，就是你在網頁或 App 上看到的所有畫面和操作。',
    dailyWork: [
      '開發響應式網頁介面與互動元件',
      '與 UI/UX 設計師協作，實現設計稿',
      '串接後端 API 處理資料流',
      '效能優化（首屏載入、渲染效能、打包體積）',
      '撰寫前端測試（Unit / Integration / E2E）',
      '維護前端共用元件庫與設計系統',
      '處理跨瀏覽器相容性問題',
    ],
    mustHaveSkills: [
      'HTML5 / CSS3 / JavaScript（ES6+）紮實基礎',
      '至少精通一個主流框架（React / Vue / Angular）',
      '響應式設計（RWD）與行動端適配',
      'RESTful API 串接與非同步處理',
      'Git 版本控制',
      '瀏覽器開發者工具使用與除錯',
    ],
    niceToHaveSkills: [
      'TypeScript 靜態型別系統',
      '狀態管理方案（Redux / Vuex / Zustand）',
      'Next.js / Nuxt.js 等 SSR/SSG 框架',
      '前端測試框架（Jest / Cypress / Playwright）',
      'Webpack / Vite 等打包工具設定',
      'Web 效能優化與 Core Web Vitals',
    ],
    techStack: ['React', 'Vue.js', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Webpack / Vite', 'Jest / Vitest', 'Cypress / Playwright', 'Storybook'],
    salaryRange: { junior: '40K-60K', mid: '65K-95K', senior: '95K-150K+', currency: 'TWD/月' },
    sourceCompanies: ['Dcard', 'LINE', 'Shopline', '17Live', 'CakeResume', 'KKday', 'Pinkoi', 'Hahow', 'PressPlay', '街口支付', '國泰金控', 'Gogolook'],
    relatedRoles: ['Backend Engineer', 'UI/UX Designer', 'Fullstack Engineer', 'QA Engineer', 'Product Manager'],
    interviewQuestions: [
      '解釋 React 的 Virtual DOM diffing 機制與其效能考量',
      '如何優化一個首屏載入時間超過 5 秒的 SPA 應用？',
      '描述你如何設計一個可複用的元件庫，考慮哪些因素？',
      '什麼是 CSR / SSR / SSG / ISR？各適用什麼場景？',
      '你如何處理前端狀態管理？在什麼情況下會引入全域狀態？',
    ],
    redFlags: [
      '只會套版不理解 CSS 原理，遇到客製化排版就卡住',
      '不了解瀏覽器渲染機制，無法解釋 reflow/repaint',
      '完全不寫測試也不了解測試策略',
      '只用過一個框架且無法說明其設計哲學差異',
      '不關注 Web 標準與無障礙（a11y）議題',
    ],
    howToVerify: [
      '給一個 Figma 設計稿，觀察候選人如何拆解元件結構',
      '請說明最近做過的效能優化，具體改善了哪些指標',
      '現場 Live Coding 一個小型互動元件',
      '討論如何處理 API 失敗、loading 與 error 狀態',
      '請解釋專案中使用的狀態管理方案及選擇原因',
    ],
    commonMistakes: [
      '只看框架熟悉度而忽略 JavaScript 基礎功力',
      '將前端工程師等同於「切版人員」，低估技術深度',
      '忽略候選人的 UI 美感與使用者體驗敏感度',
      '不區分 React Developer 與 Frontend Engineer 的差異',
    ],
    careerPath: 'Junior → Mid → Senior → Staff → Frontend Architect → Engineering Manager',
    promptTemplate: `你是一位資深獵頭顧問，正在為客戶尋找前端工程師。請根據以下職缺需求，幫我：
1. 分析這個前端工程師職缺的技術深度要求
2. 判斷這是偏 UI 實作還是偏工程架構的角色
3. 建議最適合挖角的目標公司
4. 列出面試中應該深入追問的技術問題

職缺描述：[貼上完整職缺描述 JD]
框架要求：[填入框架，如 React, Vue]
團隊規模：[填入團隊人數，如 10人]`,
  },
  {
    id: 'fullstack-engineer',
    family: 'Fullstack',
    title: '全端工程師',
    titleEn: 'Fullstack Engineer',
    emoji: '🔄',
    whyExists: '同時具備前後端開發能力，能獨立完成完整功能。在新創公司特別吃香，一人抵多人用。',
    dailyWork: [
      '獨立開發完整功能（前端介面 + 後端 API + 資料庫）',
      '快速原型開發與 MVP 迭代',
      '系統架構規劃與技術選型',
      '前後端整合測試與除錯',
      '部署與維運基礎設施管理',
      '技術文件撰寫與知識分享',
    ],
    mustHaveSkills: [
      '前端框架（React / Vue）+ 後端框架（Express / Django / Spring）',
      '資料庫設計與操作（SQL + NoSQL）',
      'RESTful API 或 GraphQL 設計',
      'Git 版本控制與協作流程',
      '基本 DevOps 概念（部署、CI/CD）',
      '問題診斷與全鏈路除錯能力',
    ],
    niceToHaveSkills: [
      'Next.js / Nuxt.js 全端框架',
      '雲端服務部署（AWS / GCP / Vercel）',
      'Docker 容器化',
      '效能監控與 APM 工具',
      '行動端開發（React Native / Flutter）',
      '系統設計與架構模式',
    ],
    techStack: ['React + Node.js', 'Vue + Python', 'Next.js', 'TypeScript', 'PostgreSQL', 'MongoDB', 'Docker', 'Vercel / AWS', 'Prisma / TypeORM'],
    salaryRange: { junior: '45K-65K', mid: '70K-110K', senior: '110K-170K+', currency: 'TWD/月' },
    sourceCompanies: ['新創公司（YC / AppWorks 系）', 'Hahow', 'PressPlay', 'ALPHA Camp', 'Pinkoi', '25sprout', 'Gogolook', 'iCHEF', 'Omlet Arcade', 'Sudo Pay', 'Dcard', 'CakeResume'],
    relatedRoles: ['Frontend Engineer', 'Backend Engineer', 'DevOps Engineer', 'Product Manager', 'Tech Lead'],
    interviewQuestions: [
      '請描述你如何從零搭建一個完整的 Web 應用？技術選型考量是什麼？',
      '前後端同時開發時，如何確保 API 契約一致性？',
      '在資源有限的新創環境，你如何做技術債的取捨？',
      '分享一個你同時處理前後端 Bug 的除錯過程',
      '如何設計一個能隨團隊擴大而拆分的單體應用架構？',
    ],
    redFlags: [
      '前後端都只會皮毛，兩邊都不深入',
      '只做過 Todo App 等級的全端專案',
      '無法解釋前後端如何協作與分工的策略',
      '不了解安全性議題（XSS / CSRF / SQL Injection）',
      '對部署流程完全陌生，只在本地開發過',
    ],
    howToVerify: [
      '請說明最近一個完整從前端到後端的功能開發流程',
      '系統設計白板題：設計一個即時聊天系統的前後端架構',
      '討論 SSR vs CSR 的選擇場景與效能影響',
      '請畫出專案的資料流向圖（從使用者操作到資料庫）',
      '詢問在團隊中如何與專職前/後端工程師分工協作',
    ],
    commonMistakes: [
      '以為全端就是前後端各 50%，忽略 T 型技能的重要性',
      '混淆全端工程師與「什麼都做的工程師」',
      '不區分新創全端與大公司全端的要求差異',
      '忽略全端工程師的系統設計能力評估',
    ],
    careerPath: 'Junior Fullstack → Mid Fullstack → Senior Fullstack → Tech Lead → Engineering Manager / CTO',
    promptTemplate: `你是一位資深獵頭顧問，正在為客戶尋找全端工程師。請根據以下需求幫我分析：
1. 這個職缺更偏前端還是後端？全端的比重如何？
2. 適合從新創還是大公司挖人？為什麼？
3. 必備技能 vs 加分技能的優先排序
4. 面試重點應放在哪些面向？

職缺描述：[貼上完整職缺描述 JD]
公司階段：[填入公司階段，如 新創/成長期]
團隊現況：[填入團隊現況，如 3前端2後端]`,
  },
  {
    id: 'devops-engineer',
    family: 'DevOps',
    title: 'DevOps 工程師',
    titleEn: 'DevOps Engineer',
    emoji: '🚀',
    whyExists: '負責建立與維護軟體交付流程，確保程式碼從開發到上線的過程自動化、穩定且可靠。白話來說，就是讓開發團隊能安心、快速地發布新功能。',
    dailyWork: [
      '建置與維護 CI/CD Pipeline（自動建構、測試、部署）',
      '管理雲端基礎設施（AWS / GCP / Azure）',
      '撰寫 Infrastructure as Code（Terraform / Pulumi）',
      '監控系統健康狀態與設定告警（Grafana / Datadog）',
      '處理生產環境事件（Incident Response）',
      '容器編排與管理（Docker / Kubernetes）',
      '安全性掃描與合規性檢查',
    ],
    mustHaveSkills: [
      'Linux 系統管理與 Shell Scripting',
      'Docker 容器化技術',
      'CI/CD 工具（GitHub Actions / GitLab CI / Jenkins）',
      '至少一個雲端平台（AWS / GCP / Azure）',
      'Infrastructure as Code（Terraform / CloudFormation）',
      '基本網路概念（DNS / Load Balancer / VPN）',
    ],
    niceToHaveSkills: [
      'Kubernetes 叢集管理與調優',
      '監控與可觀測性（Prometheus / Grafana / ELK）',
      '資安最佳實踐與合規框架',
      'GitOps 流程（ArgoCD / Flux）',
      'Service Mesh（Istio / Linkerd）',
      'Chaos Engineering 實踐',
    ],
    techStack: ['Docker', 'Kubernetes', 'Terraform', 'AWS / GCP', 'GitHub Actions', 'Prometheus + Grafana', 'ArgoCD', 'Ansible', 'Vault'],
    salaryRange: { junior: '50K-70K', mid: '80K-120K', senior: '120K-180K+', currency: 'TWD/月' },
    sourceCompanies: ['LINE', 'Shopline', '趨勢科技', 'Appier', '91APP', 'KKday', 'Dcard', '國泰金控', '富邦金控', 'Garena', 'GoFreight', 'Synology'],
    relatedRoles: ['Backend Engineer', 'SRE', 'System Administrator', 'Security Engineer', 'Cloud Architect'],
    interviewQuestions: [
      '請描述你建置過的 CI/CD Pipeline，從 commit 到 production 的完整流程',
      '如何設計一個零停機部署策略？Blue-Green 與 Canary 的差異？',
      '生產環境發生嚴重事故時，你的 Incident Response 流程是什麼？',
      'Infrastructure as Code 的最佳實踐？如何管理多環境的基礎設施？',
      'Kubernetes 的 Pod 一直 CrashLoopBackOff，你的排查步驟是什麼？',
    ],
    redFlags: [
      '只會手動操作伺服器，不了解 IaC 概念',
      '無法解釋 CI/CD 的完整流程與各階段意義',
      '對安全性毫無概念（密鑰管理、網路隔離等）',
      '只會用 GUI 操作雲端，不熟悉 CLI 與 API',
      '沒有 Incident Response 經驗與 On-call 概念',
    ],
    howToVerify: [
      '請畫出你負責的基礎設施架構圖',
      '詢問具體的 SLA/SLO 數據（可用性百分比、MTTR）',
      '請說明最近一次重大事故的處理過程與事後改善',
      '討論 Terraform state 管理策略',
      '請解釋你的監控策略：監控哪些指標、告警規則如何設計',
    ],
    commonMistakes: [
      '把 DevOps 等同於「會用 Docker」的人',
      '忽略 DevOps 工程師的軟技能（跨團隊溝通、文件撰寫）',
      '不區分 DevOps、SRE、Platform Engineer 的差異',
      '只看工具經驗不看系統設計與問題解決能力',
    ],
    careerPath: 'Junior DevOps → Mid DevOps → Senior DevOps → Staff / Platform Engineer → Cloud Architect → VP of Infrastructure',
    promptTemplate: `你是一位資深獵頭顧問，正在為客戶尋找 DevOps 工程師。請根據以下需求分析：
1. 這個職缺偏 DevOps 還是 SRE？關鍵差異是什麼？
2. 雲端經驗需求的深度評估
3. 建議挖角的目標公司與原因
4. 面試中如何驗證候選人的實戰經驗

職缺描述：[貼上完整職缺描述 JD]
雲端環境：[填入雲端環境，如 AWS/GCP]
團隊規模：[填入團隊人數，如 10人]`,
  },
  {
    id: 'qa-engineer',
    family: 'QA',
    title: '品質保證工程師',
    titleEn: 'QA Engineer',
    emoji: '🔍',
    whyExists: '負責確保軟體品質，從測試策略制定到自動化測試實施，是產品上線前的最後一道防線。',
    dailyWork: [
      '制定測試計畫與測試策略',
      '撰寫與執行測試案例（手動 + 自動化）',
      '開發自動化測試腳本（UI / API / 效能）',
      'Bug 回報、追蹤與驗證',
      '參與需求審查，提早發現潛在品質風險',
      '持續改善測試流程與品質指標',
    ],
    mustHaveSkills: [
      '測試方法論（黑箱 / 白箱 / 灰箱測試）',
      '測試案例設計技巧（等價分割、邊界值分析）',
      '至少一種自動化測試工具（Selenium / Cypress / Playwright）',
      'API 測試工具（Postman / REST Assured）',
      'Bug 追蹤系統操作（Jira / Linear）',
      '基本 SQL 查詢能力',
    ],
    niceToHaveSkills: [
      '效能測試工具（JMeter / k6 / Locust）',
      'CI/CD 整合測試經驗',
      '程式設計能力（Python / JavaScript）',
      '行動端測試（Appium / XCUITest）',
      '安全性測試基礎知識',
      '測試管理工具（TestRail / Zephyr）',
    ],
    techStack: ['Selenium', 'Cypress', 'Playwright', 'Postman', 'JMeter', 'k6', 'Jira', 'Python / JavaScript', 'Appium'],
    salaryRange: { junior: '38K-55K', mid: '55K-80K', senior: '80K-120K+', currency: 'TWD/月' },
    sourceCompanies: ['趨勢科技', 'LINE', 'Shopline', 'Garena', '91APP', 'Dcard', 'KKday', '國泰金控', '中華電信', 'PChome', '緯創資通', 'Synology'],
    relatedRoles: ['Backend Engineer', 'Frontend Engineer', 'DevOps Engineer', 'Product Manager', 'SDET'],
    interviewQuestions: [
      '你如何決定哪些測試要自動化、哪些保持手動？',
      '描述你建立過的測試自動化框架架構',
      '如何設計一個電商結帳流程的測試計畫？',
      '在敏捷開發中，QA 如何與開發團隊高效協作？',
      '你如何衡量測試的有效性？使用哪些品質指標？',
    ],
    redFlags: [
      '只會手動點擊測試，完全不了解自動化',
      '無法系統性地設計測試案例',
      '認為 QA 只是「找 Bug」的角色',
      '不了解測試金字塔概念',
      '無法解釋如何在時間壓力下做測試範圍的取捨',
    ],
    howToVerify: [
      '給一個功能需求，請當場設計測試案例',
      '請展示或描述你建立的自動化測試架構',
      '詢問具體的測試覆蓋率數據與改善過程',
      '討論一個你發現重大 Bug 的案例，如何定位與回報',
      '請說明你的測試環境管理方式',
    ],
    commonMistakes: [
      '將 QA 等同於手動測試人員',
      '忽略 QA 的技術深度需求（自動化、效能測試）',
      '不區分 QA Engineer 與 SDET 的差異',
      '低估 QA 在敏捷團隊中的策略性角色',
    ],
    careerPath: 'Junior QA → Mid QA → Senior QA / SDET → QA Lead → QA Manager → Director of Quality',
    promptTemplate: `你是一位資深獵頭顧問，正在為客戶尋找 QA 工程師。請根據以下需求分析：
1. 這個職缺偏手動測試還是自動化測試？
2. 技術深度要求評估（純 QA vs SDET）
3. 合適的候選人背景與轉型路徑
4. 面試中如何驗證測試思維與能力

職缺描述：[貼上完整職缺描述 JD]
產品類型：[填入產品類型，如 電商SaaS]
開發流程：[填入開發流程，如 Scrum/Kanban]`,
  },
  {
    id: 'security-engineer',
    family: 'Security',
    title: '資安工程師',
    titleEn: 'Security Engineer',
    emoji: '🛡️',
    whyExists: '負責保護公司系統與資料安全，從滲透測試到安全架構設計，是對抗駭客攻擊的核心角色。',
    dailyWork: [
      '執行滲透測試與弱點掃描',
      '設計與審查安全架構',
      '建立安全政策與合規框架',
      '安全事件調查與應變處理（Incident Response）',
      '安全意識教育訓練',
      '審查程式碼的安全性（Code Security Review）',
      '管理 SIEM 與安全監控系統',
    ],
    mustHaveSkills: [
      '網路安全基礎（TCP/IP / 防火牆 / IDS/IPS）',
      'Web 安全（OWASP Top 10 / XSS / SQL Injection）',
      '滲透測試工具（Burp Suite / Metasploit / Nmap）',
      '作業系統安全（Linux / Windows）',
      '密碼學基礎與 PKI 架構',
      '安全合規框架（ISO 27001 / NIST）',
    ],
    niceToHaveSkills: [
      '雲端安全（AWS Security / GCP Security）',
      '容器安全（Docker / Kubernetes Security）',
      '程式碼審計與安全開發生命週期（SDL）',
      '逆向工程與惡意程式分析',
      '紅隊 / 藍隊實戰經驗',
      '資安證照（OSCP / CEH / CISSP）',
    ],
    techStack: ['Burp Suite', 'Metasploit', 'Nmap', 'Wireshark', 'SIEM（Splunk / ELK）', 'Terraform（安全配置）', 'Vault', 'AWS Security Hub', 'Snyk'],
    salaryRange: { junior: '50K-70K', mid: '80K-120K', senior: '120K-180K+', currency: 'TWD/月' },
    sourceCompanies: ['趨勢科技', '奧義智慧', 'TeamT5', '中華資安', 'DEVCORE', '安華聯網', '國泰金控', '富邦金控', 'LINE', '中華電信', '台積電', '金管會'],
    relatedRoles: ['DevOps Engineer', 'Backend Engineer', 'System Administrator', 'GRC Analyst', 'SOC Analyst'],
    interviewQuestions: [
      '描述一次你發現重大安全漏洞的完整過程',
      '如何設計一個安全的身份驗證系統？',
      'OWASP Top 10 中你認為最常被忽略的是哪個？為什麼？',
      '說明你處理過的安全事件，從發現到修復的完整時間線',
      '如何在不影響開發速度的前提下導入安全開發流程？',
    ],
    redFlags: [
      '只考過證照但沒有實際滲透測試或事件處理經驗',
      '對最新的攻擊手法與漏洞趨勢完全不了解',
      '只懂攻擊不懂防禦，或只懂防禦不懂攻擊',
      '無法用白話解釋安全風險給非技術人員',
      '對合規只做表面功夫，不理解背後的安全原理',
    ],
    howToVerify: [
      '請描述一個 Web 應用的完整滲透測試流程',
      '給一段有安全漏洞的程式碼，請候選人找出問題',
      '討論在雲端環境中的安全最佳實踐',
      '詢問最近研究過的 CVE 漏洞及其影響',
      '請說明如何建立安全事件應變計畫',
    ],
    commonMistakes: [
      '過度看重證照而忽略實際能力',
      '不區分不同資安領域（紅隊/藍隊/GRC/應用安全）',
      '低估資安人才的薪資水準（資安人才稀缺）',
      '把資安工程師當作「IT + 安全」的混合角色',
    ],
    careerPath: 'Junior Security → Mid Security → Senior Security → Security Architect → CISO',
    promptTemplate: `你是一位資深獵頭顧問，正在為客戶尋找資安工程師。請根據以下需求分析：
1. 這個職缺偏攻擊面（紅隊）還是防禦面（藍隊）？
2. 所需的資安專長領域分析
3. 合適的目標公司與人才庫
4. 面試中如何驗證實戰能力（非僅證照）

職缺描述：[貼上完整職缺描述 JD]
產業別：[填入產業別，如 金融/電商]
合規需求：[填入合規需求，如 ISO27001]`,
  },
  {
    id: 'product-manager',
    family: 'PM',
    title: '產品經理',
    titleEn: 'Product Manager',
    emoji: '📊',
    whyExists: '負責定義產品方向與功能規劃，是商業需求與技術實現之間的橋樑。白話來說，就是決定「做什麼」以及「為什麼做」的人。',
    dailyWork: [
      '收集與分析用戶需求和市場資訊',
      '撰寫產品需求文件（PRD）與使用者故事',
      '定義產品路線圖與功能優先級',
      '與工程、設計、行銷等團隊協作推動功能開發',
      '追蹤產品數據指標（DAU / 留存率 / 轉換率）',
      '規劃與主持 Sprint Planning / Review',
      '競品分析與市場調研',
    ],
    mustHaveSkills: [
      '產品思維與用戶洞察能力',
      '需求分析與功能拆解',
      '數據分析工具（Google Analytics / Mixpanel / SQL）',
      '專案管理工具（Jira / Linear / Notion）',
      '跨部門溝通與利害關係人管理',
      '基本技術理解（API / 資料庫 / 系統架構概念）',
    ],
    niceToHaveSkills: [
      'A/B 測試設計與分析',
      'UI/UX 設計基礎（Figma / 原型工具）',
      'SQL 查詢能力',
      '敏捷開發方法論（Scrum / Kanban）',
      '商業模式分析（Business Model Canvas）',
      '程式設計基礎（理解技術可行性）',
    ],
    techStack: ['Jira / Linear', 'Figma', 'Notion / Confluence', 'Google Analytics', 'Mixpanel / Amplitude', 'SQL', 'Miro / FigJam'],
    salaryRange: { junior: '45K-65K', mid: '70K-110K', senior: '110K-170K+', currency: 'TWD/月' },
    sourceCompanies: ['LINE', 'Shopline', 'Dcard', 'KKday', 'Pinkoi', '街口支付', '91APP', 'CakeResume', 'Hahow', '國泰金控', 'PChome', 'momo'],
    relatedRoles: ['UI/UX Designer', 'Frontend Engineer', 'Data Analyst', 'Project Manager', 'Business Analyst'],
    interviewQuestions: [
      '請分享一個你從零到一打造的產品功能，完整過程如何？',
      '當工程資源有限時，你如何決定功能的優先順序？',
      '你如何衡量一個功能是否成功？用什麼指標？',
      '描述一次你與工程團隊意見衝突的經驗，如何解決？',
      '如果今天要你改善我們產品的首頁轉換率，你會怎麼做？',
    ],
    redFlags: [
      '只會寫 PRD 但不了解技術實現的限制',
      '無法用數據支撐產品決策，只靠直覺',
      '把自己定位為「功能傳話筒」而非「產品擁有者」',
      '不做使用者研究，僅憑老闆指示做產品',
      '無法清楚說明產品的核心價值主張（Value Proposition）',
    ],
    howToVerify: [
      '請用 5 分鐘 Pitch 你最得意的產品功能',
      '給一個產品情境題，觀察分析與拆解需求的思路',
      '詢問具體的產品指標改善案例（數字佐證）',
      '討論如何做 Trade-off：功能完整性 vs 上線速度',
      '請說明你的使用者研究方法與頻率',
    ],
    commonMistakes: [
      '混淆「產品經理」與「專案經理」的角色定位',
      '只看產業經驗而忽略產品思維與邏輯能力',
      '不了解不同類型 PM 的差異（B2B / B2C / Platform / Growth）',
      '忽略 PM 的技術素養評估',
    ],
    careerPath: 'Associate PM → PM → Senior PM → Group PM / Director → VP of Product → CPO',
    promptTemplate: `你是一位資深獵頭顧問，正在為客戶尋找產品經理。請根據以下需求分析：
1. 這個 PM 職缺的類型（B2B / B2C / Growth / Platform）
2. 產業經驗 vs 產品思維的重要性比較
3. 建議的人才來源與挖角策略
4. 面試中如何評估產品思維與領導力

職缺描述：[貼上完整職缺描述 JD]
產品類型：[填入產品類型，如 電商SaaS]
使用者規模：[填入使用者規模，如 10萬MAU]`,
  },
  {
    id: 'uiux-designer',
    family: 'UIUX',
    title: 'UI/UX 設計師',
    titleEn: 'UI/UX Designer',
    emoji: '🎯',
    whyExists: '負責研究使用者需求並設計直覺、美觀的產品介面與體驗。白話來說，就是讓產品好用又好看的人。',
    dailyWork: [
      '使用者研究（訪談 / 問卷 / 可用性測試）',
      '繪製 Wireframe 與互動原型',
      '設計高保真 UI 視覺稿',
      '建立與維護設計系統（Design System）',
      '與 PM、工程師協作確保設計落地',
      '資料驅動的設計迭代（分析使用行為數據）',
    ],
    mustHaveSkills: [
      'Figma 設計工具精通',
      '使用者研究方法論',
      '互動設計（Interaction Design）原則',
      '視覺設計基礎（排版 / 色彩 / 字體）',
      '設計系統建立與管理',
      '可用性測試規劃與執行',
    ],
    niceToHaveSkills: [
      '動態設計（Framer / Principle / After Effects）',
      '前端基礎知識（HTML / CSS）',
      '數據分析能力（理解行為數據）',
      '設計思考（Design Thinking）引導能力',
      'Accessibility（無障礙設計）',
      '商業策略理解',
    ],
    techStack: ['Figma', 'Sketch', 'Adobe XD', 'Framer', 'Principle', 'Miro / FigJam', 'Zeplin / Storybook', 'Hotjar / FullStory'],
    salaryRange: { junior: '38K-55K', mid: '55K-85K', senior: '85K-130K+', currency: 'TWD/月' },
    sourceCompanies: ['LINE', 'Dcard', 'Pinkoi', 'Gogolook', 'Hahow', 'PressPlay', 'CakeResume', '街口支付', 'KKday', '91APP', '國泰金控', 'KKBOX'],
    relatedRoles: ['Product Manager', 'Frontend Engineer', 'Graphic Designer', 'UX Researcher', 'Design Manager'],
    interviewQuestions: [
      '請展示你的作品集，說明設計決策背後的思考過程',
      '描述一次你透過使用者研究改變了產品方向的經驗',
      '你如何處理 PM 或老闆的設計意見與你專業判斷的衝突？',
      '如何設計一個讓新使用者快速上手的 Onboarding 流程？',
      '你如何衡量設計的成功？用什麼指標追蹤？',
    ],
    redFlags: [
      '只注重視覺美感，不關心使用者需求與體驗',
      '作品集只有成品圖，看不到設計過程與思考脈絡',
      '不做使用者研究，設計決策完全來自個人偏好',
      '不了解設計與開發的協作流程（Design Handoff）',
      '對數據驅動的設計迭代毫無概念',
    ],
    howToVerify: [
      '深入討論作品集中某個專案的完整設計過程',
      '給一個設計挑戰題，觀察思考與解決問題的方式',
      '詢問與工程師協作的具體流程（組件命名 / 標註 / 切圖）',
      '請說明最近一次可用性測試的發現與設計改善',
      '討論設計系統的建立經驗與維護策略',
    ],
    commonMistakes: [
      '只看作品集的視覺品質，忽略設計思維與過程',
      '混淆 UI Designer、UX Designer 與 UX Researcher 的差異',
      '不評估候選人與開發團隊的協作能力',
      '忽略對商業目標的理解與數據敏感度',
    ],
    careerPath: 'Junior Designer → Mid Designer → Senior Designer → Lead Designer → Design Manager → Head of Design',
    promptTemplate: `你是一位資深獵頭顧問，正在為客戶尋找 UI/UX 設計師。請根據以下需求分析：
1. 這個職缺偏 UI（視覺）還是 UX（體驗研究）？
2. 需要的設計成熟度與帶人能力
3. 合適的人才來源（設計公司 vs 產品公司）
4. 作品集審查的重點與面試設計

職缺描述：[貼上完整職缺描述 JD]
產品類型：[填入產品類型，如 電商SaaS]
設計團隊現況：[填入設計團隊現況，如 2位設計師]`,
  },
  {
    id: 'data-engineer',
    family: 'Data',
    title: '資料工程師',
    titleEn: 'Data Engineer',
    emoji: '🔧',
    whyExists: '負責建構與維護資料基礎設施，確保數據從各來源被正確地擷取、轉換、儲存，供分析師與科學家使用。白話來說，就是幫公司鋪設「資料高速公路」的人。',
    dailyWork: [
      '設計與建構 ETL / ELT 資料管道',
      '管理資料倉儲（Data Warehouse）架構',
      '確保資料品質與一致性（Data Quality）',
      '優化資料查詢效能（Partitioning / Indexing）',
      '建立資料監控與告警機制',
      '與資料科學家、分析師協作定義資料需求',
    ],
    mustHaveSkills: [
      'SQL 精通（複雜查詢 / Window Function / CTE）',
      'Python / Scala 程式設計',
      'ETL 工具或框架（Airflow / dbt / Spark）',
      '資料倉儲概念（Star Schema / Snowflake Schema）',
      '雲端資料服務（BigQuery / Redshift / Snowflake）',
      '資料品質管理概念',
    ],
    niceToHaveSkills: [
      '串流處理（Kafka / Flink / Spark Streaming）',
      '資料治理與 Data Catalog 工具',
      '資料湖架構（Delta Lake / Iceberg）',
      'CI/CD for Data Pipeline',
      'Data Mesh / Data Fabric 架構概念',
      '基本 ML Pipeline 建構經驗',
    ],
    techStack: ['Apache Airflow', 'dbt', 'Apache Spark', 'BigQuery', 'Snowflake', 'Kafka', 'Python', 'SQL', 'Terraform'],
    salaryRange: { junior: '45K-65K', mid: '75K-110K', senior: '110K-160K+', currency: 'TWD/月' },
    sourceCompanies: ['Appier', 'LINE', 'Shopline', '91APP', 'Dcard', 'momo', 'PChome', '國泰金控', '富邦金控', '玉山銀行', 'iCHEF', 'GoFreight'],
    relatedRoles: ['Data Scientist', 'Data Analyst', 'Backend Engineer', 'DevOps Engineer', 'ML Engineer'],
    interviewQuestions: [
      '描述你設計過最複雜的 Data Pipeline，處理哪些資料來源與挑戰？',
      '如何確保 Data Pipeline 的可靠性與資料品質？',
      '批次處理 vs 串流處理的選擇標準是什麼？',
      '當 Data Pipeline 失敗時，你的除錯與修復流程？',
      '如何設計一個可擴展的資料倉儲架構？',
    ],
    redFlags: [
      '只會寫 SQL 查詢但不了解資料架構設計',
      '沒有處理大量資料的實際經驗',
      '不了解資料品質的重要性與管理方法',
      '對串流處理與批次處理的差異不清楚',
      '無法解釋 Slowly Changing Dimension 等基本概念',
    ],
    howToVerify: [
      '請畫出你負責的資料架構全景圖',
      '給一個 ETL 需求場景，觀察設計思路',
      '詢問處理過的最大資料量及效能優化方法',
      '討論資料品質問題的發現與解決案例',
      '請說明 Data Pipeline 的監控策略',
    ],
    commonMistakes: [
      '混淆 Data Engineer 與 Data Analyst 的職責',
      '忽略工程能力（只看 SQL 不看程式設計）',
      '不了解現代資料技術棧（還在用十年前的工具）',
      '低估資料工程師的薪資水平',
    ],
    careerPath: 'Junior Data Engineer → Mid Data Engineer → Senior Data Engineer → Staff Data Engineer → Data Platform Lead → Head of Data',
    promptTemplate: `你是一位資深獵頭顧問，正在為客戶尋找資料工程師。請根據以下需求分析：
1. 這個職缺的資料處理規模與技術深度
2. 偏 ETL 建構還是資料架構設計？
3. 目標人才的技術背景組合
4. 面試中如何驗證大數據處理經驗

職缺描述：[貼上完整職缺描述 JD]
資料規模：[填入資料規模，如 日處理100GB]
技術棧：[填入技術棧，如 Java, Spring Boot]`,
  },
  {
    id: 'data-scientist',
    family: 'Data',
    title: '資料科學家',
    titleEn: 'Data Scientist',
    emoji: '🧪',
    whyExists: '運用統計分析與機器學習技術從數據中發掘商業洞察，協助公司做更好的決策。白話來說，就是用數學和程式「讓資料說話」的人。',
    dailyWork: [
      '探索性數據分析（EDA）',
      '建構與訓練機器學習模型',
      '設計與分析 A/B 測試',
      '撰寫分析報告並向利害關係人簡報',
      '與工程團隊合作將模型部署上線',
      '定義商業指標與評估模型效果',
    ],
    mustHaveSkills: [
      'Python 資料科學生態系（Pandas / NumPy / Scikit-learn）',
      '統計學基礎（假設檢定 / 回歸分析 / 貝氏統計）',
      'SQL 數據查詢與分析',
      '機器學習演算法（分類 / 迴歸 / 聚類）',
      '資料視覺化（Matplotlib / Seaborn / Plotly）',
      '實驗設計與 A/B 測試方法',
    ],
    niceToHaveSkills: [
      '深度學習框架（PyTorch / TensorFlow）',
      '自然語言處理（NLP）',
      '推薦系統設計',
      '大數據工具（Spark / Hadoop）',
      'MLOps（模型部署 / 監控 / 版本管理）',
      '因果推論（Causal Inference）',
    ],
    techStack: ['Python', 'Jupyter Notebook', 'Pandas', 'Scikit-learn', 'PyTorch / TensorFlow', 'SQL', 'Spark', 'MLflow', 'Tableau / Power BI'],
    salaryRange: { junior: '50K-70K', mid: '80K-120K', senior: '120K-180K+', currency: 'TWD/月' },
    sourceCompanies: ['Appier', 'LINE', 'Dcard', '國泰金控', '富邦金控', '玉山銀行', 'momo', 'Gogolook', '趨勢科技', 'KKBOX', '工研院', '中研院'],
    relatedRoles: ['Data Engineer', 'ML Engineer', 'Data Analyst', 'Backend Engineer', 'Product Manager'],
    interviewQuestions: [
      '描述一個你的模型為公司帶來實際商業價值的案例',
      '如何處理嚴重不平衡的分類資料集？',
      '請解釋 Bias-Variance Tradeoff 與實際調參策略',
      '如何設計一個 A/B 測試？需要多少樣本量？',
      '模型部署後效能下降（Model Drift），你如何發現與處理？',
    ],
    redFlags: [
      '只會跑模型但不理解統計原理',
      '無法解釋模型結果的商業意義',
      '沒有將模型部署上線的實際經驗',
      '過度追求模型準確度而忽略商業可行性',
      '不了解資料偏差（Data Bias）的影響',
    ],
    howToVerify: [
      '請用白話解釋你建的模型在做什麼、為什麼這樣選擇',
      '討論一個模型效果不好的案例，如何診斷與改善',
      '給一個商業問題，觀察如何轉化為資料科學問題',
      '詢問特徵工程的具體做法與選擇邏輯',
      '請說明模型從開發到上線的完整流程',
    ],
    commonMistakes: [
      '只看學歷論文不看實際應用能力',
      '混淆 Data Scientist 與 Data Analyst 的角色定位',
      '不了解業界 DS 與學界 DS 的工作差異',
      '忽略溝通與簡報能力的重要性',
    ],
    careerPath: 'Junior DS → Mid DS → Senior DS → Lead DS → Principal DS → Head of Data Science',
    promptTemplate: `你是一位資深獵頭顧問，正在為客戶尋找資料科學家。請根據以下需求分析：
1. 這個職缺偏研究型還是應用型 DS？
2. 所需的 ML / 統計專長領域
3. 學界 vs 業界人才的適合度
4. 面試中如何評估實際問題解決能力

職缺描述：[貼上完整職缺描述 JD]
應用場景：[填入應用場景，如 推薦系統]
資料規模：[填入資料規模，如 日處理100GB]`,
  },
  {
    id: 'ios-engineer',
    family: 'Mobile',
    title: 'iOS 工程師',
    titleEn: 'iOS Engineer',
    emoji: '📱',
    whyExists: '負責 Apple 生態系（iPhone / iPad）的應用程式開發，提供流暢的行動端使用體驗。',
    dailyWork: [
      '使用 Swift / SwiftUI 開發 iOS 應用功能',
      '與 UI/UX 設計師協作實現介面設計',
      '串接後端 API 與處理資料快取',
      '效能優化（記憶體 / 電量 / 啟動速度）',
      'App Store 上架與版本管理',
      '處理 Apple 審核回饋與合規要求',
    ],
    mustHaveSkills: [
      'Swift 程式語言精通',
      'UIKit 或 SwiftUI 框架',
      'iOS SDK 核心框架（Foundation / CoreData / URLSession）',
      'Auto Layout 與響應式介面設計',
      'Git 版本控制',
      'App Store Connect 與上架流程',
    ],
    niceToHaveSkills: [
      'Combine / async-await 非同步程式設計',
      'Core Animation / Core Graphics 動畫效果',
      '推播通知（APNs）與 Widget 開發',
      'CI/CD（Fastlane / Xcode Cloud）',
      'Objective-C 維護能力',
      '跨平台框架了解（Flutter / React Native）',
    ],
    techStack: ['Swift', 'SwiftUI', 'UIKit', 'Xcode', 'CocoaPods / SPM', 'Core Data', 'Combine', 'Fastlane', 'Firebase'],
    salaryRange: { junior: '45K-65K', mid: '70K-100K', senior: '100K-150K+', currency: 'TWD/月' },
    sourceCompanies: ['LINE', 'Dcard', 'KKBOX', '街口支付', 'PChome', 'Gogolook', '17Live', 'iCHEF', 'KKday', '國泰金控', 'Pinkoi', 'CakeResume'],
    relatedRoles: ['Android Engineer', 'Frontend Engineer', 'UI/UX Designer', 'QA Engineer', 'Backend Engineer'],
    interviewQuestions: [
      '說明 UIKit 與 SwiftUI 的差異，你如何選擇使用哪個？',
      '如何處理 iOS App 的記憶體管理？ARC 的運作原理？',
      '描述你如何設計一個可維護的 iOS 架構（MVVM / VIPER / Clean Architecture）',
      'App 啟動時間優化的具體做法？',
      '如何處理 App Store 審核被拒的經驗？',
    ],
    redFlags: [
      '只會用 Storyboard 拖拉，不理解程式碼佈局',
      '不了解記憶體管理與 ARC 機制',
      '沒有上架 App 到 App Store 的實際經驗',
      '完全不了解 SwiftUI 等新技術方向',
      '對 iOS 平台的 Human Interface Guidelines 毫無概念',
    ],
    howToVerify: [
      '請展示你在 App Store 上架的作品',
      '討論最近一個複雜 UI 的實作方式',
      '詢問 App Crash 的排查流程（Crashlytics / 符號化）',
      '請說明你的 iOS 架構選擇與設計考量',
      '給一個 UI 動畫需求，觀察實現思路',
    ],
    commonMistakes: [
      '不區分 iOS 原生工程師與跨平台（Flutter/RN）工程師',
      '忽略 Apple 生態系經驗（審核 / IAP / 隱私權限）',
      '低估 iOS 工程師對設計細節的敏感度要求',
      '不了解 Swift 版本升級對專案的影響',
    ],
    careerPath: 'Junior iOS → Mid iOS → Senior iOS → iOS Lead → Mobile Lead → Engineering Manager',
    promptTemplate: `你是一位資深獵頭顧問，正在為客戶尋找 iOS 工程師。請根據以下需求分析：
1. 原生 vs 跨平台的需求評估
2. SwiftUI vs UIKit 的經驗要求
3. 合適的挖角目標公司
4. 面試中如何驗證 iOS 平台深度

職缺描述：[貼上完整職缺描述 JD]
App 類型：[填入App類型，如 電商/社群]
團隊規模：[填入團隊人數，如 10人]`,
  },
  {
    id: 'android-engineer',
    family: 'Mobile',
    title: 'Android 工程師',
    titleEn: 'Android Engineer',
    emoji: '🤖',
    whyExists: '負責 Android 平台的應用程式開發，服務全球最大的行動作業系統用戶群。',
    dailyWork: [
      '使用 Kotlin 開發 Android 應用功能',
      '實現 Material Design 介面與互動效果',
      '串接後端 API 與管理本地資料',
      '適配不同 Android 設備與版本',
      'Google Play 上架與版本管理',
      '效能優化（APK 大小 / 渲染效能 / 電量消耗）',
    ],
    mustHaveSkills: [
      'Kotlin 程式語言精通',
      'Android Jetpack 元件（ViewModel / LiveData / Navigation）',
      'Android SDK 與生命週期管理',
      'RecyclerView / Jetpack Compose UI 開發',
      'Gradle 建構工具',
      'Google Play Console 與上架流程',
    ],
    niceToHaveSkills: [
      'Jetpack Compose 宣告式 UI',
      'Coroutines / Flow 非同步處理',
      'Dagger / Hilt 依賴注入',
      'Android NDK / JNI 原生開發',
      '跨平台框架了解（KMM / Flutter）',
      'CI/CD 自動化建構（GitHub Actions / Bitrise）',
    ],
    techStack: ['Kotlin', 'Jetpack Compose', 'Android Studio', 'Retrofit / OkHttp', 'Room / DataStore', 'Hilt / Dagger', 'Coroutines + Flow', 'Firebase', 'Gradle'],
    salaryRange: { junior: '42K-62K', mid: '65K-95K', senior: '95K-145K+', currency: 'TWD/月' },
    sourceCompanies: ['LINE', 'Dcard', 'KKBOX', '街口支付', 'PChome', 'Gogolook', '17Live', 'Garena', 'momo', '國泰金控', 'Samsung', 'HTC'],
    relatedRoles: ['iOS Engineer', 'Frontend Engineer', 'UI/UX Designer', 'QA Engineer', 'Backend Engineer'],
    interviewQuestions: [
      '說明 Android 的 Activity / Fragment 生命週期與常見陷阱',
      'Jetpack Compose 與傳統 View System 的差異與遷移策略？',
      '如何處理 Android 碎片化問題（不同版本 / 裝置）？',
      '描述你如何設計 Android App 的架構（MVVM / MVI）',
      '如何優化 App 的 APK 大小與啟動速度？',
    ],
    redFlags: [
      '只會用 Java 開發，完全不了解 Kotlin',
      '不了解 Android 生命週期與記憶體洩漏問題',
      '沒有上架 Google Play 的實際經驗',
      '對 Material Design 規範完全陌生',
      '無法處理不同 Android 版本的相容性問題',
    ],
    howToVerify: [
      '請展示你在 Google Play 上架的作品',
      '討論複雜列表效能優化的具體做法',
      '詢問 ANR / Crash 的排查流程',
      '請說明你的 App 架構選擇與設計原因',
      '給一個效能問題場景，觀察診斷思路',
    ],
    commonMistakes: [
      '不區分 Android 原生與跨平台工程師',
      '忽略 Kotlin 與現代 Android 開發的要求',
      '低估 Android 碎片化處理的技術難度',
      '不了解 Jetpack Compose 已成為主流趨勢',
    ],
    careerPath: 'Junior Android → Mid Android → Senior Android → Android Lead → Mobile Lead → Engineering Manager',
    promptTemplate: `你是一位資深獵頭顧問，正在為客戶尋找 Android 工程師。請根據以下需求分析：
1. 原生 vs 跨平台的需求評估
2. Kotlin + Jetpack Compose 的經驗要求
3. 合適的挖角目標公司
4. 面試中如何驗證 Android 平台深度

職缺描述：[貼上完整職缺描述 JD]
App 類型：[填入App類型，如 電商/社群]
最低支援版本：[填入最低支援版本，如 iOS 15]`,
  },
  {
    id: 'bim-engineer',
    family: 'BIM',
    title: 'BIM 工程師',
    titleEn: 'BIM Engineer',
    emoji: '🏗️',
    whyExists: '負責建築資訊模型（Building Information Modeling）的建置與管理，用 3D 數位模型整合建築、結構、機電等各專業資訊，減少施工衝突與浪費。',
    dailyWork: [
      '建立與維護 BIM 3D 模型（建築/結構/機電）',
      '執行碰撞檢測（Clash Detection）與出具報告',
      '製作 4D 施工排程模擬與 5D 成本估算',
      '與建築師、結構技師、機電工程師協調整合',
      '產出施工圖說與數量計算表',
      '管理 BIM 模型標準與樣板（Template）',
    ],
    mustHaveSkills: [
      'Autodesk Revit 精通（建築/結構/機電至少一項）',
      'BIM 建模標準與 LOD 等級概念',
      'Navisworks 碰撞檢測',
      '建築/營建基礎知識',
      '圖面閱讀能力（施工圖 / 竣工圖）',
      'BIM 執行計畫（BEP）撰寫',
    ],
    niceToHaveSkills: [
      'Dynamo / Grasshopper 參數化設計',
      'Revit API 二次開發（Python / C#）',
      'Civil 3D / Infraworks 基礎建設 BIM',
      '點雲掃描與逆向建模',
      '國際 BIM 標準（ISO 19650 / buildingSMART）',
      'VR/AR 工程視覺化',
    ],
    techStack: ['Autodesk Revit', 'Navisworks', 'AutoCAD', 'Dynamo', 'BIM 360 / ACC', 'Civil 3D', 'Lumion / Enscape', 'Power BI'],
    salaryRange: { junior: '35K-50K', mid: '50K-75K', senior: '75K-110K+', currency: 'TWD/月' },
    sourceCompanies: ['中興工程', '中鼎集團', '亞新工程', '台灣世曦', '大陸工程', '互助營造', '達欣工程', '根基營造', '瑞助營造', 'BIM 顧問公司', '建築師事務所', '機電工程公司'],
    relatedRoles: ['建築師', '結構技師', '機電工程師', '工地主任', '專案經理', '估算工程師'],
    interviewQuestions: [
      '描述你執行過最大規模的 BIM 專案，建模範圍與團隊分工？',
      '如何處理大量碰撞檢測報告？優先排序的邏輯是什麼？',
      '你如何制定 BIM 建模標準與 LOD 要求？',
      'BIM 模型在施工階段如何應用？舉實際案例。',
      '如何說服不熟悉 BIM 的工程人員接受並使用？',
    ],
    redFlags: [
      '只會畫 3D 模型但不了解建築/營建實務',
      '沒有實際專案的碰撞檢測與協調經驗',
      '對 BIM 執行計畫（BEP）概念模糊',
      '不了解建模標準與品質管控流程',
      '將 BIM 等同於「畫 3D 圖」',
    ],
    howToVerify: [
      '請展示你負責的 BIM 專案案例與成果',
      '詢問碰撞檢測的具體數據（發現多少衝突、解決率）',
      '討論 LOD 300 與 LOD 400 的建模差異',
      '請說明你如何管理多專業的模型整合',
      '給一個設計變更場景，觀察 BIM 模型調整思路',
    ],
    commonMistakes: [
      '將 BIM 工程師等同於 CAD 繪圖員',
      '不了解 BIM 在營建業的實際應用場景',
      '忽略專案管理與協調能力的重要性',
      '不區分建築/結構/機電 BIM 的專業差異',
    ],
    careerPath: 'BIM 建模員 → BIM 工程師 → BIM 經理 → BIM 總監 → 數位轉型主管',
    promptTemplate: `你是一位資深獵頭顧問，正在為客戶尋找 BIM 工程師。請根據以下需求分析：
1. 需要的 BIM 專業領域（建築/結構/機電）
2. BIM 應用深度（建模/碰撞/4D/5D）
3. 合適的人才來源（營造/顧問/設計）
4. 面試中如何驗證 BIM 實務經驗

職缺描述：[貼上完整職缺描述 JD]
專案類型：[填入專案類型，如 住宅/商辦]
BIM 成熟度：[填入BIM成熟度，如 初導入/已建置]`,
  },
  {
    id: 'chef',
    family: 'Hospitality',
    title: '廚師 / 主廚',
    titleEn: 'Chef / Head Chef',
    emoji: '👨‍🍳',
    whyExists: '負責餐廳出品的核心人物，掌控菜單設計、食材採購、廚房管理與出餐品質。是餐飲業的靈魂角色。',
    dailyWork: [
      '每日備料（Mise en Place）與食材檢查',
      '烹調出餐並把控出品品質',
      '菜單設計、研發新菜色與季節性調整',
      '控管食材成本與庫存管理',
      '管理廚房團隊排班與工作分配',
      '維護廚房衛生安全（HACCP 規範）',
      '與外場團隊溝通協調出餐節奏',
    ],
    mustHaveSkills: [
      '中/西餐烹飪技術（至少精通一項）',
      '食品安全衛生法規與 HACCP 概念',
      '食材成本控制與毛利計算',
      '菜單設計與定價策略',
      '廚房管理與人員調度',
      '基本刀工與火候掌控',
    ],
    niceToHaveSkills: [
      '多國料理烹飪能力',
      '甜點/烘焙技術',
      '食材採購與供應商管理',
      '餐飲 POS 系統操作',
      '攝影美學（菜品拍攝呈現）',
      '外語能力（英語/日語，國際飯店需要）',
    ],
    techStack: ['HACCP 系統', 'POS 系統', '庫存管理系統', '食譜管理軟體', '成本計算試算表'],
    salaryRange: { junior: '30K-40K', mid: '40K-55K', senior: '55K-80K+', currency: 'TWD/月' },
    sourceCompanies: ['晶華酒店', '寒舍集團', '王品集團', '鼎泰豐', '亞都麗緻', '老爺酒店', '六福集團', '乾杯集團', '瓦城泰統', 'RAW', 'JL Studio', 'Mume'],
    relatedRoles: ['副主廚', '二廚', '冷廚', '甜點師', '餐廳經理', '食品研發'],
    interviewQuestions: [
      '你的招牌菜是什麼？請說明烹調步驟與食材選擇的考量',
      '如何控制廚房食材成本在合理範圍？你的目標食材成本率是多少？',
      '描述你如何管理一個忙碌時段（例如：同時出 50 桌）的廚房動線',
      '如何設計一份季節性菜單？考量哪些因素？',
      '廚房發生食安事件時，你的應變流程是什麼？',
    ],
    redFlags: [
      '無法說明食材成本控管方式與具體毛利數據',
      '衛生觀念薄弱，對 HACCP 或食安法規不了解',
      '只會炒菜不懂廚房管理與團隊帶領',
      '對菜單設計沒有想法，只會執行不會創造',
      '無法處理突發狀況（缺料、客訴、設備故障）',
    ],
    howToVerify: [
      '請描述你管理過的廚房規模（人數/餐期出餐量）',
      '詢問食材成本率的實際數據與控管方法',
      '討論一道菜從研發到上菜的完整過程',
      '請說明你的廚房衛生管理制度',
      '如果可能，安排實際烹飪測試',
    ],
    commonMistakes: [
      '只看烹飪技術而忽略管理與成本控制能力',
      '不了解不同餐飲業態（飯店/獨立餐廳/連鎖）的差異',
      '忽略廚師的穩定性評估（餐飲業流動率高）',
      '對廚師的工作時間與條件不夠了解',
    ],
    careerPath: '學徒 → 三廚 → 二廚 → 副主廚 → 主廚 → 行政主廚 → 餐飲總監',
    promptTemplate: `你是一位資深獵頭顧問，正在為客戶尋找廚師/主廚。請根據以下需求分析：
1. 餐飲業態分析（飯店/獨立餐廳/連鎖）
2. 所需料理專長與管理經驗
3. 合適的人才來源與挖角策略
4. 面試與試菜的評估重點

職缺描述：[貼上完整職缺描述 JD]
餐廳類型：[填入餐廳類型，如 fine dining/快餐]
規模：[填入廚房規模，如 15人團隊]`,
  },
  {
    id: 'admin-assistant',
    family: 'Admin',
    title: '行政助理',
    titleEn: 'Administrative Assistant',
    emoji: '📋',
    whyExists: '負責公司日常行政事務的運作，從文書處理到會議安排，是確保辦公室順暢運轉的幕後推手。',
    dailyWork: [
      '收發公文、信件與快遞管理',
      '會議室預約與會議安排',
      '差旅行程規劃與訂票',
      '辦公用品採購與庫存管理',
      '文件歸檔與資料整理',
      '協助主管行程管理與提醒',
      '訪客接待與電話轉接',
    ],
    mustHaveSkills: [
      'Microsoft Office 操作精通（Word / Excel / PowerPoint）',
      '中英文書信撰寫能力',
      '時間管理與多任務協調',
      '基本會計帳務概念（請款/核銷/零用金）',
      '溝通協調與人際應對能力',
      '細心與組織能力',
    ],
    niceToHaveSkills: [
      'Google Workspace 操作',
      'ERP 系統操作經驗',
      '基本影像/簡報設計（Canva）',
      '外語能力（英語/日語）',
      '專案管理工具操作（Notion / Trello）',
      '活動規劃與執行經驗',
    ],
    techStack: ['Microsoft Office', 'Google Workspace', 'ERP 系統', 'Notion / Trello', 'Canva', '差旅訂房系統'],
    salaryRange: { junior: '28K-33K', mid: '33K-42K', senior: '42K-55K+', currency: 'TWD/月' },
    sourceCompanies: ['各大企業行政部門', '律師事務所', '會計師事務所', '外商公司', '金融業', '科技業', '百貨零售業', '公關活動公司', '飯店業', '醫療機構'],
    relatedRoles: ['秘書', '總務', '人資助理', '財務助理', '辦公室管理員'],
    interviewQuestions: [
      '描述你如何同時處理多項緊急任務的經驗',
      '你的文件歸檔與管理方法是什麼？',
      '如何安排一場重要的跨國視訊會議？需要注意什麼？',
      '遇到主管臨時交辦的緊急事項與既定工作衝突時，你如何處理？',
      '請分享一個你主動改善行政流程的案例',
    ],
    redFlags: [
      '對 Office 軟體操作不熟練（尤其是 Excel 基礎功能）',
      '時間管理能力差，無法掌握多項工作的進度',
      '粗心大意，經常出現文書錯誤',
      '不主動溝通，等待指示才行動',
      '對保密意識薄弱（接觸主管機密資訊）',
    ],
    howToVerify: [
      '請現場操作 Excel 完成一個簡單的資料整理任務',
      '給一個多任務情境，觀察優先排序的邏輯',
      '請撰寫一封正式商務信件（中文或英文）',
      '詢問處理過的最大型活動或會議的規模與細節',
      '討論你如何建立與維護行政檔案管理系統',
    ],
    commonMistakes: [
      '認為行政助理不需要專業能力',
      '忽略軟實力（EQ / 應變能力 / 保密意識）的重要性',
      '不區分「行政助理」與「秘書」的職責差異',
      '低估好的行政人員對組織效率的影響',
    ],
    careerPath: '行政助理 → 資深行政 → 行政主任 → 行政經理 → 總務主管 → 營運長',
    promptTemplate: `你是一位資深獵頭顧問，正在為客戶尋找行政助理。請根據以下需求分析：
1. 行政角色的核心職責與附加期待
2. 所需的語言能力與軟體熟悉度
3. 合適的人才來源
4. 面試中如何評估細心度與應變能力

職缺描述：[貼上完整職缺描述 JD]
公司類型：[填入公司類型，如 科技業/傳產]
主管層級：[填入主管層級，如 部門經理]`,
  },
  {
    id: 'executive-driver',
    family: 'Admin',
    title: '主管司機',
    titleEn: 'Executive Driver',
    emoji: '🚗',
    whyExists: '負責高階主管的專屬交通接送，確保主管行程準時、安全且舒適。除了駕駛技術外，更重視職業道德與保密意識。',
    dailyWork: [
      '每日接送主管上下班與商務行程',
      '車輛日常檢查與保養維護',
      '規劃最佳路線以確保準時到達',
      '保持車輛內外清潔整齊',
      '等候期間待命，隨時配合臨時行程變動',
      '協助處理簡單事務（取件 / 送件 / 採購）',
      '維護主管行程的保密性',
    ],
    mustHaveSkills: [
      '職業駕照（大/小客車駕照）',
      '良好的駕駛技術與安全觀念',
      '路線規劃能力（熟悉都會區道路）',
      '車輛基礎保養知識',
      '良好的服務態度與職業道德',
      '高度保密意識',
    ],
    niceToHaveSkills: [
      '防禦駕駛訓練',
      '外語溝通能力（英語基礎）',
      '基本急救知識',
      'GPS 導航系統操作',
      '車輛清潔美容技能',
      '接待禮儀訓練',
    ],
    techStack: ['GPS 導航系統', 'Google Maps / Waze', '行車紀錄器', '車輛管理系統', '通訊軟體（LINE / WhatsApp）'],
    salaryRange: { junior: '32K-38K', mid: '38K-48K', senior: '48K-60K+', currency: 'TWD/月' },
    sourceCompanies: ['上市櫃公司', '外商公司', '金融業', '建設公司', '飯店集團', '高階汽車租賃公司', '政府機關', '駐台使館', '醫療院所', '家族企業'],
    relatedRoles: ['行政助理', '總務人員', '車隊管理員', '禮賓人員', '保全人員'],
    interviewQuestions: [
      '描述你在緊急路況下的應變經驗',
      '如何確保主管行程資訊的保密性？',
      '你的車輛日常保養檢查流程是什麼？',
      '遇到主管臨時變更行程時，你如何快速調整？',
      '長時間等候時，你如何保持專注與待命狀態？',
    ],
    redFlags: [
      '有交通違規或事故紀錄',
      '保密意識薄弱，會洩漏主管行蹤或談話內容',
      '服務態度不佳，缺乏耐心',
      '不願意配合加班或彈性工時',
      '對車輛維護不用心，車況不佳',
    ],
    howToVerify: [
      '查核駕照與無肇事證明',
      '安排實際路考測試駕駛技術',
      '請描述過去主管的作息與你的配合方式',
      '詢問處理過的突發狀況案例',
      '確認對保密條款的理解與配合意願',
    ],
    commonMistakes: [
      '只看駕駛技術而忽略服務態度與保密意識',
      '不了解主管司機的特殊工作型態（待命/加班）',
      '忽略背景調查的重要性',
      '低估這個角色對主管信任感的重要性',
    ],
    careerPath: '司機 → 主管專屬司機 → 車隊組長 → 車隊主管 → 總務主管',
    promptTemplate: `你是一位資深獵頭顧問，正在為客戶尋找主管司機。請根據以下需求分析：
1. 服務主管的層級與特殊需求
2. 所需的專業資格與背景
3. 合適的人才來源管道
4. 面試中如何評估可信度與服務意識

職缺描述：[貼上完整職缺描述 JD]
主管層級：[填入主管層級，如 副總/協理]
工作時間：[填入工作時間，如 8:30-17:30]`,
  },
];

// ============================================================
// DATA: INDUSTRY_MAP (10 industries)
// ============================================================
const INDUSTRY_MAP: IndustryCard[] = [
  {
    id: 'saas',
    name: '軟體 / SaaS',
    emoji: '☁️',
    description: '提供雲端訂閱制軟體服務，以月費或年費模式營運。重視用戶留存率、MRR/ARR 等關鍵指標。',
    businessModels: ['訂閱制（月繳/年繳）', '免費增值（Freemium）', '按用量計費（Usage-based）', '企業授權（Enterprise License）', '平台抽成模式'],
    typicalCompanies: ['Shopline', 'Appier', '91APP', 'Gogolook', 'iCHEF', '25sprout', 'Hahow', 'CakeResume', 'Pinkoi', 'Lawsnote'],
    keyDepartments: ['產品研發部', '客戶成功部（Customer Success）', '業務發展部', '行銷部', '技術支援部'],
    commonRoles: ['Backend Engineer', 'Frontend Engineer', 'Product Manager', 'Customer Success Manager', 'Sales / AE', 'Data Analyst'],
    recruitingChallenges: ['優秀工程師被大廠吸走，中小型 SaaS 難搶人', '需兼具技術與商業思維的 PM 難找', '客戶成功角色定義模糊，候選人認知差異大', '早期新創薪資難與大公司競爭'],
    promptTemplate: `你是一位獵頭產業顧問。請分析以下 SaaS 公司的招募策略：

公司名稱：[填入公司名稱，如 Shopline]
產品類型：[填入產品類型，如 電商SaaS]
目前階段：[填入公司階段，如 B輪/成長期]

請輸出以下分析報告（我要用來跟客戶提案、制定搜才策略）：
1. **組織架構推測**：這家公司目前可能的部門配置與人數規模
2. **關鍵招募角色 Top 5**：最急需 & 最難找的 5 個職位，標註難度等級（🟢簡單/🟡中等/🔴困難）
3. **人才來源地圖**：這些角色通常從哪些公司/產業挖？列出 Top 5 挖角目標公司
4. **薪資競爭力評估**：跟同業相比的薪資水位（高/中/低），附建議薪資區間
5. **獵頭切入建議**：我該用什麼話術接觸 HR/用人主管？用什麼角度提案？`,
  },
  {
    id: 'si',
    name: '系統整合（SI）',
    emoji: '🔗',
    description: '為企業客戶提供 IT 系統整合解決方案，包含軟硬體建置、客製化開發與顧問服務。以專案制為主。',
    businessModels: ['專案制開發（T&M / Fixed Price）', '顧問諮詢服務', '年度維護合約', '產品代理與建置', '雲端遷移服務'],
    typicalCompanies: ['中華電信', '精誠資訊', '凌群電腦', '宏碁資訊', '叡揚資訊', '資拓宏宇', '零壹科技', '神通資訊', '關貿網路', '敦陽科技'],
    keyDepartments: ['專案管理部', '技術開發部', '售前顧問部', '業務部', '維運服務部'],
    commonRoles: ['專案經理', 'Java 工程師', '.NET 工程師', 'SA（系統分析師）', '售前技術顧問', '維運工程師'],
    recruitingChallenges: ['工程師偏好產品公司而非專案制 SI', '資深 SA 與架構師供不應求', '政府標案人才需了解法規與標書撰寫', '薪資天花板較低導致人才流失'],
    promptTemplate: `你是一位獵頭產業顧問。請分析以下系統整合（SI）公司的人才需求：

公司名稱：[填入公司名稱，如 精誠資訊]
主要客戶類型：[填入客戶類型，如 政府/企業]
技術棧：[填入技術棧，如 Java, Spring Boot]

請輸出以下分析報告（我要用來跟客戶提案、制定搜才策略）：
1. **SI 產業人才特性**：SI 工程師 vs 產品公司工程師的差異、偏好、轉職動機
2. **關鍵招募角色 Top 5**：最急需的職位，標註難度等級（🟢簡單/🟡中等/🔴困難）
3. **人才來源地圖**：適合挖角的目標公司 Top 5，含原因分析
4. **跟產品公司的搶人策略**：SI 薪資劣勢下如何吸引人才的話術與賣點
5. **獵頭切入建議**：如何跟 SI 的 HR/PM 提案？用什麼角度展現價值？`,
  },
  {
    id: 'bim-construction',
    name: 'BIM / 營建工程',
    emoji: '🏗️',
    description: '運用 BIM 技術進行建築設計、施工管理與營運維護，推動營建業數位轉型。',
    businessModels: ['工程承攬', 'BIM 顧問服務', '設計監造', '統包工程', '維運管理委託'],
    typicalCompanies: ['中鼎集團', '中興工程', '大陸工程', '互助營造', '台灣世曦', '亞新工程', '根基營造', '達欣工程', '瑞助營造', '衛武資訊'],
    keyDepartments: ['設計部', '工務部', 'BIM 中心', '品管部', '採購部'],
    commonRoles: ['BIM 工程師', 'BIM 經理', '建築師', '結構技師', '工地主任', '專案經理', '估算工程師'],
    recruitingChallenges: ['BIM 人才稀缺，跨領域人才更少', '傳統營建業數位轉型抗拒', '營建業工作環境較差影響招募', '需要懂建築又懂軟體的複合型人才'],
    promptTemplate: `你是一位獵頭產業顧問。請分析以下營建/BIM 公司的招募需求：

公司名稱：[填入公司名稱，如 中鼎集團]
專案類型：[填入專案類型，如 住宅/商辦]
BIM 應用範圍：[填入BIM應用範圍，如 設計到施工]

請輸出以下分析報告（我要用來跟客戶提案、制定搜才策略）：
1. **營建業人才地圖**：BIM 人才主要在哪些公司？跨領域（建築+軟體）人才從哪裡來？
2. **關鍵招募角色 Top 5**：最急需的職位，標註難度等級（🟢簡單/🟡中等/🔴困難）
3. **BIM 人才評估要點**：面試時該問什麼？怎麼判斷 BIM 工程師的程度？
4. **薪資行情 & 競爭分析**：BIM 人才的薪資帶、跟科技業搶人的策略
5. **獵頭切入建議**：營建業客戶通常怎麼找人？我該用什麼角度接觸 HR/工務主管？`,
  },
  {
    id: 'finance-fintech',
    name: '金融 / FinTech',
    emoji: '💰',
    description: '傳統金融機構與新興金融科技公司，涵蓋銀行、保險、證券、支付等領域的數位化轉型。',
    businessModels: ['利差收入', '手續費與佣金', '訂閱制金融服務', '支付交易手續費', '保險費收入'],
    typicalCompanies: ['國泰金控', '富邦金控', '玉山銀行', '中國信託', '街口支付', 'LINE Pay', '麻布記帳', 'Cathay Blockchain', '永豐金證券', '凱基銀行'],
    keyDepartments: ['數位金融部', '資訊部', '風控部', '法令遵循部', '個金部', '法金部'],
    commonRoles: ['Backend Engineer', 'Data Scientist', '風控分析師', '合規專員', 'Product Manager', '資安工程師', 'DevOps Engineer'],
    recruitingChallenges: ['金融法規限制導致技術選型保守', '薪資有競爭力但文化偏傳統，年輕工程師不愛', '需要同時懂金融與技術的跨領域人才', '資安與合規人才全市場搶'],
    promptTemplate: `你是一位獵頭產業顧問。請分析以下金融/FinTech 公司的招募策略：

公司名稱：[填入公司名稱，如 國泰金控]
業務類型：[填入業務類型，如 銀行/保險]
數位轉型階段：[填入數位轉型階段，如 起步/進階]

請輸出以下分析報告（我要用來跟客戶提案、制定搜才策略）：
1. **金融業人才市場現況**：數位金融人才的供需狀況、搶人激烈程度
2. **關鍵招募角色 Top 5**：最急需的職位，標註難度等級（🟢簡單/🟡中等/🔴困難）
3. **FinTech vs 傳統金融**：兩種公司文化差異，人才偏好分析、轉職動機
4. **人才來源地圖**：適合挖角的目標公司 Top 5，含跨產業來源建議
5. **獵頭切入建議**：金融業 HR 的決策流程？如何用法規/合規人才稀缺性做提案？`,
  },
  {
    id: 'hospitality',
    name: '餐旅飯店',
    emoji: '🏨',
    description: '飯店、餐飲、旅遊業，注重服務品質與顧客體驗，人力密集型產業。',
    businessModels: ['住宿收入', '餐飲收入', '會議宴客', '休閒娛樂設施', '品牌加盟授權'],
    typicalCompanies: ['晶華酒店', '寒舍集團', '老爺酒店', '亞都麗緻', '六福集團', '王品集團', '鼎泰豐', '乾杯集團', '雲朗觀光', '雅高酒店'],
    keyDepartments: ['客務部', '餐飲部', '業務行銷部', '人資部', '工程部', '財務部'],
    commonRoles: ['餐廳經理', '主廚', '房務主管', '訂房主任', '宴會業務', '大廳副理', '人力資源專員'],
    recruitingChallenges: ['產業薪資偏低且工時長，不易吸引人才', '基層人員流動率極高', '疫後人力缺口擴大', '外語人才需求高但供給不足'],
    promptTemplate: `你是一位獵頭產業顧問。請分析以下餐旅飯店的招募需求：

公司名稱：[填入公司名稱，如 晶華酒店]
飯店等級：[填入飯店等級，如 五星/精品]
營運規模：[填入營運規模，如 200間客房]

請輸出以下分析報告（我要用來跟客戶提案、制定搜才策略）：
1. **餐旅業人才市場現況**：疫後人力缺口、各職級供需分析
2. **關鍵招募角色 Top 5**：最急需的職位，標註難度等級（🟢簡單/🟡中等/🔴困難）
3. **人才來源地圖**：這些角色從哪些同業/飯店集團挖？Top 5 挖角目標
4. **降低流動率策略**：餐旅業流動率高的根因 & 獵頭能提供的解法
5. **獵頭切入建議**：餐旅業怎麼找獵頭？我該用什麼角度跟飯店 HR/總經理提案？`,
  },
  {
    id: 'manufacturing',
    name: '製造業',
    emoji: '🏭',
    description: '涵蓋半導體、電子零組件、機械設備等，台灣經濟核心產業。近年積極推動智慧製造與工業 4.0。',
    businessModels: ['OEM 代工', 'ODM 設計製造', '自有品牌（OBM）', '零件供應', '設備銷售與維護'],
    typicalCompanies: ['台積電', '聯發科', '鴻海', '台達電', '研華科技', '緯創資通', '和碩', '光寶科技', '廣達', '日月光'],
    keyDepartments: ['研發部', '製造部', '品保部', '生管部', '業務部', '資訊部'],
    commonRoles: ['製程工程師', '設備工程師', 'FAE（應用工程師）', '品質工程師', 'IE 工程師', 'IT 工程師', '採購'],
    recruitingChallenges: ['半導體業薪資極高，其他製造業難競爭', '工廠地點偏遠影響招募意願', '傳統製造業數位轉型人才缺乏', 'AI/IoT 跨領域人才需求急增'],
    promptTemplate: `你是一位獵頭產業顧問。請分析以下製造業公司的招募需求：

公司名稱：[填入公司名稱，如 台積電]
產業別：[填入產業別，如 半導體/PCB]
製程類型：[填入製程類型，如 晶圓代工]

請輸出以下分析報告（我要用來跟客戶提案、制定搜才策略）：
1. **製造業人才市場特性**：工程師人才庫分佈、半導體 vs 其他製造業的薪資落差
2. **關鍵招募角色 Top 5**：最急需的職位，標註難度等級（🟢簡單/🟡中等/🔴困難）
3. **人才來源地圖**：適合挖角的目標公司 Top 5，含跨產業來源
4. **跟半導體搶人策略**：台積電吸走大量人才，其他製造業怎麼用薪資以外的賣點搶人
5. **獵頭切入建議**：製造業客戶的招募痛點？我該用什麼角度跟廠長/HR 主管提案？`,
  },
  {
    id: 'ecommerce',
    name: '電商 / 零售',
    emoji: '🛒',
    description: '線上購物平台與新零售業態，結合科技與商務，強調用戶體驗與供應鏈效率。',
    businessModels: ['B2C 電商平台', 'B2B2C 市集模式', 'D2C 品牌官網', '社群電商', 'O2O 全通路'],
    typicalCompanies: ['momo', 'PChome', '蝦皮', 'Pinkoi', 'KKday', '博客來', 'Yahoo 購物', '91APP', 'CYBERBIZ', '生活市集'],
    keyDepartments: ['產品技術部', '營運部', '行銷部', '商品部', '物流供應鏈部', '客服部'],
    commonRoles: ['Backend Engineer', 'Frontend Engineer', 'Data Analyst', '商品企劃', '數位行銷', '物流管理', '客服主管'],
    recruitingChallenges: ['電商季節性用人需求波動大', '數據與 AI 人才被科技公司搶走', '需要同時懂技術與商業的人才', '物流與倉儲人才流動率高'],
    promptTemplate: `你是一位獵頭產業顧問。請分析以下電商/零售公司的招募需求：

公司名稱：[填入公司名稱，如 momo]
電商模式：[填入電商模式，如 B2C/D2C]
年營收規模：[填入年營收規模，如 10億]

請輸出以下分析報告（我要用來跟客戶提案、制定搜才策略）：
1. **電商業人才市場分析**：技術 vs 營運角色的供需現況、搶人激烈程度
2. **關鍵招募角色 Top 5**：最急需的職位，標註難度等級（🟢簡單/🟡中等/🔴困難）
3. **人才來源地圖**：適合挖角的目標公司 Top 5，含跨產業來源
4. **季節性招募策略**：雙11/年貨節前的人力規劃，如何提前佈局
5. **獵頭切入建議**：電商客戶的招募痛點？我該用什麼角度跟電商 HR/CTO 提案？`,
  },
  {
    id: 'ai-data',
    name: 'AI / 數據',
    emoji: '🤖',
    description: '專注於人工智慧與大數據技術的公司，包含 AI 產品、資料平台與 AI 顧問服務。',
    businessModels: ['AI SaaS 產品', '資料分析平台', 'AI 顧問專案', 'API 服務計費', 'AI 模型授權'],
    typicalCompanies: ['Appier', '沛星互動', '台灣 AI Labs', '奧義智慧', 'Gogolook', 'iKala', 'Skymizer', 'Umbo CV', 'DeepForce', 'Numbers Protocol'],
    keyDepartments: ['AI 研究部', '工程部', '資料科學部', '產品部', '業務部'],
    commonRoles: ['ML Engineer', 'Data Scientist', 'Data Engineer', 'AI Researcher', 'Backend Engineer', 'MLOps Engineer', 'Product Manager'],
    recruitingChallenges: ['頂尖 AI 人才多往海外或大廠', '學界與業界的技能落差大', '需要論文發表+工程能力的全才', 'AI 領域技術變化快，人才技能容易過時'],
    promptTemplate: `你是一位獵頭產業顧問。請分析以下 AI/數據公司的招募需求：

公司名稱：[填入公司名稱，如 Appier]
AI 應用領域：[填入AI應用領域，如 NLP/CV]
研究 vs 應用比重：[填入研究vs應用比重，如 3:7]

請輸出以下分析報告（我要用來跟客戶提案、制定搜才策略）：
1. **AI 人才市場供需分析**：ML/Data 人才的供需狀況、薪資行情
2. **關鍵招募角色 Top 5**：最急需的職位，標註難度等級（🟢簡單/🟡中等/🔴困難）
3. **人才來源地圖**：適合挖角的目標公司/學校 Top 5（含海外歸國人才分析）
4. **學界 vs 業界人才評估**：碩博士 vs 實戰派怎麼選？各自的面試評估重點
5. **獵頭切入建議**：AI 公司的招募痛點？如何用人才稀缺性跟 CTO/VP 提案？`,
  },
  {
    id: 'healthcare-biotech',
    name: '醫療 / 生技',
    emoji: '🧬',
    description: '醫療機構、生技製藥與醫療器材公司，高度監管產業，重視法規合規與品質管理。',
    businessModels: ['醫療服務收入', '藥品銷售', '醫療器材銷售', '技術授權', '臨床試驗服務'],
    typicalCompanies: ['長庚醫院體系', '國泰醫院', '中研院生醫所', '藥華醫藥', '合一生技', '晟德大藥廠', '雃博', '太醫科技', '慧康生活', 'Health2Sync'],
    keyDepartments: ['研發部', '臨床事務部', '法規部（RA）', '品保部', '業務部', '醫學事務部'],
    commonRoles: ['臨床研究員（CRA）', '法規專員（RA）', '品保工程師', '醫藥業務代表', '生物資訊工程師', '軟體工程師（醫材）', '數據科學家'],
    recruitingChallenges: ['高度專業門檻，人才庫小', 'FDA/TFDA 法規人才極稀缺', '生技業薪資波動大（看 pipeline 成敗）', '軟體人才不了解醫療法規（FDA SaMD）'],
    promptTemplate: `你是一位獵頭產業顧問。請分析以下醫療/生技公司的招募需求：

公司名稱：[填入公司名稱，如 藥華醫藥]
產品類別：[填入產品類別，如 醫材/藥品]
法規市場：[填入法規市場，如 FDA/TFDA]

請輸出以下分析報告（我要用來跟客戶提案、制定搜才策略）：
1. **醫療/生技人才市場特性**：高度專業門檻下的人才庫大小、搶人激烈程度
2. **關鍵招募角色 Top 5**：最急需的職位，標註難度等級（🟢簡單/🟡中等/🔴困難）
3. **人才來源地圖**：RA/CRA/QA 等專業人才從哪裡來？Top 5 挖角目標公司
4. **跨領域人才策略**：怎麼找「懂技術又懂法規」的複合型人才？評估要點
5. **獵頭切入建議**：生技客戶的招募流程？如何用法規人才稀缺性跟客戶提案？`,
  },
  {
    id: 'logistics',
    name: '物流 / 運輸',
    emoji: '🚚',
    description: '物流配送、貨運倉儲與運輸服務，近年因電商發展與數位化而快速轉型。',
    businessModels: ['宅配物流服務', '倉儲管理服務', '貨運承攬', '供應鏈解決方案', '最後一哩配送'],
    typicalCompanies: ['統一速達（黑貓）', '嘉里大榮', '新竹物流', 'GoFreight', 'Lalamove', 'foodpanda', 'UberEats', '長榮物流', '萬海航運', '陽明海運'],
    keyDepartments: ['營運部', '車隊管理部', '倉儲部', '資訊系統部', '業務部', '客服部'],
    commonRoles: ['物流管理師', '倉儲主管', '車隊調度', '供應鏈分析師', '軟體工程師', '資料分析師', '客服主管'],
    recruitingChallenges: ['基層物流人員嚴重缺工', '物流科技人才需懂領域知識', '工作環境與待遇難吸引年輕族群', '數位轉型需要的 IT 人才與科技業競爭'],
    promptTemplate: `你是一位獵頭產業顧問。請分析以下物流/運輸公司的招募需求：

公司名稱：[填入公司名稱，如 統一速達]
物流類型：[填入物流類型，如 倉儲/宅配]
數位化程度：[填入數位化程度，如 初步導入]

請輸出以下分析報告（我要用來跟客戶提案、制定搜才策略）：
1. **物流業人才市場現況**：基層缺工 & 中高階管理人才的供需分析
2. **關鍵招募角色 Top 5**：最急需的職位，標註難度等級（🟢簡單/🟡中等/🔴困難）
3. **人才來源地圖**：物流科技人才（IT/數據）從哪裡來？Top 5 挖角目標公司
4. **數位轉型人才策略**：傳統物流公司怎麼吸引科技人才？薪資以外的賣點
5. **獵頭切入建議**：物流客戶的招募痛點？我該用什麼角度跟營運總監/HR 提案？`,
  },
];

// ============================================================
// DATA: ORG_CHARTS (5 types)
// ============================================================
const ORG_CHARTS: OrgChartData[] = [
  {
    id: 'saas-company',
    name: 'SaaS 公司',
    emoji: '☁️',
    description: '典型的 SaaS 軟體公司組織架構，以產品研發為核心驅動力',
    tree: {
      title: 'CEO / 執行長',
      roles: ['策略規劃', '募資', '對外代表'],
      children: [
        {
          title: 'CTO / 技術長',
          roles: ['技術策略', '架構決策', '技術團隊管理'],
          children: [
            { title: '後端工程組', roles: ['Backend Engineer', 'DBA', 'DevOps Engineer'] },
            { title: '前端工程組', roles: ['Frontend Engineer', 'Fullstack Engineer'] },
            { title: '行動開發組', roles: ['iOS Engineer', 'Android Engineer'] },
            { title: 'QA 組', roles: ['QA Engineer', 'SDET', 'QA Lead'] },
            { title: 'Data 團隊', roles: ['Data Engineer', 'Data Scientist', 'Data Analyst'] },
          ],
        },
        {
          title: 'CPO / 產品長',
          roles: ['產品策略', '用戶研究', '產品路線圖'],
          children: [
            { title: '產品管理組', roles: ['Product Manager', 'Associate PM'] },
            { title: '設計組', roles: ['UI/UX Designer', 'UX Researcher', 'Visual Designer'] },
          ],
        },
        {
          title: 'COO / 營運長',
          roles: ['日常營運', '流程優化', '跨部門協調'],
          children: [
            { title: '業務部', roles: ['Sales Manager', 'AE（客戶經理）', 'SDR（業務開發）'] },
            { title: '客戶成功部', roles: ['CS Manager', 'CSM', 'Technical Support'] },
            { title: '行銷部', roles: ['行銷經理', '內容行銷', '成長行銷', 'SEO 專員'] },
          ],
        },
        {
          title: 'CFO / 財務長',
          roles: ['財務規劃', '募資管理', '預算控制'],
          children: [
            { title: '財務部', roles: ['財務經理', '會計', '出納'] },
            { title: '人資部', roles: ['HR Manager', 'HRBP', '招募專員', '薪酬管理'] },
          ],
        },
      ],
    },
  },
  {
    id: 'si-company',
    name: '系統整合（SI）公司',
    emoji: '🔗',
    description: '系統整合公司組織架構，以專案制為核心，強調技術與業務雙引擎',
    tree: {
      title: '總經理',
      roles: ['公司經營', '客戶關係', '策略方向'],
      children: [
        {
          title: '技術部門',
          roles: ['技術架構', '技術標準', '人才培育'],
          children: [
            { title: '開發一組（政府標案）', roles: ['Java Engineer', '.NET Engineer', 'SA 系統分析師', 'PG 程式設計師'] },
            { title: '開發二組（企業專案）', roles: ['Java Engineer', 'Python Engineer', 'Frontend Engineer', 'DBA'] },
            { title: '維運組', roles: ['維運工程師', '系統管理師', '網路管理師', '資安工程師'] },
          ],
        },
        {
          title: '業務部門',
          roles: ['業務開發', '客戶經營', '標案管理'],
          children: [
            { title: '政府事業群', roles: ['業務經理', '標案專員', '售前顧問'] },
            { title: '企業事業群', roles: ['業務經理', '客戶經理', '解決方案顧問'] },
          ],
        },
        {
          title: '專案管理部',
          roles: ['專案治理', '品質管理', '流程標準'],
          children: [
            { title: '專案經理組', roles: ['資深 PM', 'PM', '助理 PM'] },
            { title: '品保組', roles: ['QA Engineer', '品保經理', '文件管理師'] },
          ],
        },
        {
          title: '管理部門',
          roles: ['行政管理', '人事管理', '財務管理'],
          children: [
            { title: '人資行政', roles: ['HR', '行政助理', '總務'] },
            { title: '財務會計', roles: ['財務主管', '會計', '出納'] },
          ],
        },
      ],
    },
  },
  {
    id: 'bim-construction',
    name: 'BIM / 營建公司',
    emoji: '🏗️',
    description: '導入 BIM 的營建公司組織架構，傳統營建管理結合數位化 BIM 中心',
    tree: {
      title: '總經理',
      roles: ['公司經營', '重大專案決策', '外部關係'],
      children: [
        {
          title: '設計部',
          roles: ['建築設計', '結構設計', '機電設計'],
          children: [
            { title: '建築設計組', roles: ['建築師', '設計師', '繪圖員'] },
            { title: '結構組', roles: ['結構技師', '結構設計工程師'] },
            { title: 'BIM 中心', roles: ['BIM 經理', 'BIM 工程師（建築）', 'BIM 工程師（結構）', 'BIM 工程師（機電）', 'BIM 程式開發'] },
          ],
        },
        {
          title: '工務部',
          roles: ['施工管理', '進度控制', '品質管理'],
          children: [
            { title: '工地管理', roles: ['工地主任', '工程師', '品管工程師', '安衛人員'] },
            { title: '發包採購', roles: ['採購主管', '估算工程師', '合約管理師'] },
          ],
        },
        {
          title: '管理部',
          roles: ['行政管理', '財務', '人事'],
          children: [
            { title: '行政人事', roles: ['HR', '行政助理', '總務'] },
            { title: '財務會計', roles: ['財務經理', '會計', '出納'] },
            { title: '法務', roles: ['法務人員', '合約審查'] },
          ],
        },
      ],
    },
  },
  {
    id: 'hotel-hospitality',
    name: '飯店 / 餐旅',
    emoji: '🏨',
    description: '觀光飯店典型組織架構，以客務與餐飲為核心營運部門',
    tree: {
      title: '總經理',
      roles: ['飯店營運', 'VIP 客戶關係', '品牌策略'],
      children: [
        {
          title: '客務部',
          roles: ['客房營運', '顧客服務', '住房管理'],
          children: [
            { title: '前台', roles: ['大廳副理', '櫃台接待', '訂房主任', '禮賓員'] },
            { title: '房務', roles: ['房務主管', '房務員', '洗衣房主管'] },
            { title: '休閒設施', roles: ['健身房管理', '游泳池救生員', 'SPA 管理'] },
          ],
        },
        {
          title: '餐飲部',
          roles: ['餐廳營運', '廚房管理', '宴會活動'],
          children: [
            { title: '中餐廳', roles: ['餐廳經理', '主廚', '二廚', '外場領班', '服務員'] },
            { title: '西餐廳', roles: ['餐廳經理', '行政主廚', '副主廚', '甜點師', '侍酒師'] },
            { title: '宴會廳', roles: ['宴會業務', '宴會主廚', '宴會外場主管'] },
          ],
        },
        {
          title: '業務行銷部',
          roles: ['業務開發', '行銷推廣', '公關媒體'],
          children: [
            { title: '業務組', roles: ['業務經理', '旅行社業務', '企業業務'] },
            { title: '行銷組', roles: ['行銷經理', '數位行銷', '公關'] },
          ],
        },
        {
          title: '管理部門',
          roles: ['後勤管理', '財務管控', '人資管理'],
          children: [
            { title: '人力資源', roles: ['HR 經理', '招募專員', '教育訓練'] },
            { title: '財務', roles: ['財務經理', '夜間稽核', '成本控制'] },
            { title: '工程部', roles: ['工程主管', '水電技師', '空調技師'] },
          ],
        },
      ],
    },
  },
  {
    id: 'finance-department',
    name: '財務部門',
    emoji: '💰',
    description: '中大型企業財務部門的內部組織架構，涵蓋財務、會計、稅務與 FP&A',
    tree: {
      title: 'CFO / 財務長',
      roles: ['財務策略', '資本管理', '投資人關係', '上市規劃'],
      children: [
        {
          title: '財務管理組',
          roles: ['資金調度', '銀行關係', '外匯管理'],
          children: [
            { title: '資金調度', roles: ['資金經理', '出納', '銀行往來管理'] },
            { title: '投資管理', roles: ['投資分析師', '資產管理'] },
          ],
        },
        {
          title: '會計組',
          roles: ['帳務處理', '財報編製', '內部控制'],
          children: [
            { title: '總帳', roles: ['總帳會計', '成本會計', '應收帳款'] },
            { title: '財報', roles: ['財報編製', 'IFRS 專員', '合併報表'] },
          ],
        },
        {
          title: '稅務組',
          roles: ['稅務規劃', '稅務申報', '移轉訂價'],
          children: [
            { title: '稅務申報', roles: ['稅務專員', '營業稅', '營所稅'] },
            { title: '稅務規劃', roles: ['稅務經理', '國際稅務', '移轉訂價'] },
          ],
        },
        {
          title: 'FP&A（財務規劃分析）',
          roles: ['預算規劃', '業績分析', '財務模型'],
          children: [
            { title: '預算管理', roles: ['預算分析師', '預算經理'] },
            { title: '業績分析', roles: ['FP&A 分析師', '商業分析師', '管理報表'] },
          ],
        },
      ],
    },
  },
];

// ============================================================
// DATA: PROMPT_TEMPLATES (20 prompts)
// ============================================================
const PROMPT_TEMPLATES: PromptItem[] = [
  // --- Industry (5) ---
  {
    id: 'p-ind-1',
    category: 'industry',
    title: '產業全景分析',
    description: '快速了解一個產業的全貌、商業模式與人才市場',
    template: `請幫我全面分析「{{產業名稱}}」產業：

1. 產業概述：這個產業在做什麼？誰是主要玩家？
2. 商業模式：主流的商業模式有哪些？如何賺錢？
3. 產業鏈：上中下游的角色分別是誰？
4. 人才市場：
   - 最搶手的職缺是什麼？
   - 人才供需狀況如何？
   - 薪資水準範圍？
5. 趨勢與挑戰：未來 2-3 年的關鍵趨勢？
6. 對獵頭的建議：切入這個產業的最佳策略？`,
  },
  {
    id: 'p-ind-2',
    category: 'industry',
    title: '競爭對手地圖',
    description: '繪製特定公司的競爭者與人才流動地圖',
    template: `請幫我分析「{{公司名稱}}」在「{{產業名稱}}」中的競爭地圖：

1. 直接競爭者（5-8 家）：做相同產品/服務的公司
2. 間接競爭者（3-5 家）：在不同領域但搶同一批人才的公司
3. 人才流動方向：
   - 人才通常從哪些公司流入？
   - 人才通常往哪些公司流出？
4. 各競爭者的雇主品牌定位與差異化
5. 薪資與福利競爭力比較
6. 對我們挖角策略的建議`,
  },
  {
    id: 'p-ind-3',
    category: 'industry',
    title: '市場趨勢追蹤',
    description: '追蹤產業最新趨勢與人才影響',
    template: `請幫我追蹤「{{產業名稱}}」的最新市場趨勢：

1. 過去 6 個月的重大產業事件（裁員/擴張/併購/IPO）
2. 新興技術或商業模式的影響
3. 監管政策變化對人才的影響
4. 浮出的新職缺類型或技能需求
5. 薪資市場的變動趨勢
6. 對我們接下來 3 個月的招募策略建議`,
  },
  {
    id: 'p-ind-4',
    category: 'industry',
    title: '商業模式拆解',
    description: '深入理解一家公司的商業模式與組織結構',
    template: `請幫我拆解「{{公司名稱}}」的商業模式：

1. 價值主張：提供什麼核心價值？解決什麼問題？
2. 客戶群體：誰是主要客戶？B2B 還是 B2C？
3. 收入來源：如何賺錢？收入結構比重？
4. 核心資源：最重要的資產是什麼（技術/數據/人才/品牌）？
5. 組織推論：基於商業模式，推論可能的部門組成
6. 關鍵崗位：哪些角色對公司最為重要？
7. 人才需求預測：公司接下來可能需要什麼人？`,
  },
  {
    id: 'p-ind-5',
    category: 'industry',
    title: '產業術語速查',
    description: '快速了解特定產業的專業術語與縮寫',
    template: `我是一位獵頭顧問，即將接觸「{{產業名稱}}」的客戶與候選人。
請幫我整理這個產業最常用的 20 個專業術語：

格式：
- 術語（英文縮寫）：白話解釋 + 使用場景

分類為：
1. 技術術語（5-7 個）
2. 商業術語（5-7 個）
3. 職位相關術語（3-5 個）
4. 流程/方法論術語（3-5 個）

額外補充：面試中聽到這些術語時，如何判斷候選人是否真的懂？`,
  },
  // --- Company (5) ---
  {
    id: 'p-com-1',
    category: 'company',
    title: '公司定位分析',
    description: '全面了解一家公司的定位、文化與招募策略',
    template: `請幫我全面分析「{{公司名稱}}」：

1. 公司概述：成立時間、規模、主要產品/服務
2. 市場定位：在產業中的位置（領導者/挑戰者/利基）
3. 技術棧推測：根據公開資訊推測使用的技術
4. 企業文化：
   - Glassdoor/面試趣 上的評價重點
   - 工程文化特色（開源貢獻/技術部落格/研討會參與）
5. 招募分析：
   - 目前公開職缺分析
   - 人才需求趨勢
   - 薪資競爭力
6. 合作建議：我們如何切入這家公司的招募需求？`,
  },
  {
    id: 'p-com-2',
    category: 'company',
    title: '組織架構推論',
    description: '從公開資訊推論公司的組織架構',
    template: `請根據以下資訊推論「{{公司名稱}}」的組織架構：

已知資訊：
- 公司規模：{{員工人數}}
- 主要產品：{{產品描述}}
- 近期職缺：{{職缺列表}}

請推論：
1. 可能的部門架構（畫出組織樹）
2. 各部門預估人數與關鍵角色
3. 彙報線（Reporting Line）推測
4. 可能的決策者與招募窗口
5. 我們可以從哪個部門切入？`,
  },
  {
    id: 'p-com-3',
    category: 'company',
    title: '企業文化解讀',
    description: '從多方資訊解讀企業文化與工作環境',
    template: `請幫我分析「{{公司名稱}}」的企業文化：

參考資訊：{{公開資訊/評價摘要}}

請分析：
1. 工作風格：步調快慢？彈性工時？遠端政策？
2. 管理風格：扁平還是階層分明？微管理還是授權？
3. 技術文化：重視創新實驗還是穩定可靠？
4. 成長環境：內部培訓機會？技術會議預算？
5. 工作生活平衡：加班文化？休假政策？
6. 對候選人的建議：什麼性格的人適合這家公司？
7. 面試時如何向候選人呈現這家公司的吸引力？`,
  },
  {
    id: 'p-com-4',
    category: 'company',
    title: '招募策略規劃',
    description: '為特定客戶制定完整的招募策略',
    template: `請幫我為「{{公司名稱}}」制定招募策略：

招募需求：{{職缺描述}}
時程要求：{{期限}}
預算範圍：{{薪資預算}}

請規劃：
1. 人才畫像：理想候選人的背景、技能、特質
2. Sourcing 策略：
   - 目標公司清單（按優先級排序）
   - LinkedIn 搜尋關鍵字組合
   - 其他管道建議
3. 接觸話術：第一封 InMail 的重點
4. 面試流程建議
5. Offer 談判策略
6. 風險評估：可能遇到的挑戰與應對`,
  },
  {
    id: 'p-com-5',
    category: 'company',
    title: '競品公司比較',
    description: '比較兩家或多家公司的差異以利人才推薦',
    template: `請幫我比較以下公司，作為人才推薦的參考：

公司 A：{{公司A名稱}}
公司 B：{{公司B名稱}}
比較職缺：{{職缺類型}}

請從以下維度比較：
1. 公司規模與發展階段
2. 技術棧差異
3. 薪資與福利
4. 企業文化與工作環境
5. 職涯發展空間
6. 品牌知名度與雇主品牌
7. 對不同類型候選人的吸引力
8. 我應該如何向候選人介紹這兩家公司的差異？`,
  },
  // --- Role (5) ---
  {
    id: 'p-role-1',
    category: 'role',
    title: '角色深度解析',
    description: '全面理解一個職位的工作內容、技能需求與市場行情',
    template: `請幫我深度解析「{{職位名稱}}」這個角色：

1. 白話解釋：這個角色每天在做什麼？用一句話說明。
2. 核心職責（日常工作 Top 5）
3. 必備技能 vs 加分技能
4. 常見技術棧/工具
5. 薪資行情：
   - Junior（0-2 年）
   - Mid-level（3-5 年）
   - Senior（5 年以上）
6. 職涯路徑：這個角色未來可以往哪裡發展？
7. 面試必問問題（5 題）
8. 紅旗警示：哪些回答代表候選人可能不適合？
9. 驗證方法：如何判斷候選人是否真的有料？
10. 常見來源公司：哪些公司的人特別適合？`,
  },
  {
    id: 'p-role-2',
    category: 'role',
    title: 'JD 翻譯器',
    description: '將客戶的 JD 翻譯成白話文，找出核心需求',
    template: `請幫我「翻譯」以下職缺描述（JD），找出客戶真正要什麼：

原始 JD：
{{貼上完整 JD}}

請分析：
1. 白話翻譯：用淺白的語言說明這個職缺在做什麼
2. 核心技能拆解：
   - 真正的必備條件（vs 寫來撐場面的）
   - 隱藏需求（JD 沒寫但其實很重要的）
3. 難度評估：1-5 星，說明原因
4. 薪資合理性：這個 JD 的薪資範圍是否符合市場？
5. 紅旗提醒：JD 中有什麼需要跟客戶確認的？
6. 建議搜尋關鍵字（用於 LinkedIn 搜尋）`,
  },
  {
    id: 'p-role-3',
    category: 'role',
    title: '人才地圖繪製',
    description: '為特定職缺繪製目標人才地圖',
    template: `請幫我為以下職缺繪製人才地圖：

職缺：{{職位名稱}}
公司：{{公司名稱}}
關鍵需求：{{核心技能}}

請提供：
1. Tier 1 目標公司（最佳匹配，5-8 家）
   - 公司名稱 + 對應的目標職位
2. Tier 2 目標公司（良好匹配，5-8 家）
3. Tier 3 替代來源（跨領域可遷移，3-5 家）
4. LinkedIn 搜尋策略：
   - 關鍵字組合 × 3 套
   - Boolean Search 建議
5. 預估人才庫大小與接觸難度
6. 挖角話術建議（針對不同公司調整）`,
  },
  {
    id: 'p-role-4',
    category: 'role',
    title: '面試問題設計',
    description: '為特定角色設計結構化面試問題',
    template: `請幫我為「{{職位名稱}}」設計結構化面試問題：

職缺需求重點：{{核心需求}}
年資要求：{{年資範圍}}

請設計以下面試問題：
1. 開場暖身題（2 題）
2. 技術/專業能力評估（5 題）
   - 每題附帶：優秀回答的特徵 / 不及格回答的特徵
3. 行為面試題 STAR（3 題）
4. 情境題（2 題）
5. 文化適配度題（2 題）
6. 候選人提問時間的評估要點

額外：每題建議的追問方向`,
  },
  {
    id: 'p-role-5',
    category: 'role',
    title: '技能差距分析',
    description: '分析候選人與職缺之間的技能差距',
    template: `請幫我分析候選人與職缺的匹配度：

職缺需求：
{{職缺描述或 JD}}

候選人背景：
{{候選人履歷摘要}}

請分析：
1. 匹配度評分（0-100）
2. 技能匹配矩陣：
   - ✅ 完全匹配的技能
   - ⚠️ 部分匹配（可培養）
   - ❌ 明顯缺少的技能
3. 加分項：JD 沒有要求但候選人具備的
4. 風險評估：可能的適應困難
5. 面試確認重點：哪些能力需要面試時深入驗證
6. 推薦/不推薦建議與理由`,
  },
  // --- Evaluation (5) ---
  {
    id: 'p-eval-1',
    category: 'evaluation',
    title: '履歷快篩清單',
    description: '快速建立特定職缺的履歷篩選標準',
    template: `請幫我建立「{{職位名稱}}」的履歷快篩標準：

職缺需求：{{核心需求摘要}}
年資要求：{{年資範圍}}

請建立：
1. Must-Have 清單（缺一即淘汰）：5 項
2. Nice-to-Have 清單（加分項）：5 項
3. 紅旗清單（看到就要小心）：5 項
4. 加速通過清單（看到就優先安排面試）：3 項
5. 履歷常見包裝手法與識別方法
6. 30 秒快篩 SOP：先看哪裡→再看哪裡→最後確認`,
  },
  {
    id: 'p-eval-2',
    category: 'evaluation',
    title: '面試評分表',
    description: '製作標準化的面試評分表',
    template: `請幫我製作「{{職位名稱}}」的面試評分表：

評估維度：
1. 技術/專業能力（權重 {{技術權重}}%）
2. 問題解決能力（權重 {{問題解決權重}}%）
3. 溝通協作能力（權重 {{溝通權重}}%）
4. 文化適配度（權重 {{文化權重}}%）
5. 成長潛力（權重 {{成長權重}}%）

每個維度請提供：
- 具體評估標準
- 1-5 分的定義（1=不及格, 3=合格, 5=優秀）
- 對應的面試問題
- 評分時的注意事項

最終：加權計算公式與建議錄用門檻`,
  },
  {
    id: 'p-eval-3',
    category: 'evaluation',
    title: '紅旗偵測器',
    description: '識別候選人面試中的警告信號',
    template: `請幫我建立「{{職位名稱}}」的面試紅旗偵測清單：

1. 履歷紅旗（5 項）：
   - 具體描述 + 為什麼是紅旗 + 如何確認
2. 面試回答紅旗（5 項）：
   - 具體回答範例 + 背後可能的問題 + 追問方式
3. 行為紅旗（5 項）：
   - 行為描述 + 可能代表的問題 + 如何判斷
4. 離職原因紅旗（3 項）
5. 薪資談判紅旗（3 項）

注意：區分「真的紅旗」vs「可以解釋的合理情況」`,
  },
  {
    id: 'p-eval-4',
    category: 'evaluation',
    title: 'Offer 談判策略',
    description: '為候選人與客戶之間的 Offer 談判做準備',
    template: `請幫我準備 Offer 談判策略：

職缺：{{職位名稱}}
客戶公司：{{公司名稱}}
候選人現職薪資：{{現有薪資}}
客戶預算範圍：{{薪資預算}}
候選人期望薪資：{{期望薪資}}

請分析：
1. 市場薪資行情參考
2. 談判空間評估
3. 非現金補償建議（股票/彈性/培訓/title 等）
4. 對候選人的溝通話術
5. 對客戶的說服策略
6. 常見卡關點與解法
7. 談判時間線建議`,
  },
  {
    id: 'p-eval-5',
    category: 'evaluation',
    title: 'Reference Check 指南',
    description: '設計結構化的 Reference Check 問題',
    template: `請幫我設計「{{職位名稱}}」候選人的 Reference Check 問題：

候選人資訊：{{候選人簡介}}
需要確認的重點：{{確認重點}}

Reference Check 問題（依推薦人類型）：

1. 直屬主管（5 題）：
   - 工作表現、強弱項、離職原因
2. 同事/協作者（3 題）：
   - 團隊合作、溝通能力
3. 部屬（如適用，3 題）：
   - 管理風格、領導力

每題附帶：
- 理想回答的特徵
- 需要警惕的回答
- 追問的方向

注意事項：如何識別「被安排好的推薦人」`,
  },
];

// ============================================================
// DATA: LEARNING_PHASES (5 phases for 30-day training)
// ============================================================
const LEARNING_PHASES: LearningPhase[] = [
  {
    id: 'phase-1',
    name: '基礎建立',
    emoji: '📚',
    days: 'Day 1-7',
    description: '建立獵頭工作的基礎認知，了解產業全景與公司運作方式',
    tasks: [
      { id: 't-1-1', text: '閱讀並理解 3 個主要產業的全景分析', relatedTab: 'industry-map' },
      { id: 't-1-2', text: '學習 SaaS 與 SI 公司的組織架構差異', relatedTab: 'org-chart' },
      { id: 't-1-3', text: '使用「產業術語速查」Prompt 學習 2 個產業的術語', relatedTab: 'prompt-toolbox' },
      { id: 't-1-4', text: '完成至少 5 個角色家族的基礎了解', relatedTab: 'role-encyclopedia' },
      { id: 't-1-5', text: '練習使用「公司定位分析」Prompt 分析 3 家公司', relatedTab: 'prompt-toolbox' },
    ],
  },
  {
    id: 'phase-2',
    name: '角色理解',
    emoji: '🎯',
    days: 'Day 8-14',
    description: '深入理解各技術與非技術角色的工作內容、技能需求與薪資行情',
    tasks: [
      { id: 't-2-1', text: '精讀 5 個深度角色卡（Backend / Frontend / PM / DevOps / Data）', relatedTab: 'role-encyclopedia' },
      { id: 't-2-2', text: '練習「JD 翻譯器」Prompt，翻譯 3 份真實 JD', relatedTab: 'prompt-toolbox' },
      { id: 't-2-3', text: '了解各角色的薪資行情與職涯路徑', relatedTab: 'role-encyclopedia' },
      { id: 't-2-4', text: '記住每個角色的 5 個面試必問題', relatedTab: 'role-encyclopedia' },
      { id: 't-2-5', text: '練習辨識各角色的紅旗警示信號', relatedTab: 'role-encyclopedia' },
    ],
  },
  {
    id: 'phase-3',
    name: '人才地圖',
    emoji: '🗺️',
    days: 'Day 15-21',
    description: '學習如何繪製人才地圖，建立目標公司與候選人的搜尋策略',
    tasks: [
      { id: 't-3-1', text: '使用「人才地圖繪製」Prompt 為 2 個職缺建立人才地圖', relatedTab: 'prompt-toolbox' },
      { id: 't-3-2', text: '學習各角色的常見來源公司並記住 Top 10', relatedTab: 'role-encyclopedia' },
      { id: 't-3-3', text: '練習 LinkedIn Boolean Search 組合搜尋', relatedTab: 'prompt-toolbox' },
      { id: 't-3-4', text: '分析 3 個職缺的競爭對手地圖', relatedTab: 'prompt-toolbox' },
      { id: 't-3-5', text: '了解不同產業的人才流動方向', relatedTab: 'industry-map' },
    ],
  },
  {
    id: 'phase-4',
    name: '職缺拆解',
    emoji: '🔬',
    days: 'Day 22-26',
    description: '實戰練習職缺分析與候選人評估，準備面試流程',
    tasks: [
      { id: 't-4-1', text: '使用 Job Analyzer 分析 5 個真實職缺', relatedTab: 'job-analyzer' },
      { id: 't-4-2', text: '為 3 個職缺設計面試問題與評分表', relatedTab: 'prompt-toolbox' },
      { id: 't-4-3', text: '練習「履歷快篩清單」建立篩選標準', relatedTab: 'prompt-toolbox' },
      { id: 't-4-4', text: '練習「紅旗偵測器」識別候選人警告信號', relatedTab: 'prompt-toolbox' },
      { id: 't-4-5', text: '模擬一次完整的 Offer 談判情境', relatedTab: 'prompt-toolbox' },
    ],
  },
  {
    id: 'phase-5',
    name: '實戰上場',
    emoji: '🚀',
    days: 'Day 27-30',
    description: '綜合應用所學，獨立處理完整的招募流程',
    tasks: [
      { id: 't-5-1', text: '獨立完成一個職缺從需求分析到候選人推薦的完整流程' },
      { id: 't-5-2', text: '整理個人的 Prompt 工具箱（收藏最常用的 10 個 Prompt）', relatedTab: 'prompt-toolbox' },
      { id: 't-5-3', text: '建立自己的產業知識筆記與角色對照表' },
      { id: 't-5-4', text: '與主管進行 30 天學習回顧與成長計畫討論' },
    ],
  },
];

// ============================================================
// TOUR STEPS
// ============================================================
const TOUR_STEPS: TourStep[] = [
  {
    target: 'learning-tabs',
    title: '學習中心導覽',
    content: '這裡有 6 個學習模組，從產業知識到實戰工具，幫助你快速上手獵頭工作。',
    placement: 'bottom',
  },
  {
    target: 'role-families',
    title: '角色百科',
    content: '這裡收錄了 16 個深度角色卡，涵蓋技術與非技術職位，每個角色都有完整的技能需求、薪資行情與面試指南。',
    placement: 'bottom',
  },
  {
    target: 'job-selector',
    title: '職缺分析器',
    content: '選擇一個職缺，系統會自動分析所需技能、薪資範圍與面試重點，讓你快速理解客戶需求。',
    placement: 'bottom',
  },
  {
    target: 'prompt-copy',
    title: 'Prompt 工具箱',
    content: '20 個精心設計的 Prompt 模板，涵蓋產業分析、角色理解、人才評估等場景，一鍵複製即可使用。',
    placement: 'bottom',
  },
  {
    target: 'learning-progress',
    title: '30 天學習路徑',
    content: '按照 5 個階段循序漸進，30 天後你將具備獨立處理職缺的能力。完成任務後打勾追蹤進度！',
    placement: 'bottom',
  },
];

// ============================================================
// SUB-COMPONENT: OrgTreeNode (recursive)
// ============================================================
// --- Mobile: vertical indented tree (unchanged) ---
function OrgTreeNodeVertical({ node, depth = 0 }: { node: OrgChartNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-gray-200 pl-4 mt-2' : ''}>
      <div
        className="bg-white rounded-lg border border-gray-200 p-2.5 cursor-pointer hover:shadow-md transition-all"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {node.children && node.children.length > 0 && (
            expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          <span className="font-semibold text-sm text-gray-800">{node.title}</span>
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {node.roles.map((role, i) => (
            <span key={i} className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{role}</span>
          ))}
        </div>
      </div>
      {expanded && node.children && node.children.map((child, i) => (
        <OrgTreeNodeVertical key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

// --- Desktop: horizontal top-down org chart ---
function OrgNodeBox({ node, depth, colorMap }: { node: OrgChartNode; depth: number; colorMap: Record<number, { bg: string; border: string; text: string }> }) {
  const colors = colorMap[depth] || colorMap[2];
  return (
    <div className={`rounded-lg border-2 px-3 py-2 text-center min-w-[140px] max-w-[200px] ${colors.border} ${colors.bg}`}>
      <div className={`font-semibold text-sm ${colors.text}`}>{node.title}</div>
      <div className="flex flex-wrap justify-center gap-1 mt-1.5">
        {node.roles.map((role, i) => (
          <span key={i} className="text-[10px] px-1.5 py-0.5 bg-white/70 text-gray-600 rounded-full">{role}</span>
        ))}
      </div>
    </div>
  );
}

function HorizontalOrgTree({ tree }: { tree: OrgChartNode }) {
  const colorMap: Record<number, { bg: string; border: string; text: string }> = {
    0: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-800' },
    1: { bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-700' },
    2: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' },
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div className="inline-flex flex-col items-center min-w-full">
        {/* Root node */}
        <OrgNodeBox node={tree} depth={0} colorMap={colorMap} />

        {tree.children && tree.children.length > 0 && (
          <>
            {/* Vertical line from root */}
            <div className="w-0.5 h-6 bg-gray-300" />

            {/* Horizontal connector bar */}
            <div className="relative flex items-start">
              {/* Horizontal line spanning all L1 children */}
              {tree.children.length > 1 && (
                <div
                  className="absolute top-0 h-0.5 bg-gray-300"
                  style={{
                    left: `calc(${100 / tree.children.length / 2}% + 0px)`,
                    right: `calc(${100 / tree.children.length / 2}% + 0px)`,
                  }}
                />
              )}

              {/* L1 children */}
              <div className="flex gap-4 justify-center">
                {tree.children.map((l1, i) => (
                  <div key={i} className="flex flex-col items-center">
                    {/* Vertical line down to L1 box */}
                    <div className="w-0.5 h-6 bg-gray-300" />
                    <OrgNodeBox node={l1} depth={1} colorMap={colorMap} />

                    {/* L2 children */}
                    {l1.children && l1.children.length > 0 && (
                      <>
                        <div className="w-0.5 h-4 bg-gray-200" />
                        <div className="flex flex-col gap-1.5 items-center">
                          {l1.children.map((l2, j) => (
                            <div key={j} className="w-full">
                              <OrgNodeBox node={l2} depth={2} colorMap={colorMap} />
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Responsive wrapper: desktop=horizontal, mobile=vertical ---
function OrgTreeNode({ node }: { node: OrgChartNode }) {
  return (
    <>
      {/* Desktop: horizontal */}
      <div className="hidden md:block">
        <HorizontalOrgTree tree={node} />
      </div>
      {/* Mobile: vertical */}
      <div className="md:hidden">
        <OrgTreeNodeVertical node={node} />
      </div>
    </>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function LearningCenterPage({ userProfile }: LearningCenterProps) {
  // --- State ---
  const [activeTab, setActiveTab] = useState<LearningTab>('quick-start');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<RoleCard | null>(null);
  const [expandedIndustry, setExpandedIndustry] = useState<string | null>(null);
  const [selectedOrgChart, setSelectedOrgChart] = useState<string>(ORG_CHARTS[0].id);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tourActive, setTourActive] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('learning-completed-tasks');
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });
  const [promptFilter, setPromptFilter] = useState<PromptCategory | 'all'>('all');
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(['phase-1']));
  const [jobSearch, setJobSearch] = useState('');
  const [taxonomyFamilies, setTaxonomyFamilies] = useState<any[]>([]);

  // --- Smart Fill state ---
  const [clients, setClients] = useState<any[]>([]);
  const [smartFillJobId, setSmartFillJobId] = useState('');
  const [smartFillClientId, setSmartFillClientId] = useState('');
  const [sfJobOpen, setSfJobOpen] = useState(false);
  const [sfClientOpen, setSfClientOpen] = useState(false);
  const [sfJobSearch, setSfJobSearch] = useState('');
  const [sfClientSearch, setSfClientSearch] = useState('');
  const [sfIndustry, setSfIndustry] = useState('');
  const [showFilledPreview, setShowFilledPreview] = useState<string | null>(null);
  const sfJobRef = useRef<HTMLDivElement>(null);
  const sfClientRef = useRef<HTMLDivElement>(null);

  // --- Prompt 收集區 state ---
  const [collectionPrompts, setCollectionPrompts] = useState<Prompt[]>([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState<string>('all');
  const [collectionCopied, setCollectionCopied] = useState<number | null>(null);
  const [collectionSearch, setCollectionSearch] = useState('');

  const PROMPT_CATEGORIES = [
    '客戶需求理解', '職缺分析', '人才市場 Mapping', '人才搜尋',
    '陌生開發（開發信）', '人選訪談', '人選評估', '客戶推薦', '面試與 Offer 管理',
  ];

  const loadCollectionPrompts = useCallback(async () => {
    setCollectionLoading(true);
    try {
      const params = collectionFilter !== 'all' ? `?category=${encodeURIComponent(collectionFilter)}` : '';
      const data = await apiGet<{ success: boolean; data: Prompt[] }>(`/prompts${params}`);
      if (data.success) setCollectionPrompts(data.data || []);
    } catch { setCollectionPrompts([]); }
    finally { setCollectionLoading(false); }
  }, [collectionFilter]);

  useEffect(() => {
    if (activeTab === 'prompt-collection') loadCollectionPrompts();
  }, [activeTab, loadCollectionPrompts]);

  const handleUpvote = async (promptId: number) => {
    try {
      const data = await apiPost<{ success: boolean; data: Prompt }>(`/prompts/${promptId}/upvote`, { voter: userProfile.displayName });
      if (data.success && data.data) {
        setCollectionPrompts(prev => prev.map(p => p.id === promptId
          ? { ...p, upvote_count: data.data.upvote_count, has_voted: data.data.has_voted }
          : p
        ));
      }
    } catch {}
  };

  const handleCopyCollection = (content: string, id: number) => {
    navigator.clipboard.writeText(content);
    setCollectionCopied(id);
    setTimeout(() => setCollectionCopied(null), 2000);
  };

  // --- Auto-start onboarding tour on first visit (respects global toggle) ---
  useEffect(() => {
    const globalOff = localStorage.getItem('step1ne-tours-disabled') === '1';
    if (globalOff) return;
    const done = localStorage.getItem('learning-center-tour-done');
    if (!done) {
      const timer = setTimeout(() => setTourActive(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  // --- Persist completed tasks ---
  useEffect(() => {
    localStorage.setItem('learning-completed-tasks', JSON.stringify([...completedTasks]));
  }, [completedTasks]);

  // --- Load taxonomy families from API ---
  useEffect(() => {
    if (activeTab === 'role-encyclopedia') {
      apiGet<any>('/taxonomy').then((data: any) => {
        if (data && Array.isArray(data)) {
          setTaxonomyFamilies(data);
        } else if (data?.families) {
          setTaxonomyFamilies(data.families);
        }
      }).catch(() => {
        // fallback: derive families from ROLE_KNOWLEDGE_BASE
        const families = Array.from(new Set(ROLE_KNOWLEDGE_BASE.map(r => r.family)));
        setTaxonomyFamilies(families.map(f => ({ name: f, id: f })));
      });
    }
  }, [activeTab]);

  // --- Load jobs + clients from API ---
  useEffect(() => {
    if (['job-analyzer', 'prompt-toolbox', 'industry-map', 'role-encyclopedia'].includes(activeTab)) {
      if (jobs.length === 0) {
        apiGet<any>('/jobs').then((data: any) => {
          const jobList = Array.isArray(data) ? data : (data?.jobs || data?.data || []);
          setJobs(jobList);
        }).catch(() => setJobs([]));
      }
      if (clients.length === 0) {
        apiGet<any>('/clients').then((data: any) => {
          const clientList = Array.isArray(data) ? data : (data?.data || []);
          setClients(clientList);
        }).catch(() => setClients([]));
      }
    }
  }, [activeTab]);

  // --- Click-outside for smart fill dropdowns ---
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sfJobRef.current && !sfJobRef.current.contains(e.target as Node)) setSfJobOpen(false);
      if (sfClientRef.current && !sfClientRef.current.contains(e.target as Node)) setSfClientOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // --- Auto-match client when job is selected ---
  useEffect(() => {
    if (!smartFillJobId || smartFillClientId) return; // skip if no job or client already picked
    const job = jobs.find((j: any) => String(j._id || j.id) === smartFillJobId);
    if (!job) return;
    const companyName = (job.client_company || job.company?.name || '').toLowerCase().trim();
    if (!companyName) return;
    const matchedClient = clients.find((c: any) =>
      (c.company_name || '').toLowerCase().trim() === companyName
    );
    if (matchedClient) {
      setSmartFillClientId(String(matchedClient._id || matchedClient.id));
      // Also set industry from matched client
      if (matchedClient.industry && !sfIndustry) {
        setSfIndustry(matchedClient.industry);
      }
    }
  }, [smartFillJobId, jobs, clients]);

  // --- Copy handler (with fallback for non-HTTPS) ---
  const handleCopy = useCallback((text: string, id: string) => {
    const onSuccess = () => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
        // Fallback: textarea method
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        onSuccess();
      });
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      onSuccess();
    }
  }, []);

  // --- Task toggle ---
  const toggleTask = useCallback((taskId: string) => {
    setCompletedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  // --- Toggle phase expand ---
  const togglePhase = useCallback((phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  }, []);

  // --- Derived data ---
  const roleFamilies = useMemo(() => {
    const familyMap = new Map<string, RoleCard[]>();
    ROLE_KNOWLEDGE_BASE.forEach(r => {
      if (!familyMap.has(r.family)) familyMap.set(r.family, []);
      familyMap.get(r.family)!.push(r);
    });
    return familyMap;
  }, []);

  const allFamilyNames = useMemo(() => {
    // Merge taxonomy API families with embedded data families
    const embedded = Array.from(roleFamilies.keys());
    if (taxonomyFamilies.length > 0) {
      const apiNames = taxonomyFamilies.map((f: any) => f.name || f.id || f);
      const merged = new Set([...apiNames, ...embedded]);
      return Array.from(merged);
    }
    return embedded;
  }, [roleFamilies, taxonomyFamilies]);

  const filteredFamilies = useMemo(() => {
    if (!searchQuery) return allFamilyNames;
    const q = searchQuery.toLowerCase();
    return allFamilyNames.filter(f => f.toLowerCase().includes(q));
  }, [allFamilyNames, searchQuery]);

  const filteredIndustries = useMemo(() => {
    if (!searchQuery) return INDUSTRY_MAP;
    const q = searchQuery.toLowerCase();
    return INDUSTRY_MAP.filter(ind =>
      ind.name.toLowerCase().includes(q) || ind.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const filteredPrompts = useMemo(() => {
    if (promptFilter === 'all') return PROMPT_TEMPLATES;
    return PROMPT_TEMPLATES.filter(p => p.category === promptFilter);
  }, [promptFilter]);

  const filteredJobs = useMemo(() => {
    let list = jobs;
    if (jobSearch) {
      const q = jobSearch.toLowerCase();
      list = list.filter((j: any) =>
        (j.position_name || j.title || '').toLowerCase().includes(q) ||
        (j.client_company || j.company?.name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [jobs, jobSearch]);

  // --- Overall progress for quick-start ---
  const totalTasks = LEARNING_PHASES.reduce((s, p) => s + p.tasks.length, 0);
  const completedCount = LEARNING_PHASES.reduce((s, p) => s + p.tasks.filter(t => completedTasks.has(t.id)).length, 0);
  const progressPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const phaseCompletionData = LEARNING_PHASES.map(p => ({
    name: p.name,
    completed: p.tasks.filter(t => completedTasks.has(t.id)).length,
    total: p.tasks.length,
  }));

  // --- Smart Fill computed values ---
  const sfSelectedJob = useMemo(() =>
    jobs.find((j: any) => String(j._id || j.id) === smartFillJobId) || null
  , [jobs, smartFillJobId]);

  const sfSelectedClient = useMemo(() =>
    clients.find((c: any) => String(c._id || c.id) === smartFillClientId) || null
  , [clients, smartFillClientId]);

  const hasFillData = !!smartFillJobId || !!smartFillClientId || !!sfIndustry;

  const sfFilteredJobs = useMemo(() => {
    if (!sfJobSearch) return jobs.slice(0, 50);
    const q = sfJobSearch.toLowerCase();
    return jobs.filter((j: any) =>
      (j.position_name || j.title || '').toLowerCase().includes(q) ||
      (j.client_company || j.company?.name || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [jobs, sfJobSearch]);

  const sfFilteredClients = useMemo(() => {
    let filtered = clients;
    // 先按產業篩選（sfIndustry 有值時只顯示同產業客戶）
    if (sfIndustry) {
      const indLower = sfIndustry.toLowerCase();
      // 模糊匹配：「SaaS / 軟體服務」可匹配 industry 含 "saas" 或 "軟體" 的客戶
      const indKeywords = indLower.split(/[\/\s、,]+/).filter(Boolean);
      filtered = clients.filter((c: any) => {
        const ci = (c.industry || '').toLowerCase();
        if (!ci) return false;
        return indKeywords.some((kw: string) => ci.includes(kw) || kw.includes(ci));
      });
    }
    // 再按搜尋文字篩選
    if (sfClientSearch) {
      const q = sfClientSearch.toLowerCase();
      filtered = filtered.filter((c: any) =>
        (c.company_name || '').toLowerCase().includes(q) ||
        (c.industry || '').toLowerCase().includes(q)
      );
    }
    return filtered.slice(0, 50);
  }, [clients, sfClientSearch, sfIndustry]);

  // --- Smart Fill: industry quick-pick options ---
  const INDUSTRY_QUICK_PICKS = INDUSTRY_MAP.map(ind => ind.name);

  // --- Smart Fill Bar render ---
  const renderSmartFillBar = () => (
    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4 mb-4">
      <h4 className="text-sm font-semibold text-indigo-800 mb-3 flex items-center gap-2">
        <Zap className="w-4 h-4" /> 智能填入 — 選擇職缺/客戶/產業自動替換 Prompt 變數
      </h4>
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Job Selector */}
        <div className="flex-1 min-w-0" ref={sfJobRef}>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">職缺</label>
          <div className="relative">
            <Briefcase className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={sfJobSearch}
              onChange={e => { setSfJobSearch(e.target.value); setSfJobOpen(true); if (!e.target.value) setSmartFillJobId(''); }}
              onFocus={() => setSfJobOpen(true)}
              placeholder={smartFillJobId ? '' : '搜尋職缺名稱或公司...'}
              className="w-full pl-8 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
            />
            {smartFillJobId && !sfJobSearch && (
              <div className="absolute inset-0 flex items-center pl-8 pr-8 pointer-events-none">
                <span className="text-sm text-gray-700 truncate">
                  {sfSelectedJob ? `${sfSelectedJob.position_name || sfSelectedJob.title} (${sfSelectedJob.client_company || ''})` : ''}
                </span>
              </div>
            )}
            {smartFillJobId && (
              <button onClick={() => { setSmartFillJobId(''); setSfJobSearch(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
            )}
            {sfJobOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {sfFilteredJobs.length > 0 ? sfFilteredJobs.map((j: any) => (
                  <div
                    key={j._id || j.id}
                    onClick={() => { setSmartFillJobId(String(j._id || j.id)); setSfJobSearch(''); setSfJobOpen(false); }}
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 ${String(j._id || j.id) === smartFillJobId ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-gray-700'}`}
                  >
                    {j.position_name || j.title} <span className="text-gray-400">({j.client_company || ''})</span>
                  </div>
                )) : (
                  <div className="px-3 py-3 text-sm text-gray-400 text-center">
                    {jobs.length === 0 ? '載入中...' : '找不到符合的職缺'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Client Selector */}
        <div className="flex-1 min-w-0" ref={sfClientRef}>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">客戶</label>
          <div className="relative">
            <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={sfClientSearch}
              onChange={e => { setSfClientSearch(e.target.value); setSfClientOpen(true); if (!e.target.value) setSmartFillClientId(''); }}
              onFocus={() => setSfClientOpen(true)}
              placeholder={smartFillClientId ? '' : '搜尋客戶公司或產業...'}
              className="w-full pl-8 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
            />
            {smartFillClientId && !sfClientSearch && (
              <div className="absolute inset-0 flex items-center pl-8 pr-8 pointer-events-none">
                <span className="text-sm text-gray-700 truncate">
                  {sfSelectedClient ? `${sfSelectedClient.company_name}${sfSelectedClient.industry ? ` (${sfSelectedClient.industry})` : ''}` : ''}
                </span>
              </div>
            )}
            {smartFillClientId && (
              <button onClick={() => { setSmartFillClientId(''); setSfClientSearch(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
            )}
            {sfClientOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {/* 產業篩選提示 */}
                {sfIndustry && (
                  <div className="px-3 py-1.5 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                    <span className="text-[10px] text-indigo-600">篩選：{sfIndustry} 產業客戶</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSfIndustry(''); }}
                      className="text-[10px] text-indigo-500 hover:text-indigo-700 underline"
                    >顯示全部</button>
                  </div>
                )}
                {sfFilteredClients.length > 0 ? sfFilteredClients.map((c: any) => (
                  <div
                    key={c._id || c.id}
                    onClick={() => {
                      setSmartFillClientId(String(c._id || c.id));
                      setSfClientSearch('');
                      setSfClientOpen(false);
                      // Auto-fill industry from selected client
                      if (c.industry && !sfIndustry) setSfIndustry(c.industry);
                    }}
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 ${String(c._id || c.id) === smartFillClientId ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-gray-700'}`}
                  >
                    {c.company_name} {c.industry && <span className="text-gray-400">({c.industry})</span>}
                  </div>
                )) : (
                  <div className="px-3 py-3 text-sm text-gray-400 text-center">
                    {clients.length === 0 ? '載入中...' :
                     sfIndustry ? `此產業沒有客戶，請先為客戶標註產業` : '找不到符合的客戶'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Industry input + quick picks */}
      <div className="mt-3">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">產業名稱</label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-[300px]">
            <MapIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={sfIndustry}
              onChange={e => setSfIndustry(e.target.value)}
              placeholder="輸入產業名稱，如 SaaS、金融科技..."
              className="w-full pl-8 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
            />
            {sfIndustry && (
              <button onClick={() => setSfIndustry('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {INDUSTRY_QUICK_PICKS.map(ind => (
            <button
              key={ind}
              onClick={() => setSfIndustry(ind)}
              className={`text-[11px] px-2.5 py-1 rounded-full transition-all ${
                sfIndustry === ind
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              {ind}
            </button>
          ))}
        </div>
      </div>

      {/* Fill status */}
      {hasFillData && (
        <div className="mt-2.5 text-xs text-indigo-600 flex items-center gap-1.5 flex-wrap">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span>已選擇：</span>
          {sfSelectedJob && <span className="font-semibold">{sfSelectedJob.position_name || sfSelectedJob.title}</span>}
          {sfSelectedJob && (sfSelectedClient || sfIndustry) && <span className="text-indigo-400"> + </span>}
          {sfSelectedClient && <span className="font-semibold">{sfSelectedClient.company_name}</span>}
          {sfSelectedClient && sfIndustry && <span className="text-indigo-400"> + </span>}
          {sfIndustry && !sfSelectedClient && sfSelectedJob && <span className="text-indigo-400"> + </span>}
          {sfIndustry && <span className="font-semibold">{sfIndustry}</span>}
          <span className="text-indigo-400 ml-1">— 下方 Prompt 已自動填入</span>
        </div>
      )}
    </div>
  );

  // --- Tab definitions ---
  const tabs: { id: LearningTab; label: string; shortLabel: string; icon: React.ReactNode }[] = [
    { id: 'quick-start', label: '30天速成', shortLabel: '速成', icon: <Zap className="w-4 h-4" /> },
    { id: 'industry-map', label: '產業地圖', shortLabel: '產業', icon: <MapIcon className="w-4 h-4" /> },
    { id: 'role-encyclopedia', label: '角色百科', shortLabel: '角色', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'org-chart', label: '組織架構', shortLabel: '組織', icon: <Layers className="w-4 h-4" /> },
    { id: 'job-analyzer', label: '職缺分析', shortLabel: '分析', icon: <Target className="w-4 h-4" /> },
    { id: 'prompt-toolbox', label: 'Prompt 工具箱', shortLabel: 'Prompt', icon: <Bot className="w-4 h-4" /> },
    { id: 'prompt-collection', label: 'Prompt 收集區', shortLabel: '收集區', icon: <MessageSquare className="w-4 h-4" /> },
  ];

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="space-y-6">
      {/* Onboarding Tour */}
      <OnboardingTour
        storageKey="learning-center-tour-done"
        steps={TOUR_STEPS}
        active={tourActive}
        onComplete={() => setTourActive(false)}
      />

      {/* Page Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <GraduationCap className="w-8 h-8" />
          <h1 className="text-2xl font-bold">學習中心</h1>
        </div>
        <p className="text-blue-100 text-sm">從產業知識到實戰技巧，30 天成為專業獵頭顧問</p>
        <div className="flex items-center gap-4 mt-4">
          <div className="flex-1 bg-white/20 rounded-full h-2">
            <div
              className="bg-white rounded-full h-2 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-sm font-medium">{progressPercent}% 完成</span>
          <button
            onClick={() => {
              localStorage.removeItem('learning-center-tour-done');
              setTourActive(true);
            }}
            className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-full transition-colors"
            title="重新導覽"
          >
            <Eye className="w-3.5 h-3.5" />
            導覽
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-gray-200 bg-gray-50 rounded-t-lg" data-tour="learning-tabs">
        <div className="flex overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearchQuery(''); setSelectedFamily(null); setSelectedRole(null); }}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'text-blue-600 border-blue-600 bg-white'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">

        {/* ===================== TAB 1: Quick Start ===================== */}
        {activeTab === 'quick-start' && (
          <div className="space-y-6" data-tour="learning-progress">
            {/* Progress summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">30 天學習進度</h3>
                <span className="text-sm text-gray-500">{completedCount} / {totalTasks} 任務完成</span>
              </div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={phaseCompletionData}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: any, name: string) => {
                        if (name === 'completed') return [value, '已完成'];
                        return [value, '總計'];
                      }}
                    />
                    <Bar dataKey="total" fill="#e5e7eb" radius={[4, 4, 0, 0]} name="total" />
                    <Bar dataKey="completed" fill="#3b82f6" radius={[4, 4, 0, 0]} name="completed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Phase cards */}
            {LEARNING_PHASES.map(phase => {
              const phaseCompleted = phase.tasks.filter(t => completedTasks.has(t.id)).length;
              const phaseTotal = phase.tasks.length;
              const isExpanded = expandedPhases.has(phase.id);

              return (
                <div key={phase.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-all">
                  <div
                    className="p-4 cursor-pointer flex items-center justify-between"
                    onClick={() => togglePhase(phase.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{phase.emoji}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-800">{phase.name}</h3>
                          <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{phase.days}</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{phase.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">{phaseCompleted}/{phaseTotal}</span>
                      {phaseCompleted === phaseTotal && phaseTotal > 0 ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4 space-y-2">
                      {phase.tasks.map(task => (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={completedTasks.has(task.id)}
                            onChange={() => toggleTask(task.id)}
                            className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <span className={`text-sm flex-1 ${completedTasks.has(task.id) ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                            {task.text}
                          </span>
                          {task.relatedTab && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveTab(task.relatedTab!); }}
                              className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                            >
                              前往 <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ===================== TAB 2: Industry Map ===================== */}
        {activeTab === 'industry-map' && (
          <div className="space-y-4">
            {/* How to use guide */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> 如何使用產業 Prompt？
              </h4>
              <div className="text-xs text-blue-700 space-y-2">
                <p><span className="font-semibold">步驟 1</span>：點擊下方產業卡片的「查看詳情」，系統會自動篩選該產業的客戶</p>
                <p><span className="font-semibold">步驟 2</span>：在「智能填入」的客戶欄選擇你要分析的客戶公司（只會顯示同產業的客戶）</p>
                <p><span className="font-semibold">步驟 3</span>：Prompt 會自動帶入客戶公司名稱，點擊「複製已填入版本」</p>
                <p><span className="font-semibold">步驟 4</span>：貼到 <span className="font-semibold">ChatGPT / Claude / 龍蝦 AI</span> 即可獲得分析報告</p>
                <div className="mt-1.5 pt-1.5 border-t border-blue-200">
                  <p className="font-semibold text-blue-800">📋 AI 會幫你產出什麼？</p>
                  <p className="mt-0.5">一份完整的<b>產業招募分析報告</b>，包含：該公司組織架構推測、關鍵招募角色 Top 5（含難度等級）、人才來源地圖（挖角目標公司）、薪資競爭力評估、獵頭切入建議。你可以直接用來<b>跟客戶提案</b>或<b>制定搜才策略</b>。</p>
                </div>
                <div className="mt-1 bg-blue-100/50 rounded-lg px-2.5 py-1.5">
                  <p className="text-[11px] text-blue-600">💡 <b>小提示</b>：客戶需要在 BD 客戶管理頁面標註「產業別」，才會出現在同產業的篩選結果中。沒有標註的客戶可以點「顯示全部」查看。</p>
                </div>
              </div>
            </div>

            {/* Smart Fill Bar */}
            {renderSmartFillBar()}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜尋產業..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Industry Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredIndustries.map(ind => {
                // Smart Fill for industry prompts
                // 有選客戶/職缺 → 用選的公司名（尊重使用者選擇）
                // 沒選 → 模板自帶的 [如 國泰金控] 等範例不動
                // 產業名 → 永遠用卡片自己的名稱（ind.name）
                const { filled: indFilled, replacementCount: indFillCount } = hasFillData
                  ? fillLearningPrompt(ind.promptTemplate, sfSelectedJob, sfSelectedClient, ind.name)
                  : { filled: ind.promptTemplate, replacementCount: 0 };
                const indIsFilled = hasFillData && indFillCount > 0;

                return (
                <div key={ind.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{ind.emoji}</span>
                    <h3 className="font-semibold text-gray-800">{ind.name}</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">{ind.description}</p>

                  {expandedIndustry === ind.id ? (
                    <div className="space-y-3 mt-3 border-t border-gray-100 pt-3">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 mb-1">商業模式</h4>
                        <div className="flex flex-wrap gap-1">
                          {ind.businessModels.map((m, i) => (
                            <span key={i} className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{m}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 mb-1">代表公司</h4>
                        <div className="flex flex-wrap gap-1">
                          {ind.typicalCompanies.map((c, i) => (
                            <span key={i} className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{c}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 mb-1">關鍵部門</h4>
                        <div className="flex flex-wrap gap-1">
                          {ind.keyDepartments.map((d, i) => (
                            <span key={i} className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full">{d}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 mb-1">常見職缺</h4>
                        <div className="flex flex-wrap gap-1">
                          {ind.commonRoles.map((r, i) => (
                            <span key={i} className="text-[11px] px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full">{r}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 mb-1">招募挑戰</h4>
                        <ul className="text-xs text-gray-600 space-y-1">
                          {ind.recruitingChallenges.map((ch, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                              {ch}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {/* 用途說明 */}
                      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2.5">
                        <p className="text-[11px] font-semibold text-indigo-700 mb-1">📋 這個 Prompt 會幫你產出什麼？</p>
                        <p className="text-[10px] text-indigo-600 leading-relaxed">
                          AI 會產出一份完整的<b>產業招募分析報告</b>，包含：組織架構、關鍵招募角色 Top 5、人才來源地圖（挖角目標公司）、薪資競爭力評估、獵頭切入建議。
                          你可以直接用這份報告<b>跟客戶提案</b>或<b>制定搜才策略</b>。
                        </p>
                      </div>
                      {/* Prompt preview with smart fill */}
                      {indIsFilled && (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full w-fit">
                          <CheckCircle2 className="w-3 h-3" /> 已自動填入 {indFillCount} 個變數
                        </div>
                      )}
                      <div className={`rounded-lg p-3 border ${indIsFilled ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                        <p className="text-[10px] text-gray-400 mb-1 font-medium">
                          {indIsFilled ? 'Prompt 預覽（已自動填入）' : 'Prompt 預覽 — 複製後將 [填入...] 替換成實際資料即可使用'}
                        </p>
                        <pre className="text-[11px] text-gray-600 whitespace-pre-wrap leading-relaxed font-sans">{indFilled}</pre>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleCopy(indFilled, `ind-prompt-${ind.id}`)}
                          className={`rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${
                            indIsFilled
                              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                              : 'bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100'
                          }`}
                        >
                          {copiedId === `ind-prompt-${ind.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedId === `ind-prompt-${ind.id}` ? '已複製！貼到 AI 工具使用' :
                           indIsFilled ? '複製已填入版本' : '複製 Prompt'}
                        </button>
                        <button onClick={() => setExpandedIndustry(null)} className="text-xs text-gray-400 hover:text-gray-600">
                          收合
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setExpandedIndustry(ind.id); setSfIndustry(ind.name); }}
                      className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                    >
                      查看詳情 <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================== TAB 3: Role Encyclopedia ===================== */}
        {activeTab === 'role-encyclopedia' && (
          <div className="space-y-4">
            {/* Smart Fill Bar for Role Encyclopedia */}
            {renderSmartFillBar()}

            {/* L3: Selected Role Detail */}
            {selectedRole ? (
              <div className="space-y-4">
                {/* Back button */}
                <button
                  onClick={() => setSelectedRole(null)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="w-4 h-4" /> 返回{selectedFamily ? `「${selectedFamily}」家族` : '角色列表'}
                </button>

                {/* Header */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-start gap-4">
                    <span className="text-4xl">{selectedRole.emoji}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-bold text-gray-800">{selectedRole.title}</h2>
                        <span className="text-sm text-gray-400">{selectedRole.titleEn}</span>
                        <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{selectedRole.family}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{selectedRole.careerPath}</p>
                    </div>
                  </div>
                </div>

                {/* 白話解釋 */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-indigo-500" /> 白話解釋
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{selectedRole.whyExists}</p>
                </div>

                {/* 每天在做什麼 */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" /> 每天在做什麼
                  </h3>
                  <ul className="space-y-1.5">
                    {selectedRole.dailyWork.map((item, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-blue-400 mt-0.5">•</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 必備 vs 加分技能 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 必備技能
                    </h3>
                    <ul className="space-y-1.5">
                      {selectedRole.mustHaveSkills.map((skill, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5">✓</span> {skill}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" /> 加分技能
                    </h3>
                    <ul className="space-y-1.5">
                      {selectedRole.niceToHaveSkills.map((skill, i) => (
                        <li key={i} className="text-sm text-gray-500 flex items-start gap-2">
                          <span className="text-gray-300 mt-0.5">○</span> {skill}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 技術棧 */}
                {selectedRole.techStack && selectedRole.techStack.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      <Code className="w-4 h-4 text-purple-500" /> 技術棧
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedRole.techStack.map((tech, i) => (
                        <span key={i} className="text-xs px-3 py-1 bg-purple-50 text-purple-700 rounded-full border border-purple-100">{tech}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 薪資行情 */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-500" /> 薪資行情參考（{selectedRole.salaryRange.currency}）
                  </h3>
                  <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 rounded px-2 py-1 mb-3 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    僅供初步參考，實際薪資因公司規模、產業、地區、個人資歷而有顯著差異。報價前請務必確認客戶預算與市場行情。
                  </p>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { level: 'Junior', value: parseSalaryMid(selectedRole.salaryRange.junior), fill: '#10b981', range: selectedRole.salaryRange.junior },
                        { level: 'Mid', value: parseSalaryMid(selectedRole.salaryRange.mid), fill: '#3b82f6', range: selectedRole.salaryRange.mid },
                        { level: 'Senior', value: parseSalaryMid(selectedRole.salaryRange.senior), fill: '#8b5cf6', range: selectedRole.salaryRange.senior },
                      ]}>
                        <XAxis dataKey="level" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} unit="K" />
                        <Tooltip
                          formatter={(value: any, name: string, props: any) => [`${props.payload.range}`, '薪資範圍']}
                          labelFormatter={(label: string) => `${label} Level`}
                        />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {[
                            { level: 'Junior', value: parseSalaryMid(selectedRole.salaryRange.junior), fill: '#10b981' },
                            { level: 'Mid', value: parseSalaryMid(selectedRole.salaryRange.mid), fill: '#3b82f6' },
                            { level: 'Senior', value: parseSalaryMid(selectedRole.salaryRange.senior), fill: '#8b5cf6' },
                          ].map((entry, index) => (
                            <Cell key={index} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">資料來源：綜合 CakeResume、104、Glassdoor 及獵頭實務經驗估算（2024-2025）</p>
                </div>

                {/* 常見來源公司 */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-500" /> 常見來源公司
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedRole.sourceCompanies.map((co, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{co}</span>
                    ))}
                  </div>
                </div>

                {/* 上下游角色 */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-500" /> 上下游角色
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedRole.relatedRoles.map((role, i) => {
                      const linked = ROLE_KNOWLEDGE_BASE.find(r => r.titleEn === role || r.title === role);
                      return linked ? (
                        <button
                          key={i}
                          onClick={() => setSelectedRole(linked)}
                          className="text-xs px-3 py-1 bg-teal-50 text-teal-700 rounded-full border border-teal-100 hover:bg-teal-100 transition-colors cursor-pointer"
                        >
                          {role}
                        </button>
                      ) : (
                        <span key={i} className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{role}</span>
                      );
                    })}
                  </div>
                </div>

                {/* 面試必問題 */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-500" /> 面試必問題
                  </h3>
                  <ol className="space-y-2">
                    {selectedRole.interviewQuestions.map((q, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="font-semibold text-indigo-400 mt-0.5">{i + 1}.</span> {q}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* 紅旗/誤判 */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" /> 紅旗警示
                  </h3>
                  <div className="space-y-2">
                    {selectedRole.redFlags.map((flag, i) => (
                      <div key={i} className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        {flag}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 驗證方法 */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 驗證方法
                  </h3>
                  <div className="space-y-2">
                    {selectedRole.howToVerify.map((v, i) => (
                      <div key={i} className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-sm text-emerald-700 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        {v}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 新人常犯錯 */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-amber-500" /> 新人常犯錯
                  </h3>
                  <div className="space-y-2">
                    {selectedRole.commonMistakes.map((m, i) => (
                      <div key={i} className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-700 flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        {m}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prompt 複製區 — 整合智能填入 */}
                {(() => {
                  const { filled: roleFilled, replacementCount: roleFillCount } = hasFillData
                    ? fillLearningPrompt(selectedRole.promptTemplate, sfSelectedJob, sfSelectedClient, sfIndustry)
                    : { filled: selectedRole.promptTemplate, replacementCount: 0 };
                  const roleIsFilled = hasFillData && roleFillCount > 0;
                  return (
                    <div className={`rounded-xl border p-4 ${roleIsFilled ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
                      <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-500" /> Prompt 複製區
                        {roleIsFilled && (
                          <span className="text-[10px] text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> 已自動填入 {roleFillCount} 個變數
                          </span>
                        )}
                      </h3>
                      <pre className={`rounded-lg p-3 text-xs font-mono whitespace-pre-wrap overflow-x-auto border max-h-48 overflow-y-auto ${
                        roleIsFilled ? 'bg-white/70 border-emerald-100 text-gray-700' : 'bg-gray-50 border-gray-100 text-gray-600'
                      }`}>
                        {roleFilled}
                      </pre>
                      <button
                        onClick={() => handleCopy(roleFilled, `role-prompt-${selectedRole.id}`)}
                        className={`mt-2 rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${
                          roleIsFilled
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                            : 'bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100'
                        }`}
                      >
                        {copiedId === `role-prompt-${selectedRole.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedId === `role-prompt-${selectedRole.id}` ? '已複製！貼到 AI 工具使用' :
                         roleIsFilled ? '複製已填入版本' : '複製 Prompt'}
                      </button>
                    </div>
                  );
                })()}
              </div>
            ) : selectedFamily ? (
              /* L2: Family selected → show roles in this family */
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedFamily(null)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="w-4 h-4" /> 返回角色家族
                </button>
                <h2 className="text-lg font-semibold text-gray-800">「{selectedFamily}」家族角色</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(roleFamilies.get(selectedFamily) || []).map(role => (
                    <div
                      key={role.id}
                      onClick={() => setSelectedRole(role)}
                      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{role.emoji}</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-semibold text-gray-800">{role.title}</h3>
                            <Star className="w-3.5 h-3.5 text-amber-400" />
                          </div>
                          <p className="text-xs text-gray-400">{role.titleEn}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2">{role.whyExists}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400" title="僅供參考，實際薪資依公司與個人資歷而異">
                        <DollarSign className="w-3 h-3" />
                        <span>{role.salaryRange.junior} ~ {role.salaryRange.senior}</span>
                        <span className="text-[9px] text-amber-500">*參考</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* L1: Family Grid */
              <div className="space-y-4" data-tour="role-families">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="搜尋角色家族..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredFamilies.map(family => {
                    const rolesInFamily = roleFamilies.get(family) || [];
                    const hasDeepCards = rolesInFamily.length > 0;
                    return (
                      <div
                        key={family}
                        onClick={() => { if (hasDeepCards) setSelectedFamily(family); }}
                        className={`bg-white rounded-xl border border-gray-200 p-4 transition-all ${
                          hasDeepCards ? 'hover:shadow-md cursor-pointer' : 'opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-gray-800 text-sm">{family}</h3>
                          {hasDeepCards && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5" /> {rolesInFamily.length}
                            </span>
                          )}
                        </div>
                        {hasDeepCards && (
                          <p className="text-xs text-gray-400">{rolesInFamily.map(r => r.title).join('、')}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 4: Org Chart ===================== */}
        {activeTab === 'org-chart' && (
          <div className="space-y-4">
            {/* Pill selector */}
            <div className="flex flex-wrap gap-2">
              {ORG_CHARTS.map(oc => (
                <button
                  key={oc.id}
                  onClick={() => setSelectedOrgChart(oc.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedOrgChart === oc.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {oc.emoji} {oc.name}
                </button>
              ))}
            </div>

            {/* Selected org chart */}
            {(() => {
              const oc = ORG_CHARTS.find(o => o.id === selectedOrgChart);
              if (!oc) return null;
              return (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="mb-3">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      <span className="text-xl">{oc.emoji}</span> {oc.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">{oc.description}</p>
                  </div>
                  <OrgTreeNode node={oc.tree} />
                </div>
              );
            })()}
          </div>
        )}

        {/* ===================== TAB 5: Job Analyzer ===================== */}
        {activeTab === 'job-analyzer' && (
          <div className="space-y-4" data-tour="job-selector">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜尋職缺..."
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Job list */}
              <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto">
                {filteredJobs.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    {jobs.length === 0 ? '載入職缺中...' : '沒有找到符合的職缺'}
                  </div>
                ) : (
                  filteredJobs.map((job: any) => (
                    <div
                      key={job._id || job.id}
                      onClick={() => setSelectedJob(job)}
                      className={`bg-white rounded-lg border p-3 cursor-pointer transition-all ${
                        selectedJob && (selectedJob._id || selectedJob.id) === (job._id || job.id)
                          ? 'border-blue-500 shadow-md'
                          : 'border-gray-200 hover:shadow-sm'
                      }`}
                    >
                      <h4 className="font-medium text-sm text-gray-800">{job.position_name || job.title || '未命名職缺'}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{job.client_company || job.company?.name || '未知公司'}</p>
                      {(job.salary_range || job.salary_min) && (
                        <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> {job.salary_range || `${job.salary_min}~${job.salary_max}`}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Job detail */}
              <div className="lg:col-span-2">
                {selectedJob ? (() => {
                  const job = selectedJob;
                  const title = job.position_name || job.title || '';
                  const company = job.client_company || job.company?.name || '';
                  const description = job.job_description || job.description || '';
                  const salary = job.salary_range || (job.salary_min ? `${job.salary_min}~${job.salary_max}` : '');
                  const matchingRole = ROLE_KNOWLEDGE_BASE.find(r =>
                    title.toLowerCase().includes(r.titleEn.toLowerCase()) ||
                    title.includes(r.title)
                  );
                  const skillsRaw = job.key_skills || job.requirements || job.must_have_skills || [];
                  const requirements = typeof skillsRaw === 'string'
                    ? skillsRaw.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean)
                    : Array.isArray(skillsRaw) ? skillsRaw : [];
                  const niceToHave = job.nice_to_have_skills || job.nice_to_have || [];
                  const rejectionRaw = job.rejection_criteria || [];
                  const rejectionCriteria = typeof rejectionRaw === 'string'
                    ? rejectionRaw.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean)
                    : Array.isArray(rejectionRaw) ? rejectionRaw : [];

                  // Build analysis text for copy
                  const analysisText = [
                    `職缺分析：${title}`,
                    `公司：${company}`,
                    job.department ? `部門：${job.department}` : '',
                    ``,
                    `核心技能：${requirements.join(', ')}`,
                    salary ? `薪資範圍：${salary}` : '',
                    job.experience_required ? `經驗要求：${job.experience_required}` : '',
                    job.location ? `地點：${job.location}` : '',
                    rejectionCriteria.length > 0 ? `紅旗：${rejectionCriteria.join(', ')}` : '',
                  ].filter(Boolean).join('\n');

                  const promptText = matchingRole
                    ? matchingRole.promptTemplate
                      .replace('[貼上完整職缺描述 JD]', description || title)
                      .replace('[填入公司規模，如 50-200人]', job.team_size || '未知')
                      .replace('[填入技術棧，如 Java, Spring Boot]', requirements.join(', '))
                    : `請幫我分析以下職缺：\n\n職缺名稱：${title}\n公司：${company}\n描述：${description || '無'}\n需求技能：${requirements.join(', ')}`;

                  // Parse description into structured sections
                  const descSections = (() => {
                    if (!description) return [];
                    // Split by common delimiters: numbered items, 【】brackets, newlines
                    return description
                      .replace(/(\d+)\.\s*/g, '\n$1. ')
                      .replace(/【/g, '\n【')
                      .split('\n')
                      .map((s: string) => s.trim())
                      .filter((s: string) => s.length > 0);
                  })();

                  return (
                    <div className="space-y-4">
                      <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <h3 className="font-semibold text-gray-800 text-lg mb-1">{title}</h3>
                        <p className="text-sm text-gray-500 mb-1">{company}</p>
                        {job.department && <p className="text-xs text-gray-400">部門：{job.department}</p>}
                        {job.experience_required && <p className="text-xs text-gray-400">經驗：{job.experience_required}</p>}
                        {job.location && <p className="text-xs text-gray-400">地點：{job.location}</p>}
                      </div>

                      {/* Job Description - structured */}
                      {descSections.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-4">
                          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-500" /> 職缺描述
                          </h4>
                          <div className="space-y-2">
                            {descSections.map((section: string, i: number) => {
                              const isBracket = section.startsWith('【');
                              const isNumbered = /^\d+\./.test(section);
                              if (isBracket) {
                                return (
                                  <h5 key={i} className="text-sm font-semibold text-blue-700 mt-3 first:mt-0">{section}</h5>
                                );
                              }
                              if (isNumbered) {
                                return (
                                  <p key={i} className="text-sm text-gray-600 leading-relaxed pl-2 flex items-start gap-1.5">
                                    <span className="text-blue-400 font-medium flex-shrink-0">{section.match(/^\d+/)?.[0]}.</span>
                                    <span>{section.replace(/^\d+\.\s*/, '')}</span>
                                  </p>
                                );
                              }
                              return <p key={i} className="text-sm text-gray-600 leading-relaxed">{section}</p>;
                            })}
                          </div>
                        </div>
                      )}

                      {/* Key skills */}
                      {Array.isArray(requirements) && requirements.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-4">
                          <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 必備技能
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {requirements.map((r: string, i: number) => (
                              <span key={i} className="text-xs px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">{r}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Nice to have */}
                      {Array.isArray(niceToHave) && niceToHave.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-4">
                          <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <Star className="w-4 h-4 text-amber-500" /> 加分條件
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {niceToHave.map((n: string, i: number) => (
                              <span key={i} className="text-xs px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-100">{n}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Salary */}
                      {salary && (
                        <div className="bg-white rounded-xl border border-gray-200 p-4">
                          <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-emerald-500" /> 薪資資訊
                          </h4>
                          <p className="text-sm text-gray-600">{salary}</p>
                        </div>
                      )}

                      {/* Red flags from rejection_criteria */}
                      {rejectionCriteria.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-4">
                          <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500" /> 淘汰標準
                          </h4>
                          <div className="space-y-2">
                            {rejectionCriteria.map((rc: string, i: number) => (
                              <div key={i} className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                                {rc}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Extra sections from matching role */}
                      {matchingRole && (
                        <>
                          <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
                            <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                              <BookOpen className="w-4 h-4" /> 角色百科連結：{matchingRole.title}
                            </h4>
                            <div className="space-y-2">
                              <div>
                                <p className="text-xs font-semibold text-blue-600 mb-1">面試必問題</p>
                                <ul className="space-y-1">
                                  {matchingRole.interviewQuestions.slice(0, 3).map((q, i) => (
                                    <li key={i} className="text-xs text-blue-700">{i + 1}. {q}</li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-blue-600 mb-1">來源公司</p>
                                <div className="flex flex-wrap gap-1">
                                  {matchingRole.sourceCompanies.slice(0, 6).map((c, i) => (
                                    <span key={i} className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{c}</span>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-blue-600 mb-1">驗證方法</p>
                                <ul className="space-y-1">
                                  {matchingRole.howToVerify.slice(0, 3).map((v, i) => (
                                    <li key={i} className="text-xs text-blue-700 flex items-start gap-1">
                                      <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" /> {v}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                            <button
                              onClick={() => { setActiveTab('role-encyclopedia'); setSelectedRole(matchingRole); setSelectedFamily(matchingRole.family); }}
                              className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              查看完整角色卡 <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}

                      {/* Copy buttons */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleCopy(analysisText, `job-analysis-${job._id || job.id}`)}
                          className="bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5 hover:bg-indigo-100 transition-colors"
                        >
                          {copiedId === `job-analysis-${job._id || job.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedId === `job-analysis-${job._id || job.id}` ? '已複製' : '複製分析'}
                        </button>
                        <button
                          onClick={() => handleCopy(promptText, `job-prompt-${job._id || job.id}`)}
                          className="bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5 hover:bg-indigo-100 transition-colors"
                        >
                          {copiedId === `job-prompt-${job._id || job.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedId === `job-prompt-${job._id || job.id}` ? '已複製' : '複製 Prompt'}
                        </button>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
                    <Target className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">請從左側選擇一個職缺進行分析</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 6: Prompt Toolbox ===================== */}
        {activeTab === 'prompt-toolbox' && (
          <div className="space-y-4" data-tour="prompt-copy">
            {/* How to use guide */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-purple-800 mb-2 flex items-center gap-2">
                <Bot className="w-4 h-4" /> 如何使用 Prompt 模板？
              </h4>
              <div className="text-xs text-purple-700 space-y-1.5">
                <p><span className="font-semibold">步驟 1</span>：用下方「智能填入」選擇職缺或客戶，系統自動替換所有變數</p>
                <p><span className="font-semibold">步驟 2</span>：選擇分類（產業分析 / 公司理解 / 角色理解 / 人選評估），找到適合的 Prompt</p>
                <p><span className="font-semibold">步驟 3</span>：點擊「複製已填入版本」，貼到 <span className="font-semibold">ChatGPT / Claude / 龍蝦 AI</span> 即可使用</p>
                <p><span className="font-semibold">效果</span>：AI 會產出結構化的分析報告，幫你在 5 分鐘內搞懂一個產業、公司、職位或候選人</p>
              </div>
            </div>

            {/* Smart Fill Bar */}
            {renderSmartFillBar()}

            {/* Category pills */}
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'all' as const, label: '全部', count: PROMPT_TEMPLATES.length },
                { key: 'industry' as const, label: '產業分析', count: PROMPT_TEMPLATES.filter(p => p.category === 'industry').length },
                { key: 'company' as const, label: '公司理解', count: PROMPT_TEMPLATES.filter(p => p.category === 'company').length },
                { key: 'role' as const, label: '角色理解', count: PROMPT_TEMPLATES.filter(p => p.category === 'role').length },
                { key: 'evaluation' as const, label: '人選評估', count: PROMPT_TEMPLATES.filter(p => p.category === 'evaluation').length },
              ] as { key: PromptCategory | 'all'; label: string; count: number }[]).map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setPromptFilter(cat.key)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    promptFilter === cat.key
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat.label} ({cat.count})
                </button>
              ))}
            </div>

            {/* Prompt Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredPrompts.map(prompt => {
                // Smart Fill: compute filled version
                const { filled, replacementCount } = hasFillData
                  ? fillLearningPrompt(prompt.template, sfSelectedJob, sfSelectedClient, sfIndustry)
                  : { filled: prompt.template, replacementCount: 0 };
                const isFilled = hasFillData && replacementCount > 0;

                // Preview: show filled or original
                const displayText = isFilled ? filled : prompt.template;
                const preview = displayText.slice(0, 200);
                const parts = preview.split(/(\[填入[^\]]+\]|{{[^}]+}}|「[^」]*」)/g);

                return (
                  <div key={prompt.id} className={`rounded-xl border p-4 hover:shadow-md transition-all ${
                    isFilled ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-gray-200'
                  }`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-800 text-sm">{prompt.title}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{prompt.description}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${
                        prompt.category === 'industry' ? 'bg-blue-50 text-blue-600' :
                        prompt.category === 'company' ? 'bg-emerald-50 text-emerald-600' :
                        prompt.category === 'role' ? 'bg-purple-50 text-purple-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {prompt.category === 'industry' ? '產業' :
                         prompt.category === 'company' ? '公司' :
                         prompt.category === 'role' ? '角色' : '評估'}
                      </span>
                    </div>

                    {/* Filled badge */}
                    {isFilled && (
                      <div className="mb-2 flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full w-fit">
                        <CheckCircle2 className="w-3 h-3" /> 已自動填入 {replacementCount} 個變數
                      </div>
                    )}

                    {/* Template preview */}
                    <div className={`rounded-lg p-2.5 mb-3 border max-h-24 overflow-hidden ${
                      isFilled ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'
                    }`}>
                      <p className="text-[11px] text-gray-500 font-mono leading-relaxed">
                        {parts.map((part, i) =>
                          part.match(/^\[填入/) || part.match(/^{{/) ? (
                            <span key={i} className="text-indigo-600 font-semibold bg-indigo-50 px-1 rounded">{part}</span>
                          ) : part.match(/^「.*」$/) ? (
                            <span key={i} className="text-blue-600 font-semibold">{part}</span>
                          ) : (
                            <span key={i}>{part}</span>
                          )
                        )}
                        {displayText.length > 200 && '...'}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleCopy(isFilled ? filled : prompt.template, `prompt-${prompt.id}`)}
                        className={`rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${
                          isFilled
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                            : 'bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100'
                        }`}
                      >
                        {copiedId === `prompt-${prompt.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedId === `prompt-${prompt.id}` ? '已複製！' :
                         isFilled ? '複製已填入版本' : '複製 Prompt'}
                      </button>

                      {isFilled && (
                        <button
                          onClick={() => setShowFilledPreview(showFilledPreview === prompt.id ? null : prompt.id)}
                          className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          {showFilledPreview === prompt.id ? '收合' : '完整預覽'}
                        </button>
                      )}
                    </div>

                    {/* Full filled preview */}
                    {showFilledPreview === prompt.id && isFilled && (
                      <div className="mt-3 bg-white border border-emerald-200 rounded-lg p-3 max-h-64 overflow-y-auto">
                        <pre className="text-[11px] text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{filled}</pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== Prompt 收集區 Tab ===== */}
        {activeTab === 'prompt-collection' && (
          <div className="space-y-4">
            {/* 說明 */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-amber-800 mb-1">Prompt 收集區</h4>
              <p className="text-xs text-amber-700">顧問團隊透過實戰累積的 Prompt，可以直接複製使用。AI 也會透過 API 自動存入新的 Prompt。</p>
            </div>

            {/* 篩選列 */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setCollectionFilter('all')}
                className={`px-3 py-1.5 text-xs rounded-full border transition ${collectionFilter === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
              >全部</button>
              {PROMPT_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCollectionFilter(cat)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition ${collectionFilter === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                >{cat}</button>
              ))}
            </div>

            {/* 搜尋 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={collectionSearch}
                onChange={e => setCollectionSearch(e.target.value)}
                placeholder="搜尋 Prompt 標題或內容..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* 列表 */}
            {collectionLoading ? (
              <div className="text-center py-10 text-slate-400 text-sm">載入中...</div>
            ) : (
              <div className="space-y-3">
                {collectionPrompts
                  .filter(p => {
                    if (!collectionSearch) return true;
                    const q = collectionSearch.toLowerCase();
                    return p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q);
                  })
                  .map(p => (
                  <div key={p.id} className={`border rounded-xl overflow-hidden transition ${p.is_pinned ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200 bg-white'}`}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {p.is_pinned && <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">置頂</span>}
                            <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">{p.category}</span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mt-1">{p.title}</h4>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleCopyCollection(p.content, p.id)}
                            className={`p-1.5 rounded-lg transition ${collectionCopied === p.id ? 'bg-green-100 text-green-600' : 'hover:bg-slate-100 text-slate-400'}`}
                            title="複製 Prompt"
                          >
                            {collectionCopied === p.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleUpvote(p.id)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition ${p.has_voted ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-500'}`}
                          >
                            <Star className={`w-3.5 h-3.5 ${p.has_voted ? 'fill-indigo-500' : ''}`} />
                            {p.upvote_count || 0}
                          </button>
                        </div>
                      </div>
                      <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto bg-slate-50 rounded-lg p-3 border border-slate-100">
                        {p.content}
                      </pre>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                        <span>by {p.author}</span>
                        <span>{new Date(p.created_at).toLocaleDateString('zh-TW')}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {collectionPrompts.filter(p => {
                  if (!collectionSearch) return true;
                  const q = collectionSearch.toLowerCase();
                  return p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q);
                }).length === 0 && !collectionLoading && (
                  <div className="text-center py-10">
                    <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">
                      {collectionPrompts.length === 0 ? '尚無 Prompt，AI 或顧問可透過 API 新增' : '無符合搜尋條件的 Prompt'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
