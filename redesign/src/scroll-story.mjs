// Derive the active scene from the document's real scroll position in both directions.
export function mountScrollStory(main) {
  const screens = [...main.querySelectorAll('.story-screen')];
  const opening = document.querySelector('.opening');
  const header = document.querySelector('[data-site-header]');
  let scheduled = false;
  let active;
  function measure() {
    scheduled = false;
    const headerHeight = Math.ceil(header?.getBoundingClientRect().height || 0);
    document.documentElement.style.setProperty('--story-header-height', `${headerHeight}px`);
    const guide = Math.min(innerHeight * .45, headerHeight + (innerHeight-headerHeight)*.27);
    const pastOpening = !opening || opening.getBoundingClientRect().bottom <= guide;
    let next = pastOpening ? screens[0] : undefined;
    if (pastOpening) {
      for (const screen of screens) {
        if (screen.getBoundingClientRect().top > guide) break;
        next = screen;
      }
    }
    if (next === active && main.hasAttribute('data-active-page')) return;
    active?.removeAttribute('data-current-scene');
    next?.setAttribute('data-current-scene','');
    active=next;
    main.dataset.activePage=next?.dataset.scenePage || 'index.html';
    main.dispatchEvent(new CustomEvent('alethic:chapter',{bubbles:true,detail:{file:main.dataset.activePage,section:next?.id || 'top'}}));
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(measure);}}
  for(const event of ['scroll','resize','pageshow','hashchange','popstate'])addEventListener(event,schedule,{passive:true});
  const resize=new ResizeObserver(schedule);
  resize.observe(main);if(header)resize.observe(header);
  measure();
}
