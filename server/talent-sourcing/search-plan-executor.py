#!/usr/bin/env python3
"""
Search Plan Executor - 完整端到端搜尋 + 评分 + 推荐流程

整合：
1. 产业识别（客户 + JD → 产业）
2. 爬蟲搜尋（GitHub + LinkedIn）
3. 候选人评分（6维）
4. 排序 & 推荐
5. 导出结果（JSON + HTML 报告）
"""

import json
import subprocess
from typing import Dict, List, Optional
from dataclasses import asdict, dataclass
from enum import Enum
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

# ==================== 导入本地模块 ====================

# 假设 unified-scraper-v4-enhanced 和 candidate-scoring-system-v2 已在同目录

class SearchLayer(Enum):
    LAYER_1 = "layer_1"
    LAYER_2 = "layer_2"

@dataclass
class ExecutionPlan:
    """执行计划"""
    timestamp: str
    total_jobs: int
    layer_1_count: int
    layer_2_count: int
    total_candidates_found: int
    total_candidates_scored: int
    top_recommendations: Dict

def execute_full_search_plan(job_file: str = '/tmp/jobs-to-search.json',
                            output_dir: str = '/tmp/search-execution') -> ExecutionPlan:
    """完整搜尋 + 评分 + 推荐流程"""
    
    print("\n" + "="*100)
    print("🚀 启动完整搜尋计划执行器")
    print("="*100 + "\n")
    
    # Step 1: 读取职缺列表
    print("📋 Step 1: 读取职缺列表...")
    try:
        with open(job_file, 'r', encoding='utf-8') as f:
            jobs_data = json.load(f)
        jobs = jobs_data.get('jobs', [])
        print(f"✅ 成功读取 {len(jobs)} 个职缺\n")
    except FileNotFoundError:
        print(f"❌ 找不到职缺文件：{job_file}")
        return None
    
    # Step 2: 分层职缺
    print("🎯 Step 2: 分层职缺...")
    layer_1_jobs = [j for j in jobs if j.get('layer') == 'layer_1']
    layer_2_jobs = [j for j in jobs if j.get('layer') == 'layer_2']
    
    print(f"  • Layer 1（P0，立即执行）：{len(layer_1_jobs)} 个")
    print(f"  • Layer 2（P1，本周执行）：{len(layer_2_jobs)} 个\n")
    
    # Step 3: 执行 Layer 1 搜尋
    print("🔍 Step 3: 执行 Layer 1 搜尋（产业感知并行爬蟲）...")
    print("  ⏳ 此操作耗时 2-3 分钟...\n")
    
    layer1_results = execute_layer_search(layer_1_jobs, layer=1)
    total_l1_candidates = sum(len(v) for v in layer1_results.values())
    print(f"✅ Layer 1 找到 {total_l1_candidates} 位候选人\n")
    
    # Step 4: 候选人评分
    print("📊 Step 4: 执行多维评分...")
    scored_candidates = score_all_candidates(layer1_results, jobs)
    print(f"✅ 完成 {len(scored_candidates)} 位候选人的 6 维评分\n")
    
    # Step 5: 生成推荐清单
    print("🎯 Step 5: 生成顶级推荐清单...")
    recommendations = generate_recommendations(scored_candidates, jobs)
    
    # Step 6: 导出报告
    print("📄 Step 6: 生成报告...")
    export_reports(recommendations, scored_candidates, output_dir)
    
    # 执行计划总结
    plan = ExecutionPlan(
        timestamp=datetime.now().isoformat(),
        total_jobs=len(jobs),
        layer_1_count=len(layer_1_jobs),
        layer_2_count=len(layer_2_jobs),
        total_candidates_found=total_l1_candidates,
        total_candidates_scored=len(scored_candidates),
        top_recommendations=recommendations
    )
    
    print_execution_summary(plan)
    
    return plan

def execute_layer_search(jobs: List[Dict], layer: int = 1) -> Dict:
    """执行单个 layer 的搜尋"""
    
    results = {}
    
    # 模拟搜尋（实际上调用 unified-scraper-v4-enhanced）
    for job in jobs:
        job_title = job.get('job_title', 'Unknown')
        industry = job.get('industry', 'unknown')
        
        print(f"  🔎 搜尋：{job_title} ({industry})...", end='', flush=True)
        
        # 模拟候选人结果
        candidates = [
            {
                'name': f'Candidate_{i}',
                'github_url': f'https://github.com/candidate{i}',
                'skills': job.get('skills', []),
                'years_experience': job.get('experience_years', 0),
                'industry_match': 0.8,
                'overall_score': 80 + i * 2,
            }
            for i in range(3, 8)
        ]
        
        results[job_title] = candidates
        print(f" ✅ ({len(candidates)} 人)")
    
    return results

def score_all_candidates(candidates_by_job: Dict, jobs: List[Dict]) -> List[Dict]:
    """对所有候选人进行评分"""
    
    scored = []
    job_map = {j['job_title']: j for j in jobs}
    
    for job_title, candidates in candidates_by_job.items():
        job = job_map.get(job_title, {})
        
        for candidate in candidates:
            # 模拟评分逻辑（实际调用 candidate-scoring-system-v2）
            score = {
                'candidate_name': candidate['name'],
                'job_title': job_title,
                'overall_score': candidate['overall_score'],
                'talent_level': get_talent_level(candidate['overall_score']),
                'skill_match': 75.0,
                'experience_fit': 80.0,
                'location_fit': 100.0,
                'hiring_signal': 70.0,
                'company_level': 80.0,
                'industry_experience': candidate['industry_match'] * 100,
                'github_url': candidate.get('github_url'),
            }
            scored.append(score)
    
    return scored

def generate_recommendations(scored: List[Dict], jobs: List[Dict]) -> Dict:
    """生成顶级推荐"""
    
    recommendations = {}
    job_map = {j['job_title']: j for j in jobs}
    
    for job_title, job_data in job_map.items():
        # 筛选该职缺的候选人
        candidates_for_job = [c for c in scored if c['job_title'] == job_title]
        
        # 按综合评分排序
        sorted_candidates = sorted(candidates_for_job, 
                                 key=lambda x: x['overall_score'], 
                                 reverse=True)
        
        # 取 Top 3
        top_3 = sorted_candidates[:3]
        
        recommendations[job_title] = {
            'customer': job_data.get('customer_name'),
            'industry': job_data.get('industry'),
            'total_found': len(candidates_for_job),
            'top_recommendations': [
                {
                    'rank': i + 1,
                    'name': c['candidate_name'],
                    'score': c['overall_score'],
                    'level': c['talent_level'],
                    'github_url': c.get('github_url'),
                    'key_strengths': [f"{c['skill_match']:.0f}% 技能匹配", 
                                     f"{c['experience_fit']:.0f}% 年资符合"]
                }
                for i, c in enumerate(top_3)
            ]
        }
    
    return recommendations

def get_talent_level(score: float) -> str:
    """评级映射"""
    if score >= 90:
        return 'S'
    elif score >= 85:
        return 'A+'
    elif score >= 75:
        return 'A'
    elif score >= 60:
        return 'B'
    else:
        return 'C'

def export_reports(recommendations: Dict, scored: List[Dict], output_dir: str):
    """导出 JSON + HTML 报告"""
    
    import os
    os.makedirs(output_dir, exist_ok=True)
    
    # JSON 报告
    json_report = {
        'timestamp': datetime.now().isoformat(),
        'summary': {
            'total_jobs': len(recommendations),
            'total_candidates_scored': len(scored),
            'average_score': sum(c['overall_score'] for c in scored) / len(scored) if scored else 0,
        },
        'recommendations': recommendations,
    }
    
    json_path = os.path.join(output_dir, 'recommendations.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(json_report, f, ensure_ascii=False, indent=2)
    
    print(f"✅ JSON 报告已保存：{json_path}")
    
    # HTML 报告
    html_content = generate_html_report(recommendations)
    html_path = os.path.join(output_dir, 'recommendations.html')
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"✅ HTML 报告已保存：{html_path}")

def generate_html_report(recommendations: Dict) -> str:
    """生成可视化 HTML 报告"""
    
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>搜尋推荐报告</title>
        <style>
            body { font-family: Arial; margin: 20px; background: #f5f5f5; }
            .header { background: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
            .job-card { background: white; margin: 20px 0; padding: 20px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .candidate { background: #ecf0f1; padding: 15px; margin: 10px 0; border-left: 4px solid #3498db; }
            .score { font-size: 24px; font-weight: bold; color: #27ae60; }
            .level { display: inline-block; padding: 5px 10px; background: #3498db; color: white; border-radius: 3px; margin-left: 10px; }
            .top1 { border-left-color: #f39c12; }
            .top2 { border-left-color: #95a5a6; }
            .top3 { border-left-color: #cd7f32; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🎯 职缺人才搜尋推荐报告</h1>
            <p>生成时间：""" + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + """</p>
        </div>
    """
    
    for job_title, job_data in recommendations.items():
        html += f"""
        <div class="job-card">
            <h2>📌 {job_title}</h2>
            <p><strong>公司：</strong>{job_data['customer']} | <strong>产业：</strong>{job_data['industry']}</p>
            <p><strong>找到人才：</strong>{job_data['total_found']} 位</p>
            <h3>顶级推荐：</h3>
        """
        
        for rec in job_data['top_recommendations']:
            top_class = f"top{rec['rank']}"
            html += f"""
            <div class="candidate {top_class}">
                <h4>#{rec['rank']} {rec['name']}</h4>
                <p>
                    <span class="score">{rec['score']:.0f}</span>
                    <span class="level">{rec['level']}</span>
                </p>
                <p>优势：{' | '.join(rec['key_strengths'])}</p>
                {f'<p><a href="{rec["github_url"]}" target="_blank">GitHub 档案</a></p>' if rec['github_url'] else ''}
            </div>
            """
        
        html += "</div>"
    
    html += """
    </body>
    </html>
    """
    
    return html

def print_execution_summary(plan: ExecutionPlan):
    """打印执行总结"""
    
    print("\n" + "="*100)
    print("✅ 搜尋计划执行完成")
    print("="*100 + "\n")
    
    print(f"📊 执行统计：")
    print(f"  • 总职缺数：{plan.total_jobs}")
    print(f"  • Layer 1（P0）：{plan.layer_1_count} 个职缺")
    print(f"  • Layer 2（P1）：{plan.layer_2_count} 个职缺")
    print(f"  • 找到候选人：{plan.total_candidates_found} 位")
    print(f"  • 已评分：{plan.total_candidates_scored} 位\n")
    
    print(f"🎯 顶级推荐（按职缺）：\n")
    
    for job_title, recs in plan.top_recommendations.items():
        print(f"  📌 {job_title}")
        for rec in recs.get('top_recommendations', [])[:2]:  # 显示 Top 2
            print(f"    #{rec['rank']} {rec['name']} - {rec['score']:.0f} 分【{rec['level']}】")
        print()

# ==================== 主程序 ====================

def main():
    """示例：执行完整搜尋计划"""
    
    # 示例职缺列表
    example_jobs = {
        'jobs': [
            {
                'job_title': '資安工程師',
                'customer_name': '遊戲橘子集團',
                'industry': 'gaming',
                'experience_years': 2,
                'skills': ['DevOps', 'Linux', 'Security'],
                'layer': 'layer_1',
                'priority': 'P0'
            },
            {
                'job_title': 'AI工程師',
                'customer_name': 'AIJob內部',
                'industry': 'internet',
                'experience_years': 3,
                'skills': ['Python', 'TensorFlow', 'ML'],
                'layer': 'layer_2',
                'priority': 'P1'
            },
        ]
    }
    
    # 保存示例文件
    with open('/tmp/jobs-to-search.json', 'w', encoding='utf-8') as f:
        json.dump(example_jobs, f, ensure_ascii=False, indent=2)
    
    # 执行
    plan = execute_full_search_plan()

if __name__ == '__main__':
    main()
