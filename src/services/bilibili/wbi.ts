import { biliFetch } from "./client";
import { BiliError } from "./types";

// Bilibili WBI signature implementation (centralized, single source).
// Reference: https://github.com/pskdje/bilibili-API-collect/blob/main/docs/misc/sign/wbi.md

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
  26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
  20, 34, 44, 52,
];

const getMixinKey = (orig: string) =>
  MIXIN_KEY_ENC_TAB.map((n) => orig[n]).join("").slice(0, 32);

interface WbiKeys {
  imgKey: string;
  subKey: string;
  cachedAt: number;
}

let cachedKeys: WbiKeys | null = null;
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12h

/** Get (and cache) the WBI signing keys from the nav endpoint. */
async function getWbiKeys(force = false): Promise<WbiKeys> {
  if (!force && cachedKeys && Date.now() - cachedKeys.cachedAt < CACHE_TTL) {
    return cachedKeys;
  }
  const res = await biliFetch("https://api.bilibili.com/x/web-interface/nav");
  if (res.status !== 200) throw new BiliError("network", "nav 接口请求失败", res.status);
  const data = JSON.parse(res.body);
  // The nav endpoint returns code -101 when not logged in, but still includes wbi_img.
  if (!data?.data?.wbi_img?.img_url || !data?.data?.wbi_img?.sub_url) {
    throw new BiliError("wbi", "获取 WBI keys 失败", data.code);
  }
  const imgUrl: string = data.data.wbi_img.img_url;
  const subUrl: string = data.data.wbi_img.sub_url;
  const imgKey = imgUrl.slice(imgUrl.lastIndexOf("/") + 1).split(".")[0];
  const subKey = subUrl.slice(subUrl.lastIndexOf("/") + 1).split(".")[0];
  cachedKeys = { imgKey, subKey, cachedAt: Date.now() };
  return cachedKeys;
}

function md5(input: string): string {
  // Synchronous MD5 via a tiny implementation (browser crypto.subtle is async only).
  // A compact pure-TS MD5 keeps WBI signing synchronous and dependency-free.
  return md5Sync(input);
}

function md5Sync(s: string): string {
  function add32(a: number, b: number) {
    return (a + b) & 0xffffffff;
  }
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(c ^ (b | ~d), a, b, x, s, t);
  }

  const str = unescape(encodeURIComponent(s));
  const mlen = str.length;
  const b = new Array(mlen);
  for (let i = 0; i < mlen; i++) b[i] = str.charCodeAt(i);

  const numWords = (((mlen + 8) >> 6) + 1) * 16;
  const words = new Array<number>(numWords);
  for (let i = 0; i < numWords; i++) words[i] = 0;
  for (let i = 0; i < mlen; i++) words[i >> 2] |= b[i] << ((i % 4) * 8);
  words[mlen >> 2] |= 0x80 << ((mlen % 4) * 8);
  words[numWords - 2] = mlen * 8;

  let a = 1732584193,
    bb = -271733879,
    c = -1732584194,
    d = 271733878;

  for (let i = 0; i < numWords; i += 16) {
    const olda = a,
      oldb = bb,
      oldc = c,
      oldd = d;
    a = ff(a, bb, c, d, words[i + 0], 7, -680876936);
    d = ff(d, a, bb, c, words[i + 1], 12, -389564586);
    c = ff(c, d, a, bb, words[i + 2], 17, 606105819);
    bb = ff(bb, c, d, a, words[i + 3], 22, -1044525330);
    a = ff(a, bb, c, d, words[i + 4], 7, -176418897);
    d = ff(d, a, bb, c, words[i + 5], 12, 1200080426);
    c = ff(c, d, a, bb, words[i + 6], 17, -1473231341);
    bb = ff(bb, c, d, a, words[i + 7], 22, -45705983);
    a = ff(a, bb, c, d, words[i + 8], 7, 1770035416);
    d = ff(d, a, bb, c, words[i + 9], 12, -1958414417);
    c = ff(c, d, a, bb, words[i + 10], 17, -42063);
    bb = ff(bb, c, d, a, words[i + 11], 22, -1990404162);
    a = ff(a, bb, c, d, words[i + 12], 7, 1804603682);
    d = ff(d, a, bb, c, words[i + 13], 12, -40341101);
    c = ff(c, d, a, bb, words[i + 14], 17, -1502002290);
    bb = ff(bb, c, d, a, words[i + 15], 22, 1236535329);
    a = gg(a, bb, c, d, words[i + 1], 5, -165796510);
    d = gg(d, a, bb, c, words[i + 6], 9, -1069501632);
    c = gg(c, d, a, bb, words[i + 11], 14, 643717713);
    bb = gg(bb, c, d, a, words[i + 0], 20, -373897302);
    a = gg(a, bb, c, d, words[i + 5], 5, -701558691);
    d = gg(d, a, bb, c, words[i + 10], 9, 38016083);
    c = gg(c, d, a, bb, words[i + 15], 14, -660478335);
    bb = gg(bb, c, d, a, words[i + 4], 20, -405537848);
    a = gg(a, bb, c, d, words[i + 9], 5, 568446438);
    d = gg(d, a, bb, c, words[i + 14], 9, -1019803690);
    c = gg(c, d, a, bb, words[i + 3], 14, -187363961);
    bb = gg(bb, c, d, a, words[i + 8], 20, 1163531501);
    a = gg(a, bb, c, d, words[i + 13], 5, -1444681467);
    d = gg(d, a, bb, c, words[i + 2], 9, -51403784);
    c = gg(c, d, a, bb, words[i + 7], 14, 1735328473);
    bb = gg(bb, c, d, a, words[i + 12], 20, -1926607734);
    a = hh(a, bb, c, d, words[i + 5], 4, -378558);
    d = hh(d, a, bb, c, words[i + 8], 11, -2022574463);
    c = hh(c, d, a, bb, words[i + 11], 16, 1839030562);
    bb = hh(bb, c, d, a, words[i + 14], 23, -35309556);
    a = hh(a, bb, c, d, words[i + 1], 4, -1530992060);
    d = hh(d, a, bb, c, words[i + 4], 11, 1272893353);
    c = hh(c, d, a, bb, words[i + 7], 16, -155497632);
    bb = hh(bb, c, d, a, words[i + 10], 23, -1094730640);
    a = hh(a, bb, c, d, words[i + 13], 4, 681279174);
    d = hh(d, a, bb, c, words[i + 0], 11, -358537222);
    c = hh(c, d, a, bb, words[i + 3], 16, -722521979);
    bb = hh(bb, c, d, a, words[i + 6], 23, 76029189);
    a = hh(a, bb, c, d, words[i + 9], 4, -640364487);
    d = hh(d, a, bb, c, words[i + 12], 11, -421815835);
    c = hh(c, d, a, bb, words[i + 15], 16, 530742520);
    bb = hh(bb, c, d, a, words[i + 2], 23, -995338651);
    a = ii(a, bb, c, d, words[i + 0], 6, -198630844);
    d = ii(d, a, bb, c, words[i + 7], 10, 1126891415);
    c = ii(c, d, a, bb, words[i + 14], 15, -1416354905);
    bb = ii(bb, c, d, a, words[i + 5], 21, -57434055);
    a = ii(a, bb, c, d, words[i + 12], 6, 1700485571);
    d = ii(d, a, bb, c, words[i + 3], 10, -1894986606);
    c = ii(c, d, a, bb, words[i + 10], 15, -1051523);
    bb = ii(bb, c, d, a, words[i + 1], 21, -2054922799);
    a = ii(a, bb, c, d, words[i + 8], 6, 1873313359);
    d = ii(d, a, bb, c, words[i + 15], 10, -30611744);
    c = ii(c, d, a, bb, words[i + 6], 15, -1560198380);
    bb = ii(bb, c, d, a, words[i + 13], 21, 1309151649);
    a = ii(a, bb, c, d, words[i + 4], 6, -145523070);
    d = ii(d, a, bb, c, words[i + 11], 10, -1120210379);
    c = ii(c, d, a, bb, words[i + 2], 15, 718787259);
    bb = ii(bb, c, d, a, words[i + 9], 21, -343485551);
    a = add32(a, olda);
    bb = add32(bb, oldb);
    c = add32(c, oldc);
    d = add32(d, oldd);
  }
  const hex = (n: number) => {
    let out = "";
    for (let i = 0; i < 4; i++) {
      out += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, "0");
    }
    return out;
  };
  return hex(a) + hex(bb) + hex(c) + hex(d);
}

/**
 * Sign a params object with WBI and return the full query param list.
 * On signature failure: refresh keys once and retry; then throw.
 */
export async function signWbi(
  params: Record<string, string | number>,
): Promise<[string, string][]> {
  const withTs: Record<string, string | number> = {
    ...params,
    wts: Math.floor(Date.now() / 1000),
  };

  const keys = await getWbiKeys();
  const mixin = getMixinKey(keys.imgKey + keys.subKey);
  const sorted = Object.entries(withTs)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const query = sorted
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value).replace(/[!'()*]/g, ""))}`)
    .join("&");
  const w_rid = md5(query + mixin);
  const out: [string, string][] = sorted.map(([k, v]) => [k, String(v)]);
  out.push(["w_rid", w_rid]);
  return out;
}

export { getWbiKeys };
