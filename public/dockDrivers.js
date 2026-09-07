// RESET dock physical drivers.
//
// This module intentionally has no DOM/canvas dependencies. Scene time is
// converted into a small set of continuous visual signals so every layer of
// the dock can react to the same "physics" instead of maintaining separate
// day/night switches.

const DAY = 1440;
export const DEFAULT_SUNRISE = 390; // 06:30
export const DEFAULT_SUNSET = 1140; // 19:00

export function wrapMinutes(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  return ((v % DAY) + DAY) % DAY;
}

export function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

/** Hermite ramp: 0 at edge0, 1 at edge1, smooth in between. */
export function smoothstep(edge0, edge1, value) {
  const width = edge1 - edge0;
  const t = clamp01((value - edge0) / (Math.abs(width) < 1e-8 ? 1e-8 : width));
  return t * t * (3 - 2 * t);
}

/**
 * A stylised solar altitude in [-1, 1]. It is not astronomy; it is a stable
 * visual clock. The defaults can later be replaced by world-capsule sunrise /
 * sunset data without changing the renderer.
 */
export function solarAltitude(minutes, {
  sunrise = DEFAULT_SUNRISE,
  sunset = DEFAULT_SUNSET
} = {}) {
  const m = wrapMinutes(minutes);
  const rise = wrapMinutes(sunrise);
  const set = wrapMinutes(sunset);
  const daylightLength = Math.max(1, set - rise);
  const nightLength = DAY - daylightLength;

  if (m >= rise && m <= set) {
    return Math.sin(Math.PI * (m - rise) / daylightLength);
  }

  const sinceSunset = m > set ? m - set : m + (DAY - set);
  return -Math.sin(Math.PI * sinceSunset / nightLength);
}

export function dockDrivers(minutes, solarWindow = {}) {
  const sunrise = wrapMinutes(solarWindow.sunrise ?? DEFAULT_SUNRISE);
  const sunset = wrapMinutes(solarWindow.sunset ?? DEFAULT_SUNSET);
  const daylightLength = Math.max(1, sunset - sunrise);
  const nightLength = DAY - daylightLength;
  const m = wrapMinutes(minutes);
  const altitude = solarAltitude(m, { sunrise, sunset });

  // A bell centred on the horizon gives both sunrise and sunset warmth from a
  // single term. It disappears naturally toward noon and solar midnight.
  const goldenHour = Math.exp(-Math.pow(altitude / 0.27, 2));

  // The core coupling: as light penetrates the surface, fish become visible
  // and mirror-like reflection drops. At night the relationship reverses.
  const clarity = smoothstep(0.035, 0.34, altitude);
  const daylight = smoothstep(-0.08, 0.27, altitude);

  const dayProgress = clamp01((m - sunrise) / daylightLength);
  const nightProgress = clamp01((m > sunset ? m - sunset : m + DAY - sunset) / nightLength);

  // Separate sun/moon visibility avoids an abrupt body swap on the horizon.
  // They overlap very slightly in twilight, which reads much more naturally.
  const sunVisibility = smoothstep(-0.13, 0.025, altitude);
  const moonVisibility = 1 - smoothstep(-0.18, 0.015, altitude);

  return {
    minutes: m,
    altitude,
    goldenHour,
    daylight,
    twilight: 1 - smoothstep(0.05, 0.56, Math.abs(altitude)),

    // Photocell-like lamps: on before full darkness, off after sunrise has
    // meaningfully brightened the scene.
    lamps: 1 - smoothstep(-0.02, 0.22, altitude),
    stars: 1 - smoothstep(-0.30, -0.04, altitude),

    clarity,
    fishVisibility: clarity,
    reflectivity: 1 - 0.78 * clarity,
    caustics: smoothstep(0.42, 0.90, altitude),
    haze: 0.13 + goldenHour * 0.46,

    sunVisibility,
    sunX: 0.13 + dayProgress * 0.74,
    sunY: 1 - Math.max(0.045, Math.max(0, altitude)) * 0.84,

    moonVisibility,
    moonX: 0.87 - nightProgress * 0.74,
    moonY: 1 - Math.max(0.06, Math.max(0, -altitude)) * 0.82
  };
}

export function easeInOutCubic(t) {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Shortest path around the clock: 23:40 -> 00:20 travels 40 minutes. */
export function lerpMinutes(from, to, t) {
  const a = wrapMinutes(from);
  const b = wrapMinutes(to);
  let delta = b - a;
  if (delta > DAY / 2) delta -= DAY;
  if (delta < -DAY / 2) delta += DAY;
  return wrapMinutes(a + delta * clamp01(t));
}
