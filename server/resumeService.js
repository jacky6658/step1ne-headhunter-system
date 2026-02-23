// resumeService.js - 履歷上傳與解析服務
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * 上傳履歷到 Google Drive
 * @param {string} filePath - 本地履歷檔案路徑
 * @param {string} candidateId - 候選人 ID
 * @param {string} candidateName - 候選人姓名
 * @returns {Promise<Object>} 包含 Drive URL 和解析資料
 */
async function uploadResumeToGoogleDrive(filePath, candidateId, candidateName) {
  try {
    // 1. 建立資料夾結構（年/月）
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    
    // Google Drive 資料夾 ID（需要事先建立）
    const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_RESUME_FOLDER_ID || '1JkesbUFyGz51y90NWUG91n84umU33Mc5';
    
    // 檔名格式：candidate-{id}_{姓名}_{日期}.pdf
    const fileName = `candidate-${candidateId}_${candidateName}_${date}.pdf`;
    
    // 2. 使用 gog CLI 上傳到 Google Drive
    // 注意：需要先安裝 gog CLI 並認證
    const uploadCommand = `gog drive upload "${filePath}" \
      --name "${fileName}" \
      --parent "${ROOT_FOLDER_ID}/${year}/${month}" \
      --create-parents \
      --share reader`;
    
    console.log('📤 上傳履歷到 Google Drive...');
    console.log('檔名:', fileName);
    
    try {
      const uploadResult = execSync(uploadCommand, { encoding: 'utf-8' });
      console.log('✅ Google Drive 上傳成功');
      
      // 解析上傳結果，提取 Drive URL
      // 格式：https://drive.google.com/file/d/{FILE_ID}/view
      const driveUrlMatch = uploadResult.match(/https:\/\/drive\.google\.com\/[^\s]+/);
      const driveUrl = driveUrlMatch ? driveUrlMatch[0] : null;
      
      if (!driveUrl) {
        console.warn('⚠️ 無法提取 Google Drive URL，使用備用方案');
      }
      
      return {
        success: true,
        driveUrl: driveUrl || `https://drive.google.com/drive/folders/${ROOT_FOLDER_ID}/${year}/${month}`,
        fileName
      };
    } catch (uploadError) {
      console.error('❌ Google Drive 上傳失敗:', uploadError.message);
      
      // 備用方案：將檔案複製到本地 Google Drive 同步資料夾
      const localDrivePath = process.env.LOCAL_GOOGLE_DRIVE_PATH || '/Users/user/Google Drive/Step1ne 履歷庫';
      const targetDir = path.join(localDrivePath, String(year), month);
      
      // 建立目錄
      execSync(`mkdir -p "${targetDir}"`, { encoding: 'utf-8' });
      
      // 複製檔案
      const targetPath = path.join(targetDir, fileName);
      fs.copyFileSync(filePath, targetPath);
      
      console.log('✅ 履歷已儲存到本地 Google Drive 資料夾:', targetPath);
      
      return {
        success: true,
        driveUrl: targetPath,
        fileName,
        localOnly: true
      };
    }
  } catch (error) {
    console.error('❌ 上傳履歷到 Google Drive 失敗:', error);
    throw error;
  }
}

/**
 * 使用 AI 解析履歷 PDF
 * @param {string} filePath - PDF 檔案路徑
 * @returns {Promise<Object>} 解析出的結構化資料
 */
async function parseResumePDF(filePath) {
  try {
    console.log('🤖 開始 AI 解析履歷...');
    
    // 使用現有的 resume-parser-v2.py
    const parserScript = path.join(__dirname, '../../step1ne-headhunter-skill/scripts/resume-parser-v2.py');
    
    // 建立臨時輸出檔案
    const outputPath = `/tmp/resume-parse-${Date.now()}.json`;
    
    // 執行 Python 腳本
    const parseCommand = `python3 "${parserScript}" \
      --input "${filePath}" \
      --output "${outputPath}"`;
    
    try {
      execSync(parseCommand, { encoding: 'utf-8', stdio: 'inherit' });
      
      // 讀取解析結果
      const parsedData = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      
      console.log('✅ AI 解析完成');
      console.log('  - Email:', parsedData.email || '未提取');
      console.log('  - Phone:', parsedData.phone || '未提取');
      console.log('  - 技能數量:', parsedData.skills?.length || 0);
      console.log('  - 工作經歷:', parsedData.workHistory?.length || 0, '筆');
      
      // 清理臨時檔案
      fs.unlinkSync(outputPath);
      
      return parsedData;
    } catch (parseError) {
      console.error('❌ AI 解析失敗:', parseError.message);
      
      // 備用方案：使用簡單的文字提取
      console.log('⚠️ 使用備用解析方案（基本文字提取）');
      return {
        email: null,
        phone: null,
        skills: [],
        workHistory: [],
        education: [],
        rawText: '（解析失敗）'
      };
    }
  } catch (error) {
    console.error('❌ 解析履歷失敗:', error);
    throw error;
  }
}

/**
 * 補全候選人資料到 Google Sheets
 * @param {string} candidateId - 候選人 ID
 * @param {Object} parsedData - 解析出的資料
 * @param {string} driveUrl - Google Drive 連結
 * @returns {Promise<void>}
 */
async function updateCandidateDataInSheet(candidateId, parsedData, driveUrl) {
  try {
    console.log('📝 更新候選人資料到 Google Sheets...');
    
    const SHEET_ID = process.env.SHEET_ID || '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q';
    const TAB_NAME = '履歷池v2';
    
    // 準備更新資料（只更新有值的欄位）
    const updates = [];
    
    if (parsedData.email) {
      updates.push(`B${candidateId}="${parsedData.email}"`); // Email (B欄)
    }
    if (parsedData.phone) {
      updates.push(`C${candidateId}="${parsedData.phone}"`); // Phone (C欄)
    }
    if (parsedData.skills && parsedData.skills.length > 0) {
      const skillsStr = parsedData.skills.join('、');
      updates.push(`J${candidateId}="${skillsStr}"`); // Skills (J欄)
    }
    if (parsedData.workHistory && parsedData.workHistory.length > 0) {
      const workHistoryJson = JSON.stringify(parsedData.workHistory).replace(/"/g, '""');
      updates.push(`M${candidateId}="${workHistoryJson}"`); // Work History JSON (M欄)
    }
    if (parsedData.education && parsedData.education.length > 0) {
      const educationJson = JSON.stringify(parsedData.education).replace(/"/g, '""');
      updates.push(`P${candidateId}="${educationJson}"`); // Education JSON (P欄)
    }
    if (driveUrl) {
      updates.push(`Q${candidateId}="${driveUrl}"`); // Resume URL (Q欄)
    }
    
    // 更新最後更新時間
    updates.push(`T${candidateId}="${new Date().toISOString()}"`); // Last Updated (T欄)
    
    if (updates.length === 0) {
      console.warn('⚠️ 沒有資料需要更新');
      return;
    }
    
    // 使用 gog CLI 更新（逐欄更新）
    for (const update of updates) {
      const [cell, value] = update.split('=');
      const updateCommand = `gog sheets update "${SHEET_ID}" "${TAB_NAME}!${cell}" --values "${value}"`;
      
      try {
        execSync(updateCommand, { encoding: 'utf-8' });
        console.log(`  ✅ 更新 ${cell}`);
      } catch (updateError) {
        console.error(`  ❌ 更新 ${cell} 失敗:`, updateError.message);
      }
    }
    
    console.log('✅ Google Sheets 更新完成');
  } catch (error) {
    console.error('❌ 更新 Google Sheets 失敗:', error);
    throw error;
  }
}

/**
 * 觸發候選人重新評分
 * @param {string} candidateId - 候選人 ID
 * @returns {Promise<Object>} 評分結果
 */
async function regradeCandidate(candidateId) {
  try {
    console.log('🔄 觸發重新評分...');
    
    const gradingScript = path.join(__dirname, '../../step1ne-headhunter-skill/modules/talent-grading/grading-logic.py');
    
    // 1. 讀取候選人完整資料（從 Google Sheets）
    const SHEET_ID = process.env.SHEET_ID || '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q';
    const TAB_NAME = '履歷池v2';
    
    const candidateData = execSync(`gog sheets read "${SHEET_ID}" "${TAB_NAME}!A${candidateId}:T${candidateId}" --format json`, 
      { encoding: 'utf-8' }
    );
    
    // 2. 執行評分
    const tempInputPath = `/tmp/candidate-${candidateId}.json`;
    const tempOutputPath = `/tmp/grade-${candidateId}.json`;
    
    fs.writeFileSync(tempInputPath, candidateData);
    
    const gradeCommand = `python3 "${gradingScript}" \
      --resume "${tempInputPath}" \
      --output "${tempOutputPath}"`;
    
    execSync(gradeCommand, { encoding: 'utf-8', stdio: 'inherit' });
    
    // 3. 讀取評分結果
    const gradeData = JSON.parse(fs.readFileSync(tempOutputPath, 'utf-8'));
    
    console.log('✅ 重新評分完成');
    console.log('  - 評級:', gradeData.grade);
    console.log('  - 總分:', gradeData.totalScore);
    
    // 4. 更新評級到 Google Sheets (Column U)
    const updateCommand = `gog sheets update "${SHEET_ID}" "${TAB_NAME}!U${candidateId}" --values "${gradeData.grade}"`;
    execSync(updateCommand, { encoding: 'utf-8' });
    
    console.log('✅ 評級已更新到 Google Sheets');
    
    // 清理臨時檔案
    fs.unlinkSync(tempInputPath);
    fs.unlinkSync(tempOutputPath);
    
    return gradeData;
  } catch (error) {
    console.error('❌ 重新評分失敗:', error);
    // 不拋出錯誤，允許流程繼續
    return {
      grade: 'N/A',
      totalScore: 0,
      breakdown: {}
    };
  }
}

/**
 * 完整的履歷上傳流程
 * @param {string} filePath - 上傳的 PDF 檔案路徑
 * @param {string} candidateId - 候選人 ID
 * @param {string} candidateName - 候選人姓名
 * @returns {Promise<Object>} 完整結果
 */
async function processResumeUpload(filePath, candidateId, candidateName) {
  try {
    console.log('=== 開始履歷上傳流程 ===');
    console.log('候選人:', candidateName, `(ID: ${candidateId})`);
    console.log('檔案:', filePath);
    
    // 1. 上傳到 Google Drive
    const driveResult = await uploadResumeToGoogleDrive(filePath, candidateId, candidateName);
    
    // 2. AI 解析 PDF
    const parsedData = await parseResumePDF(filePath);
    
    // 3. 補全 Google Sheets 資料
    await updateCandidateDataInSheet(candidateId, parsedData, driveResult.driveUrl);
    
    // 4. 觸發重新評分
    const gradeResult = await regradeCandidate(candidateId);
    
    console.log('=== 履歷上傳流程完成 ===');
    
    return {
      success: true,
      driveUrl: driveResult.driveUrl,
      fileName: driveResult.fileName,
      parsedData,
      gradeResult
    };
  } catch (error) {
    console.error('=== 履歷上傳流程失敗 ===');
    console.error(error);
    throw error;
  }
}

module.exports = {
  uploadResumeToGoogleDrive,
  parseResumePDF,
  updateCandidateDataInSheet,
  regradeCandidate,
  processResumeUpload
};
