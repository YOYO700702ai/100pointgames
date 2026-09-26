# 亞德雷大陸

以 React 製作的靜態遊戲，可由 GitHub Pages 直接提供服務。

直接遊玩：[亞德雷大陸](https://yoyo700702ai.github.io/100pointgames/)。

## 修改與預覽

需要 Node.js 20 以上版本，首次設定執行 `npm ci`，之後執行：

```sh
npm run build
npm run check
npm test
npm run preview
```

開啟終端機顯示的 `http://127.0.0.1:4173`。原有 Firebase 登入、雲端存檔及教師 URL hash 設定仍使用原本的服務；本機預覽也會連到該服務，驗證畫面時請使用測試角色。

## 檔案分工

- `src/game.jsx`：遊戲資料、React 元件、玩法與存檔邏輯的維護來源。
- `src/game-utils.mjs`、`tests/`：CSV 題庫、庫存、帳號存檔檢核等共用函式與離線回歸測試。
- `src/ui.css`：介面樣式，在 Tailwind CSS 後面載入。
- `src/base.css`、`tailwind.config.cjs`：Tailwind 入口、共用樣式與必要自訂尺度。
- `src/index.template.html`：網頁標頭、Firebase importmap、載入提示。
- `src/react-shim.js`：將原遊戲使用的 React / ReactDOM 名稱接上本地套件。
- `scripts/`：編譯、靜態檢查與本機預覽。
- `index.html`、`assets/game.js`、`assets/game.css`、`assets/game.js.LEGAL.txt`、`assets/build-info.json`：建置產物，勿手改。修改來源後執行 `npm run build` 重建，發布時一起帶上。

建置會將 React 18 與遊戲 JSX 預先編譯成正式版 JavaScript，Tailwind 3 預先產生用到的 CSS；玩家端不再下載 Babel 或執行 Tailwind 編譯器。HTML 的 JS/CSS 網址附有內容雜湊，避免更新後沿用舊快取。Firebase 保留 10.11.1 CDN importmap；Google Fonts 仍由原服務提供。

Tailwind 類名需在來源中寫成完整字串，例如 `active ? 'bg-red-500' : 'bg-blue-500'`，不要用 `bg-${color}-500` 拼接。新增特殊尺度可在設定中擴充。`npm run check` 會檢查語法、引用檔案、雜湊及 Firebase 版本；桌面與手機實際操作仍應在發布前另外確認。

根目錄既有圖片維持原位置。遊戲改用 `assets/art/` 的 17 張 WebP，總大小由約 15.70 MB 降為 3.14 MB，`manifest.json` 記錄每張的來源及大小。更換美術時可用 Python 與 Pillow 執行 `python scripts/optimize-art.py` 重產，透明背景會保留；日常 `npm run build` 不需要 Python，也不會刪除這個資料夾。`admin.html`、`mobile.html` 與 `nextjs-rpg/` 是既有獨立內容，本次建置不會改寫。

## 發布

本專案原 GitHub Pages 由儲存庫根目錄提供靜態檔案；執行 build 與 check 後，審查來源與產物變更，再依使用者授權提交及推送。`node_modules/` 不發布，`package-lock.json` 應保留以重現相同依賴。
