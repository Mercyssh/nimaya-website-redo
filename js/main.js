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
    const els = [...document.querySelectorAll("[data-reveal]")];
    els.forEach((el) => {
      const d = Number(el.dataset.delay) || 0;
      if (d) el.style.setProperty("--d", `${d}s`);
    });
    if (reduceMotion) return els.forEach((el) => el.classList.add("is-in"));
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
    const go = () => {
      hero.classList.add("is-in");
      hero.querySelector(".hero__title").classList.add("is-risen");
      hero.querySelectorAll("[data-unmask]").forEach((el) => el.classList.add("is-in"));
    };
    if (reduceMotion) return go();
    document.fonts.ready.then(() => setTimeout(go, 60));
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
      let dist = 0, half = 1, arc = 0, centers = [];
      ms.classList.add("is-pinned");
      const measure = () => {
        track.style.transform = "";
        dist = Math.max(0, track.scrollWidth - viewport.clientWidth + parseFloat(getComputedStyle(track).paddingLeft));
        ms.style.height = `${window.innerHeight + dist * 1.3}px`;
        // Cards ride a parabola: highest at the centre, dipping `arc` px at the viewport edges
        half = viewport.clientWidth / 2;
        arc = Math.min(90, half * 0.16);
        centers = cards.map((c) => c.offsetLeft + c.offsetWidth / 2);
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
        const x = -p * dist;
        track.style.transform = `translateX(${x.toFixed(1)}px)`;
        cards.forEach((card, i) => {
          const d = (centers[i] + x - half) / half; // -1 at the left edge, 1 at the right
          card.style.translate = `0 ${(arc * d * d).toFixed(1)}px`;
          card.style.rotate = `${(Math.atan((2 * arc * d) / half) * 180 / Math.PI).toFixed(2)}deg`;
        });
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
      nav.classList.toggle("is-scrolled", window.scrollY > hero.offsetHeight - 160);
    });
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

    function close() {
      backdrop.remove();
      frame.remove();
      document.documentElement.classList.remove("is-locked");
      document.removeEventListener("keydown", onKey);
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
    initSmoothScroll();
    initCursor();
    initTilt();
    initMagnet();
    initPreviews();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
