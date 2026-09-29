import type { SceneState } from '../types/scene.ts';
import { extractNarration, validateNarration } from './validation.ts';
export { validateNarration } from './validation.ts';
import { describeScene } from './local.ts';
import { buildGemmaMessages, RESET_NARRATION_METADATA, RESET_PROMPT_VERSION, sceneFacts } from './prompts.ts';

export interface NarrationProvider { generate(state: SceneState, signal?: AbortSignal): Promise<string> }
export class LocalNarrationProvider implements NarrationProvider {
  async generate(state: SceneState): Promise<string> { return describeScene(state); }
}

export type GemmaProtocol = 'proxy' | 'openai';

export interface GemmaNarrationOptions {
  endpoint: string;
  model?: string;
  protocol?: GemmaProtocol;
  timeoutMs?: number;
}

const DEFAULT_GEMMA_MODEL = 'gemma4:e2b';
const DEFAULT_GEMMA_TIMEOUT_MS = 90000;
/**
 * Point this at a server-side proxy or an authenticated OpenAI-compatible
 * Gemma 4 endpoint. No provider credential belongs in this browser bundle.
 */
export class GemmaNarrationProvider implements NarrationProvider {
  private readonly options: Required<GemmaNarrationOptions>;
  constructor(endpointOrOptions: string | GemmaNarrationOptions) {
    const options = typeof endpointOrOptions === 'string' ? { endpoint: endpointOrOptions } : endpointOrOptions;
    this.options = {
      endpoint: options.endpoint,
      model: options.model ?? DEFAULT_GEMMA_MODEL,
      protocol: options.protocol ?? 'proxy',
      timeoutMs: options.timeoutMs ?? DEFAULT_GEMMA_TIMEOUT_MS,
    };
  }

  async generate(state: SceneState, signal?: AbortSignal): Promise<string> {
    const timeout = AbortSignal.timeout(this.options.timeoutMs);
    const messages = buildGemmaMessages(state);
    const facts = sceneFacts(state);
    const system = messages[0]?.content ?? '';
    const prompt = messages[1]?.content ?? '';
    const body = this.options.protocol === 'openai'
      ? {
        model: this.options.model,
        messages,
        temperature: .45,
        max_tokens: 360,
        response_format: { type: 'json_object' },
        stream: false,
      }
      : {
        model: this.options.model,
        promptVersion: RESET_PROMPT_VERSION,
        system,
        prompt,
        messages,
        facts,
        metadata: RESET_NARRATION_METADATA,
        generation: { temperature: .45, maxTokens: 360, responseFormat: 'json_object' },
      };
    const response = await fetch(this.options.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok) throw new Error(`Narration endpoint returned ${response.status}`);
    const data: unknown = await response.json();
    const text = extractNarration(data);
    validateNarration(text);
    return text;
  }
}

export class ResilientNarrationProvider implements NarrationProvider {
  private primary: NarrationProvider;
  private fallback = new LocalNarrationProvider();
  private onSource?: (source: 'gemma' | 'local') => void;
  constructor(primary: NarrationProvider, onSource?: (source: 'gemma' | 'local') => void) { this.primary = primary; this.onSource = onSource; }
  async generate(state: SceneState, signal?: AbortSignal): Promise<string> {
    try { const text = await this.primary.generate(state, signal); signal?.throwIfAborted(); this.onSource?.('gemma'); return text; }
    catch (error) { signal?.throwIfAborted(); this.onSource?.('local'); return this.fallback.generate(state); }
  }
}

export function createNarrationProvider(onSource?: (source: 'gemma' | 'local') => void): NarrationProvider {
  const endpoint = import.meta.env.VITE_GEMMA_ENDPOINT as string | undefined;
  if (!endpoint?.trim()) return new LocalNarrationProvider();
  const timeout = Number(import.meta.env.VITE_GEMMA_TIMEOUT_MS ?? '90000');
  return new ResilientNarrationProvider(new GemmaNarrationProvider({
    endpoint: endpoint.trim(),
    model: (import.meta.env.VITE_GEMMA_MODEL as string | undefined)?.trim() || DEFAULT_GEMMA_MODEL,
    protocol: import.meta.env.VITE_GEMMA_PROTOCOL === 'openai' ? 'openai' : 'proxy',
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? Math.min(timeout, 180000) : DEFAULT_GEMMA_TIMEOUT_MS,
  }), onSource);
}
