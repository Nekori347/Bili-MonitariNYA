/**
 * Product-level links and identity. These are the only places a repository or
 * author address is written down — 关于 / 更新 read them, nothing else does.
 */

export const APP_DISPLAY_NAME = "Bili Monitor";

export const APP_AUTHOR = "Nekori猫子猫_Net";

/** The author's Bilibili space — opened in the system browser. */
export const AUTHOR_BILIBILI_URL = "https://space.bilibili.com/17409970";

export const GITHUB_OWNER = "Nekori347";
export const GITHUB_OWNER_URL = `https://github.com/${GITHUB_OWNER}`;

/**
 * The repository name is still undecided. While it is empty every place that
 * would link to it hides itself, so the shipped UI never shows a dead
 * `OWNER/REPO` address. Fill this in (and the updater endpoint in
 * `src-tauri/tauri.conf.json`) at release time.
 */
export const GITHUB_REPO = "";

export const GITHUB_REPO_URL = GITHUB_REPO
  ? `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`
  : "";

export const GITHUB_RELEASES_URL = GITHUB_REPO_URL ? `${GITHUB_REPO_URL}/releases` : "";

/** True once a real repository has been configured. */
export const HAS_REPO = GITHUB_REPO_URL.length > 0;

/**
 * Addresses shown in the UI.
 *
 * While the repository name is still open these resolve to the author's GitHub
 * rather than an `OWNER/REPO` placeholder — the entries are present and every
 * link works; naming the repository is the only thing left to do, and both
 * switch over automatically once `GITHUB_REPO` is filled in.
 */
export const PROJECT_URL = HAS_REPO ? GITHUB_REPO_URL : GITHUB_OWNER_URL;
export const DOWNLOAD_URL = HAS_REPO
  ? GITHUB_RELEASES_URL
  : `${GITHUB_OWNER_URL}?tab=repositories`;

/** Set once the licence is chosen; the row is hidden while it is empty. */
export const LICENSE_NAME = "";
