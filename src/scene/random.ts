export type Random = () => number;

export function seededRandom(seed: string): Random {
  let hash = 2166136261;
  for (const character of seed) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return () => {
    hash += 0x6d2b79f5;
    let value = Math.imul(hash ^ (hash >>> 15), 1 | hash);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function weighted<T extends string>(random: Random, values: readonly (readonly [T, number])[]): T {
  const total = values.reduce((sum, [, weight]) => sum + weight, 0);
  if (!values.length || total <= 0) throw new Error('Weighted choices need a positive total.');
  let cursor = random() * total;
  for (const [value, weight] of values) {
    cursor -= weight;
    if (cursor < 0) return value;
  }
  return values[values.length - 1]![0];
}
