#!/usr/bin/env python3
"""
人才畫像生成器 - Candidate Persona Generator
根據候選人履歷自動生成結構化人才畫像

輸入：候選人履歷（JSON）
輸出：人才畫像（JSON）
"""

import json
import argparse
from typing import Dict, List, Any

class CandidatePersonaGenerator:
    """人才畫像生成器"""
    
    # 技能分類對應表
    SKILL_CATEGORIES = {
        "技術能力": ["BIM", "Revit", "Navisworks", "建模", "Python", "JavaScript", "AI", "ML"],
        "實務能力": ["專案管理", "協調", "施工圖", "工地管理", "客戶溝通"],
        "延伸能力": ["數位孿生", "自動化", "PMIS", "管理", "領導"]
    }
    
    # 工作風格關鍵字
    WORK_STYLE_KEYWORDS = {
        "穩定型": ["穩定", "長期", "大公司", "制度", "福利"],
        "創業型": ["新創", "快速", "彈性", "創新", "挑戰"],
        "技術宅": ["技術", "深度", "專注", "研究", "精進"],
        "溝通型": ["協調", "溝通", "團隊", "跨部門", "客戶"]
    }
    
    # 動機關鍵字
    MOTIVATION_KEYWORDS = {
        "想轉型": ["轉型", "學習新技能", "拓展", "跨領域"],
        "想出國": ["海外", "國際", "外商", "出國"],
        "想技術成長": ["技術成長", "精進", "深化", "專業"],
        "想離開產業": ["轉行", "離開", "考慮其他產業"]
    }
    
    def __init__(self):
        pass
    
    def generate_persona(self, candidate_data: Dict) -> Dict:
        """
        生成人才畫像
        
        Args:
            candidate_data: 候選人履歷資料
            
        Returns:
            人才畫像（結構化JSON）
        """
        persona = {
            "candidateId": candidate_data.get("id", "UNKNOWN"),
            "name": candidate_data.get("name", "Unknown"),
            "基本結構": self._extract_basic_structure(candidate_data),
            "能力層級": self._assess_capability_level(candidate_data),
            "工作動機": self._infer_motivation(candidate_data),
            "性格與工作風格": self._infer_work_style(candidate_data),
            "不適配條件": self._extract_incompatibility(candidate_data)
        }
        
        return persona
    
    def _extract_basic_structure(self, candidate: Dict) -> Dict:
        """提取基本結構"""
        # 解析工作經歷
        work_history = candidate.get("workHistory", [])
        if isinstance(work_history, str):
            try:
                work_history = json.loads(work_history)
            except:
                work_history = []
        
        # 最新職稱
        latest_position = work_history[0].get("position", "Unknown") if work_history else "Unknown"
        
        # 年資區間
        total_years = candidate.get("years", 0)
        if total_years >= 10:
            year_range = "10年+"
        elif total_years >= 7:
            year_range = "7-10年"
        elif total_years >= 5:
            year_range = "5-7年"
        elif total_years >= 3:
            year_range = "3-5年"
        elif total_years >= 1:
            year_range = "1-3年"
        else:
            year_range = "<1年"
        
        # 技能組合（支援 list 或 string）
        skills_data = candidate.get("skills", "")
        if isinstance(skills_data, list):
            skills = [s.strip() for s in skills_data if s.strip()]
        elif isinstance(skills_data, str):
            skills = [s.strip() for s in skills_data.split("、") if s.strip()] if skills_data else []
        else:
            skills = []
        
        # 產業背景（從工作經歷推斷）
        industries = set()
        for job in work_history:
            company = job.get("company", "")
            # 簡化判斷（實際應用可用更複雜的邏輯）
            if "建設" in company or "建築" in company or "營造" in company:
                industries.add("營建業")
            elif "科技" in company or "軟體" in company:
                industries.add("科技業")
        
        # 教育背景
        education = candidate.get("education", "")
        
        return {
            "職稱": latest_position,
            "年資區間": year_range,
            "技能組合": skills[:10],  # 前 10 個技能
            "產業背景": list(industries) if industries else ["Unknown"],
            "教育背景": education
        }
    
    def _assess_capability_level(self, candidate: Dict) -> Dict:
        """評估能力層級"""
        skills_data = candidate.get("skills", "")
        if isinstance(skills_data, list):
            skills_list = [s.strip().lower() for s in skills_data if s.strip()]
        elif isinstance(skills_data, str):
            skills_list = [s.strip().lower() for s in skills_data.split("、") if s.strip()] if skills_data else []
        else:
            skills_list = []
        
        # 分類技能
        categorized = {
            "技術能力": [],
            "實務能力": [],
            "延伸能力": []
        }
        
        for skill in skills_list:
            for category, keywords in self.SKILL_CATEGORIES.items():
                if any(kw.lower() in skill for kw in keywords):
                    categorized[category].append(skill)
        
        # 評估層級
        tech_level = "進階" if len(categorized["技術能力"]) >= 5 else "中級" if len(categorized["技術能力"]) >= 3 else "初級"
        practice_level = "豐富" if len(categorized["實務能力"]) >= 3 else "一般"
        
        return {
            "技術能力": tech_level,
            "實務能力": practice_level,
            "延伸能力": categorized["延伸能力"][:5]  # 最多 5 個
        }
    
    def _infer_motivation(self, candidate: Dict) -> Dict:
        """推測工作動機（基於履歷關鍵字 + 職涯軌跡）"""
        # 取得備註欄位（如果有）
        notes = candidate.get("notes", "").lower()
        skills_data = candidate.get("skills", "")
        skills = " ".join(skills_data).lower() if isinstance(skills_data, list) else (skills_data.lower() if isinstance(skills_data, str) else "")
        combined_text = notes + " " + skills
        
        # 匹配動機關鍵字
        detected_motivations = []
        for motivation, keywords in self.MOTIVATION_KEYWORDS.items():
            if any(kw in combined_text for kw in keywords):
                detected_motivations.append(motivation)
        
        # 如果沒有明確關鍵字，根據年資推測
        if not detected_motivations:
            years = candidate.get("years", 0)
            if years >= 5:
                detected_motivations.append("想技術成長")  # 資深人才通常追求技術深化
            elif years >= 2:
                detected_motivations.append("想轉型")  # 中階人才可能想轉型
            else:
                detected_motivations.append("想技術成長")  # 新人想學習
        
        return {
            "主要動機": detected_motivations[0] if detected_motivations else "Unknown",
            "次要動機": detected_motivations[1:3] if len(detected_motivations) > 1 else [],
            "排除動機": []  # 需要面試確認，無法從履歷判斷
        }
    
    def _infer_work_style(self, candidate: Dict) -> Dict:
        """推測性格與工作風格"""
        notes = candidate.get("notes", "").lower()
        skills_data = candidate.get("skills", "")
        skills = " ".join(skills_data).lower() if isinstance(skills_data, list) else (skills_data.lower() if isinstance(skills_data, str) else "")
        work_history = candidate.get("workHistory", [])
        
        if isinstance(work_history, str):
            try:
                work_history = json.loads(work_history)
            except:
                work_history = []
        
        combined_text = notes + " " + skills
        
        # 匹配工作風格關鍵字
        style_scores = {}
        for style, keywords in self.WORK_STYLE_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in combined_text)
            if score > 0:
                style_scores[style] = score
        
        # 根據工作經歷補充判斷
        job_changes = candidate.get("jobChanges", 0)
        years = candidate.get("years", 0)
        
        if job_changes == 0:
            style_scores["穩定型"] = style_scores.get("穩定型", 0) + 2
        elif job_changes >= 4 and years < 5:
            style_scores["創業型"] = style_scores.get("創業型", 0) + 2
        
        # 排序取前 2 個
        sorted_styles = sorted(style_scores.items(), key=lambda x: x[1], reverse=True)
        
        main_type = sorted_styles[0][0] if sorted_styles else "未知"
        secondary_type = sorted_styles[1][0] if len(sorted_styles) > 1 else None
        
        # 生成特徵描述
        features = self._generate_style_features(main_type)
        
        return {
            "主要類型": main_type,
            "次要類型": secondary_type,
            "特徵": features
        }
    
    def _generate_style_features(self, style: str) -> List[str]:
        """生成工作風格特徵描述"""
        feature_map = {
            "穩定型": ["偏好大公司", "重視制度", "追求長期發展"],
            "創業型": ["勇於挑戰", "適應力強", "喜歡快節奏"],
            "技術宅": ["專注技術", "追求深度", "不喜社交"],
            "溝通型": ["善於協調", "團隊合作", "客戶導向"]
        }
        return feature_map.get(style, ["特徵待確認"])
    
    def _extract_incompatibility(self, candidate: Dict) -> Dict:
        """提取不適配條件（需要面試確認，這裡給預設值）"""
        # 這部分通常無法從履歷判斷，需要面試時詢問
        # 這裡僅提供框架
        return {
            "工作環境": [],  # 例如：["工地"]
            "工作型態": [],  # 例如：["高壓", "頻繁加班"]
            "工作內容": []   # 例如：["純協調", "業務導向"]
        }


def main():
    parser = argparse.ArgumentParser(description="生成候選人人才畫像")
    parser.add_argument("--resume", required=True, help="候選人履歷 JSON 檔案")
    parser.add_argument("--output", required=True, help="輸出人才畫像 JSON 檔案")
    
    args = parser.parse_args()
    
    # 讀取履歷
    with open(args.resume, 'r', encoding='utf-8') as f:
        candidate_data = json.load(f)
    
    # 生成人才畫像
    generator = CandidatePersonaGenerator()
    persona = generator.generate_persona(candidate_data)
    
    # 輸出結果
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(persona, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 人才畫像已生成：{args.output}")
    print(f"   候選人：{persona['name']}")
    print(f"   職稱：{persona['基本結構']['職稱']}")
    print(f"   工作風格：{persona['性格與工作風格']['主要類型']}")
    print(f"   主要動機：{persona['工作動機']['主要動機']}")


if __name__ == "__main__":
    main()
