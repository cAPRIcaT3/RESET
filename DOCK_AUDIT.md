# RESET v0.4 — Dock integration audit

The six-file dock patch was directionally strong, but it was not safe to drop into v0.3 unchanged. This build integrates it into the full audio/model-ready repository and fixes the main visual/runtime issues.

## Fixed wiring issues

- The dock now receives its initial scene time + palette before mounting, preventing a one-frame midday/default flash.
- Scene changes call one atomic `dock.setScene({ minutes, theme })`; time and Canvas palette ease together instead of palette snapping before the clock transition.
- Service-worker cache was bumped to `reset-shell-v4-dock` and includes both dock modules.
- Canvas failure degrades to the existing CSS atmosphere rather than breaking RESET.
- The full v0.3 audio/Kokoro and Gemma-provider boundaries are preserved.

## Physics / continuity fixes

- Removed the abrupt sun/moon hard swap at the horizon. Sun and moon now crossfade through twilight.
- Fish visibility and reflectivity remain tied to one water-clarity driver.
- Dock-lamp reflections now begin beneath the actual lamp/deck position instead of at the distant horizon.
- Reflection intensity, stars, lamps, haze, caustics and fish all vary continuously from scene time.
- Sunrise/sunset timings are aligned with the visual palette anchors.

## Visual refinement

- New 24-hour palette curve: deep navy night, violet pre-dawn, coral/gold sunrise, clean blue day/afternoon, warm sunset, violet dusk.
- Three perspective dock lamps with warm night bloom and moving reflection smears.
- Daylight fish movement, caustics and water chop remain visible without dominating the prose.
- Text has a subtle radial reading scrim rather than a card.
- Scene typography scales down automatically for 62+ and 78+ word scenes.
- PWA browser theme color follows the generated scene palette.

## Performance work

- 30fps target on phone-size viewports; 45fps on larger displays instead of permanent 60fps.
- DPR capped at 1.65 on small screens and 2 elsewhere.
- Reflection/caustic/chop sample counts are reduced on phones.
- Rendering stops when the document is hidden.
- Reduced-motion users get a static scene-time-correct frame.
- Star animation reuses the frame timestamp instead of repeatedly calling `performance.now()` inside the star loop.
- Removed the time-dependent offscreen pier cache; the pier geometry is cheap enough to draw directly and this avoids hundreds of cache rebuilds during large time-of-day transitions.

## Tests

Added `test/dockDrivers.test.js` covering:

- clock wrapping
- sunrise/sunset continuity
- day/night fish-reflection coupling
- lamp/star behavior
- sun/moon twilight crossfade
- shortest-path clock interpolation across midnight

The dock tests and browser-module syntax checks pass in the audit environment. Full server integration tests require a complete local dependency install (`npm install`) because Express is not bundled into this source ZIP.
