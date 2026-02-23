import React from 'react';
import { BookOpen, FileText, Users, ClipboardList, LayoutGrid, BarChart3, Download, History, Database, Camera, Link as LinkIcon, DollarSign, TrendingUp, MessageSquare, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

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
            <h1 className="text-3xl font-black mb-2">AI案件管理系統使用說明</h1>
            <p className="text-indigo-100 text-lg">完整的功能介紹與操作指南</p>
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
          <a href="#案件總表" className="p-4 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors">
            <ClipboardList className="text-indigo-600 mb-2" size={24} />
            <h3 className="font-black text-slate-900 mb-1">案件總表</h3>
            <p className="text-sm text-slate-600">查看和管理所有案件</p>
          </a>
          <a href="#流程看板" className="p-4 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors">
            <LayoutGrid className="text-purple-600 mb-2" size={24} />
            <h3 className="font-black text-slate-900 mb-1">流程看板</h3>
            <p className="text-sm text-slate-600">視覺化追蹤案件進度</p>
          </a>
          <a href="#財務分析" className="p-4 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors">
            <BarChart3 className="text-emerald-600 mb-2" size={24} />
            <h3 className="font-black text-slate-900 mb-1">財務分析</h3>
            <p className="text-sm text-slate-600">查看成本和利潤統計</p>
          </a>
        </div>
      </div>

      {/* 案件總表 */}
      <div id="案件總表" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <ClipboardList className="text-indigo-600" size={24} />
          案件總表
        </h2>
        <div className="space-y-4 text-slate-700">
          <div>
            <h3 className="font-black text-slate-900 mb-2">📋 功能說明</h3>
            <p className="mb-3">案件總表是系統的核心功能，您可以在此查看、搜尋、新增和編輯所有案件。</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>查看所有案件的詳細資訊</li>
              <li>使用搜尋功能快速找到特定案件</li>
              <li>點擊表格中的任意行可直接開啟案件詳情</li>
              <li>支援按各欄位排序（預設按建立時間降序）</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-black text-slate-900 mb-2">➕ 新增案件</h3>
            <p className="mb-2">點擊右上角的「新增案件」按鈕，填寫以下資訊：</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>對方 ID / 名稱</strong>：案主名稱或平台 ID</li>
              <li><strong>平台</strong>：案件來源平台（FB、Threads、PRO360 等）</li>
              <li><strong>客戶原始需求</strong>：案件的核心需求描述</li>
              <li><strong>預算狀況</strong>：客戶預算資訊</li>
              <li><strong>聯絡資訊</strong>：電話、Email、地點（選填）</li>
              <li><strong>預計製作週期</strong>：預估完成時間（選填）</li>
              <li><strong>客戶聯繫方式</strong>：聯繫管道（選填）</li>
            </ul>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">
              <Camera className="inline mr-2 text-indigo-600" size={18} />
              OCR 截圖識別
            </h3>
            <p className="mb-2">快速匯入案件資訊：</p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>點擊「OCR 截圖識別」按鈕</li>
              <li>選擇或拖放案件截圖</li>
              <li>系統會自動識別圖片中的文字並填入表單</li>
              <li>檢查並修正識別結果後儲存</li>
            </ol>
            <p className="mt-2 text-sm text-slate-500">💡 提示：圖片越清晰，識別準確度越高</p>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">
              <LinkIcon className="inline mr-2 text-indigo-600" size={18} />
              URL 匯入
            </h3>
            <p className="mb-2">支援從 PRO360 網址自動匯入案件：</p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>在新增案件視窗中找到「URL 匯入」區塊</li>
              <li>貼上 PRO360 案件網址</li>
              <li>點擊「解析網址」按鈕</li>
              <li>系統會自動填入案件資訊</li>
            </ol>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">⚡ 快速審核</h3>
            <p className="mb-2">在案件總表中，每個案件都有快速審核按鈕：</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><CheckCircle className="inline text-green-600" size={14} /> 綠色按鈕：接受案件</li>
              <li><XCircle className="inline text-red-600" size={14} /> 紅色按鈕：取消案件</li>
            </ul>
            <p className="mt-2 text-sm text-slate-500">💡 點擊後會立即更新案件狀態</p>
          </div>
        </div>
      </div>

      {/* 流程看板 */}
      <div id="流程看板" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <LayoutGrid className="text-purple-600" size={24} />
          流程看板
        </h2>
        <div className="space-y-4 text-slate-700">
          <div>
            <h3 className="font-black text-slate-900 mb-2">📊 功能說明</h3>
            <p className="mb-3">流程看板以視覺化的方式展示案件在各個階段的分布，讓您一目了然地掌握案件進度。</p>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">🔄 案件狀態</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <span className="font-black text-amber-700">待篩選</span>
                <p className="text-xs text-slate-600 mt-1">新案件，等待初步評估</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="font-black text-blue-700">已接洽</span>
                <p className="text-xs text-slate-600 mt-1">已與客戶聯繫</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <span className="font-black text-purple-700">報價中</span>
                <p className="text-xs text-slate-600 mt-1">正在準備或已提交報價</p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <span className="font-black text-indigo-700">製作中</span>
                <p className="text-xs text-slate-600 mt-1">案件正在執行</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="font-black text-emerald-700">已成交</span>
                <p className="text-xs text-slate-600 mt-1">案件已完成並成交</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="font-black text-gray-700">結案</span>
                <p className="text-xs text-slate-600 mt-1">案件已結束</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <span className="font-black text-red-700">取消</span>
                <p className="text-xs text-slate-600 mt-1">未使用 Pro360 索取個資</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <span className="font-black text-orange-700">婉拒/無法聯繫</span>
                <p className="text-xs text-slate-600 mt-1">已使用 Pro360 索取個資但無法聯繫或決定不做</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">🖱️ 操作方式</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>拖放移動</strong>：直接拖動案件卡片到不同狀態欄位</li>
              <li><strong>右鍵選單</strong>：在案件卡片上點擊右鍵，選擇目標狀態</li>
              <li><strong>點擊查看</strong>：點擊案件卡片可開啟詳細資訊</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 財務分析 */}
      <div id="財務分析" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <BarChart3 className="text-emerald-600" size={24} />
          財務分析
        </h2>
        <div className="space-y-4 text-slate-700">
          <div>
            <h3 className="font-black text-slate-900 mb-2">💰 功能說明</h3>
            <p className="mb-3">財務分析頁面提供完整的成本和利潤統計，幫助您掌握整體財務狀況。</p>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">📊 統計資訊</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>總成本</strong>：所有案件的成本總和</li>
              <li><strong>總利潤</strong>：所有案件的利潤總和</li>
              <li><strong>淨利潤</strong>：總利潤減去總成本</li>
              <li><strong>利潤率</strong>：淨利潤佔總利潤的百分比</li>
            </ul>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">
              <DollarSign className="inline mr-2 text-emerald-600" size={18} />
              成本記錄
            </h3>
            <p className="mb-2">在案件詳情中，您可以新增成本記錄：</p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>開啟案件詳情視窗</li>
              <li>找到「成本記錄」區塊</li>
              <li>選擇預設成本項目或輸入自訂項目</li>
              <li>輸入金額和備註</li>
              <li>點擊「新增成本記錄」</li>
            </ol>
            <p className="mt-2 text-sm text-slate-500">💡 預設成本項目包括：Gemini AI 使用費用、Cursor 開發軟體費用、Zeabur 雲端部署費用、預估人力費用、Pro360 索取個資成本</p>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">
              <TrendingUp className="inline mr-2 text-emerald-600" size={18} />
              利潤記錄
            </h3>
            <p className="mb-2">新增利潤記錄的方式與成本記錄相同：</p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>在案件詳情中找到「利潤記錄」區塊</li>
              <li>輸入利潤項目名稱和金額</li>
              <li>可選填備註說明</li>
              <li>點擊「新增利潤記錄」</li>
            </ol>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">📈 各案件成本與利潤</h3>
            <p className="mb-2">在財務分析頁面下方，您可以查看每個案件的詳細財務資訊：</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>點擊案件名稱可查看詳細的成本和利潤明細</li>
              <li>只有管理員可以刪除成本或利潤記錄</li>
              <li>「取消」狀態的案件不會計入財務統計（未使用 Pro360 索取個資）</li>
              <li>「婉拒/無法聯繫」狀態的案件會計入財務統計（已使用 Pro360 索取個資）</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 近期進度更新 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <MessageSquare className="text-blue-600" size={24} />
          近期進度更新
        </h2>
        <div className="space-y-4 text-slate-700">
          <div>
            <h3 className="font-black text-slate-900 mb-2">📝 功能說明</h3>
            <p className="mb-3">每個案件都可以記錄進度更新，方便團隊成員追蹤案件進展。</p>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">➕ 新增進度更新</h3>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>開啟案件詳情視窗</li>
              <li>找到「近期進度更新」區塊</li>
              <li>輸入進度內容</li>
              <li>可選：上傳圖片或添加網址連結</li>
              <li>點擊「新增進度」按鈕</li>
            </ol>
          </div>

          <div>
            <h3 className="font-black text-slate-900 mb-2">🗑️ 刪除進度更新</h3>
            <p className="mb-2">只有管理員可以刪除進度更新記錄。</p>
          </div>
        </div>
      </div>

      {/* 其他功能 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <FileText className="text-slate-600" size={24} />
          其他功能
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl">
            <h3 className="font-black text-slate-900 mb-2 flex items-center gap-2">
              <Download className="text-indigo-600" size={18} />
              匯入案件
            </h3>
            <p className="text-sm text-slate-600">從本地儲存匯入案件資料（僅限管理員）</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <h3 className="font-black text-slate-900 mb-2 flex items-center gap-2">
              <History className="text-indigo-600" size={18} />
              操作紀錄
            </h3>
            <p className="text-sm text-slate-600">查看所有系統操作歷史記錄</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <h3 className="font-black text-slate-900 mb-2 flex items-center gap-2">
              <Users className="text-indigo-600" size={18} />
              成員管理
            </h3>
            <p className="text-sm text-slate-600">管理系統使用者（僅限管理員）</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <h3 className="font-black text-slate-900 mb-2 flex items-center gap-2">
              <Database className="text-indigo-600" size={18} />
              資料遷移
            </h3>
            <p className="text-sm text-slate-600">將本地資料遷移到雲端資料庫（僅限管理員）</p>
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
            <h3 className="font-black text-slate-900 mb-2">Q: 如何區分「取消」和「婉拒/無法聯繫」？</h3>
            <p className="text-slate-700">
              <strong>A:</strong> 「取消」用於沒有產生任何成本的案件（未使用 Pro360 索取個資，例如：初步評估後直接拒絕）。
              「婉拒/無法聯繫」用於已經產生成本但評估後決定不做或無法聯繫的案件（已使用 Pro360 索取個資，例如：已支付 Pro360 個資成本但評估後不做或無法聯繫客戶）。
            </p>
          </div>
          <div>
            <h3 className="font-black text-slate-900 mb-2">Q: 為什麼我的成本記錄消失了？</h3>
            <p className="text-slate-700">
              <strong>A:</strong> 請確認案件狀態不是「取消」。如果問題持續，請檢查瀏覽器控制台的錯誤訊息，或聯繫管理員。
            </p>
          </div>
          <div>
            <h3 className="font-black text-slate-900 mb-2">Q: 如何修改案件資訊？</h3>
            <p className="text-slate-700">
              <strong>A:</strong> 在案件總表中點擊案件行，或在流程看板中點擊案件卡片，即可開啟編輯視窗。
            </p>
          </div>
          <div>
            <h3 className="font-black text-slate-900 mb-2">Q: OCR 識別不準確怎麼辦？</h3>
            <p className="text-slate-700">
              <strong>A:</strong> OCR 識別結果僅供參考，請手動檢查並修正。建議使用清晰、文字完整的截圖以提高準確度。
            </p>
          </div>
        </div>
      </div>

      {/* 聯絡支援 */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
        <h2 className="text-lg font-black text-slate-900 mb-2">需要協助？</h2>
        <p className="text-slate-600">如有任何問題或建議，請聯繫系統管理員。</p>
      </div>
    </div>
  );
};

export default HelpPage;
