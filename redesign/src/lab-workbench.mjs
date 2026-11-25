import {plateFrame} from './lab-engraving.mjs';
const bilingual = (lang, pair) => pair[lang === 'en' ? 1 : 0];
const steps = [
  ['问题与数据','Questions & data','提出研究问题，确定输入与样本。','Define the question, inputs and samples.'],
  ['建立结构','Build a model','把研究对象建成可运行的模型或系统。','Build a working model or system.'],
  ['验证与评审','Test & review','用实验结果与公开讨论核对结论。','Check conclusions through experiments and review.'],
  ['交付','Publish','公开代码仓库、数据集和文档，留下可复现的记录。','Publish repositories, datasets and documentation for reproduction.'],
];
export function renderLab(lang) {
  const en = lang === 'en';
  const t = pair => bilingual(lang,pair);
  return `<section id="position" class="story-screen lab-intro" data-scene-page="about.html" aria-labelledby="position-title">
    <div class="lab-sheet">
      <header class="lab-heading" data-scene-quiet>
        <p class="lab-name">ALETHIC INSIGHT <span>/</span> ${t(['真知灼见','CUMT AI LAB'])}</p>
        <h1 id="position-title"><span>${t(['从问题，','From question'])}</span><span>${t(['走到系统。','to system.'])}</span></h1>
      </header>
      <div class="lab-profile" data-scene-quiet><p>${t(['我们是中国矿业大学学生主导的 AI 研究与工程共同体。','We are a student-led AI research and engineering community at China University of Mining and Technology.'])}</p>
        <p>${t(['在计算机科学与技术学院 / 人工智能学院，我们开展研究训练、工程实践与开源协作。','At the School of Computer Science and Technology / AI, we study research methods, build systems and collaborate in the open.'])}</p>
        <a class="story-action" href="/people.html" data-primary>${t(['认识团队','Meet the team'])}<span aria-hidden="true">↗</span></a>
      </div>
      <div class="lab-workbench" data-lab-workbench>
        <pre class="lab-master-plate" data-lab-figure aria-hidden="true">${plateFrame(0,0)}</pre>
        <div class="lab-track" role="group" aria-label="${t(['研究工作过程','Research process'])}">
          ${steps.map((step,i) => `<button type="button" class="lab-station" data-lab-step="${i}" aria-pressed="${i===0}" aria-controls="lab-process-note"><span class="lab-label"><small>${String(i+1).padStart(2,'0')}</small>${step[en?1:0]}</span></button>`).join('')}
        </div>
        <div class="lab-foot"><p id="lab-process-note" role="status">${steps[0][en?3:2]}</p><p>${t(['由繁得构，由构显真。','From noise, structure. From structure, aletheia.'])}</p></div>
        <noscript><ol>${steps.map(s=>`<li>${s[en?1:0]} · ${s[en?3:2]}</li>`).join('')}</ol></noscript>
      </div>
      <p class="lab-location">${t(['2025 年成立 · 中国徐州','Founded 2025 · Xuzhou, China'])}<span>34.2044°N / 117.1438°E</span></p>
    </div></section>`;
}

export function mountLabWorkbench(main) {
  const board=main.querySelector('[data-lab-workbench]');
  if(!board)return;
  const buttons=[...board.querySelectorAll('[data-lab-step]')];
  const figure=board.querySelector('[data-lab-figure]');
  const note=board.querySelector('[role="status"]');
  const en=document.documentElement.lang==='en';
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let selected=0, shown=0, previous=0, started=0, phase=0, active=false, timer=0;
  function paint(){
    const fraction=reduce.matches?1:Math.min(1,(performance.now()-started)/210);
    figure.textContent=plateFrame(shown,reduce.matches?0:phase,previous,fraction,figure.clientWidth<500);
  }
  function show(i){if(i!==shown){previous=shown;shown=i;started=performance.now();}paint();}
  function run(){clearInterval(timer);paint();if(active&&!document.hidden&&!reduce.matches)timer=setInterval(()=>{phase+=.09;paint();},90);}
  function choose(i){selected=i;buttons.forEach((b,n)=>b.setAttribute('aria-pressed',String(n===i)));note.textContent=steps[i][en?3:2]; show(i);}
  buttons.forEach((button,i)=>{
    button.addEventListener('click',()=>choose(i));
    button.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'){show(i);}});
    button.addEventListener('pointerleave',()=>{show(selected);});
    button.addEventListener('keydown',e=>{const dest={ArrowRight:(i+1)%4,ArrowLeft:(i+3)%4,Home:0,End:3}[e.key];if(dest!==undefined){e.preventDefault();buttons[dest].focus({preventScroll:true});choose(dest);}});
  });
  new IntersectionObserver(([entry])=>{active=entry.isIntersecting;run();}).observe(board);
  document.addEventListener('visibilitychange',run);reduce.addEventListener('change',run);
}
