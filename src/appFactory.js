import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { WorldCapsuleStore } from './world/worldCapsuleStore.js';
import { createCreativePressure } from './variation/creativePressure.js';
import { RecentHistory } from './variation/recentHistory.js';
import { SceneGenerator } from './generation/sceneGenerator.js';
import { KokoroClient } from './voice/kokoroClient.js';
import { canonicalVoiceId } from './voice/voiceRouter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '..', 'public');

export function createApp({ random = Math.random, now = () => new Date(), coarsePlace = 'unknown', kokoroClient } = {}) {
  const app = express();
  const history = new RecentHistory();
  const capsules = new WorldCapsuleStore(undefined, random);
  const generator = new SceneGenerator({ history, random });
  const kokoro = kokoroClient || new KokoroClient();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.use(express.static(publicDir, { etag: true, maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));

  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      sceneProvider: process.env.RESET_SCENE_PROVIDER || 'fixture',
      ttsProvider: kokoro.isEnabled() ? 'kokoro' : 'browser',
      ttsMode: kokoro.mode,
      ttsStatus: typeof kokoro.status === 'function' ? kokoro.status() : null,
      voices: ['US-Nicole', 'US-Michael']
    });
  });

  app.get('/api/reset', async (req, res) => {
    try {
      const current = now();
      const userContext = {
        localTime: current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        coarsePlace: String(req.query.place || coarsePlace).slice(0, 120)
      };
      const creativePressure = createCreativePressure(random);
      const requestedSceneTime = randomSceneClock(random);
      const recentAvoidances = history.antiRepetitionSummary();

      let result = null;
      let selectedWorldCapsule = null;
      let lastError;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const candidateWorldCapsule = capsules.pick();
          const candidate = await generator.generate({
            worldCapsule: candidateWorldCapsule,
            creativePressure,
            sceneTime: requestedSceneTime,
            userContext,
            recentAvoidances
          });
          // The finite fixture deck is only a UI/development fallback and is allowed to recycle.
          // Real model mode rejects exact duplicates across the full in-memory history window.
          if (generator.providerKind !== 'fixture' && history.hasExactText(candidate.scene, history.limit)) {
            throw new Error('Exact duplicate rejected');
          }
          result = { ...candidate, generationAttempts: attempt };
          selectedWorldCapsule = candidateWorldCapsule;
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!result || !selectedWorldCapsule) throw lastError || new Error('Scene generation failed');

      const session = {
        ...result,
        worldCapsuleId: selectedWorldCapsule.id,
        createdAt: current.toISOString()
      };
      history.add(session);

      res.set('cache-control', 'no-store');
      res.json({
        scene: result.scene,
        voice: result.voice,
        sceneTime: result.sceneTime,
        sceneTimeMinutes: result.sceneTimeMinutes,
        sceneTimeBand: result.sceneTimeBand,
        generationAttempts: result.generationAttempts
      });
    } catch (error) {
      console.error('RESET generation error:', error);
      res.status(500).json({ error: 'RESET could not generate a scene' });
    }
  });

  app.post('/api/tts', async (req, res) => {
    if (!kokoro.isEnabled()) return res.status(204).end();
    try {
      const { text, voice } = req.body || {};
      const targetVoice = canonicalVoiceId(voice);
      if (!text || !targetVoice) {
        return res.status(400).json({ error: 'Invalid TTS request. Supported voices: US-Nicole (af_nicole), US-Michael (am_michael)' });
      }
      const audio = await kokoro.synthesize({ text: String(text).slice(0, 2000), voice: targetVoice });
      res.set('cache-control', 'no-store');
      res.set('x-reset-tts', `${kokoro.mode}:${targetVoice}`);
      res.type(audio.mimeType || 'audio/wav').send(audio.buffer || audio);
    } catch (error) {
      console.error('Kokoro synthesis error:', error);
      res.status(502).json({ error: 'Speech synthesis failed' });
    }
  });

  app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
  return app;
}

function randomSceneClock(random) {
  const minute = Math.floor(random() * 24 * 60);
  const hour = Math.floor(minute / 60);
  const mins = minute % 60;
  return `${String(hour).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
