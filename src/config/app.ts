/**
 * Product-level links and identity. These are the only places a repository or
 * author address is written down — 关于 / 更新 read them, nothing else does.
 */

export const APP_DISPLAY_NAME = "Bili Monitor";

export const APP_AUTHOR = "Nekori猫子猫_Net";

/** The author's Bilibili space — opened in the system browser. */
export const AUTHOR_BILIBILI_URL = "https://space.bilibili.com/17409970";

/**
 * Project repository. Replace OWNER/REPO once the repository exists; 设置 → 关于
 * and the 手动下载 button both point here, and the Tauri updater endpoint in
 * `src-tauri/tauri.conf.json` must match.
 */
export const GITHUB_REPO_URL = "https://github.com/OWNER/REPO";

export const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases`;
export const GITHUB_RELEASES_LATEST_URL = `${GITHUB_RELEASES_URL}/latest`;

export const LICENSE_NAME = "MIT";
