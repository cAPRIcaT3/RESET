const MINUTES_PER_DAY = 24 * 60;

export function parseClockTime(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function formatClockTime(minutes) {
  const normalized = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function timeBandFromMinutes(minutes) {
  const m = ((Number(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  if (m < 270) return 'deep_night';      // 00:00–04:29
  if (m < 390) return 'dawn';            // 04:30–06:29
  if (m < 660) return 'morning';         // 06:30–10:59
  if (m < 840) return 'day';             // 11:00–13:59
  if (m < 990) return 'afternoon';       // 14:00–16:29
  if (m < 1110) return 'golden_hour';    // 16:30–18:29
  if (m < 1200) return 'dusk';           // 18:30–19:59
  if (m < 1350) return 'evening';        // 20:00–22:29
  return 'night';                        // 22:30–23:59
}

export function normalizeSceneTime(sceneTime, fallbackMinutes = 12 * 60) {
  const parsed = parseClockTime(sceneTime);
  const minutes = parsed ?? fallbackMinutes;
  return {
    sceneTime: formatClockTime(minutes),
    sceneTimeMinutes: minutes,
    sceneTimeBand: timeBandFromMinutes(minutes)
  };
}
