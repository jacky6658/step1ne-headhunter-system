#!/usr/bin/env python3
"""
import-csv-data.py - 從 Google Sheets CSV export 匯入到 PostgreSQL
使用 Python requests 跳過認證問題
"""

import requests
import csv
import json
import psycopg2
from psycopg2.extras import execute_values
import os
from io import StringIO
import sys

# PostgreSQL 連線設定
DB_CONFIG = {
    'host': 'tpe1.clusters.zeabur.com',
    'port': 27883,
    'user': 'root',
    'password': 'etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q',
    'database': 'zeabur'
}

# 覆蓋為環境變數（如果有）
if os.getenv('DATABASE_URL'):
    # PostgreSQL URI 格式: postgresql://user:password@host:port/database
    from urllib.parse import urlparse
    db_url = urlparse(os.getenv('DATABASE_URL'))
    DB_CONFIG = {
        'host': db_url.hostname,
        'port': db_url.port,
        'user': db_url.username,
        'password': db_url.password,
        'database': db_url.path.lstrip('/')
    }

# Google Sheets CSV export URLs
SHEETS = {
    'candidates': {
        'sheet_id': '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q',
        'gid': '142613837',
        'name': '履歷池索引'
    },
    'jobs': {
        'sheet_id': '1QPaeOm-slNVFCeM8Q3gg3DawKjzp2tYwyfquvdHlZFE',
        'gid': '0',
        'name': '職缺管理'
    }
}

def get_csv_url(sheet_id, gid):
    """生成 Google Sheets CSV export URL"""
    return f'https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}'

def fetch_csv(sheet_id, gid, name):
    """下載 CSV 資料"""
    url = get_csv_url(sheet_id, gid)
    print(f'\n📥 下載 {name}...')
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        # 檢查是否成功
        if '<HTML>' in response.text or '<html>' in response.text:
            print(f'❌ 下載失敗：返回 HTML 頁面（可能是認證問題）')
            return None
        
        lines = response.text.strip().split('\n')
        print(f'✅ 下載成功：{len(lines)} 行（含標題）')
        return response.text
    except Exception as e:
        print(f'❌ 下載錯誤：{e}')
        return None

def parse_csv(csv_text):
    """解析 CSV 並返回行清單"""
    f = StringIO(csv_text)
    reader = csv.DictReader(f)
    rows = list(reader)
    return rows

def import_candidates(conn, rows):
    """匯入候選人資料"""
    if not rows:
        print('❌ 沒有候選人資料')
        return 0
    
    print(f'\n📊 匯入 {len(rows)} 位候選人...')
    
    cursor = conn.cursor()
    
    # 清空現有資料（如果重新匯入）
    # cursor.execute('TRUNCATE TABLE candidates_pipeline CASCADE')
    
    inserted = 0
    for i, row in enumerate(rows):
        try:
            # 構建 SQL INSERT
            sql = """
            INSERT INTO candidates_pipeline (
                id, name, email, phone, location, current_position,
                years_experience, job_changes, avg_tenure_months, 
                recent_gap_months, skills, education, source,
                work_history, leaving_reason, stability_score,
                education_details, personality, status, recruiter,
                notes, resume_url, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                email = EXCLUDED.email,
                status = EXCLUDED.status,
                updated_at = NOW();
            """
            
            # 解析技能（逗號分隔 → JSON 陣列）
            skills = row.get('技能', '').split(',') if row.get('技能') else []
            skills = [s.strip() for s in skills if s.strip()]
            
            # 生成唯一 ID（使用 name + email hash）
            candidate_id = f"{row.get('姓名', 'unknown')}_{i}".replace(' ', '_')
            
            cursor.execute(sql, (
                candidate_id,
                row.get('姓名', ''),
                row.get('Email', ''),
                row.get('電話', ''),
                row.get('地點', ''),
                row.get('目前職位', ''),
                int(row.get('總年資(年)', 0)) if row.get('總年資(年)') else 0,
                int(row.get('轉職次數', 0)) if row.get('轉職次數') else 0,
                int(row.get('平均任職(月)', 0)) if row.get('平均任職(月)') else 0,
                int(row.get('最近gap(月)', 0)) if row.get('最近gap(月)') else 0,
                json.dumps(skills),
                row.get('學歷', ''),
                row.get('來源', ''),
                row.get('工作經歷JSON', '') or '{}',
                row.get('離職原因', ''),
                int(row.get('穩定性評分', 0)) if row.get('穩定性評分') else 0,
                row.get('學歷JSON', '') or '{}',
                row.get('DISC/Big Five', '') or '{}',
                row.get('狀態', '新進'),
                row.get('獵頭顧問', 'Jacky'),
                row.get('備註', ''),
                row.get('履歷連結', '')
            ))
            inserted += 1
            
            if (i + 1) % 50 == 0:
                print(f'  ✓ 已匯入 {i + 1} 筆...')
        
        except Exception as e:
            print(f'  ⚠️  第 {i + 1} 筆錯誤：{e}')
            continue
    
    conn.commit()
    print(f'✅ 成功匯入 {inserted} 位候選人')
    cursor.close()
    return inserted

def import_jobs(conn, rows):
    """匯入職缺資料"""
    if not rows:
        print('❌ 沒有職缺資料')
        return 0
    
    print(f'\n📊 匯入 {len(rows)} 個職缺...')
    
    cursor = conn.cursor()
    
    # 清空現有資料（如果重新匯入）
    # cursor.execute('TRUNCATE TABLE jobs_pipeline CASCADE')
    
    inserted = 0
    for i, row in enumerate(rows):
        try:
            # 解析技能（逗號分隔 → JSON 陣列）
            key_skills = row.get('主要技能', '').split(',') if row.get('主要技能') else []
            key_skills = [s.strip() for s in key_skills if s.strip()]
            
            # 生成唯一 ID
            job_id = f"{row.get('職位名稱', 'unknown')}_{i}".replace(' ', '_')
            
            sql = """
            INSERT INTO jobs_pipeline (
                id, position_name, client_company, department,
                open_positions, salary_range, key_skills,
                experience_required, education_required, location,
                job_status, language_required, special_conditions,
                industry_background, team_size, key_challenges,
                attractive_points, recruitment_difficulty,
                interview_process, consultant_notes,
                created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
                position_name = EXCLUDED.position_name,
                updated_at = NOW();
            """
            
            cursor.execute(sql, (
                job_id,
                row.get('職位名稱', ''),
                row.get('客戶公司', ''),
                row.get('部門', ''),
                int(row.get('需求人數', 1)) if row.get('需求人數') else 1,
                row.get('薪資範圍', ''),
                json.dumps(key_skills),
                row.get('經驗要求', ''),
                row.get('學歷要求', ''),
                row.get('工作地點', ''),
                row.get('職位狀態', '招募中'),
                row.get('語言要求', ''),
                row.get('特殊條件', ''),
                row.get('產業背景要求', ''),
                row.get('團隊規模', ''),
                row.get('關鍵挑戰', ''),
                row.get('吸引亮點', ''),
                row.get('招募困難點', ''),
                row.get('面試流程', ''),
                row.get('顧問面談備註', '')
            ))
            inserted += 1
            
            if (i + 1) % 20 == 0:
                print(f'  ✓ 已匯入 {i + 1} 個...')
        
        except Exception as e:
            print(f'  ⚠️  第 {i + 1} 個錯誤：{e}')
            continue
    
    conn.commit()
    print(f'✅ 成功匯入 {inserted} 個職缺')
    cursor.close()
    return inserted

def main():
    print('🔄 開始從 Google Sheets 匯入資料...\n')
    
    try:
        # 連線到 PostgreSQL
        print(f'🔗 連線到 PostgreSQL ({DB_CONFIG["host"]})...')
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # 檢查表是否存在，如果不存在則建立
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS candidates_pipeline (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255),
                email VARCHAR(255),
                phone VARCHAR(20),
                location VARCHAR(100),
                current_position VARCHAR(255),
                years_experience INT,
                job_changes INT,
                avg_tenure_months INT,
                recent_gap_months INT,
                skills JSONB,
                education VARCHAR(255),
                source VARCHAR(100),
                work_history JSONB,
                leaving_reason TEXT,
                stability_score INT,
                education_details JSONB,
                personality JSONB,
                status VARCHAR(50),
                recruiter VARCHAR(100),
                notes TEXT,
                resume_url TEXT,
                created_at TIMESTAMP,
                updated_at TIMESTAMP,
                sync_to_sheets_at TIMESTAMP
            );
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS jobs_pipeline (
                id VARCHAR(50) PRIMARY KEY,
                position_name VARCHAR(255),
                client_company VARCHAR(255),
                department VARCHAR(100),
                open_positions INT,
                salary_range VARCHAR(100),
                key_skills JSONB,
                experience_required VARCHAR(100),
                education_required VARCHAR(100),
                location VARCHAR(100),
                job_status VARCHAR(50),
                language_required VARCHAR(100),
                special_conditions TEXT,
                industry_background VARCHAR(100),
                team_size VARCHAR(50),
                key_challenges TEXT,
                attractive_points TEXT,
                recruitment_difficulty TEXT,
                interview_process TEXT,
                consultant_notes TEXT,
                created_at TIMESTAMP,
                updated_at TIMESTAMP,
                sync_to_sheets_at TIMESTAMP
            );
        """)
        
        conn.commit()
        cursor.close()
        print('✅ 資料庫連線成功\n')
        
        # 下載並匯入候選人資料
        candidates_csv = fetch_csv(
            SHEETS['candidates']['sheet_id'],
            SHEETS['candidates']['gid'],
            SHEETS['candidates']['name']
        )
        
        if candidates_csv:
            rows = parse_csv(candidates_csv)
            import_candidates(conn, rows)
        
        # 下載並匯入職缺資料
        jobs_csv = fetch_csv(
            SHEETS['jobs']['sheet_id'],
            SHEETS['jobs']['gid'],
            SHEETS['jobs']['name']
        )
        
        if jobs_csv:
            rows = parse_csv(jobs_csv)
            import_jobs(conn, rows)
        
        # 驗證資料
        print('\n\n📈 匯入結果統計：')
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM candidates_pipeline')
        candidate_count = cursor.fetchone()[0]
        print(f'  候選人：{candidate_count} 位')
        
        cursor.execute('SELECT COUNT(*) FROM jobs_pipeline')
        job_count = cursor.fetchone()[0]
        print(f'  職缺：{job_count} 個')
        
        cursor.close()
        conn.close()
        
        print('\n✅ 匯入完成！')
        
    except Exception as e:
        print(f'\n❌ 匯入失敗：{e}')
        sys.exit(1)

if __name__ == '__main__':
    main()
