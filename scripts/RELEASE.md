# 发布流程（GitHub Releases + Tauri Updater）

本轮只预埋结构，**不要现在发布**。以下是最终发布时要执行的步骤。

## 0. 一次性准备：签名密钥

更新包必须用 Tauri 的 minisign 密钥签名，私钥只在本机保存、绝不提交 Git。

本仓库已经生成好一对密钥：

| 文件 | 用途 | 是否提交 |
| --- | --- | --- |
| `.tauri/biliupmonitor.key` | **私钥**，用于签名更新包 | 否（已在 `.gitignore` 中） |
| `.tauri/biliupmonitor.key.pub` | 公钥 | 公钥已经内嵌在 `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` |

> ⚠️ 请把 `.tauri/biliupmonitor.key` 备份到密码管理器 / 私密云盘。
> **私钥丢失后无法再签发可用的更新包**，只能让所有用户重新全新安装。

重新生成（仅在需要轮换密钥时）：

```bash
npx tauri signer generate -w .tauri/biliupmonitor.key -p ""
# 然后把 .tauri/biliupmonitor.key.pub 的内容填回 tauri.conf.json 的 plugins.updater.pubkey
```

## 1. 配置更新源

编辑 `src-tauri/tauri.conf.json`：

```json
"plugins": {
  "updater": {
    "endpoints": [
      "https://github.com/Nekori347/Bili-MonitariNYA/releases/latest/download/latest.json"
    ],
    "pubkey": "<公钥>"
  }
}
```

仓库地址已经填好：`Nekori347/Bili-MonitariNYA`。仓库尚未创建，创建后无需再改这里。

## 2. 提升版本号

必须**同时**修改，否则 updater 认为没有新版本：

- `package.json` → `version`
- `src-tauri/tauri.conf.json` → `version`
- `src-tauri/Cargo.toml` → `[package] version`

新增数据库字段时，在 `src-tauri/src/migrations.rs` 里**追加**一个新的 `Migration`
（v2 → v3 → …）。**绝对不要**重建数据库，否则用户的订阅 / 备注 / 设置 / 历史增长 /
B 站登录凭据都会丢失。

## 3. 构建

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat .tauri/biliupmonitor.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""

npm run tauri build
```

`createUpdaterArtifacts` 已开启，产物在 `src-tauri/target/release/bundle/nsis/`：

```
Bili-MonitariNYA_<version>_x64-setup.exe      ← 安装包（也是更新包）
Bili-MonitariNYA_<version>_x64-setup.exe.sig  ← 更新签名
```

> 当前 Tauri 版本对 NSIS 不再单独产出 `.nsis.zip`，**签名直接签在安装包上**，
> 所以 updater 的 `url` 指向 `-setup.exe`、`signature` 用它的 `.sig`。
> （旧版 Tauri 才会额外产出 `.nsis.zip`，本仓库不需要。）

## 4. 生成 latest.json

`plugins.updater.endpoints` 指向的 `latest.json` 长这样：

```json
{
  "version": "0.2.0",
  "notes": "本次更新内容…",
  "pub_date": "2026-10-01T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<Bili-MonitariNYA_0.2.0_x64-setup.exe.sig 的内容>",
      "url": "https://github.com/Nekori347/Bili-MonitariNYA/releases/download/v0.2.0/Bili-MonitariNYA_0.2.0_x64-setup.exe"
    }
  }
}
```

### 更新说明模板

`latest.json` 的 `notes` 会原样显示在 设置 → 系统 → 自动更新 → 发现新版本 里，
GitHub Release 的说明用同一份即可。复制下面这段改：

```
## 新内容
- 

## 修正
- 

## 说明
- 本次更新只替换程序文件，订阅 / 备注 / 设置 / 历史增长 / B 站登录 / 图片缓存都会保留。
```

写法要求：一条一行，直接说改了什么，不要写「优化了体验」这类空话；不写内部实现细节。

## 5. 发布

创建 tag `v<version>`，上传：

- `Bili-MonitariNYA_<version>_x64-setup.exe`（新用户安装 + 老用户更新，同一个文件）
- `Bili-MonitariNYA_<version>_x64-setup.exe.sig`（updater 校验用）
- `latest.json`

`releases/latest/download/latest.json` 会自动指向最新 release，客户端即可检查到更新。

## 6. 用户数据安全约束

更新只替换**程序安装目录**中的文件。以下数据全部位于 `%APPDATA%\com.biliupmonitor.desktop\`
与本地缓存目录，**不会被更新清空**：

- SQLite 数据库（订阅、备注、视频缓存、历史快照、设置）
- `credentials.bin`（DPAPI 加密的 B 站登录凭据）
- 头像 / Banner / 挂件 / 装扮图缓存

因此：订阅、备注、设置、历史增长、B 站登录、缓存都能跨版本保留。
