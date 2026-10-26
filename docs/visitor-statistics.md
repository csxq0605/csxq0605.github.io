# 开启访客地图

目前**没有统计任何访问**。Explore 页面的 Visitors 标签会显示“尚未开启”，示例数据只会在点击后显示，并标注为 EXAMPLE DATA。

## 原理

1. 网页加载 GoatCounter 的计数脚本，GoatCounter 只记录国家／地区等汇总信息，不保存 IP。
2. GitHub Actions 每天（北京时间凌晨 3 点）调用 GoatCounter API（`/api/v0/stats/locations`），把各国家／地区的访客数写入本站的 `assets/data/visitor-atlas.json`，只有数字变化时才提交。
3. Explore 页面从本站同一域名读取这个 JSON 并绘制地图，不依赖在大陆不稳定的 raw.githubusercontent.com。

## 开启步骤

1. 在 <https://www.goatcounter.com/> 注册，记下站点名，例如 `wangjiesu` 对应 `wangjiesu.goatcounter.com`。
2. 登录 GoatCounter，在右上角用户菜单中进入 **API**，新建一个只勾选 *Read statistics* 权限的 token。
3. 在 GitHub 仓库中进入 **Settings → Secrets and variables → Actions → New repository secret**，名称填 `GOATCOUNTER_API_TOKEN`，值填写上一步生成的 token。**不要把 token 写进代码或发到聊天中。**
4. 编辑 `_data/analytics.json`：

   ```json
   { "goatcounter_site": "wangjiesu", "start_date": "2026-11-01" }
   ```

   `start_date` 是统计起始日期，会显示在地图说明中。
5. 推送后，在 **Actions → Visitor atlas → Run workflow** 手动运行一次，之后每天自动更新。

## 说明

- 只有开启后的新访问会被记录，此前的访问无法补回。
- 计数脚本只在 GitHub Pages 的生产构建中加载；本地预览不会计数。
- 无法定位的访问会计入总数，并在地图说明中注明“无已知位置”的数量。
- 如果某次导出失败，脚本不会覆盖上一份数据，地图继续显示上次结果。
- 访客按国家／地区给地图着色；香港、澳门、台湾的访问计入中国的颜色，但在列表中单独列出。国家名称与代码校验来自 `scripts/data/country-centroids.json`（源自 mledoze/countries，ODbL 许可）。
