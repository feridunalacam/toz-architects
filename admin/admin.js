/* toz+ admin.
   Edits content/site.json and previews every page with the site's own renderer.
   On this Mac (tools/admin_server.py) it writes to the folder and pushes with git.
   On the live /admin it can do the same through the GitHub API when a token is saved
   in this browser (never in the repo). Without a token it stays a preview. */
import { LAYERS, cleanSvg, planSources, renderSite, slugify, validate } from "../tools/render.mjs";

const ROOT = new URL("../", location.href);
const SITE = "https://feridunalacam.github.io/toz-architects/";
const DRAFT = "toz-admin-draft";
const TOKEN_KEY = "toz-admin-gh-token";
const GH_OWNER = "feridunalacam";
const GH_REPO = "toz-architects";
const GH_BRANCH = "main";
const DETAIL_RE = /^(projeler|en\/projects)\/[a-z0-9][a-z0-9-]*\.html$/;
const UPLOAD_RE = /^assets\/(uploads\/[a-z0-9][a-z0-9-]*\.(jpg|jpeg|png|webp)|plans\/[a-z0-9][a-z0-9-]*\.svg)$/;
const PLAN_RE = /^assets\/plans\/[a-z0-9][a-z0-9-]*\.svg$/;
const PAGE_FILES = new Set([
  "index.html", "projeler.html", "ekip.html", "iletisim.html", "pratik.html", "ofis.html", "404.html", "sitemap.xml",
  "en/index.html", "en/projects.html", "en/team.html", "en/contact.html", "en/practice.html", "en/studio.html",
]);
const MAIN = {
  tr: ["index.html", "projeler.html", "ekip.html", "iletisim.html"],
  en: ["en/index.html", "en/projects.html", "en/team.html", "en/contact.html"],
};
const MAIN_NAMES = ["Ana sayfa", "Projeler", "Ekip", "İletişim"];
const SECTIONS = [
  { id: "projects", name: "Projeler", page: 1 },
  { id: "slides", name: "Açılış", page: 0 },
  { id: "home", name: "Ana sayfa", page: 0 },
  { id: "studio", name: "Atölye", page: 0 },
  { id: "team", name: "Ekip", page: 2 },
  { id: "materials", name: "Malzeme", page: 0 },
  { id: "method", name: "Yöntem", page: 2 },
  { id: "pages", name: "Sayfa bilgileri", page: null },
  { id: "office", name: "Ofis", page: 3 },
];
const LAYER_NAMES = { mevcut: "Mevcut", sokulen: "Sökülen", yeni: "Yeni", not: "Notlar" };
/* Re-rendering the page being edited should not replay its entrance animations on every keystroke.
   Durations are left alone: the opening slideshow advances on its progress bar's animationend. */
const STILL = `<style>.page-head>*,.hero-copy>*,.hero-card,.p-card,.p-crumbs,.hc-project,.wordmark,.p-title,.pin,.pin *,.pin *::before,.pin *::after{animation:none!important}[data-draw],[data-fade]{transition:none!important}</style>`;
const BLANK = "<!doctype html><title>-</title>";

const S = {
  content: null,
  savedRaw: "",
  lastSnap: "",
  undo: [],
  redo: [],
  plans: {},
  dirtyPlans: new Set(),
  planUrls: new Map(),
  blobs: new Map(),
  pendingBlobs: new Map(),
  images: [],
  local: false,
  remote: false,
  unpublished: null,
  files: {},
  section: "projects",
  project: null,
  problems: [],
  banner: null,
  saving: false,
  pv: { ref: { main: 0 }, lang: "tr", device: "desktop", hash: "" },
};

/* ---------------------------------------------------------------- helpers */

const $ = (sel, el = document) => el.querySelector(sel);
const pad = (n) => String(n).padStart(2, "0");
const tx = (o, lg = "tr") => (o && typeof o === "object" ? o[lg] ?? "" : o ?? "");
const bi = () => ({ tr: "", en: "" });
const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const fileName = (src) => String(src || "").split("/").pop();
const srcUrl = (src) => S.blobs.get(src) || new URL(src, ROOT).href;
const swap = (arr, i, j) => { [arr[i], arr[j]] = [arr[j], arr[i]]; };
const catName = (key) => (S.content.categories || []).find((c) => c.key === key)?.tr || key || "";
const detailPath = (p, lg) => (lg === "en" ? "en/projects/" : "projeler/") + (p.slug?.[lg] || slugify(tx(p.title, lg)) || p.id) + ".html";

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else if (k === "checked") el.checked = Boolean(v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  el.append(...kids.flat(Infinity).filter((kid) => kid != null && kid !== false));
  return el;
}

/* Small objects stay on one line, like the hand-written file. */
function pretty(v, ind = "") {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  const inner = ind + "  ";
  const arr = Array.isArray(v);
  const parts = arr ? v.map((x) => pretty(x, inner)) : Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${pretty(x, inner)}`);
  if (!parts.length) return arr ? "[]" : "{}";
  const flat = arr ? `[${parts.join(", ")}]` : `{ ${parts.join(", ")} }`;
  if (!flat.includes("\n") && ind.length + flat.length <= 110 && !(arr && v.some((x) => typeof x === "string"))) return flat;
  return `${arr ? "[" : "{"}\n${parts.map((p) => inner + p).join(",\n")}\n${ind}${arr ? "]" : "}"}`;
}

let toastTimer;
function toast(text, bad = false) {
  const t = $("[data-toast]");
  t.textContent = text;
  t.classList.toggle("is-bad", bad);
  t.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("is-on"), bad ? 6500 : 3200);
}

async function api(path, body, json = false) {
  const init = { headers: { "X-Toz": "1" }, cache: "no-store" };
  if (body !== undefined) {
    init.method = "POST";
    init.body = json ? JSON.stringify(body) : body;
    if (json) init.headers["Content-Type"] = "application/json";
  }
  const res = await fetch("/api/" + path, init);
  const out = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  if (!res.ok || !out.ok) throw Object.assign(new Error(out.error || `HTTP ${res.status}`), { log: out.log });
  return out;
}

const canWrite = () => S.local || S.remote;
const tokenGet = () => localStorage.getItem(TOKEN_KEY) || "";
const tokenSet = (t) => {
  t = String(t || "").trim();
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
};

function bytesToBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
async function blobToBase64(blob) { return bytesToBase64(new Uint8Array(await blob.arrayBuffer())); }

async function gh(path, { method = "GET", body } = {}) {
  const token = tokenGet();
  if (!token) throw new Error("GitHub bağlantısı yok.");
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!res.ok) {
    if (res.status === 401) throw new Error("GitHub token geçersiz ya da süresi dolmuş.");
    if (res.status === 403) throw new Error("GitHub izni yok. Token’a bu depo için Contents yazma yetkisi verin.");
    if (res.status === 409) throw new Error("Depoda çakışma var. Sayfayı yenileyip tekrar deneyin.");
    throw new Error(data?.message || `GitHub HTTP ${res.status}`);
  }
  return data;
}

async function ghVerify() {
  const repo = await gh(`/repos/${GH_OWNER}/${GH_REPO}`);
  if (repo.permissions && repo.permissions.push === false) {
    throw new Error("Bu token depoya yazamıyor. Contents: Read and write yetkisi verin.");
  }
  return repo;
}

async function ghListTree() {
  const tree = await gh(`/repos/${GH_OWNER}/${GH_REPO}/git/trees/${GH_BRANCH}?recursive=1`);
  if (tree.truncated) throw new Error("Depo ağacı çok büyük; liste alınamadı.");
  return tree.tree || [];
}

async function ghListImages() {
  const dirs = ["assets/photos/", "assets/atolye/", "assets/materials/", "assets/uploads/"];
  return (await ghListTree())
    .filter((t) => t.type === "blob" && dirs.some((d) => t.path.startsWith(d)) && /\.(jpe?g|png|webp)$/i.test(t.path))
    .map((t) => t.path);
}

async function ghCommit(files, removes, message) {
  const ref = await gh(`/repos/${GH_OWNER}/${GH_REPO}/git/ref/heads/${GH_BRANCH}`);
  const head = ref.object.sha;
  const parent = await gh(`/repos/${GH_OWNER}/${GH_REPO}/git/commits/${head}`);
  const entries = [];
  for (const f of files) {
    const blob = await gh(`/repos/${GH_OWNER}/${GH_REPO}/git/blobs`, {
      method: "POST",
      body: f.base64 != null
        ? { content: f.base64, encoding: "base64" }
        : { content: f.content, encoding: "utf-8" },
    });
    entries.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  for (const path of removes) entries.push({ path, mode: "100644", type: "blob", sha: null });
  const tree = await gh(`/repos/${GH_OWNER}/${GH_REPO}/git/trees`, {
    method: "POST",
    body: { base_tree: parent.tree.sha, tree: entries },
  });
  const commit = await gh(`/repos/${GH_OWNER}/${GH_REPO}/git/commits`, {
    method: "POST",
    body: { message, tree: tree.sha, parents: [head] },
  });
  await gh(`/repos/${GH_OWNER}/${GH_REPO}/git/refs/heads/${GH_BRANCH}`, {
    method: "PATCH",
    body: { sha: commit.sha },
  });
  return commit.sha.slice(0, 7);
}

async function remotePublish(message) {
  const { files } = renderSite(S.content, { plans: S.plans });
  for (const src of S.dirtyPlans) {
    if (!PLAN_RE.test(src)) throw new Error("İzin verilmeyen pafta yolu: " + src);
    files[src] = S.plans[src];
  }
  if (!files["index.html"] || !Object.keys(files).some((p) => DETAIL_RE.test(p))) {
    throw new Error("Site eksik üretildi, gönderilmedi.");
  }
  const payload = [];
  const json = pretty(S.content);
  payload.push({ path: "content/site.json", content: json.endsWith("\n") ? json : json + "\n" });
  for (const [path, text] of Object.entries(files)) {
    if (!PAGE_FILES.has(path) && !DETAIL_RE.test(path) && !PLAN_RE.test(path)) {
      throw new Error("İzin verilmeyen dosya yolu: " + path);
    }
    payload.push({ path, content: text });
  }
  for (const [path, blob] of S.pendingBlobs) {
    if (!UPLOAD_RE.test(path)) throw new Error("İzin verilmeyen yükleme yolu: " + path);
    payload.push({ path, base64: await blobToBase64(blob) });
  }
  const keep = new Set(Object.keys(files));
  const removes = (await ghListTree())
    .filter((t) => t.type === "blob" && DETAIL_RE.test(t.path) && !keep.has(t.path))
    .map((t) => t.path);
  if (!payload.length && !removes.length) return null;
  return ghCommit(payload, removes, message);
}

/* ---------------------------------------------------------------- state and history */

const dirty = () => JSON.stringify(S.content) !== S.savedRaw || S.dirtyPlans.size > 0 || S.pendingBlobs.size > 0;
let snapTimer, draftTimer, previewTimer;

function touch({ preview = true } = {}) {
  clearTimeout(snapTimer);
  snapTimer = setTimeout(snapshot, 450);
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraft, 700);
  if (preview) schedulePreview();
  if (S.problems.length) refreshProblems();
  status();
}

function snapshot() {
  const now = JSON.stringify(S.content);
  if (now === S.lastSnap) return;
  S.undo.push(S.lastSnap);
  if (S.undo.length > 100) S.undo.shift();
  S.redo.length = 0;
  S.lastSnap = now;
  status();
}

function travel(from, to) {
  clearTimeout(snapTimer);
  snapshot();
  if (!from.length) return;
  to.push(S.lastSnap);
  S.lastSnap = from.pop();
  S.content = JSON.parse(S.lastSnap);
  if (S.project != null && S.project >= S.content.projects.length) S.project = null;
  renderEditor();
  schedulePreview(0);
  saveDraft();
  status();
}
const undo = () => travel(S.undo, S.redo);
const redo = () => travel(S.redo, S.undo);

function saveDraft() {
  try {
    if (!dirty()) { localStorage.removeItem(DRAFT); return; }
    const plans = {};
    for (const src of S.dirtyPlans) plans[src] = S.plans[src];
    localStorage.setItem(DRAFT, JSON.stringify({ at: Date.now(), content: S.content, plans }));
  } catch {
    /* a full or blocked storage only costs the draft */
  }
}

function offerDraft() {
  let draft = null;
  try { draft = JSON.parse(localStorage.getItem(DRAFT) || "null"); } catch { draft = null; }
  if (!draft?.content || JSON.stringify(draft.content) === S.savedRaw) return;
  const when = new Date(draft.at).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
  S.banner = h("div", { class: "banner", role: "status" },
    h("p", {}, `Kaydedilmemiş bir taslak bulundu (${when}).`),
    h("button", {
      type: "button", class: "btn sm", onclick: () => {
        S.content = draft.content;
        for (const [src, text] of Object.entries(draft.plans || {})) { S.plans[src] = text; S.dirtyPlans.add(src); }
        S.banner = null;
        touch();
        renderEditor();
      },
    }, "Taslağı aç"),
    h("button", { type: "button", class: "btn sm ghost", onclick: () => { localStorage.removeItem(DRAFT); S.banner = null; renderEditor(); } }, "Sil"));
  renderEditor();
}

function status(text) {
  const d = dirty();
  const el = $("[data-status]");
  el.classList.toggle("is-dirty", d || S.unpublished === true);
  el.lastElementChild.textContent = text || (d
    ? (canWrite() ? "Kaydedilmemiş değişiklik var" : "Değişiklikler yalnızca bu tarayıcıda")
    : S.local
      ? (S.unpublished === true ? "Kaydedildi · henüz yayında değil"
        : S.unpublished === false ? "Kaydedildi ve yayında" : "Kaydedildi")
      : S.remote ? "Çevrimiçi · bağlı"
        : "Çevrimiçi · bağlanmamış");
  $("[data-undo]").disabled = !S.undo.length && JSON.stringify(S.content) === S.lastSnap;
  $("[data-redo]").disabled = !S.redo.length;
  $("[data-save]").disabled = !d || S.saving;
  const pub = $("[data-publish]");
  pub.disabled = S.saving;
  pub.querySelector(".badge")?.remove();
  if (S.unpublished === true || d) pub.append(h("span", { class: "badge", "aria-hidden": "true" }));
  pub.title = S.unpublished === true || d ? "Yayında olmayan değişiklikler var" : "Her şey yayında";
}

async function refreshGit() {
  if (S.local) {
    try {
      const g = await api("status");
      S.unpublished = g.changes + g.ahead > 0;
    } catch {
      S.unpublished = null;
    }
  } else if (S.remote) {
    S.unpublished = dirty();
  } else {
    S.unpublished = null;
  }
  status();
}

/* ---------------------------------------------------------------- form controls */

function grow(t) {
  t.style.height = "auto";
  t.style.height = t.scrollHeight + 2 + "px";
}

function control(value, set, o = {}) {
  const multi = Boolean(o.rows);
  const el = multi
    ? h("textarea", { rows: o.rows, value, placeholder: o.placeholder, lang: o.lang, spellcheck: o.spell === false ? "false" : null })
    : h("input", { type: o.type || "text", value, placeholder: o.placeholder, lang: o.lang, inputmode: o.inputmode, readonly: o.readonly, spellcheck: o.spell === false ? "false" : null });
  el.addEventListener("input", () => {
    set(el.value);
    if (multi) grow(el);
    o.after?.(el.value, el);
  });
  if (multi) requestAnimationFrame(() => grow(el));
  return el;
}

const help = (text) => (text ? h("small", { class: "f-help" }, text) : null);

function field(label, get, set, o = {}) {
  const counter = o.count ? h("em") : null;
  const ctl = control(get() ?? "", (v) => { set(v); count(); }, o);
  const count = () => {
    if (!counter) return;
    counter.textContent = `${ctl.value.length}/${o.count}`;
    counter.classList.toggle("over", ctl.value.length > o.count);
  };
  count();
  return h("label", { class: "field" }, h("span", { class: "f-label" }, label, counter), ctl, help(o.help));
}

function duo(label, get, set, o = {}) {
  const counter = o.count ? h("em") : null;
  const ctls = {};
  const count = () => {
    if (!counter) return;
    const n = ["tr", "en"].map((lg) => ctls[lg].value.length);
    counter.textContent = `TR ${n[0]} · EN ${n[1]} / ${o.count}`;
    counter.classList.toggle("over", Math.max(...n) > o.count);
  };
  const cell = (lg) => {
    ctls[lg] = control(get(lg) ?? "", (v) => set(lg, v), { ...o, lang: lg, after: (v) => { count(); o.after?.(lg, v); } });
    return h("label", {}, h("span", { class: "lg" }, lg.toUpperCase()), ctls[lg]);
  };
  const pair = h("div", { class: "pair" + (o.stack ? " stack" : "") }, cell("tr"), cell("en"));
  count();
  return h("div", { class: "field" }, h("span", { class: "f-label" }, label, counter), pair, help(o.help));
}

const dual = (label, obj, key, o) => duo(label,
  (lg) => tx(obj?.[key], lg),
  (lg, v) => { if (!obj[key] || typeof obj[key] !== "object") obj[key] = bi(); obj[key][lg] = v; touch(); }, o);

const byLang = (label, obj, key, o) => duo(label,
  (lg) => obj?.[lg]?.[key] ?? "",
  (lg, v) => { (obj[lg] ||= {})[key] = v; touch(); }, o);

const str = (label, obj, key, o) => field(label, () => obj[key] ?? "", (v) => { obj[key] = v; touch(); }, o);

const paragraphs = (label, obj, key, o) => duo(label,
  (lg) => (obj[key]?.[lg] || []).join("\n\n"),
  (lg, v) => {
    if (!obj[key] || typeof obj[key] !== "object") obj[key] = { tr: [], en: [] };
    obj[key][lg] = v.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    touch();
  }, { rows: 6, stack: true, ...o });

function choice(label, options, get, set, text) {
  const sel = h("select", { onchange: () => { set(sel.value); touch(); } }, options.map(([v, name]) => h("option", { value: v }, name)));
  sel.value = get() ?? "";
  return h("label", { class: "field" }, h("span", { class: "f-label" }, label), sel, help(text));
}

function toggle(title, sub, get, set) {
  const input = h("input", { type: "checkbox", checked: get(), onchange: () => { set(input.checked); touch(); } });
  return h("label", { class: "field switch" }, input, h("i", { "aria-hidden": "true" }), h("span", {}, h("b", {}, title), sub ? h("small", {}, sub) : null));
}

const group = (no, title, kids, note) => h("section", { class: "group" },
  h("h2", {}, h("span", {}, no), title), note ? h("p", { class: "note" }, note) : null, kids);

const head = (kicker, title, text, extra) => h("header", { class: "ed-head" },
  h("p", { class: "kicker" }, kicker), h("h1", {}, title), text ? h("p", {}, text) : null, extra);

function list(items, o) {
  const box = h("div", { class: "list" });
  const canRemove = (it) => items.length > (o.min || 0) && (!o.canRemove || o.canRemove(it));
  const draw = () => {
    box.replaceChildren(
      ...items.map((it, i) => h("section", { class: "item" },
        h("div", { class: "item-head" },
          h("span", { class: "item-no" }, pad(i + 1)),
          h("strong", {}, o.label(it, i) || "—"),
          h("div", { class: "item-tools" },
            h("button", { type: "button", class: "icon", title: "Yukarı taşı", "aria-label": "Yukarı taşı", disabled: i === 0, onclick: () => { swap(items, i, i - 1); touch(); draw(); } }, "↑"),
            h("button", { type: "button", class: "icon", title: "Aşağı taşı", "aria-label": "Aşağı taşı", disabled: i === items.length - 1, onclick: () => { swap(items, i, i + 1); touch(); draw(); } }, "↓"),
            h("button", {
              type: "button", class: "icon", title: "Sil", "aria-label": "Sil", disabled: !canRemove(it),
              onclick: () => { if (confirm(`${o.noun} ${i + 1} silinsin mi?`)) { items.splice(i, 1); touch(); draw(); } },
            }, "✕"))),
        o.render(it, i, draw))),
      h("button", {
        type: "button", class: "btn ghost sm add", onclick: async () => {
          const it = await o.create();
          if (!it) return;
          items.push(it);
          touch();
          draw();
          box.children[items.length - 1]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        },
      }, "+ " + o.add));
  };
  draw();
  return box;
}

/* ---------------------------------------------------------------- images */

function imageField(label, owner, key, o = {}) {
  const box = h("div", { class: "field" });
  const read = () => {
    if (key == null) return owner.src ? owner : null;
    const v = owner[key];
    return o.string ? (v ? { src: v } : null) : v?.src ? v : null;
  };
  const write = (res) => {
    if (o.string) owner[key] = res ? res.src : "";
    else if (!res) { if (key != null) owner[key] = null; }
    else {
      let t = key == null ? owner : owner[key];
      if (!t || typeof t !== "object") t = owner[key] = { src: "", w: 0, h: 0, alt: bi() };
      t.src = res.src;
      t.w = res.w;
      t.h = res.h;
      if (res.small) t.small = res.small;
      else delete t.small;
    }
    touch();
    draw();
    o.change?.();
  };
  const choose = async () => {
    const res = await choosePhoto({ title: label, name: typeof o.name === "function" ? o.name() : o.name });
    if (res) write(res);
  };
  const draw = () => {
    const im = read();
    box.replaceChildren(
      h("span", { class: "f-label" }, label),
      h("div", { class: "img-row" },
        h("button", { type: "button", class: "thumb" + (im ? "" : " is-empty"), onclick: choose, "aria-label": `${label}: ${im ? "değiştir" : "seç"}` },
          im ? h("img", { src: srcUrl(im.small || im.src), alt: "", loading: "lazy" }) : "+"),
        h("div", { class: "img-meta" },
          h("p", { class: "mono" }, im ? fileName(im.src) : "Görsel seçilmedi"),
          im?.w ? h("p", { class: "quiet small" }, `${im.w} × ${im.h} px`) : null,
          h("div", { class: "row" },
            h("button", { type: "button", class: "btn sm ghost", onclick: choose }, im ? "Değiştir" : "Görsel seç"),
            o.optional && im ? h("button", { type: "button", class: "btn sm danger", onclick: () => write(null) }, "Kaldır") : null))),
      help(o.help));
  };
  draw();
  return box;
}

function libraryImages() {
  const found = new Set();
  const walk = (v) => {
    if (!v || typeof v !== "object") return;
    if (typeof v.src === "string" && /\.(jpe?g|png|webp)$/i.test(v.src)) found.add(v.src);
    Object.values(v).forEach(walk);
  };
  walk(S.content);
  (S.content.home?.statementImages || []).forEach((s) => s && found.add(s));
  S.images.forEach((s) => found.add(s));
  S.blobs.forEach((_, k) => found.add(k));
  return [...found].filter((s) => !/-960\.(jpe?g|webp)$/i.test(s) && !s.startsWith("assets/plans/")).sort();
}

function hasSmall(src) {
  const small = src.replace(/\.(jpe?g|webp)$/i, "-960.$1");
  if (small === src) return null;
  if (S.images.includes(small) || S.blobs.has(small)) return small;
  let seen = false;
  const walk = (v) => {
    if (seen || !v || typeof v !== "object") return;
    if (v.src === src && v.small === small) seen = true;
    Object.values(v).forEach(walk);
  };
  walk(S.content);
  return seen ? small : null;
}

async function describe(src) {
  const img = new Image();
  img.src = srcUrl(src);
  await img.decode().catch(() => {});
  return { src, w: img.naturalWidth, h: img.naturalHeight, small: hasSmall(src) };
}

async function encode(bmp, max, byWidth) {
  const s = Math.min(1, max / (byWidth ? bmp.width : Math.max(bmp.width, bmp.height)));
  const w = Math.round(bmp.width * s);
  const hh = Math.round(bmp.height * s);
  const canvas = Object.assign(document.createElement("canvas"), { width: w, height: hh });
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f4f3f0";
  ctx.fillRect(0, 0, w, hh);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, hh);
  const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.82));
  if (!blob) throw new Error("Görsel hazırlanamadı.");
  return { blob, w, h: hh };
}

async function upload(file, name) {
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Bu dosya açılamadı. JPG, PNG ya da WebP deneyin.");
  }
  const stem = slugify(name || file.name.replace(/\.[^.]+$/, "")) || "gorsel";
  const base = `assets/uploads/${stem}-${Date.now().toString(36)}`;
  const big = await encode(bmp, 2400, false);
  const small = bmp.width >= 1400 ? await encode(bmp, 960, true) : null;
  bmp.close?.();
  const out = { src: base + ".jpg", w: big.w, h: big.h, small: small ? base + "-960.jpg" : null };
  if (S.local) {
    await api("file?path=" + encodeURIComponent(out.src), big.blob);
    if (small) await api("file?path=" + encodeURIComponent(out.small), small.blob);
    S.images.push(out.src, ...(small ? [out.small] : []));
  } else {
    S.blobs.set(out.src, URL.createObjectURL(big.blob));
    S.pendingBlobs.set(out.src, big.blob);
    if (small) {
      S.blobs.set(out.small, URL.createObjectURL(small.blob));
      S.pendingBlobs.set(out.small, small.blob);
    }
    S.images.push(out.src, ...(small ? [out.small] : []));
  }
  return out;
}

function choosePhoto({ title = "Görsel", name } = {}) {
  const dlg = $("[data-picker]");
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      if (dlg.open) dlg.close();
      resolve(v);
    };
    const busy = h("p", { class: "busy", hidden: true }, "Görsel hazırlanıyor…");
    const take = async (file) => {
      if (!file) return;
      busy.hidden = false;
      try {
        finish(await upload(file, name));
      } catch (err) {
        busy.hidden = true;
        toast(err.message, true);
      }
    };
    const input = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/heic,image/heif", hidden: true, onchange: () => take(input.files[0]) });
    const drop = h("div", { class: "drop" },
      h("strong", {}, "Fotoğrafı buraya bırakın"),
      h("p", {}, "ya da"),
      h("button", { type: "button", class: "btn sm", onclick: () => input.click() }, "Bilgisayardan seç"),
      h("p", {}, "JPG, PNG ya da WebP. Uzun kenarı 2400 pikseli geçen fotoğraflar küçültülüp JPG olarak kaydedilir."),
      input);
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("is-over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("is-over"); take(e.dataTransfer.files[0]); });
    const imgs = libraryImages();
    dlg.replaceChildren(
      h("div", { class: "dlg-head" },
        h("h2", { id: "picker-title" }, title),
        h("button", { type: "button", class: "icon", "aria-label": "Kapat", onclick: () => finish(null) }, "✕")),
      h("div", { class: "dlg-body" },
        drop,
        busy,
        h("div", { class: "lib-head" }, h("h3", {}, "Sitedeki görseller"), h("span", { class: "quiet small" }, `${imgs.length} görsel`)),
        h("div", { class: "lib" }, imgs.map((src) => h("button", {
          type: "button", title: src, onclick: async () => finish(await describe(src)),
        }, h("img", { src: srcUrl(hasSmall(src) || src), alt: "", loading: "lazy" }), h("span", {}, fileName(src)))))));
    dlg.onclose = () => finish(null);
    dlg.onclick = (e) => { if (e.target === dlg) finish(null); };
    dlg.showModal();
  });
}

/* ---------------------------------------------------------------- drawings */

function planUrl(src) {
  if (S.dirtyPlans.has(src)) {
    if (!S.planUrls.has(src)) S.planUrls.set(src, URL.createObjectURL(new Blob([S.plans[src]], { type: "image/svg+xml" })));
    return S.planUrls.get(src);
  }
  return srcUrl(src);
}

async function takePlan(p, file) {
  try {
    const kind = p.plan?.kind || { tr: "Plan", en: "Plan" };
    const note = p.plan?.note || bi();
    if (/svg/i.test(file.type) || /\.svg$/i.test(file.name)) {
      const clean = cleanSvg(await file.text());
      if (!clean) throw new Error("Bu dosyada bir SVG çizimi bulunamadı.");
      const src = `assets/plans/${p.id}.svg`;
      S.plans[src] = clean;
      S.dirtyPlans.add(src);
      URL.revokeObjectURL(S.planUrls.get(src) || "");
      S.planUrls.delete(src);
      p.plan = { src, kind, note };
    } else {
      const res = await upload(file, `${p.id}-pafta`);
      p.plan = { src: res.src, kind, note };
    }
    touch();
    renderEditor();
  } catch (err) {
    toast(err.message, true);
  }
}

function planGroup(p) {
  const plan = p.plan?.src ? p.plan : null;
  const svg = plan && /\.svg$/i.test(plan.src) ? S.plans[plan.src] || "" : "";
  const layers = svg ? LAYERS.filter((l) => svg.includes(`data-layer="${l}"`)) : [];
  const styled = svg && /<style\b|\sclass\s*=|\sid\s*=/i.test(cleanSvg(svg).replace(/^<svg\b[^>]*>/i, ""));
  const input = h("input", { type: "file", accept: ".svg,image/svg+xml,image/png,image/jpeg", hidden: true, onchange: () => input.files[0] && takePlan(p, input.files[0]) });
  return group("04", "Pafta", [
    h("div", { class: "plan-box" }, plan ? h("img", { src: planUrl(plan.src), alt: "" }) : h("p", {}, "Bu çalışmanın paftası yok.")),
    layers.length ? h("div", { class: "layers", "aria-label": "Çizimdeki katmanlar" }, layers.map((l) => h("span", { class: "chip " + l }, LAYER_NAMES[l]))) : null,
    styled ? help("Bu çizim kendi stilini taşıyor. Sayfada resim olarak gösterilir; katman düğmeleri ve çizilme hareketi çıkmaz.") : null,
    plan && !svg ? help("Resim olarak yüklenen paftada katman yoktur.") : null,
    h("div", { class: "row field" },
      h("button", { type: "button", class: "btn sm", onclick: () => input.click() }, plan ? "Paftayı değiştir" : "Pafta yükle"),
      plan ? h("button", { type: "button", class: "btn sm danger", onclick: () => { p.plan = null; touch(); renderEditor(); } }, "Kaldır") : null,
      input),
    plan ? dual("Çizim türü", p.plan, "kind", { help: "Ör. Plan, Kesit, Görünüş, Boy kesiti" }) : null,
    plan ? dual("Kırmızı çizginin gösterdiği", p.plan, "note", { help: "Pafta künyesinde çizim türünün yanında yazar." }) : null,
    help("SVG yüklerseniz çizim sayfaya gömülür. Gruplara data-layer=\"mevcut\", \"sokulen\", \"yeni\" ya da \"not\" verilmişse sitede katman düğmeleri çıkar."),
  ], "Ana sayfadaki pafta masasında, Projeler sayfasının plan görünümünde ve proje sayfasında gösterilir.");
}

/* ---------------------------------------------------------------- pins */

function pinsField(p) {
  const wrap = h("div", { class: "field" });
  const draw = () => {
    const cover = p.cover?.src ? p.cover : null;
    const pins = p.pins || [];
    const stage = h("div", { class: "pin-stage" },
      cover ? h("img", { src: srcUrl(cover.src), alt: "", draggable: "false" }) : h("p", { class: "empty" }, "Not eklemek için önce kapak görseli seçin."));
    const dots = pins.map((q, k) => h("button", {
      type: "button", class: "pin-dot", style: `left:${q.x}%;top:${q.y}%`, dataset: { k },
      "aria-label": `Not ${k + 1}: ${q.tr || "adsız"}. Ok tuşlarıyla taşınır.`,
    }, k + 1));
    stage.append(...dots);

    stage.addEventListener("pointerdown", (e) => {
      if (!cover || e.button !== 0) return;
      const r = stage.getBoundingClientRect();
      const at = (ev) => [
        Math.round(clamp(((ev.clientX - r.left) / r.width) * 100) * 2) / 2,
        Math.round(clamp(((ev.clientY - r.top) / r.height) * 100) * 2) / 2,
      ];
      const dot = e.target.closest(".pin-dot");
      if (!dot) {
        const [x, y] = at(e);
        (p.pins ||= []).push({ x, y, tr: "", en: "" });
        touch();
        draw();
        wrap.querySelector(".pin-list li:last-child input")?.focus();
        return;
      }
      e.preventDefault();
      const q = pins[+dot.dataset.k];
      try { dot.setPointerCapture(e.pointerId); } catch { /* inactive pointer: move events still reach the dot */ }
      dot.classList.add("is-on");
      const move = (ev) => {
        [q.x, q.y] = at(ev);
        dot.style.left = q.x + "%";
        dot.style.top = q.y + "%";
        touch();
      };
      const up = () => {
        dot.classList.remove("is-on");
        dot.removeEventListener("pointermove", move);
        dot.removeEventListener("pointerup", up);
        dot.removeEventListener("pointercancel", up);
      };
      dot.addEventListener("pointermove", move);
      dot.addEventListener("pointerup", up);
      dot.addEventListener("pointercancel", up);
    });
    stage.addEventListener("keydown", (e) => {
      const dot = e.target.closest(".pin-dot");
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!dot || !d) return;
      e.preventDefault();
      const q = pins[+dot.dataset.k];
      const step = e.shiftKey ? 5 : 0.5;
      q.x = clamp(q.x + d[0] * step);
      q.y = clamp(q.y + d[1] * step);
      dot.style.left = q.x + "%";
      dot.style.top = q.y + "%";
      touch();
    });

    const rows = pins.map((q, k) => h("li", {},
      h("span", { class: "pin-no", "aria-hidden": "true" }, k + 1),
      h("label", {}, h("span", { class: "lg" }, "TR"), control(q.tr ?? "", (v) => { q.tr = v; touch(); }, { lang: "tr", placeholder: "Kapı" })),
      h("label", {}, h("span", { class: "lg" }, "EN"), control(q.en ?? "", (v) => { q.en = v; touch(); }, { lang: "en", placeholder: "Door" })),
      h("button", { type: "button", class: "icon", "aria-label": `Not ${k + 1} sil`, onclick: () => { pins.splice(k, 1); touch(); draw(); } }, "✕")));
    wrap.replaceChildren(
      h("span", { class: "f-label" }, "Görseldeki notlar", h("em", {}, `${pins.length} not`)),
      stage,
      rows.length ? h("ol", { class: "pin-list" }, rows) : null,
      help(cover ? "Görsele tıklayarak not ekleyin, noktaları sürükleyerek taşıyın. Telefonda görselin alt kısmındaki notlar başlığın altında kalmasın diye gizlenir." : null));
  };
  draw();
  return wrap;
}

/* ---------------------------------------------------------------- projects */

const savedIds = () => new Set((JSON.parse(S.savedRaw).projects || []).map((p) => p.id));

function unique(base, taken) {
  let s = base;
  for (let k = 2; taken.has(s); k++) s = `${base}-${k}`;
  return s;
}
const uniqueSlug = (base, lg, self) => unique(base, new Set(S.content.projects.filter((q) => q !== self).map((q) => q.slug?.[lg])));
const uniqueId = (base, self) => unique(base, new Set(S.content.projects.filter((q) => q !== self).map((q) => q.id)));

function addProject() {
  const ps = S.content.projects;
  const id = uniqueId("yeni-proje");
  ps.push({
    id,
    slug: { tr: uniqueSlug(id, "tr"), en: uniqueSlug("new-project", "en") },
    cat: S.content.categories?.[0]?.key || "",
    featured: false,
    title: { tr: "Yeni proje", en: "New project" },
    what: bi(),
    cover: null,
    pins: [],
    body: { tr: [], en: [] },
    plan: null,
    facts: { status: { tr: "Çalışma", en: "Study" }, year: "", place: bi(), area: "" },
    gallery: [],
  });
  touch();
  go("projects", ps.length - 1);
}

function removeProject(i) {
  const p = S.content.projects[i];
  if (!confirm(`“${tx(p.title) || "Adsız"}” silinsin mi? Kaydetmeden önce Geri al ile geri getirebilirsiniz.`)) return;
  S.content.projects.splice(i, 1);
  (S.content.home?.slides || []).forEach((s) => { if (s.project === p.id) s.project = ""; });
  touch();
  go("projects");
}

function projectsView() {
  const ps = S.content.projects;
  return [
    head("01 · Projeler", "Projeler", `${ps.length} çalışma. Buradaki sıra sitedeki sıradır; numaralar da buna göre verilir.`,
      h("div", { class: "row" }, h("button", { type: "button", class: "btn", onclick: addProject }, "+ Yeni proje"))),
    h("ol", { class: "plist" }, ps.map((p, i) => h("li", { class: "prow" },
      h("button", { type: "button", class: "prow-main", onclick: () => go("projects", i) },
        h("span", { class: "prow-img" }, p.cover?.src ? h("img", { src: srcUrl(p.cover.small || p.cover.src), alt: "", loading: "lazy" }) : null),
        h("span", { class: "prow-no" }, pad(i + 1)),
        h("span", { class: "prow-text" }, h("strong", {}, tx(p.title) || "Adsız"), h("span", {}, [catName(p.cat), tx(p.what)].filter(Boolean).join(" · "))),
        p.featured ? h("span", { class: "chip" }, "Ana sayfada") : h("span")),
      h("div", { class: "prow-tools" },
        h("button", { type: "button", class: "icon", "aria-label": `${tx(p.title)}: yukarı taşı`, disabled: i === 0, onclick: () => { swap(ps, i, i - 1); touch(); renderEditor(); } }, "↑"),
        h("button", { type: "button", class: "icon", "aria-label": `${tx(p.title)}: aşağı taşı`, disabled: i === ps.length - 1, onclick: () => { swap(ps, i, i + 1); touch(); renderEditor(); } }, "↓"))))),
  ];
}

function projectView(i) {
  const ps = S.content.projects;
  const p = ps[i];
  const isNew = () => !savedIds().has(p.id);
  const cats = (S.content.categories || []).map((c) => [c.key, c.tr]);
  p.facts ||= {};
  p.gallery ||= [];
  const title = h("h1", {}, tx(p.title) || "Adsız çalışma");
  const kicker = h("p", { class: "kicker" }, `Çalışma ${pad(i + 1)} · ${catName(p.cat)}`);
  const slugIn = {};
  const urlOut = {};
  const showUrl = (lg) => { if (urlOut[lg]) urlOut[lg].textContent = (S.content.office?.base || SITE).replace(/^https?:\/\//, "") + detailPath(p, lg); };
  const relink = (from, to) => {
    (S.content.home?.slides || []).forEach((s) => { if (s.project === from) s.project = to; });
    if (S.pv.ref.project === from) S.pv.ref = { project: to };
  };
  const syncSlug = (lg, v) => {
    if (!isNew()) return;
    const s = uniqueSlug(slugify(v) || (lg === "tr" ? "yeni-proje" : "new-project"), lg, p);
    (p.slug ||= {})[lg] = s;
    if (slugIn[lg]) slugIn[lg].value = s;
    if (lg === "tr") {
      const old = p.id;
      p.id = uniqueId(s, p);
      relink(old, p.id);
      history.replaceState(null, "", `#projects/${p.id}`);
    }
    showUrl(lg);
  };
  const slugField = (lg) => {
    const ctl = control(p.slug?.[lg] ?? "", (v) => {
      const s = slugify(v);
      (p.slug ||= {})[lg] = s;
      showUrl(lg);
      touch();
    }, { spell: false, lang: lg });
    ctl.addEventListener("change", () => { ctl.value = p.slug?.[lg] ?? ""; });
    slugIn[lg] = ctl;
    urlOut[lg] = h("small", { class: "f-help mono" });
    showUrl(lg);
    return h("label", { class: "field" }, h("span", { class: "f-label" }, lg === "tr" ? "Türkçe adres" : "İngilizce adres"), ctl, urlOut[lg]);
  };

  return [
    h("header", { class: "ed-head" },
      h("div", { class: "proj-nav" },
        h("button", { type: "button", class: "back", onclick: () => go("projects") }, "← Tüm projeler"),
        h("div", { class: "row" },
          h("button", { type: "button", class: "icon", "aria-label": "Önceki çalışma", disabled: i === 0, onclick: () => go("projects", i - 1) }, "←"),
          h("span", { class: "mono small quiet" }, `${pad(i + 1)} / ${pad(ps.length)}`),
          h("button", { type: "button", class: "icon", "aria-label": "Sonraki çalışma", disabled: i === ps.length - 1, onclick: () => go("projects", i + 1) }, "→"))),
      kicker,
      title),

    group("01", "Kimlik", [
      dual("Başlık", p, "title", {
        help: "Proje sayfasında görselin üstünde dev puntoyla yazılır. Kısa başlıklar daha büyük görünür.",
        after: (lg, v) => { if (lg === "tr") title.textContent = v || "Adsız çalışma"; syncSlug(lg, v); },
      }),
      dual("Konu", p, "what", { help: "Kartlarda ve künyede görünür. Ör. Kapı, basamak, pencere" }),
      choice("Ölçek", cats, () => p.cat, (v) => { p.cat = v; kicker.textContent = `Çalışma ${pad(i + 1)} · ${catName(v)}`; }),
      toggle("Ana sayfada göster", "Ana sayfadaki çalışma kartlarında işaretli ilk dört proje görünür.", () => Boolean(p.featured), (v) => { p.featured = v; }),
    ]),

    group("02", "Kapak ve notlar", [
      imageField("Kapak görseli", p, "cover", { name: () => p.id, change: () => renderEditor(), help: "Proje sayfasının açılışını kaplar; kartlarda ve paylaşımlarda da kullanılır. Yatay fotoğraf önerilir." }),
      p.cover?.src ? dual("Görsel açıklaması", p.cover, "alt", { rows: 2, help: "Görmeyen ziyaretçiler ve arama motorları için kısa bir tarif." }) : null,
      pinsField(p),
    ]),

    group("03", "Metin", [
      paragraphs("Paragraflar", p, "body", { help: "İlk paragraf büyük puntoyla yazılır. Paragrafları boş bir satırla ayırın." }),
    ]),

    planGroup(p),

    group("05", "Künye", [
      dual("Durum", p.facts, "status", { help: "Kartlarda ve künyede küçük etiket olarak görünür. Ör. Çalışma, Proje, Uygulama" }),
      h("div", { class: "grid2" },
        str("Yıl", p.facts, "year", { placeholder: "2026", inputmode: "numeric" }),
        str("Alan", p.facts, "area", { placeholder: "120 m²" })),
      dual("Yer", p.facts, "place", { placeholder: "Beşiktaş" }),
    ], "Boş bırakılan satırlar sayfada görünmez."),

    group("06", "Galeri", [
      list(p.gallery, {
        noun: "Görsel", add: "Görsel ekle",
        label: (g) => tx(g.cap) || fileName(g.src),
        create: async () => {
          const r = await choosePhoto({ title: "Galeri görseli", name: `${p.id}-galeri` });
          return r && { src: r.src, ...(r.small ? { small: r.small } : {}), w: r.w, h: r.h, alt: bi(), cap: bi() };
        },
        render: (g) => [
          imageField("Görsel", g, null, { name: `${p.id}-galeri` }),
          dual("Alt yazı", g, "cap"),
          dual("Görsel açıklaması", g, "alt", { rows: 2 }),
        ],
      }),
    ], "Proje sayfasında paftanın altında görünür. Görsele tıklanınca büyür."),

    group("07", "Adres", [
      h("div", { class: "grid2" }, slugField("tr"), slugField("en")),
      help(isNew()
        ? "Yeni proje kaydedilene kadar adres başlıkla birlikte değişir."
        : "Kaydedilmiş bir projenin adresi değişirse eski bağlantılar çalışmaz. Gerekmedikçe dokunmayın."),
    ]),

    h("section", { class: "group danger" },
      h("h2", {}, h("span", {}, "08"), "Projeyi sil"),
      h("p", { class: "note" }, "Proje sayfası ve bağlantıları siteden kalkar. Kaydetmeden önce Geri al ile geri getirilebilir."),
      h("button", { type: "button", class: "btn sm danger", onclick: () => removeProject(i) }, "Bu projeyi sil")),
  ];
}

/* ---------------------------------------------------------------- other sections */

const photoItem = (name, extra) => async () => {
  const r = await choosePhoto({ title: "Görsel", name });
  return r && { src: r.src, ...(r.small ? { small: r.small } : {}), w: r.w, h: r.h, ...extra() };
};

const VIEWS = {
  projects: () => (S.project == null ? projectsView() : projectView(S.project)),

  slides: () => {
    const home = (S.content.home ||= {});
    const slides = (home.slides ||= []);
    const projects = [["", "Bağlı çalışma yok"], ...S.content.projects.map((p, i) => [p.id, `${pad(i + 1)} · ${tx(p.title)}`])];
    return [
      head("02 · Açılış", "Açılış görselleri", "Ana sayfanın en üstünde sırayla geçen büyük görseller. Sağ alttaki kart, bağlı çalışmanın planını ve başlığını gösterir."),
      list(slides, {
        noun: "Görsel", add: "Görsel ekle", min: 1,
        label: (s) => tx(s.cap) || fileName(s.src),
        create: photoItem("acilis", () => ({ project: "", cap: bi(), alt: bi() })),
        render: (s) => [
          imageField("Görsel", s, null, { name: "acilis", help: "Yatay ve en az 1920 piksel genişliğinde bir fotoğraf önerilir." }),
          choice("Bağlı çalışma", projects, () => s.project || "", (v) => { s.project = v; }),
          dual("Alt yazı", s, "cap", { help: "Karttaki sayacın yanında küçük yazar. Ör. Merdivenli sokak, ikindi" }),
          dual("Görsel açıklaması", s, "alt", { rows: 2, help: "Görmeyen ziyaretçiler ve arama motorları için kısa bir tarif." }),
        ],
      }),
    ];
  },

  home: () => {
    const home = (S.content.home ||= {});
    const imgs = (home.statementImages ||= []);
    return [
      head("03 · Ana sayfa", "Ana sayfa metinleri", "Açılıştaki başlık ve altındaki tanıtım bölümü."),
      group("01", "Açılış", [
        byLang("Üst satır", home, "eyebrow", { help: "Başlığın üstündeki küçük satır." }),
        byLang("Başlık", home, "title", { rows: 2, help: "Satır atlamak için Enter’a basın." }),
      ]),
      group("02", "Cümle ve küçük görseller", [
        byLang("Cümle", home, "statement", { rows: 3, stack: true, help: "{1}, {2} ve {3} yazan yerlere aşağıdaki küçük görseller hap biçiminde yerleşir." }),
        [0, 1, 2].map((k) => imageField(`Görsel {${k + 1}}`, imgs, k, { string: true, optional: true, name: "cumle" })),
      ]),
      group("03", "Tanıtım", [
        byLang("Tanıtım", home, "intro", { rows: 3, stack: true }),
        byLang("Ekip cümlesi", home, "people", { rows: 2, stack: true }),
        byLang("Görüşme", home, "visits", { help: "Ofis bilgisindeki “Görüşme” satırı." }),
      ]),
    ];
  },

  studio: () => {
    const st = (S.content.studio ||= {});
    st.hero ||= {};
    st.items ||= [];
    return [
      head("04 · Atölye", "Atölye", "Ana sayfadaki büyük masa fotoğrafı ve Ekip sayfasındaki atölye kareleri."),
      group("01", "Masa fotoğrafı", [
        imageField("Görsel", st.hero, null, { name: "atolye", help: "Üstünde sayı kartları durur. Sağ üst köşesi sade bir yatay fotoğraf iyi sonuç verir." }),
        dual("Başlık satırı", st.hero, "cap", { help: "Bölüm başlığının sağında yazar." }),
        dual("Görsel açıklaması", st.hero, "alt", { rows: 2 }),
      ]),
      group("02", "Atölye kareleri", [
        list(st.items, {
          noun: "Kare", add: "Kare ekle",
          label: (it) => tx(it.title),
          create: photoItem("atolye", () => ({ title: bi(), text: bi(), alt: bi() })),
          render: (it) => [
            imageField("Görsel", it, null, { name: "atolye" }),
            dual("Başlık", it, "title"),
            dual("Metin", it, "text", { rows: 2 }),
            dual("Görsel açıklaması", it, "alt", { rows: 2 }),
          ],
        }),
      ]),
    ];
  },

  team: () => [
    head("05 · Ekip", "Ekip", "İlk kişi baş mimar olarak büyük fotoğrafla gösterilir. Fotoğrafı olmayanlar isim plakasıyla görünür."),
    list((S.content.team ||= []), {
      noun: "Kişi", add: "Kişi ekle", min: 1,
      label: (m) => m.name,
      create: () => ({ name: "", role: { tr: "Ekip", en: "Studio" }, photo: null }),
      render: (m, i, redraw) => [
        str("Ad soyad", m, "name", { spell: false }),
        dual("Görev", m, "role"),
        imageField("Fotoğraf", m, "photo", { optional: true, name: () => slugify(m.name) || "ekip", change: redraw, help: i === 0 ? "Dikey bir portre önerilir." : null }),
        m.photo?.src ? dual("Fotoğraf açıklaması", m.photo, "alt", { rows: 2 }) : null,
      ],
    }),
  ],

  materials: () => [
    head("06 · Malzeme", "Malzeme şeridi", "Ana sayfada yatay kayan malzeme kareleri. Dikey (3:4) fotoğraflar en iyi sonucu verir."),
    list((S.content.materials ||= []), {
      noun: "Malzeme", add: "Malzeme ekle",
      label: (m) => tx(m.name),
      create: photoItem("malzeme", () => ({ name: bi(), text: bi(), alt: bi() })),
      render: (m) => [
        imageField("Görsel", m, null, { name: "malzeme" }),
        dual("Ad", m, "name"),
        dual("Metin", m, "text", { rows: 2 }),
        dual("Görsel açıklaması", m, "alt", { rows: 2 }),
      ],
    }),
  ],

  method: () => [
    head("07 · Yöntem", "Yöntem ve paftalar", "Ekip sayfasındaki çalışma adımları ve Projeler sayfasındaki pafta türleri."),
    group("01", "Çalışma adımları", [
      list((S.content.steps ||= []), {
        noun: "Adım", add: "Adım ekle",
        label: (s) => tx(s.title),
        create: () => ({ title: bi(), text: bi() }),
        render: (s) => [dual("Başlık", s, "title"), dual("Metin", s, "text", { rows: 2 })],
      }),
    ]),
    group("02", "Pafta türleri", [
      list((S.content.sheets ||= []), {
        noun: "Pafta türü", add: "Pafta türü ekle",
        label: (s) => tx(s.title),
        create: () => ({ scale: bi(), title: bi(), text: bi() }),
        render: (s) => [dual("Ölçek", s, "scale", { help: "Ör. 1:50 ya da Yerinde" }), dual("Ad", s, "title"), dual("Metin", s, "text", { rows: 2 })],
      }),
    ]),
  ],

  pages: () => {
    const pages = (S.content.pages ||= {});
    const names = { home: "Ana sayfa", projects: "Projeler", team: "Ekip", contact: "İletişim" };
    return [
      head("08 · Sayfa bilgileri", "Sayfa bilgileri", "Google’da ve paylaşımlarda görünen başlık ve açıklamalar. Proje sayfalarınınki, proje başlığından ve ilk paragraftan otomatik yazılır."),
      Object.keys(names).map((k, n) => {
        const pg = (pages[k] ||= {});
        const has = (key) => key in (pg.tr || {}) || key in (pg.en || {});
        const box = group(pad(n + 1), names[k], [
          byLang("Başlık", pg, "title", { count: 60, stack: true }),
          byLang("Açıklama", pg, "description", { rows: 3, stack: true, count: 158, help: k === "projects" ? "{n} çalışma sayısına dönüşür; {n:word} ve {n:Word} sayıyı yazıyla yazar." : null }),
          has("lede") ? byLang("Giriş metni", pg, "lede", { rows: 3, stack: true }) : null,
          has("method") ? byLang("Yöntem metni", pg, "method", { rows: 3, stack: true }) : null,
          has("office") ? byLang("Ofis metni", pg, "office", { rows: 3, stack: true }) : null,
        ]);
        box.addEventListener("focusin", () => showPage({ main: n }));
        return box;
      }),
    ];
  },

  office: () => {
    const o = (S.content.office ||= {});
    const cats = (S.content.categories ||= []);
    const used = (key) => S.content.projects.filter((p) => p.cat === key).length;
    return [
      head("09 · Ofis", "Ofis bilgileri", "Telefon ve adres sitenin her yerinde, haritada ve arama sonuçlarındaki ofis bilgisinde kullanılır."),
      group("01", "Telefon", [
        h("div", { class: "grid2" },
          str("Görünen", o, "phone", { type: "tel" }),
          str("Arama için", o, "tel", { type: "tel", help: "Ülke koduyla, boşluksuz. Ör. +905425190361" })),
      ]),
      group("02", "Adres", [
        h("div", { class: "grid2" },
          str("Mahalle", o, "neighbourhood"),
          str("İlçe", o, "district"),
          str("Sokak ve kapı (kısa)", o, "street", { help: "Ör. Bostanüstü Dere Sok. 34/1" }),
          str("Sokak (uzun)", o, "streetName"),
          str("Kapı", o, "door"),
          str("Şehir", o, "city"),
          str("Posta kodu", o, "postcode", { inputmode: "numeric" })),
      ]),
      group("03", "Ölçekler", [
        list(cats, {
          noun: "Ölçek", add: "Ölçek ekle",
          label: (c) => c.tr,
          canRemove: (c) => used(c.key) === 0,
          create: () => ({ key: unique("olcek", new Set(cats.map((c) => c.key))), tr: "", en: "" }),
          render: (c) => [
            duo("Ad", (lg) => c[lg] ?? "", (lg, v) => { c[lg] = v; touch(); }),
            help(used(c.key) ? `${used(c.key)} projede kullanılıyor; silmek için önce projelerin ölçeğini değiştirin.` : "Hiçbir projede kullanılmıyor."),
          ],
        }),
      ], "Projeler sayfasındaki süzgeç düğmeleri ve proje künyesindeki Ölçek satırı."),
      group("04", "Site", [
        str("Ofis adı", o, "name"),
        str("Site adresi", o, "base", { type: "url", spell: false, help: "Arama motorları ve paylaşımlar için tam adres. Alan adı alınırsa burası değişir." }),
      ]),
    ];
  },
};

/* ---------------------------------------------------------------- layout */

function rail() {
  $("[data-rail]").replaceChildren(
    ...SECTIONS.map((s, i) => h("a", {
      href: "#" + s.id, "aria-current": s.id === S.section ? "page" : null,
      onclick: (e) => { e.preventDefault(); go(s.id); },
    }, h("span", {}, pad(i + 1)), s.name)),
    h("div", { class: "rail-foot" },
      h("p", {}, S.local
        ? "Kaydet, değişiklikleri bu Mac’teki klasöre yazar. Yayınla, GitHub’a gönderir; site birkaç dakika içinde güncellenir."
        : S.remote
          ? "GitHub’a bağlısınız. Kaydet / Yayınla değişiklikleri doğrudan canlı siteye gönderir."
          : "Önizleme modundasınız. Canlıdan yönetmek için üstteki GitHub düğmesiyle bir token bağlayın."),
      S.remote
        ? h("button", { type: "button", class: "btn sm ghost", onclick: connectDialog }, "Bağlantıyı yönet")
        : !S.local
          ? h("button", { type: "button", class: "btn sm", onclick: connectDialog }, "GitHub bağla")
          : null,
      h("a", { href: SITE, target: "_blank", rel: "noopener" }, "Canlı siteyi aç ↗")));
}

function go(id, project = null) {
  S.section = id;
  S.project = id === "projects" ? project : null;
  const pid = S.project != null ? S.content.projects[S.project]?.id : "";
  history.replaceState(null, "", "#" + id + (pid ? "/" + pid : ""));
  rail();
  renderEditor({ top: true });
  follow();
}

function readHash() {
  const [sec, id] = decodeURIComponent(location.hash.slice(1)).split("/");
  if (!SECTIONS.some((s) => s.id === sec)) return;
  S.section = sec;
  if (sec === "projects" && id) {
    const i = S.content.projects.findIndex((p) => p.id === id);
    if (i >= 0) S.project = i;
  }
}

function problemsBox() {
  if (!S.problems.length) return null;
  return h("div", { class: "problems", role: "alert", "data-problems": "" },
    h("strong", {}, "Kaydetmeden önce düzeltilmesi gerekenler"),
    h("ul", {}, S.problems.map((p) => h("li", {}, p))));
}

function refreshProblems() {
  S.problems = checks();
  const old = $("[data-problems]");
  const neu = problemsBox();
  if (old && neu) old.replaceWith(neu);
  else if (old) old.remove();
}

function renderEditor({ top = false } = {}) {
  const ed = $("[data-editor]");
  const y = top ? 0 : ed.scrollTop;
  ed.replaceChildren(...[S.banner, problemsBox(), VIEWS[S.section]()].flat(Infinity).filter(Boolean));
  ed.scrollTop = y;
}

function checks() {
  const out = validate(S.content);
  const home = S.content.home || {};
  if (!(home.slides || []).length) out.push("Açılışta en az bir görsel olmalı");
  (home.slides || []).forEach((s, i) => { if (!s.src) out.push(`Açılış görseli ${i + 1}: görsel seçilmedi`); });
  (S.content.materials || []).forEach((m, i) => { if (!m.src) out.push(`Malzeme ${i + 1}: görsel seçilmedi`); });
  (S.content.studio?.items || []).forEach((m, i) => { if (!m.src) out.push(`Atölye karesi ${i + 1}: görsel seçilmedi`); });
  (S.content.team || []).forEach((m, i) => { if (!String(m.name || "").trim()) out.push(`Ekip ${i + 1}: ad boş`); });
  return out;
}

/* ---------------------------------------------------------------- preview */

const frames = [...document.querySelectorAll("[data-stage] iframe")];
let front = 0;
let shown = "";
let pvToken = 0;

function pvPath() {
  const { ref, lang } = S.pv;
  if (ref.project) {
    const p = S.content.projects.find((q) => q.id === ref.project);
    if (p) return detailPath(p, lang);
  }
  if (ref.path && S.files[ref.path]) return ref.path;
  return MAIN[lang][ref.main ?? 0];
}

function follow() {
  if (S.section === "projects" && S.project != null) S.pv.ref = { project: S.content.projects[S.project]?.id };
  else {
    const page = SECTIONS.find((s) => s.id === S.section)?.page;
    if (page != null) S.pv.ref = { main: page };
  }
  schedulePreview(0);
}

function showPage(ref) {
  if (JSON.stringify(ref) === JSON.stringify(S.pv.ref)) return;
  S.pv.ref = ref;
  schedulePreview(0);
}

function schedulePreview(ms = 280) {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, ms);
}

function withBase(html, path, still) {
  const base = new URL(path.slice(0, path.lastIndexOf("/") + 1), ROOT).href;
  return html.replace(/<head>/i, `<head><base href="${base}">${still ? STILL : ""}`);
}

function pvError(err) {
  $(".pv-error")?.remove();
  if (err) $("[data-stage]").append(h("p", { class: "pv-error" }, "Önizleme oluşturulamadı: " + (err.message || err)));
}

function renderPreview() {
  let out;
  try {
    out = renderSite(S.content, { plans: S.plans, mapSrc: (s) => S.blobs.get(s) });
  } catch (err) {
    pvError(err);
    return;
  }
  pvError(null);
  S.files = out.files;
  const path = pvPath();
  pageSelect(path);
  const html = S.files[path];
  if (!html) return;
  const still = path === shown;
  const cur = frames[front];
  const next = frames[1 - front];
  let y = 0;
  try { if (still) y = cur.contentWindow.scrollY; } catch { y = 0; }
  const token = ++pvToken;
  next.onload = () => {
    if (token !== pvToken) return;
    try {
      const win = next.contentWindow;
      const target = S.pv.hash ? win.document.getElementById(decodeURIComponent(S.pv.hash.slice(1))) : null;
      if (target) target.scrollIntoView();
      else win.scrollTo({ top: y, behavior: "instant" });
      wire(next);
    } catch { /* the page navigated away on its own; the load listener below brings it back */ }
    S.pv.hash = "";
    next.classList.add("is-front");
    cur.classList.remove("is-front");
    next.removeAttribute("tabindex");
    next.removeAttribute("aria-hidden");
    cur.setAttribute("tabindex", "-1");
    cur.setAttribute("aria-hidden", "true");
    front = 1 - front;
    shown = path;
    setTimeout(() => { if (token === pvToken) cur.srcdoc = BLANK; }, 250);
    snippet(html, path);
  };
  next.srcdoc = withBase(html, path, still);
}

function sitePath(url) {
  if (url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return null;
  let p = decodeURIComponent(url.pathname.slice(ROOT.pathname.length));
  if (!p || p.endsWith("/")) p += "index.html";
  return S.files[p] ? p : null;
}

function navTo(path, hash = "") {
  const lang = path.startsWith("en/") ? "en" : "tr";
  const main = MAIN[lang].indexOf(path);
  const p = S.content.projects.find((q) => detailPath(q, lang) === path);
  S.pv.lang = lang;
  S.pv.ref = main >= 0 ? { main } : p ? { project: p.id } : { path };
  S.pv.hash = hash;
  if (path === shown) shown = "";
  segs();
  renderPreview();
}

function wire(frame) {
  const doc = frame.contentDocument;
  doc.addEventListener("click", (e) => {
    const a = e.target.closest?.("a[href]");
    if (!a || e.defaultPrevented) return;
    const href = a.getAttribute("href");
    if (href.startsWith("#")) {
      e.preventDefault();
      doc.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    const url = new URL(a.href, doc.baseURI);
    e.preventDefault();
    if (!/^https?:$/.test(url.protocol)) return;
    const path = sitePath(url);
    if (path) navTo(path, url.hash);
    else window.open(url.href, "_blank", "noopener");
  });
}

frames.forEach((f) => f.addEventListener("load", () => {
  let href = "";
  try { href = f.contentWindow.location.href; } catch { href = ""; }
  if (!href || href.startsWith("about:")) return;
  const url = new URL(href);
  const path = sitePath(url);
  if (path) navTo(path, url.hash);
}));

function pageSelect(path) {
  const sel = $("[data-page]");
  const lg = S.pv.lang;
  const pages = MAIN[lg].map((p, i) => [p, MAIN_NAMES[i]]);
  const projects = S.content.projects.map((q, i) => [detailPath(q, lg), `${pad(i + 1)} · ${tx(q.title, lg) || "Adsız"}`]);
  const key = JSON.stringify([pages, projects]);
  if (sel.dataset.key !== key) {
    sel.replaceChildren(
      h("optgroup", { label: "Sayfalar" }, pages.map(([v, n]) => h("option", { value: v }, n))),
      h("optgroup", { label: "Projeler" }, projects.map(([v, n]) => h("option", { value: v }, n))));
    sel.dataset.key = key;
  }
  sel.value = path;
}

function snippet(html, path) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const title = doc.title.trim();
  const desc = doc.querySelector('meta[name="description"]')?.content.trim() || "";
  const url = (S.content.office?.base || SITE) + path.replace(/(^|\/)index\.html$/, "$1");
  const count = (n, max) => (n > max ? h("b", {}, `${n}/${max}`) : `${n}/${max}`);
  $("[data-snippet]").replaceChildren(
    h("p", { class: "kicker" }, "Google’da görünüm"),
    h("p", { class: "s-url" }, url.replace(/^https?:\/\//, "").replace(/\/$/, "").split("/").join(" › ")),
    h("p", { class: "s-title" }, title),
    h("p", { class: "s-desc" }, desc),
    h("p", { class: "s-count" }, "Başlık ", count(title.length, 60), " · Açıklama ", count(desc.length, 158)));
}

function fit() {
  const stage = $("[data-stage]");
  const phone = S.pv.device === "phone";
  const W = phone ? 390 : 1440;
  const H = phone ? 844 : 900;
  stage.classList.toggle("is-phone", phone);
  stage.style.aspectRatio = phone ? "" : `${W} / ${H}`;
  stage.style.flex = phone ? "1" : "0 1 auto";
  const r = stage.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const s = phone ? Math.min(1, (r.height - 36) / H, (r.width - 48) / W) : Math.min(r.width / W, r.height / H);
  stage.style.setProperty("--w", W + "px");
  stage.style.setProperty("--h", H + "px");
  stage.style.setProperty("--s", String(s));
}

function segs() {
  for (const [sel, val] of [["[data-lang]", S.pv.lang], ["[data-device]", S.pv.device]]) {
    $(sel).querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === val)));
  }
}

function setupPreview() {
  $("[data-page]").addEventListener("change", (e) => navTo(e.target.value));
  $("[data-lang]").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || b.dataset.v === S.pv.lang) return;
    S.pv.lang = b.dataset.v;
    segs();
    renderPreview();
  });
  $("[data-device]").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    S.pv.device = b.dataset.v;
    segs();
    fit();
  });
  $("[data-open]").addEventListener("click", () => {
    const path = pvPath();
    if (!S.files[path]) return;
    const url = URL.createObjectURL(new Blob([withBase(S.files[path], path, false)], { type: "text/html" }));
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
  new ResizeObserver(fit).observe($("[data-stage]"));
  fit();
}

/* ---------------------------------------------------------------- save and publish */

async function save({ quiet = false, message = "İçerik güncellemesi" } = {}) {
  if (!canWrite() || S.saving) return false;
  S.problems = checks();
  if (S.problems.length) {
    renderEditor({ top: true });
    toast("Kaydedilmedi: önce eksikleri tamamlayın", true);
    return false;
  }
  S.saving = true;
  status(S.remote ? "GitHub’a gönderiliyor…" : "Kaydediliyor…");
  try {
    if (S.local) {
      const { files } = renderSite(S.content, { plans: S.plans });
      for (const src of S.dirtyPlans) files[src] = S.plans[src];
      const res = await api("save", { content: pretty(S.content), files }, true);
      S.savedRaw = JSON.stringify(S.content);
      S.dirtyPlans.clear();
      localStorage.removeItem(DRAFT);
      if (!quiet) toast(`Kaydedildi · ${Object.keys(files).length} dosya${res.removed?.length ? ` · ${res.removed.length} eski sayfa kaldırıldı` : ""}`);
    } else {
      const sha = await remotePublish(message);
      S.savedRaw = JSON.stringify(S.content);
      S.dirtyPlans.clear();
      S.pendingBlobs.clear();
      localStorage.removeItem(DRAFT);
      S.unpublished = false;
      if (!quiet) toast(sha ? `Yayınlandı · ${sha}` : "Gönderilecek yeni değişiklik yoktu");
    }
    refreshProblems();
    return true;
  } catch (err) {
    toast((S.remote ? "Gönderilemedi: " : "Kaydedilemedi: ") + err.message, true);
    return false;
  } finally {
    S.saving = false;
    status();
    refreshGit();
  }
}

function publishDialog() {
  const dlg = $("[data-publish-dialog]");
  const msg = h("input", { type: "text", value: "İçerik güncellemesi", maxlength: "200" });
  const body = h("div", { class: "dlg-body" },
    h("p", {}, S.remote
      ? (dirty() ? "Değişiklikler GitHub’a tek commit olarak gönderilecek; canlı site birkaç dakika içinde güncellenir." : "Gönderilecek kayıtlı değişiklik yok.")
      : (dirty() ? "Değişiklikler önce kaydedilecek, sonra GitHub’a gönderilecek." : "Kaydedilmiş değişiklikler GitHub’a gönderilecek.")),
    h("p", { class: "quiet small" }, "Canlı site birkaç dakika içinde güncellenir."),
    h("label", { class: "field" }, h("span", { class: "f-label" }, "Değişiklik notu"), msg));
  const cancel = h("button", { type: "button", class: "btn ghost", onclick: () => dlg.close() }, "Vazgeç");
  const send = h("button", { type: "button", class: "btn red" }, "Yayınla");
  const foot = h("div", { class: "dlg-foot" }, cancel, send);
  const lock = (on) => { send.disabled = cancel.disabled = msg.disabled = on; };
  send.addEventListener("click", async () => {
    if (S.remote && !dirty()) {
      body.replaceChildren(h("div", { class: "pub-ok" },
        h("p", { class: "kicker" }, "Gönderilecek yeni değişiklik yoktu"),
        h("p", {}, h("a", { href: SITE, target: "_blank", rel: "noopener" }, "Canlı siteyi aç ↗"))));
      foot.replaceChildren(h("button", { type: "button", class: "btn", onclick: () => dlg.close() }, "Tamam"));
      return;
    }
    lock(true);
    const busy = h("p", { class: "busy" }, S.remote || dirty() ? "GitHub’a gönderiliyor…" : "GitHub’a gönderiliyor…");
    body.append(busy);
    try {
      if (S.remote) {
        if (!(await save({ quiet: true, message: msg.value }))) { busy.remove(); lock(false); return; }
        body.replaceChildren(h("div", { class: "pub-ok" },
          h("p", { class: "kicker" }, "Gönderildi"),
          h("p", {}, "GitHub Pages siteyi birkaç dakika içinde günceller."),
          h("p", {}, h("a", { href: SITE, target: "_blank", rel: "noopener" }, "Canlı siteyi aç ↗"))));
      } else {
        if (dirty() && !(await save({ quiet: true }))) { busy.remove(); lock(false); return; }
        busy.textContent = "GitHub’a gönderiliyor…";
        const r = await api("publish", { message: msg.value }, true);
        body.replaceChildren(h("div", { class: "pub-ok" },
          h("p", { class: "kicker" }, r.committed ? `Gönderildi · ${r.commit}` : "Gönderilecek yeni değişiklik yoktu"),
          h("p", {}, "GitHub Pages siteyi birkaç dakika içinde günceller."),
          h("p", {}, h("a", { href: SITE, target: "_blank", rel: "noopener" }, "Canlı siteyi aç ↗"))));
      }
      foot.replaceChildren(h("button", { type: "button", class: "btn", onclick: () => dlg.close() }, "Tamam"));
    } catch (err) {
      busy.remove();
      body.querySelectorAll(".problems, .log").forEach((el) => el.remove());
      body.append(h("div", { class: "problems" }, h("strong", {}, "Gönderilemedi"), err.message));
      if (err.log) body.append(h("pre", { class: "log" }, err.log));
      lock(false);
    }
    refreshGit();
  });
  dlg.replaceChildren(
    h("div", { class: "dlg-head" }, h("h2", { id: "publish-title" }, "Yayınla"), h("button", { type: "button", class: "icon", "aria-label": "Kapat", onclick: () => dlg.close() }, "✕")),
    body,
    foot);
  dlg.onclose = null;
  dlg.onclick = null;
  dlg.showModal();
  msg.select();
}

function connectDialog() {
  const dlg = $("[data-publish-dialog]");
  const input = h("input", {
    type: "password",
    value: tokenGet(),
    placeholder: "ghp_… ya da github_pat_…",
    autocomplete: "off",
    spellcheck: "false",
  });
  const body = h("div", { class: "dlg-body" },
    h("p", {}, "Canlı panelden kaydetmek için GitHub kişisel erişim anahtarı (token) gerekir. Token yalnızca bu tarayıcıda saklanır; site dosyalarına yazılmaz."),
    h("ol", { class: "token-steps" },
      h("li", {}, h("a", { href: "https://github.com/settings/personal-access-tokens/new", target: "_blank", rel: "noopener" }, "Fine-grained token oluştur ↗")),
      h("li", {}, `Repository access: yalnızca ${GH_OWNER}/${GH_REPO}`),
      h("li", {}, "Permissions → Repository → Contents: Read and write"),
      h("li", {}, "Oluşturulan anahtarı aşağıya yapıştırın")),
    h("label", { class: "field" }, h("span", { class: "f-label" }, "GitHub token"), input),
    h("p", { class: "quiet small" }, "Bu bilgisayarı başkası da kullanıyorsa işiniz bitince Bağlantıyı kesin."));
  const cancel = h("button", { type: "button", class: "btn ghost", onclick: () => dlg.close() }, "Vazgeç");
  const clear = h("button", {
    type: "button", class: "btn danger", hidden: !tokenGet(),
    onclick: async () => {
      tokenSet("");
      S.remote = false;
      S.unpublished = null;
      syncChrome();
      rail();
      dlg.close();
      toast("GitHub bağlantısı kesildi");
    },
  }, "Bağlantıyı kes");
  const saveBtn = h("button", { type: "button", class: "btn" }, "Bağla");
  const foot = h("div", { class: "dlg-foot" }, clear, cancel, saveBtn);
  saveBtn.addEventListener("click", async () => {
    const value = input.value.trim();
    if (!value) { toast("Token boş olamaz", true); return; }
    saveBtn.disabled = cancel.disabled = input.disabled = true;
    const busy = h("p", { class: "busy" }, "Token kontrol ediliyor…");
    body.append(busy);
    const prev = tokenGet();
    tokenSet(value);
    try {
      await ghVerify();
      S.images = await ghListImages().catch(() => S.images);
      S.remote = true;
      syncChrome();
      rail();
      refreshGit();
      dlg.close();
      toast("GitHub bağlandı · artık kaydedebilirsiniz");
    } catch (err) {
      tokenSet(prev);
      busy.remove();
      body.querySelectorAll(".problems").forEach((el) => el.remove());
      body.append(h("div", { class: "problems" }, h("strong", {}, "Bağlanamadı"), err.message));
      saveBtn.disabled = cancel.disabled = input.disabled = false;
    }
  });
  dlg.replaceChildren(
    h("div", { class: "dlg-head" }, h("h2", { id: "publish-title" }, "GitHub bağlantısı"), h("button", { type: "button", class: "icon", "aria-label": "Kapat", onclick: () => dlg.close() }, "✕")),
    body,
    foot);
  dlg.onclose = null;
  dlg.onclick = null;
  dlg.showModal();
  input.focus();
  input.select();
}

function syncChrome() {
  const mode = $("[data-mode]");
  mode.hidden = false;
  if (S.local) {
    mode.textContent = "Yerel · kaydedilebilir";
    mode.title = "Bu Mac’teki site klasörüne kaydeder ve GitHub’a gönderir.";
  } else if (S.remote) {
    mode.textContent = "Çevrimiçi · bağlı";
    mode.title = "GitHub token bu tarayıcıda saklı. Kaydet / Yayınla doğrudan depoya yazar.";
  } else {
    mode.textContent = "Çevrimiçi · bağlanmamış";
    mode.title = "Canlıdan yönetmek için GitHub token bağlayın.";
  }
  $("[data-connect]").hidden = S.local;
  $("[data-connect]").textContent = S.remote ? "Bağlı" : "GitHub";
  $("[data-save]").hidden = !canWrite();
  $("[data-publish]").hidden = !canWrite();
  $("[data-download]").hidden = canWrite();
  $("[data-mode]").style.cursor = S.local ? "" : "pointer";
  status();
}

function downloadDraft() {
  const a = h("a", { href: URL.createObjectURL(new Blob([pretty(S.content) + "\n"], { type: "application/json" })), download: "site.json" });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("site.json indirildi. content/ klasöründekinin yerine konabilir.");
}

/* ---------------------------------------------------------------- start */

function setupChrome() {
  syncChrome();
  $("[data-save]").addEventListener("click", () => save());
  $("[data-publish]").addEventListener("click", publishDialog);
  $("[data-download]").addEventListener("click", downloadDraft);
  $("[data-connect]").addEventListener("click", connectDialog);
  $("[data-mode]").addEventListener("click", () => { if (!S.local) connectDialog(); });
  $("[data-mode]").style.cursor = S.local ? "" : "pointer";
  $("[data-undo]").addEventListener("click", undo);
  $("[data-redo]").addEventListener("click", redo);
  const pvBtn = $("[data-pv-toggle]");
  pvBtn.addEventListener("click", () => {
    const open = document.body.classList.toggle("pv-open");
    pvBtn.setAttribute("aria-expanded", String(open));
    pvBtn.textContent = open ? "Önizlemeyi kapat" : "Önizleme";
    requestAnimationFrame(fit);
  });
  addEventListener("keydown", (e) => {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (mod && key === "s") {
      e.preventDefault();
      if (canWrite()) save();
      else downloadDraft();
    } else if (mod && key === "z" && !e.target.closest("input, textarea, select")) {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
  });
  addEventListener("beforeunload", (e) => {
    if (canWrite() && dirty()) e.preventDefault();
  });
}

async function ping() {
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return false;
  try {
    const res = await fetch("/api/ping", { headers: { "X-Toz": "1" }, cache: "no-store" });
    return res.ok && (await res.json()).app === "toz-admin";
  } catch {
    return false;
  }
}

async function loadPlans() {
  await Promise.all(planSources(S.content).filter((src) => !(src in S.plans)).map(async (src) => {
    try {
      const res = await fetch(new URL(src, ROOT), { cache: "no-store" });
      S.plans[src] = res.ok ? await res.text() : "";
    } catch {
      S.plans[src] = "";
    }
  }));
}

async function bootRemote() {
  if (!tokenGet()) return;
  try {
    await ghVerify();
    S.remote = true;
    S.images = await ghListImages().catch(() => []);
  } catch {
    S.remote = false;
  }
}

async function boot() {
  const [content, local] = await Promise.all([
    fetch(new URL("content/site.json", ROOT), { cache: "no-store" }).then((res) => {
      if (!res.ok) throw new Error("content/site.json okunamadı.");
      return res.json();
    }),
    ping(),
  ]);
  S.content = content;
  S.content.projects ||= [];
  S.savedRaw = S.lastSnap = JSON.stringify(content);
  S.local = local;
  await loadPlans();
  if (local) S.images = (await api("images").catch(() => ({ images: [] }))).images;
  else await bootRemote();
  readHash();
  setupChrome();
  rail();
  renderEditor();
  setupPreview();
  follow();
  status();
  offerDraft();
  refreshGit();
}

boot().catch((err) => {
  $("[data-editor]").replaceChildren(h("div", { class: "problems", role: "alert" }, h("strong", {}, "Panel açılamadı"), String(err.message || err)));
});
