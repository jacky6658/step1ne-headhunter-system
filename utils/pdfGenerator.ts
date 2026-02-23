// PDF 生成工具 - 使用 jsPDF
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface MatchResult {
  candidate: {
    id: string;
    name: string;
  };
  總分: number;
  等級: string;
  推薦優先級: string;
  維度評分: {
    技能匹配: number;
    成長匹配: number;
    文化匹配: number;
    動機匹配: number;
  };
  適配亮點: string[];
  風險提示: string[];
  建議: {
    面試重點: string[];
    薪資策略: string;
    留任策略: string[];
  };
}

interface MatchSummary {
  total_candidates: number;
  average_score: number;
  grade_distribution: {
    S: number;
    A: number;
    B: number;
    C: number;
    D: number;
  };
  top_5: Array<{
    name: string;
    total_score: number;
    grade: string;
    priority: string;
  }>;
}

interface PDFData {
  jobTitle: string;
  companyName: string;
  summary: MatchSummary;
  matches: MatchResult[];
}

/**
 * 生成 AI 配對報告 PDF
 */
export function generateMatchingReportPDF(data: PDFData) {
  const doc = new jsPDF();
  
  // 設定中文字體（使用系統預設）
  // 注意：jsPDF 對中文支援有限，需要自訂字體
  
  let yPos = 20;
  
  // ========================================
  // 封面頁
  // ========================================
  
  // 標題
  doc.setFontSize(24);
  doc.setTextColor(79, 70, 229); // Indigo-600
  doc.text('Step1ne AI 配對報告', 105, yPos, { align: 'center' });
  
  yPos += 15;
  
  // 職缺資訊
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text(`職缺：${data.jobTitle}`, 105, yPos, { align: 'center' });
  
  yPos += 10;
  
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text(`公司：${data.companyName}`, 105, yPos, { align: 'center' });
  
  yPos += 20;
  
  // 分隔線
  doc.setDrawColor(200, 200, 200);
  doc.line(20, yPos, 190, yPos);
  
  yPos += 15;
  
  // ========================================
  // 配對摘要
  // ========================================
  
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text('配對摘要', 20, yPos);
  
  yPos += 10;
  
  // 摘要數據（4 個方框）
  const summaryData = [
    { label: '總候選人數', value: data.summary.total_candidates.toString(), color: [99, 102, 241] },
    { label: '平均分數', value: data.summary.average_score.toFixed(1), color: [16, 185, 129] },
    { 
      label: 'A 級候選人', 
      value: (data.summary.grade_distribution.S + data.summary.grade_distribution.A).toString(), 
      color: [245, 158, 11] 
    },
    { label: 'B 級候選人', value: data.summary.grade_distribution.B.toString(), color: [139, 92, 246] },
  ];
  
  const boxWidth = 40;
  const boxHeight = 25;
  const boxSpacing = 5;
  let xPos = 20;
  
  summaryData.forEach((item, index) => {
    // 繪製方框
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.rect(xPos, yPos, boxWidth, boxHeight, 'F');
    
    // 標籤（白色）
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(item.label, xPos + boxWidth / 2, yPos + 8, { align: 'center' });
    
    // 數值（白色，較大）
    doc.setFontSize(16);
    doc.text(item.value, xPos + boxWidth / 2, yPos + 18, { align: 'center' });
    
    xPos += boxWidth + boxSpacing;
  });
  
  yPos += boxHeight + 15;
  
  // ========================================
  // Top 5 推薦
  // ========================================
  
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text('Top 5 推薦', 20, yPos);
  
  yPos += 10;
  
  // 使用 autotable 繪製表格
  const top5TableData = data.summary.top_5.map((candidate, index) => [
    `#${index + 1}`,
    candidate.name,
    candidate.total_score.toFixed(1),
    candidate.grade,
    candidate.priority
  ]);
  
  (doc as any).autoTable({
    startY: yPos,
    head: [['排名', '候選人', '總分', '等級', '優先級']],
    body: top5TableData,
    theme: 'grid',
    headStyles: {
      fillColor: [99, 102, 241],
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 10
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 60 },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 30, halign: 'center' }
    },
    margin: { left: 20, right: 20 }
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  // ========================================
  // 詳細配對報告（每個候選人一頁）
  // ========================================
  
  data.matches.forEach((match, index) => {
    // 新增一頁
    doc.addPage();
    yPos = 20;
    
    // 候選人名稱
    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.text(`#${index + 1} ${match.candidate.name}`, 20, yPos);
    
    yPos += 12;
    
    // 總分與等級
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`總分：${match.總分.toFixed(1)} / 100`, 20, yPos);
    doc.text(`等級：${match.等級}`, 80, yPos);
    doc.text(`優先級：${match.推薦優先級}`, 120, yPos);
    
    yPos += 15;
    
    // 分隔線
    doc.setDrawColor(200, 200, 200);
    doc.line(20, yPos, 190, yPos);
    
    yPos += 10;
    
    // 維度評分（使用表格）
    const dimensionTableData = [
      ['技能匹配', match.維度評分.技能匹配.toString()],
      ['成長匹配', match.維度評分.成長匹配.toString()],
      ['文化匹配', match.維度評分.文化匹配.toString()],
      ['動機匹配', match.維度評分.動機匹配.toString()]
    ];
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('維度評分', 20, yPos);
    yPos += 5;
    
    (doc as any).autoTable({
      startY: yPos,
      head: [['維度', '分數']],
      body: dimensionTableData,
      theme: 'striped',
      headStyles: {
        fillColor: [99, 102, 241],
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 10
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 50, halign: 'center', fontStyle: 'bold' }
      },
      margin: { left: 20, right: 20 }
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
    
    // 適配亮點
    if (match.適配亮點 && match.適配亮點.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('適配亮點', 20, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      
      match.適配亮點.forEach((highlight) => {
        const lines = doc.splitTextToSize(highlight, 160);
        doc.text(lines, 25, yPos);
        yPos += lines.length * 6;
      });
      
      yPos += 5;
    }
    
    // 風險提示
    if (match.風險提示 && match.風險提示.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(220, 38, 38); // Red
      doc.text('風險提示', 20, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      
      match.風險提示.forEach((risk) => {
        const lines = doc.splitTextToSize(risk, 160);
        doc.text(lines, 25, yPos);
        yPos += lines.length * 6;
      });
      
      yPos += 5;
    }
    
    // 建議
    if (match.建議) {
      // 檢查是否需要新頁面
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('建議', 20, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      
      if (match.建議.面試重點 && match.建議.面試重點.length > 0) {
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text('面試重點：', 25, yPos);
        yPos += 6;
        
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        
        match.建議.面試重點.forEach((point) => {
          const lines = doc.splitTextToSize(`- ${point}`, 155);
          doc.text(lines, 30, yPos);
          yPos += lines.length * 6;
        });
      }
      
      if (match.建議.薪資策略) {
        yPos += 3;
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text('薪資策略：', 25, yPos);
        yPos += 6;
        
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        const salaryLines = doc.splitTextToSize(match.建議.薪資策略, 155);
        doc.text(salaryLines, 30, yPos);
        yPos += salaryLines.length * 6;
      }
    }
    
    // 頁尾（頁碼）
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`第 ${index + 2} 頁 / 共 ${data.matches.length + 1} 頁`, 105, 285, { align: 'center' });
  });
  
  // ========================================
  // 儲存 PDF
  // ========================================
  
  const fileName = `Step1ne_配對報告_${data.jobTitle}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
