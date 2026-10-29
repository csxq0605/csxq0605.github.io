# 訪客地圖：持續 404 時是否更換服務

研究日期：2026-10-29。需求是 GitHub Pages 個人主頁上的國家／地區來源地圖，具有公開彙總 JSON、可辨認的更新時間和穩定資料來源；不是只要第三方後台有張地圖。

## 結論

若 GoatCounter 在端點與日期對照後仍持續失敗，值得換服務，不應要求站長每天手動重跑。目前發現高度相似的未解決上游問題 [GoatCounter #925](https://github.com/arp242/goatcounter/issues/925)，以及把資料庫「找不到資料」轉成通用 404 的實作；調查細節見 [incident report](visitor-atlas-incident-2026-10-29.md)。這足以把它列為有依據的上游問題方向，但不是本站已實證的完整根因。

對這個網站，我會按以下條件選擇：

- **願意付費、希望省維護：Umami Cloud Pro 以上**最符合現有「API → 公開國家彙總 JSON → 自製地圖」結構。這是功能與整合成本上的推薦，沒有對幾家服務做長期可用性實測，不能承諾它永不故障。
- **不想付服務費、能接受來源分佈是估算值：Cloudflare Web Analytics**可列為優先試點。它支援外部託管網站，不必遷移 GitHub Pages 或修改 DNS；但抽樣與歷史聚合需要反映到地圖說明，不能宣稱是逐筆精確的長期訪客集合。
- **已經有長期運行的伺服器：自架 Umami**有 API，資料與備份由本人掌握；伺服器、資料庫、升級和監控成本也由本人承擔。此聊天的臨時雲環境不能當成生產統計伺服器。
- **Plausible Business**也能勝任，但為一個個人地圖購買 Business 計畫未必划算；若本來就需要該計畫則很合理。

## 核對過的限制

| 選項 | 自製地圖所需介面 | 服務／維護成本 | 本站適配判斷 |
| --- | --- | --- | --- |
| GoatCounter | `GET /api/v0/stats/locations` | 現有帳號已接入；需要處理這次持續 404 | 先做一次有區分力的對照診斷，不把無限重試當解法。 |
| Umami Cloud Hobby | 免費統計後台；**不含 API 存取** | 免費、六個月分析資料保存 | 不足以直接替換目前的國家資料自動匯出。 |
| Umami Cloud Pro 以上 | `GET /v1/websites/{websiteId}/metrics?type=country`；Bearer API key | 付費託管；Pro 分析資料保存兩年 | 最貼近現有架構；上線前核對目前價格、額度和帳號所選區域。 |
| 自架 Umami | 自家 `/api/websites/{websiteId}/metrics?type=country` | 軟體開源；需應用服務及 PostgreSQL、備份和升級 | 已有穩定主機時適合，不能只放到 GitHub Pages。 |
| Plausible | `POST /api/v2/query`，按 `visit:country` 分組 | 官方雲端 **Business** 計畫才含 Stats API | 功能適合，但不應推薦成免費替代。 |
| Cloudflare Web Analytics | GraphQL 查詢 Web Analytics；有 country 維度 | Web Analytics 可免費使用；仍需設定帳號、網站與 API 權限 | 有條件適合地理來源概覽；GraphQL 查詢會動態抽樣，七天後原始 beacon 資料會進一步聚合。需先用新站點驗證可查的時間範圍與 schema。 |

此表不報未驗證的每月價格，也不把免費試用當永久免費方案。尚未建立新帳號、購買方案或改動目前網站的採集服務。

## 遷移方式

1. **保留目前結果。** 封存最後成功的 `assets/data/visitor-atlas.json`，標記來源 GoatCounter 和截止時間。匯出故障不等於計數端已停止採集，不應先刪除帳號。
2. **先驗證新服務的 API。** 用實際帳號確認國家分組介面能讀取、免費／付費方案有權限、資料區域正確，再替換前端採集腳本。
3. **維持地圖資料格式。** 新匯出器仍產出 `regions[{code,name,lat,lng,visits}]`，補充 `provider`、`metric`、`period_start`、`period_end`、`updated_at`。現有主頁排版與世界地圖可以保留。
4. **區分不同計數口徑。** Umami country 維度統計的是該時段的唯一訪客；Cloudflare 查詢可能是抽樣估算。不要把不同供應商的 visitors、visits、pageviews 直接相加，或在重疊採集期間加總。
5. **設定明確切換日期。** 舊資料作為歷史快照，新服務從切換時間起計；若要合併歷史，先檢查匯出／匯入格式與去重規則。新服務不會自動補回此前訪客。
6. **驗證正常與故障兩條路徑。** 新服務正常時更新公開快照；API 失敗保留舊數字並顯示其更新時間，不能重設為 0 或把未更新的資料標成即時。

替換時需要的設定資料：Umami 是 website ID、區域與 Actions Secret 中的 API key；Cloudflare 是 Web Analytics site/account 識別碼與具所需讀取權限的 API token；Plausible 是 site ID 與 Business Stats API key。這些條件未具備前，不把切換稱為已完成。

## 來源與證據範圍

### GoatCounter

- [#925：Server returns 404](https://github.com/arp242/goatcounter/issues/925)：固定時段自動失敗、手動成功；維護者提出時區／跨日與資料庫物件假說，仍待驗證。其端點為 total，本站為 locations。
- [實際依賴 zhttp 的錯誤轉換](https://github.com/zgoat/zhttp/blob/4733969d592d0bdf299afdbe2cb21030b4b0e092/wrap.go#L70)：`sql.ErrNoRows → 404 → not found`。
- [#934：10/15 連線故障](https://github.com/arp242/goatcounter/issues/934)：已關閉的代理檔案描述符問題，與這次 404 不同，沒有把它當作本站根因。

### Umami 官方文件

固定參考版本：`umami-software/docs@c42d71c8840ea6c07c3e612ef5b74a160fd0412d`。

- [Cloud 與自架功能表](https://github.com/umami-software/docs/blob/c42d71c8840ea6c07c3e612ef5b74a160fd0412d/content/docs/cloud/index.mdx)：API 僅含於 Pro／Business／Enterprise；自架含 API。
- [Cloud FAQ](https://github.com/umami-software/docs/blob/c42d71c8840ea6c07c3e612ef5b74a160fd0412d/content/docs/cloud/faq.mdx)：Hobby 免費、資料保存期限、試用結束後付費條件。
- [API key](https://github.com/umami-software/docs/blob/c42d71c8840ea6c07c3e612ef5b74a160fd0412d/content/docs/cloud/api-key.mdx)：目前使用 `Authorization: Bearer`、`https://api.umami.is/v1`，每 key 每 15 秒 50 次。沒有套用過時的舊驗證方式。
- [常用端點](https://github.com/umami-software/docs/blob/c42d71c8840ea6c07c3e612ef5b74a160fd0412d/content/docs/api/common-endpoints.mdx)與 [country 指標](https://github.com/umami-software/docs/blob/c42d71c8840ea6c07c3e612ef5b74a160fd0412d/content/docs/api-reference/get-website-metrics.mdx)。

### Plausible 官方文件

- [Stats API](https://github.com/plausible/docs/blob/master/docs/stats-api.md)：Business 計畫、Bearer key、`POST /api/v2/query`、`visit:country`。
- [訂閱方案](https://github.com/plausible/docs/blob/master/docs/subscription-plans.md)：Business 包含 Stats API；不是免費替代。

### Cloudflare 官方文件

- [Web Analytics](https://developers.cloudflare.com/web-analytics/)與 [公開源碼](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/web-analytics/index.mdx)：可用於外部網站，不需變更 DNS 或使用代理。
- [維度](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/web-analytics/data-metrics/dimensions.mdx)：包含 country。
- [抽樣 FAQ](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/web-analytics/faq.mdx)：Dashboard 和 GraphQL 可能動態抽樣，`sampleInterval` 可揭示抽樣層級；未抽樣 beacon 資料保存七天。

上述官方文件使用允許存取的 GitHub 公開來源核對。此環境的網路政策封鎖 GoatCounter、Umami、Plausible、Cloudflare 官網與 API 直連；沒有繞過政策，也沒有把環境代理的 403 當作服務故障證據。未進行這些服務的真實帳號 API 或長期可靠性比較。
