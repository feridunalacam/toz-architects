(() => {
  "use strict";

  const root = document.documentElement;
  const en = root.lang === "en";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const main = document.querySelector("main");
  const prevLink = document.querySelector('link[rel="prev"]');
  const nextLink = document.querySelector('link[rel="next"]');
  const pad = (n) => String(n).padStart(2, "0");
  const go = (link) => { if (link) location.href = link.href; };

  const settle = (el) => {
    el.classList.add("is-settling");
    el.style.transform = "";
    el.style.opacity = "";
    setTimeout(() => el.classList.remove("is-settling"), 460);
  };

  const transition = (update, type) => {
    if (!document.startViewTransition || reduce) { update(); return null; }
    try { return document.startViewTransition({ update, types: type ? [type] : [] }); }
    catch { return document.startViewTransition(update); }
  };

  /* Opening slideshow: autoplay with progress, swipe, buttons, arrow keys while in view.
     The glass card follows the slide with the study the photograph belongs to. */
  const hero = document.querySelector("[data-hero]");
  let heroStep = null;
  let heroInView = false;
  if (hero) {
    const slides = [...hero.querySelectorAll(".slide")];
    const bars = [...hero.querySelectorAll(".hero-progress span")];
    const cards = [...hero.querySelectorAll("[data-hc]")];
    const num = hero.querySelector("[data-hero-n]");
    const cap = hero.querySelector("[data-hero-cap]");
    const pauseB = hero.querySelector("[data-hero-pause]");
    const t = en
      ? { pause: "Pause images", play: "Play images" }
      : { pause: "Görselleri durdur", play: "Görselleri oynat" };
    const state = { user: reduce, hidden: document.hidden, away: false };
    let cur = 0;
    let cleanup = 0;

    hero.style.setProperty("--hero-dur", "7s");
    hero.querySelectorAll("img").forEach((img) => { img.draggable = false; });

    const sync = () => {
      const paused = state.user || state.hidden || state.away;
      hero.classList.toggle("is-paused", paused);
      pauseB.setAttribute("aria-pressed", String(state.user));
      pauseB.setAttribute("aria-label", state.user ? t.play : t.pause);
    };

    const runBar = () => {
      bars.forEach((b, i) => {
        b.classList.remove("is-active");
        b.classList.toggle("is-done", i < cur);
      });
      void bars[cur].offsetWidth;
      bars[cur].classList.add("is-active");
    };

    const show = (i, dir) => {
      const next = (i + slides.length) % slides.length;
      if (next === cur) return;
      const old = slides[cur];
      const neu = slides[next];
      clearTimeout(cleanup);
      slides.forEach((s) => s.classList.remove("is-leaving", "is-entering", "from-left", "to-right"));
      old.classList.remove("is-active");
      old.classList.add("is-leaving");
      neu.classList.add("is-active", "is-entering");
      if (dir < 0) { old.classList.add("to-right"); neu.classList.add("from-left"); }
      cur = next;
      num.textContent = pad(cur + 1);
      cap.textContent = neu.dataset.cap;
      cards.forEach((c) => { c.hidden = +c.dataset.hc !== cur; });
      hero.dataset.zone = neu.dataset.tone || "dark";
      runBar();
      dispatchEvent(new Event("toz:tone"));
      cleanup = setTimeout(() => {
        old.classList.remove("is-leaving", "to-right");
        neu.classList.remove("is-entering", "from-left");
      }, 1250);
    };
    heroStep = (d) => show(cur + d, d);

    hero.querySelector(".hero-progress").addEventListener("animationend", (e) => {
      if (e.animationName === "fill") show(cur + 1, 1);
    });
    hero.querySelector("[data-hero-prev]").addEventListener("click", () => heroStep(-1));
    hero.querySelector("[data-hero-next]").addEventListener("click", () => heroStep(1));
    pauseB.addEventListener("click", () => { state.user = !state.user; sync(); });
    document.addEventListener("visibilitychange", () => { state.hidden = document.hidden; sync(); });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => {
        heroInView = e.intersectionRatio >= 0.5;
        state.away = !e.isIntersecting;
        sync();
      }, { threshold: [0, 0.5] }).observe(hero);
    }

    let x0 = null, y0 = 0;
    hero.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("a, button, .hero-card")) return;
      x0 = e.clientX; y0 = e.clientY;
    });
    hero.addEventListener("pointerup", (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      const dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) heroStep(dx < 0 ? 1 : -1);
    });
    hero.addEventListener("pointercancel", () => { x0 = null; });

    runBar();
    sync();
  }

  /* Sheet navigation: horizontal swipe on touch, arrow keys on desktop. */
  if (main && (prevLink || nextLink)) {
    let sx = 0, sy = 0, st = 0, dx = 0, mode = "y";

    main.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      const edge = t.clientX < 24 || t.clientX > innerWidth - 24;
      mode = e.touches.length !== 1 || edge || e.target.closest("[data-strip], .map, [data-hero], .filters, .pafta-tabs, .pafta-stage, .layers") ? "y" : "";
      sx = t.clientX; sy = t.clientY; st = Date.now(); dx = 0;
    }, { passive: true });

    main.addEventListener("touchmove", (e) => {
      if (mode === "y") return;
      const t = e.touches[0];
      dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (!mode) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        mode = Math.abs(dx) > Math.abs(dy) * 1.4 ? "x" : "y";
        if (mode === "x") main.classList.add("is-swiping");
      }
      if (mode === "x" && !reduce) {
        const target = dx < 0 ? nextLink : prevLink;
        const k = target ? 0.38 : 0.12;
        main.style.transform = `translateX(${dx * k}px)`;
        main.style.opacity = String(1 - Math.min(Math.abs(dx) / innerWidth, 0.45));
      }
    }, { passive: true });

    const end = () => {
      if (mode !== "x") { mode = "y"; return; }
      mode = "y";
      main.classList.remove("is-swiping");
      const target = dx < 0 ? nextLink : prevLink;
      const fast = Math.abs(dx) / Math.max(Date.now() - st, 1) > 0.5;
      if (target && (Math.abs(dx) > innerWidth * 0.28 || (fast && Math.abs(dx) > 50))) go(target);
      else settle(main);
    };
    main.addEventListener("touchend", end);
    main.addEventListener("touchcancel", end);

    addEventListener("keydown", (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (document.querySelector("dialog[open]")) return;
      const el = document.activeElement;
      if (el && el.closest("[data-strip], input, textarea, select, iframe, .filters, [data-views], [role=tablist], .layers")) return;
      const d = e.key === "ArrowRight" ? 1 : -1;
      if (heroStep && heroInView) { heroStep(d); return; }
      go(d > 0 ? nextLink : prevLink);
    });

    addEventListener("pageshow", (e) => {
      if (e.persisted) { main.style.transform = ""; main.style.opacity = ""; }
    });
  }

  /* Glass bar: light or dark tone depending on what passes behind it (data-zone). */
  const topbar = document.querySelector("[data-topbar]");
  const liquid = document.querySelector("[data-liquid]");
  if (topbar && liquid) {
    const zones = [...document.querySelectorAll("[data-zone]")];
    const under = (el, y) => {
      const r = el.getBoundingClientRect();
      return r.top <= y && r.bottom >= y;
    };
    let queued = false;
    const tone = () => {
      queued = false;
      const b = liquid.getBoundingClientRect();
      const y = b.top + b.height / 2;
      const zone = zones.find((el) => under(el, y));
      topbar.classList.toggle("on-dark", zone?.dataset.zone === "dark");
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(tone); } };
    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", queue);
    addEventListener("toz:tone", queue);
    tone();
  }

  /* Chromium: the bar bends what passes behind its rim, through an SVG displacement map. */
  const chromium = !!navigator.userAgentData?.brands?.some((b) => b.brand === "Chromium");
  if (liquid && chromium && !reduce) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    svg.innerHTML =
      '<filter id="liquid-lens" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
      '<feImage result="map" preserveAspectRatio="none"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G"/>' +
      "</filter>";
    document.body.append(svg);
    const feImage = svg.querySelector("feImage");
    const disp = svg.querySelector("feDisplacementMap");
    let size = "";

    const build = () => {
      const w = Math.round(liquid.offsetWidth);
      const h = Math.round(liquid.offsetHeight);
      if (!w || !h || size === `${w}x${h}`) return;
      size = `${w}x${h}`;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      const img = ctx.createImageData(w, h);
      const d = img.data;
      const r = h / 2;
      const rim = Math.min(r * 0.85, 20);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const px = x + 0.5, py = y + 0.5;
          const vx = px - Math.min(Math.max(px, r), w - r);
          const vy = py - r;
          const len = Math.hypot(vx, vy) || 1e-6;
          const inset = r - len;
          let ox = 0, oy = 0;
          if (inset > 0 && inset < rim) {
            const k = (1 - inset / rim) ** 2;
            ox = (vx / len) * k;
            oy = (vy / len) * k;
          }
          const i = (y * w + x) * 4;
          d[i] = 128 + ox * 127;
          d[i + 1] = 128 + oy * 127;
          d[i + 2] = 128;
          d[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      feImage.setAttribute("href", c.toDataURL());
      feImage.setAttribute("width", w);
      feImage.setAttribute("height", h);
      disp.setAttribute("scale", String(Math.round(h * 0.55)));
    };

    build();
    liquid.classList.add("refract");
    let rt = 0;
    addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(build, 150); });
  }

  /* Menu: full-screen glass sheet with image previews; Esc, button or a vertical swipe closes it. */
  const menu = document.getElementById("menu");
  const menuBtn = document.querySelector("[data-menu-open]");
  if (menu && menuBtn && window.HTMLDialogElement) {
    const preview = menu.querySelector(".menu-preview");
    const pimg = preview?.querySelector("img");
    let closing = false;

    const open = () => {
      root.style.overflow = "hidden";
      menu.showModal();
      menuBtn.setAttribute("aria-expanded", "true");
    };
    const close = () => {
      if (!menu.open || closing) return;
      if (reduce) { menu.close(); return; }
      closing = true;
      menu.classList.add("is-closing");
      menu.addEventListener("animationend", function done(e) {
        if (e.target !== menu) return;
        menu.removeEventListener("animationend", done);
        menu.classList.remove("is-closing");
        closing = false;
        menu.close();
      });
    };

    menuBtn.addEventListener("click", open);
    menu.querySelector("[data-menu-close]").addEventListener("click", close);
    menu.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
    menu.addEventListener("close", () => {
      root.style.overflow = "";
      menuBtn.setAttribute("aria-expanded", "false");
    });
    menu.addEventListener("click", (e) => { if (e.target === menu) close(); });

    let swap = 0;
    const showPreview = (a) => {
      const src = a.dataset.preview;
      if (!pimg || !src || pimg.getAttribute("src") === src) return;
      clearTimeout(swap);
      preview.classList.add("is-swapping");
      swap = setTimeout(() => {
        pimg.src = src;
        pimg.decode?.().catch(() => {}).finally(() => preview.classList.remove("is-swapping"));
      }, 180);
    };
    menu.querySelectorAll("[data-preview]").forEach((a) => {
      a.addEventListener("pointerenter", () => showPreview(a));
      a.addEventListener("focus", () => showPreview(a));
      if (finePointer) new Image().src = a.dataset.preview;
    });

    let ty = null, tx = 0;
    menu.addEventListener("touchstart", (e) => { ty = e.touches[0].clientY; tx = e.touches[0].clientX; }, { passive: true });
    menu.addEventListener("touchend", (e) => {
      if (ty === null) return;
      const dy = e.changedTouches[0].clientY - ty;
      const dx = e.changedTouches[0].clientX - tx;
      ty = null;
      const atTop = menu.scrollTop <= 0;
      const atEnd = menu.scrollTop + menu.clientHeight >= menu.scrollHeight - 1;
      if (Math.abs(dy) > 80 && Math.abs(dy) > Math.abs(dx) * 1.4 && ((dy > 0 && atTop) || (dy < 0 && atEnd))) close();
    });
  }

  /* Projects: scale filters, photograph / plan / list views, cursor preview in the list. */
  const works = document.querySelector("[data-works]");
  if (works) {
    const items = [...works.querySelectorAll(".work")];
    const filterBtns = [...document.querySelectorAll("[data-filters] button")];
    const viewBtns = [...document.querySelectorAll("[data-views] button")];

    const named = (fn, type) => {
      if (!document.startViewTransition || reduce) { fn(); return; }
      items.forEach((li, i) => { li.style.viewTransitionName = `work-${i + 1}`; });
      const vt = transition(fn, type);
      vt?.finished.finally(() => items.forEach((li) => { li.style.viewTransitionName = ""; }));
    };

    const filter = (cat) => {
      items.forEach((li) => { li.hidden = cat !== "all" && li.dataset.cat !== cat; });
      filterBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === cat)));
    };
    filterBtns.forEach((b) => b.addEventListener("click", () => {
      if (b.getAttribute("aria-pressed") !== "true") named(() => filter(b.dataset.filter), "filter");
    }));

    const setView = (v) => {
      works.dataset.view = v;
      viewBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === v)));
      try { localStorage.setItem("toz-view", v); } catch {}
    };
    viewBtns.forEach((b) => b.addEventListener("click", () => {
      if (b.getAttribute("aria-pressed") !== "true") named(() => setView(b.dataset.view), "filter");
    }));
    try {
      const saved = localStorage.getItem("toz-view");
      if (saved !== "grid" && viewBtns.some((b) => b.dataset.view === saved)) setView(saved);
    } catch {}

    if (finePointer) {
      const pv = document.createElement("img");
      pv.className = "hover-preview";
      pv.alt = "";
      pv.setAttribute("aria-hidden", "true");
      document.body.append(pv);
      let x = 0, y = 0, tx = 0, ty = 0, raf = 0, on = false;
      const loop = () => {
        x += (tx - x) * 0.2;
        y += (ty - y) * 0.2;
        const w = pv.offsetWidth;
        const left = x + 28 + w > innerWidth ? x - 28 - w : x + 28;
        pv.style.transform = `translate3d(${left}px, ${y - pv.offsetHeight / 2}px, 0)`;
        raf = on || Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(loop) : 0;
      };
      const hide = () => { on = false; pv.classList.remove("is-on"); };
      works.addEventListener("pointermove", (e) => {
        if (works.dataset.view !== "list") return;
        const a = e.target.closest(".work a");
        tx = e.clientX;
        ty = e.clientY;
        if (!a) { hide(); return; }
        const src = a.querySelector("img").src;
        if (!on) { x = tx; y = ty; }
        if (pv.getAttribute("src") !== src) pv.src = src;
        on = true;
        pv.classList.add("is-on");
        if (!raf) raf = requestAnimationFrame(loop);
      });
      works.addEventListener("pointerleave", hide);
      addEventListener("scroll", hide, { passive: true });
    }
  }

  /* Project pages: the photograph that was clicked grows into the page header (see "proj" in the CSS).
     The way back is named by the head script of the index, which knows which page it came from. */
  const detailDir = /\/(projeler|projects)\/[^/]*$/;
  const isIndex = (url) => !detailDir.test(url.pathname) && /(^|\/)(index|projeler|projects)?(\.html)?$/.test(url.pathname);
  const clearNames = () => document.querySelectorAll("[data-vt]").forEach((el) => { el.style.viewTransitionName = ""; });
  addEventListener("pageswap", (e) => {
    const vt = e.viewTransition;
    const url = e.activation?.entry?.url;
    if (!vt || !url) return;
    const to = new URL(url);
    if (to.origin !== location.origin) return;
    clearNames();
    if (detailDir.test(location.pathname)) {
      if (isIndex(to)) vt.types.add("proj");
      return;
    }
    if (!detailDir.test(to.pathname)) return;
    const key = to.pathname.split("/").pop().replace(/\.html$/, "");
    const img = [...document.querySelectorAll("[data-vt]")].find((el) => el.dataset.vt === key);
    if (!img) return;
    const r = img.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || !r.width) return;
    img.style.viewTransitionName = "proj";
    vt.types.add("proj");
  });
  addEventListener("pageshow", clearNames);

  /* Drawing sheets: tabs (arrow keys, Home, End), swipe between drawings, layer switches, full screen. */
  const drawIn = (sheet) => {
    if (!sheet || reduce) return;
    sheet.classList.remove("is-drawn");
    void sheet.offsetWidth;
    sheet.classList.add("is-drawn");
  };
  document.querySelectorAll("[data-pafta]").forEach((box) => {
    const tabs = [...box.querySelectorAll('[role="tab"]')];
    const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
    let cur = Math.max(0, tabs.findIndex((t) => t.getAttribute("aria-selected") === "true"));

    const select = (i, focus) => {
      const next = (i + tabs.length) % tabs.length;
      if (next === cur) return;
      cur = next;
      tabs.forEach((t, k) => {
        const on = k === cur;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        panels[k].hidden = !on;
      });
      if (focus) tabs[cur].focus({ preventScroll: true });
      const strip = tabs[cur].parentElement;
      if (strip.scrollWidth > strip.clientWidth) {
        const t = tabs[cur].getBoundingClientRect(), s = strip.getBoundingClientRect();
        strip.scrollTo({ left: strip.scrollLeft + t.left - s.left - (s.width - t.width) / 2, behavior: reduce ? "auto" : "smooth" });
      }
      drawIn(panels[cur]);
    };

    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(i));
      t.addEventListener("keydown", (e) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (step) select(cur + step, true);
        else if (e.key === "Home") select(0, true);
        else if (e.key === "End") select(tabs.length - 1, true);
        else return;
        e.preventDefault();
      });
    });

    const stage = box.querySelector(".pafta-stage");
    if (stage && tabs.length > 1) {
      let x0 = null, y0 = 0;
      stage.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" || e.target.closest("a")) return;
        x0 = e.clientX; y0 = e.clientY;
      });
      stage.addEventListener("pointerup", (e) => {
        if (x0 === null) return;
        const dx = e.clientX - x0, dy = e.clientY - y0;
        x0 = null;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) select(cur + (dx < 0 ? 1 : -1));
      });
      stage.addEventListener("pointercancel", () => { x0 = null; });
    }

    const off = new Set();
    box.querySelectorAll("[data-layer-toggle]").forEach((b) => b.addEventListener("click", () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(on));
      off[on ? "delete" : "add"](b.dataset.layerToggle);
      box.dataset.off = [...off].join(" ");
    }));

    const full = box.querySelector("[data-sheet-full]");
    if (full && document.fullscreenEnabled) {
      full.hidden = false;
      full.addEventListener("click", () => {
        const sheet = box.querySelector(".sheet:not([hidden])");
        sheet?.requestFullscreen().catch(() => {});
      });
    }
  });

  /* Material strip: snap scrolling, buttons, counter, mouse drag. */
  document.querySelectorAll("[data-strip]").forEach((strip) => {
    const section = strip.closest("section");
    const items = strip.children;
    const counter = section.querySelector("[data-strip-index]");
    const prevB = section.querySelector("[data-strip-prev]");
    const nextB = section.querySelector("[data-strip-next]");
    const step = () => (items[1] ? items[1].offsetLeft - items[0].offsetLeft : strip.clientWidth);
    const max = () => strip.scrollWidth - strip.clientWidth;
    const behavior = reduce ? "auto" : "smooth";

    const update = () => {
      const atEnd = strip.scrollLeft >= max() - 4;
      const i = atEnd ? items.length : Math.round(strip.scrollLeft / step()) + 1;
      if (counter) counter.textContent = pad(Math.min(i, items.length));
      if (prevB) prevB.disabled = strip.scrollLeft <= 4;
      if (nextB) nextB.disabled = atEnd;
    };

    const moveTo = (left) => {
      const from = strip.scrollLeft;
      strip.scrollTo({ left, behavior });
      setTimeout(() => {
        if (strip.scrollLeft === from) strip.scrollLeft = left;
        update();
      }, 250);
    };

    prevB?.addEventListener("click", () => moveTo(strip.scrollLeft - step()));
    nextB?.addEventListener("click", () => moveTo(strip.scrollLeft + step()));
    strip.addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    update();

    strip.querySelectorAll("img").forEach((img) => { img.draggable = false; });

    let down = false, moved = false, startX = 0, startLeft = 0;
    strip.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true; moved = false; startX = e.clientX; startLeft = strip.scrollLeft;
    });
    addEventListener("pointermove", (e) => {
      if (!down) return;
      const d = e.clientX - startX;
      if (!moved && Math.abs(d) > 5) { moved = true; strip.classList.add("is-dragging"); }
      if (moved) strip.scrollLeft = startLeft - d;
    });
    addEventListener("pointerup", () => {
      if (!down) return;
      down = false;
      if (!moved) return;
      moveTo(Math.min(Math.round(strip.scrollLeft / step()) * step(), max()));
      setTimeout(() => strip.classList.remove("is-dragging"), reduce ? 0 : 420);
    });
    strip.addEventListener("click", (e) => {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);
  });

  /* Lightbox: tap a photograph; swipe sideways to page, swipe down to close. */
  const zooms = [...document.querySelectorAll("[data-zoom]")];
  if (zooms.length && window.HTMLDialogElement) {
    const t = en
      ? { close: "Close", prev: "Previous photograph", next: "Next photograph", open: "Open photograph" }
      : { close: "Kapat", prev: "Önceki kare", next: "Sonraki kare", open: "Kareyi aç" };
    const dlg = document.createElement("dialog");
    dlg.className = "lightbox";
    dlg.innerHTML =
      '<div class="lb-stage"><img class="lb-img" alt=""></div>' +
      '<div class="lb-bar"><p class="lb-caption" aria-live="polite"></p><div class="lb-nav">' +
      `<button type="button" class="round" data-lb="prev" aria-label="${t.prev}">←</button>` +
      `<button type="button" class="round" data-lb="next" aria-label="${t.next}">→</button>` +
      "</div></div>" +
      `<button type="button" class="round lb-close" data-lb="close" aria-label="${t.close}">×</button>`;
    document.body.append(dlg);

    const stage = dlg.querySelector(".lb-stage");
    const img = dlg.querySelector(".lb-img");
    const cap = dlg.querySelector(".lb-caption");
    const groupOf = (el) => el.closest("[data-strip], .team, .studio-grid, .gallery") || main;
    let set = zooms;
    let cur = 0;

    const caption = (el) => {
      const fc = el.closest("figure")?.querySelector("figcaption");
      if (!fc) return el.alt;
      const parts = [...fc.children].map((c) => c.textContent.trim()).filter(Boolean);
      const joined = parts.join(" · ");
      return joined.length > 60 ? parts[0] : joined || fc.textContent.trim();
    };

    const show = (i) => {
      cur = (i + set.length) % set.length;
      const el = set[cur];
      img.src = el.currentSrc || el.src;
      img.alt = el.alt;
      cap.textContent = set.length > 1
        ? `${caption(el)} — ${pad(cur + 1)} / ${pad(set.length)}`
        : caption(el);
      dlg.querySelector(".lb-nav").hidden = set.length < 2;
    };

    const slide = (d) => {
      if (reduce) { show(cur + d); return; }
      img.classList.add("is-settling");
      img.style.transform = `translateX(${-d * 30}%)`;
      img.style.opacity = "0";
      setTimeout(() => {
        img.classList.remove("is-settling");
        show(cur + d);
        img.style.transform = `translateX(${d * 30}%)`;
        requestAnimationFrame(() => requestAnimationFrame(() => settle(img)));
      }, 190);
    };

    const open = (el) => {
      const group = groupOf(el);
      set = zooms.filter((z) => groupOf(z) === group);
      show(set.indexOf(el));
      img.style.transform = "";
      img.style.opacity = "";
      root.style.overflow = "hidden";
      dlg.showModal();
    };

    dlg.addEventListener("close", () => { root.style.overflow = ""; });

    zooms.forEach((el) => {
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      el.setAttribute("aria-haspopup", "dialog");
      el.title = t.open;
      el.addEventListener("click", () => open(el));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(el); }
      });
    });

    dlg.addEventListener("click", (e) => {
      const b = e.target.closest("[data-lb]");
      if (!b) return;
      if (b.dataset.lb === "close") dlg.close();
      else slide(b.dataset.lb === "next" ? 1 : -1);
    });

    dlg.addEventListener("keydown", (e) => {
      if (set.length < 2) return;
      if (e.key === "ArrowRight") { e.preventDefault(); slide(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); slide(-1); }
    });

    let active = false, px = 0, py = 0, pdx = 0, pdy = 0;
    stage.addEventListener("pointerdown", (e) => {
      active = true; px = e.clientX; py = e.clientY; pdx = 0; pdy = 0;
      img.classList.remove("is-settling");
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener("pointermove", (e) => {
      if (!active) return;
      pdx = e.clientX - px;
      pdy = e.clientY - py;
      if (reduce) return;
      if (pdy > 0 && pdy > Math.abs(pdx)) {
        img.style.transform = `translateY(${pdy}px) scale(${1 - Math.min(pdy / 1400, 0.14)})`;
      } else {
        img.style.transform = `translateX(${pdx}px)`;
      }
    });
    stage.addEventListener("pointerup", (e) => {
      if (!active) return;
      active = false;
      const horizontal = Math.abs(pdx) > Math.abs(pdy);
      if (!horizontal && pdy > 110) { dlg.close(); return; }
      if (horizontal && Math.abs(pdx) > 70 && set.length > 1) { slide(pdx < 0 ? 1 : -1); return; }
      settle(img);
      if (Math.abs(pdx) < 6 && Math.abs(pdy) < 6 && e.target === stage) dlg.close();
    });
    stage.addEventListener("pointercancel", () => { active = false; settle(img); });
  }

  /* Drawings draw themselves the first time they come into view: existing lines first, red last. */
  const sheets = document.querySelectorAll(".sheet");
  if (sheets.length && "IntersectionObserver" in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-drawn");
        io.unobserve(entry.target);
      });
    }, { threshold: 0.25 });

    sheets.forEach((sheet) => {
      const svg = sheet.querySelector(".plan-svg");
      if (!svg) return;
      let i = 0;
      svg.querySelectorAll("path, rect, circle, ellipse, line, polyline, polygon, text").forEach((el) => {
        const cs = getComputedStyle(el);
        const red = cs.stroke.includes("229, 0, 21") || cs.fill.includes("229, 0, 21");
        if (el.tagName === "text" || cs.fill !== "none" || cs.stroke === "none" || cs.strokeDasharray !== "none") {
          el.setAttribute("data-fade", "");
        } else {
          el.setAttribute("pathLength", "1");
          el.setAttribute("data-draw", "");
        }
        el.style.setProperty("--i", Math.min(red ? i + 12 : i++, 48));
      });
      if (!sheet.hidden) io.observe(sheet);
    });
  }

  /* Local time in Istanbul. */
  const clocks = document.querySelectorAll("[data-clock]");
  if (clocks.length) {
    const fmt = new Intl.DateTimeFormat(en ? "en-GB" : "tr-TR", {
      timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit",
    });
    const tick = () => {
      const s = fmt.format(new Date());
      clocks.forEach((c) => { c.textContent = s; c.dateTime = s; });
    };
    tick();
    setInterval(tick, 15000);
  }
})();
