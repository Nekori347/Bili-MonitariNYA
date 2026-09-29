# BiliUPMonitor

Windows 桌面 Bilibili UP 主数据监控工具。轻量、常驻、Apple 风格毛玻璃界面 + B 站粉色强调。

## 功能

- 通过 UID 或 `space.bilibili.com/{mid}` 主页链接订阅多个 UP 主
- 用户名片：Banner、头像、简介、等级、大会员、认证、粉丝牌、挂件、动态装扮编号
- 关注 / 粉丝 / 获赞 / 总播放 / 投稿数
- 最近 X 条投稿（默认 20，可 10/20/30/50）
- 每条视频：封面、标题、发布时间、播放、点赞、投币、当前在线观看
- 本地排序（播放 / 点赞 / 在线 / 时间 × 正序 / 倒序）
- 日 / 周 / 月增长胶囊（基于本地历史快照计算）
- 全局 + 单 UP 主两级字段显示开关
- 日 / 夜 / 跟随系统主题，可调透明度，窗口置顶，Mica 毛玻璃

## 技术栈

Tauri 2 · React 19 · TypeScript · Vite · Tailwind CSS 4 · TanStack Query · Zustand · SQLite（Tauri SQL 插件）

## 安装

直接运行安装包 `BiliUPMonitor_*.exe`（NSIS），或从源码构建：

```bash
npm install
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/`。

> 前置：Node 18+、Rust（MSVC toolchain）、Visual Studio 2022 Build Tools（C++ 桌面开发工作负载）、WebView2。

## 使用

1. 点击左下角「＋ 添加订阅」；
2. 输入 B 站主页链接或 UID，点击添加；
3. 左侧切换 UP 主，右侧查看资料卡与最近投稿；
4. 顶部工具栏可调整排序字段与方向；
5. 设置中可开启 / 关闭任意字段、调整主题 / 透明度 / 置顶。

## 数据刷新

- 前台选中 UP：资料 15 min，视频统计 5 min，在线人数 60 s
- 后台 UP：资料 30 min，视频统计 15 min，在线人数不轮询
- Bilibili API 并发上限 4，避免风控

## Cookie（可选）

「总播放 / 获赞」等字段在匿名下可能不可用，会显示为 `—`。若需完整数据，在 设置 → 高级 中填入 B 站 Cookie（`SESSDATA=...`）。Cookie 仅保存在本地 SQLite，不上传、不打印日志。不填 Cookie 不影响核心监控功能。

## 数据保存位置

- SQLite 数据库：`%APPDATA%\com.biliupmonitor.app\biliupmonitor.db`（由 Tauri 插件自动创建并执行 migration，无需手动初始化）
- 包含：订阅列表、用户缓存、视频缓存、历史快照、应用设置

## 常见接口错误

| 提示 | 含义 | 处理 |
| --- | --- | --- |
| 风控拦截 (-352) | 投稿列表接口被风控 | 自动切换备用接口 |
| 获取资料失败 | 用户不存在或网络异常 | 检查输入 / 网络 |
| 获赞 / 总播放显示 `—` | 该字段需要登录 | 可填写 Cookie |
| 在线获取中 | 视频详情尚未返回 cid | 稍候自动补上 |

## 说明

第一版不包含登录客户端、评论区、下载、播放器、动态流、云同步等功能。
