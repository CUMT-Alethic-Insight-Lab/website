import {renderAwardArchive} from './award-archive.mjs';
const number = index => String(index + 1).padStart(2, '0');
const glyph = (text, css = '') => `<span class="glyph ${css}" aria-hidden="true">${text}</span>`;
const link = (href, text) => `<a class="chart-link" href="${href}">${text}${glyph('↗')}</a>`;
const safe = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

function chapter(id, title, content) {
  return `<section class="topic-content" id="${id}" aria-labelledby="${id}-title">${content}</section>`;
}
function ruler(sample, translate) {
  const methods = sample.methods;
  const label = method => method.id === 'flued_v36_s0' ? translate('S0 基线','S0 baseline') : method.id.includes('r4') ? translate('R4 边界优化','R4 boundary optimization') : method.name;
  function row(method, index) {
    const select = index === 1 ? `<select data-ruler-select aria-label="${translate('比较切分方法','Compare segmentation methods')}">${methods.map((m,i)=>`<option ${i===1?'selected':''} value="${i}">${safe(label(m))}</option>`).join('')}</select>` : `<strong>${safe(label(method))}</strong>`;
    return `<div class="cut-row"><div class="cut-label">${select}<span><output>${method.n_segments}</output> ${translate('段','segments')}</span></div><div class="cut-track" aria-hidden="true">${method.segments.slice(1).map(s=>`<i style="left:${s.start/sample.n_bytes*100}%">|</i>`).join('')}</div></div>`;
  }
  const values = methods.map(m=>m.segments.map(s=>s.start));
  return `<figure class="cut-figure" data-cuts="${safe(JSON.stringify(values))}" data-bytes="${sample.n_bytes}"><figcaption><strong>${translate('切分边界对照','Compare segmentation')}</strong><span>${translate('同一样本','Same sample')} · ${sample.n_bytes} B</span></figcaption>${row(methods[0],0)}${row(methods[1],1)}<div class="cut-axis"><span>0</span><span>${sample.n_bytes} B</span></div></figure>`;
}

export function drawTopic(lang, data, section) {
  const en = lang === 'en';
  const t = (zh, english) => en ? english : zh;
  const pick = pair => pair[en ? 1 : 0];
  const { directions, projects, awards, focus, agreements, documents, levels, showcase, contact } = data;
  const sample = showcase.texts.find(item => item.id === lang);
  const stages = [
    [t('问题与数据','Questions & data'),t('提出问题，确定输入','Define the question and its input')],
    [t('建立结构','Structure'),t('将研究对象建成模型或系统','Build a model or system')],
    [t('验证与评审','Test & review'),t('用实验和公开讨论核对结果','Check results with experiments and review')],
    [t('交付','Publish'),t('代码仓库、数据集、文档','Repositories, datasets and documentation')],
  ];
  const position = chapter('position',t('组织定位','About the lab'),`<h2 class="about-heading">${t('从问题，走到系统。','From question to system.')}</h2><div class="station-context"><p>${t('Alethic Insight，中文名「真知灼见」。我们是中国矿业大学计算机科学与技术学院 / 人工智能学院学生主导的 AI 研究与工程共同体，开展研究训练、工程实践与开源协作。','Alethic Insight (真知灼见) is a student-led community at CUMT’s School of Computer Science and Technology / AI for research training, engineering practice and open-source collaboration.')}</p><p>${t('由繁得构，由构显真。','From noise, structure. From structure, aletheia.')}<br><small>${t('2025 年成立于中国徐州','Founded in 2025 · Xuzhou, China')} · 34.2044°N / 117.1438°E</small></p></div><ol class="work-path">${stages.map(([name,detail],i)=>`<li>${glyph(number(i),'station-symbol')}<strong>${name}</strong><span>${detail}</span></li>`).join('')}</ol>${link('/people.html',t('查看成员','Meet the team'))}`,'wide-chart');
  const org = chapter('structure',t('一个团队，三个层次','One team, three levels'),`<div class="org-chart"><div class="org-gate">${t('参与方式','Participation')}</div><div class="org-branch open-branch" data-pick-object><span class="org-mode">${t('开放参与','Open access')}</span><div><h3><button class="object-control" type="button" aria-pressed="false">${pick(levels[0][0])}</button></h3><p>${pick(levels[0][2])}</p><small>${pick(levels[0][1])}</small></div></div><div class="org-branch recruit-branch"><span class="org-mode">${t('正式成员','Members')}<small>${t('当前规模（约）','Current size (approx.)')}</small></span><div class="seat-pair">${levels.slice(1).map(([name,seats,desc],i)=>`<div class="seat-node" data-pick-object><h3><button class="object-control" type="button" aria-pressed="false">${pick(name)}</button></h3><div class="seat-count"><b>${pick(seats)}</b></div><p>${pick(desc)}</p></div>`).join('')}</div></div></div><div class="org-doors">${link('/people.html',t('查看成员','Meet members'))}${link('/recruitment/',t('查看招新流程','Recruitment process'))}</div>`,'wide-chart');
  const topicLabels = directions.map(([id,name],i)=>`<a href="#${id}" data-direction="${id}">${glyph(number(i))}<span>${name}</span>${glyph('---+','topic-tap')}</a>`).join('');
  const research = chapter('work',t('研究方向','Research directions'),`<div class="topic-switch" id="direction-story-title"><nav class="topic-index" aria-label="${t('方向索引','Direction index')}">${topicLabels}</nav><div class="topic-bus" aria-hidden="true"><i></i></div><div class="topic-readouts">${directions.map(([id,name,desc],i)=>`<article id="${id}" data-topic><small>${t('方向','Direction')} [${number(i)} / 07]</small><h3>${name}</h3><p>${pick(desc)}</p></article>`).join('')}</div></div>`,'wide-chart');
  const destinations = [['/flued-evidence.html',t('实验记录','Experiment logs')],['/recruitment/',t('招新平台','Recruitment platform')],['/awards.html',t('竞赛成果','Competition results')]];
  const orientations = chapter('focus', t('实验室三大面向','What we do'), `<div class="focus-matrix">
    <div class="matrix-head"><span>${t('工作面向','Practice')}</span><span>${t('如何开展','Method')}</span><span>${t('产物实例','Examples')}</span></div>
    ${focus.map(([name, desc], index) => `<div class="matrix-row"><h3>${pick(name)}</h3><p>${pick(desc)}</p><div class="matrix-port">
${link(...destinations[index])}</div></div>`).join('')}</div>`);
  const path = [
    ['[ 0 .. 511 ]',t('字节输入','Byte input'),'/flued-demo.html#input'],
    ['||  | |   ||',t('学习切分','Learned segments'),'/flued.html#roi'],
    ['[ 1 × 1536 ]',t('连续读出','Readout'),'/flued-architecture.html#pipeline'],
  ];
  const projectGroups = [[t('网站与服务','Sites & services'),[1,2]],[t('治理与学习','Governance & learning'),[3,4]],[t('实验产物','Artifacts'),[5]]];
  const catalog = chapter('projects',t('公开项目','Open projects'),`<div class="project-main"><div><h3 id="project-story-title">${link('/flued.html','FLUED')}</h3><p>${pick(projects[0][2])}</p></div><div class="project-path">${path.map(([shape,name,url])=>`<a href="${url}">${glyph(shape)}<strong>${name}</strong></a>`).join('')}</div></div><div class="project-evidence">${link('/flued.html#roi',t('切分方法','Segmentation methods'))}${link('/flued.html#thesis',t('研究问题','Research question'))}${link('/flued-evidence.html#curves',t('训练证据','Training evidence'))}${link('/flued-experiments.html#ledger',t('实验图谱','Experiment atlas'))}</div>${ruler(sample,t)}<div class="project-directory">${projectGroups.map(([type,items])=>`<div><h3>${type}</h3><ul>${items.map(i=>`<li>${link(projects[i][0],projects[i][1])}<p>${pick(projects[i][2])}</p></li>`).join('')}</ul></div>`).join('')}</div>`,'wide-chart');
  const results=chapter('awards',t('获奖成果','Awards'),renderAwardArchive(awards,lang));
  const clauses=[[t('AI 使用','AI use'),4],[t('代码改动','Code changes'),5],[t('实验与部署','Experiments'),2],[t('项目交接','Handover'),2]];
  const rules = chapter('work-mode', t('协作公约','Working agreement'), `<div class="clause-map">
    <div class="clause-head"><span>${t('适用对象','Applies to')}</span><span>${t('需要留存什么','What to record')}</span></div>
    ${agreements.map(([name, desc], i) => `<div class="clause" data-pick-object><button class="object-control" type="button" aria-pressed="false">${clauses[i][0]}</button><div>
      <h3>${name}</h3><p>${pick(desc)}</p>
      ${link(documents[clauses[i][1]][0],pick(documents[clauses[i][1]][1]))}</div></div>`).join('')}</div>`);
  const groups=[['governance-public/',t('组织治理','Governance'),[0,1,2,3,4,5]],['recruitment/',t('招新','Recruitment'),[6,7]],['alethicinsight.com/',t('研究与文章','Research & writing'),[8,9]]];
  const docs=chapter('documents',t('关键文档','Key documents'),`<div class="doc-tree">${groups.map(([root,label,indices])=>`<div class="doc-folder"><h3>${label}<code>${root}</code></h3><ul>${indices.map((i,order)=>`<li>${link(documents[i][0],pick(documents[i][1]))}</li>`).join('')}</ul></div>`).join('')}</div>`,'wide-chart');
  const admissions=[[t('申请表','Application'),t('提交申请材料','Submit your application')],[t('机试','Coding test'),t('参加机试','Take the coding test')],[t('面试','Interview'),t('参加面试','Attend the interview')],[t('入组','Onboarding'),t('进入团队','Join the team')]];
  const join=chapter('join',t('加入方式','How to join'),`<p>${t('当前招新已结束，以下为招新流程参考。','Recruitment is currently closed. The following steps are provided for reference.')}</p><div class="join-route"><div class="join-start">${link('/recruitment/',t('进入招新平台','Enter recruitment'))}</div><ol>${admissions.map(([stage],i)=>`<li>${glyph(number(i))}<strong>${stage}</strong></li>`).join('')}</ol></div><div class="chart-links">${link(documents[7][0],pick(documents[7][1]))}${link(`mailto:${contact}`,contact)}</div>`,'wide-chart');
  const bodies = {position, structure:org, work:research, focus:orientations, projects:catalog, awards:results, 'work-mode':rules, documents:docs, join};
  return bodies[section];
}
