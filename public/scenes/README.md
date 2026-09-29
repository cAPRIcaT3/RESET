# Scene media

The active media lives in `blender/`: four full-frame native Blender loops and
matching posters for day/night × AC on/off. Each loop is 32 seconds, 12 fps,
1200 × 800 H.264. Both lighting passes use the same camera, scene and timeline.

`src/scene/blender-pack.ts` selects only a completed render family. Videos are
synchronized and blended for the time slider. Failed playback and reduced
motion use a matching Blender poster. No CSS scenery or photographic scene
layers are used in the active viewport.

The original `room-*.webp`, `ferry.webp` and `train.webp` files are retained as
legacy reference assets. They are not the active scene.

Revision 2 is prepared but unrendered. Its complete day/night × AC × book
family will be published to a versioned subdirectory only after native Blender
validation and visual review. See `blender/README.md` in the project root.
