import {mountSiteCursor} from './site-cursor.mjs';
import { mountScrollStory } from './scroll-story.mjs';
import { mountPageScene } from './page-scene.mjs';
import { mountTravel } from './travel.mjs';
import { mountField } from './field.mjs';
import { mountSiteHeader } from './home-nav.mjs';
import { mountTopicControls } from './home-chapters.mjs';

const lang = document.documentElement.lang === 'en' ? 'en' : 'zh';
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const subscribers = new Set();
const key = name => `alethic.${name}`;
const store = (name, value) => { try { localStorage.setItem(key(name),value); } catch {} };
const still = () => reduce.matches;
const themeToggle = document.querySelector('[data-theme-toggle]');
const motionChange = observer => subscribers.add(observer);
function motionState() {
  document.documentElement.dataset.motion = still() ? 'still' : 'play';
  for(const update of subscribers)update();
}
reduce.addEventListener('change',motionState);
motionState();
if (themeToggle) {
  const systemToggle = document.querySelector('[data-theme-system]');
  const colorScheme = matchMedia('(prefers-color-scheme: dark)');
  function readTheme() {
    try {
      const saved = localStorage.getItem(key('theme')) || localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
  }
  let preference = readTheme();
  function updateTheme() {
    const dark = preference ? preference === 'dark' : colorScheme.matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    themeToggle.setAttribute('aria-pressed', String(dark));
    systemToggle?.setAttribute('aria-pressed', String(!preference));
  }
  themeToggle.addEventListener('click', () => {
    preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    store('theme', preference);
    updateTheme();
  });
  systemToggle?.addEventListener('click', () => {
    preference = undefined;
    try {
      localStorage.removeItem(key('theme'));
      localStorage.removeItem('theme');
    } catch {}
    updateTheme();
  });
  colorScheme.addEventListener('change', updateTheme);
  addEventListener('storage', event => {
    if (event.key !== null && event.key !== key('theme') && event.key !== 'theme') return;
    preference = readTheme();
    updateTheme();
  });
  themeToggle.hidden = false;
  if (systemToggle) systemToggle.hidden = false;
  updateTheme();
}

const language = document.querySelector('[data-language]');
if (language) {
  const destination = new URL(language.href);
  function updateLanguageUrl() {
    destination.search = location.search;
    // The explicit Chinese URL also works in a new tab without changing storage first.
    if (language.dataset.language === 'zh') destination.searchParams.set('lang', 'zh');
    else if (destination.searchParams.get('lang') === 'zh') destination.searchParams.delete('lang');
    const screen = document.querySelector('.story-screen[data-current-scene]');
    let target;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch {}
    if (screen) {
      const direction = screen.id === 'work' ? screen.querySelector('[data-direction][aria-current]') : null;
      destination.hash = screen.contains(target) ? location.hash : direction?.hash || screen.id;
    } else {
      destination.hash = location.hash;
    }
    language.href = destination.href;
  }
  for (const event of ['popstate', 'hashchange', 'pageshow', 'alethic:chapter', 'objectselection']) {
    addEventListener(event, updateLanguageUrl, { capture: true });
  }
  const refreshAfterDirection = event => {
    if (event.target.closest?.('[data-direction]')) updateLanguageUrl();
  };
  document.addEventListener('click', refreshAfterDirection);
  document.addEventListener('keydown', refreshAfterDirection);
  updateLanguageUrl();
  language.addEventListener('click', event => {
    updateLanguageUrl();
    if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      store('lang', language.dataset.language);
    }
  });
}
const main = document.querySelector('main');
if (main.dataset.page === 'index.html') {
  mountTopicControls(main);
  mountSiteHeader(main,{still,motionChange});
  mountField({still,motionChange});
  mountPageScene(main,{still,motionChange});
  mountScrollStory(main);
} else {
  mountTopicControls(main);
  mountSiteHeader(main,{still,motionChange});
  mountPageScene(main,{still,motionChange});
}
mountTravel({ still, motionChange });
mountSiteCursor();
if (main.dataset.page.startsWith('flued')) import('./flued-ui.mjs').then(({ mountFlued }) => mountFlued(lang));

const drawingObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.dataset.drawn = 'true';
    drawingObserver.unobserve(entry.target);
  }
}, { threshold: 0.35 });
for (const drawing of document.querySelectorAll('[data-drawing]')) drawingObserver.observe(drawing);
