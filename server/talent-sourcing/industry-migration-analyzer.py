#!/usr/bin/env python3
"""
Industry Migration Analyzer - 產業遷移能力評估系統

目的：
為非直接產業匹配的候選人計算「遷移潛力分數」
評估：金融背景工程師 → 互聯網職位 的學習能力

核心模型：
- 技能遷移能力（0-1）
- 產業相關度（0-1）
- 學習曲線評估（週數）
"""

import json
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum

# ==================== 產業分類 ====================

class IndustryType(Enum):
    GAMING = "gaming"
    FINTECH = "fintech"
    HEALTHCARE = "healthcare"
    MANUFACTURING = "manufacturing"
    INTERNET = "internet"
    LEGAL_TECH = "legal_tech"
    DEVOPS = "devops"
    UNKNOWN = "unknown"

# ==================== 技能遷移矩陣 ====================

SKILL_TRANSFERABILITY = {
    # 通用基礎技能（跨產業 100% 遷移）
    'python': 1.0,
    'java': 1.0,
    'c++': 1.0,
    'go': 1.0,
    'sql': 1.0,
    'git': 1.0,
    'docker': 1.0,
    'kubernetes': 1.0,
    
    # 高度相關技能（80-90% 遷移）
    'microservices': 0.95,
    'api_design': 0.95,
    'database_design': 0.9,
    'system_architecture': 0.9,
    'scaling': 0.9,
    
    # 中度相關（50-70% 遷移）
    'fintech_protocols': 0.3,  # 金融特定
    'high_frequency_trading': 0.2,  # 完全金融特定
    'compliance': 0.5,  # 可遷移到其他受管制產業
    'bim': 0.4,  # 製造特定
    'game_engine': 0.3,  # 遊戲特定
    
    # 產業特定（<30% 遷移）
    'clinical_diagnosis': 0.1,
    'hipaa': 0.2,  # 醫療規範
    'game_physics': 0.2,
}

# ==================== 產業相似度矩陣 ====================

INDUSTRY_SIMILARITY_MATRIX = {
    # 高度相似（0.8-1.0）
    (IndustryType.INTERNET, IndustryType.GAMING): 0.95,
    (IndustryType.GAMING, IndustryType.INTERNET): 0.95,
    (IndustryType.INTERNET, IndustryType.DEVOPS): 0.95,
    (IndustryType.DEVOPS, IndustryType.INTERNET): 0.95,
    
    # 相關（0.5-0.8）
    (IndustryType.FINTECH, IndustryType.INTERNET): 0.85,
    (IndustryType.INTERNET, IndustryType.FINTECH): 0.85,
    (IndustryType.FINTECH, IndustryType.DEVOPS): 0.75,
    (IndustryType.DEVOPS, IndustryType.FINTECH): 0.75,
    
    # 部分相關（0.3-0.5）
    (IndustryType.MANUFACTURING, IndustryType.INTERNET): 0.4,
    (IndustryType.HEALTHCARE, IndustryType.INTERNET): 0.45,
    (IndustryType.LEGAL_TECH, IndustryType.INTERNET): 0.5,
    
    # 低度相關或無關（<0.3）
    'default': 0.2,
}

# ==================== 學習曲線數據 ====================

LEARNING_CURVES = {
    # (源產業, 目標產業) -> (週數, 難度等級)
    (IndustryType.FINTECH, IndustryType.INTERNET): (2, 'easy'),      # 高頻交易 → Web 後端（簡單）
    (IndustryType.INTERNET, IndustryType.FINTECH): (6, 'hard'),       # Web 後端 → 量化交易（困難）
    (IndustryType.INTERNET, IndustryType.GAMING): (3, 'medium'),      # Web → 遊戲（中等）
    (IndustryType.GAMING, IndustryType.INTERNET): (2, 'easy'),        # 遊戲 → Web（簡單）
    (IndustryType.MANUFACTURING, IndustryType.INTERNET): (8, 'hard'), # 製造 → Web（困難）
    (IndustryType.INTERNET, IndustryType.MANUFACTURING): (10, 'hard'),# Web → 製造（困難）
    (IndustryType.HEALTHCARE, IndustryType.INTERNET): (4, 'medium'),  # 醫療 → Web（中等）
    'default': (6, 'medium'),  # 預設：6週中等難度
}

# ==================== 數據類 ====================

@dataclass
class MigrationAnalysis:
    """遷移能力分析結果"""
    candidate_name: str
    source_industry: str
    target_industry: str
    
    # 遷移分數（0-100）
    skill_transferability: float
    industry_similarity: float
    learning_readiness: float
    
    # 綜合遷移潛力（0-100）
    migration_potential: float
    
    # 詳細分析
    transferable_skills: List[str]
    non_transferable_skills: List[str]
    learning_curve_weeks: int
    difficulty_level: str
    recommendations: List[str]
    
    def to_dict(self) -> Dict:
        return asdict(self)

@dataclass
class Candidate:
    """候選人資料"""
    name: str
    years_experience: int
    source_industry: IndustryType
    skills: List[str]
    company_background: List[str]

# ==================== 遷移分析引擎 ====================

class IndustryMigrationAnalyzer:
    """產業遷移能力分析"""
    
    def analyze(self, candidate: Candidate, target_industry: IndustryType) -> MigrationAnalysis:
        """分析候選人的產業遷移潛力"""
        
        # 計算三維度分數
        skill_score = self._calc_skill_transferability(candidate.skills)
        industry_score = self._calc_industry_similarity(candidate.source_industry, target_industry)
        learning_score = self._calc_learning_readiness(candidate.years_experience)
        
        # 綜合遷移潛力（加權）
        migration_potential = (
            skill_score * 0.5 +      # 技能是關鍵
            industry_score * 0.3 +   # 產業相似度次要
            learning_score * 0.2     # 學習能力輔助
        )
        
        # 分析技能
        transferable = self._identify_transferable_skills(candidate.skills, target_industry)
        non_transferable = self._identify_non_transferable_skills(candidate.skills, target_industry)
        
        # 學習曲線
        learning_weeks, difficulty = self._get_learning_curve(candidate.source_industry, target_industry)
        
        # 推薦
        recommendations = self._generate_recommendations(
            candidate, target_industry, migration_potential, transferable
        )
        
        return MigrationAnalysis(
            candidate_name=candidate.name,
            source_industry=candidate.source_industry.value,
            target_industry=target_industry.value,
            skill_transferability=skill_score,
            industry_similarity=industry_score,
            learning_readiness=learning_score,
            migration_potential=migration_potential,
            transferable_skills=transferable,
            non_transferable_skills=non_transferable,
            learning_curve_weeks=learning_weeks,
            difficulty_level=difficulty,
            recommendations=recommendations
        )
    
    def _calc_skill_transferability(self, skills: List[str]) -> float:
        """計算技能遷移度"""
        
        if not skills:
            return 50.0
        
        total_transfer = 0.0
        for skill in skills:
            skill_lower = skill.lower()
            # 檢查直接匹配
            if skill_lower in SKILL_TRANSFERABILITY:
                total_transfer += SKILL_TRANSFERABILITY[skill_lower]
            else:
                # 部分匹配（如 "Python Developer" 匹配 "python"）
                found = False
                for key in SKILL_TRANSFERABILITY:
                    if key in skill_lower:
                        total_transfer += SKILL_TRANSFERABILITY[key]
                        found = True
                        break
                if not found:
                    total_transfer += 0.6  # 預設中等遷移度
        
        avg_transfer = total_transfer / len(skills)
        return min(100.0, avg_transfer * 100)
    
    def _calc_industry_similarity(self, source: IndustryType, target: IndustryType) -> float:
        """計算產業相似度"""
        
        if source == target:
            return 100.0
        
        key = (source, target)
        similarity = INDUSTRY_SIMILARITY_MATRIX.get(key, 
                    INDUSTRY_SIMILARITY_MATRIX.get('default', 0.2))
        
        return similarity * 100
    
    def _calc_learning_readiness(self, years_exp: int) -> float:
        """計算學習準備度"""
        
        # 經驗豐富的工程師學習能力強
        if years_exp >= 5:
            return 95.0
        elif years_exp >= 3:
            return 85.0
        elif years_exp >= 1:
            return 70.0
        else:
            return 50.0
    
    def _identify_transferable_skills(self, skills: List[str], target_industry: IndustryType) -> List[str]:
        """識別可遷移技能"""
        
        transferable = []
        for skill in skills:
            skill_lower = skill.lower()
            # 基礎語言/工具（通用）
            if any(base in skill_lower for base in ['python', 'java', 'c++', 'go', 'sql', 'git', 'docker']):
                transferable.append(f"{skill} (100% 遷移)")
            # 架構相關（高度遷移）
            elif any(arch in skill_lower for arch in ['microservices', 'api', 'database', 'architecture']):
                transferable.append(f"{skill} (90% 遷移)")
            # 通用技能
            elif any(generic in skill_lower for generic in ['project management', 'communication', 'leadership']):
                transferable.append(f"{skill} (100% 遷移)")
        
        return transferable[:5]  # Top 5
    
    def _identify_non_transferable_skills(self, skills: List[str], target_industry: IndustryType) -> List[str]:
        """識別不可遷移技能"""
        
        non_transferable = []
        industry_specific_keywords = {
            IndustryType.FINTECH: ['trading', 'quantitative', 'hft', 'derivatives'],
            IndustryType.HEALTHCARE: ['clinical', 'hipaa', 'diagnosis', 'medical'],
            IndustryType.MANUFACTURING: ['bim', 'revit', 'autocad', 'industrial'],
            IndustryType.GAMING: ['game_engine', 'physics', 'rendering', 'unreal'],
        }
        
        specific_keywords = industry_specific_keywords.get(target_industry, [])
        
        for skill in skills:
            skill_lower = skill.lower()
            if any(kw in skill_lower for kw in specific_keywords):
                non_transferable.append(skill)
        
        return non_transferable[:3]  # Top 3
    
    def _get_learning_curve(self, source: IndustryType, target: IndustryType) -> Tuple[int, str]:
        """獲取學習曲線"""
        
        key = (source, target)
        weeks, difficulty = LEARNING_CURVES.get(key, LEARNING_CURVES.get('default'))
        return weeks, difficulty
    
    def _generate_recommendations(self, 
                                 candidate: Candidate,
                                 target_industry: IndustryType,
                                 migration_potential: float,
                                 transferable_skills: List[str]) -> List[str]:
        """生成建議"""
        
        recommendations = []
        
        if migration_potential >= 80:
            recommendations.append("✅ 強烈推薦：可直接過渡到目標產業")
            recommendations.append("💡 建議：1-2週內上手，無需額外培訓")
        elif migration_potential >= 60:
            recommendations.append("⚠️ 可考慮：需要 1-2 個月適應期")
            recommendations.append(f"💡 建議：聚焦於 {transferable_skills[0].split()[0]} 等基礎技能遷移")
        elif migration_potential >= 40:
            recommendations.append("⚠️ 保留備選：需要 2-3 個月培訓")
            recommendations.append("💡 建議：從新手角度重新學習產業知識")
        else:
            recommendations.append("❌ 不推薦：產業跨度過大，學習成本高")
            recommendations.append("💡 建議：優先考慮相近產業職缺")
        
        return recommendations

# ==================== 主程序 ====================

def main():
    """示例：分析候選人的遷移潛力"""
    
    candidates = [
        Candidate(
            name='金融工程師A',
            years_experience=5,
            source_industry=IndustryType.FINTECH,
            skills=['Python', 'C++', 'Microservices', 'High-Frequency Trading', 'System Design'],
            company_background=['Goldman Sachs', 'Morgan Stanley']
        ),
        Candidate(
            name='遊戲開發者B',
            years_experience=3,
            source_industry=IndustryType.GAMING,
            skills=['C#', 'Game Engine', 'Networking', 'Real-time Systems'],
            company_background=['Unity', 'Unreal']
        ),
    ]
    
    # 目標職缺產業
    target_industries = [IndustryType.INTERNET, IndustryType.GAMING]
    
    analyzer = IndustryMigrationAnalyzer()
    
    print("\n" + "="*100)
    print("🌉 產業遷移能力分析報告")
    print("="*100 + "\n")
    
    all_results = []
    
    for candidate in candidates:
        for target in target_industries:
            result = analyzer.analyze(candidate, target)
            all_results.append(result)
            
            print(f"👤 {candidate.name}")
            print(f"   {candidate.source_industry.value.upper()} → {target.value.upper()}")
            print(f"   遷移潛力：{result.migration_potential:.0f}/100 分", end='')
            
            if result.migration_potential >= 80:
                print(" ✅")
            elif result.migration_potential >= 60:
                print(" ⚠️")
            else:
                print(" ❌")
            
            print(f"   • 技能遷移度：{result.skill_transferability:.0f}%")
            print(f"   • 產業相似度：{result.industry_similarity:.0f}%")
            print(f"   • 學習曲線：{result.learning_curve_weeks} 週（{result.difficulty_level}）")
            print(f"   • 可遷移技能：{', '.join(result.transferable_skills[:2])}")
            print(f"   • 推薦：{result.recommendations[0]}")
            print()
    
    # 保存結果
    output = {
        'timestamp': __import__('datetime').datetime.now().isoformat(),
        'analysis_count': len(all_results),
        'results': [r.to_dict() for r in all_results]
    }
    
    with open('/tmp/migration-analysis.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 遷移分析結果已保存：/tmp/migration-analysis.json")

if __name__ == '__main__':
    main()
