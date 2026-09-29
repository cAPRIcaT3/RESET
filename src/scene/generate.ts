import { ACTIVITIES } from '../types/scene.ts';
import type { KelnaActivity, KelnaMemory, SceneOverrides, SceneState } from '../types/scene.ts';
import { ACTIVITY_RULES, AIR_CONDITIONER_CHANCE, CONTINUITY, TIME_RULES, WEATHER_RULES, WEATHER_HUMIDITY, timeBandAt } from './config.ts';
import { seededRandom, weighted } from './random.ts';
import { describeScene } from '../narration/local.ts';
import { BAND_HOURS, normalizeHour } from './blender.ts';
import { BLENDER_PACK } from './blender-pack.ts';
import { clampHumidity, condensationAt } from './humidity.ts';

export function generateScene(seed: string, now: number, memory: KelnaMemory = { version: 1 }, overrides: SceneOverrides = {}): SceneState {
  const random = seededRandom(seed);
  const chance = (probability: number) => random() < probability;
  const local = new Date(now);
  const requestedHour = overrides.lightingHour ?? (overrides.timeBand ? BAND_HOURS[overrides.timeBand] : local.getHours() + local.getMinutes() / 60);
  const lightingHour = requestedHour === 24 ? 24 : normalizeHour(requestedHour);
  const lightingTime = new Date(now);
  lightingTime.setHours(Math.floor(lightingHour), Math.round((lightingHour % 1) * 60), 0, 0);
  const timeBand = overrides.lightingHour === undefined ? overrides.timeBand ?? timeBandAt(now) : timeBandAt(lightingTime.getTime());
  const time = TIME_RULES[timeBand];
  const weather = overrides.weather ?? weighted(random, time.weather);
  const climate = WEATHER_RULES[weather];
  const elapsed = now - (memory.lastVisit ?? 0);
  const recent = memory.lastVisit !== undefined && elapsed >= 0 && elapsed < CONTINUITY.lifetimeMs;
  const activityWeights: [KelnaActivity, number][] = time.activities.map(([activity, weight]) => [activity, weight]);
  if (recent && memory.lastActivity === 'out_with_friends' && elapsed > CONTINUITY.returnAfterMs) {
    activityWeights.push(['just_returned', CONTINUITY.returnWeight]);
  }
  let activity = overrides.kelnaActivity ?? weighted(random, activityWeights);
  // A forced presence takes priority over an incompatible activity in debug mode.
  if (overrides.presence && ACTIVITY_RULES[activity].presence !== overrides.presence) {
    const eligible = ACTIVITIES.filter(item => ACTIVITY_RULES[item].presence === overrides.presence);
    activity = weighted(random, eligible.map(item => [item, 1] as const));
  }
  const rule = ACTIVITY_RULES[activity];
  const home = rule.presence !== 'away';
  const carryNotebook = recent && memory.notebookLeftOpen && chance(CONTINUITY.carryPropChance);
  const carryMug = recent && memory.mugLeftOut && chance(CONTINUITY.carryPropChance);
  const rainy = climate.rain > 0;
  const afterRain = recent && ['rain', 'drizzle'].includes(memory.lastWeather ?? '') && chance(CONTINUITY.wetSurfacesChance);
  const state: SceneState = {
    id: `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`,
    seed, createdAt: now, weather, timeBand, lightingHour, kelnaActivity: activity, presence: rule.presence,
    room: {
      mainLight: overrides.mainLight ?? (home && time.cityLights > .4 && chance(.2)),
      deskLamp: overrides.deskLamp ?? chance(home ? time.lampChance : .25),
      musicPlaying: overrides.musicPlaying ?? (rule.music || (home && activity !== 'resting' && chance(.12))),
      airConditioner: overrides.airConditioner ?? (home && seededRandom(`${seed}:air-conditioner`)() < AIR_CONDITIONER_CHANCE[weather]),
      condensation: 0,
      curtains: weighted(random, [['open', 8], ['half_open', 2], ['mostly_closed', timeBand === 'late_night' ? 2 : .2]]),
      window: climate.rain > .5 ? 'closed' : weighted(random, [['closed', 6], ['slightly_open', 3], ['open', climate.wind > .6 ? .2 : 1]]),
      notebook: rule.notebook || carryNotebook ? 'open' : weighted(random, [['closed', 4], ['absent', 1]]),
      mug: carryMug || chance(home ? .85 : .5) ? 'present' : 'absent',
      chair: home ? weighted(random, [['angled', 3], ['pulled_back', 2]]) : (carryNotebook ? 'pulled_back' : 'tucked'),
    },
    exterior: {
      humidity: clampHumidity(overrides.humidity ?? WEATHER_HUMIDITY[weather] + (seededRandom(`${seed}:humidity`)() - .5) * .12),
      dockLights: time.cityLights >= .3,
      trainVisible: overrides.trainVisible ?? (climate.fog < .7 && chance(.18)),
      trainProgress: 0,
      fogIntensity: climate.fog,
      rainIntensity: climate.rain,
      windIntensity: climate.wind,
      cityLightLevel: time.cityLights,
      reflectionIntensity: rainy || afterRain ? .9 : .35,
      wetSurfaces: rainy || Boolean(afterRain),
    },
    details: { room: [], city: [] },
    narration: '',
  };
  if (state.room.airConditioner) state.room.window = 'closed';
  state.room.condensation = condensationAt(state.exterior.humidity, state.room.airConditioner);
  // Apply after the random sequence so a prop override cannot reroll the city.
  if (overrides.notebook !== undefined) state.room.notebook = overrides.notebook;
  // Return only details that follow the resolved state; memories are hints, not facts.
  const roomDetails = [
    state.room.deskLamp ? 'The desk lamp leaves a small pool of warm light on the wood.' : 'The desk lamp is off; the room takes its light from the window.',
    state.room.notebook === 'open' ? ((BLENDER_PACK.bookStates || BLENDER_PACK.fixedBook === 'open') && state.room.airConditioner ? 'A notebook lies open on the desk; the air conditioner occasionally lifts a page.' : 'A notebook lies open on the desk, its pages resting quietly.') : state.room.notebook === 'closed' ? 'Her notebook is closed and set a little to one side.' : 'There is an empty space on the desk where the notebook would be.',
    state.room.mug === 'present' ? 'A ceramic mug sits within reach, close to the edge of the desk.' : 'The desk has been cleared of cups, leaving a faint ring on the wood.',
  ];
  if (recent && memory.musicWasPlaying && !state.room.musicPlaying) roomDetails.push('The music is off after playing on the last visit.');
  const lessRecent = roomDetails.filter(detail => !memory.recentDetails?.includes(detail));
  const candidates = lessRecent.length ? lessRecent : roomDetails;
  state.details.room = [candidates[Math.floor(random() * candidates.length)]!];
  state.details.city = [state.exterior.wetSurfaces && !rainy
    ? 'The rain has passed, but the dock is still wet and catches the light.'
    : state.exterior.dockLights
      ? 'Across the water, the dock lights settle into long, wavering reflections.'
      : 'Across the water, the dock is quiet, its railings pale against the buildings.'];
  state.narration = describeScene(state);
  return state;
}
