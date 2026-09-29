import { createRoot } from 'react-dom/client';
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-400-italic.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import { KelnaReset } from './app/KelnaReset.tsx';
import './styles/tokens.css';
import './styles/global.css';
import './styles/scene.css';

createRoot(document.getElementById('root')!).render(<KelnaReset />);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Installation is optional; a failed registration never blocks the window.
    });
  });
}
