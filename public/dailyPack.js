let cachedPack = null;
const STORAGE_KEY = 'reset-daily-pack-state-v1';

export async function getDailyScene() {
  const pack = await loadLatestPack();
  if (!pack?.scenes?.length) return null;

  const state = loadState(pack.date);
  const available = pack.scenes.filter(item => !state.used.includes(item.id));
  const pool = available.length ? available : pack.scenes;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  const nextUsed = available.length ? [...state.used, chosen.id] : [chosen.id];
  saveState({ date: pack.date, used: nextUsed.slice(-pack.scenes.length) });
  return chosen;
}

export async function loadLatestPack({ force = false } = {}) {
  if (cachedPack && !force) return cachedPack;
  const url = new URL('./generated/latest.json', document.baseURI);
  const response = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json' } });
  if (!response.ok) return null;
  const pack = await response.json();
  if (!pack || !Array.isArray(pack.scenes) || !pack.scenes.length) return null;
  cachedPack = pack;
  return pack;
}

function loadState(date) {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (parsed.date !== date || !Array.isArray(parsed.used)) return { date, used: [] };
    return parsed;
  } catch {
    return { date, used: [] };
  }
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}
