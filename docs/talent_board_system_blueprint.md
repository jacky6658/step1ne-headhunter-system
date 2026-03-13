# AI 獵頭 CRM 人才看板系統藍圖 (Talent Board System Blueprint)

本文件整理用於在既有系統中新增 **「人才看板頁面」** 的完整設計架構。
目標是讓獵頭可以快速搜尋、管理與盤點候選人，並以 **A/B/C/D 等級 +
T1/T2/T3 人才地圖 + Hot/Warm/Cold 熱度** 進行可視化管理。

------------------------------------------------------------------------

# 一、系統設計目標

新增一個 **Talent Board（人才看板）頁面**，讓獵頭可以：

1.  搜尋某一職位時快速看到所有候選人
2.  用看板方式查看 A/B/C/D 等級
3.  同時保留人才來源 T1/T2/T3
4.  知道哪些人現在最值得跟進 (Hot/Warm/Cold)
5.  未來可以加入 AI 自動匹配與推薦

------------------------------------------------------------------------

# 二、核心概念

候選人需要三層分類：

## 1. Candidate Grade（候選人等級）

代表人才品質

-   A：高價值、可成交
-   B：不錯，值得持續經營
-   C：普通備用
-   D：暫不優先

------------------------------------------------------------------------

## 2. Source Tier（人才來源）

代表候選人來自的公司層級

-   T1：優質來源公司
-   T2：可接受來源
-   T3：延伸來源

注意：

T1/T2/T3 是 **公司層級分類，不是人選等級**

------------------------------------------------------------------------

## 3. Heat Level（熱度）

代表目前是否有轉職機會

-   Hot：近期可能轉職
-   Warm：願意了解市場
-   Cold：暫時不動

------------------------------------------------------------------------

# 三、Candidate 卡片資料結構

每個候選人卡片建議包含以下欄位：

    candidate_id
    name
    current_company
    current_title
    years_experience

    role_family
    primary_role

    skills

    grade_level (A/B/C/D)

    source_tier (T1/T2/T3)

    heat_level (Hot/Warm/Cold)

    current_salary
    expected_salary

    candidate_demand_summary

    last_contacted_at
    owner_recruiter

------------------------------------------------------------------------

# 四、Talent Board 頁面設計

## 搜尋區

可搜尋：

-   職位
-   技能
-   公司
-   候選人姓名
-   產業
-   地區

------------------------------------------------------------------------

## 篩選器

    Role
    Skill
    Grade (A/B/C/D)
    Tier (T1/T2/T3)
    Heat (Hot/Warm/Cold)
    Salary Range
    Experience
    Last Contact Time

------------------------------------------------------------------------

# 五、看板模式 (Kanban View)

建議提供多種看板模式

## 1. Grade Board

    A級 | B級 | C級 | D級

用途：快速找出高價值人才

------------------------------------------------------------------------

## 2. Source Board

    T1 | T2 | T3

用途：盤點人才來源

------------------------------------------------------------------------

## 3. Heat Board

    Hot | Warm | Cold

用途：快速跟進有機會成交的人

------------------------------------------------------------------------

## 4. Pipeline Board (進階)

    New | Contacted | Interested | Interviewing | Offer Potential

------------------------------------------------------------------------

# 六、Candidate 卡片 UI 建議

卡片顯示資訊：

    姓名
    職稱 / 公司
    年資

    3 個核心技能

    A/B/C/D
    T1/T2/T3
    Hot/Warm/Cold

    薪資
    最後聯絡時間

範例：

    王小明
    Senior DevOps Engineer @ LINE
    5.5 年

    Kubernetes / AWS / Terraform

    A級 | T1 | Hot

    140k → 170k
    最後聯絡：3/12

------------------------------------------------------------------------

# 七、Talent Map (人才地圖頁)

當搜尋某個職位時顯示市場分布

範例：

職位：DevOps

    資料庫總人數：84

    A級：12
    B級：25
    C級：33
    D級：14

    T1：23
    T2：39
    T3：22

建議圖表：

-   公司來源排行
-   技能分布
-   薪資分布
-   年資分布

------------------------------------------------------------------------

# 八、Job Matching 機制 (進階)

輸入 JD 後系統自動計算匹配度

Match Score 建議權重：

    技能匹配        35%
    年資匹配        15%
    產業匹配        10%
    薪資匹配        15%
    Candidate Demand 10%
    Heat Level      10%
    Grade Level      5%

------------------------------------------------------------------------

# 九、Interaction 跟進紀錄

每次聯絡都需要記錄

    interaction_id
    candidate_id
    interaction_type
    interaction_date
    channel
    summary
    next_action
    next_action_date
    response_level

interaction_type：

-   call
-   message
-   email
-   meeting
-   interview
-   follow_up

------------------------------------------------------------------------

# 十、AI 可擴充功能

未來可以加入

## 履歷解析

自動抽取：

-   公司
-   職稱
-   技能
-   年資

## JD 解析

自動抽取：

-   必備技能
-   年資要求
-   產業

## AI Candidate Summary

自動生成候選人摘要：

    5 年 DevOps 經驗
    T1 公司背景
    Kubernetes / AWS 技能
    期望薪資 170k
    屬於 A級 Warm 候選人

------------------------------------------------------------------------

# 十一、系統頁面結構

    Dashboard
    Candidates
    Talent Board
    Talent Map
    Jobs
    Matching
    Interactions
    Settings

------------------------------------------------------------------------

# 十二、最佳實務

1.  A/B/C/D 用於「人才品質」
2.  T1/T2/T3 用於「公司來源」
3.  Hot/Warm/Cold 用於「成交機會」
4.  看板主欄位使用 A/B/C/D
5.  T1/T2/T3 與 Heat 作為卡片 Tag

------------------------------------------------------------------------

# 核心設計原則

以「職位搜尋」為入口\
以「A/B/C/D 看板」為主視角\
以「T1/T2/T3 + Hot/Warm/Cold」為輔助標籤\
未來可加入 AI Matching
