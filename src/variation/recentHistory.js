export class RecentHistory {
  constructor(limit = 40) {
    this.limit = limit;
    this.items = [];
  }

  add(scene) {
    this.items.push(scene);
    if (this.items.length > this.limit) this.items.shift();
  }

  hasExactText(text, windowSize = this.limit) {
    const normalized = normalizeText(text);
    return this.items.slice(-windowSize).some(item => normalizeText(item.scene) === normalized);
  }

  recentVoiceCounts(windowSize = 8) {
    return this.items.slice(-windowSize).reduce((acc, item) => {
      acc[item.voice] = (acc[item.voice] || 0) + 1;
      return acc;
    }, {});
  }

  antiRepetitionSummary() {
    const recent = this.items.slice(-8);
    if (!recent.length) return [];

    const warnings = [];
    const counts = new Map();
    for (const item of recent) {
      for (const token of extractHabitTokens(item.scene)) {
        counts.set(token, (counts.get(token) || 0) + 1);
      }
    }
    for (const [token, count] of counts.entries()) {
      if (count >= 3) warnings.push(token);
    }
    return warnings.slice(0, 8);
  }
}

export function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHabitTokens(text) {
  const normalized = normalizeText(text);
  const habits = [
    'rain', 'night', 'dusk', 'platform', 'train', 'silence', 'quiet', 'lone',
    'soft light', 'for a moment', 'somewhere in the distance', 'sound fades'
  ];
  return habits.filter(habit => normalized.includes(habit));
}
