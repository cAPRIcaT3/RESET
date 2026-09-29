export interface VoiceProvider {
  speak(text: string): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  readonly available: boolean;
}

export class BrowserVoiceProvider implements VoiceProvider {
  private finish?: () => void;
  get available(): boolean { return typeof window !== 'undefined' && 'speechSynthesis' in window; }
  speak(text: string): Promise<void> {
    this.stop();
    if (!this.available) return Promise.reject(new Error('Voice is unavailable in this browser.'));
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-GB';
      utterance.rate = .84;
      utterance.pitch = .95;
      utterance.volume = .75;
      const voices = speechSynthesis.getVoices();
      utterance.voice = voices.find(voice => voice.lang === 'en-GB' && voice.localService) ?? voices.find(voice => voice.lang.startsWith('en')) ?? null;
      const done = () => { if (this.finish === done) this.finish = undefined; resolve(); };
      this.finish = done;
      utterance.onend = done;
      utterance.onerror = (event) => {
        if (this.finish === done) this.finish = undefined;
        if (event.error === 'interrupted' || event.error === 'canceled') resolve();
        else reject(new Error('Voice could not start. You can still read this moment.'));
      };
      speechSynthesis.speak(utterance);
    });
  }
  pause(): void { if (this.available) speechSynthesis.pause(); }
  resume(): void { if (this.available) speechSynthesis.resume(); }
  stop(): void {
    if (this.available) speechSynthesis.cancel();
    this.finish?.();
    this.finish = undefined;
  }
}

export interface KokoroVoiceOptions {
  endpoint: string;
  voice?: string;
  model?: string;
  speed?: number;
  responseFormat?: 'wav' | 'mp3' | 'opus';
  timeoutMs?: number;
}

const DEFAULT_KOKORO_VOICE = 'af_heart';
const DEFAULT_KOKORO_MODEL = 'kokoro';
const DEFAULT_KOKORO_TIMEOUT_MS = 15000;

/** One owner per audio session; a late request cannot stop a newer playback. */
export class AudioFileVoiceProvider implements VoiceProvider {
  private controller?: AbortController;
  private audio?: HTMLAudioElement;
  private objectUrl?: string;
  private settle?: (error?: unknown) => void;
  private pauseRequested = false;
  readonly available = true;
  speak(_text: string): Promise<void> { return Promise.reject(new Error('No recorded moment selected.')); }

  playUrl(url: string): Promise<void> {
    // Paths originate only from a validated static manifest, never a model response.
    return this.playSource(async () => url);
  }
  protected playSource(load: (signal: AbortSignal) => Promise<string | Blob>): Promise<void> {
    this.stop();
    const controller = new AbortController();
    this.controller = controller;
    return new Promise<void>((resolve, reject) => {
      const finish = (error?: unknown) => {
        if (this.controller !== controller) return;
        this.cleanup();
        this.settle = undefined;
        if (error) reject(error); else resolve();
      };
      this.settle = finish;
      void load(controller.signal).then(source => {
        if (this.controller !== controller) return;
        const url = typeof source === 'string' ? source : (this.objectUrl = URL.createObjectURL(source));
        const audio = new Audio(url);
        this.audio = audio;
        audio.preload = 'auto';
        audio.onended = () => finish();
        audio.onerror = () => finish(new Error('Voice playback failed.'));
        if (!this.pauseRequested) void audio.play().catch(finish);
      }).catch(finish);
    });
  }
  pause(): void { this.pauseRequested = true; this.audio?.pause(); }
  resume(): void {
    this.pauseRequested = false;
    const audio = this.audio;
    const settle = this.settle;
    void audio?.play().catch(error => { if (this.audio === audio) settle?.(error); });
  }
  stop(): void { if (this.settle) this.settle(); else this.cleanup(); }
  private cleanup(): void {
    this.controller?.abort();
    this.controller = undefined;
    this.pauseRequested = false;
    if (this.audio) { this.audio.onended = null; this.audio.onerror = null; this.audio.pause(); }
    this.audio = undefined;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = undefined;
  }
}

/** Optional live endpoint for development; Pages normally plays prepared audio. */
export class KokoroVoiceProvider extends AudioFileVoiceProvider {
  private readonly options: Required<KokoroVoiceOptions>;
  constructor(endpointOrOptions: string | KokoroVoiceOptions) {
    super();
    const options = typeof endpointOrOptions === 'string' ? { endpoint: endpointOrOptions } : endpointOrOptions;
    this.options = {
      endpoint: options.endpoint, voice: options.voice ?? DEFAULT_KOKORO_VOICE,
      model: options.model ?? DEFAULT_KOKORO_MODEL, speed: options.speed ?? 1,
      responseFormat: options.responseFormat ?? 'mp3', timeoutMs: options.timeoutMs ?? DEFAULT_KOKORO_TIMEOUT_MS,
    };
  }
  override speak(text: string): Promise<void> {
    return this.playSource(async signal => {
      const response = await fetch(this.options.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'audio/*' },
        body: JSON.stringify({ model: this.options.model, input: text, text,
          voice: this.options.voice, response_format: this.options.responseFormat, speed: this.options.speed }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(this.options.timeoutMs)]),
      });
      if (!response.ok) throw new Error(`Voice endpoint returned ${response.status}.`);
      const blob = await audioBlob(response, this.options.responseFormat);
      if (!blob.size) throw new Error('Voice endpoint returned empty audio.');
      return blob;
    });
  }
}

async function audioBlob(response: Response, responseFormat: KokoroVoiceOptions['responseFormat']): Promise<Blob> {
  const contentType = response.headers.get('Content-Type')?.split(';', 1)[0]?.toLowerCase();
  if (contentType?.startsWith('audio/')) return response.blob();
  if (contentType !== 'application/json') throw new Error('Voice endpoint did not return audio.');
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') throw new Error('Voice endpoint returned invalid audio.');
  const value = data as Record<string, unknown>;
  if (typeof value.audio === 'string') {
    const bytes = Uint8Array.from(atob(value.audio), character => character.charCodeAt(0));
    const mime = `audio/${responseFormat ?? 'mpeg'}`.replace('mp3', 'mpeg');
    return new Blob([bytes], { type: mime });
  }
  throw new Error('Voice endpoint returned invalid audio.');
}

export function createVoiceProvider(): VoiceProvider {
  const endpoint = import.meta.env.VITE_KOKORO_ENDPOINT as string | undefined;
  if (!endpoint?.trim()) return new BrowserVoiceProvider();
  const speed = Number(import.meta.env.VITE_KOKORO_SPEED ?? '1');
  const timeout = Number(import.meta.env.VITE_KOKORO_TIMEOUT_MS ?? '15000');
  return new KokoroVoiceProvider({
    endpoint: endpoint.trim(),
    voice: (import.meta.env.VITE_KOKORO_VOICE as string | undefined)?.trim() || DEFAULT_KOKORO_VOICE,
    model: (import.meta.env.VITE_KOKORO_MODEL as string | undefined)?.trim() || DEFAULT_KOKORO_MODEL,
    speed: Number.isFinite(speed) && speed > 0 ? Math.min(speed, 2) : 1,
    responseFormat: import.meta.env.VITE_KOKORO_FORMAT === 'wav' ? 'wav' : import.meta.env.VITE_KOKORO_FORMAT === 'opus' ? 'opus' : 'mp3',
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? Math.min(timeout, 60000) : DEFAULT_KOKORO_TIMEOUT_MS,
  });
}
