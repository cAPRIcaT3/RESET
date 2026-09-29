import test from 'node:test';
import assert from 'node:assert/strict';
import { generateScene } from '../src/scene/generate.ts';
import { GemmaNarrationProvider, LocalNarrationProvider, ResilientNarrationProvider } from '../src/narration/providers.ts';
import { buildGemmaMessages, buildNarrationPrompt, RESET_NARRATION_METADATA, RESET_PROMPT_VERSION, sceneFacts } from '../src/narration/prompts.ts';

const state = generateScene('provider-test', new Date(2026, 8, 19, 20).getTime());

test('a failing optional provider falls back to the complete local observation', async () => {
  const provider = new ResilientNarrationProvider({ generate: async () => { throw new Error('Offline'); } });
  assert.equal(await provider.generate(state), state.narration);
  assert.equal(await new LocalNarrationProvider().generate(state), state.narration);
});

test('Gemma adapter accepts valid text and rejects malformed or excessive responses', async context => {
  const provider = new GemmaNarrationProvider('https://example.invalid/narration');
  const fetchMock = context.mock.method(globalThis, 'fetch', async () => Response.json({ narration: state.narration }));
  assert.equal(await provider.generate(state), state.narration);
  fetchMock.mock.mockImplementation(async () => Response.json({ narration: 'Too short.' }));
  await assert.rejects(provider.generate(state), /(?:65–130 words|3–6 sentences)/);
  fetchMock.mock.mockImplementation(async () => Response.json({ narration: 'word '.repeat(90) }));
  await assert.rejects(provider.generate(state), /(?:65–130 words|3–6 sentences)/);
  fetchMock.mock.mockImplementation(async () => Response.json({ error: 'invalid' }));
  await assert.rejects(provider.generate(state), /Invalid narration/);
  fetchMock.mock.mockImplementation(async () => new Response('', { status: 503 }));
  await assert.rejects(provider.generate(state), /503/);
});

test('Gemma adapter sends the bounded Kelna RESET contract', async context => {
  let request: RequestInit | undefined;
  const fetchMock = context.mock.method(globalThis, 'fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
    request = init;
    return Response.json({ narration: state.narration });
  });
  const provider = new GemmaNarrationProvider({ endpoint: 'https://example.invalid/narration', model: 'gemma-4-E2B-it' });
  await provider.generate(state);
  const payload = JSON.parse(String(request?.body)) as Record<string, unknown>;
  assert.equal(payload.model, 'gemma-4-E2B-it');
  assert.equal(payload.promptVersion, RESET_PROMPT_VERSION);
  assert.deepEqual(payload.metadata, RESET_NARRATION_METADATA);
  assert.deepEqual(payload.generation, { temperature: .45, maxTokens: 360, responseFormat: 'json_object' });
  assert.equal('state' in payload, false);
  assert.equal(JSON.stringify(payload).includes(state.id), false);
  assert.match(String(payload.system), /Treat every other detail as unknown/);
  assert.match(String(payload.prompt), /lived-in study-bedroom/);
  assert.match(String(payload.prompt), /sensory/);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('Gemma adapter accepts an OpenAI-compatible JSON response and blocks visitor address', async context => {
  const provider = new GemmaNarrationProvider({ endpoint: 'https://example.invalid/v1/chat/completions', protocol: 'openai' });
  const fetchMock = context.mock.method(globalThis, 'fetch', async () => Response.json({
    choices: [{ message: { content: JSON.stringify({ narration: state.narration }) } }],
  }));
  assert.equal(await provider.generate(state), state.narration);
  fetchMock.mock.mockImplementation(async () => Response.json({ narration: `${state.narration} You can stay here.` }));
  await assert.rejects(provider.generate(state), /disallowed address/);
});

test('Kelna RESET prompt includes facts rather than identity or continuity state', () => {
  const prompt = buildNarrationPrompt(state);
  const systemPrompt = buildGemmaMessages(state)[0]?.content ?? '';
  const facts = sceneFacts(state);
  assert.match(systemPrompt, /FEW-SHOT EXAMPLES/);
  assert.match(systemPrompt, /longer journal cadence/);
  assert.match(prompt, /"timeOfDay"/);
  assert.match(prompt, /"outside"/);
  assert.match(facts.room.description, /high-rise apartment room/);
  assert.equal(facts.room.lighting.deskLamp, state.room.deskLamp);
  assert.equal(facts.room.conditions.airConditioner, state.room.airConditioner);
  assert.equal(facts.outside.humidity, state.exterior.humidity);
  assert.ok(facts.sensory.soundCues.includes('distant city hum'));
  assert.equal(prompt.includes(state.id), false);
  assert.equal(prompt.includes(state.seed), false);
});

test('cancelled narration never turns into a successful fallback', async () => {
  const controller = new AbortController();
  controller.abort();
  const provider = new ResilientNarrationProvider({generate:async()=>{throw new Error('cancelled');}});
  await assert.rejects(provider.generate(state,controller.signal),{name:'AbortError'});
});
