#!/usr/bin/env python3
"""
Candidate Scoring System v2 - 6维评分引擎（含产业经验维度）

评分维度（权重分配）：
1. 技能匹配度 (25%)
2. 年资符合度 (20%)
3. 地点适配度 (15%)
4. 招聘意願度 (15%)
5. 公司等级 (15%)
6. 产业经验 (10%) ← 新增！

综合评级：S / A+ / A / B / C
"""

import json
import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum

# ==================== 评级枚举 ====================

class TalentLevel(Enum):
    """综合评级"""
    S = "S"      # 90-100 分，完美匹配
    A_PLUS = "A+"  # 85-89 分，优秀
    A = "A"      # 75-84 分，良好
    B = "B"      # 60-74 分，可用
    C = "C"      # < 60 分，不推荐

class IndustryType(Enum):
    """产业类型"""
    GAMING = "gaming"
    FINTECH = "fintech"
    HEALTHCARE = "healthcare"
    MANUFACTURING = "manufacturing"
    INTERNET = "internet"
    LEGAL_TECH = "legal_tech"
    DEVOPS = "devops"
    UNKNOWN = "unknown"

# ==================== 产业遷移能力矩阵 ====================

INDUSTRY_TRANSFERABILITY = {
    # 从金融科技迁移到...
    (IndustryType.FINTECH, IndustryType.INTERNET): 0.9,  # 高并发架构相似
    (IndustryType.FINTECH, IndustryType.DEVOPS): 0.85,    # 基础设施相似
    (IndustryType.FINTECH, IndustryType.MANUFACTURING): 0.4,  # 不相关
    
    # 从互联网迁移到...
    (IndustryType.INTERNET, IndustryType.GAMING): 0.9,    # 实时系统相似
    (IndustryType.INTERNET, IndustryType.DEVOPS): 0.95,   # 完全相关
    (IndustryType.INTERNET, IndustryType.FINTECH): 0.85,  # 高性能相关
    
    # 从游戏迁移到...
    (IndustryType.GAMING, IndustryType.INTERNET): 0.9,    # 后端架构相似
    (IndustryType.GAMING, IndustryType.DEVOPS): 0.85,
    
    # 默认：不同产业
    'default': 0.3,  # 低遷移能力
}

# ==================== 数据类 ====================

@dataclass
class Candidate:
    """候选人基本信息"""
    name: str
    position: str
    years_experience: int
    job_changes: int
    avg_tenure_months: int
    recent_gap_months: int
    location: str
    skills: List[str]
    company_background: List[str]  # 工作过的公司
    education: str
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    contact_link: Optional[str] = None

@dataclass
class JobRequirement:
    """职缺需求"""
    job_title: str
    customer_name: str
    industry: IndustryType
    years_required: int
    required_skills: List[str]
    location: str
    nice_to_have_skills: List[str] = None
    required_industry_experience: bool = False
    
    def __post_init__(self):
        if self.nice_to_have_skills is None:
            self.nice_to_have_skills = []

@dataclass
class ScoringResult:
    """评分结果"""
    candidate_name: str
    job_title: str
    
    # 6维评分（0-100）
    skill_match: float
    experience_fit: float
    location_fit: float
    hiring_signal: float
    company_level: float
    industry_experience: float
    
    # 综合评分
    overall_score: float
    talent_level: TalentLevel
    
    # 详细分析
    strengths: List[str]
    weaknesses: List[str]
    migration_ability: float  # 产业遷移能力（0-1）
    transferable_skills: List[str]
    
    def to_dict(self) -> Dict:
        return {
            'candidate_name': self.candidate_name,
            'job_title': self.job_title,
            'scores': {
                'skill_match': round(self.skill_match, 1),
                'experience_fit': round(self.experience_fit, 1),
                'location_fit': round(self.location_fit, 1),
                'hiring_signal': round(self.hiring_signal, 1),
                'company_level': round(self.company_level, 1),
                'industry_experience': round(self.industry_experience, 1),
                'overall_score': round(self.overall_score, 1),
            },
            'talent_level': self.talent_level.value,
            'migration_ability': round(self.migration_ability, 2),
            'strengths': self.strengths,
            'weaknesses': self.weaknesses,
            'transferable_skills': self.transferable_skills,
        }

# ==================== 评分引擎 ====================

class CandidateScoringEngine:
    """6维评分引擎"""
    
    # 权重配置
    WEIGHTS = {
        'skill_match': 0.25,
        'experience_fit': 0.20,
        'location_fit': 0.15,
        'hiring_signal': 0.15,
        'company_level': 0.15,
        'industry_experience': 0.10,
    }
    
    # 公司等级（知名度）
    COMPANY_TIERS = {
        'tier_1': ['Google', 'Meta', 'Apple', 'Amazon', 'Microsoft', 'Goldman Sachs', '騰訊', '阿里', '字節跳動'],
        'tier_2': ['LINE', 'Shopee', 'Netflix', 'Spotify', '網易', '摩根士丹利'],
        'tier_3': ['startup', '新創', '中小企'],
    }
    
    def score(self, candidate: Candidate, job_req: JobRequirement) -> ScoringResult:
        """计算综合评分"""
        
        # 逐维计算
        skill_score = self._calc_skill_match(candidate, job_req)
        exp_score = self._calc_experience_fit(candidate, job_req)
        loc_score = self._calc_location_fit(candidate, job_req)
        signal_score = self._calc_hiring_signal(candidate)
        company_score = self._calc_company_level(candidate)
        industry_score, migration = self._calc_industry_experience(candidate, job_req)
        
        # 综合评分（加权）
        overall = (
            skill_score * self.WEIGHTS['skill_match'] +
            exp_score * self.WEIGHTS['experience_fit'] +
            loc_score * self.WEIGHTS['location_fit'] +
            signal_score * self.WEIGHTS['hiring_signal'] +
            company_score * self.WEIGHTS['company_level'] +
            industry_score * self.WEIGHTS['industry_experience']
        )
        
        # 评级
        talent_level = self._get_talent_level(overall)
        
        # 优劣势分析
        strengths, weaknesses = self._analyze_strengths_weaknesses(
            candidate, job_req,
            skill_score, exp_score, industry_score
        )
        
        # 可遷移技能
        transferable = self._identify_transferable_skills(candidate, job_req)
        
        return ScoringResult(
            candidate_name=candidate.name,
            job_title=job_req.job_title,
            skill_match=skill_score,
            experience_fit=exp_score,
            location_fit=loc_score,
            hiring_signal=signal_score,
            company_level=company_score,
            industry_experience=industry_score,
            overall_score=overall,
            talent_level=talent_level,
            strengths=strengths,
            weaknesses=weaknesses,
            migration_ability=migration,
            transferable_skills=transferable
        )
    
    def _calc_skill_match(self, candidate: Candidate, job_req: JobRequirement) -> float:
        """技能匹配度 (25%)"""
        
        if not job_req.required_skills:
            return 75.0  # 无特定要求
        
        matched = sum(1 for skill in job_req.required_skills 
                     if any(s.lower() in skill.lower() or skill.lower() in s.lower() 
                           for s in candidate.skills))
        
        required_match = matched / len(job_req.required_skills)
        
        # 加分：nice-to-have 技能
        bonus = 0.0
        if job_req.nice_to_have_skills:
            nice_matched = sum(1 for skill in job_req.nice_to_have_skills
                             if any(s.lower() in skill.lower() or skill.lower() in s.lower()
                                   for s in candidate.skills))
            bonus = (nice_matched / len(job_req.nice_to_have_skills)) * 10
        
        return min(100.0, (required_match * 80) + bonus)
    
    def _calc_experience_fit(self, candidate: Candidate, job_req: JobRequirement) -> float:
        """年资符合度 (20%)"""
        
        # 年资符合（±1年内为最优）
        diff = abs(candidate.years_experience - job_req.years_required)
        
        if diff == 0:
            years_score = 100.0
        elif diff <= 1:
            years_score = 95.0
        elif diff <= 2:
            years_score = 85.0
        elif diff <= 3:
            years_score = 70.0
        else:
            years_score = max(30.0, 100 - (diff * 10))
        
        # 稳定度评分（转职次数 + 平均任职）
        stability = 100.0
        
        # 转职频率（3年内不超过2次）
        if candidate.job_changes > 2:
            stability -= (candidate.job_changes - 2) * 20
        
        # 平均任职（越长越好，12个月为基准）
        if candidate.avg_tenure_months < 6:
            stability -= 30
        elif candidate.avg_tenure_months < 12:
            stability -= 10
        
        # 最近gap（超过3个月扣分）
        if candidate.recent_gap_months > 3:
            stability -= min(20, candidate.recent_gap_months * 5)
        
        stability = max(20.0, stability)
        
        return (years_score * 0.7) + (stability * 0.3)
    
    def _calc_location_fit(self, candidate: Candidate, job_req: JobRequirement) -> float:
        """地点适配度 (15%)"""
        
        if candidate.location == job_req.location:
            return 100.0
        
        # 同一地区（台北、新北等）
        if self._is_same_region(candidate.location, job_req.location):
            return 90.0
        
        # 不同县市
        return 50.0
    
    def _is_same_region(self, loc1: str, loc2: str) -> bool:
        """判断是否同一地区"""
        taiwan_regions = {
            '台北': ['台北', '新北', '基隆'],
            '新北': ['新北', '台北', '基隆'],
            '台中': ['台中'],
            '高雄': ['高雄', '屏東'],
        }
        for region, cities in taiwan_regions.items():
            if loc1 in cities and loc2 in cities:
                return True
        return False
    
    def _calc_hiring_signal(self, candidate: Candidate) -> float:
        """招聘意願度 (15%)"""
        
        signal = 70.0  # 基础分
        
        # 最近有gap（主动寻职）
        if candidate.recent_gap_months > 0 and candidate.recent_gap_months <= 6:
            signal += 20.0
        
        # 最近gap > 6个月（可能有其他原因，保守评估）
        if candidate.recent_gap_months > 6:
            signal -= 10.0
        
        # GitHub 有持续更新（技术追求）
        # 此处简化，实际需要检查 GitHub commit 频率
        signal = min(100.0, signal)
        
        return signal
    
    def _calc_company_level(self, candidate: Candidate) -> float:
        """公司等级 (15%)"""
        
        score = 50.0  # 默认中等企业
        
        for company in candidate.company_background:
            if any(tier1 in company for tier1 in self.COMPANY_TIERS['tier_1']):
                score = 100.0
                break
            elif any(tier2 in company for tier2 in self.COMPANY_TIERS['tier_2']):
                score = max(score, 85.0)
        
        return score
    
    def _calc_industry_experience(self, candidate: Candidate, job_req: JobRequirement) -> Tuple[float, float]:
        """产业经验 (10%) + 遷移能力"""
        
        # 从候选人背景推断产业经验（简化版）
        candidate_industries = self._infer_candidate_industries(candidate.company_background)
        
        # 直接产业匹配
        direct_match = job_req.industry in candidate_industries
        
        if direct_match:
            return 100.0, 1.0
        
        # 计算遷移能力
        migration_score = 0.3  # 默认
        if candidate_industries:
            for cand_ind in candidate_industries:
                key = (cand_ind, job_req.industry)
                migration_score = max(migration_score, 
                                     INDUSTRY_TRANSFERABILITY.get(key, 0.3))
        
        # 產業得分 = 直接匹配度 * 50% + 遷移能力 * 50%
        industry_score = (1.0 if direct_match else migration_score) * 100
        
        return min(100.0, industry_score), migration_score
    
    def _infer_candidate_industries(self, companies: List[str]) -> List[IndustryType]:
        """从公司背景推断產業"""
        
        company_industry_map = {
            'google': IndustryType.INTERNET,
            'meta': IndustryType.INTERNET,
            'amazon': IndustryType.INTERNET,
            '騰訊': IndustryType.GAMING,
            '遊戲橘子': IndustryType.GAMING,
            '高盛': IndustryType.FINTECH,
            '銀行': IndustryType.FINTECH,
            '醫療': IndustryType.HEALTHCARE,
            '製造': IndustryType.MANUFACTURING,
        }
        
        industries = set()
        for company in companies:
            for keyword, industry in company_industry_map.items():
                if keyword.lower() in company.lower():
                    industries.add(industry)
        
        return list(industries)
    
    def _get_talent_level(self, score: float) -> TalentLevel:
        """根据综合分数获取评级"""
        
        if score >= 90:
            return TalentLevel.S
        elif score >= 85:
            return TalentLevel.A_PLUS
        elif score >= 75:
            return TalentLevel.A
        elif score >= 60:
            return TalentLevel.B
        else:
            return TalentLevel.C
    
    def _analyze_strengths_weaknesses(self, 
                                     candidate: Candidate, 
                                     job_req: JobRequirement,
                                     skill_score: float,
                                     exp_score: float,
                                     industry_score: float) -> Tuple[List[str], List[str]]:
        """分析优劣势"""
        
        strengths = []
        weaknesses = []
        
        # 优势
        if skill_score >= 80:
            strengths.append(f"技能契合度高 ({skill_score:.0f}%)")
        if exp_score >= 80:
            strengths.append(f"年资经验充分 ({exp_score:.0f}%)")
        if industry_score >= 80:
            strengths.append(f"相关产业背景深厚")
        if candidate.years_experience > job_req.years_required + 2:
            strengths.append(f"资深工程师（{candidate.years_experience}年）")
        
        # 劣势
        if skill_score < 60:
            missing_skills = [s for s in job_req.required_skills 
                            if not any(c in s.lower() for c in [sk.lower() for sk in candidate.skills])]
            if missing_skills:
                weaknesses.append(f"缺少关键技能：{', '.join(missing_skills[:2])}")
        if exp_score < 60:
            weaknesses.append(f"年资不符或稳定性低")
        if candidate.job_changes > 3:
            weaknesses.append(f"职涯跳动频繁（{candidate.job_changes}次转职）")
        if industry_score < 50:
            weaknesses.append(f"无相关产业背景，需要培训")
        
        return strengths, weaknesses
    
    def _identify_transferable_skills(self, candidate: Candidate, job_req: JobRequirement) -> List[str]:
        """识别可遷移技能"""
        
        # 基础技能（跨产业通用）
        transferable_base = ['python', 'java', 'c++', 'sql', 'git', 'docker', 'kubernetes']
        
        transferable = [s for s in candidate.skills 
                       if any(base.lower() in s.lower() for base in transferable_base)]
        
        return transferable[:5]  # 返回 Top 5

# ==================== 主程序 ====================

def main():
    """示例：评分几位候选人"""
    
    # 示例候选人
    candidates = [
        Candidate(
            name='陳宥樺',
            position='Senior Backend Engineer',
            years_experience=7,
            job_changes=2,
            avg_tenure_months=42,
            recent_gap_months=1,
            location='台北',
            skills=['Python', 'Go', 'Kubernetes', 'PostgreSQL', 'AWS'],
            company_background=['Shopee', 'LINE Taiwan', 'Google'],
            education='台灣大學 資訊工程系 碩士'
        ),
        Candidate(
            name='李明哲',
            position='Frontend Developer',
            years_experience=3,
            job_changes=1,
            avg_tenure_months=18,
            recent_gap_months=0,
            location='高雄',
            skills=['React', 'TypeScript', 'Node.js'],
            company_background=['新創公司', '中型軟體公司'],
            education='國立科技大學 資訊系 學士'
        ),
    ]
    
    # 示例职缺
    job_requirements = [
        JobRequirement(
            job_title='資安工程師',
            customer_name='遊戲橘子集團',
            industry=IndustryType.GAMING,
            years_required=2,
            required_skills=['DevOps', 'Linux', 'Security'],
            location='台北',
            nice_to_have_skills=['Kubernetes', 'AWS']
        ),
        JobRequirement(
            job_title='AI工程師',
            customer_name='AIJob內部',
            industry=IndustryType.INTERNET,
            years_required=3,
            required_skills=['Python', 'Machine Learning', 'TensorFlow'],
            location='台北',
            required_industry_experience=False
        ),
    ]
    
    # 评分
    engine = CandidateScoringEngine()
    
    print("\n" + "="*100)
    print("📊 候选人评分结果（6维评分系统）")
    print("="*100 + "\n")
    
    results = []
    for candidate in candidates:
        for job in job_requirements:
            score_result = engine.score(candidate, job)
            results.append(score_result)
            
            print(f"候选人：{candidate.name} → 职缺：{job.job_title}")
            print(f"  综合评分：{score_result.overall_score:.1f} 分 【{score_result.talent_level.value}】")
            print(f"  详细评分：")
            print(f"    • 技能匹配度：{score_result.skill_match:.1f}%")
            print(f"    • 年资符合度：{score_result.experience_fit:.1f}%")
            print(f"    • 地点适配度：{score_result.location_fit:.1f}%")
            print(f"    • 招聘意願度：{score_result.hiring_signal:.1f}%")
            print(f"    • 公司等级：{score_result.company_level:.1f}%")
            print(f"    • 产业经验：{score_result.industry_experience:.1f}%")
            print(f"  遷移能力：{score_result.migration_ability:.0%}")
            print(f"  优势：{', '.join(score_result.strengths[:2])}")
            print(f"  劣势：{', '.join(score_result.weaknesses[:2])}")
            print()
    
    # 保存结果
    output = {
        'timestamp': datetime.now().isoformat(),
        'total_scores': len(results),
        'results': [r.to_dict() for r in results]
    }
    
    with open('/tmp/scoring-results.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 评分结果已保存：/tmp/scoring-results.json")

if __name__ == '__main__':
    from datetime import datetime
    main()
