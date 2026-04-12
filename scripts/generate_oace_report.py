#!/usr/bin/env python3
"""Generate OACE Agentic Organization Report PDF with Chinese support."""

from fpdf import FPDF

class OACEReport(FPDF):
    def __init__(self):
        super().__init__()
        # Use WenQuanYi Zen Hei for Chinese
        self.add_font("zh", "", "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc")
        self.add_font("zh", "B", "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc")
        self.set_auto_page_break(auto=True, margin=20)

    def header(self):
        if self.page_no() > 1:
            self.set_font("zh", "", 8)
            self.set_text_color(120, 120, 120)
            self.cell(0, 8, "OACE 專案實踐計劃：代理型組織人力需求與 AI 代理分配報告", align="C")
            self.ln(10)
            # Header line
            self.set_draw_color(200, 200, 200)
            self.line(15, self.get_y(), self.w - 15, self.get_y())
            self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("zh", "", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"- {self.page_no()} -", align="C")

    def title_page(self):
        self.add_page()
        self.ln(50)
        # Main title
        self.set_font("zh", "B", 22)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 14, "OACE 專案實踐計劃", align="C")
        self.ln(5)
        self.set_font("zh", "B", 16)
        self.set_text_color(60, 60, 60)
        self.multi_cell(0, 10, "代理型組織人力需求與\nAI 代理分配報告", align="C")
        self.ln(10)
        # Divider
        self.set_draw_color(50, 50, 50)
        self.set_line_width(0.8)
        x_center = self.w / 2
        self.line(x_center - 40, self.get_y(), x_center + 40, self.get_y())
        self.ln(10)
        # Subtitle
        self.set_font("zh", "", 13)
        self.set_text_color(80, 80, 80)
        self.cell(0, 10, "2026 - 2036", align="C")
        self.ln(30)
        # Metadata
        self.set_font("zh", "", 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, "OACE Project  |  Step1ne Headhunter System", align="C")
        self.ln(6)
        self.cell(0, 8, "Confidential - Internal Use Only", align="C")

    def section_title(self, number, title):
        self.ln(8)
        self.set_font("zh", "B", 15)
        self.set_text_color(25, 25, 112)
        self.multi_cell(0, 10, f"{number}. {title}")
        # Underline
        self.set_draw_color(25, 25, 112)
        self.set_line_width(0.5)
        self.line(15, self.get_y() + 1, self.w - 15, self.get_y() + 1)
        self.ln(6)

    def sub_title(self, title):
        self.ln(4)
        self.set_font("zh", "B", 12)
        self.set_text_color(50, 50, 50)
        self.multi_cell(0, 9, title)
        self.ln(2)

    def body_text(self, text):
        self.set_font("zh", "", 10)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 7, text)
        self.ln(2)

    def bullet(self, title, desc=""):
        self.set_font("zh", "B", 10)
        self.set_text_color(40, 40, 40)
        x = self.get_x()
        self.cell(5, 7, "-")
        if desc:
            self.cell(0, 7, f" {title}")
            self.ln(7)
            self.set_x(x + 8)
            self.set_font("zh", "", 10)
            self.set_text_color(60, 60, 60)
            self.multi_cell(self.w - 38, 7, desc)
        else:
            self.set_font("zh", "", 10)
            self.multi_cell(self.w - 25, 7, f" {title}")
        self.ln(2)

    def add_table(self, headers, rows):
        """Draw a styled table."""
        self.ln(3)
        col_widths = [35, 45, 100]
        row_h = 8

        # Header
        self.set_font("zh", "B", 9)
        self.set_fill_color(45, 45, 80)
        self.set_text_color(255, 255, 255)
        for i, h in enumerate(headers):
            self.cell(col_widths[i], row_h, h, border=1, fill=True, align="C")
        self.ln(row_h)

        # Rows
        self.set_font("zh", "", 9)
        fill = False
        for row in rows:
            # Calculate max height needed
            max_lines = 1
            for i, cell_text in enumerate(row):
                lines = self.multi_cell(col_widths[i], row_h, cell_text, dry_run=True, output="LINES")
                max_lines = max(max_lines, len(lines))
            cell_h = row_h * max_lines

            if fill:
                self.set_fill_color(240, 240, 250)
            else:
                self.set_fill_color(255, 255, 255)
            self.set_text_color(40, 40, 40)

            x_start = self.get_x()
            y_start = self.get_y()

            for i, cell_text in enumerate(row):
                x = x_start + sum(col_widths[:i])
                self.set_xy(x, y_start)
                # Draw cell border and fill
                self.rect(x, y_start, col_widths[i], cell_h, "DF")
                self.set_xy(x + 1, y_start + 1)
                self.multi_cell(col_widths[i] - 2, row_h, cell_text)

            self.set_xy(x_start, y_start + cell_h)
            fill = not fill
        self.ln(5)


def main():
    pdf = OACEReport()

    # --- Cover Page ---
    pdf.title_page()

    # --- Section 1 ---
    pdf.add_page()
    pdf.section_title("1", "核心願景：從「人治」轉向「意志治理」")
    pdf.body_text(
        "在 2036 年全自動化生產的背景下，企業的競爭力不再取決於員工數量，"
        "而取決於「人類意志」轉化為「機器執行」的精準度。本計劃採用 2:50 比例模型："
        "即由 2 至 5 名核心人類主理人，監督並驅動 50 至 100 個專門化的 AI Agent "
        "構成的「代理工廠」。"
    )

    # --- Section 2 ---
    pdf.section_title("2", "人力資源架構：誰在「大腦」？誰在「肌肉」？")
    pdf.body_text(
        "根據研究，具備高情商（EQ）、複雜道德判斷與最終問責的角色為人類保留；"
        "而重複性高、數據量大、需要毫秒級決策的角色則完全由 AI Agent 取代。"
    )

    # --- A. Human Team ---
    pdf.sub_title("A. 核心人類團隊（不可替代：大腦與主權）")

    pdf.bullet(
        "戰略主理人 (Chief Will Officer, CWO)",
        "定義 OACE 的核心交易意志（如 Wyckoff/ICT 策略邊界），處理法律合規的高階政治決策。"
        "承擔最終法律責任，防止 AI 發生毀滅性邏輯錯誤。"
    )
    pdf.bullet(
        "代理監督官 (Agent Supervisor)",
        "協調數十個 Agent 之間的目標對齊，處理 Agent 無法解決的邊際案例（Edge Cases）。"
    )
    pdf.bullet(
        "主權技術架構師 (Sovereign Architect)",
        "維護 Private Box 實體硬體安全，審核 Trading-as-Git 的 Commit 歷史，確保金鑰永不上雲。"
    )

    # --- B. AI Agent ---
    pdf.sub_title("B. AI Agent 數位勞動力（全面取代：肌肉與速度）")
    pdf.body_text(
        "透過部署專業代理，可實現 24/7 全天候運作，績效預計提升 1.5 至 2.5 倍。"
    )

    pdf.add_table(
        ["職能類別", "AI Agent 類型", "具體執行任務"],
        [
            ["市場情報", "數據礦工\n(Data Miner)",
             "監控全球鏈上數據、社交情緒、即時新聞，產出精簡決策簡報。"],
            ["資產執行", "收益獵人\n(Yield Hunter)",
             "在不同 DeFi 協議間自動尋找最高收益，執行預設策略。"],
            ["安全合規", "審計代理\n(AuditAgent)",
             "利用 ZKML 自動檢測智慧合約漏洞，確保交易符合法規。"],
            ["結算管理", "PayFi 結算代理",
             "處理 M2M（機器對機器）微支付，錯誤率比人工降低 95%。"],
            ["客戶支援", "意圖轉譯處理\n(Intent CX)",
             "處理 100+ 種語言的客戶溝通，並將客戶意圖轉化為可執行的鏈上請求。"],
        ]
    )

    # --- Section 3 ---
    pdf.section_title("3", "實踐計劃：12 個月執行路線圖")

    pdf.sub_title("第一階段：基礎設施與意志封裝 (Month 1-3)")
    pdf.bullet(
        "Private Box 原型開發",
        "採購 Mac Mini M4 / NVIDIA Jetson，實施硬體隔離運算。"
    )
    pdf.bullet(
        "策略結構化",
        "將主理人的主觀判斷轉譯為「意志代碼」，建立初步的 Trading-as-Git 管線。"
    )

    pdf.sub_title("第二階段：代理工廠與微支付對接 (Month 4-6)")
    pdf.bullet(
        "部署 Agent 叢集",
        "啟動數據礦工與收益獵人 Agent。"
    )
    pdf.bullet(
        "對接 M2M 結算層",
        "利用 Circle 的 Nanopayments 與 x402 協議，實現 Agent 之間的亞秒級原子結算。"
    )

    pdf.sub_title("第三階段：ZKML 驗證與意圖網路整合 (Month 7-9)")
    pdf.bullet(
        "引入 ZKML 證明",
        "確保 AI 代理在不暴露主理人私有策略的前提下，向審計方證明其行為誠信。"
    )
    pdf.bullet(
        "意圖網路對接",
        "整合 dappOS 或 Anoma，讓人類主理人能透過「意圖（Intent）」直接下達複雜目標。"
    )

    pdf.sub_title("第四階段：法律確權與數位遺產測試 (Month 10-12)")
    pdf.bullet(
        "數位遺囑自動化",
        "測試「Dead man's switch」觸發機制，確保資產在主理人失去生物活性時能自動定向傳承。"
    )

    # --- Section 4 ---
    pdf.add_page()
    pdf.section_title("4", "關鍵績效指標 (KPIs) 與風險控制")

    pdf.sub_title("A. 關鍵指標")
    pdf.bullet(
        "人機比 (Human-to-Agent Ratio)",
        "初期目標 1:10，最終目標 1:50。"
    )
    pdf.bullet(
        "結算延遲 (Settlement Latency)",
        "跨境 B2B 結算需低於 100 毫秒。"
    )
    pdf.bullet(
        "合規覆蓋率",
        "100% 的 AI 交易動作需經過 ZKML 或 Git 審計軌跡追蹤。"
    )

    pdf.sub_title("B. 安全熔斷機制 (Emergency Stop)")
    pdf.body_text(
        "為防止如 2025 年測試 Agent 引發的 45 萬美元誤操作事件，"
        "系統必須保留人類主理人的物理斷電權與 Commit 否決權。"
    )

    # --- Conclusion ---
    pdf.ln(10)
    pdf.section_title("", "報告結論")
    pdf.body_text(
        "實踐 OACE 專案的核心不再是「增加人手」，而是「精煉意志」。"
        "透過這份分配計劃，主理人可以從繁瑣的日常操作中解脫，"
        "專注於定義未來的財富邊界。"
    )

    # Output
    output_path = "/home/user/step1ne-headhunter-system/docs/OACE-Agentic-Organization-Report-2026-2036.pdf"
    pdf.output(output_path)
    print(f"PDF generated: {output_path}")


if __name__ == "__main__":
    main()
