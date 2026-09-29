/** Humid air against AC-cooled glazing; normalized, deterministic art control. */
export function condensationAt(humidity: number, airConditioner: boolean): number {
  if (!airConditioner || !Number.isFinite(humidity)) return 0;
  return Math.max(0, Math.min(1, (humidity - .60) / .30));
}

export function clampHumidity(humidity: number): number {
  return Number.isFinite(humidity) ? Math.max(0, Math.min(1, humidity)) : .65;
}
