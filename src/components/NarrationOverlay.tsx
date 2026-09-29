import type { SceneState, TimeBand } from '../types/scene.ts';

const titles: Record<TimeBand, string> = {
  dawn: 'Before the city wakes.',
  morning: 'A little room for morning.',
  afternoon: 'An afternoon, passing.',
  sunset: 'The light stays a little.',
  evening: 'Evening, unhurried.',
  late_night: 'A few windows still lit.',
};
const timeLabels: Record<TimeBand, string> = { dawn: 'early morning', morning: 'this morning', afternoon: 'this afternoon', sunset: 'at dusk', evening: 'this evening', late_night: 'late tonight' };

export function NarrationOverlay({ state, busy }: { state: SceneState; busy: boolean }) {
  return <section className={`narration ${busy ? 'is-changing' : ''}`} aria-labelledby="moment-title" aria-live="polite" aria-atomic="true" aria-busy={busy}>
    <div className="moment-caption"><span className="presence-mark"/>{state.presence === 'away' ? 'Her room' : 'At Kelna’s window'}<span className="caption-separator">/</span>{timeLabels[state.timeBand]}</div>
    <h1 id="moment-title">{titles[state.timeBand]}</h1>
    <p className="observation" key={state.id}>{state.narration}</p>
  </section>;
}
