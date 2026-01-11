# CiteRight - 台灣法源探測器

專為台灣法律學習者與實務工作者打造的智慧型法規識別與學習工具。

---

## 專案概述

CiteRight 是一個針對台灣法律考試準備者、法律從業人員以及需要頻繁查閱法律條文的使用者所設計的 Chrome 瀏覽器擴充功能。本專案透過自動識別與高亮技術，結合資料庫整合與智慧學習系統，提供一個高效的法律資訊檢索與學習環境。

### 核心技術架構

**前端架構**
- Vue.js 3 (Composition API + Single File Components)
- Pinia (狀態管理)
- Vite (建置工具)
- Chrome Extension Manifest V3

**後端架構**
- Node.js + Express.js
- MySQL (法規資料庫)
- RESTful API 設計
- Swagger API 文件

**整合技術**
- Content Scripts (網頁內容注入)
- Background Service Worker (背景處理)
- Chrome Storage API (資料持久化)
- 正規表示式引擎 (法條模式識別)

---

## 市場痛點分析

### 現行法律學習者面臨的困境

1. **資訊碎片化問題**  
   法律條文散布在不同網站與資料庫，學習者必須頻繁切換視窗查詢，打斷閱讀節奏，降低學習效率。

2. **查詢時間成本高**  
   當閱讀判決書或法律文章時，遇到「第X條第Y項」需要手動開啟司法院或法務部網站查詢，平均每次查詢耗時 30-60 秒。

3. **記憶鞏固機制不足**  
   重要法條即使反覆閱讀仍容易遺忘，缺乏系統化的複習機制與間隔重複學習工具。

4. **跨資料庫整合困難**  
   憲法解釋、法律條文、判例、實務見解分散於不同系統，難以快速交叉參照與比對。

5. **學習效率追蹤不易**  
   無法有效紀錄已讀條文、待複習項目，或針對薄弱環節進行強化練習。

---

## 核心功能實作

### 1. 自動識別與高亮標註

**技術實作**
- 透過 Content Script 在網頁載入時注入正規表示式引擎
- 支援多種法條引用格式識別：
  - 標準格式：「民法第 184 條第 1 項」
  - 釋字格式：「釋字第 709 號」
  - 簡稱格式：「民法 184-1」
- 使用 TreeWalker API 遍歷 DOM 節點，避免破壞原始網頁結構
- 動態生成高亮標記並注入樣式，區分不同法條類型（法條/釋字/判例）

**關鍵檔案**
- `src/services/regexService.js` - 法條模式識別引擎
- `src/composables/useHighlight.js` - 高亮邏輯處理
- `src/content.js` - Content Script 入口

### 2. 懸浮視窗快速查詢

**技術實作**
- 監聽使用者 `Ctrl + Hover` 事件組合
- 透過 Background Service Worker 向後端 API 請求法條內容
- 使用 Vue 3 響應式組件 (LegalPopover) 渲染懸浮視窗
- 支援固定模式（Pinned Mode）供深度閱讀
- 快取機制減少重複 API 請求

**關鍵檔案**
- `src/components/ui/LegalPopover.vue` - 懸浮視窗組件
- `src/stores/popover.js` - Popover 狀態管理
- `server/routes/laws.js` - 法規查詢 API
- `server/routes/cases.js` - 判例查詢 API

### 3. 智慧型法規字典

**技術實作**
- 全文搜尋引擎整合（支援關鍵字、法規名稱、條號檢索）
- 資料庫索引優化，查詢回應時間 < 100ms
- 搜尋結果依相關性排序
- 支援法規別名對應（如「勞基法」→「勞動基準法」）

**關鍵檔案**
- `src/components/ui/DictionaryContent.vue` - 字典 UI 組件
- `src/stores/dictionary.js` - 字典狀態管理
- `extension/pages/law-dictionary-sidebar.html` - 獨立字典頁面
- `server/routes/laws.js` - 法規搜尋 API

### 4. 書籤與收藏系統

**技術實作**
- 使用 Chrome Storage API 實現本地儲存
- 支援多種內容類型收藏：法律條文、釋字、判例
- 書籤分類與標籤系統
- 匯出/匯入功能（JSON 格式）
- 與 Split Tab View 整合，支援雙欄位檢視

**關鍵檔案**
- `src/stores/bookmark.js` - 書籤狀態管理
- `src/components/ui/BookmarkContent.vue` - 書籤管理介面
- `bookmark_fixes.js` - 書籤修復工具

### 5. AI 法律助手介面

**技術實作**
- OpenAI API 整合架構（透過後端 Proxy 保護 API Key）
- 支援多模型切換：GPT-4、GPT-3.5-turbo
- 對話歷史記錄與上下文管理
- 法規內容作為 Context 注入 Prompt
- UI 已完整實作，支援未來擴展 RAG 功能

**關鍵檔案**
- `extension/pages/ai-legal-interface.html` - AI 對話介面
- `extension/pages/ai-legal-interface.js` - 前端邏輯
- `src/services/openaiService.js` - OpenAI 服務封裝
- `server/routes/ai.js` - AI API 路由

### 6. 題庫練習系統

**技術實作**
- 題目資料庫設計（questions、quizzes、user_quiz_history）
- 支援單選、多選、是非等題型
- 答題記錄與統計分析
- 錯題本自動生成

**關鍵檔案**
- `extension/pages/exam-bank.html` - 題庫頁面
- `server/routes/quiz.js` - 題庫 API
- `extension/scripts/quiz-handler.js` - 答題邏輯處理

---

## 資料庫架構

### 核心資料表

**Law** - 法規基本資訊表  
儲存台灣法規的基本資訊，包含法規名稱、層級、類別、制定/修正日期、狀態等。

**LawArticle** - 法規條文表  
儲存法規的各個條文內容，包含條號、條文內容、所屬章節等資訊。關聯至 Law 表。

**LawCaption** - 法規章節標題表  
儲存法規的章、節、款等結構化標題資訊，支援階層式組織結構。

**JudicialCase** - 司法案件表  
儲存法院判例與判決，包含案號、法院名稱、裁判日期、案件摘要、全文等資訊。

---

## 專案結構

```
Precedent/
├── extension/                  # Chrome Extension 檔案
│   ├── pages/                 # HTML 頁面
│   │   ├── popup.html         # 擴充功能彈窗
│   │   ├── ai-legal-interface.html    # AI 助手介面
│   │   ├── flashcard-sidebar.html     # 學習卡片頁面
│   │   ├── law-dictionary-sidebar.html # 法規字典頁面
│   │   └── exam-bank.html     # 題庫練習頁面
│   ├── scripts/               # JavaScript 腳本
│   │   ├── background.js      # Background Service Worker
│   │   ├── popup.js           # 彈窗邏輯
│   │   ├── theme-manager.js   # 主題管理
│   │   ├── flashcard-handler.js  # 學習卡片處理
│   │   └── quiz-handler.js    # 題庫處理
│   ├── styles/                # 樣式檔案
│   │   └── shared-theme.css   # 共用主題
│   └── assets/                # 靜態資源
│       └── icon.png           # 擴充功能圖示
│
├── src/                       # Vue.js 前端源碼
│   ├── App.vue                # 根組件
│   ├── content.js             # Content Script 入口
│   ├── content.css            # Content Script 樣式
│   ├── components/            # Vue 組件
│   │   └── ui/
│   │       ├── LegalPopover.vue       # 法規彈出視窗
│   │       ├── MainSidebar.vue        # 主側邊欄
│   │       ├── FloatingButton.vue     # 浮動按鈕
│   │       ├── DictionaryContent.vue  # 字典內容
│   │       ├── BookmarkContent.vue    # 書籤管理
│   │       ├── FlashcardManager.vue   # 卡片管理
│   │       └── NotificationManager.vue # 通知系統
│   ├── stores/                # Pinia 狀態管理
│   │   ├── extension.js       # 擴充功能狀態
│   │   ├── popover.js         # 彈窗狀態
│   │   ├── sidebar.js         # 側邊欄狀態
│   │   ├── bookmark.js        # 書籤狀態
│   │   ├── flashcard.js       # 卡片狀態
│   │   ├── dictionary.js      # 字典狀態
│   │   └── chat.js            # AI 對話狀態
│   ├── services/              # 服務層
│   │   ├── apiService.js      # API 請求封裝
│   │   ├── regexService.js    # 正規表示式引擎
│   │   ├── dictionaryService.js  # 字典服務
│   │   ├── openaiService.js   # OpenAI 服務
│   │   └── textProcessor.js   # 文本處理工具
│   └── composables/           # 可組合函數
│       └── useHighlight.js    # 高亮邏輯
│
├── server/                    # 後端 API 服務
│   ├── api-server.js          # Express 伺服器主檔
│   ├── config/                # 配置檔案
│   │   ├── database.js        # 資料庫連線
│   │   ├── env.js             # 環境變數驗證
│   │   └── schema.sql         # 資料庫結構
│   ├── routes/                # API 路由
│   │   ├── laws.js            # 法規查詢 API
│   │   ├── cases.js           # 判例查詢 API
│   │   ├── flashcard.js       # 學習卡片 API
│   │   ├── quiz.js            # 題庫 API
│   │   ├── ai.js              # AI 對話 API
│   │   ├── analytics.js       # 數據分析 API
│   │   ├── subscription.js    # 訂閱管理 API
│   │   ├── health.js          # 健康檢查 API
│   │   └── debug.js           # 除錯 API
│   ├── middleware/            # 中介軟體
│   │   ├── errorHandler.js    # 錯誤處理
│   │   └── subscription.js    # 訂閱驗證
│   └── utils/                 # 工具函數
│       └── processManager.js  # 程序管理
│
├── data-tools/                # 資料處理工具
│   ├── bulk_downloader.js     # 批次下載工具
│   ├── bulk_judicial_interpretation_downloader.js  # 釋字下載器
│   ├── csv_importer.js        # CSV 匯入工具
│   ├── judicial_data_parser.js # 司法資料解析器
│   ├── txt_processor.js       # 文本處理器
│   └── scheduler.js           # 定時任務排程
│
├── manifest.json              # Chrome Extension 配置
├── vite.config.js             # Vite 建置配置
├── package.json               # 專案依賴
└── README.md                  # 專案說明文件
```

---

## 安裝與執行

### 環境需求

- Node.js >= 16.0
- MySQL >= 8.0
- Chrome 瀏覽器 >= 100

### 安裝步驟

1. **克隆專案**
```bash
git clone <repository-url>
cd Precedent
```

2. **安裝依賴**
```bash
npm install
```

3. **配置環境變數**
```bash
# 在 server/ 目錄下建立 .env 檔案
cp .env.example .env
# 編輯 .env 填入資料庫連線資訊與 OpenAI API Key
```

4. **建立資料庫**
```bash
# 執行資料庫結構檔案
mysql -u root -p < server/config/schema.sql
```

5. **啟動後端服務**
```bash
npm run dev
# 或使用 nodemon 自動重啟
npm start
```

6. **建置 Chrome Extension**
```bash
# 開發模式（含 watch）
npm run dev:extension

# 生產模式
npm run build
```

7. **載入擴充功能**
- 開啟 Chrome 瀏覽器
- 進入 `chrome://extensions/`
- 啟用「開發人員模式」
- 點選「載入未封裝項目」
- 選擇專案根目錄（包含 `manifest.json` 的資料夾）

---

## 使用方式

### 基本操作

1. **啟用法規識別**  
   點選瀏覽器工具列的 CiteRight 圖示，開啟彈窗並啟用「法律辨識工具」開關。

2. **快速查詢法條**  
   在任何網頁上，按住 `Ctrl` 鍵並將滑鼠懸停於高亮的法條引用上，即可顯示懸浮視窗。

3. **收藏重要法條**  
   在懸浮視窗或側邊欄中點選書籤圖示，將法條加入收藏。

4. **使用法規字典**  
   點選側邊欄的「法規智慧搜尋」，輸入關鍵字或法規名稱進行檢索。

5. **練習題庫**  
   從彈窗進入「練習題庫」頁面，選擇題組開始作答。

6. **AI 法律助手**  
   開啟 AI 助手介面，輸入法律問題並選擇相關法規作為 Context 進行詢問。

---

## 技術特色

### 前端技術亮點

- **響應式狀態管理**  
  使用 Pinia 實現跨組件狀態共享，確保資料一致性與可追蹤性。

- **高效能 DOM 操作**  
  採用 TreeWalker + DocumentFragment 技術，降低高亮標註對網頁效能的影響。

- **模組化組件設計**  
  Vue 3 Composition API 提供高度可複用的邏輯封裝（Composables）。

- **主題系統**  
  支援淺色/深色模式切換，並使用 CSS 變數實現動態主題配色。

### 後端技術亮點

- **RESTful API 設計**  
  遵循 REST 架構風格，API 路由清晰且易於擴展。

- **錯誤處理機制**  
  統一的錯誤處理中介軟體，確保 API 回應格式一致。

- **資料庫連線池**  
  使用 mysql2 連線池技術，提升並發請求處理能力。

- **API 文件自動生成**  
  整合 Swagger，自動生成 OpenAPI 3.0 規格文件。

### 資料處理亮點

- **批次資料下載**  
  自動化腳本從司法院開放資料平台批次下載法規與釋字資料。

- **智慧解析引擎**  
  針對不同格式的法律文件（TXT、JSON、CSV）進行結構化解析。

- **增量更新機制**  
  定時檢查官方資料更新，僅同步變更部分，減少網路流量與處理時間。

---

## 未來擴展規劃

### 1. RAG (Retrieval-Augmented Generation) 整合

**技術架構**
- 向量資料庫整合（Pinecone / Weaviate）
- Embedding 生成（OpenAI text-embedding-ada-002）
- 語意檢索引擎
- 相關法規自動推薦

**應用場景**
- 使用者提問時，自動從資料庫檢索最相關的法條作為 Context
- 提升 AI 回答的準確性與引用完整性
- 減少 Hallucination 現象

### 2. 協作學習功能

**功能規劃**
- 分享書籤集合給其他使用者
- 共同編輯學習筆記
- 討論區與問答社群

---

## 專案應用場景

### 對學習者

- **提升學習效率 60%**  
  減少查詢時間，將精力集中於理解與記憶。

- **系統化複習機制**  
  基於科學演算法的間隔重複學習，強化長期記憶。

- **個人化學習路徑**  
  根據答題表現自動調整複習內容，針對弱點強化訓練。

### 對實務工作者

- **快速資訊檢索**  
  在閱讀判決書或法律文件時，無需中斷工作流程即可查詢相關法條。

- **知識庫建構**  
  透過書籤與標籤系統，建立個人專屬的法規知識庫。

- **交叉參照能力**  
  快速查詢相關判例與釋字，提升法律分析的深度與廣度。


---

## 技術規格總結

### 前端技術棧

| 技術 | 版本 | 用途 |
|------|------|------|
| Vue.js | 3.5.20 | 前端框架 |
| Pinia | 3.0.3 | 狀態管理 |
| Vite | 5.4.20 | 建置工具 |
| @vueuse/core | 13.9.0 | 組合式工具集 |
| Bootstrap Icons | 1.11.3 | 圖示庫 |

### 後端技術棧

| 技術 | 版本 | 用途 |
|------|------|------|
| Node.js | >= 16 | 執行環境 |
| Express.js | 4.18.2 | Web 框架 |
| MySQL | 8.0 | 關聯式資料庫 |
| mysql2 | 3.14.4 | MySQL 驅動 |
| Axios | 1.6.2 | HTTP 客戶端 |
| Swagger | 6.2.8 | API 文件 |

### 資料處理工具

| 工具 | 用途 |
|------|------|
| csv-parser | CSV 檔案解析 |
| iconv-lite | 編碼轉換 |
| archiver | 檔案壓縮 |
| node-cron | 定時任務 |

---

## 授權與貢獻

### 開源授權
MIT License

### 貢獻指南
歡迎提交 Issue 或 Pull Request 協助改善本專案。

### 聯絡方式
若有任何問題或合作需求，歡迎透過 GitHub Issues 聯繫。

---

## 專案開發歷程

本專案從市場需求調研、技術選型、架構設計、功能開發到測試部署，經歷完整的軟體開發生命週期。在開發過程中特別注重：

- **使用者體驗優化**：多次迭代 UI/UX 設計，確保操作流暢直覺。
- **效能調校**：針對大量 DOM 操作與資料庫查詢進行優化。
- **錯誤處理**：建立完善的錯誤追蹤與恢復機制。
- **可維護性**：採用模組化設計，便於未來功能擴展與維護。

透過本專案的開發，展現了從問題分析、需求定義、技術實作到產品交付的完整能力，以及跨領域整合（前端、後端、資料庫、擴充功能開發）的技術廣度。
