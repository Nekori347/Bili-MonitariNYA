/**
 * Product-level links and identity. These are the only places a repository or
 * author address is written down — 关于 / 更新 read them, nothing else does.
 */

export const APP_DISPLAY_NAME = "BILI-MonitarinNya";

/** 中文名，仅用于显示（标题栏可切换、关于页展示）。 */
export const APP_NAME_ZH = "Bili监视姬";

export const APP_AUTHOR = "Nekori猫子猫_Net";

/** The author's Bilibili space — opened in the system browser. */
export const AUTHOR_BILIBILI_URL = "https://space.bilibili.com/17409970";

export const GITHUB_OWNER = "Nekori347";
export const GITHUB_OWNER_URL = `https://github.com/${GITHUB_OWNER}`;

/**
 * The repository name. The repository itself is not created yet, so the 关于
 * page shows 待正式仓库创建后填写 instead of a link that would 404 — but the
 * address is fully resolved here, ready for the release step.
 */
export const GITHUB_REPO = "BILI-MonitarinNya";

/** The repository does not exist yet; 关于 says so rather than linking to it. */
export const REPO_PUBLISHED = false;

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
export const PROJECT_URL = REPO_PUBLISHED ? GITHUB_REPO_URL : GITHUB_OWNER_URL;
export const DOWNLOAD_URL = REPO_PUBLISHED
  ? GITHUB_RELEASES_URL
  : `${GITHUB_OWNER_URL}?tab=repositories`;

/** Set once the licence is chosen; the row is hidden while it is empty. */
export const LICENSE_NAME = "";
