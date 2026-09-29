import { useRef, useEffect } from 'react';
import { ACTIVITIES, PRESENCES, TIME_BANDS, WEATHERS } from '../types/scene.ts';
import type { SceneOverrides, SceneState } from '../types/scene.ts';
import { formatHour } from '../scene/blender.ts';
import { BLENDER_PACK } from '../scene/blender-pack.ts';
import { ARCHITECTURE_PREVIEW_ANIMATED } from '../scene/architecture-preview.ts';
import { Icon } from './Icons.tsx';
import type { WeatherPreview } from '../scene/weather-preview.ts';
import { WEATHER_SPECTRUM_ENABLED } from '../scene/weather-preview.ts';

interface Props { narrationSource?: 'prepared' | 'gemma' | 'local'; state: SceneState; overrides: SceneOverrides; onChange: (next: SceneOverrides) => void; onClose: () => void; architecturePreview?: boolean; weatherPreview?: WeatherPreview }
export default function DebugPanel({ state, overrides, onChange, onClose, architecturePreview = false, weatherPreview, narrationSource }: Props) {
  const cityAnimation = Boolean(BLENDER_PACK.lightingStates);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const select = <K extends 'weather' | 'timeBand' | 'kelnaActivity' | 'presence'>(key: K, label: string, options: readonly NonNullable<SceneOverrides[K]>[]) => <label>{label}<select value={state[key]} onChange={event => {
    const next = { ...overrides, [key]: event.target.value };
    if (key === 'timeBand') delete next.lightingHour;
    if (key === 'kelnaActivity') delete next.presence;
    if (key === 'presence') delete next.kelnaActivity;
    onChange(next);
  }}>{options.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>;
  return <dialog className="debug-panel" ref={dialog} aria-labelledby="debug-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="debug-heading"><h2 id="debug-title">Scene studio</h2><button className="icon-button" aria-label="Close scene studio" onClick={onClose}><Icon name="close"/></button></div>
    <p className="debug-note">Development controls. These previews do not change visit memory.</p>
    <label className="lighting-control"><span>Time of day <output>{formatHour(state.lightingHour)}</output></span><input disabled={Boolean(weatherPreview) && !WEATHER_SPECTRUM_ENABLED} aria-label="Time of day slider" aria-valuetext={formatHour(state.lightingHour)} type="range" min="0" max="24" step="0.05" value={state.lightingHour} onChange={event => onChange({ ...overrides, lightingHour: Number(event.target.value), weather: state.weather, kelnaActivity: state.kelnaActivity, airConditioner: state.room.airConditioner, notebook: state.room.notebook })}/><span className="lighting-scale"><span>Midnight</span><span>Noon</span><span>Midnight</span></span></label>
    {weatherPreview && WEATHER_SPECTRUM_ENABLED && <div className="time-presets" aria-label="Time presets">{([{label:'Dawn',hour:6},{label:'Day',hour:12},{label:'Dusk',hour:18.35},{label:'Night',hour:22}]).map(preset => <button key={preset.label} aria-pressed={Math.abs(state.lightingHour-preset.hour)<.025} onClick={() => onChange({...overrides, lightingHour:preset.hour})}>{preset.label}</button>)}</div>}
    {weatherPreview && WEATHER_SPECTRUM_ENABLED && <div className="debug-selects">{select('timeBand', 'Time of day', TIME_BANDS)}</div>}
    <p className="debug-note">{weatherPreview ? WEATHER_SPECTRUM_ENABLED ? `Explore the full day. Streetlights and warm yellow room lighting gradually come on after 5 pm, while the scene keeps moving. ${weatherPreview === 'rain' ? 'Rain catches the light, splashes, joins nearby drops and drains down the glass. ' : ''}AC is on and the book is open in these scenes.` : `This 32-second Blender scene is fixed at ${formatHour(state.lightingHour)}, with AC on and an open book. The controls below show the actual rendered state.` : cityAnimation ? 'Streetlights and different groups of rooms gradually illuminate after 5 pm. Water, ferry and train keep moving through four synchronized lighting stages.' : architecturePreview ? ARCHITECTURE_PREVIEW_ANIMATED ? 'The slider blends synchronized 32-second Blender animations. This preview has an open book, AC on and dry weather; other variants are not included.' : 'Latest architecture preview: the slider blends matching day and night stills. Animation and other scene variants are awaiting export.' : 'One Blender scene and one fixed camera. The slider blends synchronized day and night renders.'}</p>
    <fieldset disabled={Boolean(weatherPreview) || (architecturePreview && !cityAnimation)} className="preview-state-controls">
    <label className="lighting-control"><span>Humidity <output>{Math.round(state.exterior.humidity * 100)}%</output></span><input aria-label="Humidity slider" aria-valuetext={`${Math.round(state.exterior.humidity * 100)} percent relative humidity`} type="range" min="0" max="100" step="1" value={Math.round(state.exterior.humidity * 100)} onChange={event => onChange({ ...overrides, humidity: Number(event.target.value) / 100 })}/></label>
    <p className="debug-note">Humid air and an active air conditioner create condensation on the glass. Condensation: {Math.round(state.room.condensation * 100)}%.</p>
    {!weatherPreview && !BLENDER_PACK.weatherStates && <p className="debug-note">{cityAnimation ? 'This rendered scene has dry weather and an open book. Rain and condensation controls are metadata only.' : 'Humidity currently updates scene metadata. Its Blender renders are being prepared.'}</p>}
    <div className="debug-selects">{select('weather', 'Weather', WEATHERS)}{!(weatherPreview && WEATHER_SPECTRUM_ENABLED) && select('timeBand', 'Time of day', TIME_BANDS)}{select('kelnaActivity', 'Activity', ACTIVITIES)}{select('presence', 'Presence', PRESENCES)}</div>
    {BLENDER_PACK.bookStates && <label>Book on the desk<select value={state.room.notebook} onChange={event => onChange({ ...overrides, notebook: event.target.value as SceneState['room']['notebook'] })}><option value="open">Open</option><option value="closed">Closed</option><option value="absent">Put away</option></select></label>}
    <div className="debug-toggles">{(['deskLamp', 'mainLight', 'musicPlaying', 'airConditioner'] as const).map(key => <label key={key}><input type="checkbox" checked={state.room[key]} onChange={event => onChange({ ...overrides, [key]: event.target.checked })}/>{{ deskLamp: 'Desk lamp', mainLight: 'Main light', musicPlaying: 'Music', airConditioner: 'Air conditioner', trainVisible: 'Train' }[key]}</label>)}
    </div>
    <p className="debug-note">{weatherPreview ? 'The air conditioner moves the leaves and open pages. Water and traffic move independently. Reduced motion keeps the scene still.' : 'Air conditioner on: Blender animates the leaves. Off: a matching render holds them still. Water moves independently. Reduced motion keeps the scene still.'}</p>
    {BLENDER_PACK.bookStates && <p className="debug-note">An open book responds to the breeze only while the air conditioner is on.</p>}
    </fieldset>
    {(!weatherPreview || WEATHER_SPECTRUM_ENABLED) && <button className="debug-reset" onClick={() => onChange({})}>Return to automatic state</button>}
    <p className="debug-note">Seed: {state.seed}. Add ?debug=true&amp;seed=your-seed&amp;at=2026-09-19T20:00:00 to reproduce a moment. Forced presence resolves incompatible activities.</p>
    <p className="debug-note" role="status">Narration: {narrationSource === 'prepared' ? 'Gemma + Kokoro · prepared on GitHub Actions' : narrationSource === 'gemma' ? 'Gemma · live development endpoint' : 'Local written observation · no matching published recording'}.</p>
    <pre aria-label="Current scene state">{JSON.stringify(state, null, 2)}</pre>
  </dialog>;
}
