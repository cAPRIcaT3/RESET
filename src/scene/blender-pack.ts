/** Updated only after a complete Blender render family passes validation. */
export type BlenderLook = 'day' | 'early' | 'blue' | 'night' | 'sunrise' | 'red' | 'violet';
export interface BlenderPack {
  revision: number;
  directory: string;
  bookStates: boolean;
  weatherStates?: boolean;
  fixedBook?: 'open' | 'closed' | 'absent';
  lightingStates?: ReadonlyArray<{ look: BlenderLook; hour: number }>;
}

export const BLENDER_PACK: BlenderPack = {
  revision: 1,
  directory: 'scenes/blender',
  bookStates: false,
};
