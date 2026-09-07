export const RESET_SYSTEM_PROMPT = `You write very short transportive scenes for RESET: Rendered Elsewhere, Spoken Each Time.
Write 40-90 words. Be concrete, concise, grounded, and natural when spoken aloud.
The supplied world information is inspiration, not a checklist or geography lesson.
Do not explain culture, teach the reader, provide advice, reassure, meditate, or mention RESET.
Second-person narration should be uncommon. Ordinary, funny, busy, domestic, industrial, awkward, strange, tranquil, and mildly tense moments are all valid.
Do not force a fixed sentence count, sensory checklist, cinematic opening, or poetic ending. Avoid generic atmospheric filler.
The few-shot scenes are examples of editorial quality and RANGE only. Do not imitate their syntax, structure, subjects, jokes, endings, or imagery.
Choose an exact scene time inside the requested time envelope. The prose must be compatible with that exact time, but it does not need to state the clock time.
Choose exactly one Kokoro voice: af_nicole (US-Nicole) or am_michael (US-Michael). Either voice can narrate any kind of scene; do not map gender to mood or subject.
Return JSON only with exactly these keys: scene, sceneTime, voice. sceneTime must be HH:MM in 24-hour time.`;

export function buildScenePrompt({ worldCapsule, creativePressure, sceneTime, sceneTimeEnvelope, userContext, recentAvoidances = [], voiceBalanceHint = '' }) {
  const grounding = worldCapsule.groundingDetails.map(v => `- ${v}`).join('\n');
  const ordinary = worldCapsule.ordinaryLifePossibilities.map(v => `- ${v}`).join('\n');
  const avoid = [...worldCapsule.avoidCliches, ...recentAvoidances].map(v => `- ${v}`).join('\n') || '- none';
  const pressures = creativePressure.map(v => `- ${v}`).join('\n');
  const timeInstruction = sceneTimeEnvelope
    ? `${sceneTimeEnvelope.label}: choose an exact time from ${sceneTimeEnvelope.start} through ${sceneTimeEnvelope.end}, inclusive.`
    : sceneTime
      ? `Use this exact scene time: ${sceneTime}.`
      : 'Choose any exact scene time that suits the scene.';

  const voiceGuidance = voiceBalanceHint ? `\n\nVOICE BALANCE\n${voiceBalanceHint}` : '';

  return `LISTENER CONTEXT\nLocal time: ${userContext.localTime}\nCoarse place: ${userContext.coarsePlace}\n\nSCENE WORLD\nBasis: ${worldCapsule.spatialSeed}\nBroader region: ${worldCapsule.broaderRegion}\nGrounding possibilities:\n${grounding}\nOrdinary life possibilities:\n${ordinary}\nAvoid lazy defaults:\n${avoid}\n\nSCENE-TIME ENVELOPE\n${timeInstruction}\n\nCREATIVE PRESSURE\n${pressures}${voiceGuidance}\n\nWrite one scene. Do not mechanically include every detail. Return JSON only.`;
}
