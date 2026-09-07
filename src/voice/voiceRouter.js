export const KOKORO_VOICES = Object.freeze(['af_nicole', 'am_michael']);

export const VOICE_ALIASES = Object.freeze({
  'af_nicole': 'af_nicole',
  'nicole': 'af_nicole',
  'us-nicole': 'af_nicole',
  'us_nicole': 'af_nicole',
  'am_michael': 'am_michael',
  'michael': 'am_michael',
  'us-michael': 'am_michael',
  'us_michael': 'am_michael'
});

export function canonicalVoiceId(value) {
  if (!value || typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  return VOICE_ALIASES[key] || (KOKORO_VOICES.includes(key) ? key : null);
}

/**
 * Resolve a voice requested by a small scene model, while keeping a safe fallback.
 * The model may choose directly between Kokoro's Nicole (US-Nicole / af_nicole)
 * and Michael (US-Michael / am_michael) IDs.
 * If it omits/invalidates the choice, this router chooses using lightweight scene cues
 * and recent voice balance rather than a simplistic mood=>gender mapping.
 */
export function resolveVoice({ requestedVoice, scene, recentVoiceCounts = {}, random = Math.random }) {
  const canonical = canonicalVoiceId(requestedVoice);
  if (canonical) return canonical;

  let nicole = 0;
  let michael = 0;
  const text = String(scene || '').toLowerCase();

  // Cadence / texture cues, intentionally weak. Either voice remains valid for any scene.
  const shortSentences = String(scene || '').split(/[.!?]+/).filter(Boolean).filter(s => s.trim().split(/\s+/).length <= 8).length;
  if (shortSentences >= 2) michael += 0.35;
  if (/kitchen|family|conversation|whisper|child|apartment|shop/.test(text)) nicole += 0.2;
  if (/machine|engine|warehouse|road|steel|repair/.test(text)) michael += 0.2;
  if (/funny|laugh|stuck|dropped|argu/.test(text)) nicole += 0.1;

  // Counterbalance recent usage so one voice does not accidentally dominate.
  nicole += Math.max(0, (recentVoiceCounts.am_michael || 0) - (recentVoiceCounts.af_nicole || 0)) * 0.18;
  michael += Math.max(0, (recentVoiceCounts.af_nicole || 0) - (recentVoiceCounts.am_michael || 0)) * 0.18;

  // Near ties are deliberately stochastic.
  const delta = nicole - michael;
  if (Math.abs(delta) < 0.3) return random() < 0.5 ? 'af_nicole' : 'am_michael';
  return delta > 0 ? 'af_nicole' : 'am_michael';
}
