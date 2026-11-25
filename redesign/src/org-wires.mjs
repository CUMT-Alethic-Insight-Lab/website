const ns = 'http://www.w3.org/2000/svg';

export function mountOrganization(main) {
  const chart = main.querySelector('.org-chart');
  if (!chart) return;
  const root = chart.querySelector('.org-gate');
  const routes = [...chart.querySelectorAll('.org-branch')].map(branch => ({
    mode: branch.querySelector('.org-mode'),
    doors: [...branch.querySelectorAll('.object-control')],
  }));
  const svg = document.createElementNS(ns,'svg');
  svg.setAttribute('data-org-wires','');
  svg.setAttribute('aria-hidden','true');
  chart.prepend(svg);
  function draw() {
    const box = chart.getBoundingClientRect();
    const compact = matchMedia('(max-width:760px)').matches;
    function port(el, side) {
      const range=document.createRange();
      // Measure the label itself, so the line terminates at the letters even
      // when the grid column is wider than the label.
      const text=[...el.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if(text) range.selectNodeContents(text); else range.selectNodeContents(el);
      const rect=range.getBoundingClientRect();
      return {x: (side==='out'?rect.right+5:rect.left-6) - box.left, y:(rect.top+rect.bottom)/2-box.top};
    }
    const pieces=[];
    function wire(points,active=false){
      const path=document.createElementNS(ns,'path');
      path.setAttribute('d',points.map((point,i)=>`${i?'L':'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' '));
      if(active)path.setAttribute('data-live','');
      pieces.push(path);
    }
    const origin=port(root,'out');
    for(const {mode,doors} of routes){
      const active=doors.some(door=>door.getAttribute('aria-pressed')==='true'||door.matches(':hover,:focus-visible'));
      const node=port(mode,'in');
      const bus=compact?Math.max(2,node.x-11):(origin.x+node.x)/2;
      if(compact){const start=port(root,'in');wire([start,{x:bus,y:start.y},{x:bus,y:node.y},node],active);}
      else wire([origin,{x:bus,y:origin.y},{x:bus,y:node.y},node],active);
      const exit=port(mode,'out');
      for(const door of doors){
        const end=port(door,'in');
        const mid=compact?end.x-10:(exit.x+end.x)/2;
        wire([exit,{x:mid,y:exit.y},{x:mid,y:end.y},end],door.matches(':hover,:focus-visible') || door.getAttribute('aria-pressed')==='true');
      }
    }
    svg.replaceChildren(...pieces);
  }
  let frame=0;function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;draw();});}
  new ResizeObserver(schedule).observe(chart);
  for(const evt of ['change','pointerover','pointerout','focusin','focusout','click'])chart.addEventListener(evt,schedule,{passive:true});
  main.addEventListener('objectselection',schedule);document.fonts?.ready.then(schedule);draw();
}
