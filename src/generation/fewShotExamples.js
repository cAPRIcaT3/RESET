import { FIXTURE_SCENES } from './fixtureSceneProvider.js';
import { fixtureWorldCapsules } from '../world/worldCapsules.js';

const capsuleById = new Map(fixtureWorldCapsules.map(capsule => [capsule.id, capsule]));

export function selectFewShotMessages({ random = Math.random, count = 4, excludeCapsuleId } = {}) {
  const pool = FIXTURE_SCENES.filter(example => example.capsuleId !== excludeCapsuleId);
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.max(0, Math.min(count, shuffled.length))).flatMap(example => {
    const capsule = capsuleById.get(example.capsuleId);
    const user = [
      'STYLE RANGE EXAMPLE ONLY — do not copy its structure, imagery, subject, or ending.',
      `World basis: ${capsule?.spatialSeed || example.capsuleId}`,
      `Broader region: ${capsule?.broaderRegion || 'not specified'}`,
      'Task: produce one valid RESET scene as JSON.'
    ].join('\n');
    const assistant = JSON.stringify({
      scene: example.scene,
      sceneTime: example.sceneTime,
      voice: example.voice
    });
    return [
      { role: 'user', content: user },
      { role: 'assistant', content: assistant }
    ];
  });
}
