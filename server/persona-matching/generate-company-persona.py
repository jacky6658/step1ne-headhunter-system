#!/usr/bin/env python3
"""
公司畫像生成器 - Company Persona Generator
根據職缺描述 + 公司資訊自動生成結構化公司畫像

輸入：職缺描述 + 公司資訊（JSON）
輸出：公司畫像（JSON）
"""

import json
import argparse
from typing import Dict, List, Any

class CompanyPersonaGenerator:
    """公司畫像生成器"""
    
    # 公司階段關鍵字
    STAGE_KEYWORDS = {
        "新創": ["新創", "startup", "創業", "種子", "A輪"],
        "成長期": ["成長", "擴張", "B輪", "C輪", "快速發展"],
        "穩定企業": ["穩定", "成熟", "上市", "大型", "傳統"],
        "外商": ["外商", "跨國", "multinational", "foreign"]
    }
    
    # 技術成熟度關鍵字
    TECH_MATURITY_KEYWORDS = {
        "建模": ["BIM", "3D建模", "Revit", "建模"],
        "協調": ["協調", "整合", "衝突檢測"],
        "PMIS": ["專案管理", "PMIS", "進度管理"],
        "數位孿生": ["數位孿生", "Digital Twin", "智慧建築"]
    }
    
    # 用人風格關鍵字
    MANAGEMENT_STYLE_KEYWORDS = {
        "自主型": ["自主", "彈性", "自由", "創新"],
        "SOP型": ["流程", "制度", "SOP", "標準化"],
        "高壓型": ["挑戰", "高壓", "績效", "快節奏"],
        "研究型": ["研發", "創新", "技術導向", "研究"]
    }
    
    def __init__(self):
        pass
    
    def generate_persona(self, job_data: Dict, company_data: Dict) -> Dict:
        """
        生成公司畫像
        
        Args:
            job_data: 職缺描述資料
            company_data: 公司資訊
            
        Returns:
            公司畫像（結構化JSON）
        """
        persona = {
            "companyId": company_data.get("id", "UNKNOWN"),
            "companyName": company_data.get("name", "Unknown Company"),
            "jobId": job_data.get("id", "UNKNOWN"),
            "jobTitle": job_data.get("title", "Unknown Position"),
            
            "公司階段": self._identify_company_stage(company_data),
            "技術成熟度": self._assess_tech_maturity(job_data, company_data),
            "用人風格": self._identify_management_style(job_data, company_data),
            "工作環境": self._describe_work_environment(job_data, company_data),
            "成長路徑": self._define_growth_path(job_data, company_data),
            "風險因子": self._identify_risk_factors(job_data, company_data)
        }
        
        return persona
    
    def _identify_company_stage(self, company: Dict) -> str:
        """識別公司階段"""
        description = company.get("description", "").lower()
        company_type = company.get("type", "").lower()
        employee_count = company.get("employeeCount", 0)
        
        # 基於員工數判斷
        if employee_count > 0:
            if employee_count < 50:
                return "新創"
            elif employee_count < 500:
                return "成長期"
            else:
                return "穩定企業"
        
        # 基於關鍵字判斷
        for stage, keywords in self.STAGE_KEYWORDS.items():
            if any(kw in description or kw in company_type for kw in keywords):
                return stage
        
        return "成長期"  # 預設
    
    def _assess_tech_maturity(self, job: Dict, company: Dict) -> Dict:
        """評估技術成熟度"""
        job_desc = job.get("description", "").lower()
        requirements = job.get("requirements", "").lower()
        combined_text = job_desc + " " + requirements
        
        # 識別核心技術
        core_techs = []
        emerging_techs = []
        
        for tech, keywords in self.TECH_MATURITY_KEYWORDS.items():
            if any(kw.lower() in combined_text for kw in keywords):
                if tech == "數位孿生":
                    emerging_techs.append(tech)
                else:
                    core_techs.append(tech)
        
        # 評估成熟度等級
        if len(core_techs) >= 3 and len(emerging_techs) >= 1:
            maturity_level = "高"
        elif len(core_techs) >= 2:
            maturity_level = "中高"
        elif len(core_techs) >= 1:
            maturity_level = "中"
        else:
            maturity_level = "初級"
        
        return {
            "核心技術": core_techs,
            "新興技術": emerging_techs,
            "技術成熟度": maturity_level
        }
    
    def _identify_management_style(self, job: Dict, company: Dict) -> Dict:
        """識別用人風格"""
        culture = company.get("culture", "").lower()
        job_desc = job.get("description", "").lower()
        combined_text = culture + " " + job_desc
        
        # 匹配管理風格關鍵字
        style_scores = {}
        for style, keywords in self.MANAGEMENT_STYLE_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in combined_text)
            if score > 0:
                style_scores[style] = score
        
        # 排序取第一個
        sorted_styles = sorted(style_scores.items(), key=lambda x: x[1], reverse=True)
        main_style = sorted_styles[0][0] if sorted_styles else "自主型"
        
        # 生成管理方式描述
        management_way = self._get_management_description(main_style)
        team_atmosphere = self._get_team_atmosphere(main_style)
        
        return {
            "主要風格": main_style,
            "管理方式": management_way,
            "團隊氛圍": team_atmosphere
        }
    
    def _get_management_description(self, style: str) -> str:
        """取得管理方式描述"""
        descriptions = {
            "自主型": "目標導向",
            "SOP型": "流程導向",
            "高壓型": "績效導向",
            "研究型": "創新導向"
        }
        return descriptions.get(style, "平衡導向")
    
    def _get_team_atmosphere(self, style: str) -> str:
        """取得團隊氛圍描述"""
        atmospheres = {
            "自主型": "開放自由",
            "SOP型": "結構化",
            "高壓型": "競爭激烈",
            "研究型": "技術導向"
        }
        return atmospheres.get(style, "協作")
    
    def _describe_work_environment(self, job: Dict, company: Dict) -> Dict:
        """描述工作環境"""
        location = job.get("location", "")
        work_mode = job.get("workMode", "辦公室")
        job_desc = job.get("description", "").lower()
        
        # 識別工作場域
        main_venues = []
        auxiliary_venues = []
        
        if "工地" in job_desc or "現場" in job_desc:
            auxiliary_venues.append("工地")
        if "辦公室" in work_mode or "office" in work_mode.lower():
            main_venues.append("辦公室")
        if "研發" in job_desc or "研究" in job_desc:
            main_venues.append("研發中心")
        if "跨國" in job_desc or "海外" in job_desc:
            auxiliary_venues.append("跨國")
        
        if not main_venues:
            main_venues = ["辦公室"]
        
        # 判斷工作模式
        if "遠端" in work_mode or "remote" in work_mode.lower():
            work_mode_desc = "遠端"
        elif "混合" in work_mode or "hybrid" in work_mode.lower():
            work_mode_desc = "混合辦公"
        else:
            work_mode_desc = "辦公室"
        
        return {
            "主要場域": main_venues,
            "輔助場域": auxiliary_venues,
            "工作模式": work_mode_desc
        }
    
    def _define_growth_path(self, job: Dict, company: Dict) -> Dict:
        """定義成長路徑"""
        job_desc = job.get("description", "").lower()
        requirements = job.get("requirements", "").lower()
        combined_text = job_desc + " " + requirements
        
        # 識別成長路徑
        paths = []
        
        if "技術" in combined_text or "專業" in combined_text:
            paths.append("技術線")
        if "管理" in combined_text or "領導" in combined_text:
            paths.append("管理線")
        if "海外" in combined_text or "國際" in combined_text:
            paths.append("海外")
        if "新產品" in combined_text or "創新" in combined_text:
            paths.append("新產品")
        
        if not paths:
            paths = ["技術線"]  # 預設
        
        main_path = paths[0]
        auxiliary_paths = paths[1:] if len(paths) > 1 else []
        
        # 判斷晉升速度
        if "快速" in combined_text or "成長期" in combined_text:
            promotion_speed = "快速"
        elif "穩定" in combined_text:
            promotion_speed = "穩定"
        else:
            promotion_speed = "一般"
        
        return {
            "主要路徑": main_path,
            "輔助路徑": auxiliary_paths,
            "晉升速度": promotion_speed
        }
    
    def _identify_risk_factors(self, job: Dict, company: Dict) -> Dict:
        """識別風險因子"""
        job_desc = job.get("description", "").lower()
        contract_type = job.get("contractType", "").lower()
        
        # 識別風險
        risks = []
        
        if "專案" in contract_type or "專案制" in job_desc:
            risks.append("專案制")
        if "高流動" in job_desc or "流動性高" in job_desc:
            risks.append("高流動")
        if "客戶" in job_desc or "業務" in job_desc:
            risks.append("客戶導向")
        
        # 評估風險等級
        if len(risks) >= 3:
            risk_level = "高"
        elif len(risks) >= 2:
            risk_level = "中"
        elif len(risks) >= 1:
            risk_level = "低"
        else:
            risk_level = "極低"
        
        return {
            "主要風險": risks[:1] if risks else [],
            "次要風險": risks[1:] if len(risks) > 1 else [],
            "風險等級": risk_level
        }


def main():
    parser = argparse.ArgumentParser(description="生成公司畫像")
    parser.add_argument("--job", required=True, help="職缺描述 JSON 檔案")
    parser.add_argument("--company", required=True, help="公司資訊 JSON 檔案")
    parser.add_argument("--output", required=True, help="輸出公司畫像 JSON 檔案")
    
    args = parser.parse_args()
    
    # 讀取職缺描述
    with open(args.job, 'r', encoding='utf-8') as f:
        job_data = json.load(f)
    
    # 讀取公司資訊
    with open(args.company, 'r', encoding='utf-8') as f:
        company_data = json.load(f)
    
    # 生成公司畫像
    generator = CompanyPersonaGenerator()
    persona = generator.generate_persona(job_data, company_data)
    
    # 輸出結果
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(persona, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 公司畫像已生成：{args.output}")
    print(f"   公司：{persona['companyName']}")
    print(f"   職缺：{persona['jobTitle']}")
    print(f"   公司階段：{persona['公司階段']}")
    print(f"   用人風格：{persona['用人風格']['主要風格']}")


if __name__ == "__main__":
    main()
