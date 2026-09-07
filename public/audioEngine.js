let audioContext = null;
let activeSource = null;
let activeUtterance = null;
let speechKeepAlive = null;
let browserVoices = [];

export function initializeBrowserVoices() {
  if (!('speechSynthesis' in window)) return;
  browserVoices = window.speechSynthesis.getVoices?.() || [];
}

/**
 * Resume Web Audio while a real user gesture is still active. Chrome may reject
 * audio started only after multiple awaited fetches, so RESET primes the audio
 * context on pointerdown/click and uses it later for Kokoro playback.
 */
export async function primeAudio() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return false;
  if (!audioContext) audioContext = new AudioContextCtor();
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  return audioContext.state === 'running';
}

export function stopAudio() {
  if (activeSource) {
    try { activeSource.stop(); } catch {}
    try { activeSource.disconnect(); } catch {}
    activeSource = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  activeUtterance = null;
  if (speechKeepAlive) {
    window.clearInterval(speechKeepAlive);
    speechKeepAlive = null;
  }
}

export async function speakScene({ text, voice, audioUrl = null, onStatus = () => {} }) {
  stopAudio();
  onStatus('loading');

  try {
    const response = audioUrl
      ? await fetch(new URL(audioUrl, document.baseURI), {
          method: 'GET',
          headers: { accept: 'audio/wav, audio/mpeg, audio/*' }
        })
      : await fetch(new URL('./api/tts', document.baseURI), {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'audio/wav, audio/mpeg, audio/*'
          },
          body: JSON.stringify({ text, voice }),
          cache: 'no-store'
        });

    if (response.ok && response.status !== 204) {
      const contentType = response.headers.get('content-type') || '';
      if (!/^audio\//i.test(contentType)) {
        throw new Error(`TTS returned unexpected content type: ${contentType || 'unknown'}`);
      }

      const bytes = await response.arrayBuffer();
      if (bytes.byteLength < 44) throw new Error('TTS returned an empty audio payload');

      await playWithWebAudio(bytes, onStatus);
      return { provider: audioUrl ? 'prerendered-kokoro' : 'kokoro', started: true };
    }

    if (!response.ok && response.status !== 204) {
      const detail = await response.text().catch(() => '');
      console.warn(`Kokoro endpoint returned ${response.status}. ${detail}`.trim());
    }
  } catch (error) {
    console.warn('Kokoro playback unavailable; using browser speech fallback.', error);
  }

  const started = await speakWithBrowser(text, voice, onStatus);
  return { provider: 'browser', started };
}

async function playWithWebAudio(bytes, onStatus) {
  const ready = await primeAudio();
  if (!ready || !audioContext) {
    throw new Error('Web Audio context is not available or could not be resumed');
  }

  const decoded = await audioContext.decodeAudioData(bytes.slice(0));
  const source = audioContext.createBufferSource();
  source.buffer = decoded;
  source.connect(audioContext.destination);
  activeSource = source;

  source.addEventListener?.('ended', () => {
    if (activeSource === source) activeSource = null;
    try { source.disconnect(); } catch {}
    onStatus('idle');
  }, { once: true });

  source.start(0);
  onStatus('playing');
}

async function speakWithBrowser(text, voiceId, onStatus) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    onStatus('error');
    return false;
  }

  initializeBrowserVoices();
  const speech = window.speechSynthesis;
  speech.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  activeUtterance = utterance; // Keep a strong reference for Chrome/Windows.
  utterance.lang = 'en-US';
  utterance.rate = 0.94;
  utterance.pitch = 1;
  const selected = chooseBrowserVoice(voiceId);
  if (selected) utterance.voice = selected;

  const started = await new Promise(resolve => {
    let resolved = false;
    const settle = value => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    utterance.onstart = () => {
      onStatus('playing-browser');
      settle(true);
    };
    utterance.onend = () => {
      if (activeUtterance === utterance) activeUtterance = null;
      if (speechKeepAlive) {
        window.clearInterval(speechKeepAlive);
        speechKeepAlive = null;
      }
      onStatus('idle');
    };
    utterance.onerror = event => {
      console.warn('Browser SpeechSynthesis failed:', event.error || event);
      if (activeUtterance === utterance) activeUtterance = null;
      onStatus('error');
      settle(false);
    };

    speech.speak(utterance);
    // Chrome can leave synthesis paused after cancellations/backgrounding.
    speech.resume();

    // Long Chrome utterances can stall; nudging resume is harmless and keeps
    // 40–90 word RESET scenes reliable on Windows.
    speechKeepAlive = window.setInterval(() => {
      if (speech.speaking && speech.paused) speech.resume();
    }, 4000);

    window.setTimeout(() => {
      if (!resolved) {
        if (speech.speaking || speech.pending) {
          onStatus('playing-browser');
          settle(true);
        } else {
          onStatus('error');
          settle(false);
        }
      }
    }, 1200);
  });

  return started;
}

function chooseBrowserVoice(voiceId) {
  const voices = browserVoices.length ? browserVoices : (window.speechSynthesis?.getVoices?.() || []);
  const english = voices.filter(v => /^en(?:-|$)/i.test(v.lang));
  if (!english.length) return voices[0] || null;

  const isNicole = /nicole/i.test(String(voiceId || '')) || voiceId === 'af_nicole';
  const preferredNames = isNicole
    ? /samantha|zira|jenny|aria|ava|female|woman|susan|victoria|karen/i
    : /david|mark|guy|ryan|male|man|daniel|alex|george|james/i;

  return english.find(v => /^en-US$/i.test(v.lang) && preferredNames.test(v.name))
    || english.find(v => preferredNames.test(v.name))
    || english.find(v => /^en-US$/i.test(v.lang))
    || english[0];
}
