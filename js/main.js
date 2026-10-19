(() => {
  const { bind } = window.Motion;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

  /* One scroll pass for everything that follows the page (nav, pins, parallax).
     Runs inside the scroll event, which browsers fire once per frame. */
  const scrollFns = [];
  function onScroll(fn) { scrollFns.push(fn); fn(); }
  function runScroll() { scrollFns.forEach((fn) => fn()); }
  window.addEventListener("scroll", runScroll, { passive: true });
  window.addEventListener("resize", runScroll);

  // Resolves once the splash has lifted (or straight away on pages without one), so the
  // hero's entrance plays where it can be seen instead of underneath the splash.
  const pageVisible = new Promise((resolve) => {
    const splash = document.querySelector(".splash");
    if (!splash || splash.classList.contains("is-done")) return resolve();
    window.addEventListener("nimaya:splash-done", resolve, { once: true });
    setTimeout(resolve, 6500);
  });

  // Fires `fn(el)` once, the first time each element scrolls into view.
  function onceInView(els, fn, options = {}) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        fn(entry.target);
        io.unobserve(entry.target);
      }
    }, options);
    els.forEach((el) => io.observe(el));
  }

  /* ---------- Lottie ---------- */
  function initLottie(root = document) {
    if (!window.lottie || !window.NIMAYA_LOTTIE) return;
    root.querySelectorAll("[data-lottie]").forEach((el) => {
      if (el.dataset.lottieReady) return;
      const data = window.NIMAYA_LOTTIE[el.dataset.lottie];
      if (!data) return;
      el.dataset.lottieReady = "1";
      window.lottie.loadAnimation({
        container: el,
        renderer: "svg",
        loop: true,
        autoplay: !reduceMotion,
        // lottie mutates the data it is given, so every instance gets its own copy
        animationData: JSON.parse(JSON.stringify(data)),
        rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
      });
    });
  }

  /* ---------- Hero hashtag rotator ----------
     Framer: AnimatePresence mode="wait"; the current text exits to y:30 / opacity 0,
     then the next enters from y:-30 / opacity 0. No transition is set, so Framer
     Motion's defaults apply (spring 500/25 for y, 0.3s ease for opacity). */
  function initRotator(el) {
    const texts = [...el.children].map((s) => s.textContent);
    el.innerHTML = "";
    let index = 0;
    let busy = false;

    // The texts are absolutely positioned, so the box is sized to the incoming text;
    // CSS transitions the width once the first size has been set.
    // Grows before the swap, shrinks after it, so neither text is clipped mid-animation.
    function measure(text) {
      const probe = document.createElement("span");
      probe.textContent = text;
      probe.style.visibility = "hidden";
      el.append(probe);
      const w = Math.ceil(probe.getBoundingClientRect().width);
      probe.remove();
      return w;
    }
    function fit(text, { grow = true, shrink = true } = {}) {
      const w = measure(text);
      const now = parseFloat(el.style.width) || 0;
      if ((w > now && grow) || (w < now && shrink) || !now) el.style.width = `${w}px`;
    }

    function mount(text) {
      const span = document.createElement("span");
      span.textContent = text;
      el.append(span);
      const m = bind(span, { y: -30, opacity: 0 });
      if (reduceMotion) m.set({ y: 0, opacity: 1 });
      else m.animate({ y: 0, opacity: 1 });
      return span;
    }

    fit(texts[0]);
    document.fonts.ready.then(() => {
      fit(texts[index]);
      requestAnimationFrame(() => el.classList.add("is-fitted"));
    });
    let current = mount(texts[0]);
    if (texts.length < 2 || reduceMotion) return;
    const interval = Number(el.dataset.interval) || 2000;
    setInterval(async () => {
      if (busy) return;
      busy = true;
      index = (index + 1) % texts.length;
      fit(texts[index], { shrink: false });
      await current.__motion.animate({ y: 30, opacity: 0 });
      current.remove();
      fit(texts[index], { grow: false });
      current = mount(texts[index]);
      busy = false;
    }, interval);
  }

  /* ---------- Milestones slideshow ----------
     Port of Framer's SlideShow: an unbounded position animated with a physics spring
     (stiffness 200, damping 40, mass 1) and wrapped across three copies of the cards.
     Interrupting keeps the current velocity, as in Framer Motion. */
  function initSlider(root) {
    const track = root.querySelector(".slider__track");
    const originals = [...track.children];
    const n = originals.length;
    originals.forEach((c) => track.appendChild(c.cloneNode(true)));
    originals.slice().reverse().forEach((c) => track.insertBefore(c.cloneNode(true), track.firstChild));

    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const step = () => originals[0].getBoundingClientRect().width + gap;
    const wrap = (min, max, v) => { const r = max - min; return ((((v - min) % r) + r) % r) + min; };

    let slide = n; // Framer starts at startFrom + item count
    const pos = new window.Motion.MotionValue(-slide * step(), (v) => {
      const set = n * step();
      track.style.transform = `translateX(${wrap(-set, -2 * set, v)}px)`;
    });
    pos.set(-slide * step());

    const transition = { type: "spring", stiffness: 200, damping: 40, mass: 1 };
    const interval = (Number(root.dataset.interval) || 3000);
    let timer = null;
    let inView = false;

    function play() {
      clearTimeout(timer);
      if (pos.value !== -slide * step()) pos.animateTo(-slide * step(), reduceMotion ? { type: "tween", duration: 0 } : transition);
      // Like Framer: the next slide is queued from the start of this one, and only while on screen.
      if (!reduceMotion && inView && !document.hidden) {
        timer = setTimeout(() => { slide += 1; play(); }, interval);
      }
    }

    root.querySelector(".slider__arrow--prev").addEventListener("click", () => { slide -= 1; play(); });
    root.querySelector(".slider__arrow--next").addEventListener("click", () => { slide += 1; play(); });
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; play(); }).observe(root);
    document.addEventListener("visibilitychange", play);
    window.addEventListener("resize", () => pos.set(-slide * step()));
  }

  /* ---------- Partner logo ticker ----------
     Port of Framer's Ticker: a linear Web Animation over a whole number of sets,
     at 100px/s, slowed to 0.5x while hovered, paused offscreen. */
  function initTicker(root) {
    const list = root.querySelector(".ticker__list");
    const items = [...list.children];
    const gap = Number(root.dataset.gap) || 0;
    const speed = Number(root.dataset.speed) || 100;
    const setWidth = items.reduce((w, li) => w + li.getBoundingClientRect().width + gap, 0);
    const parent = root.clientWidth;
    if (!setWidth) return;

    const distance = setWidth + setWidth * Math.round(parent / setWidth);
    while (list.scrollWidth < distance + parent) {
      items.forEach((li) => {
        const c = li.cloneNode(true);
        c.setAttribute("aria-hidden", "true");
        list.appendChild(c);
      });
    }
    if (reduceMotion) return;

    const anim = list.animate(
      { transform: ["translateX(0px)", `translateX(${-distance}px)`] },
      { duration: (distance / speed) * 1000, iterations: Infinity, easing: "linear" }
    );
    root.addEventListener("mouseenter", () => { anim.playbackRate = 0.5; });
    root.addEventListener("mouseleave", () => { anim.playbackRate = 1; });
    let inView = true;
    const sync = () => {
      if (inView && !document.hidden) anim.playState === "paused" && anim.play();
      else anim.playState === "running" && anim.pause();
    };
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }).observe(root);
    document.addEventListener("visibilitychange", sync);
  }

  /* ---------- Smooth scrolling ----------
     Wheel input eases toward its target instead of jumping in steps. Touch,
     keyboard and scrollbar keep native scrolling; the target resyncs from them. */
  function initSmoothScroll() {
    if (reduceMotion || !finePointer) return;
    const root = document.documentElement;
    let target = window.scrollY;
    let current = target;
    let running = false;
    let last = 0;

    function frame(now) {
      const dt = last ? Math.min(64, now - last) : 16.7;
      last = now;
      current += (target - current) * (1 - Math.pow(0.9, dt / 16.7));
      if (Math.abs(target - current) < 0.5) {
        current = target;
        running = false;
      }
      window.scrollTo(0, current);
      if (running) requestAnimationFrame(frame);
    }

    window.addEventListener("wheel", (e) => {
      if (e.ctrlKey || root.classList.contains("is-locked") || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (!running) current = target = window.scrollY;
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1;
      target = clamp(target + e.deltaY * unit, 0, root.scrollHeight - window.innerHeight);
      if (!running) {
        running = true;
        last = 0;
        requestAnimationFrame(frame);
      }
    }, { passive: false });
  }

  /* ---------- Reveals ----------
     Blocks fade up, titles rise line by line, photos open out of a smaller window.
     All timing lives in CSS (--ease, --t-*); JS only flips the classes. */
  function initReveal() {
    const all = [...document.querySelectorAll("[data-reveal]")];
    all.forEach((el) => {
      const d = Number(el.dataset.delay) || 0;
      if (d) el.style.setProperty("--d", `${d}s`);
    });
    if (reduceMotion) return all.forEach((el) => el.classList.add("is-in"));
    // The hero's own blocks start with the hero (initHero), not on intersection
    const els = all.filter((el) => !el.closest(".hero"));
    onceInView(els, (el) => el.classList.add("is-in"), { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
  }

  function wrapRise(el) {
    const inner = document.createElement("span");
    inner.className = "rise__in";
    inner.append(...el.childNodes);
    const outer = document.createElement("span");
    outer.className = "rise";
    outer.append(inner);
    el.append(outer);
    return outer;
  }

  // Must run before initDraw: the script words move into the new wrappers.
  function initRise() {
    const titles = [...document.querySelectorAll("h2.display")];
    titles.forEach(wrapRise);
    document.querySelectorAll(".hero__title .line").forEach((line, i) => {
      wrapRise(line).style.setProperty("--d", `${0.1 + i * 0.12}s`);
    });
    if (reduceMotion) return;
    onceInView(titles, (el) => el.classList.add("is-risen"), { rootMargin: "0px 0px -15% 0px" });
  }

  function initUnmask() {
    const els = [...document.querySelectorAll("[data-unmask]")].filter(
      (el) => !el.closest(".hero") && !el.closest(".pin.is-pinned .work__step")
    );
    if (reduceMotion) return els.forEach((el) => el.classList.add("is-in"));
    onceInView(els, (el) => el.classList.add("is-in"), { threshold: 0.25 });
  }

  /* ---------- Hero entrance ----------
     Headline rises, photo opens, the script word writes, cards pop, paths draw.
     The stagger lives in CSS; this starts it once the fonts are in. */
  function initHero() {
    const hero = document.querySelector(".hero");
    if (!hero) return;
    const go = () => {
      hero.classList.add("is-in");
      hero.querySelector(".hero__title").classList.add("is-risen");
      hero.querySelectorAll("[data-unmask], [data-reveal]").forEach((el) => el.classList.add("is-in"));
    };
    if (reduceMotion) return go();
    Promise.all([document.fonts.ready, pageVisible]).then(() => setTimeout(go, 60));
  }

  /* ---------- Pinned chapters ----------
     The section grows taller and its stage sticks; scroll progress through the
     section drives the content. Milestones: the row slides sideways.
     How We Work (desktop): steps light up one by one along the trail. */
  function initPins() {
    if (reduceMotion) return;
    const progressOf = (sec) => {
      const r = sec.getBoundingClientRect();
      return clamp(-r.top / Math.max(1, r.height - window.innerHeight));
    };

    const ms = document.querySelector('[data-pin="milestones"]');
    if (ms) {
      const track = ms.querySelector(".slider__track");
      const viewport = ms.querySelector(".slider__viewport");
      const cards = [...track.querySelectorAll(".stat")];
      const trail = ms.querySelector(".milestones__trail");
      const dots = [...ms.querySelectorAll(".journey__dots li")];
      const now = ms.querySelector(".journey__now");
      const num = ms.querySelector(".milestones__num");
      let shown = -1;
      const pad = (n) => String(n).padStart(2, "0");
      let dist = 0, start = 0, half = 1, arc = 0, centers = [];
      ms.classList.add("is-pinned");
      const measure = () => {
        track.style.transform = "";
        // The row travels from the first card centred to the last card centred
        half = viewport.clientWidth / 2;
        centers = cards.map((c) => c.offsetLeft + c.offsetWidth / 2);
        start = half - centers[0];
        dist = Math.max(0, centers[centers.length - 1] - centers[0]);
        ms.style.height = `${window.innerHeight + dist * 1.3}px`;
        // Cards ride a parabola: highest at the centre, dipping `arc` px at the viewport edges
        arc = Math.min(56, half * 0.1);
        ms.style.setProperty("--arc", `${arc.toFixed(0)}px`);
        // The trail is a quadratic curve, i.e. the same parabola (viewBox is 40 units tall)
        const trailH = trail ? trail.getBoundingClientRect().height : 0;
        if (trailH) {
          const k = (arc * 40) / trailH;
          trail.querySelector("path").setAttribute("d", `M0 ${(20 + k).toFixed(1)} Q 300 ${(20 - k).toFixed(1)} 600 ${(20 + k).toFixed(1)}`);
        }
      };
      measure();
      window.addEventListener("resize", measure);
      window.addEventListener("load", measure);
      onScroll(() => {
        const p = clamp((progressOf(ms) - 0.06) / 0.88);
        const x = start - p * dist;
        track.style.transform = `translateX(${x.toFixed(1)}px)`;
        cards.forEach((card, i) => {
          const d = (centers[i] + x - half) / half; // -1 at the left edge, 1 at the right
          card.style.translate = `0 ${(arc * d * d).toFixed(1)}px`;
          card.style.rotate = `${(Math.atan((2 * arc * d) / half) * 180 / Math.PI).toFixed(2)}deg`;
          // Titles turn coral once their card reaches the centre, and stay lit after it passes
          card.classList.toggle("is-lit", d <= 0.03);
        });
        // Progress dots, counter and the big index follow the last lit card
        const lit = Math.max(1, cards.filter((c) => c.classList.contains("is-lit")).length);
        if (lit !== shown) {
          shown = lit;
          dots.forEach((dot, i) => {
            dot.classList.toggle("is-lit", i < lit);
            dot.classList.toggle("is-now", i === lit - 1);
          });
          if (now) now.textContent = pad(lit);
          if (num) {
            num.classList.add("is-swapping");
            clearTimeout(num.__t);
            num.__t = setTimeout(() => { num.textContent = pad(lit); num.classList.remove("is-swapping"); }, 200);
          }
        }
      });
    }

    const work = document.querySelector('[data-pin="work"]');
    if (work) {
      const steps = [...work.querySelectorAll(".work__step")];
      const desktop = window.matchMedia("(min-width: 1101px)");
      const setOn = (step, on) => {
        step.classList.toggle("is-on", on);
        step.querySelector("[data-unmask]").classList.toggle("is-in", on);
      };
      const apply = () => {
        const pinned = desktop.matches;
        work.classList.toggle("is-pinned", pinned);
        work.style.height = pinned ? `${window.innerHeight * 1.7}px` : "";
        if (!pinned) steps.forEach((s) => setOn(s, true));
        runScroll();
      };
      desktop.addEventListener("change", apply);
      window.addEventListener("resize", () => {
        if (desktop.matches) work.style.height = `${window.innerHeight * 1.7}px`;
      });
      work.classList.toggle("is-pinned", desktop.matches);
      onScroll(() => {
        if (!work.classList.contains("is-pinned")) return;
        const s = clamp(progressOf(work) / 0.82) * (steps.length - 1);
        steps.forEach((step, i) => setOn(step, i <= s + 0.02));
        work.style.setProperty("--trail", (s / (steps.length - 1)).toFixed(4));
      });
      apply();
    }
  }

  /* ---------- Counters ("10,000+" counts up the first time it is seen) ---------- */
  function initCounters() {
    const els = [...document.querySelectorAll("[data-count]")];
    if (reduceMotion) return;
    const fmt = (n) => Math.round(n).toLocaleString("en-IN");
    els.forEach((el) => {
      el.style.fontVariantNumeric = "tabular-nums";
      el.textContent = fmt(0) + (el.dataset.suffix || "");
    });
    onceInView(els, (el) => {
      const end = Number(el.dataset.count);
      const suffix = el.dataset.suffix || "";
      const start = performance.now();
      const tick = (now) => {
        const t = clamp((now - start) / 1600);
        el.textContent = fmt(end * (1 - Math.pow(1 - t, 4))) + suffix;
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.6 });
  }

  /* ---------- Nav: reading progress + compact state after the hero ---------- */
  function initNav() {
    const nav = document.querySelector(".nav");
    const hero = document.querySelector(".hero");
    onScroll(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      nav.style.setProperty("--progress", max > 0 ? (window.scrollY / max).toFixed(4) : 0);
      nav.classList.toggle("is-scrolled", window.scrollY > (hero ? hero.offsetHeight : 0) - 160);
    });
  }

  /* ---------- Mobile menu ----------
     Below 900px the links fold into a sheet under the bar. Closes on a link,
     on Escape, or when the screen grows back past the breakpoint. */
  function initMenu() {
    const nav = document.querySelector(".nav");
    const btn = nav && nav.querySelector(".nav__toggle");
    if (!btn) return;
    const wide = window.matchMedia("(min-width: 901px)");
    const set = (open) => {
      nav.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.documentElement.classList.toggle("is-locked", open);
    };
    btn.addEventListener("click", () => set(!nav.classList.contains("is-open")));
    nav.querySelectorAll(".nav__links a").forEach((a) => a.addEventListener("click", () => set(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("is-open")) { set(false); btn.focus(); }
    });
    wide.addEventListener("change", () => wide.matches && set(false));
  }

  /* ---------- Programs dropdown ----------
     Hover and focus open it in CSS; a click toggles it for touch and keyboard. */
  function initDropdown() {
    document.querySelectorAll(".nav__drop").forEach((drop) => {
      const btn = drop.querySelector(".nav__drop-btn");
      const set = (open) => {
        drop.classList.toggle("is-open", open);
        btn.setAttribute("aria-expanded", String(open));
      };
      btn.addEventListener("click", () => set(!drop.classList.contains("is-open")));
      document.addEventListener("click", (e) => { if (!drop.contains(e.target)) set(false); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
    });
  }

  /* ---------- Tabs (curriculum segments, Impact program switch) ---------- */
  function initTabs(root) {
    const tabs = [...root.querySelectorAll('[role="tab"]')].filter((t) => t.closest("[data-tabs]") === root);
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      root.style.setProperty("--tab-i", tabs.indexOf(tab));
      if (focus) tab.focus();
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(tab));
      tab.addEventListener("keydown", (e) => {
        const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (step) select(tabs[(i + step + tabs.length) % tabs.length], true);
      });
    });
    select(tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0]);
  }

  /* ---------- Before / after bars ----------
     Bars grow from the baseline the first time they are seen; each bar shows its
     value in a tooltip on hover or focus. */
  function initBars(root) {
    const tip = document.createElement("div");
    tip.className = "ba__tip";
    tip.setAttribute("role", "status");
    root.querySelector(".ba__rows").append(tip);
    root.querySelectorAll(".ba__bar").forEach((bar) => {
      const show = () => {
        const rows = root.querySelector(".ba__rows").getBoundingClientRect();
        const r = bar.getBoundingClientRect();
        tip.textContent = bar.dataset.tip;
        tip.style.left = `${r.right - rows.left}px`;
        tip.style.top = `${r.top - rows.top}px`;
        tip.classList.add("is-on");
      };
      const hide = () => tip.classList.remove("is-on");
      bar.tabIndex = 0;
      bar.addEventListener("pointerenter", show);
      bar.addEventListener("pointerleave", hide);
      bar.addEventListener("focus", show);
      bar.addEventListener("blur", hide);
    });
    if (reduceMotion) return root.classList.add("is-in");
    onceInView([root], (el) => el.classList.add("is-in"), { threshold: 0.3 });
  }

  /* ---------- Reach map ----------
     State outlines come from india-map-data.js, places from reach-data.js. Each place
     gets a pin; clicking it opens its card beside the pin. When a new card needs the
     space an open one is using, the older card closes (and at most three stay open).
     On narrow screens one card at a time shows in a panel under the map instead. */
  function initReachMap(root) {
    const geo = window.NIMAYA_INDIA;
    const places = window.NIMAYA_REACH;
    if (!geo || !places) return;
    const NS = "http://www.w3.org/2000/svg";
    const assets = root.dataset.assets || "assets/";
    const GAP = 16;     // pin -> card
    const BLEED = 40;   // how far a card may hang outside the map box
    const MAX_OPEN = 3;
    const narrow = window.matchMedia("(max-width: 700px)");

    // data-hover: pins open on hover (mouse only); data-quiet: no cards open by default
    const hover = root.hasAttribute("data-hover") && finePointer;
    const quiet = root.hasAttribute("data-quiet");
    const hint = root.querySelector(".reach-map__hint");
    if (hint && !hover) hint.textContent = hint.textContent.replace(/^Hover/, "Tap");
    function hoverOpens(el, item) {
      el.addEventListener("pointerenter", () => {
        clearTimeout(item.timer);
        // Moving on to another place closes the last hovered one at once
        opened.filter((o) => o !== item && !o.stuck).forEach((o) => { clearTimeout(o.timer); close(o); });
        if (!narrow.matches && !isOpen(item)) open(item);
      });
      el.addEventListener("pointerleave", () => {
        // Short grace so the pointer can cross from a pin to its card or photo
        if (!item.stuck) item.timer = setTimeout(() => close(item), 120);
      });
    }

    const box = root.querySelector(".reach-map__box");
    const panel = root.querySelector(".reach-map__panel");
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "reach-map__svg");
    svg.setAttribute("viewBox", `0 0 ${geo.width} ${geo.height}`);
    svg.setAttribute("aria-hidden", "true");
    const stateOf = {};
    places.forEach((p) => {
      if (p.status === "live") stateOf[p.state] = "is-active";
      else if (p.status === "new" && !stateOf[p.state]) stateOf[p.state] = "is-new";
    });
    let order = 0;
    Object.entries(geo.states).forEach(([name, d], i) => {
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("class", `reach-map__state ${stateOf[name] || ""}`);
      path.style.setProperty("--i", i);
      if (stateOf[name]) path.style.setProperty("--o", order++);
      svg.append(path);
    });
    /* data-holo: solid borders (a silhouette plus the state lines) with a band of
       electric pink sweeping along them, and a faint hollow copy of the silhouette
       offset behind. The silhouette is a wide stroke drawn under the fills, so only
       its outer half shows; the hollow copy is cut from a stroke with a mask. */
    if (root.hasAttribute("data-holo")) {
      const id = `reach-holo-${Math.random().toString(36).slice(2, 7)}`;
      const W = geo.width, H = geo.height;
      const shapes = Object.values(geo.states);
      const paths = (attrs = "") => shapes.map((d) => `<path d="${d}"${attrs}/>`).join("");
      const sweep = reduceMotion ? "" : `<animateTransform attributeName="gradientTransform" type="translate" values="${-W} ${-H}; ${W} ${H}" dur="4s" repeatCount="indefinite"/>`;
      const edges = (cls) => `<g class="reach-map__edge ${cls}" stroke="url(#${id}-sweep)">${paths(' vector-effect="non-scaling-stroke"')}</g>`;
      svg.insertAdjacentHTML("afterbegin", `
        <defs>
          <linearGradient id="${id}-sweep" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="${H}">
            <stop offset="0.42" stop-color="#412287"/>
            <stop offset="0.48" stop-color="#ce52b0"/>
            <stop offset="0.5" stop-color="#ff7bbd"/>
            <stop offset="0.52" stop-color="#ce52b0"/>
            <stop offset="0.58" stop-color="#412287"/>
            ${sweep}
          </linearGradient>
          <mask id="${id}-hollow" maskUnits="userSpaceOnUse" x="-40" y="-40" width="${W + 80}" height="${H + 80}">
            <g fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round">${paths()}</g>
            <g fill="#000">${paths()}</g>
          </mask>
        </defs>
        <g class="reach-map__ghost"><g transform="translate(14 18)"><rect x="-40" y="-40" width="${W + 80}" height="${H + 80}" mask="url(#${id}-hollow)"/></g></g>
        ${edges("reach-map__edge--outline")}`);
      svg.insertAdjacentHTML("beforeend", edges("reach-map__edge--lines"));
    }
    const layer = document.createElement("div");
    layer.className = "reach-map__layer";
    box.append(svg, layer);

    const uid = Math.random().toString(36).slice(2, 7);
    let pinIndex = 0;
    const items = places.map((place) => {
      const card = document.createElement("div");
      card.className = "reach-card";
      card.id = `reach-${uid}-${place.id}`;
      card.setAttribute("role", "group");
      card.setAttribute("aria-label", `${place.name}, ${place.subtitle || place.state}`);
      // Hover maps close a card as the pointer leaves, so only tap maps need a close button
      card.innerHTML = `${hover ? "" : `
        <button class="reach-card__close" type="button" aria-label="Close ${place.name}">
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>`}
        <p class="reach-card__place">${place.name}<span>${place.subtitle || place.state}</span></p>
        <ul class="reach-card__lines">${place.lines.map((l) => `<li>${l.num ? `<b>${l.num}</b>` : ""}<span>${l.text}</span></li>`).join("")}</ul>
        ${place.note ? `<p class="reach-card__note">${place.note}</p>` : ""}
        ${place.partners ? `<div class="reach-card__logos">${place.partners.map((src) => `<img src="${assets}img/${src}" alt="" loading="lazy">`).join("")}</div>` : ""}`;
      layer.append(card);

      const pins = place.points.map(([lon, lat], k) => {
        const [x, y] = geo.project(lon, lat);
        const pin = document.createElement("button");
        pin.type = "button";
        pin.className = `reach-pin reach-pin--${place.status}${k ? " reach-pin--minor" : ""}`;
        pin.style.left = `${(x / geo.width) * 100}%`;
        pin.style.top = `${(y / geo.height) * 100}%`;
        pin.style.setProperty("--pi", pinIndex++);
        pin.setAttribute("aria-label", `${place.name}, ${place.subtitle || place.state}`);
        pin.setAttribute("aria-expanded", "false");
        pin.setAttribute("aria-controls", card.id);
        pin.innerHTML = `<span class="reach-pin__dot"></span><span class="reach-pin__tag" aria-hidden="true">${place.name}</span>`;
        layer.append(pin);
        return { pin, fx: x / geo.width, fy: y / geo.height };
      });
      const item = { place, card, pins, rect: null, stuck: false, timer: 0 };
      pins.forEach(({ pin }) => {
        pin.addEventListener("click", (e) => {
          // Hover maps: hovering already opened it, so only a keyboard press toggles
          if (hover && e.detail > 0) return;
          isOpen(item) ? close(item) : open(item);
        });
        pin.addEventListener("pointerenter", () => card.classList.add("is-hot"));
        pin.addEventListener("pointerleave", () => card.classList.remove("is-hot"));
        if (hover) hoverOpens(pin, item);
      });
      if (hover) hoverOpens(card, item);
      card.querySelector(".reach-card__close")?.addEventListener("click", () => {
        close(item);
        pins[0].pin.focus();
      });
      return item;
    });

    // Pins that land on (almost) the same spot are nudged apart so each can be hovered on its own
    const allPins = items.flatMap((i) => i.pins);
    const MIN = 30; // map units, about one pin's width
    for (let pass = 0; pass < 8; pass++) {
      allPins.forEach((a, i) => allPins.slice(i + 1).forEach((b) => {
        let dx = (b.fx - a.fx) * geo.width, dy = (b.fy - a.fy) * geo.height;
        let d = Math.hypot(dx, dy);
        if (d >= MIN) return;
        if (d < 0.01) { dx = 1; dy = 0; d = 1; }
        const push = (MIN - d) / 2;
        a.fx -= (dx / d) * push / geo.width; a.fy -= (dy / d) * push / geo.height;
        b.fx += (dx / d) * push / geo.width; b.fy += (dy / d) * push / geo.height;
      }));
    }
    allPins.forEach((p) => { p.pin.style.left = `${p.fx * 100}%`; p.pin.style.top = `${p.fy * 100}%`; });

    /* data-motion: live places joined into one route (nearest neighbour from the first),
       drawn as gentle arcs with pink pulses travelling along them */
    const motion = root.hasAttribute("data-motion");
    const route = [];
    if (motion) {
      const left = items.filter((i) => i.place.status === "live");
      const at = (i) => [i.pins[0].fx * geo.width, i.pins[0].fy * geo.height];
      if (left.length) route.push(left.shift());
      while (left.length) {
        const [x, y] = at(route[route.length - 1]);
        left.sort((a, b) => Math.hypot(at(a)[0] - x, at(a)[1] - y) - Math.hypot(at(b)[0] - x, at(b)[1] - y));
        route.push(left.shift());
      }
      const arcs = route.slice(1).map((item, i) => {
        const [x1, y1] = at(route[i]);
        const [x2, y2] = at(item);
        // Bow each arc sideways by a fifth of its length
        const cx = (x1 + x2) / 2 + (y2 - y1) * 0.2;
        const cy = (y1 + y2) / 2 - (x2 - x1) * 0.2;
        return `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
      });
      const pulses = reduceMotion ? "" : arcs.map((d, i) => `
        <circle r="4" opacity="0">
          <animateMotion path="${d}" dur="2.4s" begin="${(i * 0.8).toFixed(1)}s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.8;1" dur="2.4s" begin="${(i * 0.8).toFixed(1)}s" repeatCount="indefinite"/>
        </circle>`).join("");
      svg.insertAdjacentHTML("beforeend", `<g class="reach-map__routes">${arcs.map((d) => `<path d="${d}" vector-effect="non-scaling-stroke"/>`).join("")}${pulses}</g>`);
    }

    let opened = []; // oldest first
    const isOpen = (item) => opened.includes(item);
    const overlaps = (a, b, m = 8) => a.left < b.left + b.w + m && b.left < a.left + a.w + m && a.top < b.top + b.h + m && b.top < a.top + a.h + m;

    // Card placements around a pin: the side it sits on, then which way it extends
    // ("right-down" sits right of the pin and hangs downward from it).
    const SIDES = ["right", "right-down", "right-up", "left", "left-down", "left-up",
      "bottom", "bottom-right", "bottom-left", "top", "top-right", "top-left"];
    const HANG = 26; // how far a hanging card reaches back past its pin

    function placeCard(item) {
      const W = layer.clientWidth;
      const H = layer.clientHeight;
      const w = item.card.offsetWidth;
      const h = item.card.offsetHeight;
      const px = item.pins[0].fx * W;
      const py = item.pins[0].fy * H;
      const along = { "": 0.5, down: 0, up: 1, right: 0, left: 1 };
      const rectFor = (name) => {
        const [side, dir = ""] = name.split("-");
        const k = along[dir];
        const r = side === "right" || side === "left"
          ? { left: side === "right" ? px + GAP : px - GAP - w, top: dir ? (k ? py + HANG - h : py - HANG) : py - h / 2 }
          : { top: side === "bottom" ? py + GAP : py - GAP - h, left: dir ? (k ? px + HANG - w : px - HANG) : px - w / 2 };
        // Keep it inside the map (plus a little bleed), then make sure it isn't covering its own pin
        r.left = clamp(r.left, -BLEED, W + BLEED - w);
        r.top = clamp(r.top, -BLEED, H + BLEED - h);
        const covers = px > r.left - 8 && px < r.left + w + 8 && py > r.top - 8 && py < r.top + h + 8;
        return covers ? null : { side, ...r, w, h };
      };
      const names = [item.place.side, ...SIDES].filter((s, i, a) => s && a.indexOf(s) === i);
      const options = names.map(rectFor).filter(Boolean);
      const others = opened.filter((o) => o !== item);
      // Photos that will be on show once this opens are kept clear too: its own photo above
      // all, then those of other open places, and the default photos while they're at rest
      const rectOf = ({ el }) => ({ left: el.offsetLeft, top: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
      const own = photos.filter((p) => p.item === item).map(rectOf);
      const shots = photos.filter((p) => p.item !== item && (isOpen(p.item)
        || (!exploring && !touring && p.el.hasAttribute("data-default")))).map(rectOf);
      const clearOfCards = (r) => !others.some((o) => overlaps(r, o.rect));
      const clearOfOwn = (r) => !own.some((s) => overlaps(r, s));
      const pick = options.find((r) => clearOfCards(r) && clearOfOwn(r) && !shots.some((s) => overlaps(r, s)))
        || options.find((r) => clearOfCards(r) && clearOfOwn(r))
        || options.find(clearOfCards) || options[0];
      const across = pick.side === "left" || pick.side === "right";
      const card = item.card;
      card.dataset.side = pick.side;
      card.style.left = `${pick.left.toFixed(1)}px`;
      card.style.top = `${pick.top.toFixed(1)}px`;
      card.style.setProperty("--tail", `${clamp(across ? py - pick.top : px - pick.left, 18, (across ? h : w) - 18).toFixed(1)}px`);
      item.rect = pick;
    }

    function open(item) {
      const card = item.card;
      if (narrow.matches) {
        opened.forEach((o) => setOpen(o, false));
        opened = [item];
        panel.append(card);
        setOpen(item, true);
        return;
      }
      placeCard(item);
      // Make room: close open cards the new one would cover, then the oldest beyond the cap
      opened.filter((o) => o !== item && overlaps(item.rect, o.rect)).forEach(close);
      opened = opened.filter((o) => o !== item).concat(item);
      while (opened.length > MAX_OPEN) close(opened[0]);
      setOpen(item, true);
      // Raise the newest card above the others
      opened.forEach((o, i) => { o.card.style.zIndex = 3 + i; });
    }

    function close(item) {
      opened = opened.filter((o) => o !== item);
      item.stuck = false;
      setOpen(item, false);
    }

    function setOpen(item, on) {
      item.card.classList.toggle("is-open", on);
      item.pins.forEach(({ pin }) => pin.setAttribute("aria-expanded", String(on)));
      syncPhotos();
    }

    /* data-default photos show at rest; once the pointer is on the map, only the
       photos of open places show. Without data-default, every photo always shows. */
    let photos = [];
    let exploring = false;
    let touring = null; // the place the idle tour has open
    function syncPhotos() {
      const picky = photos.some((p) => p.el.hasAttribute("data-default"));
      photos.forEach((p) => {
        const on = !picky || isOpen(p.item) || (!exploring && !touring && p.el.hasAttribute("data-default"));
        p.el.classList.toggle("is-hidden", !on);
        p.link?.classList.toggle("is-hidden", !on);
      });
    }

    function reset() {
      opened.slice().forEach(close);
      items.forEach((item) => {
        if (narrow.matches) panel.append(item.card);
        else layer.append(item.card);
        item.card.removeAttribute("style");
      });
      const defaults = quiet ? [] : items.filter((i) => i.place.open);
      (narrow.matches ? defaults.slice(0, 1) : defaults).forEach(open);
    }

    /* Photos pinned to places: each hangs off its place's first pin by a dotted
       leader line, and hovering (or tapping) the photo opens that place's card. */
    let drawLinks = () => {};
    photos = [...box.querySelectorAll(".reach-photo[data-place]")]
      .map((el) => ({ el, item: items.find((i) => i.place.id === el.dataset.place), link: null }))
      .filter((p) => p.item);
    if (photos.length) {
      if (hover) {
        box.addEventListener("pointerenter", () => { exploring = true; syncPhotos(); });
        box.addEventListener("pointerleave", () => { exploring = false; syncPhotos(); });
      }
      const links = document.createElementNS(NS, "svg");
      links.setAttribute("class", "reach-map__links");
      links.setAttribute("aria-hidden", "true");
      svg.after(links);
      photos.forEach((p) => {
        p.link = document.createElementNS(NS, "path");
        links.append(p.link);
      });
      // Measured from the rendered boxes, so lines stay attached while photos float and drift
      drawLinks = () => {
        const W = box.clientWidth;
        const H = box.clientHeight;
        const base = box.getBoundingClientRect();
        links.setAttribute("viewBox", `0 0 ${W} ${H}`);
        photos.forEach(({ el, item, link }) => {
          const px = item.pins[0].fx * W;
          const py = item.pins[0].fy * H;
          // Run to the nearest point on the photo's edge
          const r = el.getBoundingClientRect();
          const x = clamp(px, r.left - base.left, r.right - base.left);
          const y = clamp(py, r.top - base.top, r.bottom - base.top);
          link.setAttribute("d", `M${px.toFixed(1)} ${py.toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)}`);
        });
      };
      syncPhotos();
      new ResizeObserver(() => drawLinks()).observe(box);
      photos.forEach(({ el, item }) => {
        if (hover) hoverOpens(el, item);
        el.addEventListener("click", () => {
          if (!hover) item.stuck = true;
          if (!isOpen(item)) open(item);
        });
      });
    }

    let started = false;
    const start = () => {
      started = true;
      root.classList.add("is-in");
      setTimeout(reset, reduceMotion ? 0 : 1500);
      // Entrance staggers done: photos now show and hide without delay
      setTimeout(() => root.classList.add("is-settled"), reduceMotion ? 0 : 2600);
    };

    /* Idle tour (data-motion): while the map is on screen and nobody is using it,
       open each place on the route in turn. Hovering pauses it; a tap ends it. */
    let inView = false, pointerIn = false, tourOff = reduceMotion || !motion || !route.length;
    let tourTimer = 0, tourIndex = 0;
    function stopTour() {
      clearTimeout(tourTimer);
      const was = touring;
      touring = null;
      if (was) close(was);
      syncPhotos();
    }
    function tourStep() {
      if (tourOff || !inView || pointerIn || narrow.matches) return stopTour();
      if (touring) close(touring);
      touring = route[tourIndex++ % route.length];
      open(touring);
      tourTimer = setTimeout(tourStep, 3400);
    }
    const tourLater = (ms) => { clearTimeout(tourTimer); if (!tourOff) tourTimer = setTimeout(tourStep, ms); };
    if (motion) {
      box.addEventListener("pointerenter", () => { pointerIn = true; stopTour(); });
      box.addEventListener("pointerleave", () => { pointerIn = false; tourLater(4000); });
      box.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") { tourOff = true; stopTour(); } });
      new IntersectionObserver(([e]) => {
        inView = e.isIntersecting;
        inView ? tourLater(4500) : stopTour();
      }, { threshold: 0.4 }).observe(root);
    }

    /* Cursor depth (data-motion, mouse only): the map, its photos and the offset
       silhouette drift by different amounts with the pointer. One loop eases the
       values and keeps the photo leader lines attached while photos move. */
    if (motion && finePointer && !reduceMotion) {
      let tx = 0, ty = 0, mx = 0, my = 0, raf = 0;
      const tick = () => {
        mx += (tx - mx) * 0.08;
        my += (ty - my) * 0.08;
        root.style.setProperty("--mx", mx.toFixed(4));
        root.style.setProperty("--my", my.toFixed(4));
        drawLinks();
        raf = inView ? requestAnimationFrame(tick) : 0;
      };
      window.addEventListener("pointermove", (e) => {
        tx = clamp((e.clientX / innerWidth) * 2 - 1, -1, 1);
        ty = clamp((e.clientY / innerHeight) * 2 - 1, -1, 1);
      }, { passive: true });
      new IntersectionObserver(([e]) => { if (e.isIntersecting && !raf) raf = requestAnimationFrame(tick); }).observe(root);
    } else if (motion && !reduceMotion) {
      // No pointer: still keep leader lines attached to the floating photos
      let raf = 0;
      const tick = () => { drawLinks(); raf = inView ? requestAnimationFrame(tick) : 0; };
      new IntersectionObserver(([e]) => { if (e.isIntersecting && !raf) raf = requestAnimationFrame(tick); }).observe(root);
    }
    narrow.addEventListener("change", () => started && reset());
    let lastW = 0;
    new ResizeObserver(() => {
      if (!started || narrow.matches || layer.clientWidth === lastW) return;
      lastW = layer.clientWidth;
      // Re-place open cards oldest first so the same overlap rule applies
      const keep = opened.slice();
      opened = [];
      keep.forEach(open);
    }).observe(layer);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && opened.length && root.contains(document.activeElement)) close(opened[opened.length - 1]);
    });
    if (reduceMotion) start();
    else pageVisible.then(() => onceInView([root], start, { threshold: 0.3 }));
  }

  /* ---------- Atlas (home) ----------
     India at night: every city where Naaris train is a light, labelled on the map.
     Clicking a city (or anything marked data-atlas-city="id") opens one popup anchored
     to it; only one is ever open. Hover only brightens. Esc, the close button or a
     click elsewhere closes it. */
  function initAtlas(root) {
    const geo = window.NIMAYA_INDIA;
    const places = window.NIMAYA_REACH;
    if (!geo || !places) return;
    const NS = "http://www.w3.org/2000/svg";
    const assets = root.dataset.assets || "assets/";
    const base = assets.replace(/assets\/$/, "");
    const box = root.querySelector(".atlas__box");

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "atlas__svg");
    svg.setAttribute("viewBox", `0 0 ${geo.width} ${geo.height}`);
    svg.setAttribute("aria-hidden", "true");
    const live = new Set(places.filter((p) => p.status !== "soon").map((p) => p.state));
    const statePath = {};
    Object.entries(geo.states).forEach(([name, d], i) => {
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("class", `atlas__state${live.has(name) ? " is-active" : ""}`);
      path.style.setProperty("--i", i);
      statePath[name] = path;
      svg.append(path);
    });
    // A faint route joining the cities, north to south and out east: one network
    const byId = Object.fromEntries(places.map((p) => [p.id, p]));
    const route = ["kashmir", "haryana", "jaipur", "ahmedabad", "mumbai", "nagpur", "lucknow", "varanasi", "guwahati"]
      .filter((id) => byId[id]).map((id) => geo.project(...byId[id].points[0]));
    route.slice(1).forEach(([x2, y2], k) => {
      const [x1, y1] = route[k];
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const len = Math.hypot(x2 - x1, y2 - y1);
      const bow = Math.min(60, len * 0.22);
      const arc = document.createElementNS(NS, "path");
      arc.setAttribute("d", `M${x1},${y1} Q${mx + ((y1 - y2) / len) * bow},${my + ((x2 - x1) / len) * bow} ${x2},${y2}`);
      arc.setAttribute("class", "atlas__route");
      arc.style.setProperty("--k", k);
      svg.append(arc);
    });
    const layer = document.createElement("div");
    layer.className = "atlas__pins";
    box.append(svg, layer);

    const pop = document.createElement("div");
    pop.className = "atlas__pop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-live", "polite");
    pop.hidden = true;
    root.append(pop);

    const pct = ([lon, lat]) => {
      const [x, y] = geo.project(lon, lat);
      return [(x / geo.width) * 100, (y / geo.height) * 100];
    };
    const triggers = (id) => document.querySelectorAll(`[data-atlas-city="${id}"]`);
    const items = places.map((place, i) => {
      place.points.slice(1).forEach((pt) => {
        const [x, y] = pct(pt);
        const dot = document.createElement("span");
        dot.className = "atlas__minor";
        dot.style.cssText = `left:${x}%;top:${y}%`;
        dot.dataset.place = place.id;
        layer.append(dot);
      });
      const [x, y] = pct(place.points[0]);
      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = `atlas__pin atlas__pin--${place.label || "right"}${place.status === "soon" ? " is-soon" : ""}`;
      pin.style.cssText = `left:${x}%;top:${y}%;--k:${i}`;
      pin.setAttribute("aria-label", `${place.name}, ${place.subtitle || place.state}${place.status === "soon" ? ", coming soon" : ""}`);
      pin.setAttribute("aria-expanded", "false");
      pin.innerHTML = `<span class="atlas__dot"></span><span class="atlas__label" aria-hidden="true">${place.name}</span>`;
      pin.addEventListener("click", () => (current === i ? close() : open(i)));
      layer.append(pin);
      if (place.photo) { const img = new Image(); img.src = assets + place.photo; }
      return { place, pin };
    });

    // Optional city index (a list of buttons) somewhere else on the page
    const index = root.dataset.index && document.querySelector(root.dataset.index);
    if (index) {
      index.innerHTML = places.map((p) => {
        const top = p.lines.find((l) => l.num && l.num !== "Soon");
        return `<li><button class="atlas-index__row${p.status === "soon" ? " is-soon" : ""}" type="button" data-atlas-city="${p.id}">
          <span class="atlas-index__name">${p.name}${p.state === p.name ? "" : `<small>${p.state}</small>`}</span>
          <span class="atlas-index__num">${p.status === "soon" ? "Soon" : top ? top.num : "New"}</span></button></li>`;
      }).join("");
    }

    // Anything else on the page can open a city: photos, index rows
    places.forEach((p, i) => triggers(p.id).forEach((el) => {
      el.addEventListener("click", () => open(i, el));
      el.addEventListener("pointerenter", () => items[i].pin.classList.add("is-hint"));
      el.addEventListener("pointerleave", () => items[i].pin.classList.remove("is-hint"));
    }));

    const html = (p) => p.status === "soon" ? `
      <button class="atlas__x" type="button" aria-label="Close"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
      <div class="atlas__pop-body">
        <span class="atlas__badge">Coming soon</span>
        <h3 class="atlas__place">${p.name}</h3>
        <p class="atlas__region">${p.state}</p>
        <p class="atlas__soon">GenAI Ready Naari opens here next.</p>
        <a class="atlas__soon-link" href="${base}contact-us/">Help us launch here <span aria-hidden="true">→</span></a>
      </div>` : `
      <button class="atlas__x" type="button" aria-label="Close"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
      ${p.photo ? `<figure class="atlas__photo"><img src="${assets}${p.photo}" alt="${p.photoAlt || ""}"></figure>` : ""}
      <div class="atlas__pop-body">
        <p class="atlas__region">${p.subtitle || p.state}</p>
        <h3 class="atlas__place">${p.name}</h3>
        <ul class="atlas__lines">${p.lines.map((l) => `<li>${l.num ? `<b>${l.num}</b>` : ""}<span>${l.text}</span></li>`).join("")}</ul>
        ${p.partners ? `<div class="atlas__logos"><span>With</span>${p.partners.map((src) => `<img src="${assets}img/${src}" alt="">`).join("")}</div>` : ""}
      </div>`;

    // Above the city when there is room, then below, then beside it; kept inside the panel
    function position() {
      root.classList.toggle("is-narrow", root.offsetWidth < 520);
      if (current < 0) return;
      const r = root.getBoundingClientRect();
      const p = items[current].pin.getBoundingClientRect();
      const px = p.left + p.width / 2 - r.left;
      const py = p.top + p.height / 2 - r.top;
      // It may bleed a little past the panel's top and bottom, never past its sides
      const w = pop.offsetWidth, h = pop.offsetHeight, gap = 16, edge = 10, bleed = 36;
      const room = { above: py - gap + bleed, below: r.height - py - gap + bleed, right: r.width - px - gap - edge, left: px - gap - edge };
      const fits = { above: room.above >= h, below: room.below >= h, right: room.right >= w, left: room.left >= w };
      const side = ["above", "below", "right", "left"].find((k) => fits[k]) || (room.above > room.below ? "above" : "below");
      let left, top;
      if (side === "above" || side === "below") {
        left = clamp(px - w / 2, edge, Math.max(edge, r.width - w - edge));
        top = side === "above" ? py - gap - h : py + gap;
        // Nothing fits cleanly (small screens): keep it inside the panel anyway
        if (!fits[side]) top = clamp(top, -bleed, Math.max(-bleed, r.height - h + bleed));
        pop.style.setProperty("--ax", `${clamp(px - left, 22, w - 22)}px`);
      } else {
        top = clamp(py - h / 2, -bleed, Math.max(-bleed, r.height - h + bleed));
        left = side === "right" ? px + gap : px - gap - w;
        pop.style.setProperty("--ay", `${clamp(py - top, 22, h - 22)}px`);
      }
      pop.style.left = `${left}px`;
      pop.style.top = `${top}px`;
      pop.dataset.side = side;
    }

    let current = -1;
    let swap = 0;
    let opener = null;
    function mark(i) {
      items.forEach((it, k) => {
        const on = k === i;
        it.pin.classList.toggle("is-current", on);
        it.pin.setAttribute("aria-expanded", String(on));
        triggers(it.place.id).forEach((el) => el.classList.toggle("is-current", on));
      });
      layer.querySelectorAll(".atlas__minor").forEach((d) => d.classList.toggle("is-current", i >= 0 && d.dataset.place === items[i].place.id));
      Object.values(statePath).forEach((s) => s.classList.remove("is-selected"));
      if (i >= 0) statePath[items[i].place.state]?.classList.add("is-selected");
    }
    function render(i) {
      const { place: p } = items[i];
      pop.innerHTML = html(p);
      pop.classList.toggle("is-soon", p.status === "soon");
      pop.setAttribute("aria-label", p.name);
      pop.hidden = false;
      position();
      requestAnimationFrame(() => pop.classList.add("is-open"));
    }
    function open(i, from) {
      opener = from || items[i].pin;
      // Opened from a photo or list further down the page: bring the map into view
      if (from) {
        const r = root.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight) root.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      }
      if (i === current) return;
      const was = current;
      current = i;
      mark(i);
      clearTimeout(swap);
      if (was < 0 || reduceMotion) return render(i);
      pop.classList.remove("is-open");
      swap = setTimeout(() => render(i), 160);
    }
    function close(restore) {
      if (current < 0) return;
      current = -1;
      mark(-1);
      clearTimeout(swap);
      pop.classList.remove("is-open");
      swap = setTimeout(() => { pop.hidden = true; }, reduceMotion ? 0 : 200);
      if (restore) opener?.focus();
    }
    pop.addEventListener("click", (e) => { if (e.target.closest(".atlas__x")) close(true); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && current >= 0) close(true); });
    document.addEventListener("pointerdown", (e) => {
      if (current < 0 || pop.contains(e.target) || e.target.closest(".atlas__pin, [data-atlas-city]")) return;
      close();
    });
    window.addEventListener("resize", position);
    // Photos and logos can land after the popup opens; follow its size as they do
    new ResizeObserver(() => position()).observe(pop);
    position();

    const show = () => {
      root.classList.add("is-in");
      const first = places.findIndex((p) => p.id === root.dataset.open);
      if (first >= 0) setTimeout(() => open(first), reduceMotion ? 0 : 1300);
    };
    if (reduceMotion) show();
    else pageVisible.then(() => onceInView([root], show, { threshold: 0.3 }));
  }

  /* ---------- How AI runs Nimaya ----------
     An AI core, four agents around it and a ring of Naaris outside. Signals travel
     Naari -> agent -> core and back; a feed under it types out what is happening.
     Animation pauses while off screen. */
  function initAiNet(root) {
    const NS = "http://www.w3.org/2000/svg";
    const C = 300;
    const rad = (deg) => (deg * Math.PI) / 180;
    const at = (r, deg) => [C + r * Math.cos(rad(deg)), C + r * Math.sin(rad(deg))];
    const f = (n) => n.toFixed(1);
    const icons = {
      phone: '<path d="M7 3h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A17 17 0 0 1 5 5a2 2 0 0 1 2-2z"/>',
      chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
      book: '<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/>',
      spark: '<path d="M12 3l2.2 5.6L20 9.3l-4.5 3.9 1.4 5.8L12 16l-4.9 3 1.4-5.8L4 9.3l5.8-.7z"/>',
    };
    const agents = [
      { name: "Outreach", icon: "phone", deg: -135 },
      { name: "Feedback", icon: "chat", deg: -45 },
      { name: "Curriculum", icon: "book", deg: 45 },
      { name: "Smart Didi", icon: "spark", deg: 135 },
    ].map((a) => ({ ...a, xy: at(150, a.deg) }));
    const faces = ["t-anjali", "t-chandani", "t-jyoti", "t-khushi", "t-mahak", "t-mahek", "story-amisha", "story-nayonica"];
    const naaris = faces.map((src, i) => {
      const deg = -112 + i * 45 + (i % 2 ? 8 : -8);
      // Each Naari talks to the agent closest to her
      const near = (a) => Math.cos(rad(a.deg - deg));
      const agent = agents.reduce((best, a) => (near(a) > near(best) ? a : best));
      return { src, xy: at(256, deg), agent };
    });

    const links = [];
    naaris.forEach((n) => {
      const [x1, y1] = n.xy;
      const [x2, y2] = n.agent.xy;
      // Bow the line slightly outward so it reads as a signal path
      const mx = (x1 + x2) / 2 + (y2 - y1) * 0.12;
      const my = (y1 + y2) / 2 - (x2 - x1) * 0.12;
      links.push({ d: `M${f(x1)} ${f(y1)} Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}`, kind: "naari" });
    });
    agents.forEach((a) => links.push({ d: `M${f(a.xy[0])} ${f(a.xy[1])} L${C} ${C}`, kind: "core" }));
    // Curriculum agent hands updates on to Smart Didi: the feedback loop
    links.push({ d: `M${f(agents[1].xy[0])} ${f(agents[1].xy[1])} A150 150 0 0 1 ${f(agents[2].xy[0])} ${f(agents[2].xy[1])}`, kind: "loop" });

    const crowd = [];
    for (let i = 0; i < 64; i++) {
      const [x, y] = at(i % 2 ? 288 : 270, i * (360 / 64) + 3);
      crowd.push(`<circle class="ai-net__crowd" cx="${f(x)}" cy="${f(y)}" r="${i % 3 ? 2.4 : 3.2}" style="--i:${i}"/>`);
    }
    const assets = root.dataset.assets || "assets/";
    const packets = links.map((l, i) => {
      const dur = (2.6 + (i % 5) * 0.45).toFixed(2);
      const begin = (-(i * 0.73) % 4).toFixed(2);
      const back = i % 2 ? ' keyPoints="1;0" keyTimes="0;1" calcMode="linear"' : "";
      return `<circle class="ai-net__packet ai-net__packet--${l.kind}" r="${l.kind === "core" ? 4.5 : 3.5}"><animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" path="${l.d}"${back}/></circle>`;
    });

    root.querySelector(".ai__net").innerHTML = `
      <svg class="ai-net" viewBox="0 0 600 600" role="img" aria-label="Diagram: Naaris connect to four AI agents (Outreach, Feedback, Curriculum and Smart Didi), which connect to Nimaya's AI core">
        <defs>
          <radialGradient id="ai-core-fill" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#6b3fd1"/><stop offset="1" stop-color="#2a1677"/></radialGradient>
          ${naaris.map((n, i) => `<clipPath id="ai-face-${i}"><circle cx="${f(n.xy[0])}" cy="${f(n.xy[1])}" r="24"/></clipPath>`).join("")}
        </defs>
        <circle class="ai-net__ring" cx="${C}" cy="${C}" r="150"/>
        <circle class="ai-net__ring ai-net__ring--outer" cx="${C}" cy="${C}" r="256"/>
        ${crowd.join("")}
        ${links.map((l) => `<path class="ai-net__link ai-net__link--${l.kind}" d="${l.d}"/>`).join("")}
        ${packets.join("")}
        <circle class="ai-net__halo" cx="${C}" cy="${C}" r="74"/>
        <circle class="ai-net__core" cx="${C}" cy="${C}" r="62"/>
        <text class="ai-net__core-name" x="${C}" y="${C + 2}" text-anchor="middle">Nimaya</text>
        <text class="ai-net__core-sub" x="${C}" y="${C + 22}" text-anchor="middle">AI core</text>
        ${agents.map((a) => `
          <g class="ai-net__agent" transform="translate(${f(a.xy[0])} ${f(a.xy[1])})">
            <circle r="32"/>
            <g class="ai-net__icon" transform="translate(-12 -12)">${icons[a.icon]}</g>
            <text y="${a.deg < 0 ? -44 : 54}" text-anchor="middle">${a.name}</text>
          </g>`).join("")}
        ${naaris.map((n, i) => `
          <circle class="ai-net__face-ring" cx="${f(n.xy[0])}" cy="${f(n.xy[1])}" r="27"/>
          <image href="${assets}img/people/${n.src}.webp" x="${f(n.xy[0] - 24)}" y="${f(n.xy[1] - 24)}" width="48" height="48" preserveAspectRatio="xMidYMin slice" clip-path="url(#ai-face-${i})"/>`).join("")}
      </svg>`;
    const svg = root.querySelector("svg");

    const lines = [
      "Outreach agent: checking in with Naaris in Guwahati",
      "Feedback agent: session feedback received from Lucknow",
      "Curriculum agent: module updated from Naari feedback",
      "Smart Didi: mock interview ready for a Naari in Mumbai",
    ];
    const text = root.querySelector(".ai__feed-text");
    if (!text) {
      if (reduceMotion) svg.pauseAnimations();
      else new IntersectionObserver(([e]) => { e.isIntersecting ? svg.unpauseAnimations() : svg.pauseAnimations(); }).observe(root);
      return;
    }
    if (reduceMotion) {
      svg.pauseAnimations();
      text.textContent = lines[0];
      return;
    }
    let line = 0, char = 0, timer = 0, running = false;
    const type = () => {
      const s = lines[line];
      char += 1;
      text.textContent = s.slice(0, char);
      if (char < s.length) timer = setTimeout(type, 28);
      else timer = setTimeout(() => { line = (line + 1) % lines.length; char = 0; type(); }, 2200);
    };
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) { running = true; svg.unpauseAnimations(); type(); }
      else if (!e.isIntersecting && running) { running = false; svg.pauseAnimations(); clearTimeout(timer); }
    }).observe(root);
  }

  /* ---------- Pointer polish (mouse / trackpad only) ---------- */
  function initCursor() {
    if (!finePointer) return;
    const targets = document.querySelectorAll("[data-youtube], [data-video]");
    const cursor = document.createElement("div");
    cursor.className = "cursor";
    cursor.setAttribute("aria-hidden", "true");
    cursor.innerHTML = 'Play <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor"><path d="M0 0l10 6-10 6z"/></svg>';
    document.body.append(cursor);
    document.documentElement.classList.add("has-cursor");

    let x = 0, y = 0, cx = 0, cy = 0, raf = 0;
    // `translate`, not `transform`: `scale` would otherwise shrink the offset and the cursor would grow in from the corner
    const place = () => { cursor.style.translate = `${cx.toFixed(1)}px ${cy.toFixed(1)}px`; };
    const loop = () => {
      cx += (x - cx) * 0.22;
      cy += (y - cy) * 0.22;
      place();
      raf = Math.abs(x - cx) + Math.abs(y - cy) > 0.2 ? requestAnimationFrame(loop) : 0;
    };
    window.addEventListener("pointermove", (e) => {
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    targets.forEach((t) => {
      t.addEventListener("pointerenter", (e) => {
        cx = x = e.clientX;
        cy = y = e.clientY;
        place();
        cursor.classList.add("is-on");
      });
      t.addEventListener("pointerleave", () => cursor.classList.remove("is-on"));
      t.addEventListener("click", () => cursor.classList.remove("is-on"));
    });
    /* Scrolling moves targets under a still pointer without firing pointerleave,
       so re-check what is under the last known pointer position on every scroll. */
    let inside = false;
    document.addEventListener("pointerover", () => { inside = true; }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => {
      inside = false;
      cursor.classList.remove("is-on");
    });
    onScroll(() => {
      if (!inside || document.documentElement.classList.contains("is-locked")) return;
      const el = document.elementFromPoint(x, y);
      const over = !!(el && el.closest("[data-youtube], [data-video]"));
      if (over && !cursor.classList.contains("is-on")) { cx = x; cy = y; place(); }
      cursor.classList.toggle("is-on", over);
    });
  }

  function initTilt() {
    if (!finePointer || reduceMotion) return;
    document.querySelectorAll("[data-tilt]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--ry", `${(px * 7).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${(-py * 7).toFixed(2)}deg`);
      });
      el.addEventListener("pointerleave", () => {
        el.style.removeProperty("--rx");
        el.style.removeProperty("--ry");
      });
    });
  }

  function initMagnet() {
    if (!finePointer || reduceMotion) return;
    document.querySelectorAll(".btn").forEach((btn) => {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        btn.style.setProperty("--mx", `${((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1)}px`);
        btn.style.setProperty("--my", `${((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1)}px`);
      });
      btn.addEventListener("pointerleave", () => {
        btn.style.removeProperty("--mx");
        btn.style.removeProperty("--my");
      });
    });
  }

  // Testimonial cards play a muted preview of their story on hover.
  function initPreviews() {
    if (!finePointer || reduceMotion) return;
    document.querySelectorAll(".voices__thumb[data-video]").forEach((btn) => {
      let video = null;
      btn.addEventListener("pointerenter", () => {
        if (!video) {
          video = document.createElement("video");
          video.className = "voices__preview";
          video.src = btn.dataset.video;
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.setAttribute("aria-hidden", "true");
          btn.querySelector("img").after(video);
        }
        video.play().then(() => btn.classList.add("is-previewing")).catch(() => {});
      });
      btn.addEventListener("pointerleave", () => {
        btn.classList.remove("is-previewing");
        if (video) video.pause();
      });
    });
  }

  /* ---------- Script draw-in ----------
     Ms Madi words are written in (CSS transitions on .is-drawn) the first time
     they are mostly on screen. The parent is observed because the hidden word's
     own clip-path would keep its intersection ratio near zero. */
  function initDraw() {
    const words = [...document.querySelectorAll(".script, .voices__name")];
    if (reduceMotion) {
      words.forEach((w) => w.classList.add("is-drawn"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.__drawWord.classList.add("is-drawn");
        io.unobserve(entry.target);
      }
    }, { threshold: 0.6 });
    words.forEach((w) => {
      w.parentElement.__drawWord = w;
      io.observe(w.parentElement);
    });
  }

  /* ---------- Motifs ----------
     data-twinkle / data-float get staggered timings, data-draw paths are drawn
     the first time their container scrolls in, data-parallax="N" drifts up to N px. */
  function initMotifs() {
    document.querySelectorAll("[data-twinkle]").forEach((el) => {
      el.style.setProperty("--dur", `${(2.4 + Math.random() * 2.4).toFixed(2)}s`);
      el.style.setProperty("--delay", `${(-Math.random() * 4).toFixed(2)}s`);
    });
    document.querySelectorAll("[data-float]").forEach((el, i) => {
      el.style.setProperty("--dur", `${4 + (i % 3)}s`);
      el.style.setProperty("--delay", `${(-i * 1.3).toFixed(1)}s`);
    });

    const paths = [...document.querySelectorAll("[data-draw]")];
    if (reduceMotion) {
      paths.forEach((p) => p.classList.add("is-drawn"));
      return;
    }
    // Observe the container: a fully clipped path never reports as intersecting
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.__drawPaths.forEach((p) => p.classList.add("is-drawn"));
        io.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -20% 0px" });
    paths.forEach((p) => {
      const box = p.parentElement;
      (box.__drawPaths ||= []).push(p);
      io.observe(box);
    });

    const drifting = [...document.querySelectorAll("[data-parallax]")];
    const boost = 2.2; // scales every data-parallax distance
    onScroll(() => {
      const vh = window.innerHeight;
      for (const el of drifting) {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) continue;
        const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2)));
        el.style.setProperty("--py", `${(-p * Number(el.dataset.parallax) * boost).toFixed(1)}px`);
      }
    });
  }

  /* ---------- Media overlays (YouTube + uploaded video) ---------- */
  function openOverlay(frame) {
    const backdrop = document.createElement("div");
    backdrop.className = "overlay";
    document.body.append(backdrop, frame);
    document.documentElement.classList.add("is-locked");
    // Next frame, so the closed state paints first and the open state transitions in
    requestAnimationFrame(() => requestAnimationFrame(() => {
      backdrop.classList.add("is-open");
      frame.classList.add("is-open");
    }));

    let closing = false;
    function close() {
      if (closing) return;
      closing = true;
      document.removeEventListener("keydown", onKey);
      const media = frame.querySelector("video");
      if (media) media.pause();
      backdrop.classList.remove("is-open");
      frame.classList.remove("is-open");
      setTimeout(() => {
        backdrop.remove();
        frame.remove();
        document.documentElement.classList.remove("is-locked");
      }, reduceMotion ? 0 : 450);
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    backdrop.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
  }

  function initOverlays() {
    document.querySelectorAll("[data-youtube]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const frame = document.createElement("div");
        frame.className = "overlay__frame overlay__frame--youtube";
        const iframe = document.createElement("iframe");
        iframe.src = `https://www.youtube.com/embed/${btn.dataset.youtube}?autoplay=1&rel=0`;
        iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
        iframe.allowFullscreen = true;
        iframe.title = btn.getAttribute("aria-label") || "Video";
        frame.append(iframe);
        openOverlay(frame);
      });
    });

    document.querySelectorAll("[data-video]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const frame = document.createElement("div");
        frame.className = "overlay__frame overlay__frame--video";
        const video = document.createElement("video");
        video.src = btn.dataset.video;
        video.controls = true;
        video.loop = true;
        video.playsInline = true;
        video.volume = 0.4;
        frame.append(video);
        openOverlay(frame);
        video.play().catch(() => {});
      });
    });
  }

  // In-page links glide to their section instead of jumping
  function initAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - (document.querySelector(".nav")?.offsetHeight || 0);
        window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
      });
    });
  }

  /* ---------- Boot ---------- */
  function boot() {
    initOverlays();
    initPins();
    // A pinned milestone row is driven by scroll; the auto slideshow is the fallback
    document.querySelectorAll("[data-slider]").forEach((el) => {
      if (!el.closest(".is-pinned")) initSlider(el);
    });
    initLottie(); // after the slider clones its cards, so clones get their own animation
    document.querySelectorAll("[data-rotator]").forEach(initRotator);
    document.querySelectorAll("[data-ticker]").forEach(initTicker);
    initRise(); // before initDraw: script words move into the rise wrappers
    initDraw();
    initMotifs();
    initReveal();
    initUnmask();
    initHero();
    initCounters();
    initNav();
    initMenu();
    initDropdown();
    document.querySelectorAll("[data-tabs]").forEach(initTabs);
    document.querySelectorAll("[data-bars]").forEach(initBars);
    document.querySelectorAll("[data-reach-map]").forEach(initReachMap);
    document.querySelectorAll("[data-ai-net]").forEach(initAiNet);
    document.querySelectorAll("[data-atlas]").forEach(initAtlas);
    initSmoothScroll();
    initCursor();
    initTilt();
    initMagnet();
    initPreviews();
    initAnchors();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
