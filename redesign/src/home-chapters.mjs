import {mountOrganization} from './org-wires.mjs';
import {mountLabWorkbench} from './lab-workbench.mjs';
import {mountAwardArchive} from './award-archive.mjs';

function mountRuler(figure) {
  const select = figure.querySelector('[data-ruler-select]');
  const row = select.closest('.cut-row');
  const offsets = JSON.parse(figure.dataset.cuts);
  const bytes = Number(figure.dataset.bytes);
  select.addEventListener('change', () => {
    const segments = offsets[Number(select.value)];
    const boundaries = segments.slice(1).map(offset => {
      const mark = document.createElement('i');
      mark.style.left = `${100 * offset / bytes}%`;
      mark.textContent = '|';
      return mark;
    });
    row.querySelector('.cut-track').replaceChildren(...boundaries);
    row.toggleAttribute('data-updated', false);
    requestAnimationFrame(() => row.toggleAttribute('data-updated', true));
    row.querySelector('output').textContent = String(segments.length);
  });
}

function mountDirections(switchboard) {
  const links = [...switchboard.querySelectorAll('[data-direction]')];
  const panels = [...switchboard.querySelectorAll('[data-topic]')];
  function choose(id) {
    const selected = links.find(link => link.dataset.direction === id);
    if (!selected) return;
    links.forEach(link => {
      if (link === selected) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    panels.forEach(panel => { panel.hidden = panel.id !== id; });
    const box = selected.getBoundingClientRect();
    const board = switchboard.getBoundingClientRect();
    switchboard.style.setProperty('--port-y', `${box.top - board.top + box.height / 2}px`);
  }
  function fromHash() {
    const value = location.hash.slice(1);
    choose(links.some(link => link.dataset.direction === value) ? value : links[0].dataset.direction);
  }
  function activate(link) {
    choose(link.dataset.direction);
    if (link.hash !== location.hash) history.pushState(history.state, '', link.hash);
  }
  for (const [index, link] of links.entries()) {
    link.setAttribute('aria-controls', link.dataset.direction);
    link.addEventListener('click', event => {
      if (event.button || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      activate(link);
    });
    link.addEventListener('keydown', event => {
      const destinations = { ArrowUp: (index + links.length - 1) % links.length, ArrowDown: (index + 1) % links.length, Home: 0, End: links.length - 1 };
      if (Object.hasOwn(destinations, event.key)) {
        event.preventDefault();
        const destination = links[destinations[event.key]];
        destination.focus({ preventScroll: true });
        activate(destination);
      }
    });
  }
  switchboard.dataset.ready = 'true';
  fromHash();
  addEventListener('popstate', fromHash);
  addEventListener('hashchange', fromHash);
  new ResizeObserver(() => {
    const current = links.find(link => link.hasAttribute('aria-current'));
    if (current) choose(current.dataset.direction);
  }).observe(switchboard);
}

export function mountTopicControls(main) {
  mountLabWorkbench(main);
  mountOrganization(main);
  mountAwardArchive(main);
  const ruler = main.querySelector('.cut-figure');
  const directions = main.querySelector('.topic-switch');
  if (ruler) mountRuler(ruler);
  if (directions) mountDirections(directions);
  const objects = [...main.querySelectorAll('[data-pick-object]')];
  for (const item of objects) {
    const owner=item.closest('.story-screen');
    const index=[...(owner || main).querySelectorAll('[data-pick-object]')].indexOf(item);
    const button = item.querySelector('.object-control');
    if (!button) continue;
    if (!item.id) item.id = `${owner ? owner.id+'-' : ''}item-${index + 1}`;
    const apply = () => {
      const selected = location.hash === '#' + item.id;
      item.toggleAttribute('data-object-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    };
    button.addEventListener('click', () => {
      if (location.hash !== '#' + item.id) history.pushState(history.state,'','#' + item.id);
      main.dispatchEvent(new Event('objectselection'));
    });
    main.addEventListener('objectselection', apply);
    addEventListener('popstate', apply);
    addEventListener('hashchange', apply);
    apply();
  }
}