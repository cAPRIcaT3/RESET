import { TRAIN_INTERVAL_MS, TRAIN_PASS_MS } from './train.ts';

export type Vehicle = 'ferry' | 'train';
export type TransportProfile = 'evening' | 'daylight' | 'mock';
export interface VehicleRoute {
  from: readonly [number, number];
  to: readonly [number, number];
  width: number;
}

// Coordinates are percentages of the source image, before object-fit cropping.
// They stay attached to the water/rail when a phone crops the surrounding room.
export const TRANSPORT_ROUTES: Record<TransportProfile, Record<Vehicle, VehicleRoute>> = {
  evening: {
    ferry: { from: [22, 45.2], to: [63, 48.5], width: 5.7 },
    train: { from: [19, 37.25], to: [84, 37.25], width: 16 },
  },
  daylight: {
    ferry: { from: [23, 47], to: [66, 53], width: 5.7 },
    train: { from: [17, 40.7], to: [86, 40.7], width: 16 },
  },
  mock: {
    ferry: { from: [9, 67], to: [80, 71], width: 7 },
    train: { from: [5, 57.8], to: [88, 57.8], width: 18 },
  },
};

export const TRANSPORT_TIMING = {
  ferry: { period: 96_000, pass: 80_000, initialProgress: .48 },
  train: { period: TRAIN_INTERVAL_MS, pass: TRAIN_PASS_MS, initialProgress: .34 },
} satisfies Record<Vehicle, { period: number; pass: number; initialProgress: number }>;

/** A scene change never restarts the city's motion; remounted layers share time. */
export function transportTime(vehicle: Vehicle, elapsedMs: number): number {
  const timing = TRANSPORT_TIMING[vehicle];
  return Math.max(0, elapsedMs) + timing.pass * timing.initialProgress;
}

export function routePose(route: VehicleRoute, progress: number): string {
  const x = route.from[0] + (route.to[0] - route.from[0]) * progress;
  const y = route.from[1] + (route.to[1] - route.from[1]) * progress;
  return `translate(${x}%, ${y}%)`;
}

export function vehicleMotion(vehicle: Vehicle, profile: TransportProfile, continuous = false): { frames: Keyframe[]; duration: number } {
  const timing = TRANSPORT_TIMING[vehicle];
  const route = TRANSPORT_ROUTES[profile][vehicle];
  const duration = continuous ? timing.pass : timing.period;
  const crossing = timing.pass / duration;
  return {
    duration,
    frames: [
      { offset: 0, transform: routePose(route, 0), opacity: 0 },
      { offset: crossing * .045, transform: routePose(route, .045), opacity: 1 },
      { offset: crossing * .92, transform: routePose(route, .92), opacity: 1 },
      { offset: crossing, transform: routePose(route, 1), opacity: 0 },
      ...(crossing < 1 ? [{ offset: 1, transform: routePose(route, 1), opacity: 0 }] : []),
    ],
  };
}

export const VEHICLE_SPRITES = {
  ferry: { url: 'scenes/ferry.webp', width: 1983, height: 793, viewBox: '44 67 1896 615', aspect: 1896 / 615 },
  train: { url: 'scenes/train.webp', width: 1912, height: 823, viewBox: '39 365 1841 110', aspect: 1841 / 110 },
} satisfies Record<Vehicle, { url: string; width: number; height: number; viewBox: string; aspect: number }>;
