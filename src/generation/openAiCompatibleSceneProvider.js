import { RESET_SYSTEM_PROMPT, buildScenePrompt } from './promptBuilder.js';
import { selectFewShotMessages } from './fewShotExamples.js';

/**
 * Small-model adapter for Gemma 3 4B (or another local instruct model) served through
 * an OpenAI-compatible /v1/chat/completions endpoint. GitHub Actions uses Ollama by default.
 */
export class OpenAiCompatibleSceneProvider {
  kind = 'model';

  constructor({
    baseUrl = process.env.RESET_MODEL_URL,
    model = process.env.RESET_MODEL_NAME || 'gemma3:4b',
    apiKey = process.env.RESET_MODEL_API_KEY || 'local',
    timeoutMs = Number(process.env.RESET_MODEL_TIMEOUT_MS || 120000),
    random = Math.random,
    fewShotCount = Number(process.env.RESET_FEW_SHOT_COUNT || 4)
  } = {}) {
    this.baseUrl = baseUrl?.replace(/\/$/, '');
    this.model = model;
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.random = random;
    this.fewShotCount = fewShotCount;
  }

  isConfigured() {
    return Boolean(this.baseUrl);
  }

  async generate(input) {
    if (!this.isConfigured()) throw new Error('RESET_MODEL_URL is not configured');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const fewShots = selectFewShotMessages({
        random: this.random,
        count: this.fewShotCount,
        excludeCapsuleId: input.worldCapsule?.id
      });
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          temperature: Number(process.env.RESET_MODEL_TEMPERATURE || 1.05),
          top_p: Number(process.env.RESET_MODEL_TOP_P || 0.92),
          max_tokens: Number(process.env.RESET_MODEL_MAX_TOKENS || 220),
          messages: [
            { role: 'system', content: RESET_SYSTEM_PROMPT },
            ...fewShots,
            { role: 'user', content: buildScenePrompt(input) }
          ]
        })
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Model request failed with ${response.status}${detail ? `: ${detail.slice(0, 500)}` : ''}`);
      }
      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Model returned no content');
      return parseModelJson(content);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function parseModelJson(content) {
  const raw = String(content).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(raw);
  return {
    scene: parsed.scene,
    requestedVoice: parsed.voice,
    sceneTime: parsed.sceneTime
  };
}
