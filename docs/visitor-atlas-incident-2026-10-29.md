# Visitor atlas 失敗調查（2026-10-29）

## 已確認的原因與尚未確認的範圍

最新失敗發生在 `Export country totals`，日誌為：

```text
Export failed, keeping the previous file: GoatCounter answered HTTP 404: not found
Error: Process completed with exit code 1.
```

程式對 `https://csxq.goatcounter.com/api/v0/stats/locations` 發出的 GET 請求收到 404，隨即退出。它尚未執行 Git 提交；網站 Pages 部署在同時段的紀錄中成功。這是已確認的直接失敗原因。

**深入調查找到高度相似的上游問題 [#925](https://github.com/arp242/goatcounter/issues/925)**：同樣是固定時段自動執行 404，手動或其他時段成功。維護者懷疑時區／跨日導致找不到資料庫物件，但尚未確認。本次查閱時問題仍開啟。它使用 `/stats/total`，本站使用 `/stats/locations`，不能直接宣稱是同一個 bug。

進一步核對本版本依賴的 `zhttp`：`sql.ErrNoRows` 會被轉成 404，而且所有 404 的具體訊息都被改為 `not found`。因此**前一版「404 更支持路由不存在」的推斷過窄，已修正**。日誌隱去了出錯的資料庫物件；僅憑這一行，無法分辨路由不存在、資料庫查詢未找到物件或其他被包裝的 404。

已在 GitHub Actions 使用倉庫既有 Token 完成日期對照診斷：兩組早上失敗的日期範圍現在均為 200。這支持當時服務或資料可用狀態不同，尚不足以定位服務端內部根因。

## 執行紀錄

時間為 Asia/Taipei（UTC+8）。

| 執行 | 觸發與時間 | 結果與證據 |
| --- | --- | --- |
| [#1](https://github.com/csxq0605/csxq0605.github.io/actions/runs/40417870053) | 排程，10/27 07:10 | 失敗。之後的 `f86edea` 提交說明記載第一次回應為 HTTP 404，並增加了 API 錯誤訊息輸出。 |
| [#2](https://github.com/csxq0605/csxq0605.github.io/actions/runs/40443595071) | Run workflow，10/27 11:20 | 成功，執行版本 `99be7b0`；產生資料提交 `b7728d9`。 |
| [#3](https://github.com/csxq0605/csxq0605.github.io/actions/runs/40598893789) | 原始事件為 schedule；公開頁顯示 10/29 10:54 重跑 | 重跑失敗。另有 `705bec0` 資料提交於 10/28 06:59 產生，把訪客數從 2 更新成 3；不能只根據目前重跑狀態判斷原始嘗試。 |
| [#4](https://github.com/csxq0605/csxq0605.github.io/actions/runs/40786289218) | 排程，10/29 07:17 | 失敗，版本 `705bec0`；使用者提供的完整錯誤行確認為 HTTP 404 `not found`。 |

工作流程、匯出腳本和 `_data/analytics.json` 在 `99be7b0`、`b7728d9`、`705bec0` 三個版本逐位元相同。兩種觸發都使用同一個 job、同一個 `GOATCOUNTER_API_TOKEN` secret 引用，沒有依事件切換 URL、權限或程式分支。這能排除「這幾個版本的程式不同」，不能證明不同日期 secret 的實際值從未變過。

`Run workflow` 產生 `workflow_dispatch`；對既有排程點 `Re-run jobs` 仍是 `schedule`。不能把兩者視為同一種手動測試。

## 新證據：同日早上失敗、下午成功

使用者補充早上手動失敗、現在手動成功後，再核對公開紀錄：

- 10/29 07:17（UTC+8）：#4 排程失敗，`705bec0`。
- 10/29 10:54：#3 手動重跑失敗；原事件仍為 schedule，`b7728d9`。
- 10/29 14:41：[#5 手動 Run workflow 成功](https://github.com/csxq0605/csxq0605.github.io/actions/runs/40830763433)，`705bec0`。

#4 與 #5 的 commit 一致；#3 的相關匯出程式與設定也與兩者逐位元相同。結合使用者的操作描述，觸發方式本身不足以解釋成敗差異。時段、服務狀態和每次隨時鐘改變的查詢截止時間是更需要測試的因素。只有幾次樣本，不能斷言存在每天固定的故障窗口。

診斷模式新增 `replay_end`，在下午重放早上的日期參數。原起點是 `2026-10-26T00:00:00Z`，`limit=100&offset=0`；07:17 失敗對應 `end=2026-10-28T23:00:00Z`，10:54 重跑失敗對應 `end=2026-10-29T02:00:00Z`，14:41 成功對應 `end=2026-10-29T06:00:00Z`（由工作流程觸發時間與腳本取整規則推算，並非取得原始 HTTP 封包）。

- 重放早上範圍現在仍 404、當前範圍 200：更支持範圍／資料相關的差異。
- 兩者現在均 200：更支持早上的服務或資料可用狀態不同，但不能單憑一次測試排除偶發性。
- 診斷不自動縮短正式查詢範圍，不發布這些對照數據。

### 線上實測結果：10/29 15:20（UTC+8）

[診斷執行 #1](https://github.com/csxq0605/csxq0605.github.io/actions/runs/40834775623)，commit `a512c3c`，由診斷分支 push 觸發，27 秒完成。使用 GitHub 倉庫既有 `GOATCOUNTER_API_TOKEN`，只讀查詢，不修改訪客快照。

| 重放截止時間（UTC） | `/me` | locations 當前範圍 | locations 重放範圍 |
| --- | --- | --- | --- |
| `2026-10-28T23:00:00Z` | 200 | 200 | 200 |
| `2026-10-29T02:00:00Z` | 200 | 200 | 200 |

公開 job 名稱直接顯示上述狀態；probe job 成功也確認兩輪額外的提前 24 小時、完整 UTC 日與 total 對照均為 200（腳本只在所有探測都是 200 時返回成功）。

這排除了「這兩組日期參數目前必然造成 404」以及「目前 Token／端點一直失效」的解釋。早上失敗與下午成功仍可能來自暫時性服務狀態、資料物件可用性或上游跨日處理，不能只靠下午一次成功定位內部根因。此次 locations 只探測第一頁 `offset=0`，沒有重現完整分頁或早上當時的資料庫狀態。

下一個有用的樣本是在再次失敗當下執行同樣對照，尤其確認 `/me` 是否同時失敗。正式 main 排程仍未套用修補，不能宣稱原問題已修復。

## 上游程式碼交叉檢查

參考 GoatCounter 公開版本 [`c031008`](https://github.com/arp242/goatcounter/blob/c031008a8d28c85b36708824f23b28957e7ed262/handlers/api.go)：

- 第 126 行註冊 `GET /api/v0/stats/{page}`；`stats()` 接受 `locations`。
- 第 108 行的未匹配 API 路由回傳 `404, "not found"`。
- 無效 token 在 `auth()` 回傳 `401, "unknown token"`；缺少所需權限回傳 403。
- [API 測試](https://github.com/arp242/goatcounter/blob/c031008a8d28c85b36708824f23b28957e7ed262/handlers/api_test.go)分別覆蓋上述 401、403、404 行為。

此外，`handlers/handlers.go` 的 `ErrPage()` 先呼叫 `zhttp.UserError()`。`go.mod` 鎖定 `zhttp` 為 `4733969d592d`，對應 [wrap.go 第 70–82 行](https://github.com/zgoat/zhttp/blob/4733969d592d0bdf299afdbe2cb21030b4b0e092/wrap.go#L70)明確把 `sql.ErrNoRows` 轉成 404，再統一隱藏詳細內容為 `not found`。這是實際依賴版本的程式碼證據，補足只檢查 API 路由層的不足。

`HitStats.ListLocations()` 使用 `asUTCDate()`，按使用者設定時區把起訖時間轉為日期再查 `location_stats`。日期確實參與查詢，但尚未證明這段轉換就是本站失敗點。

另查了 [#934](https://github.com/arp242/goatcounter/issues/934)：10/15 的服務事故由 TLS／快取代理檔案描述符耗盡引起，維護者已調高上限並關閉問題。那是連線中斷，不能拿來解釋本站這次特定的 404。[#933](https://github.com/arp242/goatcounter/issues/933) 是公開計數器快取問題，也不同於本次 API 匯出失敗。

## 修補內容

基於線上 `705bec0`，在獨立分支 `fix/visitor-atlas-api-diagnostics` 準備：

1. 404、429、500/502/503/504 與連線錯誤最多嘗試三次。一般重試間隔 5、15 秒；429 等待上限 60 秒。401/403 立即失敗。
2. 錯誤記錄請求 URL 和回應 URL，以辨別是否發生重新導向；Token 仍遮蔽。
3. 三次 404 後，只讀檢查 `/api/v0/me`，只記錄 HTTP 狀態，不輸出帳號回應內容。
4. 永久錯誤繼續回報失敗，保留前一份地圖 JSON，沒有把失敗偽裝成成功。
5. Actions 記錄事件、嘗試次數、實際 commit 和 Python 版本，job 限時 10 分鐘。
6. `Run workflow` 增加 `diagnose` 選項。選中後只執行 `scripts/diagnose_visitor_atlas.py`，用同一 Token 比對 `/me`、locations 目前截止時間、locations 提前 24 小時、locations 上一個完整 UTC 日，以及 total 目前截止時間；不寫入或發布任何訪客資料。測試使用共同起點；若對照截止時間早於統計起點則跳過。

### 下一次紀錄如何解讀

- 重試後成功：符合短暫錯誤；仍不能單靠重試結果斷言上游內部原因。
- locations 持續 404、`/me` 為 200：認證端點可用且接受此 Token，接著檢查統計查詢、日期對照與回應 URL。
- 兩者都 404：集中檢查共用認證／資料庫物件、站點 API 路由與服務端可用性。
- `/me` 為 401 或 403：回頭核對 Token／帳號狀態；不要公開 Token。
- locations 出現 401/403：不重試，直接處理認證／權限問題。

### 日期對照如何改變決策

- 目前截止時間 404、固定歷史範圍 200：有證據支持日期／資料準備狀態相關問題，不能把歷史數字當作當前完整數字發布。
- total 正常、locations 404：國家資料匯出路徑需要單獨處理，不能說整個計數服務已停止收集。
- 所有範圍與多次獨立執行仍 404：不要無限延長重試；在維護者無法提供可行修正時遷移。

替代服務的 API 條件、費用層級與遷移步驟見 [visitor-analytics-options.md](visitor-analytics-options.md)。

## 驗證與限制

執行 `python3 -m unittest discover -s tests -p 'test_*visitor_atlas.py' -v`。共 18 項測試通過，包括日期範圍對照、不讀取認證回應內容，以及暫時 404 恢復、持續 404、連線中斷、伺服器錯誤、分頁不重複、重試上限、認證錯誤不重試、Token 與 `/me` 內容不洩漏，以及保留上一份輸出。

公開 Actions 網頁與 Git 推送可用，GitHub Actions API 在此雲環境被網路策略限制。透過獨立診斷分支的 push 事件已完成真實 API 驗證，HTTP 狀態可從公開 job 名稱核對；完整原始失敗日誌仍只有使用者提供的一行。修補與診斷已推送至 `fix/visitor-atlas-api-diagnostics`，未合併 main 或部署到正式排程。本地 18 項測試與這次線上實測是分開的證據。
