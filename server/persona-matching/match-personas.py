#!/usr/bin/env python3
"""
畫像匹配分析器 - Persona Matcher
根據人才畫像 + 公司畫像計算適配度

輸入：人才畫像 + 公司畫像（JSON）
輸出：匹配報告（JSON）
"""

import json
import argparse
from typing import Dict, List, Any

class PersonaMatcher:
    """畫像匹配分析器"""
    
    # 匹配權重
    WEIGHTS = {
        "技能匹配": 0.35,
        "成長匹配": 0.25,
        "文化匹配": 0.25,
        "動機匹配": 0.15
    }
    
    def __init__(self):
        pass
    
    def match(self, candidate_persona: Dict, company_persona: Dict) -> Dict:
        """
        執行匹配分析
        
        Args:
            candidate_persona: 人才畫像
            company_persona: 公司畫像
            
        Returns:
            匹配報告（包含總分、等級、建議）
        """
        # 計算各維度分數
        skill_score = self._calculate_skill_match(candidate_persona, company_persona)
        growth_score = self._calculate_growth_match(candidate_persona, company_persona)
        culture_score = self._calculate_culture_match(candidate_persona, company_persona)
        motivation_score = self._calculate_motivation_match(candidate_persona, company_persona)
        
        # 計算總分
        total_score = (
            skill_score * self.WEIGHTS["技能匹配"] +
            growth_score * self.WEIGHTS["成長匹配"] +
            culture_score * self.WEIGHTS["文化匹配"] +
            motivation_score * self.WEIGHTS["動機匹配"]
        )
        
        # 取得等級
        grade = self._get_grade(total_score)
        
        # 生成報告
        report = {
            "candidateId": candidate_persona.get("candidateId"),
            "candidateName": candidate_persona.get("name"),
            "companyId": company_persona.get("companyId"),
            "companyName": company_persona.get("companyName"),
            "jobTitle": company_persona.get("jobTitle"),
            "matchDate": "2026-02-23",  # 實際應用中使用當前日期
            
            "總分": round(total_score, 1),
            "等級": grade,
            
            "維度評分": {
                "技能匹配": round(skill_score, 1),
                "成長匹配": round(growth_score, 1),
                "文化匹配": round(culture_score, 1),
                "動機匹配": round(motivation_score, 1)
            },
            
            "適配亮點": self._generate_highlights(candidate_persona, company_persona, {
                "技能匹配": skill_score,
                "成長匹配": growth_score,
                "文化匹配": culture_score,
                "動機匹配": motivation_score
            }),
            
            "風險提示": self._generate_risk_warnings(candidate_persona, company_persona),
            
            "建議": self._generate_recommendations(candidate_persona, company_persona, total_score),
            
            "推薦優先級": self._get_priority(total_score),
            "推薦原因": self._generate_recommendation_reason(candidate_persona, company_persona, total_score)
        }
        
        return report
    
    def _calculate_skill_match(self, candidate: Dict, company: Dict) -> float:
        """計算技能匹配度（35%）"""
        # 技能組合匹配（50%）
        candidate_skills = set(candidate.get("基本結構", {}).get("技能組合", []))
        company_techs = set(
            company.get("技術成熟度", {}).get("核心技術", []) +
            company.get("技術成熟度", {}).get("新興技術", [])
        )
        
        if not candidate_skills or not company_techs:
            skill_overlap = 50  # 無資料時給中間分
        else:
            overlap = len(candidate_skills & company_techs)
            skill_overlap = min((overlap / max(len(company_techs), 1)) * 100, 100)
        
        # 能力層級匹配（30%）
        tech_level = candidate.get("能力層級", {}).get("技術能力", "中級")
        maturity = company.get("技術成熟度", {}).get("技術成熟度", "中")
        
        level_match = self._match_tech_level(tech_level, maturity)
        
        # 產業背景匹配（20%）
        industry_match = 80  # 簡化處理，實際應用可更複雜
        
        # 加權計算
        score = (
            skill_overlap * 0.50 +
            level_match * 0.30 +
            industry_match * 0.20
        )
        
        return score
    
    def _match_tech_level(self, candidate_level: str, company_maturity: str) -> float:
        """匹配技術層級與公司成熟度"""
        level_scores = {
            "初級": 50,
            "中級": 70,
            "進階": 90
        }
        
        maturity_requirements = {
            "初級": 50,
            "中": 70,
            "中高": 80,
            "高": 90
        }
        
        candidate_score = level_scores.get(candidate_level, 70)
        required_score = maturity_requirements.get(company_maturity, 70)
        
        if candidate_score >= required_score:
            return 100  # 達標
        else:
            gap = required_score - candidate_score
            return max(100 - gap, 0)
    
    def _calculate_growth_match(self, candidate: Dict, company: Dict) -> float:
        """計算成長匹配度（25%）"""
        # 職涯路徑匹配（50%）
        candidate_motivation = candidate.get("工作動機", {}).get("主要動機", "")
        company_paths = company.get("成長路徑", {})
        main_path = company_paths.get("主要路徑", "技術線")
        
        path_match = self._match_career_path(candidate_motivation, main_path)
        
        # 學習機會匹配（30%）
        tech_maturity = company.get("技術成熟度", {}).get("技術成熟度", "中")
        learning_score = self._assess_learning_opportunity(tech_maturity)
        
        # 晉升速度匹配（20%）
        work_style = candidate.get("性格與工作風格", {}).get("主要類型", "")
        promotion_speed = company_paths.get("晉升速度", "一般")
        promotion_match = self._match_promotion_speed(work_style, promotion_speed)
        
        # 加權計算
        score = (
            path_match * 0.50 +
            learning_score * 0.30 +
            promotion_match * 0.20
        )
        
        return score
    
    def _match_career_path(self, motivation: str, company_path: str) -> float:
        """匹配職涯路徑"""
        motivation_path_map = {
            "想技術成長": "技術線",
            "想轉型": "新產品",
            "想出國": "海外"
        }
        
        preferred_path = motivation_path_map.get(motivation, "技術線")
        
        if preferred_path == company_path:
            return 100
        elif company_path in ["技術線", "管理線"]:  # 常見路徑
            return 70
        else:
            return 50
    
    def _assess_learning_opportunity(self, tech_maturity: str) -> float:
        """評估學習機會"""
        maturity_scores = {
            "高": 90,
            "中高": 80,
            "中": 70,
            "初級": 60
        }
        return maturity_scores.get(tech_maturity, 70)
    
    def _match_promotion_speed(self, work_style: str, promotion_speed: str) -> float:
        """匹配晉升速度"""
        # 創業型喜歡快速晉升，穩定型喜歡穩定發展
        if work_style == "創業型" and promotion_speed == "快速":
            return 100
        elif work_style == "穩定型" and promotion_speed == "穩定":
            return 100
        else:
            return 70
    
    def _calculate_culture_match(self, candidate: Dict, company: Dict) -> float:
        """計算文化匹配度（25%）"""
        # 工作風格匹配（40%）
        candidate_style = candidate.get("性格與工作風格", {}).get("主要類型", "")
        company_style = company.get("用人風格", {}).get("主要風格", "")
        
        style_match = self._match_work_style(candidate_style, company_style)
        
        # 公司階段匹配（30%）
        company_stage = company.get("公司階段", "成長期")
        stage_match = self._match_company_stage(candidate_style, company_stage)
        
        # 用人風格匹配（30%）
        management_match = style_match  # 簡化處理
        
        # 加權計算
        score = (
            style_match * 0.40 +
            stage_match * 0.30 +
            management_match * 0.30
        )
        
        return score
    
    def _match_work_style(self, candidate_style: str, company_style: str) -> float:
        """匹配工作風格"""
        compatibility_matrix = {
            "技術宅": {"自主型": 100, "研究型": 90, "SOP型": 60, "高壓型": 40},
            "創業型": {"高壓型": 100, "自主型": 90, "研究型": 70, "SOP型": 50},
            "穩定型": {"SOP型": 100, "自主型": 70, "研究型": 60, "高壓型": 40},
            "溝通型": {"自主型": 90, "高壓型": 80, "SOP型": 70, "研究型": 60}
        }
        
        return compatibility_matrix.get(candidate_style, {}).get(company_style, 70)
    
    def _match_company_stage(self, candidate_style: str, company_stage: str) -> float:
        """匹配公司階段"""
        stage_preferences = {
            "創業型": {"新創": 100, "成長期": 80, "穩定企業": 50, "外商": 60},
            "穩定型": {"穩定企業": 100, "外商": 90, "成長期": 60, "新創": 40},
            "技術宅": {"成長期": 90, "外商": 80, "穩定企業": 70, "新創": 60},
            "溝通型": {"成長期": 80, "外商": 80, "穩定企業": 70, "新創": 70}
        }
        
        return stage_preferences.get(candidate_style, {}).get(company_stage, 70)
    
    def _calculate_motivation_match(self, candidate: Dict, company: Dict) -> float:
        """計算動機匹配度（15%）"""
        # 主要動機滿足度（60%）
        main_motivation = candidate.get("工作動機", {}).get("主要動機", "")
        motivation_score = self._assess_motivation_satisfaction(main_motivation, company)
        
        # 不適配條件檢查（40%）
        incompatibility = candidate.get("不適配條件", {})
        work_env = company.get("工作環境", {})
        
        penalty = self._check_incompatibility(incompatibility, work_env)
        incompatibility_score = max(100 - penalty, 0)
        
        # 加權計算
        score = (
            motivation_score * 0.60 +
            incompatibility_score * 0.40
        )
        
        return score
    
    def _assess_motivation_satisfaction(self, motivation: str, company: Dict) -> float:
        """評估動機滿足度"""
        growth_path = company.get("成長路徑", {}).get("主要路徑", "")
        tech_maturity = company.get("技術成熟度", {}).get("技術成熟度", "中")
        
        if motivation == "想技術成長":
            if growth_path == "技術線" and tech_maturity in ["高", "中高"]:
                return 100
            elif growth_path == "技術線":
                return 80
            else:
                return 60
        elif motivation == "想出國":
            if growth_path == "海外":
                return 100
            else:
                return 50
        elif motivation == "想轉型":
            if growth_path == "新產品":
                return 100
            else:
                return 70
        else:
            return 70  # 預設
    
    def _check_incompatibility(self, incompatibility: Dict, work_env: Dict) -> int:
        """檢查不適配條件（返回扣分）"""
        penalty = 0
        
        # 檢查工作環境不適配
        unacceptable_envs = incompatibility.get("工作環境", [])
        actual_venues = work_env.get("主要場域", []) + work_env.get("輔助場域", [])
        
        for unacceptable in unacceptable_envs:
            if unacceptable in actual_venues:
                penalty += 30  # 每個不適配條件扣 30 分
        
        return min(penalty, 100)  # 上限 100 分
    
    def _get_grade(self, score: float) -> str:
        """取得匹配等級"""
        if score >= 90:
            return "S"
        elif score >= 80:
            return "A"
        elif score >= 70:
            return "B"
        elif score >= 60:
            return "C"
        else:
            return "D"
    
    def _generate_highlights(self, candidate: Dict, company: Dict, scores: Dict) -> List[str]:
        """生成適配亮點"""
        highlights = []
        
        if scores["技能匹配"] >= 85:
            highlights.append("✓ 技能組合高度匹配，專業能力強")
        
        if scores["成長匹配"] >= 85:
            growth_path = company.get("成長路徑", {}).get("主要路徑", "")
            highlights.append(f"✓ 職涯路徑契合，公司提供{growth_path}發展")
        
        if scores["文化匹配"] >= 85:
            company_style = company.get("用人風格", {}).get("主要風格", "")
            highlights.append(f"✓ 工作風格匹配，{company_style}環境適合候選人")
        
        if not highlights:
            highlights.append("✓ 基本條件符合，可進一步評估")
        
        return highlights
    
    def _generate_risk_warnings(self, candidate: Dict, company: Dict) -> List[str]:
        """生成風險提示"""
        warnings = []
        
        # 檢查不適配條件
        incompatibility = candidate.get("不適配條件", {})
        work_env = company.get("工作環境", {})
        
        unacceptable_envs = incompatibility.get("工作環境", [])
        actual_venues = work_env.get("輔助場域", [])
        
        for env in unacceptable_envs:
            if env in actual_venues:
                warnings.append(f"⚠️ 候選人不接受{env}環境，但職缺偶爾需要")
        
        # 檢查風險因子
        risk_factors = company.get("風險因子", {})
        main_risks = risk_factors.get("主要風險", [])
        
        for risk in main_risks:
            warnings.append(f"⚠️ {risk}可能帶來工作壓力，需確認承受度")
        
        if not warnings:
            warnings.append("✓ 暫無明顯風險")
        
        return warnings
    
    def _generate_recommendations(self, candidate: Dict, company: Dict, total_score: float) -> Dict:
        """生成建議"""
        interview_focus = []
        
        # 根據匹配度調整面試重點
        if total_score >= 85:
            interview_focus.append("確認薪資期望與公司預算是否匹配")
            interview_focus.append("了解入職時間與公司需求是否契合")
        else:
            interview_focus.append("深入了解技術能力與實務經驗")
            interview_focus.append("確認工作風格與團隊文化是否適配")
        
        # 薪資策略
        if total_score >= 90:
            salary_strategy = "市場價 + 15-20%，強調成長機會與技術挑戰"
        elif total_score >= 80:
            salary_strategy = "市場價 + 10-15%，強調公司發展與團隊氛圍"
        else:
            salary_strategy = "市場價，強調學習機會與職涯發展"
        
        # 留任策略
        motivation = candidate.get("工作動機", {}).get("主要動機", "")
        if motivation == "想技術成長":
            retention_strategy = "提供技術深化機會，定期技術分享與培訓"
        elif motivation == "想出國":
            retention_strategy = "規劃海外交流或國際專案參與機會"
        else:
            retention_strategy = "提供清晰的職涯發展路徑與定期review"
        
        return {
            "面試重點": interview_focus,
            "薪資策略": salary_strategy,
            "留任策略": retention_strategy
        }
    
    def _get_priority(self, score: float) -> str:
        """取得推薦優先級"""
        if score >= 85:
            return "高"
        elif score >= 70:
            return "中"
        else:
            return "低"
    
    def _generate_recommendation_reason(self, candidate: Dict, company: Dict, score: float) -> str:
        """生成推薦原因"""
        if score >= 85:
            return "技能能力強，工作風格契合，職涯路徑清晰，高度推薦"
        elif score >= 70:
            return "基本條件符合，有一定適配度，可進一步面試評估"
        else:
            return "部分條件符合，需謹慎評估適配度與培養成本"


def main():
    parser = argparse.ArgumentParser(description="執行人才與公司畫像匹配分析")
    parser.add_argument("--candidate", required=True, help="候選人畫像 JSON 檔案")
    parser.add_argument("--company", required=True, help="公司畫像 JSON 檔案")
    parser.add_argument("--output", required=True, help="輸出匹配報告 JSON 檔案")
    
    args = parser.parse_args()
    
    # 讀取畫像
    with open(args.candidate, 'r', encoding='utf-8') as f:
        candidate_persona = json.load(f)
    
    with open(args.company, 'r', encoding='utf-8') as f:
        company_persona = json.load(f)
    
    # 執行匹配
    matcher = PersonaMatcher()
    report = matcher.match(candidate_persona, company_persona)
    
    # 輸出報告
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 匹配報告已生成：{args.output}")
    print(f"   候選人：{report['candidateName']}")
    print(f"   職缺：{report['jobTitle']}")
    print(f"   總分：{report['總分']} 分")
    print(f"   等級：{report['等級']}")
    print(f"   推薦優先級：{report['推薦優先級']}")


if __name__ == "__main__":
    main()
