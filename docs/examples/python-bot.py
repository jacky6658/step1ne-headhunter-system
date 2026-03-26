"""
Step1ne Headhunter System - Python Bot 整合範例

這個範例展示如何從 Python Bot 呼叫 Step1ne API
適用於任何 AI Bot 框架（Telegram、Discord、LINE 等）
"""

import requests
import json

# ========================================
# 設定
# ========================================

API_BASE = 'http://localhost:3001/api'  # 開發環境
# API_BASE = 'https://api-hr.step1ne.com/api'  # 正式環境

# 未來版本需要 API Key
# API_KEY = 'your_api_key_here'
# HEADERS = {'Authorization': f'Bearer {API_KEY}'}
HEADERS = {}

# ========================================
# 候選人管理
# ========================================

def search_candidates(keyword=None, status=None, grade=None):
    """
    搜尋候選人
    
    Args:
        keyword: 關鍵字（搜尋姓名、技能等）
        status: 狀態篩選（待聯繫/已聯繫/面試中等）
        grade: 評級篩選（S/A+/A/B/C）
    
    Returns:
        候選人列表
    """
    params = {}
    if status:
        params['status'] = status
    if grade:
        params['grade'] = grade
    
    response = requests.get(
        f'{API_BASE}/candidates',
        params=params,
        headers=HEADERS
    )
    
    if response.status_code == 200:
        data = response.json()
        candidates = data['data']
        
        # 客戶端過濾關鍵字（因為 API 目前不支援關鍵字搜尋）
        if keyword:
            keyword_lower = keyword.lower()
            candidates = [
                c for c in candidates
                if (keyword_lower in c['name'].lower() or
                    any(keyword_lower in skill.lower() for skill in c['skills']))
            ]
        
        return candidates
    else:
        raise Exception(f"API 錯誤: {response.text}")


def get_candidate(candidate_id):
    """取得單一候選人詳細資料"""
    response = requests.get(
        f'{API_BASE}/candidates/{candidate_id}',
        headers=HEADERS
    )
    
    if response.status_code == 200:
        return response.json()['data']
    elif response.status_code == 404:
        raise Exception('找不到候選人')
    else:
        raise Exception(f"API 錯誤: {response.text}")


def update_candidate_status(candidate_id, new_status):
    """更新候選人狀態"""
    response = requests.put(
        f'{API_BASE}/candidates/{candidate_id}',
        json={'status': new_status},
        headers=HEADERS
    )
    
    if response.status_code == 200:
        return response.json()['data']
    else:
        raise Exception(f"API 錯誤: {response.text}")


def grade_candidate(candidate_id):
    """AI 自動評級候選人"""
    response = requests.post(
        f'{API_BASE}/candidates/{candidate_id}/grade',
        headers=HEADERS
    )
    
    if response.status_code == 200:
        result = response.json()['data']
        return {
            'grade': result['grade'],
            'score': result['score'],
            'breakdown': result['breakdown']
        }
    else:
        raise Exception(f"API 錯誤: {response.text}")


# ========================================
# 職缺管理
# ========================================

def search_jobs(status=None, company=None, skills=None):
    """
    搜尋職缺
    
    Args:
        status: 狀態篩選（開放中/招募中/已關閉）
        company: 公司名稱
        skills: 技能關鍵字
    
    Returns:
        職缺列表
    """
    params = {}
    if status:
        params['status'] = status
    if company:
        params['company'] = company
    if skills:
        params['skills'] = skills
    
    response = requests.get(
        f'{API_BASE}/jobs',
        params=params,
        headers=HEADERS
    )
    
    if response.status_code == 200:
        data = response.json()
        return data['data']
    else:
        raise Exception(f"API 錯誤: {response.text}")


def get_job(job_id):
    """取得單一職缺詳細資料"""
    response = requests.get(
        f'{API_BASE}/jobs/{job_id}',
        headers=HEADERS
    )
    
    if response.status_code == 200:
        return response.json()['data']
    elif response.status_code == 404:
        raise Exception('找不到職缺')
    else:
        raise Exception(f"API 錯誤: {response.text}")


# ========================================
# AI 配對
# ========================================

def match_candidates_to_job(job_id, candidate_ids):
    """
    批量配對：一個職缺 vs 多個候選人
    
    Args:
        job_id: 職缺 ID
        candidate_ids: 候選人 ID 列表
    
    Returns:
        配對結果（已排序，分數由高到低）
    """
    # 取得職缺資料
    job = get_job(job_id)
    
    # 準備配對請求
    request_data = {
        'job': {
            'title': job['title'],
            'department': job['department'],
            'requiredSkills': job['requiredSkills'],
            'yearsRequired': job['yearsRequired']
        },
        'company': job['company'],
        'candidateIds': candidate_ids
    }
    
    # 執行批量配對
    response = requests.post(
        f'{API_BASE}/personas/batch-match',
        json=request_data,
        headers=HEADERS
    )
    
    if response.status_code == 200:
        result = response.json()
        return result['result']
    else:
        raise Exception(f"配對失敗: {response.text}")


def match_single_candidate(candidate_id, job_id):
    """
    單一配對：一個候選人 vs 一個職缺
    
    Returns:
        配對分數、評級、建議
    """
    job = get_job(job_id)
    
    request_data = {
        'candidateId': candidate_id,
        'job': {
            'title': job['title'],
            'requiredSkills': job['requiredSkills'],
            'yearsRequired': job['yearsRequired']
        },
        'company': job['company']
    }
    
    response = requests.post(
        f'{API_BASE}/personas/full-match',
        json=request_data,
        headers=HEADERS
    )
    
    if response.status_code == 200:
        result = response.json()
        return result['matchResult']
    else:
        raise Exception(f"配對失敗: {response.text}")


# ========================================
# 使用範例
# ========================================

if __name__ == '__main__':
    print("🤖 Step1ne API 測試\n")
    
    # 範例 1：搜尋 A 級候選人
    print("📋 搜尋 A 級候選人...")
    candidates = search_candidates(grade='A')
    print(f"找到 {len(candidates)} 位 A 級候選人")
    if candidates:
        print(f"  - {candidates[0]['name']} ({candidates[0]['position']})")
    print()
    
    # 範例 2：搜尋開放中的職缺
    print("💼 搜尋開放中的職缺...")
    jobs = search_jobs(status='開放中')
    print(f"找到 {len(jobs)} 個開放中的職缺")
    if jobs:
        print(f"  - {jobs[0]['title']} ({jobs[0]['company']['name']})")
    print()
    
    # 範例 3：AI 配對（職缺 vs 候選人）
    if jobs and candidates:
        print("🤖 執行 AI 配對...")
        job_id = jobs[0]['id']
        candidate_ids = [c['id'] for c in candidates[:5]]  # 取前 5 位
        
        result = match_candidates_to_job(job_id, candidate_ids)
        
        summary = result.get('summary', {})
        print(f"\n配對結果：{summary.get('total_candidates', 0)} 位候選人")
        print(f"平均分數：{summary.get('average_score', 0):.1f}")
        print(f"評級分布：{summary.get('grade_distribution', {})}")
        
        print("\nTop 3 推薦：")
        for i, match in enumerate(result.get('matches', [])[:3], 1):
            candidate_name = match.get('candidateName', '未知')
            total_score = match.get('總分', 0)
            grade = match.get('等級', '-')
            highlights = match.get('適配亮點', [])
            highlight = highlights[0] if highlights else '無'
            
            print(f"{i}. {candidate_name} - {total_score:.1f}分 ({grade}級)")
            print(f"   亮點：{highlight}")
    
    print("\n✅ 測試完成！")
