import { useEffect, useRef, useState } from 'react';
import type { SceneState } from '../types/scene.ts';
import { assetUrl } from '../scene/manifest.ts';
import { BLENDER_LOOP_SECONDS, blenderAsset, blenderLayers, daylightAt } from '../scene/blender.ts';
import type { BlenderWeather } from '../scene/blender.ts';
import { BLENDER_PACK } from '../scene/blender-pack.ts';
import type { BlenderLook } from '../scene/blender-pack.ts';
import { ARCHITECTURE_PREVIEW_ANIMATED, ARCHITECTURE_PREVIEW_DIRECTORY } from '../scene/architecture-preview.ts';
import { WEATHER_PREVIEW_DIRECTORY, WEATHER_PREVIEW_SCENES, WEATHER_SPECTRUM_ENABLED, WEATHER_SPECTRUM_REVISION, weatherLightingLayers } from '../scene/weather-preview.ts';
import type { WeatherPreview } from '../scene/weather-preview.ts';

const openedAt = Date.now();
const phase = () => ((Date.now() - openedAt) / 1000 + 13.25) % BLENDER_LOOP_SECONDS;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  return reduced;
}

/** Every pixel of the room, city, plants, vehicles and water comes from Blender. */
function RenderedPass({ look, airConditioner, book, weather, reduced, preview = false, nativeClip }: { look: BlenderLook; airConditioner: boolean; book: SceneState['room']['notebook']; weather: BlenderWeather; reduced: boolean; preview?: boolean; nativeClip?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const poster = assetUrl(nativeClip ? `${nativeClip}.webp` : preview ? `${ARCHITECTURE_PREVIEW_DIRECTORY}/${look}.webp` : blenderAsset(look, airConditioner, 'webp', book, BLENDER_PACK, weather));
  const movie = assetUrl(nativeClip ? `${nativeClip}.mp4` : preview ? `${ARCHITECTURE_PREVIEW_DIRECTORY}/${look}.mp4` : blenderAsset(look, airConditioner, 'mp4', book, BLENDER_PACK, weather));

  useEffect(() => {
    if (reduced || failed) return;
    const element = video.current;
    if (!element) return;
    const synchronize = () => {
      if (document.hidden) { element.pause(); return; }
      if (element.readyState < 1) return;
      const time = phase();
      const delta = Math.abs(element.currentTime - time);
      if (Math.min(delta, BLENDER_LOOP_SECONDS - delta) > .12) element.currentTime = time;
      void element.play().catch(() => setFailed(true));
    };
    synchronize();
    element.addEventListener('loadedmetadata', synchronize);
    document.addEventListener('visibilitychange', synchronize);
    // Small drift corrections keep the two lighting renders on the same physical frame.
    const timer = setInterval(synchronize, 1500);
    return () => {
      clearInterval(timer);
      element.removeEventListener('loadedmetadata', synchronize);
      document.removeEventListener('visibilitychange', synchronize);
      element.pause();
    };
  }, [reduced, failed, movie]);

  return <div className="blender-pass" data-look={look} data-ac={airConditioner ? 'on' : 'off'} data-book={book} data-weather={weather} data-playback={ready && !failed && !reduced ? 'moving' : 'poster'}>
    <img className="scene-media" src={poster} alt="" fetchPriority="high"/>
    {!reduced && !failed && <video ref={video} className={`scene-media blender-video ${ready ? 'is-ready' : ''}`} src={movie} poster={poster} autoPlay muted loop playsInline preload="auto" onPlaying={() => setReady(true)} onError={() => setFailed(true)}/>}
  </div>;
}

export function SceneViewport({ state, architecturePreview = false, weatherPreview }: { state: SceneState; architecturePreview?: boolean; weatherPreview?: WeatherPreview }) {
  const reduced = useReducedMotion();
  const layers = blenderLayers(state);
  if (weatherPreview) {
    const scene = WEATHER_PREVIEW_SCENES[weatherPreview];
    return <div className="scene-viewport blender-viewport" role="img" aria-label={`${scene.label} in Kelna’s waterfront room. ${weatherPreview === 'rain' ? 'Raindrops splash against the window, merge and drain down the glass, with condensation near the frame.' : 'The clustered city rises behind the dock.'} ${WEATHER_SPECTRUM_REVISION>=8 ? 'Cloud banks drift above the skyline, with cars parked on the left quay. ' : ''}${state.room.mainLight ? 'Warm yellow light fills the room.' : 'Daylight enters through the window.'} ${reduced ? 'Motion is reduced.' : 'Water, ferry, train, leaves and book pages move gently.'}`} data-renderer="blender-weather" data-render-revision={WEATHER_SPECTRUM_ENABLED ? WEATHER_SPECTRUM_REVISION : weatherPreview === 'rain' ? 5 : 4} data-lighting-hour={state.lightingHour}>
      <div className="poster-plane">{WEATHER_SPECTRUM_ENABLED ? weatherLightingLayers(state.lightingHour, weatherPreview, state.seed).map(layer => <div className="blender-daylight" key={layer.nativeClip} style={{opacity: layer.opacity}} data-lighting-weight={layer.weight}>
        <RenderedPass look={layer.look} airConditioner book="open" weather={weatherPreview === 'rain' ? 'rain-humid' : 'dry'} reduced={reduced} nativeClip={layer.nativeClip}/>
      </div>) : <RenderedPass key={weatherPreview} look={weatherPreview === 'rain' ? 'early' : 'day'} airConditioner book="open" weather={weatherPreview === 'rain' ? 'rain-humid' : 'dry'} reduced={reduced} nativeClip={`${WEATHER_PREVIEW_DIRECTORY}/${scene.stem}`}/>}</div>
      <div className="scene-vignette" aria-hidden="true"/>
    </div>;
  }
  if (architecturePreview && !BLENDER_PACK.lightingStates) return <div className="scene-viewport blender-viewport" role="img" aria-label={`${ARCHITECTURE_PREVIEW_ANIMATED && !reduced ? 'Animated' : 'Still'} preview of the latest Blender architecture: detailed waterfront buildings, balconies, terraces and reflective water.${reduced ? ' Motion is reduced.' : ''}`} data-renderer="blender-preview" data-lighting-hour={state.lightingHour}>
    <div className="poster-plane">
      {ARCHITECTURE_PREVIEW_ANIMATED ? <>
        <RenderedPass look="night" airConditioner book="open" weather="dry" reduced={reduced} preview/>
        <div className="blender-daylight" style={{opacity: daylightAt(state.lightingHour)}}><RenderedPass look="day" airConditioner book="open" weather="dry" reduced={reduced} preview/></div>
      </> : <>
        <img className="scene-media" src={assetUrl(`${ARCHITECTURE_PREVIEW_DIRECTORY}/night.png`)} alt=""/>
        <img className="scene-media" src={assetUrl(`${ARCHITECTURE_PREVIEW_DIRECTORY}/day.png`)} alt="" style={{opacity: daylightAt(state.lightingHour)}}/>
      </>}
    </div>
    <div className="scene-vignette" aria-hidden="true"/>
  </div>;
  const label = `Kelna’s room, modeled in Blender, overlooking a waterfront city. ${state.timeBand.replace('_', ' ')}. The air conditioner is ${state.room.airConditioner ? 'on' : 'off'}.${reduced ? ' Motion is reduced.' : state.room.airConditioner ? ' The plants sway gently.' : ' The plants are still.'}`;
  return <div className="scene-viewport blender-viewport" role="img" aria-label={label} data-renderer="blender" data-render-revision={BLENDER_PACK.revision} data-lighting-hour={state.lightingHour}>
    <div className="poster-plane">
      {layers.map(layer => <div className="blender-daylight" key={`${layer.look}-${state.room.airConditioner}-${layer.book}-${layer.weather}`} style={{opacity: layer.opacity}}>
        <RenderedPass look={layer.look} airConditioner={state.room.airConditioner} book={layer.book} weather={layer.weather} reduced={reduced}/>
      </div>)}
    </div>
    <div className="scene-vignette" aria-hidden="true"/>
  </div>;
}
