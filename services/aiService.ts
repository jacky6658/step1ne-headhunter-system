import { createWorker } from 'tesseract.js';
import { Platform, Lead } from "../types";

// OCR 提取文字
const extractTextFromImage = async (base64Data: string): Promise<string> => {
  const worker = await createWorker('chi_tra+eng'); // 支援繁體中文和英文
  
  try {
    // 處理 base64 前綴
    const cleanData = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    
    // 將 base64 轉換為圖片
    const img = new Image();
    img.src = `data:image/jpeg;base64,${cleanData}`;
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    
    // 執行 OCR，使用更高的準確度設置
    const { data: { text } } = await worker.recognize(img, {
      tessedit_pageseg_mode: '6', // 假設單一統一文本塊
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\u4e00-\u9fa5@.-_/():：，。、！？\s', // 允許的字符
    });
    return text;
  } finally {
    await worker.terminate();
  }
};

// 從 OCR 文字中解析案件資訊
const parseLeadFromText = (text: string): Partial<Lead> => {
  const result: Partial<Lead> = {};
  
  // 提取平台來源
  if (text.match(/FB|Facebook|臉書|fb/i)) {
    result.platform = Platform.FB;
  } else if (text.match(/Threads|串文|threads/i)) {
    result.platform = Platform.THREADS;
  } else if (text.match(/PRO360|Pro360|pro360|pro 360/i)) {
    result.platform = Platform.PRO360;
  } else {
    result.platform = Platform.OTHER;
  }
  
  // 提取案主名稱/ID（改進邏輯，針對表格格式優化）
  // 排除常見的誤識別詞彙
  const excludeWords = /^(製作|生產|開發|設計|規劃|管理|服務|提供|需求|說明|內容|描述|電話|Email|地點|預算|金額|價格|日期|時間|發布|案主|名稱|ID|姓名|對方|平台|來源|狀態|操作|希望|透過|來|宣傳|賣給|消費|有|生成|短影片|海報|圖片|經驗|受託|或)$/i;
  
  // 按行分割文字（表格格式通常是按行排列）
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // 優先：在平台標識所在行或附近行尋找名稱（表格格式）
  const platformMatch = text.match(/(PRO360|Pro360|pro360|FB|Facebook|Threads|串文)/i);
  if (platformMatch) {
    const platformLineIndex = lines.findIndex(line => line.includes(platformMatch[0]));
    
    if (platformLineIndex !== -1) {
      const platformLine = lines[platformLineIndex];
      // 在平台所在行尋找名稱（可能是同一行的不同部分）
      const lineParts = platformLine.split(/\s+/);
      for (const part of lineParts) {
        const cleaned = part.replace(/[：:]/g, '').trim();
        if (cleaned && 
            cleaned !== platformMatch[0] &&
            cleaned.length >= 2 && 
            cleaned.length <= 30 &&
            !excludeWords.test(cleaned) &&
            !cleaned.match(/^\d+$/) && // 不是純數字
            !cleaned.match(/^\d+\/\d+\/\d+$/) && // 不是日期
            !cleaned.match(/@/) && // 不是Email
            !cleaned.match(/^\d{4,}$/)) { // 不是長數字（可能是電話）
          result.platform_id = cleaned;
          break;
        }
      }
      
      // 如果同一行沒找到，檢查前一行和後一行
      if (!result.platform_id) {
        const nearbyLines = [
          lines[platformLineIndex - 1],
          lines[platformLineIndex + 1]
        ].filter(Boolean);
        
        for (const line of nearbyLines) {
          // 尋找可能的案主名稱（中文2-10字或英文3-20字）
          const nameMatch = line.match(/([A-Za-z]{3,20}|[\u4e00-\u9fa5]{2,10})/);
          if (nameMatch) {
            const candidate = nameMatch[1].trim();
            if (candidate && 
                !excludeWords.test(candidate) &&
                !candidate.match(/(PRO360|Pro360|FB|Facebook|Threads|電話|Email|地點|預算|需求|說明|內容|描述|製作|生產|開發|設計|規劃|管理|服務|提供|希望|透過|來|宣傳|賣給|消費|有|生成|短影片|海報|圖片|經驗|受託|或)/i)) {
              result.platform_id = candidate;
              break;
            }
          }
        }
      }
    }
  }
  
  // 如果還沒找到，使用其他模式
  if (!result.platform_id) {
    const namePatterns = [
      /(?:案主|名稱|ID|姓名|對方)[：:\s]*([^\n]{2,30})/i,
      // 尋找獨立的中文或英文名稱（不在其他詞彙中）
      /(?:^|\s)([A-Za-z]{3,20})(?=\s|$)/, // 英文名稱（3-20個字母）
      /(?:^|\s)([\u4e00-\u9fa5]{2,10})(?=\s|$)/, // 中文名稱（2-10個字）
    ];
    
    for (const pattern of namePatterns) {
      const matches = Array.from(text.matchAll(pattern));
      for (const match of matches) {
        const candidate = match[1]?.trim();
        if (candidate && 
            candidate.length >= 2 && 
            candidate.length <= 30 &&
            !excludeWords.test(candidate) &&
            !candidate.match(/(電話|Email|地點|預算|需求|說明|內容|描述|製作|生產|開發|設計|規劃|管理|服務|提供|希望|透過|來|宣傳|賣給|消費|有|生成|短影片|海報|圖片|經驗|受託|或)/i) &&
            !candidate.match(/^\d+$/) && // 不是純數字
            !candidate.match(/^\d+\/\d+\/\d+$/) && // 不是日期
            !candidate.match(/@/) && // 不是Email
            !candidate.match(/^\d{4,}$/)) { // 不是長數字
          result.platform_id = candidate;
          break;
        }
      }
      if (result.platform_id) break;
    }
  }
  
  // 最後備選：使用第一行非空文字（排除明顯的標籤）
  if (!result.platform_id) {
    const firstValidLine = lines.find(line => {
      const trimmed = line.trim();
      return trimmed.length >= 2 && 
             trimmed.length <= 30 &&
             !excludeWords.test(trimmed) &&
             !trimmed.match(/(PRO360|Pro360|FB|Facebook|Threads|電話|Email|地點|預算|需求|說明|內容|描述|製作|生產|開發|設計|規劃|管理|服務|提供|希望|透過|來|宣傳|賣給|消費|有|生成|短影片|海報|圖片|經驗|受託|或)/i) &&
             !trimmed.match(/^\d+$/) &&
             !trimmed.match(/^\d+\/\d+\/\d+$/) &&
             !trimmed.match(/@/) &&
             !trimmed.match(/^\d{4,}$/);
    });
    if (firstValidLine) {
      // 提取第一個有效的中文或英文詞彙
      const nameMatch = firstValidLine.match(/([A-Za-z]{3,20}|[\u4e00-\u9fa5]{2,10})/);
      if (nameMatch) {
        result.platform_id = nameMatch[1].trim();
      } else {
        result.platform_id = firstValidLine.trim();
      }
    }
  }
  
  // 提取電話
  const phonePatterns = [
    /(?:電話|手機|聯絡|Tel|Phone)[：:\s]*([0-9\-\(\)\s]+)/i,
    /(09\d{2}[\s\-]?\d{3}[\s\-]?\d{3})/,
    /(\d{4}[\s\-]?\d{3}[\s\-]?\d{3})/
  ];
  
  for (const pattern of phonePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.phone = match[1].replace(/\s/g, '').trim();
      break;
    }
  }
  
  // 提取 Email
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    result.email = emailMatch[1];
  }
  
  // 提取地點
  const locationPatterns = [
    /(?:地點|地址|位置|地區)[：:\s]*([^\n]+)/i,
    /(台北|新北|桃園|台中|台南|高雄|基隆|新竹|嘉義|屏東|宜蘭|花蓮|台東|苗栗|彰化|南投|雲林|澎湖|金門|連江)[市縣][^\n]*/
  ];
  
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.location = match[1].trim();
      break;
    }
  }
  
  // 提取預算
  const budgetPatterns = [
    /(?:預算|金額|價格|費用)[：:\s]*([^\n]+)/i,
    /(\d+[萬千百]?[元塊]?)/,
    /([$＄]\s*\d+[萬千百]?)/,
    /(NT\s*\$\s*\d+[萬千百]?)/
  ];
  
  for (const pattern of budgetPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.budget_text = match[1].trim();
      break;
    }
  }
  
  // 提取日期（支援民國年）
  const datePatterns = [
    /(?:發布|日期|時間|Date)[：:\s]*(\d{1,3}\/\d{1,2}\/\d{1,2})/i,
    /(\d{1,3}\/\d{1,2}\/\d{1,2})/,
    /(\d{4}[\-\/]\d{1,2}[\-\/]\d{1,2})/
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const dateStr = match[1];
      const parts = dateStr.split(/[\/\-]/);
      if (parts.length === 3) {
        let [year, month, day] = parts;
        // 民國年轉西元年（民國 115 年 = 2026 年）
        const rocYear = parseInt(year);
        const adYear = rocYear > 1911 ? rocYear : rocYear + 1911;
        result.posted_at = `${adYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        break;
      }
    }
  }
  
  // 提取需求內容（通常是較長的文字段落）
  const needPatterns = [
    /(?:需求|說明|內容|描述)[：:\s]*([^\n]{10,})/i,
    /(?:需要|想要|希望)[：:\s]*([^\n]{10,})/i
  ];
  
  let needFound = false;
  for (const pattern of needPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length > 10) {
      result.need = match[1].trim();
      needFound = true;
      break;
    }
  }
  
  // 如果找不到明確的需求，使用整段文字（去除已提取的資訊）
  if (!needFound) {
    const lines = text.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 20 && 
             !trimmed.match(/(?:案主|名稱|電話|Email|地點|預算|日期|發布)/i);
    });
    if (lines.length > 0) {
      result.need = lines.join('\n').trim();
    } else {
      // 最後備選：使用整段文字的前 500 字
      result.need = text.substring(0, 500).trim();
    }
  }
  
  return result;
};

export const extractLeadFromImage = async (base64Data: string): Promise<Partial<Lead>> => {
  try {
    // 使用 OCR 提取文字
    const text = await extractTextFromImage(base64Data);
    
    if (!text || text.trim().length === 0) {
      throw new Error('無法從圖片中識別出文字，請確認圖片清晰可讀');
    }
    
    console.log('OCR 識別的文字（完整）:', text); // 記錄完整文字用於調試
    console.log('OCR 識別的文字（前500字）:', text.substring(0, 500)); // 記錄前 500 字用於調試
    
    // 解析文字提取案件資訊
    const result = parseLeadFromText(text);
    
    // 確保必要欄位存在
    if (!result.platform) {
      result.platform = Platform.OTHER;
    }
    if (!result.platform_id) {
      result.platform_id = '未識別';
    }
    if (!result.need) {
      result.need = text.substring(0, 200); // 如果無法識別，使用前 200 字
    }
    
    return result;
  } catch (e: any) {
    console.error("OCR Service Error:", e);
    
    const errorMsg = e?.message || e?.toString() || '未知錯誤';
    
    if (errorMsg.includes('無法識別') || errorMsg.includes('文字') || errorMsg.includes('empty')) {
      throw new Error('無法從圖片中識別出文字，請確認圖片清晰可讀');
    }
    
    if (errorMsg.includes('worker') || errorMsg.includes('tesseract')) {
      throw new Error('OCR 引擎初始化失敗，請重新整理頁面後再試');
    }
    
    throw new Error(`OCR 識別失敗：${errorMsg}。請確認圖片清晰可讀`);
  }
};
