# BiliUPMonitor 开发说明

## 目录结构

```text
src/
  app/            App 入口、Providers
  features/       订阅 / 名片 / 视频列表 / 设置 / 窗口控件
  services/
    bilibili/     Adapter 层（endpoints / client / wbi / normalize / types）
    database/     SQLite 仓储
  queries/        TanStack Query hooks
  store/          Zustand（uiStore / settingsStore）
  utils/          format / growth / window
  types/          settings 类型
  styles/         global.css（design tokens + 毛玻璃）
src-tauri/
  src/            lib.rs（fetch_bili 命令）、migrations.rs
  capabilities/   权限声明
```

## 分层约束

- Bilibili 网络请求全部经 `services/bilibili/adapter.ts`，UI 不直接 fetch。
- 远程数据用 TanStack Query；纯 UI 状态用 Zustand；订阅 / 设置 / 快照用 SQLite。
- WBI 签名集中在 `wbi.ts`，接口 URL 集中在 `endpoints.ts`。

## 数据流

```text
UI → TanStack Query → BilibiliAdapter → fetch_bili (Rust reqwest) → Bilibili API
                                          ↘ SQLite（快照 / 订阅 / 设置）
```

## 快照与增长

- `videos.ts` 拉取详情后写入 `video_snapshots`。
- `growth.ts` 用「当前值 - 约 24h/7d/30d 前最近快照」计算增长；无历史显示「统计中」。

## 常用命令

```bash
npm run dev          # 仅前端（浏览器调试）
npm run typecheck    # TS 类型检查
npm run build        # 前端构建
npm run tauri dev    # 完整桌面调试
npm run tauri build  # Windows 打包（NSIS）
```

## 迁移

数据库 schema 由 Rust 侧 `migrations.rs` 版本化管理，首次启动自动执行，前端无需手动建表。
