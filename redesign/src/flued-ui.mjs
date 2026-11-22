const escape = value => String(value ?? '').replace(/[&<>"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
})[char]);
const numbers = new Intl.NumberFormat('en', { maximumFractionDigits: 5 });

const dataRequests = new Map();
const active = new WeakMap();
const number = value => Number.isFinite(value) ? numbers.format(value) : '—';
const percent = value => Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : '—';
const signed = value => Number.isFinite(value) ? `${value > 0 ? '+' : ''}${number(value)}` : '—';
const tr = (lang, zh, en) => lang === 'en' ? en : zh;
const unique = (items, prop) => [...new Set(items.map(item => item[prop]))];
const ratio = (value, maximum) => maximum > 0 ? Math.max(0, Math.min(100, value / maximum * 100)) : 0;
const read = (url, options) => fetch(url, options).then(response => {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
});
function payload(name) {
  if (!dataRequests.has(name)) {
    dataRequests.set(name, read(`/flued-${name}.json`).catch(error => {
      dataRequests.delete(name);
      throw error;
    }));
  }
  return dataRequests.get(name);
}

function options(select, choices, preferred = select.value) {
  select.replaceChildren(...choices.map(([value, label]) => new Option(label, value)));
  if (choices.some(([value]) => value === preferred)) select.value = preferred;
  select.disabled = choices.length === 0;
}

function lab(root, lang, signal) {
  return {
    root, lang, signal,
    t: (zh, en) => tr(lang, zh, en),
    el: name => root.querySelector(`[data-f-${name}]`),
    on: (target, type, callback) => target.addEventListener(type, callback, { signal }),
    live: () => root.isConnected && !signal.aborted,
  };
}

function reportError(context, name, error) {
  const { el, t, live } = context;
  if (live()) el(name).textContent = `${t('数据加载失败。刷新页面后重试。', 'Could not load data. Reload this page to retry.')} (${error.message})`;
}

const modelNames = {
  flued_v36_s0: ['FLUED v3.6 · S0 动态边界', 'FLUED v3.6 · S0 dynamic boundaries'],
  flued_v36_grpo_r4: ['FLUED v3.6 · R4 边界优化', 'FLUED v3.6 · R4 optimized boundaries'],
  hnet_repro_ar: ['H-Net 复现 · 自回归', 'H-Net reproduction · autoregressive'],
  hnet_dit_std: ['HNet-DiT 标准臂', 'HNet-DiT standard arm'],
  hnet_dit_bottleneck: ['HNet-DiT 瓶颈臂', 'HNet-DiT bottleneck arm'],
  blt_entropy: ['BLT · 熵切分', 'BLT · entropy segmentation'],
  bpe_tokenizer: ['BPE · 词表边界', 'BPE · vocabulary boundaries'],
};
const modelName = (row, t) => t(...(modelNames[row.id] ?? [row.name, row.name]));

function scoreTape(scores, threshold) {
  if (!scores?.some(Number.isFinite)) return '';
  const min = Math.min(0, ...scores.filter(Number.isFinite));
  const max = Math.max(1, threshold ?? 0, ...scores.filter(Number.isFinite));
  const style = value => ratio(value - min, max - min);
  return `<div class="f-scores" aria-hidden="true">
    ${scores.map(value => `<i style="--height:${Number.isFinite(value) ? style(value) : 0}%"></i>`).join('')}
    ${Number.isFinite(threshold) ? `<b style="--threshold:${style(threshold)}%"></b>` : ''}
  </div>`;
}

function byteTape({ title, segments, total, scores, threshold, label, t, lang }) {
  const selected = segments[0];
  const langTag = lang ? ` lang="${lang}"` : '';
  return `<div class="f-byte-bay" data-f-byte-bay>
    <header class="f-byte-head"><h3>${escape(title)}</h3><code>${label}</code></header>
    <div class="f-measure" aria-hidden="true"><span>+ 0B</span><span>${number(Math.floor(total / 2))}B</span><span>${number(total)}B +</span></div>
    ${scoreTape(scores, threshold)}
    <div class="f-byte-rule" data-f-byte-rule aria-hidden="true">
      ${segments.map(({ start, end }, i) => `<i data-f-byte-index="${i}"${i === 0 ? ' data-selected' : ''} style="--start:${ratio(start, total)}%;--width:${ratio(end - start, total)}%"></i>`).join('')}
    </div>
    ${selected ? `<div class="f-byte-inspector">
      <label class="f-field"><span>${t('定位分段', 'Locate a segment')}</span><select data-f-byte-select>${segments.map(({ start, end }, i) => `<option value="${i}">#${i + 1} [${start}..${end})</option>`).join('')}</select></label>
      <output data-f-byte-output${langTag}>${escape(selected.text)}</output>
    </div>
    <details class="f-transcript"><summary>${t('阅读带分界的完整文本', 'Read the complete segmented text')}</summary><p${langTag}>${segments.map(({ text, start, end }) => `<span title="[${start}..${end})">${escape(text)}</span>`).join('')}</p></details>` : ''}
    ${Number.isFinite(threshold) ? `<p class="f-note">${t('置信阈值', 'Score threshold')} <code>${number(threshold)}</code></p>` : ''}
  </div>`;
}

function bindByteSelection({ root, on }) {
  on(root, 'change', event => {
    const select = event.target.closest('[data-f-byte-select]');
    if (!select) return;
    const bay = select.closest('[data-f-byte-bay]');
    const n = Number(select.value);
    bay.querySelector('[data-f-byte-rule] [data-selected]')?.removeAttribute('data-selected');
    bay.querySelectorAll('[data-f-byte-index]')[n]?.setAttribute('data-selected', '');
    bay.querySelector('[data-f-byte-output]').textContent = bay.querySelectorAll('.f-transcript p span')[n]?.textContent ?? '';
  });
  on(root, 'click', event => {
    const mark = event.target.closest('[data-f-byte-index]');
    if (!mark) return;
    const select = mark.closest('[data-f-byte-bay]').querySelector('[data-f-byte-select]');
    select.value = mark.dataset.fByteIndex;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function mountOutline(context) {
  const { el, on, t, lang, live } = context;
  const { texts } = await payload('segmentation-showcase');
  if (!live()) return;
  const sample = el('sample');
  const methods = ['method-a', 'method-b'].map(el);
  options(sample, texts.map(({ id }) => [id, id === 'zh' ? '中文' : 'English']), lang);
  function render(reset = false) {
    const record = texts.find(item => item.id === sample.value);
    const choices = record.methods.map(item => [item.id, modelName(item, t)]);
    if (reset) methods.forEach((select, i) => {
      options(select, choices, select.value || choices[i]?.[0]);
    });
    el('sample-status').textContent = `${number(record.n_bytes)} B · ${t('原始样本文本', 'Original sample text')}`;
    el('showcase').innerHTML = `
      <details class="f-raw-text"><summary>${t('展开输入原文', 'Read the original text')}</summary><p lang="${record.id}">${escape(record.text)}</p></details>
      ${methods.map((select, i) => {
        const method = record.methods.find(item => item.id === select.value);
        return byteTape({
          title: `${i === 0 ? 'A' : 'B'} / ${modelName(method, t)}`, segments: method.segments, total: record.n_bytes,
          scores: method.scores, threshold: method.threshold, label: `${method.n_segments} ${t('段', 'segments')}`, t, lang: record.id,
        }) + (method.lossless_join ? '' : `<p class="f-note">${t('原始数据未标注为无损拼接。', 'The source does not mark this segmentation as losslessly joinable.')}</p>`);
      }).join('')}`;
  }
  render(true);
  on(sample, 'change', () => render(true));
  methods.forEach(select => on(select, 'change', () => render()));
  bindByteSelection(context);
}

function mountArchitecture({ root, el, on }) {
  const buttons = [...root.querySelectorAll('[data-f-step]')];
  buttons.forEach(button => on(button, 'click', () => {
    const step = Number(button.dataset.fStep);
    const id = button.querySelector('code').textContent;
    const title = button.querySelector('span').textContent;
    buttons.forEach((item, i) => {
      item.setAttribute('aria-pressed', String(i === step));
      item.toggleAttribute('data-passed', i < step);
    });
    const incoming = buttons[step - 1]?.querySelector('code').textContent;
    const outgoing = buttons[step + 1]?.querySelector('code').textContent;
    el('step-panel').innerHTML = `<code>${incoming ? `${incoming} -&gt; ` : ''}[${id}]${outgoing ? ` -&gt; ${outgoing}` : ''}</code><h3>${escape(title)}</h3><p>${escape(button.dataset.description)}</p>`;
  }));
}

const localDemo = 'http://127.0.0.1:8722';
const livePresets = [
  ['B', '架构说明', 'Architecture note', 'FLUED v3.6 先把 UTF-8 字节分成语义块。A frozen segmentor puts cuts at boundaries with high confidence. Chunk attention creates a memory for each segment, then the KDA state machine writes those memories into gated state. 整段输入最后读出 1,536 个标量，解码器需要从这个包恢复原始字节。'],
  ['C', '模型对照', 'Model comparison', '切分粒度会影响下游补全和需要传输的表示大小。The FLUED S0 and R4 arms use different boundary policies, while the H-Net variants provide autoregressive and masked-infilling comparisons. 单个样本用于观察实际切分，研究结论还需要在相同协议下比较。'],
];
const demoThresholds = { flued_v36_s0: 0.94, flued_v36_grpo_r4: 0.94, hnet_repro_ar: 0.5, hnet_dit_std: 0.5, hnet_dit_bottleneck: 0.5 };
const hex = value => Number.isInteger(value) && value >= 0 && value <= 255 ? value.toString(16).toUpperCase().padStart(2, '0') : '—';
function validInference(result) {
  return typeof result?.input?.text === 'string' && Number.isFinite(result.input.n_bytes) &&
    Array.isArray(result.mask?.positions) && Array.isArray(result.models) && result.models.length > 0 &&
    result.models.every(model => typeof model.id === 'string' && Array.isArray(model.segments));
}

function renderDemo({ el, t }, result, recorded) {
  const selected = result.models.find(item => item.id === el('model').value);
  if (!selected) return;
  const { input, mask, models } = result;
  const predictions = selected.completion?.predictions ?? [];
  const extras = selected.completion?.extra_metrics ?? {};
  el('segments').innerHTML = `<p class="f-note">${recorded ? t('预录输出', 'Recorded output') : t('实时输出', 'Live output')} · ${number(input.n_bytes)} B${input.truncated ? ` · ${t('输入已按模型窗口截断', 'Input truncated to model window')}` : ''}</p>` + byteTape({
    title: modelName(selected, t), segments: selected.segments, total: input.n_bytes, scores: selected.boundary_scores,
    threshold: demoThresholds[selected.id], label: `${number(selected.n_chunks)} ${t('段', 'segments')}`, t,
  });
  el('completion').innerHTML = `<div class="f-reading"><code>${percent(selected.completion?.masked_acc)}</code><p>${escape(modelName(selected, t))} · ${t('掩码位置准确率', 'accuracy at masked positions')}${extras.scoring === 'next_byte_argmax_at_mask_positions' ? ` (${t('next-byte 评分口径', 'next-byte scoring')})` : ''} · ${mask.positions.length} B</p></div>
    ${Number.isFinite(extras.direct_acc) ? `<p class="f-note">${t('直接还原', 'Direct restoration')} ${percent(extras.direct_acc)} · ${t('骨干掩码补全', 'Backbone masked completion')} ${percent(extras.backbone_masked_acc)}</p>` : ''}
    ${(mask.spans ?? []).length ? `<p class="f-note">${t('掩码范围', 'Mask ranges')} <code>${mask.spans.map(([start, end]) => `[${number(start)}..${number(end)})`).join(' ')}</code></p>` : ''}
    <div class="f-mask" role="list" aria-label="${t('逐字节补全结果（十六进制）', 'Byte predictions in hexadecimal')}">${predictions.map(pred => `
      <span role="listitem" ${pred.correct ? 'data-match' : ''}><small>@${number(pred.pos)}</small><code>${hex(pred.true_byte)} ${pred.correct ? '=' : '>'} ${hex(pred.pred_byte)}</code><small>${pred.correct ? t('命中', 'Match') : t('偏差', 'Miss')}</small></span>`).join('')}</div>`;
  el('timing').innerHTML = `<p class="f-note">${escape(result.device ?? 'CPU')} · ${t('串行端到端', 'Serial end-to-end')} <code>${number(result.e2e_timing_ms)} ms</code></p>
    <dl class="register f-register f-run-times">${models.map(item => `<div${item === selected ? ' data-selected' : ''}><dt>${escape(modelName(item, t))}</dt><dd>${number(item.timing_ms?.forward)} ms · ${number(item.params)} ${t('参数', 'parameters')}</dd></div>`).join('')}</dl>`;
}

async function mountDemo(context) {
  const { el, on, t, live, signal } = context;
  let recording;
  let customInput = false;
  let running = false;
  let current;
  let recorded = true;
  const preset = el('preset');
  const input = el('input');
  const mode = el('demo-mode');
  const status = el('demo-status');
  const run = el('run');
  const localHost = ['localhost', '127.0.0.1'].includes(location.hostname);

  function enableInput() {
    const items = customInput ? livePresets : [];
    options(preset, [['A', t('样本 A · 项目介绍', 'Sample A · Project intro')], ...items.map(([id, zh, en]) => [id, `${id} / ${t(zh, en)}`])]);
    input.readOnly = !customInput;
    run.disabled = running || (!recording && !customInput);
    mode.textContent = customInput
      ? t('本机推理已就绪。运行会把此文本发送到本机推理服务。', 'Local inference is ready. Running sends this text to the local inference service.')
      : t('预录模式使用固定输入，结果来自已归档的五模型推理。', 'Recorded mode uses a fixed input and archived output from all five models.');
  }
  function draw(result, isRecorded) {
    if (!validInference(result)) throw new Error(t('输出格式与 FLUED 演示不匹配', 'Output does not match the FLUED demo schema'));
    current = result;
    recorded = isRecorded;
    options(el('model'), result.models.map(model => [model.id, modelName(model, t)]));
    renderDemo(context, current, recorded);
  }
  on(preset, 'change', () => {
    input.value = preset.value === 'A' ? recording?.input.text ?? '' : livePresets.find(([id]) => preset.value === id)?.[3] ?? '';
  });
  on(el('model'), 'change', () => renderDemo(context, current, recorded));
  on(el('demo-form'), 'submit', async event => {
    event.preventDefault();
    if (running) return;
    const value = input.value;
    if (!value.trim()) {
      status.textContent = t('请输入文本或选择样本。', 'Enter text or choose a sample.');
      input.focus();
      return;
    }
    const isRecorded = !customInput;
    running = true;
    run.disabled = true;
    status.textContent = t('正在读取结果…', 'Reading results…');
    try {
      const result = isRecorded ? recording : await read(`${localDemo}/api/demo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: value }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]),
      });
      if (!live()) return;
      draw(result, isRecorded);
      status.textContent = (isRecorded ? t('录样已加载。', 'Recorded result loaded.') : t('本次推理完成。', 'Live inference completed.')) + ` ${result.models.length} ${t('个模型', 'models')}.`;
      document.dispatchEvent(new CustomEvent('alethic:result-ready', {
        detail: { target: el('model').closest('.f-bay'), focusTarget: el('model') },
      }));
    } catch (error) {
      if (live()) status.textContent = `${t('运行失败，可再次运行。', 'Run failed. You can retry.')} (${error.message})`;
    } finally {
      running = false;
      if (live()) run.disabled = false;
    }
  });
  bindByteSelection(context);
  try {
    recording = await payload('demo-sample');
    if (!live()) return;
    if (!validInference(recording)) throw new Error('Invalid FLUED demo sample');
    input.value = recording.input.text;
    status.textContent = '';
    enableInput();
    if (new URLSearchParams(location.search).get('autorun') === 'sample') draw(recording, true);
  } catch (error) {
    reportError(context, 'demo-status', error);
    if (!localHost) return;
  }
  if (!localHost) return;
  const poll = async () => {
    if (!live()) return;
    try {
      const result = await read(`${localDemo}/api/health`, { signal: AbortSignal.any([signal, AbortSignal.timeout(1500)]) });
      if (!live()) return;
      if (result.status === 'ok') {
        customInput = true;
        enableInput();
      } else if (result.status === 'loading') {
        mode.textContent = t('本机模型仍在加载，可先查看预录结果。', 'Local models are loading. You can run the recorded sample now.');
        const timer = setTimeout(poll, 3000);
        signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
      }
    } catch {
      // The recorded sample remains usable when no local service is running.
    }
  };
  void poll();
}
const metricLabels = {
  loss: ['总损失', 'Total loss'], recon_acc: ['重建准确率', 'Reconstruction accuracy'],
  soft_mn: ['平均软边界率', 'Mean soft boundary rate'], bp_std: ['边界置信度标准差', 'Boundary score standard deviation'],
  bhead_gnorm: ['边界头梯度范数', 'Boundary-head gradient norm'], type_cjk: ['CJK 边界率', 'CJK boundary rate'],
  type_utf8: ['UTF-8 边界率', 'UTF-8 boundary rate'], type_op: ['操作符边界率', 'Operator boundary rate'],
  reconstruction: ['重建准确率', 'Reconstruction accuracy'], completion: ['补全准确率', 'Completion accuracy'],
  backbone_acc: ['骨干准确率', 'Backbone accuracy'], latent_per_byte: ['每字节潜变量数', 'Latents per byte'],
  chunks: ['分段数', 'Chunks'], boundary_std: ['边界置信度标准差', 'Boundary score standard deviation'],
  grad_norm: ['梯度范数', 'Gradient norm'], mask_acc: ['掩码准确率', 'Masked accuracy'],
  byte_ce: ['字节交叉熵', 'Byte cross-entropy'], delta_acc_vs_byte: ['对字节基线 · 准确率差', 'Accuracy delta vs byte baseline'],
  delta_ce_vs_byte: ['对字节基线 · 交叉熵差', 'Cross-entropy delta vs byte baseline'],
};
const metricName = (key, t) => t(...(metricLabels[key] ?? [key, key]));
const trainingMetrics = ['loss', 'recon_acc', 'soft_mn', 'bp_std', 'bhead_gnorm', 'type_cjk', 'type_utf8', 'type_op'];
const strictMetrics = ['mask_acc', 'byte_ce', 'delta_acc_vs_byte', 'delta_ce_vs_byte'];
const atlasMetrics = ['reconstruction', 'completion', 'backbone_acc', 'latent_per_byte', 'loss', 'chunks', 'boundary_std', 'grad_norm'];
const trainingGroups = {
  v2_seeds: ['v2 E1 · 跨种子一致性', 'v2 E1 · seed consistency'],
  denoise_scan: ['v2 AB2 · 去噪比例', 'v2 AB2 · denoising ratio'],
  compression_scan: ['v2 AB1 · 压缩控制', 'v2 AB1 · compression control'],
};
const confidenceLabels = {
  high: ['高可信度', 'High confidence'], controlled: ['受控单种子', 'Controlled single seed'],
  historical: ['历史 / 纠偏前', 'Historical / pre-correction'], history: ['历史设计', 'Design history'],
  'history-only': ['仅供回顾', 'History only'],
};
const confidenceName = (key, t) => t(...(confidenceLabels[key] ?? [key, key]));

function measureCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.floor(rect.width);
  const height = Math.floor(rect.height);
  if (width < 5 || height < 5) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelsWide = Math.round(width * dpr);
  const pixelsHigh = Math.round(height * dpr);
  if (canvas.width !== pixelsWide) canvas.width = pixelsWide;
  if (canvas.height !== pixelsHigh) canvas.height = pixelsHigh;
  const draw = canvas.getContext('2d');
  if (!draw) return null;
  draw.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw.clearRect(0, 0, width, height);
  draw.font = '12px ui-monospace, monospace';
  return { draw, width, height, colors: getComputedStyle(canvas) };
}

function chartGrid(view, xLabels, yLabels, xBounds, yBounds) {
  const { draw, width, height, colors } = view;
  const left = width < 390 ? 52 : 66;
  const right = width - (width < 390 ? 17 : 32);
  const top = 18;
  const bottom = height - 30;
  const [minX, maxX] = xBounds;
  const [minY, maxY] = yBounds;
  const x = value => left + (value - minX) / (maxX - minX) * (right - left);
  const y = value => bottom - (value - minY) / (maxY - minY) * (bottom - top);
  draw.strokeStyle = colors.color;
  draw.fillStyle = colors.color;
  draw.lineWidth = 1;
  for (const [n, value] of yLabels) {
    draw.globalAlpha = 0.23;
    draw.beginPath();
    draw.moveTo(left, y(n));
    draw.lineTo(right, y(n));
    draw.stroke();
    draw.globalAlpha = 1;
    draw.textAlign = 'right';
    draw.fillText(value, left - 8, y(n) + 4);
  }
  for (const [n, value] of xLabels) {
    draw.globalAlpha = 0.23;
    draw.beginPath();
    draw.moveTo(x(n), top);
    draw.lineTo(x(n), bottom);
    draw.stroke();
    draw.globalAlpha = 1;
    draw.textAlign = n === minX ? 'left' : n === maxX ? 'right' : 'center';
    draw.fillText(value, x(n), bottom + 20);
  }
  return { x, y, left, right, top, bottom };
}

function observePlot(canvas, redraw, signal) {
  const size = new ResizeObserver(redraw);
  const theme = new MutationObserver(redraw);
  size.observe(canvas);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  signal.addEventListener('abort', () => {
    size.disconnect();
    theme.disconnect();
  }, { once: true });
  redraw();
}

function prepareSeries(runs, metric) {
  return runs.map(run => {
    const points = run.points.filter(point => Number.isFinite(point.step));
    const values = new Map(points.filter(point => Number.isFinite(point[metric])).map(point => [point.step, point[metric]]));
    return { run, points, values };
  });
}

function curvePlot(container, runs, metric, { t, signal }) {
  const chart = new AbortController();
  const plotSignal = AbortSignal.any([signal, chart.signal]);
  const dispose = () => chart.abort();
  const series = prepareSeries(runs, metric);
  const steps = [...new Set(series.flatMap(({ values }) => [...values.keys()]))].sort((a, b) => a - b);
  const points = series.flatMap(({ values }) => [...values.values()]);
  if (!steps.length) {
    container.innerHTML = `<p class="f-note">${t('这一组没有该指标的有效数据。', 'There are no valid readings for this metric in the selected group.')}</p>`;
    return dispose;
  }
  const caption = metricName(metric, t);
  container.innerHTML = `<figure class="f-figure">
    <figcaption><code>[ ${escape(caption)} ]</code><span>${t('横轴：训练步数', 'Horizontal axis: training step')}</span></figcaption>
    <canvas class="f-canvas" aria-hidden="true"></canvas>
    <label class="f-range"><span>${t('读取记录步', 'Inspect logged step')}</span><input type="range" min="0" max="${steps.length - 1}" value="${steps.length - 1}" ${steps.length === 1 ? 'disabled' : ''}><output>0</output></label>
    <dl class="register f-register f-series" aria-label="${escape(caption)}"></dl>
    <details><summary>${t('运行记录与口径', 'Run provenance and protocol')}</summary>
      <dl class="register f-register">${runs.map(run => `<div><dt>${escape(run.label)}</dt><dd><code>${escape(run.sourcePath ?? run.id)}</code>
        <p>${escape(run.protocol ?? '')}${run.note ? ` · ${escape(run.note)}` : ''}</p><p>${number(run.pointCount)} ${t('条日志', 'logged points')}${run.evidence ? ` · ${escape(confidenceName(run.evidence, t))}` : ''}${run.nanSteps?.length ? ` · NaN @ ${run.nanSteps.map(number).join(', ')}` : ''}</p></dd></div>`).join('')}</dl></details>
    </figure>`;
  const canvas = container.querySelector('canvas');
  const slider = container.querySelector('input');
  const readout = container.querySelector('output');
  const swatches = container.querySelector('.f-series');
  const yMin = Math.min(...points);
  const yMax = Math.max(...points);
  const yPadding = (yMax - yMin || Math.abs(yMax) || 1) * 0.06;
  const minY = yMin - yPadding;
  const maxY = yMax + yPadding;
  const minStep = steps[0];
  const maxStep = Math.max(steps.at(-1), minStep + 1);
  let geometry;
  let index = steps.length - 1;

  function render() {
    const view = measureCanvas(canvas);
    if (!view) return;
    const { draw, colors, width } = view;
    const ink = colors.color;
    const accent = colors.getPropertyValue('--accent').trim() || ink;
    const labels = width < 390 ? 3 : 5;
    const xLabels = Array.from({ length: labels }, (_, i) => {
      const step = minStep + (maxStep - minStep) * i / (labels - 1);
      return [step, number(Math.round(step))];
    });
    const yLabels = Array.from({ length: 5 }, (_, i) => {
      const value = minY + (maxY - minY) * i / 4;
      const display = Number(value.toPrecision(3)).toString();
      return [value, display.length <= 6 ? display : value.toExponential(1)];
    });
    geometry = chartGrid(view, xLabels, yLabels, [minStep, maxStep], [minY, maxY]);
    const { x, y, top, bottom } = geometry;
    series.forEach(({ points: readings, values }, i) => {
      draw.strokeStyle = i === 0 ? accent : ink;
      draw.globalAlpha = i === 0 ? 1 : 0.58;
      draw.lineWidth = i === 0 ? 2 : 1.4;
      draw.setLineDash([[], [6, 3], [2, 3], [10, 4, 2, 4]][i % 4]);
      draw.beginPath();
      let started = false;
      for (const { step } of readings) {
        const value = values.get(step);
        if (!Number.isFinite(value)) { started = false; continue; }
        if (started) draw.lineTo(x(step), y(value));
        else draw.moveTo(x(step), y(value));
        started = true;
      }
      draw.stroke();
      if (values.size === 1) {
        const [[step, value]] = values;
        draw.fillStyle = draw.strokeStyle;
        draw.fillRect(x(step) - 2, y(value) - 2, 4, 4);
      }
    });
    draw.setLineDash([]);
    draw.globalAlpha = 1;
    const step = steps[index];
    draw.strokeStyle = accent;
    draw.lineWidth = 1;
    draw.beginPath();
    draw.moveTo(x(step), top);
    draw.lineTo(x(step), bottom);
    draw.stroke();
    draw.fillStyle = accent;
    for (const { values } of series) {
      const value = values.get(step);
      if (Number.isFinite(value)) draw.fillRect(x(step) - 3, y(value) - 3, 6, 6);
    }
  }
  function update() {
    const step = steps[index];
    slider.value = String(index);
    slider.setAttribute('aria-valuetext', `${t('第', 'Step')} ${number(step)}${t(' 步', '')}`);
    readout.textContent = `@${number(step)}`;
    swatches.innerHTML = series.map(({ run, values }, i) => `<div><dt><code aria-hidden="true">${['──', '┄┄', '··', '─·'][i % 4]}</code> ${escape(run.label)}</dt><dd>${number(values.get(step))}</dd></div>`).join('');
    render();
  }
  function seek(event) {
    if (!geometry) return;
    const pixel = event.clientX - canvas.getBoundingClientRect().left;
    const position = minStep + (Math.max(geometry.left, Math.min(geometry.right, pixel)) - geometry.left) / (geometry.right - geometry.left) * (maxStep - minStep);
    let low = 0;
    let high = steps.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (steps[mid] < position) low = mid + 1;
      else high = mid;
    }
    const nearest = low > 0 && position - steps[low - 1] < steps[low] - position ? low - 1 : low;
    if (nearest !== index) { index = nearest; update(); }
  }
  slider.addEventListener('input', () => { index = Number(slider.value); update(); }, { signal: plotSignal });
  canvas.addEventListener('pointermove', event => { if (event.pointerType === 'mouse') seek(event); }, { signal: plotSignal });
  canvas.addEventListener('click', seek, { signal: plotSignal });
  observePlot(canvas, render, plotSignal);
  update();
  return dispose;
}

function strictReadout(container, strict, metric, t) {
  const { rows } = strict;
  const values = rows.map(row => row[metric]).filter(Number.isFinite);
  const signedAxis = values.some(value => value < 0);
  const upper = Math.max(...values.map(Math.abs), 0.00001);
  const chartVal = value => metric.startsWith('delta') ? signed(value) : metric === 'mask_acc' ? percent(value) : number(value);
  container.innerHTML = `<div class="f-compare-axis" aria-hidden="true"><span>${signedAxis ? chartVal(-upper) : chartVal(0)}</span>${signedAxis ? '<span>0</span>' : ''}<span>${chartVal(upper)}</span></div>
    <dl class="register f-register f-strict">${rows.map(row => {
      const value = row[metric];
      const width = ratio(Math.abs(value), upper) / (signedAxis ? 2 : 1);
      const start = signedAxis ? 50 - (value < 0 ? width : 0) : 0;
      return `<div><dt>${escape(row.run)}</dt><dd><div class="f-bar"${signedAxis ? ' data-signed' : ''} aria-hidden="true"><i style="--start:${start}%;--width:${width}%"></i></div>
        <code>${chartVal(value)}</code></dd></div>`;
    }).join('')}</dl><details><summary>${t('严格掩码来源与配置', 'Strict masking provenance and configuration')}</summary>
    <p><code>${escape(strict.sourcePath)}</code></p><dl class="register f-register">${rows.map(row => `<div><dt>${escape(row.run)}</dt><dd>${number(row.steps)} ${t('步', 'steps')} · ${number(row.params)} ${t('参数', 'parameters')} · ${escape(row.codec_name)} · ${t('掩码比例', 'Mask fraction')} ${percent(row.mask_frac)}</dd></div>`).join('')}</dl></details>`;
}

async function mountEvidence(context) {
  const { el, on, t, live } = context;
  const data = await payload('training-curves');
  if (!live()) return;
  const group = el('group');
  const metric = el('metric');
  const strictMetric = el('strict-metric');
  options(group, Object.entries(data.groups).map(([key, label]) => [key, t(...(trainingGroups[key] ?? [label, label]))]));
  options(metric, trainingMetrics.map(key => [key, metricName(key, t)]));
  options(strictMetric, strictMetrics.map(key => [key, metricName(key, t)]));
  let dispose;
  function render() {
    dispose?.();
    const runs = data.runs.filter(run => run.group === group.value);
    el('curve-status').textContent = `${runs.length} ${t('次运行', 'runs')} · ${number(runs.reduce((sum, run) => sum + run.pointCount, 0))} ${t('条日志', 'logged points')}`;
    dispose = curvePlot(el('plot'), runs, metric.value, context);
  }
  function renderStrict() { strictReadout(el('strict-results'), data.strictBackbone, strictMetric.value, t); }
  on(group, 'change', render);
  on(metric, 'change', render);
  on(strictMetric, 'change', renderStrict);
  render();
  renderStrict();
}

// Numeric observations transcribed from the baseline experiment-atlas frontier data.
const frontier = [
  ['v3.6 k=1 (S0+4x)', 1536, 0.1485, 'v36'], ['v3.6 k=4', 6144, 0.1463, 'v36'], ['v3.6 k=16', 24576, 0.1509, 'v36'],
  ['B1 uniform 4x k=1', 1536, 0.1293, 'uniform'], ['B0 uniform 1x k=1', 384, 0.1272, 'uniform'], ['Legacy uniform probe', 384, 0.1135, 'uniform'],
  ['HNet-DiT standard', 262144, 0.3236, 'hnet'], ['HNet-DiT bottleneck', 97540, 0.1418, 'hnet'], ['S0.7 per-chunk', 27000, 0.1413, 's07'],
];

function mountFrontier({ el, on, signal, t }) {
  const select = el('frontier');
  options(select, frontier.map(([label], i) => [String(i), label]));
  const container = el('frontier-plot');
  container.innerHTML = `<figure class="f-figure"><figcaption><code>[ MASKED ACC ]</code><span>${t('每 512 字节传输标量数', 'Scalars transmitted per 512 bytes')}</span></figcaption>
    <canvas class="f-canvas" aria-hidden="true"></canvas>
    <p class="f-coordinate" data-f-frontier-readout aria-live="polite"></p>
    <details><summary>${t('查看全部 9 个比较点', 'Read all 9 comparison points')}</summary><dl class="register f-register">${frontier.map(([label, rate, acc]) => `<div><dt>${label}</dt><dd>${number(rate)} · ${acc.toFixed(4)}</dd></div>`).join('')}</dl></details>
  </figure>`;
  const canvas = container.querySelector('canvas');
  let targets = [];
  let index = 0;
  let hovered = -1;
  function paint() {
    const view = measureCanvas(canvas);
    if (!view) return;
    const { draw, colors } = view;
    const ink = colors.color;
    const accent = colors.getPropertyValue('--accent').trim() || ink;
    const xmin = Math.log10(300);
    const xmax = Math.log10(410000);
    const { x, y, left, bottom } = chartGrid(view, [1000, 10000, 100000].map(value => [Math.log10(value), `${value / 1000}k`]),
      [.10, .15, .20, .25, .30, .35].map(value => [value, value.toFixed(2)]), [xmin, xmax], [.10, .35]);
    targets = frontier.map(([, rate, acc]) => [x(Math.log10(rate)), y(acc)]);
    const [px, py] = targets[index];
    draw.strokeStyle = accent;
    draw.setLineDash([4, 4]);
    draw.beginPath();
    draw.moveTo(left, py);
    draw.lineTo(px, py);
    draw.lineTo(px, bottom);
    draw.stroke();
    draw.setLineDash([]);
    draw.textAlign = 'center';
    targets.forEach(([x, y], i) => {
      const group = frontier[i][3];
      draw.globalAlpha = i === index || i === hovered ? 1 : 0.63;
      draw.fillStyle = i === index ? accent : ink;
      draw.font = 'bold 17px ui-monospace, monospace';
      draw.fillText(i === index ? '■' : { v36: '+', uniform: '×', hnet: '○', s07: '◇' }[group], x, y + 5);
    });
    draw.globalAlpha = 1;
  }
  function update() {
    index = Number(select.value);
    const [label, rate, acc] = frontier[index];
    el('frontier-readout').textContent = `[ ${label} ] ${number(rate)} ${t('标量', 'scalars')} / ${acc.toFixed(4)}`;
    paint();
  }
  function locate(event) {
    const rect = canvas.getBoundingClientRect();
    let closest = -1;
    let distance = 19;
    targets.forEach(([x, y], i) => {
      const d = Math.hypot(event.clientX - rect.left - x, event.clientY - rect.top - y);
      if (d < distance) { distance = d; closest = i; }
    });
    return closest;
  }
  on(select, 'change', update);
  on(canvas, 'pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    const next = locate(event);
    if (next !== hovered) { hovered = next; canvas.toggleAttribute('data-target', hovered >= 0); paint(); }
  });
  on(canvas, 'pointerleave', () => { hovered = -1; canvas.removeAttribute('data-target'); paint(); });
  on(canvas, 'click', event => {
    const point = locate(event);
    if (point >= 0) { select.value = String(point); update(); }
  });
  observePlot(canvas, paint, signal);
  update();
}

const familyNames = {
  'v3.6 归因矩阵': 'v3.6 attribution matrix',
  'v3.6 S0.7 逐段条件化': 'v3.6 S0.7 per-chunk conditioning',
};
const atlasStages = {
  '设计': 'Design', '5K 候选筛选': '5K candidate screening', '40K 边界归因': '40K boundary attribution',
  '归因矩阵': 'Attribution matrix', 'S0.7 逐段条件化': 'S0.7 per-chunk conditioning',
};

async function mountAtlas(context) {
  const { el, on, t, live, lang } = context;
  mountFrontier(context);
  const data = await payload('experiment-atlas');
  if (!live()) return;
  const { rows, curves } = data;
  const version = el('version');
  const stage = el('stage');
  const confidence = el('confidence');
  const query = el('query');
  const family = el('family');
  const metric = el('metric');
  const stageName = key => t(key, atlasStages[key] ?? key);
  const all = ['', t('全部', 'All')];
  options(version, [all, ...unique(rows, 'version').map(value => [value, value])]);
  options(stage, [all, ...unique(rows, 'stage').map(value => [value, stageName(value)])]);
  options(confidence, [all, ...unique(rows, 'evidence').map(value => [value, confidenceName(value, t)])]);
  options(family, unique(curves, 'family').map(value => [value, t(value, familyNames[value] ?? value)]), 'v3.6 S0 vs E2E');
  query.disabled = false;
  let dispose;
  const pageSize = 10;
  let page = 0;
  function showLedger() {
    const input = query.value.trim().toLocaleLowerCase();
    const records = rows.filter(row => (!version.value || row.version === version.value)
      && (!stage.value || row.stage === stage.value) && (!confidence.value || row.evidence === confidence.value)
      && (!input || [row.version, row.stage, stageName(row.stage), row.experiment, row.metric, row.finding, confidenceName(row.evidence, t)]
        .join(' ').toLocaleLowerCase().includes(input)));
    el('atlas-status').textContent = `${records.length} / ${rows.length} ${t('条实验记录', 'records')} · ${curves.length} ${t('条曲线', 'curve runs')}`;
    const pageCount = Math.ceil(records.length / pageSize);
    page = Math.max(0, Math.min(page, pageCount - 1));
    el('ledger-pages').hidden = pageCount <= 1;
    el('prev').disabled = page === 0;
    el('next').disabled = page + 1 >= pageCount;
    el('page').textContent = `${page + 1} / ${pageCount}`;
    el('ledger').innerHTML = records.length ? `<div class="f-ledger">${records.slice(page * pageSize, (page + 1) * pageSize).map(row => `<article>
      <dl class="f-record-meta"><div><dt>${t('版本', 'Version')}</dt><dd><code>${escape(row.version)}</code></dd></div><div><dt>${t('阶段', 'Stage')}</dt><dd>${escape(stageName(row.stage))}</dd></div><div><dt>${t('等级', 'Level')}</dt><dd>${escape(confidenceName(row.evidence, t))}</dd></div></dl>
      <div class="f-record-content"><h3${lang === 'en' && /[\p{Script=Han}]/u.test(row.experiment) ? ' lang="zh"' : ''}>${escape(row.experiment)}</h3>
        <p><code>${escape(row.steps)}</code> · <span${lang === 'en' && /[\p{Script=Han}]/u.test(row.metric) ? ' lang="zh"' : ''}>${escape(row.metric)}</span></p>
        <p${lang === 'en' && /[\p{Script=Han}]/u.test(row.finding) ? ' lang="zh"' : ''}>${escape(row.finding)}</p></div>
      </article>`).join('')}</div>` : `<p class="f-note">${t('没有匹配记录。清除筛选或换个关键词。', 'No matching records. Clear a filter or try a different query.')}</p>`;
  }
  function showCurves(changeGroup = false) {
    dispose?.();
    const runs = curves.filter(curve => curve.family === family.value);
    if (changeGroup) {
      const keys = atlasMetrics.filter(key => runs.some(run => run.points.some(point => Number.isFinite(point[key]))));
      options(metric, keys.map(key => [key, metricName(key, t)]));
    }
    dispose = curvePlot(el('plot'), runs, metric.value, context);
  }
  function resetLedger() { page = 0; showLedger(); }
  [version, stage, confidence].forEach(field => on(field, 'change', resetLedger));
  on(query, 'input', resetLedger);
  for (const [name, direction] of [['prev', -1], ['next', 1]]) {
    on(el(name), 'click', () => {
      page += direction;
      showLedger();
      el('ledger').setAttribute('tabindex', '-1');
      document.dispatchEvent(new CustomEvent('alethic:result-ready', {
        detail: { target: el('ledger'), focusTarget: el('ledger') },
      }));
    });
  }
  on(family, 'change', () => showCurves(true));
  on(metric, 'change', () => showCurves());
  showLedger();
  showCurves(true);
}

export function mountFlued(lang) {
  const root = document.querySelector('#main .flued');
  if (!root) return () => {};
  active.get(root)?.abort();
  const controller = new AbortController();
  active.set(root, controller);
  const context = lab(root, lang, controller.signal);
  const handlers = {
    'flued.html': [mountOutline, 'sample-status'],
    'flued-architecture.html': [mountArchitecture, ''],
    'flued-demo.html': [mountDemo, 'demo-status'],
    'flued-evidence.html': [mountEvidence, 'curve-status'],
    'flued-experiments.html': [mountAtlas, 'atlas-status'],
  };
  const entry = handlers[root.dataset.flued];
  if (entry) {
    const [mount, indicator] = entry;
    if (indicator) mount(context).catch(error => reportError(context, indicator, error));
    else mount(context);
  }
  return () => controller.abort();
}