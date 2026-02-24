#!/usr/bin/env python3
"""
批量匹配腳本 - Batch Matcher
一個職缺 vs 多個候選人的批量匹配

輸入：公司畫像 JSON + 候選人畫像陣列 JSON
輸出：批量匹配報告（JSON）
"""

import json
import argparse
import subprocess
import os
import tempfile
from typing import Dict, List

def batch_match(company_persona: Dict, candidate_personas: List[Dict]) -> List[Dict]:
    """
    批量匹配（使用 subprocess 調用 match-personas.py）
    
    Args:
        company_persona: 公司畫像
        candidate_personas: 候選人畫像列表
        
    Returns:
        匹配報告列表（按總分排序）
    """
    # 獲取當前腳本目錄
    script_dir = os.path.dirname(os.path.abspath(__file__))
    match_script = os.path.join(script_dir, 'match-personas.py')
    
    reports = []
    
    for idx, candidate_persona in enumerate(candidate_personas):
        try:
            # 創建臨時檔案
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f_candidate:
                json.dump(candidate_persona, f_candidate, ensure_ascii=False, indent=2)
                candidate_file = f_candidate.name
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f_company:
                json.dump(company_persona, f_company, ensure_ascii=False, indent=2)
                company_file = f_company.name
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f_result:
                result_file = f_result.name
            
            # 調用 match-personas.py
            cmd = [
                'python3',
                match_script,
                '--candidate', candidate_file,
                '--company', company_file,
                '--output', result_file
            ]
            
            subprocess.run(cmd, check=True, capture_output=True, text=True)
            
            # 讀取結果
            with open(result_file, 'r', encoding='utf-8') as f:
                report = json.load(f)
            
            reports.append(report)
            
            print(f"✓ {report['candidateName']} - {report['總分']}分 ({report['等級']})")
            
            # 清理臨時檔案
            os.unlink(candidate_file)
            os.unlink(company_file)
            os.unlink(result_file)
            
        except subprocess.CalledProcessError as e:
            print(f"✗ 候選人 {idx+1} - 匹配失敗: {e.stderr}")
        except Exception as e:
            print(f"✗ 候選人 {idx+1} - 匹配失敗: {e}")
    
    # 按總分排序（降序）
    reports.sort(key=lambda x: x['總分'], reverse=True)
    
    return reports


def generate_summary(reports: List[Dict]) -> Dict:
    """
    生成摘要統計
    
    Args:
        reports: 匹配報告列表
        
    Returns:
        摘要統計
    """
    total_candidates = len(reports)
    
    # 等級統計
    grade_counts = {'S': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0}
    for report in reports:
        grade = report['等級']
        grade_counts[grade] = grade_counts.get(grade, 0) + 1
    
    # Top 5 推薦
    top_5 = reports[:5]
    
    # 平均分
    avg_score = sum(r['總分'] for r in reports) / total_candidates if total_candidates > 0 else 0
    
    return {
        "total_candidates": total_candidates,
        "grade_distribution": grade_counts,
        "average_score": round(avg_score, 1),
        "top_5": [
            {
                "name": r['candidateName'],
                "total_score": r['總分'],
                "grade": r['等級'],
                "priority": r['推薦優先級']
            }
            for r in top_5
        ]
    }


def main():
    parser = argparse.ArgumentParser(description="批量匹配（一個職缺 vs 多個候選人）")
    parser.add_argument("--company", required=True, help="公司畫像 JSON 檔案")
    parser.add_argument("--candidates", required=True, help="候選人畫像陣列 JSON 檔案（不是資料夾）")
    parser.add_argument("--output", required=True, help="輸出批量匹配報告 JSON 檔案")
    
    args = parser.parse_args()
    
    print(f"🔍 開始批量匹配...")
    print(f"   公司畫像：{args.company}")
    print(f"   候選人畫像：{args.candidates}")
    print()
    
    # 讀取公司畫像
    with open(args.company, 'r', encoding='utf-8') as f:
        company_persona = json.load(f)
    
    # 讀取候選人畫像陣列
    with open(args.candidates, 'r', encoding='utf-8') as f:
        candidate_personas = json.load(f)
    
    # 執行批量匹配
    reports = batch_match(company_persona, candidate_personas)
    
    # 生成摘要
    summary = generate_summary(reports)
    
    # 組合完整報告
    batch_report = {
        "summary": summary,
        "matches": reports
    }
    
    # 輸出結果
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(batch_report, f, ensure_ascii=False, indent=2)
    
    print()
    print(f"✅ 批量匹配完成！")
    print(f"   總候選人數：{summary['total_candidates']}")
    print(f"   平均分：{summary['average_score']}")
    print(f"   等級分布：S={summary['grade_distribution']['S']}, A={summary['grade_distribution']['A']}, B={summary['grade_distribution']['B']}")
    print()
    print(f"📊 Top 5 推薦：")
    for i, candidate in enumerate(summary['top_5'], 1):
        print(f"   {i}. {candidate['name']} - {candidate['total_score']}分 ({candidate['grade']}級)")
    print()
    print(f"📄 完整報告已儲存：{args.output}")


if __name__ == "__main__":
    main()
