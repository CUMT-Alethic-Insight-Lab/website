function mountAccount(link) {
  const loginLabel = link.textContent;
  const sessionKeys = ['alethic_admin_token', 'alethic_session'];
  let pending;

  function display(authenticated) {
    link.href = authenticated ? link.dataset.accountHref : '/login';
    link.textContent = authenticated ? link.dataset.accountLabel : loginLabel;
    link.dataset.siteSession = authenticated ? 'authenticated' : 'anonymous';
  }

  async function check() {
    pending?.abort();
    const request = new AbortController();
    pending = request;
    const timeout = setTimeout(() => request.abort(), 3500);
    const headers = { Accept: 'application/json' };
    try {
      const token = sessionKeys.map(key => localStorage.getItem(key)).find(Boolean);
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {
      // Cookie-backed sessions can still be checked when storage is unavailable.
    }
    let authenticated = false;
    try {
      const response = await fetch('/recruitment/api/auth/me', {
        credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers, signal: request.signal,
      });
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        const profile = await response.json();
        const id = profile?.student_id;
        authenticated = (typeof id === 'string' && id.trim() !== '') || Number.isSafeInteger(id);
      }
    } catch {
      // The public login link remains available if the session cannot be verified.
    } finally {
      clearTimeout(timeout);
      if (pending === request) {
        pending = undefined;
        display(authenticated);
      }
    }
  }

  display(false);
  check();
  addEventListener('pageshow', event => { if (event.persisted) check(); });
  addEventListener('storage', event => {
    if (event.key === null || sessionKeys.includes(event.key)) {
      display(false);
      check();
    }
  });
}

function mountChapterHighlight(header, main) {
  const links = [...header.querySelectorAll('[data-site-chapter]')];
  const bySection = new Map(links.map(link => [link.dataset.siteChapter, link]));
  const byFile = new Map(links.map(link => [link.dataset.sitePage, link]));
  const current = header.querySelector('[data-site-current]');
  let active;
  let activeGroup;

  function show({ file, section } = {}) {
    const sectionId = typeof section === 'string' ? section.replace(/^#/, '') : '';
    const next = bySection.get(sectionId) || byFile.get(file);
    if (next === active) return;
    active?.removeAttribute('aria-current');
    active = next;
    active?.setAttribute('aria-current', 'location');
    const group = active?.closest('[data-site-group]');
    if (group !== activeGroup) {
      activeGroup?.removeAttribute('data-current');
      group?.setAttribute('data-current', '');
      activeGroup = group;
    }
    if (current) {
      const label = active?.textContent.trim() || '';
      current.textContent = label;
      current.title = label;
      current.hidden = !label;
    }
  }

  addEventListener('alethic:chapter', event => show(event.detail || {}), { capture: true });
  new MutationObserver(() => show({ file: main.dataset.activePage }))
    .observe(main, { attributeFilter: ['data-active-page'] });
  show({ file: main.dataset.activePage, section: location.hash });
}

const hoverPointer = matchMedia('(any-hover: hover) and (any-pointer: fine)');
const hoverOpenDelay = 150;
const hoverCloseDelay = 270;
const canHover = event => hoverPointer.matches && event.pointerType === 'mouse' && event.buttons === 0;
const isMoving = panel => panel.getAnimations().some(animation => animation.playState === 'running');

function mountPreferences() {
  const preferences = document.querySelector('[data-site-preferences]');
  if (!preferences) return;
  const handle = preferences.querySelector('summary');
  const panel = preferences.querySelector('.site-preferences-panel');
  function setOpen(open) {
    panel.inert = !open;
    preferences.open = open;
  }
  const opening = document.querySelector('.opening');
  const dock = matchMedia('(min-width: 1100px)');
  let hoverTimer;
  let preview = false;

  function close(restoreFocus = false) {
    clearTimeout(hoverTimer);
    preview = false;
    if (!preferences.open) return;
    if (restoreFocus || preferences.contains(document.activeElement)) handle.focus({ preventScroll: true });
    setOpen(false);
  }

  if (opening) {
    const reveal = () => {
      const box = opening.getBoundingClientRect();
      // Leave the fullscreen opener alone. The handle comes in with the reading area.
      const offstage = box.bottom > box.height * .06;
      if (dock.matches && offstage) {
        if (preferences.contains(document.activeElement)) opening.querySelector('a').focus({ preventScroll: true });
        close();
      }
      preferences.toggleAttribute('data-preferences-offstage', offstage);
    };
    reveal();
    new IntersectionObserver(reveal, { threshold: [0, .06] }).observe(opening);
    dock.addEventListener('change', reveal);
    addEventListener('pageshow', reveal);
  }

  preferences.addEventListener('pointerenter', event => {
    if (!dock.matches || !canHover(event)) return;
    clearTimeout(hoverTimer);
    if (preferences.open || preferences.hasAttribute('data-preferences-offstage')) return;
    const enter = () => {
      preview = true;
      setOpen(true);
    };
    if (isMoving(panel)) enter();
    else hoverTimer = setTimeout(enter, hoverOpenDelay);
  });
  preferences.addEventListener('pointerleave', event => {
    if (!canHover(event)) return;
    clearTimeout(hoverTimer);
    if (preview) hoverTimer = setTimeout(() => {
      if (!preferences.contains(document.activeElement)) close();
    }, hoverCloseDelay);
  });
  handle.addEventListener('click', event => {
    clearTimeout(hoverTimer);
    event.preventDefault();
    if (preview) {
      // The first explicit activation keeps a hover preview open.
      preview = false;
    } else if (preferences.open) close();
    else setOpen(true);
  });
  for (const query of [dock, hoverPointer]) query.addEventListener('change', () => {
    clearTimeout(hoverTimer);
    if (preview) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    clearTimeout(hoverTimer);
    if (!preferences.open) return;
    event.preventDefault();
    close(!preview || preferences.contains(document.activeElement));
  });
  document.addEventListener('click', event => {
    if (!preferences.contains(event.target)) close();
  });
  preferences.addEventListener('focusout', event => {
    if (event.relatedTarget && !preferences.contains(event.relatedTarget)) close();
  });
  panel.inert = !preferences.open;
  preferences.dataset.ready = '';
}

export function mountSiteHeader(main, _motion) {
  const header = document.querySelector('[data-site-header]');
  if (!header || header.hasAttribute('data-ready')) return;

  const menu = header.querySelector('[data-site-main-menu]');
  const toggle = menu.querySelector('[data-site-nav-toggle]');
  const content = document.getElementById(toggle.getAttribute('aria-controls'));
  const narrow = matchMedia('(max-width: 1023px)');
  const groups = [...header.querySelectorAll('[data-site-disclosure]')].map(trigger => ({
    trigger,
    container: trigger.parentElement,
    panel: document.getElementById(trigger.getAttribute('aria-controls')),
  }));
  let active;
  let menuOpen = false;
  let menuScrollY = 0;
  let preview = false;
  let hoverTimer;

  function closeGroup(restore = false) {
    clearTimeout(hoverTimer);
    preview = false;
    if (!active) return;
    const { trigger, panel } = active;
    active = undefined;
    if (restore || panel.contains(document.activeElement)) trigger.focus({ preventScroll: true });
    trigger.setAttribute('aria-expanded', 'false');
    panel.inert = true;
    panel.hidden = true;
  }

  function setMenu(open) {
    if (!open) {
      closeGroup();
      if (narrow.matches && content.contains(document.activeElement)) toggle.focus({ preventScroll: true });
    }
    if (open && !menuOpen) menuScrollY = scrollY;
    menuOpen = open;
    toggle.setAttribute('aria-expanded', String(open));
    content.inert = content.hidden = narrow.matches && !open;
  }

  function openGroup(group, onHover = false) {
    clearTimeout(hoverTimer);
    if (active !== group) {
      closeGroup();
      if (!onHover) group.trigger.focus({ preventScroll: true });
      group.trigger.setAttribute('aria-expanded', 'true');
      group.panel.inert = group.panel.hidden = false;
      active = group;
    }
    preview = onHover;
  }

  for (const [index, group] of groups.entries()) {
    const { trigger, container, panel } = group;
    panel.inert = panel.hidden = true;
    panel.setAttribute('aria-labelledby', trigger.id);
    container.querySelector('.site-nav-fallback').hidden = true;
    trigger.hidden = false;
    container.addEventListener('pointerenter', event => {
      if (narrow.matches || !canHover(event)) return;
      clearTimeout(hoverTimer);
      if (active === group || (active && (!preview || active.panel.contains(document.activeElement)))) return;
      if (isMoving(panel)) openGroup(group, true);
      else hoverTimer = setTimeout(() => openGroup(group, true), hoverOpenDelay);
    });
    container.addEventListener('pointerleave', event => {
      if (narrow.matches || !canHover(event)) return;
      clearTimeout(hoverTimer);
      if (!preview || active !== group) return;
      hoverTimer = setTimeout(() => {
        if (!container.contains(document.activeElement)) closeGroup();
      }, hoverCloseDelay);
    });
    trigger.addEventListener('click', () => {
      if (active === group && !preview) closeGroup(true);
      else openGroup(group);
    });
    trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        openGroup(group);
        const links = [...panel.querySelectorAll('a[href]')];
        links.at(event.key === 'ArrowDown' ? 0 : -1)?.focus();
        return;
      }
      if (narrow.matches || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const step = event.key === 'ArrowRight' ? 1 : -1;
      groups[(index + step + groups.length) % groups.length].trigger.focus();
    });
  }

  toggle.addEventListener('click', () => setMenu(!menuOpen));
  toggle.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    setMenu(true);
    groups[0]?.trigger.focus();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    clearTimeout(hoverTimer);
    if (active) {
      event.preventDefault();
      closeGroup(!preview || active.container.contains(document.activeElement));
    } else if (menuOpen) {
      event.preventDefault();
      setMenu(false);
      toggle.focus({ preventScroll: true });
    }
  });

  function dismissOutside(event) {
    if (active && !active.container.contains(event.target)) closeGroup();
    if (menuOpen && !menu.contains(event.target)) setMenu(false);
  }

  document.addEventListener('click', event => {
    clearTimeout(hoverTimer);
    dismissOutside(event);
  });
  hoverPointer.addEventListener('change', () => {
    clearTimeout(hoverTimer);
    if (preview) closeGroup();
  });
  const root = document.documentElement;
  let tabKey;
  let focusFrame = 0;
  function cancelFocusAdjustment() {
    tabKey = undefined;
    cancelAnimationFrame(focusFrame);
  }
  document.addEventListener('pointerdown', cancelFocusAdjustment, { capture: true, passive: true });
  document.addEventListener('keydown', event => {
    cancelFocusAdjustment();
    if (!event.isTrusted || event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey
        || root.hasAttribute('data-anchor-travel')) return;
    tabKey = event;
    // Only a focus change caused by this Tab press can request compensation.
    setTimeout(() => { if (tabKey === event) tabKey = undefined; }, 0);
  }, { capture: true });
  document.addEventListener('focusin', event => {
    const key = tabKey;
    tabKey = undefined;
    dismissOutside(event);
    const target = event.target;
    if (!key || header.contains(target) || !main.contains(target)) return;
    focusFrame = requestAnimationFrame(() => {
      if (key.defaultPrevented || document.activeElement !== target || root.hasAttribute('data-anchor-travel')) return;
      const bar = header.getBoundingClientRect();
      const top = target.getBoundingClientRect().top;
      if (bar.top > 1 || bar.bottom <= 0 || top >= bar.bottom) return;
      window.scrollBy({ top: Math.floor(top - bar.bottom - 4), behavior: 'instant' });
    });
  });
  content.addEventListener('click', event => {
    if (!event.target.closest('a[href]') || event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    // Let the travel handler read the clicked link before hiding its panel.
    setTimeout(() => setMenu(false), 0);
  });
  // A document scroll leaves the mobile menu behind. Its own scroll stays local.
  addEventListener('scroll', () => {
    if (menuOpen && Math.abs(scrollY - menuScrollY) >= 24) setMenu(false);
  }, { passive: true });
  addEventListener('hashchange', () => setMenu(false));
  addEventListener('pageshow', event => { if (event.persisted) setMenu(false); });
  narrow.addEventListener('change', () => {
    const focusWasOnToggle = document.activeElement === toggle;
    setMenu(false);
    if (!narrow.matches && focusWasOnToggle) groups[0]?.trigger.focus({ preventScroll: true });
  });

  toggle.hidden = false;
  setMenu(false);
  header.dataset.ready = '';
  const setHeaderHeight = () => document.documentElement.style.setProperty('--site-header-height', `${header.offsetHeight}px`);
  setHeaderHeight();
  new ResizeObserver(setHeaderHeight).observe(header);
  mountAccount(header.querySelector('[data-site-account]'));
  mountPreferences();
  if (main.hasAttribute('data-longform')) mountChapterHighlight(header, main);
}
