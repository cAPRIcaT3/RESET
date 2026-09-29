import { seededRandom } from './random.ts';
import { normalizeHour } from './blender.ts';
import type { BlenderLook } from './blender-pack.ts';

/** A visit keeps its sky choices while the clock or weather changes. */
export function skyOccurrence(seed: string) {
  return {
    sunrise: seededRandom(`${seed}:sunrise-color`)() < .24 ? 'red' as const : 'sunrise' as const,
    violetDawn: seededRandom(`${seed}:violet-dawn`)() < .28,
  };
}

export const ATMOSPHERE_CAPTURE_HOURS = {
  day: 9, early: 18.35, night: 21, sunrise: 6.45, red: 6.45, violet: 5.65,
} as const;

/** All colors are complete, synchronized Blender lighting renders. */
export function atmosphereLightingLayers(hour: number, weather: 'rain' | 'clear', seed: string, directory: string) {
  const occurrence = skyOccurrence(seed);
  const sunrise = occurrence.sunrise;
  const knots: Array<{hour: number; look: BlenderLook}> = [
    {hour: 0, look: 'night'}, {hour: 5, look: 'night'},
    ...(occurrence.violetDawn ? [{hour: 5.65, look: 'violet' as const}] : []),
    {hour: 6.45, look: sunrise}, {hour: 8, look: 'day'}, {hour: 17, look: 'day'},
    {hour: 18.35, look: 'early'}, {hour: 21, look: 'night'}, {hour: 24, look: 'night'},
  ];
  const h=normalizeHour(hour);
  const upper=knots.findIndex(knot=>knot.hour>h);
  const left=knots[upper-1]!, right=knots[upper]!;
  const mix=(h-left.hour)/(right.hour-left.hour);
  // Keep this visit's selected clips mounted; dragging does not restart water
  // or cloud motion. Rare colors are not downloaded on visits without them.
  const looks: BlenderLook[]=['day','early','night',sunrise,...(occurrence.violetDawn ? ['violet' as const] : [])];
  let accumulated=0;
  return looks.map(look=>{
    const weight=(left.look===look?1-mix:0)+(right.look===look?mix:0);
    accumulated+=weight;
    return {look,weight,opacity:weight>0?weight/accumulated:0,nativeClip:`${directory}/${weather}-${look}`};
  });
}

export function nativeRoomLightLevel(look: BlenderLook) {
  if (look==='night') return 1;
  if (look==='early') return 1.35/2.2;
  if (look==='sunrise' || look==='red') return (8-6.45)/3;
  if (look==='violet') return (8-5.65)/3;
  return 0;
}

export function nativeCityLightLevel(look: BlenderLook) {
  if (look==='sunrise' || look==='red' || look==='violet') {
    const fade=Math.max(0,Math.min(1,(6.5-ATMOSPHERE_CAPTURE_HOURS[look])/1.3));
    return fade*fade*(3-2*fade);
  }
  return nativeRoomLightLevel(look);
}
