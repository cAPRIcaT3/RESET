import type { KelnaActivity, SceneState, Weather } from '../types/scene.ts';

const activities: Record<KelnaActivity, string> = {
  studying: 'Kelna is at the desk with her notes open. The pages are arranged in front of her, and the room remains otherwise still.',
  reading: 'Kelna is reading in the room, with the desk and the broad window close by.',
  journaling: 'Kelna is writing in her notebook. The open pages lie on the desk in front of her.',
  listening_to_music: 'Music is playing in Kelna’s room. The sounds from outside keep their place beyond the glass.',
  looking_outside: 'Kelna is near the window, looking toward the buildings across the water. The water and the opposite shore remain in view.',
  away: 'Kelna is away from the room. The chair is empty, and the things on the desk remain where they were left.',
  out_with_friends: 'Kelna is out with friends. The chair is empty; the room holds the small traces of an ordinary pause.',
  getting_ready: 'Kelna is nearby, getting ready. The room and the window remain in view beside the doorway.',
  just_returned: 'Kelna has just returned. She is near the doorway, and the room has not yet changed around her.',
  tidying: 'Kelna is putting a few things back around the desk. The view across the water stays open behind her.',
  resting: 'Kelna is resting in the room, while the desk and the window remain in view.',
};
const weather: Record<Weather, string> = {
  rain: 'Rain gathers on the glass, softening the buildings beyond it.',
  fog: 'Fog sits between the towers, taking the farther streets out of view.',
  sunshine: 'Clear light crosses the glass and reaches the buildings beyond it.',
  cloudy: 'A low layer of cloud hangs over the far side of the city.',
  drizzle: 'Fine drizzle catches on the glass; the far shore remains visible.',
  windy: 'Wind moves along the waterfront, breaking the surface of the water.',
};

export function describeScene(state: SceneState): string {
  const roomAnchor = state.room.chair === 'tucked'
    ? 'The walnut desk sits beside the broad window, its chair tucked close while the bed and plants remain in the quieter part of the room.'
    : 'The walnut desk sits beside the broad window, with the chair turned slightly toward the water and the bed and plants held back in the room.';
  const detail = (text: string | undefined) => text?.replace(/\. ([A-Z])/g, (_match, letter: string) => `; ${letter.toLowerCase()}`);
  return [roomAnchor, detail(activities[state.kelnaActivity]), detail(state.details.room[0]), weather[state.weather], detail(state.details.city[0])].filter(Boolean).join(' ');
}
