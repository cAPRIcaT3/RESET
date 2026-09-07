import { applyTheme, localMinutes, themeForTime } from './themeEngine.js';
import { createDockBackdrop } from './dockBackdrop.js';

const app = document.getElementById('app');
const dockCanvas = document.getElementById('dockCanvas');
const entries = document.getElementById('journalEntries');
const summary = document.getElementById('journalSummary');
const empty = document.getElementById('journalEmpty');

const minutes = localMinutes();
const theme = themeForTime(minutes, 'journal');
applyTheme(app, theme);
const dock = createDockBackdrop(dockCanvas, { initialMinutes: minutes, initialTheme: theme });
if (dock) requestAnimationFrame(() => { app.dataset.dock = 'ready'; });
window.addEventListener('pagehide', () => dock?.destroy(), { once: true });

loadJournal().catch(error => {
  console.error(error);
  summary.textContent = 'The journal could not be reached.';
  empty.hidden = false;
});

async function loadJournal() {
  const response = await fetch(new URL('./generated/journal.json', document.baseURI), { cache: 'no-store' });
  if (!response.ok) {
    if (response.status === 404) {
      summary.textContent = 'No entries yet.';
      empty.hidden = false;
      return;
    }
    throw new Error(`Journal request failed (${response.status})`);
  }
  const journal = await response.json();
  const days = Array.isArray(journal?.days) ? journal.days : [];
  const count = Number(journal?.count || days.reduce((n, day) => n + (day.scenes?.length || 0), 0));
  summary.textContent = count ? `${count} ${count === 1 ? 'RESET' : 'RESETs'} across ${days.length} ${days.length === 1 ? 'day' : 'days'}.` : 'No entries yet.';
  if (!days.length) {
    empty.hidden = false;
    return;
  }
  entries.replaceChildren(...days.map(renderDay));
}

function renderDay(day) {
  const section = document.createElement('section');
  section.className = 'journal-day';

  const heading = document.createElement('h2');
  heading.className = 'journal-date';
  heading.textContent = formatDate(day.date);
  section.appendChild(heading);

  const list = document.createElement('div');
  list.className = 'journal-day__scenes';
  for (const item of day.scenes || []) list.appendChild(renderScene(item));
  section.appendChild(list);
  return section;
}

function renderScene(item) {
  const article = document.createElement('article');
  article.className = 'journal-entry';

  const meta = document.createElement('div');
  meta.className = 'journal-entry__meta';
  const time = document.createElement('span');
  time.textContent = item.sceneTime || '—';
  const voice = document.createElement('span');
  voice.textContent = voiceLabel(item.voice);
  meta.append(time, voice);

  const text = document.createElement('p');
  text.className = 'journal-entry__scene';
  text.textContent = item.scene || '';

  article.append(meta, text);
  return article;
}

function formatDate(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function voiceLabel(voice) {
  if (String(voice).toLowerCase() === 'af_nicole') return 'Nicole';
  if (String(voice).toLowerCase() === 'am_michael') return 'Michael';
  return String(voice || '').replace(/^a[fm]_/, '');
}
