import {medalFrame} from './lab-engraving.mjs';
export function renderAwardArchive(awards,lang) {
  const en=lang==='en';
  const names=en?['Lonely Sqrt-5','Lonely Sqrt-3','Lonely Sqrt-7']:awards.map(row=>row[1]);
  const prize=i=>en?(i===0?'First prize':'Third prize'):awards[i][0];
  function panel(i){
    const [, , note, code]=awards[i];
    const credits=note[en?1:0].split(' / ')[1];
    const [members,advisors]=credits.split(en?' · Advisor':' · 指导老师：');
    return `<article class="award-dossier" id="award-panel-${i+1}" data-award-panel="${i}" aria-label="${names[i]}">
      <a class="award-print" href="/awards/cert-${code}.pdf" aria-label="${en?'Open certificate for':'查看证书：'}${names[i]}"><img src="/awards/cert-${code}.png" alt="${names[i]} · ${prize(i)}" loading="lazy" decoding="async"></a>
      <div class="award-caption"><small>${prize(i)}</small><h3>${names[i]}</h3><dl><dt>${en?'Team':'队员'}</dt><dd>${members}</dd><dt>${en?'Advisors':'指导教师'}</dt><dd>${en?advisors?.replace(/^s?:\s*/,''):advisors}</dd></dl><a class="chart-link" href="/awards/cert-${code}.pdf">${en?'Open certificate PDF':'查看证书 PDF'} ↗</a><code>${code}</code></div></article>`;
  }
  return `<div class="award-archive"><p id="award-story-title">${awards[0][2][en?1:0].split(' / ')[0]}</p><div class="award-archive-layout"><div class="award-register-column"><pre data-award-medal aria-hidden="true">${medalFrame(0,0)}</pre><div class="award-index" role="group" aria-label="${en?'Winning teams':'获奖队伍'}">${awards.map((row,i)=>`<button data-award-pick="${i}" data-scene-option="award-${i+1}" id="awards-item-${i+1}" type="button" aria-controls="award-panel-${i+1}" aria-pressed="${i===0}"><span>${prize(i)}</span><strong>${names[i]}</strong><i aria-hidden="true">›</i></button>`).join('')}</div></div><div class="award-panels">${awards.map((row,i)=>panel(i)).join('')}</div></div></div>`;
}
export function mountAwardArchive(main){
  const archive=main.querySelector('.award-archive');if(!archive)return;
  const picks=[...archive.querySelectorAll('[data-award-pick]')],panels=[...archive.querySelectorAll('[data-award-panel]')];
  const medal=archive.closest('section.story-screen')?.querySelector('[data-award-medal]') || archive.querySelector('[data-award-medal]');
  let selected=0,phase=0,timer=0,visible=false;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  function paint(){medal.textContent=medalFrame(selected,reduce.matches?0:phase);}
  function run(){clearInterval(timer);paint();if(visible&&!document.hidden&&!reduce.matches)timer=setInterval(()=>{phase+=.15;paint();},150);}
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;run();}).observe(medal);
  document.addEventListener('visibilitychange',run);reduce.addEventListener('change',run);
  function select(index){selected=index;paint();picks.forEach((b,i)=>{b.setAttribute('aria-pressed',String(i===index));panels[i].hidden=i!==index;});}
  function fromAddress(){const index=picks.findIndex(b=>'#'+b.id===location.hash);if(index>=0) select(index);else if(location.hash==='#awards'||!archive.dataset.ready) select(0);}
  function choose(i){const hash='#'+picks[i].id;if(hash!==location.hash)history.pushState(history.state,'',hash);select(i);main.dispatchEvent(new Event('objectselection'));}
  picks.forEach((button,i)=>{button.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')select(i);});button.addEventListener('focus',()=>select(i));button.addEventListener('click',()=>choose(i));button.addEventListener('keydown',e=>{const index={ArrowDown:(i+1)%3,ArrowUp:(i+2)%3,ArrowRight:(i+1)%3,ArrowLeft:(i+2)%3,Home:0,End:2}[e.key];if(index!==undefined){e.preventDefault();picks[index].focus({preventScroll:true});choose(index);}});});
  fromAddress();archive.dataset.ready='true';addEventListener('popstate',fromAddress);addEventListener('hashchange',fromAddress);
}
