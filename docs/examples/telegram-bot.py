"""
Step1ne Headhunter System - Telegram Bot 完整範例

這個範例展示獵頭顧問如何透過 Telegram Bot 使用 Step1ne 系統：
- 搜尋候選人
- 查看職缺
- AI 自動配對
- 更新候選人狀態

需要安裝：pip install python-telegram-bot requests
"""

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
import requests
import json

# ========================================
# 設定
# ========================================

TELEGRAM_TOKEN = 'YOUR_BOT_TOKEN_HERE'  # 從 @BotFather 取得
API_BASE = 'http://localhost:3001/api'
# API_BASE = 'https://backendstep1ne.zeabur.app/api'

# ========================================
# API 呼叫函數
# ========================================

def api_get(endpoint, params=None):
    """統一的 GET 請求"""
    response = requests.get(f'{API_BASE}/{endpoint}', params=params)
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"API 錯誤: {response.text}")


def api_post(endpoint, data):
    """統一的 POST 請求"""
    response = requests.post(f'{API_BASE}/{endpoint}', json=data)
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"API 錯誤: {response.text}")


# ========================================
# Bot 指令處理
# ========================================

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """開始使用 Bot"""
    user = update.effective_user
    
    welcome_text = f"""
👋 歡迎使用 Step1ne 獵頭助理，{user.first_name}！

🤖 我可以幫你：
• /search_candidates - 搜尋候選人
• /search_jobs - 搜尋職缺
• /match - AI 自動配對
• /status - 更新候選人狀態

請輸入指令開始使用！
"""
    
    await update.message.reply_text(welcome_text)


async def search_candidates(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """搜尋候選人"""
    try:
        # 取得所有候選人
        result = api_get('candidates')
        candidates = result['data']
        
        if not candidates:
            await update.message.reply_text("目前沒有候選人資料")
            return
        
        # 只顯示前 10 位
        text = f"📋 找到 {len(candidates)} 位候選人（顯示前 10 位）\n\n"
        
        for i, c in enumerate(candidates[:10], 1):
            text += f"{i}. {c['name']}\n"
            text += f"   職位：{c['position']}\n"
            text += f"   技能：{', '.join(c['skills'][:3])}\n"
            text += f"   評級：{c.get('grade', '-')} | 狀態：{c['status']}\n\n"
        
        # 建立操作按鈕
        keyboard = [
            [InlineKeyboardButton("🔍 搜尋 A 級候選人", callback_data='filter_grade_A')],
            [InlineKeyboardButton("📊 查看所有評級分布", callback_data='grade_stats')],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(text, reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"❌ 錯誤：{str(e)}")


async def search_jobs(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """搜尋職缺"""
    try:
        result = api_get('jobs', params={'status': '開放中'})
        jobs = result['data']
        
        if not jobs:
            await update.message.reply_text("目前沒有開放中的職缺")
            return
        
        text = f"💼 開放中的職缺 ({len(jobs)} 個）\n\n"
        
        for i, job in enumerate(jobs[:10], 1):
            text += f"{i}. {job['title']}\n"
            text += f"   公司：{job['company']['name']}\n"
            text += f"   地點：{job['workLocation']}\n"
            text += f"   薪資：{job['salaryRange']}\n"
            text += f"   技能：{', '.join(job['requiredSkills'][:3])}\n"
            text += f"   /match_{job['id']} - 開始配對\n\n"
        
        await update.message.reply_text(text)
        
    except Exception as e:
        await update.message.reply_text(f"❌ 錯誤：{str(e)}")


async def match_job(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """AI 配對（職缺 vs 候選人）"""
    try:
        # 解析 job_id（從 /match_job-1 中取得）
        command = update.message.text
        job_id = command.replace('/match_', '')
        
        # 取得職缺資料
        job_result = api_get(f'jobs/{job_id}')
        job = job_result['data']
        
        # 取得所有 A 級候選人
        candidates_result = api_get('candidates', params={'grade': 'A'})
        candidates = candidates_result['data']
        
        if len(candidates) < 3:
            await update.message.reply_text("候選人數量不足（需至少 3 位）")
            return
        
        await update.message.reply_text(
            f"🤖 正在配對職缺：{job['title']}\n"
            f"候選人數量：{len(candidates[:10])} 位\n"
            f"請稍候..."
        )
        
        # 執行批量配對
        match_data = {
            'job': {
                'title': job['title'],
                'department': job['department'],
                'requiredSkills': job['requiredSkills'],
                'yearsRequired': job['yearsRequired']
            },
            'company': job['company'],
            'candidateIds': [c['id'] for c in candidates[:10]]  # 取前 10 位
        }
        
        match_result = api_post('personas/batch-match', match_data)
        result = match_result['result']
        
        # 顯示配對結果
        text = f"✅ 配對完成！\n\n"
        text += f"📊 總候選人：{result['summary']['total']} 位\n"
        text += f"平均分數：{result['summary']['avgScore']:.1f}\n"
        text += f"評級分布：A級 {result['summary']['grades']['A']} 位，"
        text += f"B級 {result['summary']['grades']['B']} 位\n\n"
        text += f"🏆 Top 5 推薦：\n\n"
        
        for i, match in enumerate(result['matches'][:5], 1):
            text += f"{i}. {match['candidate']['name']}\n"
            text += f"   分數：{match['score']:.1f} ({match['grade']}級)\n"
            text += f"   亮點：{match['highlights'][0]}\n"
            text += f"   /view_{match['candidate']['id']} - 查看詳情\n\n"
        
        await update.message.reply_text(text)
        
    except Exception as e:
        await update.message.reply_text(f"❌ 配對失敗：{str(e)}")


async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """處理按鈕點擊"""
    query = update.callback_query
    await query.answer()
    
    if query.data == 'filter_grade_A':
        # 搜尋 A 級候選人
        try:
            result = api_get('candidates', params={'grade': 'A'})
            candidates = result['data']
            
            text = f"📊 A 級候選人 ({len(candidates)} 位）\n\n"
            
            for i, c in enumerate(candidates[:10], 1):
                text += f"{i}. {c['name']} - {c['position']}\n"
                text += f"   技能：{', '.join(c['skills'][:3])}\n\n"
            
            await query.edit_message_text(text)
            
        except Exception as e:
            await query.edit_message_text(f"❌ 錯誤：{str(e)}")
    
    elif query.data == 'grade_stats':
        # 顯示評級統計
        try:
            result = api_get('candidates')
            candidates = result['data']
            
            grades = {'S': 0, 'A+': 0, 'A': 0, 'B': 0, 'C': 0, '未評級': 0}
            for c in candidates:
                grade = c.get('grade', '未評級')
                grades[grade] = grades.get(grade, 0) + 1
            
            text = "📊 候選人評級分布\n\n"
            text += f"S 級：{grades['S']} 位\n"
            text += f"A+ 級：{grades['A+']} 位\n"
            text += f"A 級：{grades['A']} 位\n"
            text += f"B 級：{grades['B']} 位\n"
            text += f"C 級：{grades['C']} 位\n"
            text += f"未評級：{grades['未評級']} 位\n"
            
            await query.edit_message_text(text)
            
        except Exception as e:
            await query.edit_message_text(f"❌ 錯誤：{str(e)}")


# ========================================
# 主程式
# ========================================

def main():
    """啟動 Bot"""
    # 建立 Application
    application = Application.builder().token(TELEGRAM_TOKEN).build()
    
    # 註冊指令處理器
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("search_candidates", search_candidates))
    application.add_handler(CommandHandler("search_jobs", search_jobs))
    
    # 註冊按鈕處理器
    application.add_handler(CallbackQueryHandler(button_callback))
    
    # 啟動 Bot
    print("🤖 Step1ne Telegram Bot 已啟動...")
    application.run_polling()


if __name__ == '__main__':
    main()
