export const TRAIN_INTERVAL_MS = 5 * 60 * 1000;
export const TRAIN_PASS_MS = 18_000;

/** Wall-clock phase survives reloads without a continuously running simulation. */
export function trainAt(now: number, fogIntensity: number): { trainVisible: boolean; trainProgress: number } {
  const phase = ((now % TRAIN_INTERVAL_MS) + TRAIN_INTERVAL_MS) % TRAIN_INTERVAL_MS;
  return { trainVisible: fogIntensity < .7 && phase < TRAIN_PASS_MS, trainProgress: Math.min(1, phase / TRAIN_PASS_MS) };
}
