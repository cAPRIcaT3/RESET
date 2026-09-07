import { createApp } from './appFactory.js';
import { KokoroClient } from './voice/kokoroClient.js';

const PORT = Number(process.env.PORT || 3000);
const kokoro = new KokoroClient();
const app = createApp({ kokoroClient: kokoro });

const server = app.listen(PORT, () => {
  console.log(`RESET listening on http://localhost:${PORT}`);
  console.log(`PID: ${process.pid}`);
  console.log(`Scene provider: ${process.env.RESET_SCENE_PROVIDER || 'fixture'}`);
  console.log(`TTS provider: ${kokoro.isEnabled() ? `kokoro (${kokoro.mode}) [US-Nicole, US-Michael]` : 'browser fallback'}`);

  if (kokoro.mode === 'local' && process.env.RESET_TTS_WARMUP !== '0') {
    console.log('Kokoro: warming local model in the background…');
    void kokoro.warmup()
      .then(() => console.log('Kokoro: ready.'))
      .catch(error => console.error('Kokoro warmup failed; browser speech will be used as fallback:', error));
  }
});

server.on('error', error => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Another RESET/Node process is probably still running.`);
    console.error(`Windows CMD: netstat -ano | findstr :${PORT}`);
    console.error('Then stop the PID with: taskkill /PID <PID> /F');
    process.exitCode = 1;
    return;
  }
  throw error;
});
