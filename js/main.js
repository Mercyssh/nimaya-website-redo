(() => {
  const { bind } = window.Motion;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Transitions exactly as configured on the Framer site.
  const spring = (delay = 0) => ({ type: "spring", bounce: 0.2, duration: 0.4, delay });
  const tween = (delay = 0) => ({ type: "tween", ease: [0.44, 0, 0.56, 1], duration: 0.2, delay });

  // data-reveal presets -> Framer "enter" (hidden) state.
  const ENTER = {
    fade: { opacity: 0, x: 0, y: 0 },
    left: { opacity: 0, x: -150, y: 0 },
    right: { opacity: 0, x: 150, y: 0 },
    up: { opacity: 0, x: 0, y: 150 },
  };
  const SHOWN = { opacity: 1, x: 0, y: 0 };

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

  /* ---------- Page-load appear (hero) ---------- */
  function initAppear() {
    document.querySelectorAll("[data-appear]").forEach((el) => {
      const m = bind(el, { opacity: 0.001, x: el.dataset.from === "right" ? 150 : -150 });
      m.animate(SHOWN, spring(Number(el.dataset.delay) || 0));
    });
  }

  /* ---------- Scroll appear ----------
     Port of Framer's in-view rule: observe the (transformed) element with 100
     thresholds; it is "in view" when visibleHeight / min(height, viewport) >= threshold. */
  function initReveal() {
    const thresholds = Array.from({ length: 100 }, (_, i) => i / 100);
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target;
        const s = el.__reveal;
        const box = entry.boundingClientRect;
        const ratio = box.height === 0 ? 0 : entry.intersectionRect.height / Math.min(box.height, window.innerHeight);
        const visible = box.height === 0 ? entry.isIntersecting : entry.isIntersecting && ratio >= s.threshold;

        if (visible && !s.inView) {
          if (s.once && s.done) continue;
          s.done = true;
          s.inView = true;
          el.__motion.set(s.enter);
          el.__motion.animate(SHOWN, s.transition);
          if (s.once) io.unobserve(el);
        } else if (!visible && s.inView) {
          s.inView = false;
          if (!s.once) el.__motion.animate(s.exit, spring(0));
        }
      }
    }, { threshold: thresholds });

    document.querySelectorAll("[data-reveal]").forEach((el) => {
      const type = el.dataset.reveal;
      const delay = Number(el.dataset.delay) || 0;
      const enter = ENTER[type] || ENTER.fade;
      el.__reveal = {
        enter,
        exit: { opacity: 0, x: 0, y: 0 },
        transition: el.hasAttribute("data-tween") ? tween(delay) : spring(delay),
        threshold: el.dataset.threshold !== undefined ? Number(el.dataset.threshold) : 0.5,
        once: !el.hasAttribute("data-repeat"),
        inView: false,
        done: false,
      };
      bind(el, enter);
      io.observe(el);
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
    document.querySelectorAll("[data-slider]").forEach(initSlider);
    initLottie(); // after the slider clones its cards, so clones get their own animation
    document.querySelectorAll("[data-rotator]").forEach(initRotator);
    document.querySelectorAll("[data-ticker]").forEach(initTicker);
    if (reduceMotion) return;
    initAppear();
    initReveal();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
