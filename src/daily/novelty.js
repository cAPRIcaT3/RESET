import { normalizeText } from '../variation/recentHistory.js';

export function sceneFingerprint(text) {
  const normalized = normalizeText(text);
  const words = normalized.split(/\s+/).filter(Boolean);
  return {
    normalized,
    opening: words.slice(0, 7).join(' '),
    ending: words.slice(-7).join(' '),
    trigrams: makeNgrams(words, 3)
  };
}

export function isNearDuplicate(candidateText, priorTexts, threshold = 0.58) {
  const candidate = sceneFingerprint(candidateText);
  for (const text of priorTexts) {
    const prior = sceneFingerprint(text);
    if (candidate.normalized === prior.normalized) return { duplicate: true, reason: 'exact' };
    if (candidate.opening && candidate.opening === prior.opening) return { duplicate: true, reason: 'opening' };
    const similarity = jaccard(candidate.trigrams, prior.trigrams);
    if (similarity >= threshold) return { duplicate: true, reason: `trigram:${similarity.toFixed(2)}` };
  }
  return { duplicate: false, reason: null };
}

function makeNgrams(words, n) {
  const set = new Set();
  for (let i = 0; i <= words.length - n; i += 1) set.add(words.slice(i, i + n).join(' '));
  return set;
}

function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / (a.size + b.size - intersection || 1);
}
