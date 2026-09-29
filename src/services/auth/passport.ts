import { biliFetch } from "../bilibili/client";
import { cookiesFromHeaders, cookiesFromUrl } from "./session";

/**
 * Bilibili passport QR login.
 * Everything network-related stays in the service layer — the UI only renders
 * the returned URL as a QR code and polls for the state.
 */

const QR_GENERATE = "https://passport.bilibili.com/x/passport-login/web/qrcode/generate";
const QR_POLL = "https://passport.bilibili.com/x/passport-login/web/qrcode/poll";

export interface QrSession {
  /** URL to encode into the QR image. */
  url: string;
  /** Opaque key used when polling. */
  key: string;
}

export type QrState = "pending" | "scanned" | "expired" | "success" | "error";

export interface QrPollResult {
  state: QrState;
  /** Present when state === "success". */
  cookie?: string;
  message?: string;
}

function parse(body: string): any {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export async function generateQrSession(): Promise<QrSession> {
  const res = await biliFetch(QR_GENERATE, { params: [["source", "main-fe-header"]] });
  const json = parse(res.body);
  if (!json || json.code !== 0 || !json.data?.url || !json.data?.qrcode_key) {
    throw new Error(json?.message ? String(json.message) : "二维码获取失败，请稍后重试");
  }
  return { url: String(json.data.url), key: String(json.data.qrcode_key) };
}

export async function pollQrSession(key: string): Promise<QrPollResult> {
  const res = await biliFetch(QR_POLL, {
    params: [
      ["qrcode_key", key],
      ["source", "main-fe-header"],
    ],
    wantCookies: true,
  });

  const json = parse(res.body);
  if (!json || json.code !== 0 || !json.data) {
    return { state: "error", message: json?.message ? String(json.message) : "登录状态查询失败" };
  }

  const data = json.data;
  // 86101 未扫码 / 86090 已扫码待确认 / 86038 已过期 / 0 成功
  switch (Number(data.code)) {
    case 0: {
      let cookie = cookiesFromHeaders(res.cookies ?? []);
      if (!cookie.includes("SESSDATA")) cookie = cookiesFromUrl(String(data.url ?? ""));
      if (!cookie.includes("SESSDATA")) {
        return { state: "error", message: "登录凭据获取失败，请重试" };
      }
      return { state: "success", cookie };
    }
    case 86090:
      return { state: "scanned" };
    case 86038:
      return { state: "expired" };
    case 86101:
      return { state: "pending" };
    default:
      return { state: "error", message: String(data.message ?? "登录失败") };
  }
}
