import { canonicalVoiceId } from './voiceRouter.js';

let localTtsPromise = null;
let localTtsState = 'cold';
let localTtsError = null;

async function getLocalTts() {
  if (!localTtsPromise) {
    localTtsState = 'loading';
    localTtsError = null;
    localTtsPromise = (async () => {
      try {
        const { KokoroTTS } = await import('kokoro-js');
        const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8' });
        localTtsState = 'ready';
        return tts;
      } catch (error) {
        localTtsState = 'error';
        localTtsError = error instanceof Error ? error.message : String(error);
        throw error;
      }
    })();
  }
  return localTtsPromise;
}

/**
 * Kokoro TTS adapter supporting local embedded synthesis (kokoro-js) and an
 * optional remote OpenAI-compatible /v1/audio/speech endpoint.
 */
export class KokoroClient {
  constructor({
    baseUrl = process.env.RESET_KOKORO_URL,
    provider = process.env.RESET_TTS_PROVIDER || (process.env.RESET_KOKORO_URL ? 'remote' : 'local')
  } = {}) {
    this.baseUrl = baseUrl?.replace(/\/$/, '');
    this.provider = String(provider || 'local').toLowerCase();
  }

  isEnabled() {
    return this.provider !== 'browser';
  }

  get mode() {
    if (!this.isEnabled()) return 'disabled';
    if (this.provider === 'remote' || this.baseUrl) return 'remote';
    return 'local';
  }

  status() {
    if (!this.isEnabled()) return { mode: 'disabled', state: 'disabled', error: null };
    if (this.mode === 'remote') return { mode: 'remote', state: 'ready', error: null };
    return { mode: 'local', state: localTtsState, error: localTtsError };
  }

  async warmup() {
    if (!this.isEnabled() || this.mode !== 'local') return this.status();
    await getLocalTts();
    return this.status();
  }

  async synthesize({ text, voice }) {
    if (!this.isEnabled()) return null;
    const targetVoice = canonicalVoiceId(voice) || 'af_nicole';
    const cleanText = String(text || '').trim();
    if (!cleanText) throw new Error('Text is required for Kokoro TTS synthesis');

    if (this.mode === 'remote') {
      if (!this.baseUrl) throw new Error('RESET_KOKORO_URL is required for remote Kokoro mode');
      const response = await fetch(`${this.baseUrl}/v1/audio/speech`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'kokoro',
          input: cleanText,
          voice: targetVoice,
          response_format: 'mp3'
        })
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Remote Kokoro request failed (${response.status}) ${detail}`.trim());
      }
      return {
        buffer: Buffer.from(await response.arrayBuffer()),
        mimeType: 'audio/mpeg'
      };
    }

    const tts = await getLocalTts();
    const rawAudio = await tts.generate(cleanText, { voice: targetVoice });
    const wav = rawAudio.toWav();
    return {
      buffer: Buffer.isBuffer(wav) ? wav : Buffer.from(wav),
      mimeType: 'audio/wav'
    };
  }
}
