import { formatClockTime, parseClockTime } from './sceneTime.js';

export const SCENE_TIME_ENVELOPES = Object.freeze([
  { id: 'deep-night', label: 'deep night', start: '00:00', end: '04:29' },
  { id: 'dawn', label: 'dawn', start: '04:30', end: '06:29' },
  { id: 'morning', label: 'morning', start: '06:30', end: '10:59' },
  { id: 'midday', label: 'midday', start: '11:00', end: '13:59' },
  { id: 'afternoon', label: 'afternoon', start: '14:00', end: '16:29' },
  { id: 'golden-hour', label: 'late afternoon / golden hour', start: '16:30', end: '18:29' },
  { id: 'dusk', label: 'dusk', start: '18:30', end: '19:59' },
  { id: 'evening', label: 'evening', start: '20:00', end: '22:29' },
  { id: 'night', label: 'night', start: '22:30', end: '23:59' }
]);

export function shuffledTimeEnvelopes(random = Math.random) {
  const values = [...SCENE_TIME_ENVELOPES];
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

export function timeWithinEnvelope(sceneTime, envelope) {
  const minute = parseClockTime(sceneTime);
  const start = parseClockTime(envelope?.start);
  const end = parseClockTime(envelope?.end);
  if (minute == null || start == null || end == null) return false;
  return minute >= start && minute <= end;
}

export function midpointOfEnvelope(envelope) {
  const start = parseClockTime(envelope.start);
  const end = parseClockTime(envelope.end);
  return formatClockTime((start + end) / 2);
}
