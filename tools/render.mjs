/* toz+ architects — page renderer.
   Turns content/site.json into every page of the site. Pure ESM without Node or DOM APIs:
   tools/build.mjs runs it from the command line, /admin runs it in the browser to preview and save. */

export const LANGS = ["tr", "en"];
export const LAYERS = ["mevcut", "sokulen", "yeni", "not"];

const UI = {
  tr: {
    code: "tr", hl: "tr-TR", og: "tr_TR", ogAlt: "en_US", other: "en", root: "", detailDir: "projeler/",
    files: ["index.html", "projeler.html", "ekip.html", "iletisim.html"],
    names: ["Ana sayfa", "Projeler", "Ekip", "İletişim"],
    skip: "İçeriğe geç", nav: "Sayfalar", menu: "Menü", close: "Kapat", closeLabel: "Menüyü kapat",
    homeLabel: "toz+ architects, ana sayfa", langShort: "EN", langLong: "English",
    next: "Sonraki", prev: "Önceki", sheet: "Pafta", hint: "← Kaydırarak geçin →", nextLabel: "Sonraki sayfa",
    phone: "Telefon", place: "Yer", office: "Ofis", pages: "Sayfalar", time: "İstanbul", lang: "Dil",
    visits: "Görüşme", hour: "Saat", call: "Ara", maps: "Haritada aç", mapTitle: "Harita",
    heroRegion: "Açılış görselleri", heroCard: "Görsel ve çalışma", prevImg: "Önceki görsel", nextImg: "Sonraki görsel",
    pause: "Görselleri durdur", study: "Çalışma", studies: (n) => `${n} çalışma`,
    works: "Çalışmalar", all: "Tümü", people: "Ekip", peopleMore: "Ekip sayfası",
    materials: "Malzeme", stripLabel: "Malzeme kareleri, yatay kaydırılır", prevMat: "Önceki malzeme", nextMat: "Sonraki malzeme",
    sheets: "Paftalar", sheetsNote: "Bir işin çizim seti", drawings: "Çizimler", layers: "Katmanlar",
    layerNames: { mevcut: "Mevcut", sokulen: "Sökülen", yeni: "Yeni", not: "Notlar" },
    legend: "Mevcut siyah, sökülen sarı, yeni kırmızı",
    sheetLbl: "Pafta", drawingLbl: "Çizim", projectLbl: "Proje", statusLbl: "Durum", catLbl: "Ölçek", whatLbl: "Konu",
    yearLbl: "Yıl", placeLbl: "Yer", areaLbl: "Alan", full: "Tam ekran", toSheet: "Paftaya git",
    filt: "Ölçeğe göre süz", view: "Görünüm", grid: "Kare", plan: "Plan", list: "Liste", index: "Çalışma dizini",
    studio: "Atölye", studioNote: "Masadaki araçlar",
    stats: ["Çalışma", "Ölçek", "Kişi", "Rölöve"], statsLabel: "Ofis sayılarla",
    crumbs: "Konum", pins: "Görseldeki notlar", gallery: "Görseller", projNav: "Çalışmalar arasında",
    allProjects: "Tüm projeler", prevStudy: "Önceki çalışma", nextStudy: "Sonraki çalışma",
    members: "Ekip üyeleri", method: "Yöntem", officeDetails: "Ofis bilgisi", lead: "Baş mimar",
    teamKicker: (n) => `Pafta 02 · ${n} kişi`, contactKicker: "Pafta 03 · Abbasağa, Beşiktaş",
    plate: ["Mahalle", "Sokak", "Kapı", "İlçe", "Kent", "Posta"],
    note: "Not", genre: "Mimari çalışma",
  },
  en: {
    code: "en", hl: "en", og: "en_US", ogAlt: "tr_TR", other: "tr", root: "en/", detailDir: "projects/",
    files: ["index.html", "projects.html", "team.html", "contact.html"],
    names: ["Home", "Projects", "Team", "Contact"],
    skip: "Skip to content", nav: "Pages", menu: "Menu", close: "Close", closeLabel: "Close menu",
    homeLabel: "toz+ architects, home", langShort: "TR", langLong: "Türkçe",
    next: "Next", prev: "Previous", sheet: "Sheet", hint: "← Swipe to turn →", nextLabel: "Next page",
    phone: "Phone", place: "Place", office: "Office", pages: "Pages", time: "Istanbul", lang: "Language",
    visits: "Visits", hour: "Time", call: "Call", maps: "Open in maps", mapTitle: "Map",
    heroRegion: "Opening images", heroCard: "Image and study", prevImg: "Previous image", nextImg: "Next image",
    pause: "Pause images", study: "Study", studies: (n) => `${n} ${n === 1 ? "study" : "studies"}`,
    works: "Studies", all: "All", people: "Team", peopleMore: "Team page",
    materials: "Material", stripLabel: "Material photographs, scroll sideways", prevMat: "Previous material", nextMat: "Next material",
    sheets: "Sheets", sheetsNote: "The drawing set of a job", drawings: "Drawings", layers: "Layers",
    layerNames: { mevcut: "Existing", sokulen: "Removed", yeni: "New", not: "Notes" },
    legend: "Existing black, removed yellow, new red",
    sheetLbl: "Sheet", drawingLbl: "Drawing", projectLbl: "Project", statusLbl: "Status", catLbl: "Scale", whatLbl: "Subject",
    yearLbl: "Year", placeLbl: "Place", areaLbl: "Area", full: "Full screen", toSheet: "Go to the sheet",
    filt: "Filter by scale", view: "View", grid: "Grid", plan: "Plan", list: "List", index: "Index of studies",
    studio: "Studio", studioNote: "Tools on the table",
    stats: ["Studies", "Scales", "People", "Survey"], statsLabel: "The office in numbers",
    crumbs: "Location", pins: "Notes on the image", gallery: "Images", projNav: "Between studies",
    allProjects: "All projects", prevStudy: "Previous study", nextStudy: "Next study",
    members: "Team members", method: "Method", officeDetails: "Studio details", lead: "Head architect",
    teamKicker: (n) => `Sheet 02 · ${n} ${n === 1 ? "person" : "people"}`, contactKicker: "Sheet 03 · Abbasağa, Beşiktaş",
    plate: ["Neighbourhood", "Street", "No.", "District", "City", "Postcode"],
    note: "Note", genre: "Architectural study",
  },
};

const WORDS = {
  tr: ["sıfır", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz", "on",
    "on bir", "on iki", "on üç", "on dört", "on beş", "on altı", "on yedi", "on sekiz", "on dokuz", "yirmi"],
  en: ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"],
};

/* ---------------------------------------------------------------- helpers */

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (s) => esc(s).replace(/"/g, "&quot;");
const pad = (n) => String(n).padStart(2, "0");
const tx = (o, lg) => (o && typeof o === "object" ? (o[lg] ?? "") : (o ?? ""));
const br = (s) => esc(s).replace(/\r?\n/g, "<br>");
const num = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
const ld = (o) => JSON.stringify(o, null, 2).replace(/<\//g, "<\\/");

const fill = (s, lg, n) => String(s ?? "").replace(/\{n(?::(word|Word))?\}/g, (_, w) => {
  if (!w) return String(n);
  const word = WORDS[lg][n] ?? String(n);
  return w === "Word" ? word.charAt(0).toLocaleUpperCase(lg === "tr" ? "tr-TR" : "en") + word.slice(1) : word;
});

const clip = (s, n = 158) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:·—-]+$/, "") + "…";
};

const rel = (from, to) => {
  const dir = from.split("/").slice(0, -1);
  const parts = to.split("/");
  let i = 0;
  while (i < dir.length && i < parts.length - 1 && dir[i] === parts[i]) i++;
  return "../".repeat(dir.length - i) + parts.slice(i).join("/");
};

export const slugify = (s) => String(s ?? "")
  .toLocaleLowerCase("tr-TR")
  .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
  .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  .slice(0, 60);

/* ---------------------------------------------------------------- drawings */

/* Plans are inlined so their layers can be switched. Anything that could run code is removed,
   and drawings that carry their own CSS fall back to an <img>, so their styles cannot leak into the page. */
export function cleanSvg(raw) {
  let s = String(raw ?? "");
  s = s.replace(/<\?xml[\s\S]*?\?>/gi, "").replace(/<!DOCTYPE[\s\S]*?>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<(script|foreignObject|iframe|object|embed|audio|video)\b[\s\S]*?<\/\1\s*>/gi, "");
  s = s.replace(/<(script|foreignObject|iframe|object|embed|audio|video)\b[^>]*\/?>/gi, "");
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/\s(?:xlink:)?href\s*=\s*("\s*(?:javascript|data):[^"]*"|'\s*(?:javascript|data):[^']*')/gi, "");
  const m = s.match(/<svg\b[^>]*>[\s\S]*<\/svg>/i);
  if (!m) return "";
  return m[0].trim().replace(/^<svg\b([^>]*)>/i, (_, at) => {
    const keep = at.replace(/\s(width|height|class|style|role|aria-[a-z]+|focusable)\s*=\s*("[^"]*"|'[^']*')/gi, "");
    return `<svg${keep} class="plan-svg" aria-hidden="true" focusable="false">`;
  });
}

const inlineable = (svg) => !!svg && !/<style\b|\sclass\s*=|\sid\s*=/i.test(svg.replace(/^<svg\b[^>]*>/i, ""));

const localize = (svg, lg) => svg.replace(
  /<text\b([^>]*?)\sdata-en="([^"]*)"([^>]*)>([^<]*)<\/text>/g,
  (_, pre, en, post, t) => `<text${pre}${post}>${lg === "en" ? en : t}</text>`,
);

/* ---------------------------------------------------------------- site context */

function context(content, opts) {
  const office = content.office || {};
  const base = (office.base || "https://feridunalacam.github.io/toz-architects/").replace(/\/?$/, "/");
  const projects = (content.projects || []).map((p, i) => ({ ...p, i }));
  const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
  const plans = {};
  for (const p of projects) {
    const src = p.plan?.src;
    if (!src || plans[src] !== undefined) continue;
    const raw = opts.plans?.[src];
    plans[src] = raw ? cleanSvg(raw) : "";
  }
  const q = encodeURIComponent(`${office.neighbourhood}, ${office.street}, ${office.district}, ${office.city}`);
  const c = {
    content, opts, office, base, projects, byId, plans,
    home: content.home || {}, team: content.team || [], cats: content.categories || [],
    maps: `https://www.google.com/maps/search/?api=1&query=${q}`,
    embed: `https://maps.google.com/maps?q=${q}&z=16&output=embed`,
    line: `${office.neighbourhood}, ${office.street}, ${office.district} ${office.city}`,
    date: opts.date || new Date().toISOString().slice(0, 10),
  };
  c.main = (lg, i) => UI[lg].root + UI[lg].files[i];
  c.detail = (lg, p) => UI[lg].root + UI[lg].detailDir + (p.slug?.[lg] || slugify(tx(p.title, lg)) || p.id) + ".html";
  c.url = (path) => base + path.replace(/(^|\/)index\.html$/, "$1");
  c.abs = (src) => (/^https?:/i.test(src) ? src : base + src);
  c.cat = (key, lg) => tx(c.cats.find((k) => k.key === key), lg) || key;
  c.svg = (p, lg) => {
    const s = plans[p.plan?.src];
    return s && inlineable(s) ? localize(s, lg) : "";
  };
  c.layers = (p) => {
    const s = plans[p.plan?.src] || "";
    return LAYERS.filter((l) => s.includes(`data-layer="${l}"`));
  };
  c.sheetNo = (p) => `01.${p.i + 1}`;
  return c;
}

function pageOf(c, lg, path, extra) {
  const a = "../".repeat(path.split("/").length - 1);
  return {
    lg, path, a, u: UI[lg],
    main: (i) => rel(path, c.main(lg, i)),
    detail: (p, l = lg) => rel(path, c.detail(l, p)),
    to: (p) => rel(path, p),
    src: (s) => (!s ? "" : /^(https?:|blob:|data:)/i.test(s) ? s : c.opts.mapSrc?.(s) ?? a + s),
    ...extra,
  };
}

/* ---------------------------------------------------------------- shared parts */

const HEAD_SCRIPT = `
    document.documentElement.classList.add("js");
    addEventListener("pageswap", function () {
      sessionStorage.setItem("toz-sheet", document.documentElement.dataset.sheet);
    });
    addEventListener("pagereveal", function (e) {
      var vt = e.viewTransition, html = document.documentElement;
      var from = sessionStorage.getItem("toz-sheet"), to = html.dataset.sheet;
      if (!vt || from === null || from === to) return;
      var f = from.split("."), t = to.split(".");
      if (f[1] && t[1]) {
        var n = +html.dataset.count || 1, d = (t[1] - f[1] + n) % n;
        vt.types.add(d <= n / 2 ? "forward" : "back");
        return;
      }
      if ((f[1] && !t[1] && t[0] < 2) || (t[1] && !f[1] && f[0] < 2)) {
        vt.types.add("proj");
        var a = window.navigation && navigation.activation;
        var key = f[1] && a && a.from && a.from.url ? a.from.url.split(/[?#]/)[0].split("/").pop().replace(/\\.html$/, "") : "";
        if (key) {
          var s = document.createElement("style");
          s.textContent = '[data-vt="' + key.replace(/[^\\w-]/g, "") + '"]{view-transition-name:proj}';
          document.head.append(s);
          vt.finished.finally(function () { s.remove(); });
        }
        return;
      }
      var k = (t[0] - f[0] + 4) % 4;
      vt.types.add(k === 1 || (k === 2 && +t[0] > +f[0]) ? "forward" : "back");
    });
  `;

function graph(c, lg, pg, page) {
  const o = c.office, B = c.base, u = UI[lg];
  const g = [
    {
      "@type": "ProfessionalService",
      "@id": B + "#studio",
      name: o.name,
      alternateName: ["Toz Architects", "toz architects", "Toz+ Architects"],
      url: B,
      image: B + "assets/og.jpg",
      logo: B + "assets/logo.png",
      telephone: o.tel,
      address: {
        "@type": "PostalAddress",
        streetAddress: `${o.neighbourhood}, ${o.street}`,
        addressLocality: o.district,
        addressRegion: o.city,
        postalCode: o.postcode,
        addressCountry: "TR",
      },
      areaServed: [{ "@type": "City", name: "İstanbul" }, { "@type": "AdministrativeArea", name: "Beşiktaş" }],
      hasMap: c.maps,
      knowsLanguage: ["tr", "en"],
      employee: c.team.map((m) => {
        const person = { "@type": "Person", name: m.name };
        const generic = ["ekip", "studio", ""].includes(String(m.role?.tr || "").toLowerCase());
        if (!generic) person.jobTitle = [m.role.tr, m.role.en].filter(Boolean);
        if (m.photo?.src) person.image = c.abs(m.photo.src);
        return person;
      }),
      description: lg === "tr"
        ? "Beşiktaş Abbasağa’da mimarlık ofisi. Konut, iç mekân, mevcut yapı ve küçük kamusal işler."
        : "Architecture office in Abbasağa, Beşiktaş. Housing, interiors, existing buildings and small civic work.",
    },
    { "@type": "WebSite", "@id": B + "#website", url: B, name: o.name, inLanguage: ["tr-TR", "en"], publisher: { "@id": B + "#studio" } },
    {
      "@type": "WebPage",
      "@id": c.url(pg.path) + "#webpage",
      url: c.url(pg.path),
      name: page.title,
      description: page.desc,
      inLanguage: u.hl,
      isPartOf: { "@id": B + "#website" },
      about: { "@id": page.work ? c.url(pg.path) + "#work" : B + "#studio" },
    },
  ];
  if (page.crumbs?.length) {
    g.push({
      "@type": "BreadcrumbList",
      itemListElement: page.crumbs.map(([name, path], k) => ({ "@type": "ListItem", position: k + 1, name, item: c.url(path) })),
    });
  }
  if (page.work) g.push(page.work);
  return { "@context": "https://schema.org", "@graph": g };
}

function head(c, pg, page) {
  const u = pg.u, a = pg.a;
  const url = c.url(pg.path);
  const og = page.og || { src: "assets/og.jpg", w: 1200, h: 630, alt: "toz+ architects, Beşiktaş, İstanbul" };
  const ogImg = c.abs(og.src);
  const fonts = ["schibsted-700-latin", "schibsted-700-latin-ext", "schibsted-500-latin", "schibsted-400-latin"]
    .map((f) => `  <link rel="preload" href="${a}assets/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin>`).join("\n");
  let preload = "";
  if (page.preload) {
    const im = page.preload;
    const set = im.small ? ` imagesrcset="${attr(pg.src(im.small))} 960w, ${attr(pg.src(im.src))} ${im.w}w" imagesizes="100vw"` : "";
    preload = `\n  <link rel="preload" as="image" href="${attr(pg.src(im.src))}"${set} fetchpriority="high">`;
  }
  const rels = (page.prev ? `\n  <link rel="prev" href="${attr(page.prev)}">` : "") + (page.next ? `\n  <link rel="next" href="${attr(page.next)}">` : "");
  return `<!DOCTYPE html>
<html lang="${u.code}" data-sheet="${page.sheet}"${page.count ? ` data-count="${page.count}"` : ""}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(page.title)}</title>
  <meta name="description" content="${attr(page.desc)}">
  <meta name="author" content="toz+ architects">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="theme-color" content="#f4f3f0">
  <meta name="geo.region" content="TR-34">
  <meta name="geo.placename" content="Beşiktaş, İstanbul">
  <link rel="canonical" href="${attr(url)}">
  <link rel="alternate" hreflang="x-default" href="${attr(c.url(page.alt.tr))}">
  <link rel="alternate" hreflang="tr" href="${attr(c.url(page.alt.tr))}">
  <link rel="alternate" hreflang="en" href="${attr(c.url(page.alt.en))}">
  <meta property="og:locale" content="${u.og}">
  <meta property="og:locale:alternate" content="${u.ogAlt}">
  <meta property="og:type" content="${page.ogType || "website"}">
  <meta property="og:site_name" content="toz+ architects">
  <meta property="og:title" content="${attr(page.title)}">
  <meta property="og:description" content="${attr(page.desc)}">
  <meta property="og:url" content="${attr(url)}">
  <meta property="og:image" content="${attr(ogImg)}">
  <meta property="og:image:width" content="${og.w}">
  <meta property="og:image:height" content="${og.h}">
  <meta property="og:image:alt" content="${attr(og.alt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${attr(page.title)}">
  <meta name="twitter:description" content="${attr(page.desc)}">
  <meta name="twitter:image" content="${attr(ogImg)}">
  <link rel="icon" href="${a}favicon.svg" type="image/svg+xml">
  <link rel="icon" href="${a}assets/favicon-32.png" type="image/png" sizes="32x32">
  <link rel="apple-touch-icon" href="${a}assets/apple-touch-icon.png">
  <link rel="manifest" href="${a}site.webmanifest">
${fonts}${preload}${rels}
  <link rel="stylesheet" href="${a}css/site.css">
  <script>${HEAD_SCRIPT}</script>${page.headExtra || ""}
  <script src="${a}js/site.js" defer></script>
  <script type="application/ld+json">
${ld(graph(c, pg.lg, pg, page))}
  </script>
</head>`;
}

function topbar(c, pg, page) {
  const u = pg.u, a = pg.a;
  const links = [1, 2, 3].map((j) => {
    const cur = page.nav === j ? (page.sheet.includes(".") ? ' aria-current="true"' : ' aria-current="page"') : "";
    return `        <a href="${pg.main(j)}"${cur}>${esc(u.names[j])}</a>`;
  }).join("\n");
  const other = UI[u.other];
  return `  <a class="skip" href="#icerik">${u.skip}</a>
  <header class="topbar${page.dark ? " on-dark" : ""}" data-topbar>
    <div class="liquid" data-liquid>
      <a class="brand" href="${pg.main(0)}" aria-label="${u.homeLabel}"${page.nav === 0 ? ' aria-current="page"' : ""}>
        <img class="logo-dark" src="${a}assets/logo.png" width="935" height="170" alt="toz+ architects">
        <img class="logo-light" src="${a}assets/logo-light.png" width="935" height="170" alt="">
      </a>
      <nav class="nav" aria-label="${u.nav}">
${links}
      </nav>
      <a class="lang" href="${pg.to(page.alt[u.other])}" hreflang="${other.code}" lang="${other.code}">${u.langShort}</a>
      <button class="menu-btn" type="button" aria-haspopup="dialog" aria-controls="menu" aria-expanded="false" data-menu-open><span>${u.menu}</span><i aria-hidden="true"></i></button>
    </div>
  </header>`;
}

function menu(c, pg, page) {
  const u = pg.u, a = pg.a, o = c.office;
  const slides = c.home.slides || [];
  const small = (im) => (im ? im.small || im.src : "");
  const previews = [
    small(slides[1] || slides[0]),
    small(c.projects[0]?.cover),
    c.team.find((m) => m.photo)?.photo.src || small(slides[0]),
    small(slides[slides.length - 1]),
  ].map((s) => pg.src(s));
  const counts = ["", pad(c.projects.length), pad(c.team.length), ""];
  const rows = [0, 1, 2, 3].map((j) => {
    const cur = page.nav === j ? (page.sheet.includes(".") ? ' aria-current="true"' : ' aria-current="page"') : "";
    const cnt = counts[j] ? `<span class="c">${counts[j]}</span>` : "";
    return `          <a href="${pg.main(j)}" style="--i:${j}" data-preview="${attr(previews[j])}"${cur}><span class="n">0${j}</span><span class="t">${esc(u.names[j])}</span>${cnt}</a>`;
  }).join("\n");
  const other = UI[u.other];
  return `  <dialog class="menu" id="menu" aria-label="${u.menu}">
    <div class="menu-inner">
      <div class="menu-top">
        <a class="brand" href="${pg.main(0)}" aria-label="${u.homeLabel}"><img src="${a}assets/logo.png" width="935" height="170" alt="toz+ architects"></a>
        <button class="menu-close" type="button" data-menu-close aria-label="${u.closeLabel}"><span>${u.close}</span><i aria-hidden="true"></i></button>
      </div>
      <div class="menu-body">
        <nav class="menu-links" aria-label="${u.nav}">
${rows}
        </nav>
        <figure class="menu-preview" aria-hidden="true"><img src="${attr(previews[page.nav] || previews[0])}" alt="" loading="lazy" decoding="async"></figure>
      </div>
      <div class="menu-foot">
        <p><span class="meta-label">${u.phone}</span><a href="tel:${attr(o.tel)}">${esc(o.phone)}</a></p>
        <p><span class="meta-label">${u.place}</span><a href="${attr(c.maps)}" rel="noopener noreferrer">${esc(c.line)}</a></p>
        <p><span class="meta-label">${u.time}</span><time data-clock>GMT+3</time></p>
        <p><span class="meta-label">${u.lang}</span><a href="${pg.to(page.alt[u.other])}" hreflang="${other.code}" lang="${other.code}">${u.langLong}</a></p>
      </div>
    </div>
  </dialog>`;
}

function nextSheet(c, pg, i) {
  const u = pg.u, n = (i + 1) % 4;
  return `    <nav class="next-sheet bar" aria-label="${u.nextLabel}">
      <a href="${pg.main(n)}" rel="next">
        <span class="meta-label">${u.next} · ${u.sheet} 0${n}</span>
        <span class="next-title">${esc(u.names[n])}</span>
        <span class="next-arrow" aria-hidden="true">→</span>
      </a>
      <p class="swipe-hint" aria-hidden="true">${u.hint}</p>
    </nav>`;
}

function footer(c, pg) {
  const u = pg.u, a = pg.a, o = c.office;
  const pages = "<span>" + [0, 1, 2, 3].map((j) => `<a href="${pg.main(j)}">${esc(u.names[j])}</a>`).join(" · ") + "</span>";
  return `  <footer class="colophon" data-zone="dark">
    <div class="bar">
      <div class="colophon-top">
        <a class="colophon-phone" href="tel:${attr(o.tel)}">${esc(o.phone)}</a>
        <img class="colophon-mark" src="${a}assets/mark.svg" width="163" height="161" alt="" loading="lazy">
      </div>
      <div class="colophon-grid">
        <p><span class="meta-label">${u.office}</span><span translate="no">${esc(o.name)}</span></p>
        <address><span class="meta-label">${u.place}</span><a href="${attr(c.maps)}" rel="noopener noreferrer">${esc(o.neighbourhood)}, ${esc(o.street)}<br>${esc(o.postcode)} ${esc(o.district)} / ${esc(o.city)}</a></address>
        <p><span class="meta-label">${u.phone}</span><a href="tel:${attr(o.tel)}">${esc(o.phone)}</a></p>
        <p><span class="meta-label">${u.pages}</span>${pages}</p>
      </div>
      <p class="legal">© ${c.date.slice(0, 4)} <span translate="no">${esc(o.name)}</span> · ${esc(o.district)}, ${esc(o.city)}</p>
    </div>
  </footer>`;
}

function plate(c, pg, extra) {
  const u = pg.u, o = c.office;
  const vals = [o.neighbourhood, o.streetName, o.door, o.district, o.city, o.postcode];
  const rows = u.plate.map((k, j) => `        <p><span class="meta-label">${k}</span><span>${esc(vals[j])}</span></p>`).join("\n");
  return `      <aside class="plate" aria-label="${u.officeDetails}">
        <div class="plate-brand"><img loading="lazy" decoding="async" src="${pg.a}assets/mark.svg" width="18" height="18" alt=""><span translate="no">${esc(o.name)}</span></div>
${rows}
${extra}
      </aside>`;
}

function picture(pg, im, o = {}) {
  if (!im?.src) return "";
  const srcset = im.small ? ` srcset="${attr(pg.src(im.small))} 960w, ${attr(pg.src(im.src))} ${im.w}w" sizes="${o.sizes || "100vw"}"` : "";
  const load = o.eager ? (o.high ? ' fetchpriority="high"' : "") : ' loading="lazy"';
  const extra = (o.cls ? ` class="${o.cls}"` : "") + (o.vt ? ` data-vt="${attr(o.vt)}"` : "") + (o.style ? ` style="${o.style}"` : "") + (o.zoom ? " data-zoom" : "");
  const size = im.w && im.h ? ` width="${im.w}" height="${im.h}"` : "";
  return `<img${load} decoding="async" src="${attr(pg.src(im.src))}"${srcset}${size} alt="${attr(o.alt ?? "")}"${extra}>`;
}

function sheetBlock(c, pg, p, link) {
  const u = pg.u, lg = pg.lg;
  const title = esc(tx(p.title, lg));
  const kind = [tx(p.plan?.kind, lg), tx(p.plan?.note, lg)].filter(Boolean).map(esc).join(" · ");
  const status = tx(p.facts?.status, lg);
  return `<figcaption class="sheet-block">
            <span class="sb-brand"><img src="${pg.a}assets/mark.svg" width="14" height="14" alt="" loading="lazy"><span translate="no">toz+ architects</span></span>
            <span class="sb-cell"><span class="meta-label">${u.sheetLbl}</span>${c.sheetNo(p)}</span>
            <span class="sb-cell sb-wide"><span class="meta-label">${u.drawingLbl}</span>${kind}</span>
            <span class="sb-cell"><span class="meta-label">${u.projectLbl}</span>${link ? `<a href="${pg.detail(p)}">${title} <span aria-hidden="true">→</span></a>` : title}</span>${status ? `
            <span class="sb-cell"><span class="meta-label">${u.statusLbl}</span>${esc(status)}</span>` : ""}
          </figcaption>`;
}

function layerTools(pg, layers, full) {
  const u = pg.u;
  if (!layers.length) return "";
  const btns = layers.map((l) => `<button type="button" aria-pressed="true" data-layer-toggle="${l}"><i class="sw sw-${l}" aria-hidden="true"></i>${u.layerNames[l]}</button>`).join("");
  return `<div class="sheet-tools">
          <div class="layers" role="group" aria-label="${u.layers}">${btns}</div>${full ? `
          <button class="pill sheet-full" type="button" data-sheet-full hidden>${u.full} <span aria-hidden="true">↗</span></button>` : ""}
        </div>`;
}

/* ---------------------------------------------------------------- pages */

function home(c, lg) {
  const path = c.main(lg, 0);
  const pg = pageOf(c, lg, path);
  const u = pg.u, a = pg.a, h = c.home[lg] || {}, o = c.office;
  const slides = c.home.slides || [];
  const meta = c.content.pages?.home?.[lg] || {};
  const n = c.projects.length;
  const page = {
    sheet: "0", nav: 0, dark: slides[0]?.tone !== "light",
    title: meta.title, desc: meta.description,
    alt: { tr: c.main("tr", 0), en: c.main("en", 0) },
    prev: pg.main(3), next: pg.main(1), preload: slides[0],
  };

  const slideHtml = slides.map((s, k) => `        <figure class="slide${k === 0 ? " is-active" : ""}" data-tone="${s.tone === "light" ? "light" : "dark"}" data-cap="${attr(tx(s.cap, lg))}">
          ${picture(pg, s, { alt: tx(s.alt, lg), sizes: "100vw", eager: k === 0, high: k === 0 })}
        </figure>`).join("\n");
  const bars = slides.map(() => "<span></span>").join("");
  const cards = slides.map((s, k) => {
    const p = c.byId[s.project];
    if (!p) return "";
    const svg = c.svg(p, lg);
    return `
          <a class="hc-project" href="${pg.detail(p)}" data-hc="${k}"${k === 0 ? "" : " hidden"}>
            ${svg ? `<span class="hc-plan plan-light" aria-hidden="true">${svg}</span>` : ""}
            <span class="hc-meta"><span class="hc-no">${u.study} ${pad(p.i + 1)} · ${esc(c.cat(p.cat, lg))}</span><span class="hc-title">${esc(tx(p.title, lg))}</span><span class="hc-what">${esc(tx(p.what, lg))}</span></span>
            <span class="hc-arrow" aria-hidden="true">→</span>
          </a>`;
  }).join("");

  const statement = esc(h.statement).replace(/\s*\{([1-9])\}/g, (_, k) => {
    const src = c.home.statementImages?.[k - 1];
    return src ? ` <span class="inl" aria-hidden="true"><img src="${attr(pg.src(src))}" alt="" loading="lazy" decoding="async"></span>` : "";
  });

  const facts = [
    [u.office, esc(`${o.neighbourhood}, ${o.district}`)],
    [u.phone, `<a href="tel:${attr(o.tel)}">${esc(o.phone)}</a>`],
    [u.visits, esc(h.visits)],
    [u.hour, `<time data-clock>GMT+3</time> · ${u.time}`],
  ].map(([k, v]) => `        <p><span class="meta-label">${k}</span><span>${v}</span></p>`).join("\n");

  const feat = c.projects.filter((p) => p.featured).slice(0, 4);
  const cardHtml = feat.map((p) => `        <li class="card">
          <a href="${pg.detail(p)}">
            <span class="card-img">${picture(pg, p.cover, { alt: tx(p.cover?.alt, lg), sizes: "(min-width: 980px) 40vw, 100vw", vt: p.slug?.[lg] })}<span class="chips" aria-hidden="true"><span class="chip">${esc(c.cat(p.cat, lg))}</span>${p.facts?.status?.[lg] ? `<span class="chip">${esc(p.facts.status[lg])}</span>` : ""}</span></span>
            <span class="card-meta"><span class="card-no">${pad(p.i + 1)}</span><span class="card-title">${esc(tx(p.title, lg))}</span><span class="card-cat">${esc(tx(p.what, lg))}</span></span>
          </a>
        </li>`).join("\n");

  const drawn = c.projects.filter((p) => c.svg(p, lg));
  const tabs = drawn.map((p, k) => `          <button type="button" role="tab" id="pt-${k}" aria-controls="pp-${k}" aria-selected="${k === 0}"${k ? ' tabindex="-1"' : ""}><span class="pt-no">${c.sheetNo(p)}</span><span class="pt-title">${esc(tx(p.title, lg))}</span><span class="pt-kind">${esc(tx(p.plan?.kind, lg))}</span></button>`).join("\n");
  const panels = drawn.map((p, k) => `        <figure class="sheet" role="tabpanel" id="pp-${k}" aria-labelledby="pt-${k}"${k ? " hidden" : ""}>
          <div class="sheet-paper">${c.svg(p, lg)}</div>
          ${sheetBlock(c, pg, p, true)}
        </figure>`).join("\n");
  const layers = LAYERS.filter((l) => drawn.some((p) => c.layers(p).includes(l)));
  const pafta = drawn.length ? `
    <section class="pafta bar" aria-labelledby="pafta-title" data-pafta>
      <div class="section-head">
        <h2 class="label" id="pafta-title"><span class="sq" aria-hidden="true"></span>${u.sheets}</h2>
        <p class="section-note">${u.legend}</p>
      </div>
      <div class="pafta-grid">
        <div class="pafta-tabs" role="tablist" aria-label="${u.drawings}" data-tabs>
${tabs}
        </div>
        <div class="pafta-stage">
${panels}
        </div>
        ${layerTools(pg, layers, true)}
      </div>
    </section>` : "";

  const st = c.content.studio || {};
  const stats = [pad(n), pad(c.cats.length), pad(c.team.length), "1:50"]
    .map((v, k) => `<li><strong>${v}</strong><span>${u.stats[k]}</span></li>`).join("");
  const atolye = st.hero?.src ? `
    <section class="atolye" aria-labelledby="atolye-title">
      <div class="bar section-head">
        <h2 class="label" id="atolye-title"><span class="sq" aria-hidden="true"></span>${u.studio}</h2>
        <p class="section-note">${esc(tx(st.hero.cap, lg))}</p>
      </div>
      <figure class="atolye-hero bar">
        ${picture(pg, st.hero, { alt: tx(st.hero.alt, lg), sizes: "(min-width: 1480px) 1480px, 100vw", zoom: true })}
        <ul class="stats" aria-label="${u.statsLabel}">${stats}</ul>
      </figure>
    </section>` : "";

  const lead = c.team[0];
  const leadPhoto = lead?.photo?.src ? `
        <a class="people-photo" href="${pg.main(2)}" tabindex="-1" aria-hidden="true">
          ${picture(pg, lead.photo, { alt: tx(lead.photo.alt, lg), style: "view-transition-name: ph-lead" })}
        </a>` : "";
  const dl = c.team.map((m) => `            <div><dt>${esc(tx(m.role, lg))}</dt><dd>${esc(m.name)}</dd></div>`).join("\n");

  const mats = c.content.materials || [];
  const matHtml = mats.map((m) => `        <figure class="material">
          ${picture(pg, m, { alt: tx(m.alt, lg), zoom: true })}
          <figcaption><strong>${esc(tx(m.name, lg))}</strong><span>${esc(tx(m.text, lg))}</span></figcaption>
        </figure>`).join("\n");
  const materials = mats.length ? `
    <section class="materials" aria-labelledby="malzeme-baslik">
      <div class="bar section-head">
        <h2 class="label" id="malzeme-baslik"><span class="sq" aria-hidden="true"></span>${u.materials}</h2>
        <p class="strip-count" aria-hidden="true"><span data-strip-index>01</span> / ${pad(mats.length)}</p>
      </div>
      <div class="strip" data-strip tabindex="0" aria-label="${u.stripLabel}">
${matHtml}
      </div>
      <div class="bar strip-controls">
        <button class="round glass" type="button" data-strip-prev aria-label="${u.prevMat}">←</button>
        <button class="round glass" type="button" data-strip-next aria-label="${u.nextMat}">→</button>
      </div>
    </section>` : "";

  return `${head(c, pg, page)}
<body class="home">
${topbar(c, pg, page)}
${menu(c, pg, page)}
  <main id="icerik">
    <section class="hero" data-hero data-zone="${page.dark ? "dark" : "light"}" aria-roledescription="carousel" aria-label="${u.heroRegion}">
      <div class="hero-slides">
${slideHtml}
      </div>
      <div class="hero-shade" aria-hidden="true"></div>
      <div class="hero-copy bar">
        <p class="hero-eyebrow">${esc(h.eyebrow)}</p>
        <h1>${br(h.title)}</h1>
        <a class="hero-cta" href="${pg.main(1)}">${esc(u.names[1])} <span aria-hidden="true">→</span></a>
      </div>
      <p class="wordmark" aria-hidden="true">toz<span>+</span></p>
      <div class="hero-card" role="group" aria-label="${u.heroCard}">
        <div class="hc-top">
          <p class="hero-count" aria-live="polite"><span class="hero-n" data-hero-n>01</span><span class="hero-of">/ ${pad(slides.length)}</span></p>
          <p class="hero-cap" data-hero-cap>${esc(tx(slides[0]?.cap, lg))}</p>
        </div>
        <div class="hc-projects">${cards}
        </div>
        <div class="hc-ui">
          <div class="hero-progress" aria-hidden="true">${bars}</div>
          <div class="hero-btns">
            <button class="round" type="button" data-hero-pause aria-pressed="false" aria-label="${u.pause}"><i class="icon-pause" aria-hidden="true"></i></button>
            <button class="round" type="button" data-hero-prev aria-label="${u.prevImg}">←</button>
            <button class="round" type="button" data-hero-next aria-label="${u.nextImg}">→</button>
          </div>
        </div>
      </div>
    </section>
    <section class="intro bar" aria-labelledby="intro-title">
      <h2 class="label" id="intro-title"><span class="sq" aria-hidden="true"></span>${u.office}</h2>
      <p class="statement">${statement}</p>
      <div class="intro-side">
        <p>${esc(h.intro)}</p>
        <p class="pills"><a class="pill" href="${pg.main(1)}">${esc(u.names[1])} <span aria-hidden="true">→</span></a><a class="pill" href="${pg.main(2)}">${esc(u.names[2])} <span aria-hidden="true">→</span></a></p>
      </div>
      <div class="facts">
${facts}
      </div>
    </section>
    <section class="works-home bar" aria-labelledby="works-title">
      <div class="section-head">
        <h2 class="label" id="works-title"><span class="sq" aria-hidden="true"></span>${u.works}</h2>
        <a class="more" href="${pg.main(1)}">${u.all} <span class="more-n">${pad(n)}</span> <span aria-hidden="true">→</span></a>
      </div>
      <ul class="cards">
${cardHtml}
      </ul>
    </section>${pafta}${atolye}
    <section class="people bar" aria-labelledby="people-title">
      <div class="section-head">
        <h2 class="label" id="people-title"><span class="sq" aria-hidden="true"></span>${u.people}</h2>
        <a class="more" href="${pg.main(2)}">${u.peopleMore} <span aria-hidden="true">→</span></a>
      </div>
      <div class="people-grid">${leadPhoto}
        <div class="people-copy">
          <p class="people-lead">${esc(h.people)}</p>
          <dl class="people-list">
${dl}
          </dl>
        </div>
      </div>
    </section>${materials}
${nextSheet(c, pg, 0)}
  </main>
${footer(c, pg)}
</body>
</html>
`;
}

function projects(c, lg) {
  const path = c.main(lg, 1);
  const pg = pageOf(c, lg, path);
  const u = pg.u, n = c.projects.length;
  const meta = c.content.pages?.projects?.[lg] || {};
  const oldHashes = Object.fromEntries(c.projects.map((p) => [p.slug?.[lg] || p.id, pg.detail(p)]));
  const page = {
    sheet: "1", nav: 1,
    title: meta.title, desc: fill(meta.description, lg, n),
    alt: { tr: c.main("tr", 1), en: c.main("en", 1) },
    prev: pg.main(0), next: pg.main(2),
    crumbs: [[u.names[0], c.main(lg, 0)], [u.names[1], path]],
    headExtra: `\n  <script>(function () { var m = ${JSON.stringify(oldHashes).replace(/</g, "\\u003c")}, h = decodeURIComponent(location.hash.slice(1)); if (m[h]) location.replace(m[h]); })();</script>`,
  };
  const count = (key) => c.projects.filter((p) => p.cat === key).length;
  const chips = [`          <button type="button" aria-pressed="true" data-filter="all">${u.all} <sup>${pad(n)}</sup></button>`]
    .concat(c.cats.map((k) => `          <button type="button" aria-pressed="false" data-filter="${attr(k.key)}">${esc(k[lg])} <sup>${pad(count(k.key))}</sup></button>`))
    .join("\n");
  const items = c.projects.map((p) => {
    const svg = c.svg(p, lg);
    const status = tx(p.facts?.status, lg);
    return `      <li class="work" data-cat="${attr(p.cat)}">
        <a href="${pg.detail(p)}">
          <span class="work-img">${picture(pg, p.cover, { alt: "", sizes: "(min-width: 980px) 45vw, 100vw", vt: p.slug?.[lg] })}<span class="chips" aria-hidden="true"><span class="chip">${esc(c.cat(p.cat, lg))}</span>${status ? `<span class="chip">${esc(status)}</span>` : ""}</span></span>
          <span class="work-plan" aria-hidden="true">${svg ? `<span class="plan-thumb">${svg}</span><span class="work-sheet">${c.sheetNo(p)} · ${esc(tx(p.plan?.kind, lg))}</span>` : ""}</span>
          <span class="work-no">${pad(p.i + 1)}</span>
          <span class="work-title">${esc(tx(p.title, lg))}</span>
          <span class="work-cat">${esc(c.cat(p.cat, lg))}</span>
          <span class="work-what">${esc(tx(p.what, lg))}</span>
          <span class="work-arrow" aria-hidden="true">→</span>
        </a>
      </li>`;
  }).join("\n");
  const sheets = (c.content.sheets || []).map((s) => `          <li><span class="sheet-scale">${esc(tx(s.scale, lg))}</span><h3>${esc(tx(s.title, lg))}</h3><p>${esc(tx(s.text, lg))}</p></li>`).join("\n");

  return `${head(c, pg, page)}
<body>
${topbar(c, pg, page)}
${menu(c, pg, page)}
  <main id="icerik">
    <header class="page-head bar">
      <p class="kicker"><span class="sq" aria-hidden="true"></span>${u.sheet} 01 · ${u.studies(n)}</p>
      <h1>${esc(u.names[1])}</h1>
      <p class="lede">${esc(fill(meta.lede, lg, n))}</p>
    </header>
    <section class="index" aria-label="${u.index}">
    <div class="toolbar bar">
      <div class="toolbar-in">
        <div class="filters" role="group" aria-label="${u.filt}" data-filters>
${chips}
        </div>
        <div class="view-toggle" role="group" aria-label="${u.view}" data-views>
          <button type="button" aria-pressed="true" data-view="grid">${u.grid}</button>
          <button type="button" aria-pressed="false" data-view="plan">${u.plan}</button>
          <button type="button" aria-pressed="false" data-view="list">${u.list}</button>
        </div>
      </div>
    </div>
    <ol class="works bar" data-works data-view="grid">
${items}
    </ol>
    </section>
    <section class="sheets bar" aria-labelledby="sheets-title">
      <div class="section-head">
        <h2 class="label" id="sheets-title"><span class="sq" aria-hidden="true"></span>${u.sheets}</h2>
        <p class="section-note">${u.sheetsNote}</p>
      </div>
      <ol class="sheet-list">
${sheets}
      </ol>
    </section>
${nextSheet(c, pg, 1)}
  </main>
${footer(c, pg)}
</body>
</html>
`;
}

function detail(c, lg, p) {
  const path = c.detail(lg, p);
  const pg = pageOf(c, lg, path);
  const u = pg.u, n = c.projects.length;
  const prevP = c.projects[(p.i - 1 + n) % n];
  const nextP = c.projects[(p.i + 1) % n];
  const title = tx(p.title, lg), what = tx(p.what, lg), cat = c.cat(p.cat, lg);
  const body = (p.body?.[lg] || []).filter((s) => String(s).trim());
  const cover = p.cover || {};
  const dark = cover.tone !== "light";
  const pageTitle = `${title} — ${cat} · toz+ architects`;
  const desc = clip(`${title} — ${what}. ${body[0] || ""}`);
  const work = {
    "@type": "CreativeWork",
    "@id": c.url(path) + "#work",
    name: title,
    headline: `${title} — ${what}`,
    description: clip(body.join(" "), 300),
    inLanguage: u.hl,
    genre: u.genre,
    creator: { "@id": c.base + "#studio" },
    isPartOf: { "@id": c.url(c.main(lg, 1)) + "#webpage" },
  };
  if (cover.src) work.image = c.abs(cover.src);
  const page = {
    sheet: `1.${p.i + 1}`, count: n, nav: 1, dark,
    title: pageTitle, desc, ogType: "article",
    og: cover.src ? { src: cover.src, w: cover.w, h: cover.h, alt: tx(cover.alt, lg) } : null,
    alt: { tr: c.detail("tr", p), en: c.detail("en", p) },
    prev: pg.detail(prevP), next: pg.detail(nextP), preload: cover.src ? cover : null,
    crumbs: [[u.names[0], c.main(lg, 0)], [u.names[1], c.main(lg, 1)], [title, path]],
    work,
  };

  const ar = cover.w && cover.h ? (cover.w / cover.h).toFixed(4) : "1.3333";
  const pins = (p.pins || []).filter((q) => q && tx(q, lg)).map((q, k) => {
    const x = num(q.x, 0, 100), y = num(q.y, 0, 100);
    return `            <li class="pin${x > 64 ? " is-left" : ""}${y > 70 ? " is-low" : ""}" style="--x:${x}%;--y:${y}%;--i:${k}"><span class="pin-dot" aria-hidden="true"></span><span class="pin-label">${esc(tx(q, lg))}</span></li>`;
  }).join("\n");
  const facts = [
    [u.catLbl, esc(cat)],
    [u.whatLbl, esc(what)],
    p.facts?.year ? [u.yearLbl, esc(p.facts.year)] : null,
    tx(p.facts?.place, lg) ? [u.placeLbl, esc(tx(p.facts.place, lg))] : null,
    p.facts?.area ? [u.areaLbl, esc(p.facts.area)] : null,
    tx(p.facts?.status, lg) ? [u.statusLbl, `<span class="chip">${esc(tx(p.facts.status, lg))}</span>`] : null,
  ].filter(Boolean).map(([k, v]) => `          <div><dt>${k}</dt><dd>${v}</dd></div>`).join("\n");
  const segs = c.projects.map((q) => `<span${q.i === p.i ? ' class="is-on"' : ""}></span>`).join("");
  const svg = c.svg(p, lg);
  const fallback = !svg && p.plan?.src ? `<img src="${attr(pg.src(p.plan.src))}" alt="" loading="lazy" decoding="async">` : "";
  const sheet = svg || fallback ? `
    <section class="p-sheet bar" id="pafta" aria-labelledby="pafta-title" data-pafta>
      <div class="section-head">
        <h2 class="label" id="pafta-title"><span class="sq" aria-hidden="true"></span>${u.sheetLbl} ${c.sheetNo(p)}</h2>
        <p class="section-note">${svg ? u.legend : ""}</p>
      </div>
      <figure class="sheet">
        <div class="sheet-paper">${svg || fallback}</div>
        ${sheetBlock(c, pg, p, false)}
      </figure>
      ${layerTools(pg, svg ? c.layers(p) : [], true)}
    </section>` : "";
  const gallery = (p.gallery || []).filter((g) => g?.src);
  const galleryHtml = gallery.length ? `
    <section class="p-gallery bar" aria-label="${u.gallery}">
      <ul class="gallery">
${gallery.map((g) => `        <li><figure>${picture(pg, g, { alt: tx(g.alt, lg), sizes: "(min-width: 980px) 50vw, 100vw", zoom: true })}${tx(g.cap, lg) ? `<figcaption>${esc(tx(g.cap, lg))}</figcaption>` : ""}</figure></li>`).join("\n")}
      </ul>
    </section>` : "";
  const navLink = (q, dir) => `      <a class="p-nav-link is-${dir}" href="${pg.detail(q)}" rel="${dir}">
        <span class="meta-label">${dir === "prev" ? u.prev : u.next} · ${pad(q.i + 1)}</span>
        <span class="p-nav-title">${esc(tx(q.title, lg))}</span>
        <span class="p-nav-cat">${esc(c.cat(q.cat, lg))}</span>
      </a>`;
  const len = Math.max(...title.split(/\n/).map((s) => s.length), 3);
  const word = Math.max(...title.split(/\s+/).map((s) => s.length), 3);

  return `${head(c, pg, page)}
<body class="project">
${topbar(c, pg, page)}
${menu(c, pg, page)}
  <main id="icerik">
    <header class="p-hero" data-zone="${dark ? "dark" : "light"}" style="--len:${len};--word:${word}">
      <div class="p-media">
        <div class="p-frame" style="--ar:${ar}">
          ${picture(pg, cover, { alt: tx(cover.alt, lg), sizes: "100vw", eager: true, high: true, cls: "p-hero-img" })}${pins ? `
          <ul class="pins" aria-label="${u.pins}">
${pins}
          </ul>` : ""}
        </div>
      </div>
      <div class="hero-shade" aria-hidden="true"></div>
      <nav class="p-crumbs" aria-label="${u.crumbs}"><a href="${pg.main(1)}">${esc(u.names[1])}</a><span aria-hidden="true">/</span><span>${pad(p.i + 1)} · ${esc(cat)}</span></nav>
      <div class="p-card">
        <dl class="p-facts">
${facts}
        </dl>
        <div class="p-steps">
          <a class="round" href="${pg.detail(prevP)}" aria-label="${u.prevStudy}: ${attr(tx(prevP.title, lg))}">←</a>
          <p class="p-count"><span>${pad(p.i + 1)}</span> / ${pad(n)}</p>
          <div class="p-progress" aria-hidden="true">${segs}</div>
          <a class="round" href="${pg.detail(nextP)}" aria-label="${u.nextStudy}: ${attr(tx(nextP.title, lg))}">→</a>
        </div>
      </div>
      <h1 class="p-title${/[gjpqyçşğÇŞ]/.test(title) ? " has-desc" : ""}">${br(title)}</h1>
    </header>
    <section class="p-intro bar" aria-labelledby="p-intro-title">
      <h2 class="label" id="p-intro-title"><span class="sq" aria-hidden="true"></span>${u.study} ${pad(p.i + 1)}</h2>
      ${body[0] ? `<p class="statement">${esc(body[0])}</p>` : ""}
      <div class="p-side">
${body.slice(1).map((s) => `        <p>${esc(s)}</p>`).join("\n")}
        <p class="pills">${sheet ? `<a class="pill" href="#pafta">${u.toSheet} <span aria-hidden="true">↓</span></a>` : ""}<a class="pill" href="${pg.main(1)}">${u.allProjects} <span aria-hidden="true">→</span></a></p>
      </div>
    </section>${sheet}${galleryHtml}
    <nav class="p-nav bar" aria-label="${u.projNav}">
${navLink(prevP, "prev")}
${navLink(nextP, "next")}
    </nav>
  </main>
${footer(c, pg)}
</body>
</html>
`;
}

function team(c, lg) {
  const path = c.main(lg, 2);
  const pg = pageOf(c, lg, path);
  const u = pg.u, o = c.office;
  const meta = c.content.pages?.team?.[lg] || {};
  const page = {
    sheet: "2", nav: 2,
    title: meta.title, desc: meta.description,
    alt: { tr: c.main("tr", 2), en: c.main("en", 2) },
    prev: pg.main(1), next: pg.main(3),
    crumbs: [[u.names[0], c.main(lg, 0)], [u.names[2], path]],
  };
  const grid = c.team.map((m, k) => {
    const cap = `
            <figcaption>
              <span class="who">${esc(m.name)}</span>
              <span class="role">${esc(tx(m.role, lg))}</span>
            </figcaption>`;
    if (m.photo?.src) {
      return `          <figure class="portrait">
            ${picture(pg, m.photo, { alt: tx(m.photo.alt, lg), eager: k === 0, high: k === 0, style: k === 0 ? "view-transition-name: ph-lead" : "", zoom: true })}${cap}
          </figure>`;
    }
    const [first, ...rest] = String(m.name).split(" ");
    return `          <figure class="portrait">
            <div class="nameplate">
              <span class="nameplate-top"><span class="sq" aria-hidden="true"></span><span class="nameplate-no">${pad(k + 1)}</span></span>
              <strong>${esc(first)}${rest.length ? "<br>" + esc(rest.join(" ")) : ""}</strong>
            </div>${cap}
          </figure>`;
  }).join("\n");
  const steps = (c.content.steps || []).map((s, k) => `        <li><span>${pad(k + 1)}</span><div><h3>${esc(tx(s.title, lg))}</h3><p>${esc(tx(s.text, lg))}</p></div></li>`).join("\n");
  const items = c.content.studio?.items || [];
  const studio = items.length ? `
    <section class="studio bar" aria-labelledby="studio-title">
      <div class="section-head">
        <h2 class="label" id="studio-title"><span class="sq" aria-hidden="true"></span>${u.studio}</h2>
        <p class="section-note">${u.studioNote}</p>
      </div>
      <ul class="studio-grid">
${items.map((s) => `        <li>
          <figure>
            ${picture(pg, s, { alt: tx(s.alt, lg), sizes: "(min-width: 980px) 33vw, 100vw", zoom: true })}
            <figcaption><strong>${esc(tx(s.title, lg))}</strong><span>${esc(tx(s.text, lg))}</span></figcaption>
          </figure>
        </li>`).join("\n")}
      </ul>
    </section>` : "";
  const leadName = c.team[0]?.name;
  const extra = (leadName ? `        <p><span class="meta-label">${esc(tx(c.team[0].role, lg) || u.lead)}</span><span>${esc(leadName)}</span></p>\n` : "")
    + `        <p><span class="meta-label">${u.phone}</span><a href="tel:${attr(o.tel)}">${esc(o.phone)}</a></p>`;

  return `${head(c, pg, page)}
<body>
${topbar(c, pg, page)}
${menu(c, pg, page)}
  <main id="icerik">
    <header class="page-head bar">
      <p class="kicker"><span class="sq" aria-hidden="true"></span>${u.teamKicker(c.team.length)}</p>
      <h1>${esc(u.names[2])}</h1>
      <p class="lede">${esc(meta.lede)}</p>
    </header>
    <section class="team bar" aria-label="${u.members}">
      <div class="team-grid">
${grid}
      </div>
    </section>
    <section class="method bar" aria-labelledby="method-title">
      <div class="method-side">
        <h2 class="label" id="method-title"><span class="sq" aria-hidden="true"></span>${u.method}</h2>
        <p class="statement">${esc(meta.method)}</p>
      </div>
      <ol class="steps">
${steps}
      </ol>
    </section>${studio}
    <section class="office bar" aria-labelledby="office-title">
      <div class="office-copy">
        <h2 class="label" id="office-title"><span class="sq" aria-hidden="true"></span>${u.office}</h2>
        <p class="statement">${esc(meta.office)}</p>
      </div>
${plate(c, pg, extra)}
    </section>
${nextSheet(c, pg, 2)}
  </main>
${footer(c, pg)}
</body>
</html>
`;
}

function contact(c, lg) {
  const path = c.main(lg, 3);
  const pg = pageOf(c, lg, path);
  const u = pg.u, o = c.office;
  const meta = c.content.pages?.contact?.[lg] || {};
  const page = {
    sheet: "3", nav: 3,
    title: meta.title, desc: meta.description,
    alt: { tr: c.main("tr", 3), en: c.main("en", 3) },
    prev: pg.main(2), next: pg.main(0),
    crumbs: [[u.names[0], c.main(lg, 0)], [u.names[3], path]],
  };
  const extra = `        <p><span class="meta-label">${u.phone}</span><a href="tel:${attr(o.tel)}">${esc(o.phone)}</a></p>
        <p><span class="meta-label">${u.hour}</span><span><time data-clock>GMT+3</time> · ${u.time}</span></p>`;
  return `${head(c, pg, page)}
<body>
${topbar(c, pg, page)}
${menu(c, pg, page)}
  <main id="icerik">
    <header class="page-head bar">
      <p class="kicker"><span class="sq" aria-hidden="true"></span>${u.contactKicker}</p>
      <h1>${esc(u.names[3])}</h1>
      <p class="lede">${esc(meta.lede)}</p>
    </header>
    <section class="contact bar">
      <div class="contact-main">
        <a class="contact-phone" href="tel:${attr(o.tel)}"><span class="meta-label">${u.call}</span>${esc(o.phone)}</a>
${plate(c, pg, extra)}
        <a class="pill" href="${attr(c.maps)}" rel="noopener noreferrer">${u.maps} <span aria-hidden="true">→</span></a>
      </div>
      <figure class="map">
        <iframe src="${attr(c.embed)}" title="${u.mapTitle}: ${attr(`${o.neighbourhood}, ${o.street}, ${o.district}`)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        <figcaption><span class="sq" aria-hidden="true"></span>${esc(o.street)}</figcaption>
      </figure>
    </section>
${nextSheet(c, pg, 3)}
  </main>
${footer(c, pg)}
</body>
</html>
`;
}

function redirect(c, lg, path, targetIdx, title, map) {
  const to = rel(path, c.main(lg, targetIdx));
  const m = JSON.stringify(Object.fromEntries(Object.entries(map).map(([k, p]) => [k, rel(path, p)]))).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="${UI[lg].code}">
<head>
  <meta charset="utf-8">
  <title>${esc(title)} — toz+ architects</title>
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="${attr(c.url(c.main(lg, targetIdx)))}">
  <meta http-equiv="refresh" content="0; url=${to}">
  <script>
    (function () {
      var m = ${m};
      var h = location.hash.slice(1);
      location.replace(m[h] || "${to}" + location.hash);
    })();
  </script>
</head>
<body>
  <p><a href="${to}">${esc(title)}</a></p>
</body>
</html>
`;
}

function notFound(c) {
  const base = new URL(c.base).pathname;
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Sayfa yok — toz+ architects</title>
  <meta name="robots" content="noindex">
  <script>
    if (location.hostname.endsWith("github.io")) {
      var b = document.createElement("base");
      b.href = "${base}";
      document.head.appendChild(b);
    }
  </script>
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="css/site.css">
</head>
<body>
  <header class="topbar">
    <div class="liquid">
      <a class="brand" href="index.html" aria-label="toz+ architects, ana sayfa">
        <img class="logo-dark" src="assets/logo.png" width="935" height="170" alt="toz+ architects">
      </a>
      <nav class="nav nav-always" aria-label="Sayfalar">
        <a href="projeler.html">Projeler</a>
        <a href="ekip.html">Ekip</a>
        <a href="iletisim.html">İletişim</a>
      </nav>
    </div>
  </header>
  <main id="icerik">
    <header class="page-head bar">
      <p class="kicker"><span class="sq" aria-hidden="true"></span>404</p>
      <h1>Bu sayfa yok.</h1>
      <p class="lede">Aradığınız pafta bu sette değil. Ana sayfadan ya da projeler dizininden devam edebilirsiniz.</p>
      <p class="pills"><a class="pill" href="index.html">Ana sayfa <span aria-hidden="true">→</span></a><a class="pill" href="projeler.html">Projeler <span aria-hidden="true">→</span></a><a class="pill" href="en/index.html" lang="en">English <span aria-hidden="true">→</span></a></p>
    </header>
  </main>
</body>
</html>
`;
}

function sitemap(c) {
  const rows = [];
  for (let i = 0; i < 4; i++) {
    for (const lg of LANGS) rows.push([c.main(lg, i), c.main("tr", i), c.main("en", i), i === 0 ? "1.0" : "0.8"]);
  }
  for (const p of c.projects) {
    for (const lg of LANGS) rows.push([c.detail(lg, p), c.detail("tr", p), c.detail("en", p), "0.7"]);
  }
  const out = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'];
  for (const [loc, tr, en, pr] of rows) {
    out.push("  <url>", `    <loc>${esc(c.url(loc))}</loc>`,
      `    <xhtml:link rel="alternate" hreflang="tr" href="${esc(c.url(tr))}"/>`,
      `    <xhtml:link rel="alternate" hreflang="en" href="${esc(c.url(en))}"/>`,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(c.url(tr))}"/>`,
      `    <lastmod>${c.date}</lastmod>`, `    <priority>${pr}</priority>`, "  </url>");
  }
  out.push("</urlset>");
  return out.join("\n") + "\n";
}

/* ---------------------------------------------------------------- entry points */

export function planSources(content) {
  return [...new Set((content.projects || []).map((p) => p.plan?.src).filter(Boolean))];
}

export function validate(content) {
  const problems = [];
  const seen = { tr: new Set(), en: new Set(), id: new Set() };
  (content.projects || []).forEach((p, i) => {
    const name = tx(p.title, "tr") || `#${i + 1}`;
    if (!p.id) problems.push(`${name}: kimlik (id) yok`);
    else if (seen.id.has(p.id)) problems.push(`${name}: kimlik tekrar ediyor (${p.id})`);
    seen.id.add(p.id);
    for (const lg of LANGS) {
      const s = p.slug?.[lg];
      if (!s || !/^[a-z0-9-]+$/.test(s)) problems.push(`${name}: ${lg.toUpperCase()} adres adı geçersiz (${s || "boş"})`);
      else if (seen[lg].has(s)) problems.push(`${name}: ${lg.toUpperCase()} adres adı tekrar ediyor (${s})`);
      seen[lg].add(s);
      if (!tx(p.title, lg)) problems.push(`${name}: ${lg.toUpperCase()} başlık boş`);
    }
    if (!p.cover?.src) problems.push(`${name}: kapak görseli yok`);
  });
  return problems;
}

export function renderSite(content, opts = {}) {
  const c = context(content, opts);
  const files = {};
  for (const lg of LANGS) {
    files[c.main(lg, 0)] = home(c, lg);
    files[c.main(lg, 1)] = projects(c, lg);
    files[c.main(lg, 2)] = team(c, lg);
    files[c.main(lg, 3)] = contact(c, lg);
    for (const p of c.projects) files[c.detail(lg, p)] = detail(c, lg, p);
  }
  const old = { konut: "esik", "ic-mekan": "pencere", mevcut: "cephe", kamusal: "avlu" };
  const oldEn = { housing: "esik", interior: "pencere", existing: "cephe", civic: "avlu" };
  const target = (lg, map) => Object.fromEntries(Object.entries(map).filter(([, id]) => c.byId[id]).map(([k, id]) => [k, c.detail(lg, c.byId[id])]));
  files["pratik.html"] = redirect(c, "tr", "pratik.html", 1, "Projeler", target("tr", old));
  files["ofis.html"] = redirect(c, "tr", "ofis.html", 2, "Ekip", {});
  files["en/practice.html"] = redirect(c, "en", "en/practice.html", 1, "Projects", target("en", oldEn));
  files["en/studio.html"] = redirect(c, "en", "en/studio.html", 2, "Team", {});
  files["404.html"] = notFound(c);
  files["sitemap.xml"] = sitemap(c);
  return { files, detailDirs: LANGS.map((lg) => UI[lg].root + UI[lg].detailDir) };
}
