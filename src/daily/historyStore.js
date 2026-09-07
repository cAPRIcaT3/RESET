import fs from 'fs/promises';
import path from 'path';

const DEFAULT_HISTORY = { version: 1, days: [] };

export async function loadDailyHistory(filePath = 'data/history.json') {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.days)) throw new Error('history.days must be an array');
    return parsed;
  } catch (error) {
    if (error?.code === 'ENOENT') return structuredClone(DEFAULT_HISTORY);
    throw error;
  }
}

export async function appendDailyHistory(history, dayRecord, { filePath = 'data/history.json', retainDays = 30 } = {}) {
  const next = {
    version: 1,
    days: [...history.days.filter(day => day.date !== dayRecord.date), dayRecord].slice(-retainDays)
  };
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

export function historySceneTexts(history) {
  return history.days.flatMap(day => (day.scenes || []).map(scene => scene.scene)).filter(Boolean);
}
