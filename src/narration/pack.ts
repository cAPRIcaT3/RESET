import { activeSkyColor, RESET_PROMPT_VERSION, sceneFacts } from './prompts.ts';
import { validateNarration } from './validation.ts';
import type { SceneState } from '../types/scene.ts';

export interface PreparedMoment {
  id: string;
  contextKey: string;
  narration: string;
  audio: { path: string; sha256: string; mime: 'audio/mpeg' | 'audio/wav'; voice: string };
}
export interface NarrationPack {
  version: 1;
  promptVersion: string;
  date: string;
  model: string;
  sceneRevision: number;
  entries: PreparedMoment[];
}

/** Only resolved, visible conditions affect matching. Clock digits are never narrated. */
export function narrationContextKey(state: SceneState): string {
  const facts = sceneFacts(state);
  // A crossing is transient within the same 32-second video; narration never
  // claims the train is in a particular place at this precise second.
  return JSON.stringify({
    time: facts.timeOfDay, weather: facts.weather, kelna: facts.kelna,
    room: facts.room,
    outside: {
      rain: facts.outside.rainIntensity > 0,
      fog: facts.outside.fogIntensity > .5,
      wind: facts.outside.windIntensity > .5,
      lights: facts.outside.cityLightLevel === 0 ? 'off' : facts.outside.cityLightLevel < .75 ? 'some' : 'many',
      dockLights: facts.outside.dockLights, wetSurfaces: facts.outside.wetSurfaces,
      sky: activeSkyColor(state),
    },
    sound: facts.sensory.soundCues,
  });
}

export function validatePack(value: unknown): NarrationPack {
  if (!value || typeof value !== 'object') throw new Error('Invalid narration pack');
  const pack = value as NarrationPack;
  if (pack.version !== 1 || pack.promptVersion !== RESET_PROMPT_VERSION || !/^\d{4}-\d{2}-\d{2}$/.test(pack.date)
    || typeof pack.model !== 'string' || !Number.isInteger(pack.sceneRevision)
    || !Array.isArray(pack.entries) || !pack.entries.length || pack.entries.length > 128) throw new Error('Incompatible narration pack');
  const ids = new Set<string>();
  for (const entry of pack.entries) {
    if (!entry || typeof entry.id !== 'string' || ids.has(entry.id) || typeof entry.contextKey !== 'string' || entry.contextKey.length > 12000) throw new Error('Invalid pack entry');
    ids.add(entry.id);
    if (typeof entry.narration !== 'string') throw new Error('Invalid narration');
    validateNarration(entry.narration);
    if (!entry.audio || !/^[a-zA-Z0-9_-]+\/audio\/[a-zA-Z0-9_-]+\.(mp3|wav)$/.test(entry.audio.path)
      || !/^[a-f0-9]{64}$/.test(entry.audio.sha256) || !['audio/mpeg', 'audio/wav'].includes(entry.audio.mime)
      || typeof entry.audio.voice !== 'string') throw new Error('Invalid prepared audio');
  }
  return pack;
}

export class PreparedNarrationLibrary {
  private pack?: NarrationPack;
  private loadedAt = 0;
  private url: string;
  private revision: number;
  constructor(url: string, revision: number) { this.url = url; this.revision = revision; }
  async find(state: SceneState, signal?: AbortSignal): Promise<(PreparedMoment & { audioUrl: string }) | undefined> {
    signal?.throwIfAborted();
    if (Date.now() - this.loadedAt > 60000) {
      const response = await fetch(this.url, { cache: 'no-cache', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('Prepared moments are not published yet');
      // Reject an SPA's index.html fallback rather than mistaking it for a pack.
      this.pack = validatePack(await response.json());
      this.loadedAt = Date.now();
    }
    if (this.pack?.sceneRevision !== this.revision) return;
    const matches = this.pack.entries.filter(entry => entry.contextKey === narrationContextKey(state));
    if (!matches.length) return;
    let hash = 0;
    for (const char of state.seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    const entry = matches[hash % matches.length]!;
    const base = new URL(this.url, typeof window === 'undefined' ? undefined : window.location.href);
    const audioUrl = new URL(entry.audio.path, base).href;
    return { ...entry, audioUrl };
  }
}
