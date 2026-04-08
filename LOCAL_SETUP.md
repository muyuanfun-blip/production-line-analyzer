# 生產工站分析系統 — 本地運行指南

## 系統需求

| 工具 | 最低版本 | 說明 |
|------|---------|------|
| Node.js | 18.x 以上 | 建議使用 LTS 版本 |
| pnpm | 8.x 以上 | `npm install -g pnpm` |
| MySQL | 8.0 以上 | 或使用 Docker（見下方） |

---

## 快速啟動（5 步驟）

### 步驟 1：安裝依賴

```bash
pnpm install
```

### 步驟 2：設定環境變數

複製範本並編輯：

```bash
cp env.local.example .env
```

用文字編輯器開啟 `.env`，至少填入以下必填項目：

```
DATABASE_URL=mysql://root:password@localhost:3306/production_line_db
JWT_SECRET=任意隨機字串（建議32字元以上）
```

### 步驟 3：建立資料庫

**方案 A：使用 Docker（推薦，最簡單）**

```bash
docker run -d \
  --name prod-line-mysql \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=production_line_db \
  -p 3306:3306 \
  mysql:8.0
```

**方案 B：使用本機 MySQL**

```sql
CREATE DATABASE production_line_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 步驟 4：執行資料庫遷移

```bash
pnpm drizzle-kit migrate
```

或手動執行 `drizzle/` 目錄下的 SQL 檔案（按編號順序）：

```bash
# 依序執行所有 .sql 遷移檔
mysql -u root -p production_line_db < drizzle/0000_giant_night_thrasher.sql
mysql -u root -p production_line_db < drizzle/0001_loud_killer_shrike.sql
mysql -u root -p production_line_db < drizzle/0002_deep_bromley.sql
mysql -u root -p production_line_db < drizzle/0003_optimal_ultragirl.sql
```

### 步驟 5：啟動開發伺服器

```bash
pnpm dev
```

瀏覽器開啟 **http://localhost:3000**

---

## 環境變數說明

建立 `.env` 檔案（參考 `env.local.example`）：

```env
# ── 必填 ──────────────────────────────────────────────────────
DATABASE_URL=mysql://root:password@localhost:3306/production_line_db
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# ── Manus OAuth（使用 Manus 帳號登入時需要）──────────────────
# 若不使用 Manus OAuth，可留空，系統仍可正常使用核心功能
VITE_APP_ID=
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im
OWNER_OPEN_ID=
OWNER_NAME=

# ── AI 分析功能（選填）────────────────────────────────────────
# 若要使用 AI 優化建議功能，需填入 Ollama API Key
OLLAMA_API_KEY=

# ── 其他選填 ──────────────────────────────────────────────────
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_URL=
VITE_APP_TITLE=生產工站分析系統
```

---

## 常用指令

```bash
# 開發模式（含熱重載）
pnpm dev

# 建置正式版本
pnpm build

# 啟動正式版本（需先 build）
pnpm start

# 執行測試
pnpm test

# 資料庫 Schema 同步（修改 drizzle/schema.ts 後執行）
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

---

## 專案結構說明

```
production_line_analyzer/
├── client/              # React 19 前端
│   └── src/
│       ├── pages/       # 頁面元件
│       ├── components/  # 共用元件
│       └── lib/         # tRPC 客戶端
├── server/              # Express + tRPC 後端
│   ├── _core/           # 框架核心（OAuth、DB 連線等）
│   ├── routers.ts       # API 路由定義
│   └── db.ts            # 資料庫查詢 Helper
├── drizzle/             # 資料庫 Schema 與遷移 SQL
├── shared/              # 前後端共用型別
└── LOCAL_SETUP.md       # 本說明文件
```

---

## 常見問題

**Q：啟動後出現 `DATABASE_URL is required` 錯誤？**
A：確認 `.env` 檔案存在且 `DATABASE_URL` 已正確填入。

**Q：資料庫連線失敗？**
A：確認 MySQL 服務已啟動，且帳號密碼與 `DATABASE_URL` 一致。

**Q：AI 分析功能無回應？**
A：AI 功能需要 `OLLAMA_API_KEY`，若無此金鑰，其他核心功能（工站管理、平衡分析、快照比較）仍可正常使用。

**Q：登入後跳轉失敗？**
A：Manus OAuth 需要在 Manus 平台上設定應用程式，本地開發可直接跳過登入，或設定 `VITE_APP_ID` 等 OAuth 相關變數。
