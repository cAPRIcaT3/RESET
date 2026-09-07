import { FixtureSceneProvider } from './fixtureSceneProvider.js';
import { OpenAiCompatibleSceneProvider } from './openAiCompatibleSceneProvider.js';
import { normalizeSceneTime } from '../variation/sceneTime.js';
import { resolveVoice, canonicalVoiceId } from '../voice/voiceRouter.js';

export class SceneGenerator {
  constructor({ provider, history, random = Math.random } = {}) {
    this.history = history;
    this.random = random;
    this.provider = provider || createConfiguredProvider(random);
  }

  get providerKind() {
    return this.provider?.kind || 'unknown';
  }

  async generate(input) {
    const raw = await this.provider.generate(input);
    const scene = validateSceneText(raw.scene);
    const time = normalizeSceneTime(raw.sceneTime || input.sceneTime);
    const requestedVoice = canonicalVoiceId(raw.requestedVoice);
    const voice = resolveVoice({
      requestedVoice,
      scene,
      recentVoiceCounts: this.history?.recentVoiceCounts?.() || {},
      random: this.random
    });

    return { scene, voice, ...time };
  }
}

export function createConfiguredProvider(random = Math.random) {
  if (process.env.RESET_SCENE_PROVIDER === 'openai_compat') {
    return new OpenAiCompatibleSceneProvider({ random });
  }
  return new FixtureSceneProvider(random);
}

export function validateSceneText(scene) {
  if (typeof scene !== 'string' || !scene.trim()) throw new Error('Scene is empty');
  const clean = scene.trim();
  const wordCount = clean.split(/\s+/).length;
  if (wordCount < 40 || wordCount > 90) throw new Error(`Scene must be 40-90 words; received ${wordCount}`);
  if (/\bas an ai\b|\breset stands for\b|\btake a deep breath\b|\bimagine\b/i.test(clean)) {
    throw new Error('Scene contains disallowed meta/instructional language');
  }
  return clean;
}
