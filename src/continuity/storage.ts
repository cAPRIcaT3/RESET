import { ACTIVITIES, WEATHERS } from '../types/scene.ts';
import type { KelnaMemory, SceneState } from '../types/scene.ts';

export const MEMORY_KEY = 'kelnas-reset:memory:v1';
export const VOICE_KEY = 'kelnas-reset:voice:v1';
interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }

function browserStorage(): StorageLike | undefined {
  try { return globalThis.localStorage; } catch { return undefined; }
}

export function loadMemory(storage: StorageLike | undefined = browserStorage()): KelnaMemory {
  try {
    const value: unknown = JSON.parse(storage?.getItem(MEMORY_KEY) ?? 'null');
    if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) return { version: 1 };
    const data = value as Record<string, unknown>;
    return {
      version: 1,
      lastActivity: ACTIVITIES.find(item => item === data.lastActivity),
      lastWeather: WEATHERS.find(item => item === data.lastWeather),
      lastVisit: typeof data.lastVisit === 'number' && Number.isFinite(data.lastVisit) ? data.lastVisit : undefined,
      recentDetails: Array.isArray(data.recentDetails) ? data.recentDetails.filter((item): item is string => typeof item === 'string' && item.length < 300).slice(-6) : [],
      notebookLeftOpen: data.notebookLeftOpen === true,
      mugLeftOut: data.mugLeftOut === true,
      musicWasPlaying: data.musicWasPlaying === true,
    };
  } catch { return { version: 1 }; }
}

export function rememberScene(state: SceneState, storage: StorageLike | undefined = browserStorage()): void {
  const previous = loadMemory(storage);
  const memory: KelnaMemory = {
    version: 1,
    lastActivity: state.kelnaActivity, lastWeather: state.weather, lastVisit: state.createdAt,
    notebookLeftOpen: state.room.notebook === 'open', mugLeftOut: state.room.mug === 'present', musicWasPlaying: state.room.musicPlaying,
    recentDetails: [...(previous.recentDetails ?? []), ...state.details.room, ...state.details.city].slice(-6),
  };
  try { storage?.setItem(MEMORY_KEY, JSON.stringify(memory)); } catch { /* A private or full store should still allow a visit. */ }
}

export function readVoicePreference(): boolean {
  try { return browserStorage()?.getItem(VOICE_KEY) === 'true'; } catch { return false; }
}
export function saveVoicePreference(enabled: boolean): void {
  try { browserStorage()?.setItem(VOICE_KEY, String(enabled)); } catch { /* Optional preference. */ }
}
