/*
 * Minimal animation engine ported from the Framer Motion runtime that the
 * original Framer site ships (spring solver, spring generator, cubic-bezier
 * and default transitions), so every curve matches the live site exactly.
 */
(function (global) {
  const clamp = (min, max, v) => Math.min(Math.max(v, min), max);
  const secToMs = (s) => s * 1000;
  const msToSec = (ms) => ms / 1000;

  const SPRING_DEFAULTS = {
    stiffness: 100,
    damping: 10,
    mass: 1,
    velocity: 0,
    duration: 800,
    bounce: 0.3,
    restSpeed: { granular: 0.01, default: 2 },
    restDelta: { granular: 0.005, default: 0.5 },
    minDuration: 0.01,
    maxDuration: 10,
    minDamping: 0.05,
    maxDamping: 1,
  };
  const SAFE_MIN = 0.001;
  const ROOT_ITERATIONS = 12;

  const calcAngularFreq = (undampedFreq, dampingRatio) => undampedFreq * Math.sqrt(1 - dampingRatio * dampingRatio);

  // Framer Motion's findSpring(): converts { duration, bounce } into stiffness/damping.
  function findSpring({ duration = SPRING_DEFAULTS.duration, bounce = SPRING_DEFAULTS.bounce, velocity = 0, mass = 1 }) {
    let envelope, derivative;
    let dampingRatio = clamp(SPRING_DEFAULTS.minDamping, SPRING_DEFAULTS.maxDamping, 1 - bounce);
    duration = clamp(SPRING_DEFAULTS.minDuration, SPRING_DEFAULTS.maxDuration, msToSec(duration));

    if (dampingRatio < 1) {
      envelope = (w) => {
        const a = w * dampingRatio;
        const delta = a * duration;
        const b = a - velocity;
        const c = calcAngularFreq(w, dampingRatio);
        return SAFE_MIN - (b / c) * Math.exp(-delta);
      };
      derivative = (w) => {
        const delta = w * dampingRatio * duration;
        const d = delta * velocity + velocity;
        const e = dampingRatio ** 2 * w ** 2 * duration;
        const f = Math.exp(-delta);
        const g = calcAngularFreq(w ** 2, dampingRatio);
        const factor = -envelope(w) + SAFE_MIN > 0 ? -1 : 1;
        return (factor * ((d - e) * f)) / g;
      };
    } else {
      envelope = (w) => -SAFE_MIN + Math.exp(-w * duration) * ((w - velocity) * duration + 1);
      derivative = (w) => Math.exp(-w * duration) * ((velocity - w) * (duration * duration));
    }

    let w = 5 / duration;
    for (let i = 1; i < ROOT_ITERATIONS; i++) w -= envelope(w) / derivative(w);
    duration = secToMs(duration);
    if (isNaN(w)) return { stiffness: SPRING_DEFAULTS.stiffness, damping: SPRING_DEFAULTS.damping, duration };
    const stiffness = w ** 2 * mass;
    return { stiffness, damping: dampingRatio * 2 * Math.sqrt(mass * stiffness), duration };
  }

  // Framer Motion's spring() generator. Time is in ms; options.velocity in units/second.
  function spring(options) {
    const from = options.from;
    const to = options.to;
    let { stiffness, damping, mass = 1 } = options;
    let initialVelocity = -msToSec(options.velocity || 0);
    let duration = null;
    let resolvedFromDuration = false;

    if (stiffness === undefined && damping === undefined && (options.duration !== undefined || options.bounce !== undefined)) {
      const resolved = findSpring({ duration: secToMs(options.duration ?? 0.8), bounce: options.bounce ?? SPRING_DEFAULTS.bounce, velocity: 0 });
      stiffness = resolved.stiffness;
      damping = resolved.damping;
      duration = resolved.duration;
      mass = 1;
      initialVelocity = 0;
      resolvedFromDuration = true;
    }
    stiffness = stiffness ?? SPRING_DEFAULTS.stiffness;
    damping = damping ?? SPRING_DEFAULTS.damping;

    const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));
    const delta = to - from;
    const undampedFreq = msToSec(Math.sqrt(stiffness / mass));
    const granular = Math.abs(delta) < 5;
    const restSpeed = options.restSpeed || (granular ? SPRING_DEFAULTS.restSpeed.granular : SPRING_DEFAULTS.restSpeed.default);
    const restDelta = options.restDelta || (granular ? SPRING_DEFAULTS.restDelta.granular : SPRING_DEFAULTS.restDelta.default);
    const m = initialVelocity;

    let position, velocityAt;
    if (dampingRatio < 1) {
      const angularFreq = calcAngularFreq(undampedFreq, dampingRatio);
      const A = (m + dampingRatio * undampedFreq * delta) / angularFreq;
      const C = dampingRatio * undampedFreq * A + delta * angularFreq;
      const D = dampingRatio * undampedFreq * delta - A * angularFreq;
      position = (t) => {
        const env = Math.exp(-dampingRatio * undampedFreq * t);
        return to - env * (A * Math.sin(angularFreq * t) + delta * Math.cos(angularFreq * t));
      };
      velocityAt = (t) => Math.exp(-dampingRatio * undampedFreq * t) * (C * Math.sin(angularFreq * t) + D * Math.cos(angularFreq * t));
    } else if (dampingRatio === 1) {
      position = (t) => to - Math.exp(-undampedFreq * t) * (delta + (m + undampedFreq * delta) * t);
      const k = m + undampedFreq * delta;
      velocityAt = (t) => Math.exp(-undampedFreq * t) * (undampedFreq * k * t - m);
    } else {
      const dampedFreq = undampedFreq * Math.sqrt(dampingRatio * dampingRatio - 1);
      position = (t) => {
        const env = Math.exp(-dampingRatio * undampedFreq * t);
        const freqForT = Math.min(dampedFreq * t, 300);
        return to - (env * ((m + dampingRatio * undampedFreq * delta) * Math.sinh(freqForT) + dampedFreq * delta * Math.cosh(freqForT))) / dampedFreq;
      };
      const P = (m + dampingRatio * undampedFreq * delta) / dampedFreq;
      const Q = dampingRatio * undampedFreq * P - delta * dampedFreq;
      const R = dampingRatio * undampedFreq * delta - P * dampedFreq;
      velocityAt = (t) => {
        const env = Math.exp(-dampingRatio * undampedFreq * t);
        const freqForT = Math.min(dampedFreq * t, 300);
        return env * (Q * Math.sinh(freqForT) + R * Math.cosh(freqForT));
      };
    }

    return {
      velocity: (t) => secToMs(velocityAt(t)),
      next(t) {
        const value = position(t);
        let done;
        if (resolvedFromDuration) done = t >= duration;
        else done = Math.abs(secToMs(velocityAt(t))) <= restSpeed && Math.abs(to - value) <= restDelta;
        return { done, value: done ? to : value };
      },
    };
  }

  // Framer Motion's cubicBezier() (binary subdivision).
  function cubicBezier(x1, y1, x2, y2) {
    if (x1 === y1 && x2 === y2) return (t) => t;
    const calc = (t, a1, a2) => (((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t + 3 * a1) * t;
    const getT = (x) => {
      let lower = 0, upper = 1, current, currentX, i = 0;
      do {
        current = lower + (upper - lower) / 2;
        currentX = calc(current, x1, x2) - x;
        if (currentX > 0) upper = current;
        else lower = current;
      } while (Math.abs(currentX) > 1e-7 && ++i < 12);
      return current;
    };
    return (t) => (t === 0 || t === 1 ? t : calc(getT(t), y1, y2));
  }

  function tween({ from, to, duration = 0.3, ease = [0.25, 0.1, 0.35, 1] }) {
    const easing = Array.isArray(ease) ? cubicBezier(...ease) : (t) => t;
    const ms = secToMs(duration);
    return {
      velocity: () => 0,
      next(t) {
        if (t >= ms) return { done: true, value: to };
        return { done: false, value: from + (to - from) * easing(t / ms) };
      },
    };
  }

  // Framer Motion's default transitions when none is given.
  const DEFAULT_TRANSFORM = { type: "spring", stiffness: 500, damping: 25, restSpeed: 10 };
  const DEFAULT_OTHER = { type: "tween", ease: [0.25, 0.1, 0.35, 1], duration: 0.3 };
  const TRANSFORM_KEYS = new Set(["x", "y", "scale", "rotate"]);
  const defaultTransition = (key) => (TRANSFORM_KEYS.has(key) ? DEFAULT_TRANSFORM : DEFAULT_OTHER);

  /* A value that renders through onChange and can be animated/interrupted with velocity carry-over. */
  class MotionValue {
    constructor(value, onChange) {
      this.value = value;
      this.onChange = onChange;
      this.anim = null;
    }
    set(v) {
      this.stop();
      this.value = v;
      this.onChange(v);
    }
    stop() {
      if (this.anim) cancelAnimationFrame(this.anim.raf);
      if (this.anim && this.anim.timeout) clearTimeout(this.anim.timeout);
      this.anim = null;
    }
    getVelocity() {
      if (!this.anim || !this.anim.gen || this.anim.start == null) return 0;
      return this.anim.gen.velocity(performance.now() - this.anim.start);
    }
    animateTo(to, transition = {}) {
      return new Promise((resolve) => {
        const velocity = this.getVelocity();
        this.stop();
        const t = transition;
        const from = this.value;
        const anim = { gen: null, start: null, raf: 0, timeout: 0 };
        this.anim = anim;
        const begin = () => {
          anim.gen = t.type === "tween"
            ? tween({ from, to, duration: t.duration, ease: t.ease })
            : spring({ from, to, velocity, stiffness: t.stiffness, damping: t.damping, mass: t.mass, duration: t.duration, bounce: t.bounce, restSpeed: t.restSpeed, restDelta: t.restDelta });
          const step = (now) => {
            if (this.anim !== anim) return;
            if (anim.start == null) anim.start = now;
            const { done, value } = anim.gen.next(now - anim.start);
            this.value = value;
            this.onChange(value);
            if (done) {
              this.anim = null;
              resolve();
            } else anim.raf = requestAnimationFrame(step);
          };
          anim.raf = requestAnimationFrame(step);
        };
        if (t.delay) anim.timeout = setTimeout(begin, secToMs(t.delay));
        else begin();
      });
    }
  }

  /* Per-element transform/opacity state, rendered the way Framer renders it. */
  function bind(el, initial = {}) {
    if (el.__motion) return el.__motion;
    const state = { x: 0, y: 0, opacity: null, ...initial };
    const render = () => {
      el.style.transform = state.x || state.y ? `translateX(${state.x}px) translateY(${state.y}px)` : "none";
      if (state.opacity !== null) el.style.opacity = state.opacity;
    };
    const values = {};
    for (const key of ["x", "y", "opacity"]) {
      values[key] = new MotionValue(state[key] ?? 1, (v) => { state[key] = v; render(); });
    }
    render();
    const api = {
      values,
      set(props) { for (const k in props) values[k].set(props[k]); },
      animate(props, transition) {
        return Promise.all(Object.keys(props).map((k) => values[k].animateTo(props[k], transition || defaultTransition(k))));
      },
    };
    el.__motion = api;
    return api;
  }

  global.Motion = { findSpring, spring, cubicBezier, tween, MotionValue, bind, defaultTransition };
})(window);
