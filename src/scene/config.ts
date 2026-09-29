import type { KelnaActivity, Presence, TimeBand, Weather } from '../types/scene.ts';

export const ACTIVITY_RULES: Record<KelnaActivity, { presence: Presence; notebook: boolean; music: boolean }> = {
  studying: { presence: 'in_room', notebook: true, music: false },
  reading: { presence: 'in_room', notebook: false, music: false },
  journaling: { presence: 'in_room', notebook: true, music: false },
  listening_to_music: { presence: 'in_room', notebook: false, music: true },
  looking_outside: { presence: 'in_room', notebook: false, music: false },
  away: { presence: 'away', notebook: false, music: false },
  out_with_friends: { presence: 'away', notebook: false, music: false },
  getting_ready: { presence: 'nearby', notebook: false, music: false },
  just_returned: { presence: 'nearby', notebook: false, music: false },
  tidying: { presence: 'in_room', notebook: false, music: false },
  resting: { presence: 'in_room', notebook: false, music: false },
};

type Choices<T extends string> = readonly (readonly [T, number])[];
export const TIME_RULES: Record<TimeBand, { cityLights: number; lampChance: number; activities: Choices<KelnaActivity>; weather: Choices<Weather> }> = {
  dawn: { cityLights: .3, lampChance: .35, activities: [['resting', 6], ['looking_outside', 2], ['getting_ready', 2]], weather: [['fog', 4], ['cloudy', 3], ['drizzle', 2], ['sunshine', 2], ['rain', 1], ['windy', 1]] },
  morning: { cityLights: .08, lampChance: .15, activities: [['getting_ready', 4], ['away', 4], ['reading', 2], ['tidying', 2], ['studying', 2]], weather: [['sunshine', 4], ['cloudy', 4], ['fog', 2], ['drizzle', 2], ['rain', 2], ['windy', 2]] },
  afternoon: { cityLights: .03, lampChance: .1, activities: [['away', 5], ['studying', 3], ['reading', 3], ['tidying', 1], ['listening_to_music', 2]], weather: [['sunshine', 5], ['cloudy', 3], ['rain', 2], ['windy', 2], ['drizzle', 1], ['fog', 1]] },
  sunset: { cityLights: .5, lampChance: .65, activities: [['looking_outside', 4], ['just_returned', 3], ['reading', 3], ['out_with_friends', 2], ['listening_to_music', 2]], weather: [['cloudy', 3], ['windy', 3], ['sunshine', 3], ['drizzle', 2], ['rain', 2], ['fog', 1]] },
  evening: { cityLights: .85, lampChance: .85, activities: [['reading', 4], ['journaling', 3], ['studying', 3], ['listening_to_music', 3], ['looking_outside', 3], ['out_with_friends', 2]], weather: [['drizzle', 4], ['rain', 3], ['cloudy', 3], ['fog', 2], ['windy', 1]] },
  late_night: { cityLights: .65, lampChance: .55, activities: [['resting', 6], ['studying', 2], ['journaling', 2], ['just_returned', 2], ['looking_outside', 2]], weather: [['drizzle', 4], ['fog', 3], ['rain', 3], ['cloudy', 2], ['windy', 1]] },
};

export const WEATHER_RULES: Record<Weather, { rain: number; fog: number; wind: number }> = {
  rain: { rain: .78, fog: .28, wind: .35 },
  drizzle: { rain: .28, fog: .2, wind: .12 },
  fog: { rain: 0, fog: .85, wind: .05 },
  sunshine: { rain: 0, fog: 0, wind: .08 },
  cloudy: { rain: 0, fog: .14, wind: .2 },
  windy: { rain: 0, fog: .08, wind: .8 },
};

/** Chance while home. The independent seed keeps this setting from rerolling other props. */
export const AIR_CONDITIONER_CHANCE: Record<Weather, number> = {
  sunshine: .9, cloudy: .75, drizzle: .7, rain: .6, windy: .55, fog: .45,
};

export const WEATHER_HUMIDITY: Record<Weather, number> = {
  sunshine: .50, cloudy: .69, drizzle: .84, rain: .89, windy: .58, fog: .93,
};

export const CONTINUITY = {
  lifetimeMs: 36 * 60 * 60 * 1000,
  returnAfterMs: 20 * 60 * 1000,
  returnWeight: 8,
  carryPropChance: .8,
  wetSurfacesChance: .8,
};

export function timeBandAt(timestamp: number): TimeBand {
  const hour = new Date(timestamp).getHours();
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 19) return 'sunset';
  if (hour >= 19 && hour < 23) return 'evening';
  return 'late_night';
}
