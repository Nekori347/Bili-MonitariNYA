/**
 * Product-level links and identity. These are the only places a repository or
 * author address is written down — 关于 / 更新 read them, nothing else does.
 */

/** 英文名。全项目只有这一处定义，标题栏 / 关于页 / 托盘都读它。 */
export const APP_DISPLAY_NAME = "Bili-MonitariNYA";

/** 中文名，仅用于显示（标题栏可切换、关于页展示）。 */
export const APP_NAME_ZH = "Bili 监视姬";

export const APP_AUTHOR = "Nekori猫子猫_Net";

/** The author's Bilibili space — opened in the system browser. */
export const AUTHOR_BILIBILI_URL = "https://space.bilibili.com/17409970";

export const GITHUB_OWNER = "Nekori347";
export const GITHUB_OWNER_URL = `https://github.com/${GITHUB_OWNER}`;

export const GITHUB_REPO = "Bili-MonitariNYA";

/** 仓库已正式发布，关于页与下载地址直接指向真实仓库。 */
export const REPO_PUBLISHED = true;

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

/** 关于页展示的许可证名称；为空时该行隐藏。完整条文见仓库根目录的 LICENSE。 */
export const LICENSE_NAME = "GPL-3.0";
