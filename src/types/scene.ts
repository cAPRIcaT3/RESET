export const WEATHERS = ['rain', 'fog', 'sunshine', 'cloudy', 'drizzle', 'windy'] as const;
export const TIME_BANDS = ['dawn', 'morning', 'afternoon', 'sunset', 'evening', 'late_night'] as const;
export const ACTIVITIES = ['studying', 'reading', 'journaling', 'listening_to_music', 'looking_outside', 'away', 'out_with_friends', 'getting_ready', 'just_returned', 'tidying', 'resting'] as const;
export const PRESENCES = ['in_room', 'nearby', 'away'] as const;
export type Weather = typeof WEATHERS[number];
export type TimeBand = typeof TIME_BANDS[number];
export type KelnaActivity = typeof ACTIVITIES[number];
export type Presence = typeof PRESENCES[number];

export interface SceneState {
  id: string;
  seed: string;
  weather: Weather;
  timeBand: TimeBand;
  /** Continuous local hour used by the single Blender scene's lighting slider. */
  lightingHour: number;
  kelnaActivity: KelnaActivity;
  presence: Presence;
  room: {
    mainLight: boolean;
    deskLamp: boolean;
    musicPlaying: boolean;
    airConditioner: boolean;
    condensation: number;
    curtains: 'open' | 'half_open' | 'mostly_closed';
    window: 'open' | 'slightly_open' | 'closed';
    notebook: 'open' | 'closed' | 'absent';
    mug: 'present' | 'absent';
    chair: 'tucked' | 'pulled_back' | 'angled';
  };
  exterior: {
    humidity: number;
    dockLights: boolean;
    trainVisible: boolean;
    trainProgress?: number;
    fogIntensity: number;
    rainIntensity: number;
    windIntensity: number;
    cityLightLevel: number;
    reflectionIntensity: number;
    wetSurfaces: boolean;
    skyColors?: {sunrise: 'amber' | 'crimson'; dawn: 'blue' | 'violet'};
  };
  details: { room: string[]; city: string[] };
  narration: string;
  createdAt: number;
}

export interface KelnaMemory {
  version: 1;
  lastActivity?: KelnaActivity;
  lastWeather?: Weather;
  lastVisit?: number;
  recentDetails?: string[];
  notebookLeftOpen?: boolean;
  mugLeftOut?: boolean;
  musicWasPlaying?: boolean;
}

export interface SceneOverrides {
  weather?: Weather;
  timeBand?: TimeBand;
  lightingHour?: number;
  kelnaActivity?: KelnaActivity;
  presence?: Presence;
  deskLamp?: boolean;
  mainLight?: boolean;
  musicPlaying?: boolean;
  airConditioner?: boolean;
  notebook?: SceneState['room']['notebook'];
  humidity?: number;
  trainVisible?: boolean;
}

export interface VisualPreset {
  id: string;
  weather: Weather;
  timeBand: TimeBand;
  videoUrl?: string;
  posterUrl?: string;
  overlays?: { rain?: boolean; fog?: boolean; grain?: boolean; train?: boolean; ferry?: boolean };
  /** Aligns vehicle paths and window occlusion to the poster's camera. */
  transportProfile?: 'evening' | 'daylight';
  /** Blender loops can own prop/weather animation instead of the mock layers. */
  renderedEnvironment?: boolean;
}
