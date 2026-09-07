// RESET's living dock backdrop — Canvas 2D, zero dependencies.
//
// The renderer is intentionally driven by the same continuous scene-time
// signals for fish, reflections, lamps, stars and light. It remains a backdrop:
// text/UI stay normal DOM, accessible, crisp, and cheap to update.

import {
  dockDrivers,
  easeInOutCubic,
  lerpMinutes,
  wrapMinutes,
  clamp01
} from './dockDrivers.js';

const HORIZON = 0.60;
const EASE_MS = 1800;

const PIER = {
  nearTop: 0.700,
  nearBottom: 0.790,
  nearX: -0.02,
  farTop: 0.606,
  farBottom: 0.628,
  farX: 0.74
};

const PILINGS = [0.02, 0.15, 0.30, 0.46, 0.62];
const LAMPS = [
  { t: 0.09, height: 0.150 },
  { t: 0.44, height: 0.105 },
  { t: 0.68, height: 0.075 }
];
const BOLLARDS = [0.23, 0.55, 0.68];

function toRgb(hex) {
  const value = String(hex || '#000000').trim().replace('#', '');
  const safe = /^[0-9a-f]{6}$/i.test(value) ? value : '000000';
  return {
    r: parseInt(safe.slice(0, 2), 16),
    g: parseInt(safe.slice(2, 4), 16),
    b: parseInt(safe.slice(4, 6), 16)
  };
}

function mix(a, b, t) {
  const from = typeof a === 'string' ? toRgb(a) : a;
  const to = typeof b === 'string' ? toRgb(b) : b;
  const k = clamp01(t);
  return {
    r: from.r + (to.r - from.r) * k,
    g: from.g + (to.g - from.g) * k,
    b: from.b + (to.b - from.b) * k
  };
}

function rgba(color, alpha) {
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${clamp01(alpha)})`;
}

function interpolatePalette(from, to, t) {
  const result = {};
  for (const key of Object.keys(to)) result[key] = mix(from[key], to[key], t);
  return result;
}

function hash(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}

export class DockBackdrop {
  constructor(canvas, {
    initialMinutes = 780,
    initialTheme,
    fishCount,
    starCount
  } = {}) {
    const ctx = canvas?.getContext?.('2d', { alpha: true, desynchronized: true });
    if (!ctx) throw new Error('Canvas 2D is unavailable');

    this.canvas = canvas;
    this.ctx = ctx;
    this.minutes = wrapMinutes(initialMinutes);
    this.easeFrom = this.minutes;
    this.easeTo = this.minutes;
    this.easeStart = 0;
    this.easing = false;

    const defaultTheme = initialTheme || {
      bg1: '#11152b',
      bg2: '#282746',
      bg3: '#4d3751',
      glow: '#71628f',
      ink: '#f6f1fb'
    };
    this.palette = this.derivePalette(defaultTheme);
    this.paletteFrom = this.palette;
    this.paletteTo = this.palette;
    this.drivers = dockDrivers(this.minutes);

    const compact = window.matchMedia?.('(max-width: 620px)')?.matches ?? false;
    const resolvedFishCount = fishCount ?? (compact ? 7 : 9);
    const resolvedStarCount = starCount ?? (compact ? 62 : 88);

    this.fish = Array.from({ length: resolvedFishCount }, (_, i) => ({
      lane: 0.14 + hash(i * 7 + 1) * 0.80,
      x: hash(i * 13 + 3),
      speed: (0.010 + hash(i * 19 + 5) * 0.022) * (hash(i * 23 + 7) > 0.5 ? 1 : -1),
      size: 0.42 + hash(i * 29 + 11) * 0.72,
      phase: hash(i * 31 + 13) * Math.PI * 2,
      wobble: 0.4 + hash(i * 37 + 17) * 0.9
    }));

    this.stars = Array.from({ length: resolvedStarCount }, (_, i) => ({
      x: hash(i * 3 + 101),
      y: hash(i * 5 + 211) * HORIZON * 0.92,
      mag: 0.25 + hash(i * 11 + 307) * 0.75,
      twinkle: hash(i * 17 + 401) * Math.PI * 2
    }));

    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reduceMotion = this.motionQuery.matches;
    this.running = false;
    this.frame = 0;
    this.lastDrawAt = 0;
    this.resizeTimer = null;

    this.onResize = this.onResize.bind(this);
    this.onVisibility = this.onVisibility.bind(this);
    this.onMotionChange = this.onMotionChange.bind(this);
    this.tick = this.tick.bind(this);
  }

  mount() {
    this.resize();
    window.addEventListener('resize', this.onResize, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);
    this.motionQuery.addEventListener?.('change', this.onMotionChange);
    this.start();
    return this;
  }

  destroy() {
    this.stop();
    if (this.resizeTimer) window.clearTimeout(this.resizeTimer);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.motionQuery.removeEventListener?.('change', this.onMotionChange);
  }

  start() {
    if (this.running || document.hidden) return;
    if (this.reduceMotion) {
      this.draw(performance.now());
      return;
    }
    this.running = true;
    this.lastDrawAt = 0;
    this.frame = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  onVisibility() {
    if (document.hidden) this.stop();
    else this.start();
  }

  onMotionChange(event) {
    this.reduceMotion = event.matches;
    this.stop();
    this.start();
  }

  onResize() {
    if (this.resizeTimer) window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      this.resize();
      if (this.reduceMotion) this.draw(performance.now());
    }, 120);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, width < 520 ? 1.65 : 2);

    this.w = width;
    this.h = height;
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 30fps is visually fluid for water/fish on phones; 45fps keeps desktop
    // motion silky without spending a permanent 60fps budget on a backdrop.
    this.frameInterval = 1000 / (width < 700 ? 30 : 45);
    this.reflectionSteps = width < 700 ? 24 : 30;
    this.chopCount = width < 700 ? 30 : 42;
    this.causticBands = width < 700 ? 11 : 15;
  }

  derivePalette(theme) {
    return {
      deep: mix(theme.bg1, '#02060e', 0.62),
      shallow: mix(theme.bg2, theme.glow, 0.24),
      surface: toRgb(theme.glow),
      pier: mix(theme.bg1, '#01030a', 0.78),
      rim: mix(theme.glow, theme.ink, 0.34),
      fish: mix(theme.ink, theme.bg3, 0.48),
      lamp: toRgb('#ffc36f'),
      moon: mix(theme.ink, '#c9d9ff', 0.32)
    };
  }

  /**
   * Atomically move the dock to a new scene. Time and palette use the same
   * easing clock so the CSS theme and canvas never visibly disagree.
   */
  setScene({ minutes = this.minutes, theme, animate = true } = {}) {
    const targetMinutes = wrapMinutes(minutes);
    const targetPalette = theme ? this.derivePalette(theme) : this.palette;

    if (!animate || this.reduceMotion) {
      this.minutes = targetMinutes;
      this.easeFrom = targetMinutes;
      this.easeTo = targetMinutes;
      this.palette = targetPalette;
      this.paletteFrom = targetPalette;
      this.paletteTo = targetPalette;
      this.drivers = dockDrivers(targetMinutes);
      this.easing = false;
      this.draw(performance.now());
      return this;
    }

    this.easeFrom = this.minutes;
    this.easeTo = targetMinutes;
    this.paletteFrom = this.palette;
    this.paletteTo = targetPalette;
    this.easeStart = performance.now();
    this.easing = true;
    this.start();
    return this;
  }

  setPalette(theme, options = {}) {
    return this.setScene({ minutes: this.minutes, theme, ...options });
  }

  setTime(minutes, options = {}) {
    return this.setScene({ minutes, theme: null, ...options });
  }

  tick(now) {
    if (!this.running) return;

    if (this.easing) {
      const raw = clamp01((now - this.easeStart) / EASE_MS);
      const eased = easeInOutCubic(raw);
      this.minutes = lerpMinutes(this.easeFrom, this.easeTo, eased);
      this.palette = interpolatePalette(this.paletteFrom, this.paletteTo, eased);
      this.drivers = dockDrivers(this.minutes);
      if (raw >= 1) {
        this.minutes = this.easeTo;
        this.palette = this.paletteTo;
        this.drivers = dockDrivers(this.easeTo);
        this.easing = false;
      }
    }

    if (!this.lastDrawAt || now - this.lastDrawAt >= this.frameInterval || this.easing === false && now - this.lastDrawAt > 80) {
      this.draw(now);
      this.lastDrawAt = now;
    }

    this.frame = requestAnimationFrame(this.tick);
  }

  draw(now) {
    const { ctx, w, h } = this;
    if (!w || !h) return;

    const t = now / 1000;
    const d = this.drivers;
    const p = this.palette;
    const horizon = h * HORIZON;

    ctx.clearRect(0, 0, w, h);
    this.drawStars(d, t);
    this.drawCelestialBodies(d, p, horizon);
    this.drawHaze(d, p, horizon);
    this.drawWater(d, p, horizon);
    this.drawFish(d, p, horizon, t);
    this.drawCaustics(d, p, horizon, t);
    this.drawReflections(d, p, horizon, t);
    this.drawChop(d, p, horizon, t);
    this.drawPier(d, p);
    this.drawLampBloom(d, p, t);
    this.drawScrim(d, horizon);
  }

  drawStars(d, t) {
    if (d.stars < 0.015) return;
    const { ctx, w, h } = this;
    ctx.save();
    ctx.fillStyle = '#eef3ff';
    for (const star of this.stars) {
      const flicker = this.reduceMotion ? 1 : 0.76 + Math.sin(star.twinkle + t * (0.9 + star.mag * 0.7)) * 0.24;
      ctx.globalAlpha = d.stars * star.mag * flicker * 0.82;
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * h, star.mag * 1.08, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawCelestialBodies(d, p, horizon) {
    this.drawCelestialBody({
      x: d.sunX,
      y: d.sunY,
      visibility: d.sunVisibility,
      radius: 20,
      colour: mix('#fff4cf', '#ff8c46', d.goldenHour),
      bloomScale: 11,
      horizon
    });

    this.drawCelestialBody({
      x: d.moonX,
      y: d.moonY,
      visibility: d.moonVisibility,
      radius: 12,
      colour: p.moon,
      bloomScale: 7,
      horizon
    });
  }

  drawCelestialBody({ x, y, visibility, radius, colour, bloomScale, horizon }) {
    if (visibility < 0.015) return;
    const { ctx, w } = this;
    const px = x * w;
    const py = y * horizon;

    ctx.save();
    const bloom = ctx.createRadialGradient(px, py, 0, px, py, radius * bloomScale);
    bloom.addColorStop(0, rgba(colour, 0.48 * visibility));
    bloom.addColorStop(0.35, rgba(colour, 0.13 * visibility));
    bloom.addColorStop(1, rgba(colour, 0));
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, w, horizon + 8);

    ctx.globalAlpha = 0.92 * visibility;
    ctx.fillStyle = rgba(colour, 0.98);
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawHaze(d, p, horizon) {
    const { ctx, w, h } = this;
    const grad = ctx.createLinearGradient(0, horizon - h * 0.22, 0, horizon);
    grad.addColorStop(0, rgba(p.surface, 0));
    grad.addColorStop(1, rgba(p.surface, d.haze * 0.52));
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizon - h * 0.22, w, h * 0.22);
  }

  drawWater(d, p, horizon) {
    const { ctx, w, h } = this;
    const grad = ctx.createLinearGradient(0, horizon, 0, h);
    grad.addColorStop(0, rgba(mix(p.shallow, p.surface, d.daylight * 0.22), 0.96));
    grad.addColorStop(0.42, rgba(p.shallow, 0.93));
    grad.addColorStop(1, rgba(p.deep, 0.99));
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizon, w, h - horizon);

    ctx.fillStyle = rgba(p.surface, 0.08 + d.goldenHour * 0.34);
    ctx.fillRect(0, horizon - 1, w, 1.5);
  }

  drawFish(d, p, horizon, t) {
    if (d.fishVisibility < 0.015) return;
    const { ctx, w, h } = this;
    const waterHeight = h - horizon;

    ctx.save();
    ctx.fillStyle = rgba(p.fish, 1);
    for (const fish of this.fish) {
      const y = horizon + waterHeight * fish.lane;
      const drift = this.reduceMotion ? 0 : t * fish.speed;
      const x = ((((fish.x + drift) % 1) + 1) % 1) * (w * 1.2) - w * 0.1;
      const sway = this.reduceMotion ? 0 : Math.sin(t * 0.8 * fish.wobble + fish.phase) * waterHeight * 0.018;
      const scale = (0.60 + fish.lane * 0.88) * fish.size;
      const alpha = d.fishVisibility * (0.62 - fish.lane * 0.20);
      const dir = Math.sign(fish.speed) || 1;

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.ellipse(x, y + sway, 9 * scale, 3.1 * scale, 0, 0, Math.PI * 2);
      ctx.fill();

      const beat = this.reduceMotion ? 0.45 : Math.sin(t * 5.2 * fish.wobble + fish.phase) * 0.5 + 0.5;
      ctx.beginPath();
      ctx.moveTo(x - dir * 8 * scale, y + sway);
      ctx.lineTo(x - dir * (13 + beat * 2.4) * scale, y + sway - (2.6 + beat * 1.6) * scale);
      ctx.lineTo(x - dir * (13 + beat * 2.4) * scale, y + sway + (2.6 + beat * 1.6) * scale);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawCaustics(d, p, horizon, t) {
    if (d.caustics < 0.018) return;
    const { ctx, w, h } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < this.causticBands; i += 1) {
      const depth = i / Math.max(1, this.causticBands - 1);
      const y = horizon + (h - horizon) * (0.08 + depth * 0.9);
      const phase = this.reduceMotion ? i : t * (0.48 + depth * 0.48) + i * 1.7;
      const offset = Math.sin(phase) * w * 0.055;
      ctx.globalAlpha = d.caustics * 0.038 * (1 - depth * 0.58);
      ctx.fillStyle = rgba(p.surface, 1);
      ctx.beginPath();
      ctx.ellipse(w * 0.5 + offset, y, w * (0.19 + depth * 0.26), 2.4 + depth * 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawReflections(d, p, horizon, t) {
    const { ctx, w, h } = this;
    if (d.reflectivity < 0.025) return;

    const sources = [];
    if (d.sunVisibility > 0.015) {
      sources.push({
        x: d.sunX * w,
        startY: horizon,
        colour: mix('#fff0c6', '#ff8742', d.goldenHour),
        power: d.sunVisibility * (0.46 + d.goldenHour * 0.52),
        spread: 1.45
      });
    }
    if (d.moonVisibility > 0.015) {
      sources.push({
        x: d.moonX * w,
        startY: horizon,
        colour: p.moon,
        power: d.moonVisibility * 0.34,
        spread: 0.88
      });
    }
    if (d.lamps > 0.015) {
      for (const lamp of LAMPS) {
        sources.push({
          x: this.pierX(lamp.t) * w,
          startY: Math.max(horizon + 2, this.pierBottom(lamp.t) * h + 2),
          colour: p.lamp,
          power: d.lamps * (0.64 - lamp.t * 0.12),
          spread: 0.62 - lamp.t * 0.08
        });
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const source of sources) {
      const span = Math.max(12, h - source.startY);
      for (let i = 0; i < this.reflectionSteps; i += 1) {
        const k = i / Math.max(1, this.reflectionSteps - 1);
        const y = source.startY + span * Math.pow(k, 1.28);
        const wobble = this.reduceMotion
          ? 0
          : Math.sin(t * (1.25 + k * 1.75) + i * 0.91 + source.x * 0.01) * (3 + k * 30) * source.spread;
        const width = (6 + k * 43) * source.spread;
        const height = 1.4 + k * 3.1;
        ctx.globalAlpha = d.reflectivity * source.power * (1 - k) * 0.15;
        ctx.fillStyle = rgba(source.colour, 1);
        ctx.beginPath();
        ctx.ellipse(source.x + wobble, y, width, height, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawChop(d, p, horizon, t) {
    const { ctx, w, h } = this;
    const span = h - horizon;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = rgba(p.surface, 1);
    for (let i = 0; i < this.chopCount; i += 1) {
      const xSeed = hash(i * 41 + 7);
      const depth = Math.pow(hash(i * 43 + 19), 1.5);
      const y = horizon + span * (0.03 + depth * 0.94);
      const drift = this.reduceMotion ? 0 : Math.sin(t * (0.58 + xSeed) + i) * w * 0.028;
      const x = xSeed * w + drift;
      ctx.globalAlpha = (0.038 + d.daylight * 0.085) * (1 - depth * 0.5);
      ctx.fillRect(x, y, 9 + depth * 30, 1);
    }
    ctx.restore();
  }

  pierX(t) {
    return PIER.nearX + (PIER.farX - PIER.nearX) * t;
  }

  pierTop(t) {
    return PIER.nearTop + (PIER.farTop - PIER.nearTop) * t;
  }

  pierBottom(t) {
    return PIER.nearBottom + (PIER.farBottom - PIER.nearBottom) * t;
  }

  drawPier(d, p) {
    const { ctx, w, h } = this;
    ctx.save();
    ctx.fillStyle = rgba(p.pier, 0.975);

    ctx.beginPath();
    ctx.moveTo(this.pierX(0) * w, this.pierTop(0) * h);
    ctx.lineTo(this.pierX(1) * w, this.pierTop(1) * h);
    ctx.lineTo(this.pierX(1) * w, this.pierBottom(1) * h);
    ctx.lineTo(this.pierX(0) * w, this.pierBottom(0) * h);
    ctx.closePath();
    ctx.fill();

    for (const t of PILINGS) {
      const x = this.pierX(t) * w;
      const top = this.pierBottom(t) * h;
      const width = 16 - t * 9;
      ctx.fillRect(x - width / 2, top - 2, width, h - top + 4);
    }

    for (const t of BOLLARDS) {
      const x = this.pierX(t) * w;
      const y = this.pierTop(t) * h;
      const size = 11 - t * 5;
      ctx.beginPath();
      ctx.moveTo(x - size / 2, y);
      ctx.lineTo(x - size / 2.6, y - size * 1.5);
      ctx.lineTo(x + size / 2.6, y - size * 1.5);
      ctx.lineTo(x + size / 2, y);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y - size * 1.5, size / 2.1, size / 4.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // One small human-made imperfection keeps the pier from reading like a UI
    // diagram without turning the backdrop into an illustration-heavy scene.
    const crateX = this.pierX(0.30) * w;
    const crateY = this.pierTop(0.30) * h;
    ctx.fillRect(crateX - 17, crateY - 26, 34, 26);

    for (const lamp of LAMPS) {
      const x = this.pierX(lamp.t) * w;
      const base = this.pierTop(lamp.t) * h;
      const head = base - lamp.height * h;
      const width = Math.max(1.25, 4 - lamp.t * 2.2);
      ctx.fillRect(x - width / 2, head, width, base - head);
      ctx.beginPath();
      ctx.ellipse(x, head + 3, 9 - lamp.t * 4, 5.5 - lamp.t * 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const rimAlpha = 0.08 + d.goldenHour * 0.38 + d.lamps * 0.12;
    ctx.strokeStyle = rgba(p.rim, rimAlpha);
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.moveTo(this.pierX(0) * w, this.pierTop(0) * h);
    ctx.lineTo(this.pierX(1) * w, this.pierTop(1) * h);
    ctx.stroke();
    ctx.restore();
  }

  drawLampBloom(d, p, t) {
    if (d.lamps < 0.015) return;
    const { ctx, w, h } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (const lamp of LAMPS) {
      const x = this.pierX(lamp.t) * w;
      const y = this.pierTop(lamp.t) * h - lamp.height * h + 3;
      const flicker = this.reduceMotion ? 1 : 0.96 + Math.sin(t * 1.9 + lamp.t * 9) * 0.04;
      const radius = h * (0.145 - lamp.t * 0.035) * flicker;

      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, rgba(p.lamp, 0.45 * d.lamps * flicker));
      glow.addColorStop(0.28, rgba(p.lamp, 0.13 * d.lamps));
      glow.addColorStop(1, rgba(p.lamp, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

      ctx.globalAlpha = d.lamps * flicker;
      ctx.fillStyle = rgba(p.lamp, 0.92);
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(2.3, 5.5 - lamp.t * 3), Math.max(1.5, 3.4 - lamp.t * 1.7), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawScrim(d, horizon) {
    const { ctx, w, h } = this;
    const strength = 0.23 + d.daylight * 0.12 + d.caustics * 0.05;
    const grad = ctx.createRadialGradient(w * 0.50, h * 0.43, 0, w * 0.50, h * 0.43, Math.max(w, h) * 0.52);
    grad.addColorStop(0, `rgba(2, 6, 14, ${strength})`);
    grad.addColorStop(0.48, `rgba(2, 6, 14, ${strength * 0.62})`);
    grad.addColorStop(1, 'rgba(2, 6, 14, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, Math.max(horizon + h * 0.14, h * 0.62));
  }
}

export function createDockBackdrop(canvas, options) {
  if (!canvas?.getContext) return null;
  try {
    return new DockBackdrop(canvas, options).mount();
  } catch (error) {
    console.warn('RESET dock unavailable; keeping CSS atmosphere.', error);
    return null;
  }
}
