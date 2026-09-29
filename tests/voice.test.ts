import test from 'node:test';
import assert from 'node:assert/strict';
import { KokoroVoiceProvider } from '../src/voice/providers.ts';

test('Kokoro adapter sends OpenAI-compatible input plus legacy text', async context => {
  let request: RequestInit | undefined;
  const fetchMock = context.mock.method(globalThis, 'fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
    request = init;
    return Response.json({ error: 'test response without audio' });
  });
  const provider = new KokoroVoiceProvider({
    endpoint: 'https://example.invalid/v1/audio/speech',
    model: 'kokoro',
    voice: 'af_heart',
    responseFormat: 'mp3',
    speed: 0.94,
  });
  await assert.rejects(provider.speak('A quiet room by the water.'), /invalid audio/);
  const payload = JSON.parse(String(request?.body)) as Record<string, unknown>;
  assert.equal(payload.model, 'kokoro');
  assert.equal(payload.input, 'A quiet room by the water.');
  assert.equal(payload.text, payload.input);
  assert.equal(payload.voice, 'af_heart');
  assert.equal(payload.response_format, 'mp3');
  assert.equal(payload.speed, 0.94);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('Kokoro adapter rejects non-audio responses before playback', async context => {
  context.mock.method(globalThis, 'fetch', async () => new Response('not audio', { headers: { 'Content-Type': 'text/plain' } }));
  await assert.rejects(new KokoroVoiceProvider('https://example.invalid/voice').speak('Hello.'), /did not return audio/);
});

test('Kokoro playback errors reject instead of resolving through stop()', async context => {
  class FailingAudio {
    static current?: FailingAudio;
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    preload = '';
    constructor(_source: string) { FailingAudio.current = this; }
    pause(): void {}
    play(): Promise<void> { queueMicrotask(() => this.onerror?.()); return Promise.resolve(); }
  }
  const previousAudio = globalThis.Audio;
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: FailingAudio });
  context.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'audio/mpeg' } }));
  try {
    await assert.rejects(new KokoroVoiceProvider('https://example.invalid/voice').speak('A quiet room by the water.'), /playback failed/);
    assert.ok(FailingAudio.current);
  } finally {
    Object.defineProperty(globalThis, 'Audio', { configurable: true, value: previousAudio });
  }
});

test('stopping an in-flight voice settles it and a late response cannot replace new playback', async context => {
  class FakeAudio {
    static sources:string[]=[];
    onended:(()=>void)|null=null;
    onerror:(()=>void)|null=null;
    preload='';
    constructor(source:string){FakeAudio.sources.push(source);}
    pause(){}
    play(){return Promise.resolve();}
  }
  const previous=globalThis.Audio;
  Object.defineProperty(globalThis,'Audio',{configurable:true,value:FakeAudio});
  let release!:(response:Response)=>void;
  context.mock.method(globalThis,'fetch',()=>new Promise<Response>(resolve=>{release=resolve;}));
  try {
    const provider=new KokoroVoiceProvider('https://example.invalid/voice');
    const old=provider.speak('An old scene.');
    provider.stop();
    await old;
    const current=provider.playUrl('https://example.com/current.mp3');
    release(new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'audio/mpeg'}}));
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.deepEqual(FakeAudio.sources,['https://example.com/current.mp3']);
    provider.stop();await current;
  } finally {Object.defineProperty(globalThis,'Audio',{configurable:true,value:previous});}
});

test('pause while audio loads prevents automatic playback until resumed', async context => {
  let plays=0;
  class FakeAudio {
    onended:(()=>void)|null=null;onerror:(()=>void)|null=null;preload='';
    pause(){} play(){plays++;return Promise.resolve();}
  }
  const previous=globalThis.Audio;
  Object.defineProperty(globalThis,'Audio',{configurable:true,value:FakeAudio});
  context.mock.method(globalThis,'fetch',async()=>new Response(new Uint8Array([1]),{headers:{'Content-Type':'audio/mpeg'}}));
  try {
    const provider=new KokoroVoiceProvider('https://example.invalid/voice');
    const playing=provider.speak('A scene.');provider.pause();
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(plays,0);provider.resume();assert.equal(plays,1);
    provider.stop();await playing;
  } finally {Object.defineProperty(globalThis,'Audio',{configurable:true,value:previous});}
});
