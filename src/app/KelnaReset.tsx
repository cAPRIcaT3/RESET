import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { loadMemory, readVoicePreference, rememberScene, saveVoicePreference } from '../continuity/storage.ts';
import { generateScene } from '../scene/generate.ts';
import { createMomentProvider } from '../narration/moments.ts';
import type { MomentNarration } from '../narration/moments.ts';
import { narrationContextKey } from '../narration/pack.ts';
import { AudioFileVoiceProvider, createVoiceProvider } from '../voice/providers.ts';
import { SceneViewport } from '../components/SceneViewport.tsx';
import { NarrationOverlay } from '../components/NarrationOverlay.tsx';
import { Icon } from '../components/Icons.tsx';
import type { SceneOverrides } from '../types/scene.ts';
import { ARCHITECTURE_PREVIEW_ANIMATED } from '../scene/architecture-preview.ts';
import { BLENDER_PACK } from '../scene/blender-pack.ts';
import { WEATHER_PREVIEW_ENABLED, WEATHER_PREVIEW_SCENES, WEATHER_SPECTRUM_ENABLED, weatherPreviewState } from '../scene/weather-preview.ts';
import type { WeatherPreview } from '../scene/weather-preview.ts';
import { formatHour } from '../scene/blender.ts';

const DebugPanel = lazy(() => import('../components/DebugPanel.tsx'));
const query = new URLSearchParams(window.location.search);
const debug = query.get('debug') === 'true';
const weatherPreview: WeatherPreview | undefined = WEATHER_PREVIEW_ENABLED && query.get('preview') !== 'classic'
  ? ['clear', 'architecture'].includes(query.get('preview') ?? '') ? 'clear' : 'rain'
  : undefined;
const architecturePreview = !weatherPreview && debug && query.get('preview') === 'architecture';
const cityAnimation = Boolean(BLENDER_PACK.lightingStates);
const previewPose: SceneOverrides = cityAnimation ? {weather: 'cloudy', humidity: .5, notebook: BLENDER_PACK.fixedBook} : architecturePreview ? {weather: 'cloudy', humidity: .5, notebook: 'open', airConditioner: true, kelnaActivity: 'reading'} : {};
const explicitSeed = debug ? query.get('seed') : null;
const linkedSkySeed = weatherPreview ? query.get('skySeed') : null;
const parsedTime = debug && query.get('at') ? Date.parse(query.get('at')!) : NaN;
const sceneTime = () => Number.isFinite(parsedTime) ? parsedTime : Date.now();
const linkedHour = query.has('hour') ? Number(query.get('hour')) : NaN;
const initialOverrides: SceneOverrides = WEATHER_SPECTRUM_ENABLED && Number.isFinite(linkedHour) ? {lightingHour: Math.max(0, Math.min(24, linkedHour))} : {};
const nextSeed = () => explicitSeed ?? globalThis.crypto.randomUUID();
const narrationProvider = createMomentProvider();
const recordedVoice = new AudioFileVoiceProvider();
const voiceProvider = createVoiceProvider();
function preserveObservation(current: ReturnType<typeof generateScene>, next: ReturnType<typeof generateScene>) {
  return narrationContextKey(current) === narrationContextKey(next) ? {...next, narration: current.narration} : next;
}
type Playback = 'idle' | 'playing' | 'paused';

export function KelnaReset() {
  const [state, setState] = useState(() => weatherPreview ? weatherPreviewState(explicitSeed ?? linkedSkySeed ?? nextSeed(), sceneTime(), weatherPreview, initialOverrides) : generateScene(nextSeed(), sceneTime(), explicitSeed ? { version: 1 } : loadMemory(), previewPose));
  const [busy, setBusy] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [idle, setIdle] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(readVoicePreference);
  const [playback, setPlayback] = useState<Playback>('idle');
  const [audioMessage, setAudioMessage] = useState('');
  const [debugOpen, setDebugOpen] = useState(false);
  const [watchingDusk, setWatchingDusk] = useState(false);
  const [overrides, setOverrides] = useState<SceneOverrides>(initialOverrides);
  const [clock, setClock] = useState(Date.now());
  const [hasVisited, setHasVisited] = useState(false);
  const [visitNumber, setVisitNumber] = useState(0);
  const initial = useRef(state);
  const [moment, setMoment] = useState<MomentNarration>({text: state.narration, source: 'local'});
  const [narrationMessage, setNarrationMessage] = useState('');
  const activeVoice = useRef(voiceProvider);
  const autoRead = useRef(false);
  const contextKey = narrationContextKey(state);
  const request = useRef(0);
  const speech = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const stopVoice = () => { speech.current++; voiceProvider.stop(); recordedVoice.stop(); setPlayback('idle'); };
  const speak = (observation: MomentNarration) => {
    stopVoice();
    const token = ++speech.current;
    setAudioMessage('');
    setPlayback('playing');
    activeVoice.current = observation.audioUrl ? recordedVoice : voiceProvider;
    const play = observation.audioUrl ? recordedVoice.playUrl(observation.audioUrl) : voiceProvider.speak(observation.text);
    void play.catch(() => {
      if (token === speech.current) setAudioMessage('Voice is unavailable. This moment is here to read.');
    }).finally(() => { if (token === speech.current) setPlayback('idle'); });
  };

  useEffect(() => {
    if (!debug && !weatherPreview) rememberScene(initial.current);
    return () => { controller.current?.abort(); voiceProvider.stop(); recordedVoice.stop(); speech.current++; request.current++; };
  }, []);

  // Debounce slider changes and cancel both the request and its recording.
  // Every result is tied to the resolved scene conditions, never just a seed.
  useEffect(() => {
    const token = ++request.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    stopVoice();
    setBusy(true);
    setMoment({text: state.narration, source: 'local'});
    const timer = setTimeout(() => {
      void narrationProvider.generate(state, abort.signal).then(observation => {
        if (abort.signal.aborted || request.current !== token) return;
        setMoment(observation);
        setState(current => ({...current, narration: observation.text}));
        setNarrationMessage(observation.source === 'local' ? 'A written moment is ready. A matching studio recording is not available yet.' : '');
        if (autoRead.current && voiceEnabled) speak(observation);
      }).catch(() => {
        if (!abort.signal.aborted) setNarrationMessage('The written moment is still here.');
      }).finally(() => {
        if (!abort.signal.aborted && request.current === token) { setBusy(false); autoRead.current = false; }
      });
    }, 300);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [contextKey, state.seed, visitNumber]);

  useEffect(() => {
    if (!viewOnly) return;
    const restore = (event: KeyboardEvent) => { if (event.key === 'Escape') setViewOnly(false); };
    window.addEventListener('keydown', restore);
    return () => window.removeEventListener('keydown', restore);
  }, [viewOnly]);

  useEffect(() => {
    const tick = setInterval(() => { if (!document.hidden) setClock(Date.now()); }, 30000);
    let fade = setTimeout(() => setIdle(true), 18000);
    const wake = () => { setIdle(false); clearTimeout(fade); fade = setTimeout(() => setIdle(true), 18000); };
    const visibility = () => { if (document.hidden) { voiceProvider.stop(); recordedVoice.stop(); speech.current++; setPlayback('idle'); } else wake(); };
    window.addEventListener('pointerdown', wake);
    window.addEventListener('pointermove', wake, { passive: true });
    window.addEventListener('keydown', wake);
    document.addEventListener('visibilitychange', visibility);
    return () => { clearInterval(tick); clearTimeout(fade); window.removeEventListener('pointerdown', wake); window.removeEventListener('pointermove', wake); window.removeEventListener('keydown', wake); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  // Keep the actual scene time moving after the initial visit, so the native
  // dusk lighting stages slowly advance from 17:00 without a page refresh.
  useEffect(() => {
    if ((weatherPreview && !WEATHER_SPECTRUM_ENABLED) || Number.isFinite(parsedTime) || overrides.lightingHour !== undefined || overrides.timeBand !== undefined) return;
    const local = new Date(clock);
    const lightingHour = local.getHours() + local.getMinutes()/60 + local.getSeconds()/3600;
    setState(current => weatherPreview ? preserveObservation(current, weatherPreviewState(current.seed, current.createdAt, weatherPreview, {lightingHour})) : {...current, lightingHour});
  }, [clock, overrides.lightingHour, overrides.timeBand]);

  useEffect(() => {
    if (!watchingDusk) return;
    const started = performance.now();
    const timer = setInterval(() => {
      const progress = Math.min(1, (performance.now()-started)/120000);
      const lightingHour = 17+progress*4;
      setState(current => weatherPreview ? preserveObservation(current, weatherPreviewState(current.seed, current.createdAt, weatherPreview, {lightingHour})) : {...current, lightingHour});
      setOverrides(current => ({...current, lightingHour}));
      if (progress === 1) setWatchingDusk(false);
    }, 250);
    return () => clearInterval(timer);
  }, [watchingDusk]);

  const visit = () => {
    if (busy) return;
    setWatchingDusk(false);
    setBusy(true);
    stopVoice();
    setViewOnly(false);
    autoRead.current = true;
    const next = weatherPreview ? weatherPreviewState(nextSeed(), sceneTime(), weatherPreview, overrides) : generateScene(nextSeed(), sceneTime(), explicitSeed ? { version: 1 } : loadMemory(), { ...(debug ? overrides : {}), ...previewPose });
    setState(next);
    setHasVisited(true);
    setVisitNumber(value => value + 1);
    if (!debug && !weatherPreview) rememberScene(next);
  };

  const toggleVoice = () => {
    if (playback === 'playing') { activeVoice.current.pause(); setPlayback('paused'); saveVoicePreference(false); setVoiceEnabled(false); }
    else if (playback === 'paused') { activeVoice.current.resume(); setPlayback('playing'); saveVoicePreference(true); setVoiceEnabled(true); }
    else { setVoiceEnabled(true); saveVoicePreference(true); speak(moment); }
  };

  const preview = (next: SceneOverrides) => {
    setWatchingDusk(false);
    request.current++;
    controller.current?.abort();
    autoRead.current = false;
    setBusy(false);
    stopVoice();
    setOverrides(next);
    setState(current => preserveObservation(current, weatherPreview ? weatherPreviewState(current.seed, current.createdAt, weatherPreview, next) : generateScene(current.seed, current.createdAt, { version: 1 }, { ...next, ...previewPose })));
  };
  const date = new Date(Number.isFinite(parsedTime) ? parsedTime : clock);
  if (architecturePreview || weatherPreview) date.setHours(Math.floor(state.lightingHour), Math.round(state.lightingHour % 1 * 60));
  const dateText = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).format(date).replace(',', '');
  const timeText = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  const voiceLabel = playback === 'playing' ? 'Pause narration' : playback === 'paused' ? 'Resume narration' : 'Listen to this moment';

  return <main className={`experience ${viewOnly ? 'view-only' : ''} ${idle ? 'is-idle' : ''}`}>
    <SceneViewport state={state} architecturePreview={architecturePreview} weatherPreview={weatherPreview}/>
    <div className="experience-content">
      <header className="masthead">
        <a className="wordmark" href={import.meta.env.BASE_URL} aria-label="Kelna’s Reset, home"><Icon name="window"/><span>KELNA’S RESET</span></a>
        <div className="masthead-right"><time dateTime={date.toISOString()} className="date-stamp"><span>{dateText}</span><span className="time-separator">·</span>{timeText}</time>
          <span className="header-divider"/>
          <button className="sound-button" onClick={toggleVoice} disabled={(!moment.audioUrl && !voiceProvider.available) || busy} aria-label={voiceLabel} title={voiceLabel}>
            <Icon name={playback === 'playing' ? 'pause' : playback === 'paused' ? 'play' : voiceEnabled ? 'sound' : 'muted'}/><span>{playback === 'playing' ? 'Listening' : playback === 'paused' ? 'Paused' : voiceEnabled ? 'Listen' : 'Sound off'}</span>
          </button>
        </div>
      </header>

      <div className="moment-layout">
        <div className="moment-content"><NarrationOverlay state={state} busy={busy}/>
          <div className="visit-row"><button className={`visit-button ${hasVisited ? 'has-visited' : ''}`} disabled={busy} onClick={() => void visit()}><Icon name="refresh" className={busy ? 'is-turning' : undefined}/><span>{busy ? 'A moment…' : 'Check in'}</span></button><span className="visit-note">Stay a little.</span></div>
          {narrationMessage && <p className="audio-message" role="status">{narrationMessage}</p>}
          {audioMessage && <p className="audio-message" role="status">{audioMessage}</p>}
        </div>
        <div className="view-controls">
          {state.room.musicPlaying && !viewOnly && <span className="music-note" aria-label="Music is playing in Kelna’s room"><span className="music-bars"><i/><i/><i/></span><span>A record is playing</span></span>}
          <button className="view-button" aria-label={viewOnly ? 'Back to the moment' : 'Just the view'} aria-pressed={viewOnly} onClick={() => { setViewOnly(value => !value); if (!viewOnly) stopVoice(); }}><Icon name={viewOnly ? 'close' : 'view'}/><span>{viewOnly ? 'Back to the moment' : 'Just the view'}</span></button>
        </div>
      </div>
      <footer className="quiet-footer"><span>A ROOM. A CITY. A MOMENT.</span><span>Somewhere, life carries on.</span></footer>
    </div>
    {debug && <button className="debug-launch" onClick={() => setDebugOpen(true)}>Scene studio</button>}
    {weatherPreview && <aside className="architecture-preview-note weather-preview-note" aria-label="Weather scene controls"><span>{WEATHER_PREVIEW_SCENES[weatherPreview].label}</span><div><a aria-current={weatherPreview === 'rain' ? 'page' : undefined} href={`?${debug ? 'debug=true&' : ''}preview=rain&hour=${state.lightingHour}&skySeed=${encodeURIComponent(state.seed)}`}>Rain</a><a aria-current={weatherPreview === 'clear' ? 'page' : undefined} href={`?${debug ? 'debug=true&' : ''}preview=clear&hour=${state.lightingHour}&skySeed=${encodeURIComponent(state.seed)}`}>Cloudy</a></div><small>{WEATHER_SPECTRUM_ENABLED ? `${formatHour(state.lightingHour)} · ${state.room.mainLight ? 'warm light on' : 'daylight'} · AC on` : weatherPreview === 'rain' ? 'Early evening · humidity 80% · AC on' : 'Late afternoon · AC on'}</small></aside>}
    {architecturePreview && <aside className="architecture-preview-note" aria-label="Architecture preview controls"><span>{cityAnimation ? 'Living skyline' : `Latest scene · ${ARCHITECTURE_PREVIEW_ANIMATED ? 'animated' : 'still'} preview`}</span><div><button onClick={() => preview({...overrides, lightingHour: 17})}>Day</button>{cityAnimation && <button aria-pressed={watchingDusk} onClick={() => { if (watchingDusk) setWatchingDusk(false); else { preview({...overrides, lightingHour: 17}); setWatchingDusk(true); } }}>{watchingDusk ? 'Pause dusk' : 'Watch dusk'}</button>}<button onClick={() => preview({...overrides, lightingHour: 21})}>Night</button></div><small>{cityAnimation ? watchingDusk ? '5–9 pm in two minutes' : 'Lights gradually turn on from 5 pm' : ARCHITECTURE_PREVIEW_ANIMATED ? '32-second loop · AC on · book open' : 'Animation export pending'}</small></aside>}
    {debugOpen && <Suspense fallback={null}><DebugPanel state={state} overrides={overrides} onChange={preview} onClose={() => setDebugOpen(false)} architecturePreview={architecturePreview} weatherPreview={weatherPreview} narrationSource={moment.source}/></Suspense>}
  </main>;
}
