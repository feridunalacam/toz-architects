(() => {
  "use strict";

  const root = document.documentElement;
  const en = root.lang === "en";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
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

  /* Sheet navigation: horizontal swipe on touch, arrow keys on desktop. */
  if (main && (prevLink || nextLink)) {
    let sx = 0, sy = 0, st = 0, dx = 0, mode = "y";

    main.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      const edge = t.clientX < 24 || t.clientX > innerWidth - 24;
      mode = e.touches.length !== 1 || edge || e.target.closest("[data-strip], .map") ? "y" : "";
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
      if (document.querySelector("dialog[open]")) return;
      const el = document.activeElement;
      if (el && el.closest("[data-strip], input, textarea, select, iframe")) return;
      if (e.key === "ArrowRight") go(nextLink);
      if (e.key === "ArrowLeft") go(prevLink);
    });

    addEventListener("pageshow", (e) => {
      if (e.persisted) { main.style.transform = ""; main.style.opacity = ""; }
    });
  }

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
      `<button type="button" class="round glass" data-lb="prev" aria-label="${t.prev}">←</button>` +
      `<button type="button" class="round glass" data-lb="next" aria-label="${t.next}">→</button>` +
      "</div></div>" +
      `<button type="button" class="round glass lb-close" data-lb="close" aria-label="${t.close}">×</button>`;
    document.body.append(dlg);

    const stage = dlg.querySelector(".lb-stage");
    const img = dlg.querySelector(".lb-img");
    const cap = dlg.querySelector(".lb-caption");
    const groupOf = (el) => el.closest(".studies, [data-strip], .team, .street") || main;
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

  /* Drawings draw themselves the first time they come into view. */
  const drawings = document.querySelectorAll(".drawing svg");
  if (drawings.length && "IntersectionObserver" in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.closest(".drawing").classList.add("is-drawn");
        io.unobserve(en.target);
      });
    }, { threshold: 0.3 });

    drawings.forEach((svg) => {
      let i = 0;
      svg.querySelectorAll("path, rect, circle, line, polyline").forEach((el) => {
        const cs = getComputedStyle(el);
        const red = cs.stroke.includes("229, 0, 21");
        if (cs.fill !== "none" || cs.stroke === "none" || cs.strokeDasharray !== "none") {
          el.setAttribute("data-fade", "");
        } else {
          el.setAttribute("pathLength", "1");
          el.setAttribute("data-draw", "");
        }
        el.style.setProperty("--i", red ? i + 14 : i++);
      });
      io.observe(svg);
    });
  }

  /* Local time in Istanbul on the contact sheet. */
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
