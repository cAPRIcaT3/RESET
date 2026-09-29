import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { assetUrl } from '../scene/manifest.ts';
import { routePose, TRANSPORT_ROUTES, TRANSPORT_TIMING, transportTime, vehicleMotion, VEHICLE_SPRITES } from '../scene/transport.ts';
import type { TransportProfile, Vehicle } from '../scene/transport.ts';

// Start with a pass already in view, then keep a five-minute train rhythm.
// This timestamp belongs to the open window, not to individual check-ins.
const openedAt = Date.now();

function Sprite({ vehicle, reflection = false, onError }: { vehicle: Vehicle; reflection?: boolean; onError?: () => void }) {
  const sprite = VEHICLE_SPRITES[vehicle];
  return <svg className="vehicle-sprite" viewBox={sprite.viewBox} preserveAspectRatio={reflection ? 'none' : 'xMidYMid meet'} aria-hidden="true">
    <image href={assetUrl(sprite.url)} width={sprite.width} height={sprite.height} onError={onError}/>
  </svg>;
}

function FerryWake() {
  return <>
    <svg className="ferry-wake-lines" viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M294 50Q230 40 180 25Q90 4 5 3M294 50Q230 60 180 75Q90 96 5 97"/>
      <path d="M288 50Q225 43 175 35Q95 17 36 14M288 50Q225 57 175 65Q95 83 36 86"/>
      <path d="M282 50Q185 46 60 37M282 50Q185 54 60 63"/>
    </svg>
    <span className="ferry-ripples">{[0, 1, 2, 3, 4].map(index => <i key={index} style={{ '--ripple-delay': `${index * -1.8}s` } as CSSProperties}/>)}</span>
    <span className="ferry-reflection"><Sprite vehicle="ferry" reflection/></span>
    <span className="ferry-light-trails">{[0, 1, 2, 3, 4, 5, 6, 7].map(index => <i key={index} style={{ left: `${9 + index * 10}%`, height: `${65 + (index * 17) % 35}%`, animationDelay: `${index * -.4}s` }}/>)}</span>
  </>;
}

function MovingVehicle({ vehicle, profile, reduced, continuous, waterOnly = false }: { vehicle: Vehicle; profile: TransportProfile; reduced: boolean; continuous: boolean; waterOnly?: boolean }) {
  const moving = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const route = TRANSPORT_ROUTES[profile][vehicle];

  useEffect(() => {
    if (reduced || failed || !moving.current) return;
    const motion = vehicleMotion(vehicle, profile, continuous);
    const animation = moving.current.animate(motion.frames, { duration: motion.duration, iterations: Infinity, easing: 'linear' });
    const synchronize = () => {
      animation.currentTime = transportTime(vehicle, Date.now() - openedAt);
      if (document.hidden) animation.pause();
      else animation.play();
    };
    synchronize();
    document.addEventListener('visibilitychange', synchronize);
    return () => { document.removeEventListener('visibilitychange', synchronize); animation.cancel(); };
  }, [vehicle, profile, reduced, continuous, failed]);

  if (failed) return null;
  return <div ref={moving} className={`moving-vehicle moving-${vehicle} ${waterOnly ? 'vehicle-water-only' : ''}`} style={{ transform: routePose(route, TRANSPORT_TIMING[vehicle].initialProgress) }}>
    {waterOnly ? <div className="train-water-reflection" style={{ width: `${route.width}%` }}><Sprite vehicle="train" reflection onError={() => setFailed(true)}/></div> :
    <div className="vehicle-model" style={{ width: `${route.width}%`, aspectRatio: VEHICLE_SPRITES[vehicle].aspect }}>
      {vehicle === 'ferry' && <FerryWake/>}
      <Sprite vehicle={vehicle} onError={() => setFailed(true)}/>
    </div>}
  </div>;
}

interface Props {
  profile: TransportProfile;
  reduced: boolean;
  fog: number;
  trainEnabled?: boolean;
  ferryEnabled?: boolean;
  forceTrain?: boolean;
}

export function TransportLayer({ profile, reduced, fog, trainEnabled = true, ferryEnabled = true, forceTrain }: Props) {
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const visibility = () => layer.current?.classList.toggle('transport-paused', document.hidden);
    visibility();
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  const train = trainEnabled && (forceTrain ?? fog < .7);
  return <div ref={layer} className={`transport-layer transport-${profile} ${reduced ? 'transport-still' : ''}`} style={{ '--transport-visibility': 1 - fog * .6 } as CSSProperties} aria-hidden="true">
    <div className="transport-water">
      {ferryEnabled && <MovingVehicle vehicle="ferry" profile={profile} reduced={reduced} continuous={false}/>}
      {train && <MovingVehicle vehicle="train" profile={profile} reduced={reduced} continuous={forceTrain === true} waterOnly/>}
    </div>
    {train && <MovingVehicle vehicle="train" profile={profile} reduced={reduced} continuous={forceTrain === true}/>}
  </div>;
}
