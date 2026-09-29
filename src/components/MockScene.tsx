import type { CSSProperties } from 'react';
import type { SceneState } from '../types/scene.ts';
import { TransportLayer } from './TransportLayer.tsx';

const buildings = [
  [0, 8, 39], [7, 6, 53], [12, 10, 42], [22, 5, 64], [28, 8, 46], [35, 8, 70],
  [43, 6, 40], [50, 10, 58], [60, 6, 47], [66, 9, 68], [75, 7, 44], [83, 10, 76], [94, 8, 56],
];

/** Deliberately small layout stand-in, available with ?debug=true&visual=mock. */
export function MockScene({ state, reduced = true, forceTrain }: { state: SceneState; reduced?: boolean; forceTrain?: boolean }) {
  return <div className="mock-scene" aria-hidden="true" data-time={state.timeBand} style={{ '--city-lights': state.exterior.cityLightLevel } as CSSProperties}>
    <div className="mock-sky"/>
    <div className="mock-skyline">{buildings.map(([left, width, height], index) => <div key={index} className="mock-building" style={{ left: `${left}%`, width: `${width}%`, height: `${height}%`, '--offset': `${index * 3}px` } as CSSProperties}/>)}</div>
    <div className="mock-water"/><div className="mock-rail"/>
    <TransportLayer profile="mock" reduced={reduced} fog={state.exterior.fogIntensity} forceTrain={forceTrain}/>
    <div className="mock-dock" data-lit={state.exterior.dockLights}/>
    <div className="mock-window"/><div className="mock-sill"/>
    <div className="mock-desk">
      <div className="mock-lamp" data-on={state.room.deskLamp}/>
      {state.room.notebook !== 'absent' && <div className="mock-notebook" data-open={state.room.notebook === 'open'}/>}
      {state.room.mug === 'present' && <div className="mock-mug"/>}
    </div>
    <div className={`mock-chair chair-${state.room.chair}`}/>
    {state.presence === 'in_room' && <div className="mock-presence"/>}
    <div className={`mock-curtain curtain-${state.room.curtains}`}/>
  </div>;
}
