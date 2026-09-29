// Standalone verification of Bilibili endpoints + WBI signing (Node 24 native fetch).
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const headers = { "User-Agent": UA, Referer: "https://www.bilibili.com/", Origin: "https://www.bilibili.com" };

const MIXIN_KEY_ENC_TAB = [
  46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52,
];
const getMixinKey = (o) => MIXIN_KEY_ENC_TAB.map((n) => o[n]).join("").slice(0, 32);

// minimal md5 (same algorithm as wbi.ts)
function md5(s) {
  const add32 = (a, b) => (a + b) & 0xffffffff;
  const cmn = (q, a, b, x, s, t) => add32((add32(add32(a, q), add32(x, t)) << s) | (add32(add32(a, q), add32(x, t)) >>> (32 - s)), b);
  const ff = (a,b,c,d,x,s,t) => cmn((b&c)|(~b&d),a,b,x,s,t);
  const gg = (a,b,c,d,x,s,t) => cmn((b&d)|(c&~d),a,b,x,s,t);
  const hh = (a,b,c,d,x,s,t) => cmn(b^c^d,a,b,x,s,t);
  const ii = (a,b,c,d,x,s,t) => cmn(c^(b|~d),a,b,x,s,t);
  const str = unescape(encodeURIComponent(s));
  const b = new Array(str.length);
  for (let i=0;i<str.length;i++) b[i]=str.charCodeAt(i);
  const nw = (((str.length+8)>>6)+1)*16;
  const words = new Array(nw).fill(0);
  for (let i=0;i<str.length;i++) words[i>>2] |= b[i] << ((i%4)*8);
  words[str.length>>2] |= 0x80 << ((str.length%4)*8);
  words[nw-2] = str.length*8;
  let a=1732584193,bb=-271733879,c=-1732584194,d=271733878;
  for (let i=0;i<nw;i+=16){
    const oa=a,ob=bb,oc=c,od=d;
    a=ff(a,bb,c,d,words[i+0],7,-680876936);d=ff(d,a,bb,c,words[i+1],12,-389564586);c=ff(c,d,a,bb,words[i+2],17,606105819);bb=ff(bb,c,d,a,words[i+3],22,-1044525330);
    a=ff(a,bb,c,d,words[i+4],7,-176418897);d=ff(d,a,bb,c,words[i+5],12,1200080426);c=ff(c,d,a,bb,words[i+6],17,-1473231341);bb=ff(bb,c,d,a,words[i+7],22,-45705983);
    a=ff(a,bb,c,d,words[i+8],7,1770035416);d=ff(d,a,bb,c,words[i+9],12,-1958414417);c=ff(c,d,a,bb,words[i+10],17,-42063);bb=ff(bb,c,d,a,words[i+11],22,-1990404162);
    a=ff(a,bb,c,d,words[i+12],7,1804603682);d=ff(d,a,bb,c,words[i+13],12,-40341101);c=ff(c,d,a,bb,words[i+14],17,-1502002290);bb=ff(bb,c,d,a,words[i+15],22,1236535329);
    a=gg(a,bb,c,d,words[i+1],5,-165796510);d=gg(d,a,bb,c,words[i+6],9,-1069501632);c=gg(c,d,a,bb,words[i+11],14,643717713);bb=gg(bb,c,d,a,words[i+0],20,-373897302);
    a=gg(a,bb,c,d,words[i+5],5,-701558691);d=gg(d,a,bb,c,words[i+10],9,38016083);c=gg(c,d,a,bb,words[i+15],14,-660478335);bb=gg(bb,c,d,a,words[i+4],20,-405537848);
    a=gg(a,bb,c,d,words[i+9],5,568446438);d=gg(d,a,bb,c,words[i+14],9,-1019803690);c=gg(c,d,a,bb,words[i+3],14,-187363961);bb=gg(bb,c,d,a,words[i+8],20,1163531501);
    a=gg(a,bb,c,d,words[i+13],5,-1444681467);d=gg(d,a,bb,c,words[i+2],9,-51403784);c=gg(c,d,a,bb,words[i+7],14,1735328473);bb=gg(bb,c,d,a,words[i+12],20,-1926607734);
    a=hh(a,bb,c,d,words[i+5],4,-378558);d=hh(d,a,bb,c,words[i+8],11,-2022574463);c=hh(c,d,a,bb,words[i+11],16,1839030562);bb=hh(bb,c,d,a,words[i+14],23,-35309556);
    a=hh(a,bb,c,d,words[i+1],4,-1530992060);d=hh(d,a,bb,c,words[i+4],11,1272893353);c=hh(c,d,a,bb,words[i+7],16,-155497632);bb=hh(bb,c,d,a,words[i+10],23,-1094730640);
    a=hh(a,bb,c,d,words[i+13],4,681279174);d=hh(d,a,bb,c,words[i+0],11,-358537222);c=hh(c,d,a,bb,words[i+3],16,-722521979);bb=hh(bb,c,d,a,words[i+6],23,76029189);
    a=hh(a,bb,c,d,words[i+9],4,-640364487);d=hh(d,a,bb,c,words[i+12],11,-421815835);c=hh(c,d,a,bb,words[i+15],16,530742520);bb=hh(bb,c,d,a,words[i+2],23,-995338651);
    a=ii(a,bb,c,d,words[i+0],6,-198630844);d=ii(d,a,bb,c,words[i+7],10,1126891415);c=ii(c,d,a,bb,words[i+14],15,-1416354905);bb=ii(bb,c,d,a,words[i+5],21,-57434055);
    a=ii(a,bb,c,d,words[i+12],6,1700485571);d=ii(d,a,bb,c,words[i+3],10,-1894986606);c=ii(c,d,a,bb,words[i+10],15,-1051523);bb=ii(bb,c,d,a,words[i+1],21,-2054922799);
    a=ii(a,bb,c,d,words[i+8],6,1873313359);d=ii(d,a,bb,c,words[i+15],10,-30611744);c=ii(c,d,a,bb,words[i+6],15,-1560198380);bb=ii(bb,c,d,a,words[i+13],21,1309151649);
    a=ii(a,bb,c,d,words[i+4],6,-145523070);d=ii(d,a,bb,c,words[i+11],10,-1120210379);c=ii(c,d,a,bb,words[i+2],15,718787259);bb=ii(bb,c,d,a,words[i+9],21,-343485551);
    a=add32(a,oa);bb=add32(bb,ob);c=add32(c,oc);d=add32(d,od);
  }
  const hex=(n)=>{let o="";for(let i=0;i<4;i++)o+=((n>>>(i*8))&0xff).toString(16).padStart(2,"0");return o;};
  return hex(a)+hex(bb)+hex(c)+hex(d);
}

async function getJson(url, params) {
  const u = new URL(url);
  for (const [k, v] of params) u.searchParams.set(k, v);
  const r = await fetch(u, { headers });
  const body = await r.text();
  return { status: r.status, data: JSON.parse(body) };
}

async function getKeys() {
  const { data } = await getJson("https://api.bilibili.com/x/web-interface/nav", []);
  const img = data.data.wbi_img.img_url, sub = data.data.wbi_img.sub_url;
  const imgKey = img.slice(img.lastIndexOf("/") + 1).split(".")[0];
  const subKey = sub.slice(sub.lastIndexOf("/") + 1).split(".")[0];
  return { imgKey, subKey };
}

async function signWbi(params) {
  const keys = await getKeys();
  const mixin = getMixinKey(keys.imgKey + keys.subKey);
  const withTs = { ...params, wts: Math.floor(Date.now() / 1000) };
  const sorted = Object.entries(withTs).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const query = sorted.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v).replace(/[!'()*]/g, ""))}`).join("&");
  const w_rid = md5(query + mixin);
  return [...sorted.map(([k, v]) => [k, String(v)]), ["w_rid", w_rid]];
}

const MID = process.argv[2] || "672328094";

console.log("== spaceInfo (WBI) ==");
const info = await getJson("https://api.bilibili.com/x/space/wbi/acc/info", await signWbi({ mid: MID, token: "", platform: "web", web_location: "1550101" }));
console.log("code:", info.data.code, "| name:", info.data.data?.name, "| level:", info.data.data?.level, "| sign:", (info.data.data?.sign || "").slice(0, 30));

console.log("== relation/stat ==");
const rel = await getJson("https://api.bilibili.com/x/relation/stat", [["vmid", MID]]);
console.log("code:", rel.data.code, "| follower:", rel.data.data?.follower, "| following:", rel.data.data?.following);

console.log("== upstat (anonymous) ==");
const up = await getJson("https://api.bilibili.com/x/space/upstat", [["mid", MID]]);
console.log("code:", up.data.code, "| view:", up.data.data?.archive?.view, "| likes:", up.data.data?.archive?.likes);

console.log("== space/arc/search (WBI) ==");
const search = await getJson("https://api.bilibili.com/x/space/wbi/arc/search", await signWbi({ mid: MID, pn: 1, ps: 5, tid: 0, keyword: "", order: "pubdate", platform: "web", web_location: "1550101" }));
console.log("code:", search.data.code, "| message:", search.data.message, "| count:", search.data.data?.list?.vlist?.length);
if (search.data.data?.list?.vlist?.[0]) {
  const v0 = search.data.data.list.vlist[0];
  console.log("first bvid:", v0.bvid, "| title:", (v0.title || "").slice(0, 40));
}

console.log("== view detail ==");
const bvid = search.data.data?.list?.vlist?.[0]?.bvid || "BV1xx411c7mD";
const view = await getJson("https://api.bilibili.com/x/web-interface/view", [["bvid", bvid]]);
const cid = view.data.data?.pages?.[0]?.cid ?? view.data.data?.cid;
console.log("code:", view.data.code, "| stat.view:", view.data.data?.stat?.view, "| cid:", cid);

console.log("== online/total ==");
const onl = await getJson("https://api.bilibili.com/x/player/online/total", [["bvid", bvid], ["cid", String(cid)]]);
console.log("code:", onl.data.code, "| total:", onl.data.data?.total, "| count:", onl.data.data?.count, "| web_count:", onl.data.data?.web_count);

console.log("== dynamic space (decoration) ==");
const dyn = await getJson("https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space", [["host_mid", MID], ["offset", ""], ["timezone_offset", "-480"]]);
const dec = dyn.data.data?.items?.[0]?.modules?.module_author?.decorate;
console.log("code:", dyn.data.code, "| decorate:", dec ? JSON.stringify(dec).slice(0, 120) : "none");
