/**
 * foreignNameFilter.js - 外國人名字篩選工具
 *
 * 判斷名字是否為外國人（非華人）
 * 用於爬蟲匯入時自動標記外籍人選，減少後續 AI 評分資源浪費
 */

// 台灣常見華人姓氏（羅馬拼音）白名單
const TW_SURNAMES = new Set([
  // 前 20 大姓
  'chen', 'lin', 'huang', 'chang', 'lee', 'li', 'wang', 'wu',
  'liu', 'tsai', 'yang', 'hsu', 'chu', 'cheng', 'hsieh', 'ho',
  'kuo', 'lai', 'hsiao', 'chiang',
  // 常見姓氏
  'lu', 'liao', 'lo', 'chou', 'chien', 'chiou', 'feng', 'fan',
  'peng', 'teng', 'tang', 'hsia', 'sung', 'tseng', 'ting', 'pan',
  'yeh', 'yu', 'su', 'yao', 'wei', 'ko', 'tu', 'tung',
  'hung', 'chiu', 'chuang', 'yen', 'shih', 'pai', 'mao',
  'chiang', 'liang', 'ku', 'kung', 'tai', 'tien', 'weng',
  'shao', 'sheng', 'wan', 'chieng', 'hsing',
  // 其他常見
  'leu', 'lue', 'jian', 'jien', 'jan', 'ling', 'ma',
  'hong', 'han', 'kao', 'tsou', 'cai', 'xu', 'xie', 'guo',
  'zhou', 'zhu', 'sun', 'hu', 'gao', 'zheng', 'he', 'luo',
  'song', 'zhong', 'jiang', 'xiao', 'deng', 'tang', 'fu',
  'shi', 'shen', 'zeng', 'peng', 'ye', 'du', 'chung',
  // Wade-Giles / 通用拼法
  'wong', 'ng', 'kwok', 'leung', 'lam', 'cheung', 'chan',
  'chow', 'fong', 'tong', 'yip', 'tam', 'siu', 'mak',
  'hou', 'cui', 'pan', 'jin', 'dai', 'ren',
  'gu', 'qiu', 'jia', 'zou', 'xue', 'qin', 'wen',
  'tao', 'bai', 'qian', 'kong', 'tan',
]);

/**
 * 判斷名字是否為外國人（非華人）
 * @param {string} name - 候選人名字
 * @returns {boolean} true = 外國人名字，false = 華人名字或無法判斷
 *
 * 規則：
 * 1. 含中文字 → 不是外國人
 * 2. 純英文名 → 檢查姓氏是否在台灣常見華人姓氏白名單中
 * 3. 白名單外的純英文名 → 判定為外國人
 */
function isForeignName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (!trimmed) return false;

  // 含中文字 → 不是外國人
  if (/[\u4e00-\u9fff]/.test(trimmed)) return false;

  // 純非英文字母（如日文、韓文等）→ 不做判斷，保守放行
  if (!/[a-zA-Z]/.test(trimmed)) return false;

  // 拆分名字部分（支援空格、連字號、底線）
  const parts = trimmed.toLowerCase().split(/[\s\-_.,]+/).filter(Boolean);
  if (parts.length === 0) return false;

  // 檢查每個部分是否有匹配華人姓氏
  for (const part of parts) {
    if (TW_SURNAMES.has(part)) return false;  // 有華人姓氏 → 不是外國人
  }

  // 全部都不在白名單 → 判定為外國人
  return true;
}

module.exports = { isForeignName, TW_SURNAMES };
