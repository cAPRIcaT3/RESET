import { applyTheme, localMinutes, themeForTime } from './themeEngine.js';
import { initializeBrowserVoices, primeAudio, speakScene, stopAudio } from './audioEngine.js';
import { createDockBackdrop } from './dockBackdrop.js';
import { getDailyScene, loadLatestPack } from './dailyPack.js';

const app = document.getElementById('app');
const resetButton = document.getElementById('resetButton');
const scene = document.getElementById('scene');
const sceneShell = document.getElementById('sceneShell');
const statusText = document.getElementById('statusText');
const dockCanvas = document.getElementById('dockCanvas');

let state = 'resting';
let audioStatusTimer = null;
let dock = null;

initialize();

function initialize() {
  const openingMinutes = localMinutes();
  const openingTheme = themeForTime(openingMinutes, 'initial');
  applyTheme(app, openingTheme);

  // Pass initial state into the renderer before it mounts so there is no
  // one-frame flash of its default midday palette.
  dock = createDockBackdrop(dockCanvas, {
    initialMinutes: openingMinutes,
    initialTheme: openingTheme
  });
  if (dock) requestAnimationFrame(() => { app.dataset.dock = 'ready'; });

  initializeBrowserVoices();
  if ('speechSynthesis' in window) {
    window.speechSynthesis.addEventListener?.('voiceschanged', initializeBrowserVoices);
  }

  // Prime Web Audio at the earliest real gesture. Kokoro bytes arrive only
  // after async generation/synthesis, long after Chrome's activation window.
  resetButton.addEventListener('pointerdown', () => {
    void primeAudio().catch(error => console.debug('Audio prime deferred:', error));
  }, { passive: true });

  resetButton.addEventListener('click', runReset);
  window.addEventListener('pagehide', () => dock?.destroy(), { once: true });
  void loadLatestPack().catch(() => null);
  registerServiceWorker();
}

async function runReset() {
  if (state === 'loading') return;

  void primeAudio().catch(error => console.debug('Audio prime failed:', error));
  stopAudio();
  clearAudioStatusTimer();
  setState('loading');
  setAudioState('idle');

  try {
    let payload = await getDailyScene().catch(() => null);
    // GitHub Pages is intentionally static. Localhost keeps the development API fallback;
    // production waits for the three pre-rendered daily RESETs.
    if (!payload && isLocalDevelopment()) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
      const apiUrl = new URL('./api/reset', document.baseURI);
      apiUrl.searchParams.set('place', timeZone);
      const response = await fetch(apiUrl, {
        headers: { accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`RESET request failed (${response.status})`);
      payload = await response.json();
    }
    if (!payload) throw new Error('Today’s three RESETs have not arrived yet.');
    validatePayload(payload);

    const nextTheme = themeForTime(payload.sceneTimeMinutes, payload.scene);
    applyTheme(app, nextTheme);
    dock?.setScene({ minutes: payload.sceneTimeMinutes, theme: nextTheme, animate: true });

    setSceneText(payload.scene);
    app.dataset.sceneTime = payload.sceneTime;
    if (payload.sceneTimeBand) app.dataset.sceneTimeBand = payload.sceneTimeBand;

    requestAnimationFrame(() => setState('scene'));

    const result = await speakScene({
      text: payload.scene,
      voice: payload.voice,
      audioUrl: payload.audioUrl || null,
      onStatus: setAudioState
    });

    if (!result.started) setAudioState('error');
  } catch (error) {
    console.error(error);
    setState('error');
    window.setTimeout(() => setState(scene.textContent ? 'scene' : 'resting'), 2400);
  }
}

function setSceneText(text) {
  scene.textContent = text;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  scene.dataset.length = words >= 78 ? 'long' : words >= 62 ? 'medium' : 'short';
}

function setState(next) {
  state = next;
  app.dataset.state = next;
  resetButton.disabled = next === 'loading';
  resetButton.setAttribute('aria-busy', String(next === 'loading'));

  if (next === 'loading') {
    statusText.textContent = 'Rendering elsewhere…';
    sceneShell.setAttribute('aria-busy', 'true');
  } else if (next === 'error') {
    statusText.textContent = 'Today’s RESETs haven’t arrived yet. Hail one from GitHub Actions.';
    sceneShell.setAttribute('aria-busy', 'false');
  } else {
    if (!app.dataset.audio || app.dataset.audio === 'idle') statusText.textContent = '';
    sceneShell.setAttribute('aria-busy', 'false');
  }
}

function setAudioState(next) {
  app.dataset.audio = next;
  clearAudioStatusTimer();

  if (next === 'loading' && state === 'scene') {
    statusText.textContent = 'Finding its voice…';
  } else if (next === 'playing' || next === 'playing-browser' || next === 'idle') {
    if (state !== 'loading' && state !== 'error') statusText.textContent = '';
  } else if (next === 'error' && state === 'scene') {
    statusText.textContent = 'Audio unavailable.';
    audioStatusTimer = window.setTimeout(() => {
      if (state === 'scene') statusText.textContent = '';
    }, 2200);
  }
}

function clearAudioStatusTimer() {
  if (audioStatusTimer) {
    window.clearTimeout(audioStatusTimer);
    audioStatusTimer = null;
  }
}

function validatePayload(payload) {
  if (!payload || typeof payload.scene !== 'string' || !payload.scene.trim()) throw new Error('Invalid scene payload');
  if (!isValidVoice(payload.voice)) throw new Error('Invalid voice');
  if (!Number.isFinite(payload.sceneTimeMinutes)) throw new Error('Invalid scene time');
}

function isValidVoice(voice) {
  return /^(?:af_nicole|am_michael|us-nicole|us-michael|nicole|michael)$/i.test(String(voice || '').trim());
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register(new URL('./service-worker.js', document.baseURI), { updateViaCache: 'none' });
    void registration.update().catch(() => {});
  } catch (error) {
    console.warn('Service worker registration failed', error);
  }
}


function isLocalDevelopment() {
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}
