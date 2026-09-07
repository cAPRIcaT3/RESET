// Continuous 24-hour RESET palette.
// The generated scene's clock owns the interface; the listener's clock is only
// the initial resting state before the first RESET.

const DAY_MINUTES = 1440;

// These are colour anchors, not time "modes". Every minute interpolates between
// adjacent anchors, which keeps sunrise/sunset continuous and makes afternoon
// read as a clean blue rather than a generic warm gradient.
const KEYFRAMES = [
  { minute: 0,    colors: ['#020617', '#06112b', '#0b1b39'], glow: '#173a76', ink: '#f5f7ff', muted: '#bdc8dc' },
  { minute: 270,  colors: ['#071027', '#101a3a', '#25254a'], glow: '#4a4f8e', ink: '#f5f5ff', muted: '#c7c6dd' },
  { minute: 330,  colors: ['#172649', '#493458', '#8e4b62'], glow: '#c36f78', ink: '#fff7f2', muted: '#e5cfd1' },
  { minute: 375,  colors: ['#3b4968', '#c45f52', '#f39a55'], glow: '#ffd080', ink: '#fffaf1', muted: '#f2ddcf' },
  { minute: 420,  colors: ['#5c8fc0', '#efa969', '#ffd99a'], glow: '#fff0b5', ink: '#fffdf8', muted: '#edf0f2' },
  { minute: 540,  colors: ['#2f82c6', '#55a9da', '#9fd5ed'], glow: '#c9ecff', ink: '#f8fcff', muted: '#dceaf2' },
  { minute: 750,  colors: ['#1678c4', '#43a2db', '#8dd2ed'], glow: '#d6f2ff', ink: '#f9fdff', muted: '#deedf4' },
  { minute: 930,  colors: ['#217fc6', '#4ca8dc', '#94d3ea'], glow: '#d5eff8', ink: '#fbfdff', muted: '#dfeaf0' },
  { minute: 1035, colors: ['#397fae', '#70a7c3', '#d9bd81'], glow: '#ffd18a', ink: '#fffaf2', muted: '#eadfce' },
  { minute: 1095, colors: ['#4e6384', '#dc7359', '#f2a04e'], glow: '#ffc462', ink: '#fff8ee', muted: '#efd7c7' },
  { minute: 1140, colors: ['#323e65', '#a74858', '#e66b4f'], glow: '#ff9f61', ink: '#fff5f1', muted: '#e6cbd0' },
  { minute: 1200, colors: ['#1c2b50', '#563559', '#8a405b'], glow: '#b25f7e', ink: '#f8f4fb', muted: '#cec2d2' },
  { minute: 1320, colors: ['#08122a', '#101d3d', '#1a2947'], glow: '#31548c', ink: '#f4f7ff', muted: '#bbc7dc' },
  { minute: 1440, colors: ['#020617', '#06112b', '#0b1b39'], glow: '#173a76', ink: '#f5f7ff', muted: '#bdc8dc' }
];

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function hexToRgb(hex) {
  const value = String(hex).replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  const part = n => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function mixHex(a, b, t) {
  const from = hexToRgb(a);
  const to = hexToRgb(b);
  const k = clamp01(t);
  return rgbToHex({
    r: from.r + (to.r - from.r) * k,
    g: from.g + (to.g - from.g) * k,
    b: from.b + (to.b - from.b) * k
  });
}

function hashString(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededUnit(seed, salt) {
  let x = (seed ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967295;
}

function findSpan(minutes) {
  const m = ((Number(minutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  for (let i = 0; i < KEYFRAMES.length - 1; i += 1) {
    const a = KEYFRAMES[i];
    const b = KEYFRAMES[i + 1];
    if (m >= a.minute && m <= b.minute) {
      return { a, b, t: (m - a.minute) / Math.max(1, b.minute - a.minute) };
    }
  }
  return { a: KEYFRAMES[0], b: KEYFRAMES[1], t: 0 };
}

export function themeForTime(minutes, seedText = '') {
  const { a, b, t } = findSpan(minutes);
  const normalizedMinutes = ((Number(minutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const seed = hashString(`${Math.round(normalizedMinutes)}:${seedText}`);
  const colors = a.colors.map((color, index) => mixHex(color, b.colors[index], t));

  return {
    bg1: colors[0],
    bg2: colors[1],
    bg3: colors[2],
    glow: mixHex(a.glow, b.glow, t),
    ink: mixHex(a.ink, b.ink, t),
    muted: mixHex(a.muted, b.muted, t),
    angle: Math.round(112 + (seededUnit(seed, 1) - 0.5) * 54),
    glowX: Math.round(18 + seededUnit(seed, 2) * 64),
    glowY: Math.round(14 + seededUnit(seed, 3) * 54),
    glowSize: Math.round(44 + seededUnit(seed, 4) * 20)
  };
}

export function localMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

export function applyTheme(element, theme) {
  element.style.setProperty('--bg-1', theme.bg1);
  element.style.setProperty('--bg-2', theme.bg2);
  element.style.setProperty('--bg-3', theme.bg3);
  element.style.setProperty('--glow', theme.glow);
  element.style.setProperty('--ink', theme.ink);
  element.style.setProperty('--muted', theme.muted);
  element.style.setProperty('--gradient-angle', `${theme.angle}deg`);
  element.style.setProperty('--glow-x', `${theme.glowX}%`);
  element.style.setProperty('--glow-y', `${theme.glowY}%`);
  element.style.setProperty('--glow-size', `${theme.glowSize}vmax`);

  // Match the browser chrome/PWA status bar to the generated world.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.bg1);
}
