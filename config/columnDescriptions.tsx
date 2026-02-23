// Step1ne Headhunter System - 欄位說明配置
// 所有表格欄位的說明文字集中管理

export const COLUMN_DESCRIPTIONS = {
  name: {
    title: '姓名',
    description: '候選人姓名與 Email。點擊候選人可查看完整履歷詳情。',
    examples: [
      '姓名會顯示在第一欄',
      'Email 會顯示在姓名下方（灰色小字）'
    ]
  },
  
  position: {
    title: '職位',
    description: '候選人目前或最近的職位，以及所在地點。',
    examples: [
      '資深前端工程師（台北市）',
      'DevOps 工程師（新竹市）',
      'AI 研究員（遠端）'
    ]
  },
  
  experience: {
    title: '年資',
    description: (
      <>
        <p className="mb-2">候選人的總工作年資與轉職次數。</p>
        <p className="text-xs text-gray-500">
          • 第一行：總年資<br />
          • 第二行：轉職次數
        </p>
      </>
    ),
    examples: [
      '5.5 年 / 3 次（平均每份工作 1.8 年）',
      '10 年 / 2 次（穩定度高）',
      '0.5 年 / 0 次（社會新鮮人）'
    ]
  },
  
  stability: {
    title: '工作穩定性',
    description: (
      <>
        <p className="mb-2">基於工作經歷計算的穩定度評分（20-100分）。</p>
        <div className="text-xs space-y-1 text-gray-600 bg-gray-50 p-2 rounded">
          <p><strong>計算因素：</strong></p>
          <p>• 總工作年資（加分）</p>
          <p>• 轉職次數（扣分）</p>
          <p>• 平均任期長度（加分）</p>
          <p>• 最後離職間隔（加分）</p>
        </div>
        <p className="mt-2 text-xs text-amber-600">
          ⚠️ 僅供參考，實際適配度需看職缺需求
        </p>
      </>
    ),
    examples: [
      '85 分（A級）- 資深且穩定',
      '68 分（B級）- 正常流動',
      '44 分（C級）- 頻繁轉職',
      '70 分（預設）- 社會新鮮人'
    ]
  },
  
  skills: {
    title: '技能',
    description: '候選人的專業技能與技術棧。可在搜尋框中輸入技能關鍵字快速篩選人才。',
    examples: [
      'Python, TensorFlow, PyTorch, Docker',
      'React, TypeScript, Next.js, Node.js',
      '專案管理, Scrum, Agile, JIRA'
    ]
  },
  
  status: {
    title: '狀態',
    description: '候選人在招募流程中的當前狀態。點擊候選人可在看板中拖放更新狀態。',
    examples: [
      '待聯繫 - 剛匯入履歷池',
      '已聯繫 - 電話/Email 已聯繫',
      '面試中 - 安排或進行面試',
      'Offer - 已發 Offer',
      '已上職 - 成功推薦上職'
    ]
  },
  
  source: {
    title: '來源',
    description: '候選人履歷的來源管道。不同管道的候選人可能有不同的特性。',
    examples: [
      'LinkedIn - 主動挖掘',
      'GitHub - 技術人才',
      'Gmail 進件 - 主動投遞',
      '推薦 - 人脈推薦',
      '人力銀行 - 平台搜尋'
    ]
  },
  
  consultant: {
    title: '顧問',
    description: '負責此候選人的獵頭顧問。每位顧問只能看到自己負責的候選人（管理員除外）。',
    examples: [
      'Jacky - 技術職缺',
      'Phoebe - 管理職缺',
      'Admin - 所有候選人'
    ]
  },
  
  talentGrade: {
    title: '綜合評級',
    description: (
      <>
        <p className="mb-2">基於 6 大維度的綜合人才評級（S/A+/A/B/C）。</p>
        <div className="text-xs space-y-1 text-gray-600 bg-gray-50 p-2 rounded mb-2">
          <p><strong>評分維度（各佔比）：</strong></p>
          <p>• 學歷背景 (20%)</p>
          <p>• 工作年資 (20%)</p>
          <p>• 技能廣度 (20%)</p>
          <p>• 工作穩定性 (20%)</p>
          <p>• 職涯發展軌跡 (10%)</p>
          <p>• 特殊加分 (10%)</p>
        </div>
        <div className="text-xs space-y-1">
          <p><span className="font-semibold text-purple-600">S 級</span> (90-100分): 頂尖人才</p>
          <p><span className="font-semibold text-blue-600">A+ 級</span> (80-89分): 優秀人才</p>
          <p><span className="font-semibold text-green-600">A 級</span> (70-79分): 合格人才</p>
          <p><span className="font-semibold text-yellow-600">B 級</span> (60-69分): 潛力人才</p>
          <p><span className="font-semibold text-gray-600">C 級</span> (&lt;60分): 需培訓</p>
        </div>
      </>
    ),
    examples: [
      'S 級 - Stanford 博士 + Google 經驗 + 10 年資深',
      'A 級 - 台大碩士 + 5 年經驗 + 豐富技能',
      'B 級 - 學士 + 社會新鮮人 + 基礎技能'
    ]
  }
};
