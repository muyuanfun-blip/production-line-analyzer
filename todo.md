# 生產工站分析系統 TODO

## 資料庫與後端 API
- [x] 建立 production_lines 資料表（生產線）
- [x] 建立 workstations 資料表（工站）
- [x] 建立 action_steps 資料表（動作步驟）
- [x] 執行資料庫遷移
- [x] 實作生產線 CRUD API（tRPC）
- [x] 實作工站 CRUD API（tRPC）
- [x] 實作動作步驟 CRUD API（tRPC）
- [x] 實作平衡分析計算 API
- [x] 實作 AI 優化建議 API
- [x] 實作 CSV/JSON 報表導出 API
- [x] 實作 Excel/CSV 批量匯入 API

## 前端框架與設計系統
- [x] 設定全域 CSS 主題（優雅深色設計）
- [x] 建立 DashboardLayout 側邊欄導航
- [x] 建立路由結構（首頁、工站管理、平衡分析、動作分析、AI建議）
- [x] 設定全域字體樣式

## 工站資料管理模組
- [x] 生產線列表頁（新增/編輯/刪除）
- [x] 工站資料輸入表單（工站名稱、工序時間、人員配置）
- [x] 工站列表與管理介面
- [x] Excel/CSV 批量匯入介面（拖曳上傳）

## 產線平衡分析與可視化
- [x] 平衡分析頁面（平衡率、瓶頃工站、效率指標）
- [x] 工站時間分佈柱狀圖（Recharts）
- [x] 平衡率儀表板卡片
- [x] 瓶頃工站高亮顯示
- [x] 動作分析記錄介面（步驟時間分配）

## AI 優化建議與報表導出
- [x] AI 分析按鈕與結果展示（Streamdown 渲染）
- [x] CSV 導出功能
- [x] JSON 導出功能
- [x] 列印/PDF 報表樣式

## 測試
- [x] 後端 API 單元測試（vitest）
- [x] 平衡計算邏輯測試

## Takt Time 功能（新增）
- [x] 確認 production_lines 資料表是否已有 targetCycleTime 欄位
- [x] 更新生產線新增/編輯表單，加入 Takt Time 輸入欄位
- [x] 在平衡分析圖表加入 Takt Time 參考線（紫色虛線）
- [x] 在工站時間柱狀圖上標示每個工站的達標/超標狀態
- [x] 在 KPI 卡片區加入 Takt Time 達標率指標
- [x] 在工站詳細分析表格加入 vs Takt Time 欄位
- [x] 更新 AI 分析 prompt 納入 Takt Time 資訊
- [x] 補強 Takt Time 相關測試

## 歷史快照比較功能（新增）
- [x] 建立 analysis_snapshots 資料表
- [x] 執行資料庫遷移（CREATE TABLE）
- [x] 實作快照 CRUD API（listByLine, getById, create, delete）
- [x] 在 BalanceAnalysis.tsx 加入「儲存快照」按鈕與 Dialog
- [x] 建立快照歷史列表頁面（SnapshotHistory.tsx）
- [x] 建立快照比較頁面（SnapshotCompare.tsx）
- [x] 工站時間對比柱狀圖（兩快照並排）
- [x] 平衡率歷史趨勢折線圖
- [x] 工站差異明細表（改善/退步/新增/移除）
- [x] KPI 對比卡片（平衡率、瓶頸時間、平均時間、Takt 達標率）
- [x] 在路由加入快照頁面路由
- [x] 補強快照比較相關測試（5 項）

## 首頁產線平衡率比較圖表（新增）
- [x] 新增後端 API：getAllLinesLatestSnapshot（取得各產線最新快照摘要）
- [x] 首頁加入產線平衡率並排比較橫條圖（Recharts）
- [x] 圖表顯示 Takt Time 達標率、瓶頸時間等輔助指標
- [x] 無快照時顯示空白提示引導用戶操作
- [x] 補強相關測試（5 項）

## 首頁歷史平衡率趨勢圖（新增）
- [x] 新增後端 API：getAllLinesSnapshotHistory（各產線所有快照的平衡率時間序列）
- [x] 首頁加入多產線歷史平衡率趨勢折線圖（Recharts LineChart，每條產線一條折線）
- [x] 圖表支援 Tooltip 顯示快照名稱、平衡率、Takt 達標率
- [x] 加入 80%/90% 基準參考線（ReferenceLine）
- [x] 無歷史資料時顯示引導空狀態
- [x] 補強相關測試（5 項）

## AI 改用 Ollama API（新增）
- [x] 設定 OLLAMA_API_KEY secret
- [x] 更新後端 AI 分析路由，改用 Ollama API（api/chat）
- [x] 確認模型名稱（預設 qwen3-coder:480b）
- [x] 測試 AI 分析功能是否正常回應（33 項測試全通過）

## 動作拆解強化功能（新增）
- [x] 確認 action_steps 資料表欄位（name, type, duration, order）
- [x] 確認後端 action_steps CRUD API 完整性
- [x] 重寫 ActionAnalysis.tsx：工站選擇後顯示動作拆解輸入介面
- [x] 每列輸入：動作名稱、類型（增値/非增値/必要浪費）、秒數
- [x] 支援新增/刪除動作列、上下移動按鈕
- [x] 即時計算：合計秒數、各類型佔比、與工站設定時間的差異
- [x] 圓餅圖即時更新（依動作類型分佈）
- [x] 工站時間自動同步（動作合計秒數可回寫至工站 cycleTime）
- [x] 補強相關測試（7 項）

## 動作拆解整合快照（新增）
- [x] 確認 analysis_snapshots.snapshotData JSON 結構
- [x] 擴充快照 snapshotData：加入各工站 actionSteps 摘要（valueAddedSec, nonValueAddedSec, necessaryWasteSec, totalStepSec, valueAddedRate）
- [x] 更新後端 snapshot.create API：建立快照時同步查詢各工站的動作拆解資料
- [x] 更新 BalanceAnalysis.tsx 儲存快照 Dialog：顯示「將同步記錄各工站動作拆解資料」提示
- [x] 更新 SnapshotCompare.tsx：新增「增值率比較」區塊（各工站增值率並排柱狀圖）
- [x] 更新 SnapshotCompare.tsx：在工站差異明細表加入增值率欄位（前後對比 + 差異箭頭）
- [x] 補強相關測試（增值率快照計算邏輯，6 項）

## 資料同步完善（新增）
- [x] 審查 WorkstationManager、ActionAnalysis、BalanceAnalysis 三頁面的資料同步缺口
- [x] 動作拆解合計秒數「同步至工站 CT」按鈕：確認 mutation invalidate 正確刷新平衡分析數據
- [x] 工站 CT 更新後，平衡分析頁面自動重新計算（確認 query invalidation 正確）
- [x] 加入工站快速批量編輯介面（表格內嵌編輯，點擊 CT/人員欄位即可編輯，Enter 儲存）
- [x] 快照儲存前加入「資料一致性提示」：顯示 CT 與動作拆解同步狀態、儀表板即時同步提示
- [x] 補強同步邏輯相關測試（46 項全通過）

## UPPH 顯示功能（新增）
- [x] 擴充 analysis_snapshots 資料表加入 upph 欄位
- [x] 執行資料庫遷移（ALTER TABLE）
- [x] 更新 snapshot.create API 計算並儲存 UPPH
- [x] 更新 snapshot.listByLine / getById / getAllLinesLatest / getAllLinesHistory 回傳 upph
- [x] BalanceAnalysis.tsx：useMemo 加入 UPPH 計算（3600 ÷ maxTime ÷ totalManpower）
- [x] BalanceAnalysis.tsx：KPI 卡片區加入 UPPH 卡片（amber 色系，凸顯 IE 績效）
- [x] BalanceAnalysis.tsx：工站詳細表格加入「人均產能」欄位（工站級 UPPH）
- [x] BalanceAnalysis.tsx：快照儲存 Dialog 加入 UPPH 預覽與傳遞
- [x] Home.tsx：chartData 加入 upph 欄位
- [x] Home.tsx：summaryStats 加入 bestUpph / avgUpph 統計
- [x] Home.tsx：摘要統計卡片加入 UPPH 最高產線卡片
- [x] Home.tsx：各產線卡片加入 UPPH 顯示
- [x] Home.tsx：CustomTooltip 加入 UPPH 欄位
- [x] Home.tsx：歷史趨勢加入 UPPH 趨勢折線圖（獨立區塊）
- [x] SnapshotCompare.tsx：KPI 對比卡片加入 UPPH 前後比較
- [x] SnapshotHistory.tsx：快照卡片加入 UPPH 顯示
- [x] 補強 UPPH 相關測試（20 項全通過）
- [x] AISuggestions.tsx：KPI 卡片加入 UPPH、導出報告（TXT/JSON）加入 UPPH

## Takt Time 計算輔助工具（新增）
- [x] ProductionLines.tsx：在目標節拍時間欄位旁加入計算機圖示按鈕
- [x] ProductionLines.tsx：實作 Popover 展開式計算工具（可用時間分鐘數 + 需求數量 → 自動計算 Takt Time）
- [x] ProductionLines.tsx：計算結果一鍵帶入目標節拍時間欄位

## KPI 公式說明 Tooltip（新增）
- [x] 建立共用 FormulaTooltip 元件（懸停顯示公式、說明、計算範例）
- [x] BalanceAnalysis.tsx：5 個 KPI 卡片數字套用 FormulaTooltip
- [x] Home.tsx：摘要統計卡片與各產線卡片數字套用 FormulaTooltip
- [x] SnapshotCompare.tsx：KPI 對比卡片數字套用 FormulaTooltip
- [x] SnapshotHistory.tsx：快照卡片 KPI 數字套用 FormulaTooltip
- [x] AISuggestions.tsx：KPI 卡片數字套用 FormulaTooltip
