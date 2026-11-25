const steps = [
  {
    id: 'submission', tag: 'IN', title: ['投稿', 'Submission'], role: ['作者', 'Authors'],
    body: ['作者提交稿件、摘要与可复现实验材料。若会议采用双盲评审，按会议规则处理身份信息。', 'Authors submit a manuscript, abstract, and reproducibility materials. If the venue uses double-blind review, authors handle identifying information according to its rules.'],
    record: ['样例稿件已进入待评审队列。', 'The sample manuscript is queued for review.'],
    path: ['AUTHOR --+--> [ DRAFT ]', '         +--> [ MATERIALS ]'],
  },
  {
    id: 'review', tag: 'REV', title: ['评审', 'Review'], role: ['评审人', 'Reviewers'],
    body: ['评审人独立阅读稿件，记录贡献、证据与不足。示例评语询问对照模型是否使用了同一套样本。', 'Reviewers independently record contributions, evidence, and weaknesses. The sample review asks whether the baselines used the same examples.'],
    record: ['样例评语：请补充对照实验的数据划分。', 'Sample review: Please describe the data split used for the baselines.'],
    path: ['[ DRAFT ] --+--> REVIEW 1', '            +--> REVIEW 2'],
  },
  {
    id: 'discussion', tag: 'DIA', title: ['讨论', 'Discussion'], role: ['作者与评审人', 'Authors and reviewers'],
    body: ['作者针对评语作出回应，评审人可追问或更新意见。这里展示对一条实验疑问的澄清。', 'Authors respond to reviews, and reviewers can ask follow-up questions or update their assessments. This example clarifies one experimental detail.'],
    record: ['样例回应：所有对照使用同一测试集，修订稿会标明切分方式。', 'Sample response: All baselines use the same test set. The revision will describe the split.'],
    path: ['REVIEW ---> [ RESPONSE ]', '   ^--------------+'],
  },
  {
    id: 'decision', tag: 'OUT', title: ['决定', 'Decision'], role: ['会议组织者', 'Organizers'],
    body: ['会议组织者综合稿件、评语与讨论，记录决定和理由。实际公开范围与发布时点由会议规则决定。', 'Organizers weigh the manuscript, reviews, and discussion and record a decision with its rationale. Venue rules determine what is made public and when.'],
    record: ['样例决定：建议接收，要求在最终稿公开数据划分。', 'Sample decision: Recommend acceptance with the data split documented in the final manuscript.'],
    path: ['REVIEWS --+--> [ DECISION ]', 'REPLY ----+       | REASON'],
  },
];

function renderMeeting(lang) {
  const t = pair => pair[lang === 'en' ? 1 : 0];
  return `<section class="bay ed-meeting" data-meeting aria-labelledby="meeting-demo-title">
    <header class="ed-demo-heading">
      <h2 id="meeting-demo-title">${t(['流程演示', 'Workflow demo'])}</h2>
      <p>${t(['选择阶段，查看示例稿件的操作和记录。稿件、评语与决定均为虚构示例。', 'Select a stage to see the actions and records for this fictional manuscript, its reviews, and its decision.'])}</p>
    </header>
    <div class="ed-meeting-board">
      <div class="ed-meeting-axis" data-meeting-axis aria-label="${t(['评审阶段', 'Review stages'])}">
        ${steps.map(({id, title}, i) => `<a class="ed-meeting-tab" data-stage-link id="tab-${id}" href="#stage-${id}">
          <span class="ed-datum" data-stage-code aria-hidden="true">[0${i + 1}]</span><span>${t(title)}</span><span class="ed-terminal" aria-hidden="true">-&gt;</span>
        </a>`).join('')}
      </div>
      <div class="ed-stage-content">
        ${steps.map(({id, tag, title, role, body, record, path}) => `<section class="ed-meeting-stage" data-stage-panel id="stage-${id}" aria-labelledby="stage-title-${id}">
          <div class="ed-stage-route" aria-hidden="true"><span class="ed-datum">[${tag}]</span><pre>${path.map(line => line.replaceAll('>', '&gt;')).join('\n')}</pre></div>
          <div class="ed-stage-reading"><h3 id="stage-title-${id}">${t(title)}</h3>
            <p class="ed-stage-role">${t(role)}</p><p>${t(body)}</p>
            <p class="ed-stage-record">${t(record)}</p>
          </div>
        </section>`).join('')}
      </div>
    </div>
  </section>`;
}

function mountMeeting(lang) {
  const root = document.querySelector('[data-meeting]');
  if (!root || root.dataset.mounted) return;
  const axis = root.querySelector('[data-meeting-axis]');
  const controls = Array.from(axis.querySelectorAll('[data-stage-link]'));
  const panes = Array.from(root.querySelectorAll('[data-stage-panel]'));
  if (controls.length !== panes.length || !controls.length) return;

  root.dataset.mounted = 'true';
  axis.setAttribute('role', 'tablist');
  controls.forEach((control, i) => {
    const pane = panes[i];
    control.setAttribute('role', 'tab');
    control.setAttribute('aria-controls', pane.id);
    pane.setAttribute('role', 'tabpanel');
    pane.setAttribute('aria-labelledby', control.id);
    pane.tabIndex = 0;
  });

  function select(next, moveFocus = false) {
    controls.forEach((control, i) => {
      const selected = i === next;
      control.tabIndex = selected ? 0 : -1;
      control.setAttribute('aria-selected', String(selected));
      control.querySelector('[data-stage-code]').textContent = selected ? `[0${i + 1}]` : `0${i + 1}`;
      panes[i].hidden = !selected;
    });
    if (moveFocus) controls[next].focus({ preventScroll: true });
  }

  function selectFromHash() {
    const match = controls.findIndex(control => control.hash === location.hash);
    select(match >= 0 ? match : 0);
  }

  function activate(next, moveFocus = false) {
    const hash = controls[next].hash;
    if (hash !== location.hash) history.pushState(history.state, '', hash);
    select(next, moveFocus);
  }

  controls.forEach((control, i) => {
    control.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      activate(i);
    });
    control.addEventListener('keydown', event => {
      const last = controls.length - 1;
      const keyMap = {
        ArrowLeft: i === 0 ? last : i - 1,
        ArrowRight: i === last ? 0 : i + 1,
        ArrowUp: i === 0 ? last : i - 1,
        ArrowDown: i === last ? 0 : i + 1,
        Home: 0,
        End: last,
        ' ': i,
      };
      if (!Object.hasOwn(keyMap, event.key) || event.altKey || event.metaKey || event.ctrlKey) return;
      event.preventDefault();
      activate(keyMap[event.key], true);
    });
  });
  selectFromHash();
  for (const event of ['popstate', 'hashchange']) {
    // The shell can replace the translated tree in place.
    addEventListener(event, function onNavigation() {
      if (root.isConnected) selectFromHash();
      else removeEventListener(event, onNavigation);
    });
  }
}

export { renderMeeting, mountMeeting };
