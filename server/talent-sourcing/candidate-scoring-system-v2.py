#!/usr/bin/env python3
"""
Candidate Scoring System v2 - 6维评分引擎（含产业经验维度）

评分维度（权重分配）：
1. 技能匹配度 (25%)
2. 年资符合度 (20%)
3. 地点适配度 (15%)
4. 招聘意願度 (15%)  ← 多維度求職信號偵測（v2.1 強化）
5. 公司等级 (15%)
6. 产业经验 (10%)

综合评级：S / A+ / A / B / C

v2.1 求職信號偵測維度：
  - 空檔期長度（剛離職 1-2 個月 = 最強信號）
  - LinkedIn Open to Work 文字偵測（備註/QuitReasons 中的關鍵字）
  - 離職原因語意（積極主動 vs 被動）
  - 聯絡方式完整性（email + phone + LinkedIn = 可接觸性）
  - 來源信號（推薦 > 人力銀行主動投遞 > Gmail進件 > LinkedIn > GitHub > 主動開發）
  - 任期模式（短任期 + 多次轉職 = 流動意願高）
  - GitHub 活躍度（有 GitHub URL = 持續在技術圈曝光）
  - 資料更新時間（近 14/30 天更新 = 主動維護個人頁面）
  - 平台求職關鍵字（技能列表中出現「尋職」、「open」等字）
"""

import json
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field, asdict
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
    # v2.1 新增：求職信號欄位
    email: Optional[str] = None                  # 電子郵件（可接觸性）
    phone: Optional[str] = None                  # 電話（可接觸性）
    notes: Optional[str] = None                  # 備註（含 Open to Work 文字）
    quit_reasons: Optional[str] = None           # 離職原因（語意信號）
    source: Optional[str] = None                 # 來源（推薦/LinkedIn/人力銀行等）
    updated_at: Optional[str] = None             # 最後更新時間（ISO 格式）
    last_job_tenure_months: Optional[int] = None # 最近一份工作任期（月）

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

    # v2.1 求職信號明細（每個觸發的信號及其加分）
    hiring_signal_breakdown: Dict = field(default_factory=dict)

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
            'hiring_signal_breakdown': self.hiring_signal_breakdown,
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
        signal_score, signal_breakdown = self._calc_hiring_signal(candidate)
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
            skill_score, exp_score, industry_score, signal_score, signal_breakdown
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
            transferable_skills=transferable,
            hiring_signal_breakdown=signal_breakdown,
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
    
    # ──────────────────────────────────────────────────────────────────
    # 求職信號關鍵字表（靜態，供多處使用）
    # ──────────────────────────────────────────────────────────────────
    OPEN_TO_WORK_KEYWORDS = [
        'open to work', 'opentowork', '#opentowork',
        '求職中', '找工作', '想換工作', '積極找', '主動找',
        '有意換', '考慮換', '開放機會', '有意願',
        'actively looking', 'job hunting', 'job seeking',
        '尋求機會', '尋職', '待業中', '待業',
    ]

    POSITIVE_QUIT_KEYWORDS = [
        '想換環境', '尋求成長', '想成長', '想挑戰',
        '薪資考量', '薪資', '待遇', '發展空間',
        '職涯轉型', '轉職', '新挑戰', '尋求新機會',
        '主動離職', '個人規劃', '規劃轉換',
    ]

    PASSIVE_QUIT_KEYWORDS = [
        '公司倒閉', '裁員', '資遣', '公司縮編',
        '家庭因素', '健康因素', '出國', '留學',
    ]

    # 來源 → 求職意願加分表
    SOURCE_SIGNAL_BONUS: Dict[str, int] = {
        '推薦':     15,   # 人脈推薦，通常對機會有興趣
        '人力銀行': 14,   # 在人力銀行公開求職 = 最主動
        'Gmail 進件': 12, # 主動寄履歷
        'LinkedIn': 8,    # LinkedIn 被挖角，半主動
        'GitHub':   4,    # 技術人，可能是被動
        '主動開發': 3,    # 獵頭主動挖角，被動最高
        '其他':     5,
    }

    def _calc_hiring_signal(self, candidate: Candidate) -> Tuple[float, Dict]:
        """
        招聘意願度 (15%) — 多維度求職信號偵測 v2.1

        回傳 (score, breakdown)：
          score     : 0-100 分
          breakdown : { signal_key: {'label': str, 'delta': int, 'triggered': bool} }
        """
        score = 45.0  # 基礎分（完全未知狀態）
        breakdown: Dict[str, Dict] = {}

        def add_signal(key: str, label: str, delta: int):
            nonlocal score
            score += delta
            breakdown[key] = {'label': label, 'delta': delta, 'triggered': True}

        # ── 1. 空檔期信號（最強信號，最高 +30）─────────────────────────────
        gap = candidate.recent_gap_months
        if gap == 0:
            # 在職中，被動求職
            breakdown['gap'] = {'label': '目前在職（被動求職）', 'delta': 0, 'triggered': False}
        elif 1 <= gap <= 2:
            add_signal('gap', f'剛離職 {gap} 個月（積極求職期）', +30)
        elif 3 <= gap <= 4:
            add_signal('gap', f'空檔 {gap} 個月（仍在求職窗口）', +22)
        elif 5 <= gap <= 6:
            add_signal('gap', f'空檔 {gap} 個月（求職中）', +15)
        elif 7 <= gap <= 12:
            add_signal('gap', f'空檔 {gap} 個月（長期空檔，動機待確認）', -5)
        else:
            add_signal('gap', f'空檔超過一年（可能有特殊情況）', -12)

        # ── 2. Open to Work 文字偵測（備註 + 技能欄）──────────────────────
        text_to_scan = ' '.join(filter(None, [
            candidate.notes or '',
            candidate.quit_reasons or '',
            ' '.join(candidate.skills) if candidate.skills else '',
        ])).lower()

        if any(kw in text_to_scan for kw in self.OPEN_TO_WORK_KEYWORDS):
            add_signal('open_to_work', 'Open to Work 關鍵字偵測到', +22)

        # ── 3. 離職原因語意分析 ────────────────────────────────────────────
        if candidate.quit_reasons:
            qr = candidate.quit_reasons.lower()
            if any(kw in qr for kw in self.POSITIVE_QUIT_KEYWORDS):
                add_signal('quit_reason_positive', '離職原因：積極主動（成長/薪資/挑戰）', +14)
            elif any(kw in qr for kw in self.PASSIVE_QUIT_KEYWORDS):
                add_signal('quit_reason_passive', '離職原因：被動（裁員/家庭等）', +8)
                # 被動離職仍算求職信號，只是動機不同

        # ── 4. 聯絡方式完整性（可接觸性）────────────────────────────────────
        contact_delta = 0
        contact_parts = []
        if candidate.email:
            contact_delta += 6
            contact_parts.append('Email')
        if candidate.phone:
            contact_delta += 6
            contact_parts.append('電話')
        if candidate.linkedin_url:
            contact_delta += 3
            contact_parts.append('LinkedIn')
        if candidate.github_url:
            contact_delta += 2
            contact_parts.append('GitHub')
        if contact_delta > 0:
            add_signal('contact_completeness',
                       f"聯絡方式完整（{', '.join(contact_parts)}）", contact_delta)

        # ── 5. 來源信號 ───────────────────────────────────────────────────
        if candidate.source:
            bonus = self.SOURCE_SIGNAL_BONUS.get(candidate.source, 0)
            if bonus > 0:
                add_signal('source',
                           f'來源：{candidate.source}（求職意願指標）', bonus)

        # ── 6. 最近一份工作任期短（< 12 個月，觀望型人才）─────────────────
        if candidate.last_job_tenure_months is not None:
            if 0 < candidate.last_job_tenure_months < 12:
                add_signal('short_last_tenure',
                           f'最近任期僅 {candidate.last_job_tenure_months} 個月（可能仍在觀望）', +8)

        # ── 7. 跳槽頻率模式（多次轉職 = 流動意願高）──────────────────────
        if candidate.job_changes >= 4:
            add_signal('high_mobility',
                       f'轉職 {candidate.job_changes} 次（高流動傾向）', +7)
        elif candidate.job_changes >= 3:
            add_signal('medium_mobility',
                       f'轉職 {candidate.job_changes} 次（適度流動）', +4)

        # ── 8. 個人資料近期更新（主動維護個人頁面 = 求職中）──────────────
        if candidate.updated_at:
            try:
                updated = datetime.fromisoformat(
                    candidate.updated_at.replace('Z', '+00:00')
                )
                days_since = (datetime.now(timezone.utc) - updated).days
                if days_since <= 7:
                    add_signal('profile_recency', '個人資料 7 天內更新', +12)
                elif days_since <= 14:
                    add_signal('profile_recency', '個人資料 14 天內更新', +8)
                elif days_since <= 30:
                    add_signal('profile_recency', '個人資料 30 天內更新', +5)
                # > 30 天不加分，也不扣分
            except (ValueError, TypeError):
                pass

        # ── 9. 平台關鍵字（技能欄中出現求職暗示）────────────────────────
        platform_signal_kws = [
            'seeking', 'looking for', '求職', '尋找機會',
            'open for', 'available', '可接案', '兼職'
        ]
        skills_text = ' '.join(candidate.skills).lower() if candidate.skills else ''
        if any(kw in skills_text for kw in platform_signal_kws):
            add_signal('skills_text_signal', '技能欄含求職暗示關鍵字', +10)

        final_score = round(min(100.0, max(0.0, score)), 1)
        return final_score, breakdown
    
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
                                     industry_score: float,
                                     signal_score: float = 70.0,
                                     signal_breakdown: Optional[Dict] = None) -> Tuple[List[str], List[str]]:
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

        # 求職信號優勢：若有強信號，加入亮點
        if signal_breakdown:
            triggered = [v['label'] for v in signal_breakdown.values() if v.get('triggered')]
            high_signal_keys = ['open_to_work', 'gap', 'quit_reason_positive']
            for k in high_signal_keys:
                if k in signal_breakdown and signal_breakdown[k].get('triggered'):
                    strengths.append(f"求職意願明確（{signal_breakdown[k]['label']}）")
                    break

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
        if signal_score < 50:
            weaknesses.append("求職意願不明確，建議顧問先確認")

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
            recent_gap_months=2,
            location='台北',
            skills=['Python', 'Go', 'Kubernetes', 'PostgreSQL', 'AWS'],
            company_background=['Shopee', 'LINE Taiwan', 'Google'],
            education='台灣大學 資訊工程系 碩士',
            email='chen@example.com',
            phone='0912345678',
            notes='剛離職，Open to work，希望找後端架構師職位',
            quit_reasons='想挑戰更大規模的系統架構',
            source='LinkedIn',
            updated_at=datetime.now(timezone.utc).isoformat(),
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
            education='國立科技大學 資訊系 學士',
            source='人力銀行',
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
            # 求職信號明細
            triggered = {k: v for k, v in score_result.hiring_signal_breakdown.items()
                         if v.get('triggered')}
            if triggered:
                print(f"  求職信號（{len(triggered)} 項觸發）：")
                for k, v in triggered.items():
                    sign = '+' if v['delta'] >= 0 else ''
                    print(f"    [{sign}{v['delta']:+d}] {v['label']}")
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
    main()
