const pressures = [
  'several people, no single protagonist',
  'something practical has gone slightly wrong',
  'ordinary work is already underway',
  'no weather description',
  'begin with action rather than setting',
  'avoid a poetic ending',
  'focus on a small physical process',
  'mildly funny, but not jokey',
  'no explicit location name',
  'make infrastructure part of the scene',
  'human activity without introspection',
  'no people; let a process or object carry the scene',
  'start close to one detail and widen later',
  'do not end with silence or a fading sound',
  'keep the moment busy rather than tranquil',
  'domestic and specific, not sentimental'
];

export function createCreativePressure(random = Math.random) {
  const first = pressures[Math.floor(random() * pressures.length)];
  let second = pressures[Math.floor(random() * pressures.length)];
  if (second === first) second = pressures[(pressures.indexOf(first) + 1) % pressures.length];
  return [first, second];
}
