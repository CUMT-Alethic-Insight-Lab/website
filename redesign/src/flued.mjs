import { sourceNotes } from './flued-source-notes.mjs';

const word = (lang, zh, en) => lang === 'en' ? en : zh;
const fluedText = value => String(value ?? '').replace(/[&<>"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
})[char]);
const escape = fluedText;
const repo = 'https://github.com/wdd9700/FLUED';
const branch = 'copilot/implement-stage-a-experiments';

const chapters = [
  ['flued.html', '总览', 'Overview'],
  ['flued-architecture.html', '架构', 'Architecture'],
  ['flued-demo.html', '推理演示', 'Inference demo'],
  ['flued-evidence.html', '训练证据', 'Training evidence'],
  ['flued-experiments.html', '实验图谱', 'Experiment atlas'],
];

const nextChapters = [
  ['/flued-architecture.html#evolution', '追踪各代架构', 'Trace the architecture'],
  ['/flued-demo.html#input', '运行推理演示', 'Run the inference demo'],
  ['/flued-evidence.html#curves', '比较训练证据', 'Compare training evidence'],
  ['/flued-experiments.html#ledger', '查阅完整实验台账', 'Browse the full experiment ledger'],
  ['/flued.html#boundary', '回到结论的适用范围', 'Return to the scope of the claims'],
];

const headingIds = { thesis: 'question-title' };
const bay = (id, title, body) => {
  const headingId = headingIds[id] ?? `${id}-title`;
  return `<section class="bay f-bay" id="${id}" aria-labelledby="${headingId}">
    <h2 id="${headingId}">${escape(title)}</h2>${body}
  </section>`;
};

const register = (rows, label) => `<dl class="register f-register"${label ? ` aria-label="${escape(label)}"` : ''}>${rows.map(([term, detail]) => `
  <div><dt>${escape(term)}</dt><dd>${detail}</dd></div>`).join('')}</dl>`;
const link = (href, label) => `<a class="action f-action" href="${escape(href)}"><span>${escape(label)}</span><span aria-hidden="true">-&gt;</span></a>`;
const text = value => `<p>${escape(value)}</p>`;
const note = value => `<p class="f-note">${escape(value)}</p>`;
const status = (key, value) => `<p class="f-status" data-f-${key} role="status">${escape(value)}</p>`;
const place = key => `<div data-f-${key}></div>`;
const pick = (name, label) => `<label class="f-field"><span>${escape(label)}</span><select data-f-${name} disabled></select></label>`;
const tools = (...controls) => `<div class="f-tools">${controls.join('')}</div>`;

function frame(lang, key, sections) {
  const t = (zh, en) => word(lang, zh, en);
  const next = nextChapters[chapters.findIndex(([file]) => file === key)];
  return `<div class="flued" data-flued="${key}">
    <nav class="f-chapters" aria-label="${t('FLUED 章节', 'FLUED chapters')}">${chapters.map(([file, zh, en], i) => `
      <a href="/${file}"${file === key ? ' aria-current="page"' : ''}>
        <span aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>${t(zh, en)}
      </a>`).join('')}</nav>
    <nav class="f-index" aria-label="${t('本页索引', 'On this page')}">${sections.map(([id, title]) => `<a href="#${id}">${escape(title)}</a>`).join('')}</nav>
    ${sections.map(([id, title, body]) => {
      const notes = sourceNotes[key]?.[id];
      const appendix = notes ? `<details class="f-source-notes"><summary>${t('展开研究细节', 'Expand research details')}</summary><div>${t(...notes)}</div></details>` : '';
      return bay(id, title, body + appendix);
    }).join('')}
    <div class="f-return">${link(next[0], t(next[1], next[2]))}${link('/index.html#projects', t('返回项目', 'Back to projects'))}${link(`${repo}/tree/${branch}`, t('研究代码', 'Research code'))}</div>
  </div>`;
}

const pipeline = [
  ['512B', 'Byte stream', '原始字节流', '一次输入完整的 512 字节样本，无窗口滑动。', 'The encoder receives the full 512-byte sample in one pass, without striding.'],
  ['S0', 'Frozen segmentor', '冻结的分段器', '9 层轻量 DiT 从段落标签预训练，教师边界 F1 为 0.886。', 'A 9-layer slim DiT is pretrained on paragraph labels. Teacher-boundary F1 is 0.886.'],
  ['CUT', 'Dynamic cuts', '动态切分', 'tanh 置信度超过 0.94 时切分。UTF-8 续字节不会被切开，首字节保留起点。', 'Cuts require tanh confidence above 0.94. UTF-8 continuation bytes stay intact, and byte zero starts a chunk.'],
  ['MEM', 'Chunk summarizer', '分段汇聚', '四槽注意力池化与 FFN 将每段聚合成 512 维 memory。', 'Four-slot attention pooling and an FFN aggregate each chunk into a 512-dimensional memory.'],
  ['KDA', 'KDA state machine', 'KDA 状态机', 'WriteHead 逐段写入 k、v 与 β、α 门控。状态有 4 个头，按样本创建，传输时只保留读出。', 'WriteHead emits k, v and β/α gates per chunk. Four state heads are scoped to the sample. Only the readout is transmitted.'],
  ['PACK', 'Readout package', '读出包', '一次查询从最终状态读出 1,024 维，经 MLP 映射为 1,536 个标量。', 'One query reads 1,024 dimensions from final state, then an MLP maps the result to 1,536 scalars.'],
  ['DECODE', 'Shared span decoder', '共用字节解码器', '直接还原或经过三层 TinyBackbone 改写后还原。解码器复用编码器的字节表并输出余弦 logits。', 'The decoder restores bytes directly or after a three-layer TinyBackbone rewrite. It shares the encoder byte table and outputs cosine logits.'],
];

function outline(lang) {
  const t = (zh, en) => word(lang, zh, en);
  return frame(lang, 'flued.html', [
    ['thesis', t('让模型自己决定在哪里切分', 'Let the model learn where to cut'),
      text(t('FLUED 是字节级语言建模研究。输入从 UTF-8 字节开始，模型在编码时决定何处形成语义段，再从压缩后的连续表示还原字节。', 'FLUED studies language modeling at the byte level. The encoder learns where to group UTF-8 bytes into semantic chunks, then restores bytes from a compressed continuous representation.')) +
      `<div class="f-byte-path" aria-hidden="true"><span>512B</span><i></i><span>[ CUT ]</span><i></i><span>1x1536</span></div>` +
      link('/flued-demo.html#input', t('打开推理演示', 'Open inference demo'))],
    ['roi', t('在同一段文本上对照切分', 'Compare cuts on the same text'),
      text(t('选择两种方法，比较真实字节偏移和切分密度。切换样本语言会更换输入文本。', 'Select two methods to compare actual byte offsets and chunk density. Switching the sample language changes the source text.')) +
      tools(pick('sample', t('样本文本', 'Sample text')), pick('method-a', t('对照 A', 'Method A')), pick('method-b', t('对照 B', 'Method B'))) +
      status('sample-status', t('正在读取切分样本…', 'Loading segmentation samples…')) + place('showcase') +
      note(t('预计算、单样本。偏移使用 UTF-8 字节索引。切分数量可用于比较这个样本上的行为。', 'Precomputed examples use UTF-8 byte offsets. Segment counts describe behavior on the selected sample.'))],
    ['research-feed', t('v3.6 研究入口', 'Explore v3.6'),
      register([
        ['512B → 1,536', link('/flued-architecture.html#pipeline', t('追踪读出数据流', 'Trace the readout pipeline'))],
        ['0.149 / 0.142', link('/flued-experiments.html#frontier', t('核对受控比较', 'Inspect the controlled comparison'))],
        ['S0.5 / S0.7', link('/flued-architecture.html#frontier', t('查看分段与检索诊断', 'Read the boundary and retrieval diagnoses'))],
        ['V2 / V3', link('/flued-evidence.html#curves', t('读训练日志与严格掩码结果', 'Read training logs and strict masked-source results'))],
      ])],
    ['history', t('研究沿革', 'Research history'),
      register([
        ['v1', t('建立软分段和近似逆译码原型。早期正向结果只属历史口径。', 'Established a prototype for soft segmentation and approximate inversion. Early positive results belong to the historical protocol.')],
        ['v2', t('去噪提高了重建稳定性，公平 D1 比较仍落后 BPE。', 'Denoising improved reconstruction stability. The fair D1 comparison still favored BPE.')],
        ['v3 / v3.4', t('把编码与骨干接口分开，先遮盖源字节再编码，独立测量传输与还原。', 'Separated encoder and backbone interfaces, and masked the source before encoding to measure transmission and restoration separately.')],
        ['v3.6', t('组件预训练高于端到端，动态边界贡献主要增益。S0.5 调整粒度，S0.7 定位读取瓶颈。', 'Component pretraining outperformed end-to-end training. Dynamic boundaries explained the main gain. S0.5 tuned granularity and S0.7 localized the readout bottleneck.')],
      ]) + link('/flued-experiments.html#ledger', t('查实验台账', 'Read the experiment ledger'))],
    ['evidence', t('可直接核对的结果', 'Results you can verify'),
      register([
        ['D1 · 2048B / 100K', 'BPE-8K 0.8066 BPB · FLUED v2 0.8732 BPB · BLT reproduction 2.3996 BPB'],
        ['v3.6 · masked', t('0.149 @ 1,536 标量对 HNet-DiT 瓶颈臂 0.142 @ 97,540 标量。同语料、20K 步、38–44M 参数规模、单种子。', '0.149 at 1,536 scalars versus HNet-DiT bottleneck 0.142 at 97,540 scalars. Shared corpus, 20K steps, matched 38–44M scale, single seed.')],
        ['S0.7 · unmasked', t('逐段条件化达到 0.351 / PPL 12.1。masked 0.141 未达预注册线，属非默认诊断臂。', 'Per-chunk conditioning reached 0.351 / PPL 12.1. Masked accuracy of 0.141 missed the preregistered threshold. This is a non-default diagnostic arm.')],
      ])],
    ['architecture', t('从自编码器到状态机', 'From autoencoder to state machine'),
      text(t('早期共用字节嵌入表探索可逆重建。现行 v36.1 将预训练分段器、KDA 状态机与共享解码器明确分工。', 'Early work used a shared byte embedding table to explore reversible reconstruction. Canonical v36.1 separates the pretrained segmentor, KDA state machine and shared decoder.')) +
      link('/flued-architecture.html#evolution', t('查看架构沿革', 'Follow the architecture history'))],
    ['references', t('相关研究', 'Related research'),
      register([
        ['BLT', t('用熵驱动动态 patching，提供动态粒度参照。', 'Uses entropy-driven dynamic patching, providing a reference for variable granularity.')],
        ['H-Net', t('用隐藏表示之间的不相似度学习边界，作为动态分段对照。', 'Learns boundaries from hidden-state dissimilarity, serving as a dynamic chunking comparison.')],
        ['BPE', t('固定词表的强基线，以 BPB 对照下一字节建模。', 'A strong fixed-vocabulary baseline for next-byte comparison in bits per byte.')],
      ])],
    ['boundary', t('结论的适用范围', 'Scope of the claims'),
      text(t('目前支持按指定设置进行字节切分、压缩和恢复。单种子结果限于报告的模型、语料与评测协议。跨规模、跨语料或全面超越 BPE 仍需要相应实验。', 'Current evidence supports byte segmentation, compression and restoration under the specified setups. Single-seed results are scoped to the reported model, corpus and protocol. Claims across scale, across corpora or about general superiority to BPE require further experiments.'))],
  ]);
}

function architecture(lang) {
  const t = (zh, en) => word(lang, zh, en);
  const files = [
    ['Byte embedding / segmentor', 'flued/v36/model.py#L83-L107'],
    ['ChunkSummarizer', 'flued/v36/model.py#L141-L163'],
    ['KDA / readout', 'flued/v36/model.py#L166-L211'],
    ['Forward / decoding', 'flued/v36/model.py#L264-L369'],
    ['v3.6 training', 'tools/train/v3_6/train_v36.py'],
    ['S0 training', 'tools/train/v3_6/train_s0_segmentor.py'],
    ['H-Net reproduction', 'flued/hnet_repro/model.py'],
  ];
  return frame(lang, 'flued-architecture.html', [
    ['pipeline', t('沿数据流检查每个节点', 'Inspect each step of the pipeline'),
      `<div class="f-machine"><ol class="f-machine-steps">${pipeline.map(([id, en, zh, detailZh, detailEn], i) => `<li><button class="action f-action" type="button" data-f-step="${i}" data-description="${escape(t(detailZh, detailEn))}" aria-controls="f-step-panel" aria-pressed="${i === 0}"><code>${id}</code><span>${t(zh, en)}</span></button></li>`).join('')}</ol>
        <div class="f-machine-detail" id="f-step-panel" data-f-step-panel aria-live="polite"><code>[512B] -&gt; [S0]</code><h3>${t(pipeline[0][2], pipeline[0][1])}</h3>${text(t(pipeline[0][3], pipeline[0][4]))}</div></div>` +
      `<details><summary>${t('阅读完整节点说明', 'Read all node descriptions')}</summary>${register(pipeline.map(([id, en, zh, detailZh, detailEn]) => [`${id} / ${t(zh, en)}`, escape(t(detailZh, detailEn))]))}</details>`],
    ['evolution', t('各代架构解决的问题', 'What each architecture addressed'),
      register([
        ['v1 · Tied AE', t('共用权重的自编码器验证软边界可运行。', 'The tied-weight autoencoder established that soft boundaries could train.')],
        ['v2 · Denoising', t('成规模的去噪重建，并观察压缩目标受影响的范围。', 'Scaled denoising reconstruction and measured its effects on the compression objective.')],
        ['v3 / v3.4', t('区分 readout 与 summary，从先编码再掩码改成严格源字节掩码。', 'Separated readout from summary and adopted strict source masking before encoding.')],
        ['v3.6 · KDA', t('冻结 S0 分段器，用组件预训练和归因矩阵校验模块贡献。', 'Froze the S0 segmentor and used component pretraining and an attribution matrix to test module contributions.')],
      ])],
    ['tasks', t('同一个读出包，两条还原路径', 'One readout package, two restoration paths'),
      register([
        [t('直接还原', 'Direct restoration'), t('读出包直接送入共享 span 解码器，检查原始字节能否精确还原。', 'The shared span decoder consumes the readout package and tests exact recovery of the original bytes.')],
        [t('骨干改写后还原', 'Restore after backbone rewrite'), t('对源字节做约 5% 的掩码，span 长 1–8 字节。TinyBackbone 改写表示后送入解码器。', 'Mask roughly 5% of source bytes in spans of 1–8 bytes. TinyBackbone rewrites the representation before decoding.')],
      ]) + link('/flued-demo.html#segments', t('检查模型输出', 'Inspect model output'))],
    ['evidence', t('公平比较的口径', 'Comparison protocol'), text(t('v3.6 与 HNet-DiT 瓶颈臂使用同语料、同 20K 步和严格掩码口径。无压缩标准臂作为天花板锚点。', 'v3.6 and the HNet-DiT bottleneck arm share a corpus, 20K steps and the strict masking protocol. The uncompressed standard arm serves as a ceiling anchor.')) + link('/flued-experiments.html#frontier', t('查看比较点', 'See comparison points'))],
    ['compare', t('边界与传输对照', 'Compare boundaries and transmission'), register([
      ['FLUED v3.6', t('S0 学习边界，KDA 汇聚状态，默认传输单个 1,536 标量包。', 'S0 learns cuts, KDA aggregates state, and the canonical route transmits a single 1,536-scalar package.')],
      ['H-Net', t('依隐藏表示学习动态分块。这里把 AR next-byte 与 DiT 补全实验分别阅读。', 'Learns dynamic chunks from hidden representations. AR next-byte and DiT infilling use separate evaluation protocols.')],
      ['BLT / BPE', t('前者使用熵驱动 patching，后者沿固定词表边界编码。', 'BLT uses entropy-driven patching. BPE encodes with a fixed vocabulary.')],
    ])],
    ['frontier', t('S0.5–S0.7 定位检索瓶颈', 'S0.5–S0.7 localize a retrieval bottleneck'),
      text(t('GRPO 优化的 R4 臂平均切出 24.3 段，对应约 21B 人工标注粒度。S0.7 逐段条件化将 unmasked accuracy 从 0.190 提至 0.351，PPL 从 33.9 降到 12.1。掩码补全未达预注册线，默认架构仍是 v36.1。', 'The GRPO R4 arm averaged 24.3 chunks, near the 21-byte human-marked granularity. S0.7 per-chunk conditioning moved unmasked accuracy from 0.190 to 0.351 and PPL from 33.9 to 12.1. Masked infilling missed the preregistered threshold. v36.1 remains canonical.'))],
    ['code', t('按节点查阅研究源码', 'Read the research source by component'),
      register(files.map(([name, path]) => [name, link(`${repo}/blob/${branch}/${path}`, path)]))],
  ]);
}

function demo(lang) {
  const t = (zh, en) => word(lang, zh, en);
  const output = t('运行样本后查看结果。', 'Run a sample to see the result.');
  return frame(lang, 'flued-demo.html', [
    ['input', t('选择输入并运行', 'Choose an input and run'),
      `<form data-f-demo-form>
        ${tools(pick('preset', t('预置样本', 'Preset sample')), `<button class="action f-action" type="submit" data-f-run disabled>${t('运行演示', 'Run demo')} <span aria-hidden="true">-&gt;</span></button>`)}
        <label class="f-field f-input"><span>${t('输入文本', 'Input text')}</span><textarea data-f-input rows="5" readonly aria-describedby="f-demo-mode"></textarea></label>
        <p class="f-note" id="f-demo-mode" data-f-demo-mode></p>
        ${status('demo-status', t('正在读取录样…', 'Loading recorded sample…'))}
      </form>`],
    ['segments', t('模型切分', 'Model segmentation'), `${pick('model', t('选择模型', 'Select model'))}<div data-f-segments>${note(output)}</div>`],
    ['completion', t('掩码补全', 'Masked completion'), `<div data-f-completion>${note(output)}</div>`],
    ['timing', t('推理耗时', 'Inference latency'), `<div data-f-timing>${note(output)}</div>`],
  ]);
}

function evidence(lang) {
  const t = (zh, en) => word(lang, zh, en);
  return frame(lang, 'flued-evidence.html', [
    ['curves', t('按同一协议读取训练曲线', 'Read training curves under a shared protocol'),
      text(t('每 100 步保留原始日志点。曲线不抽样，NaN 对应训练异常及曲线缺口。', 'The curves retain the original 100-step log points without downsampling. NaN values mark training failures and gaps.')) +
      tools(pick('group', t('实验组', 'Experiment group')), pick('metric', t('读数', 'Metric'))) +
      status('curve-status', t('正在读取训练日志…', 'Loading training logs…')) + place('plot')],
    ['strict', t('先遮盖源字节，再编码', 'Mask source bytes before encoding'),
      text(t('严格掩码比较在进入编码器前遮盖字节，避免干净读出信息进入对照。', 'Strict masking hides bytes before they reach the encoder so clean readouts cannot leak into the comparison.')) +
      pick('strict-metric', t('严格掩码指标', 'Strict masking metric')) + place('strict-results')],
    ['reading', t('如何解读', 'How to interpret these results'), register([
      [t('训练形态', 'Training trajectory'), t('同组同指标比较收敛速度、跨种子一致性与边界统计。折线经过所有有效日志点，缺失记录保留为缺口。', 'Compare convergence, seed consistency and boundary statistics within the same group and metric. The line passes through all valid logged points and retains gaps for missing values.')],
      ['v3.2.1 · strict masked-source', t('屏蔽输入字节后，byte baseline 的掩码准确率为 0.1440，无 memory 的 latent readout 达 0.1898。', 'With masking applied to source bytes, masked accuracy was 0.1440 for the byte baseline and 0.1898 for the latent readout without memory.')],
      [t('协议边界', 'Protocol boundaries'), t('v1 历史结果与 v2 D1 公平矩阵分别解读。训练重建准确率和严格掩码准确率使用不同的输入。', 'Read historical v1 results separately from the fair v2 D1 matrix. Training reconstruction accuracy and strict masking accuracy use different inputs.')],
    ])],
  ]);
}

function atlas(lang) {
  const t = (zh, en) => word(lang, zh, en);
  return frame(lang, 'flued-experiments.html', [
    ['ledger', t('实验台账', 'Search the experiment ledger'),
      text(t('台账公开关键指标和结论。原始日志、训练语料与 checkpoint 留在内部；公开代码、配置与结果摘要在研究仓库。', 'The ledger publishes key metrics and findings. Raw logs, training corpora and checkpoints stay in the internal archive. The research repository holds public code, configurations and result summaries.')) +
      tools(pick('version', t('版本', 'Version')), pick('stage', t('阶段', 'Stage')), pick('confidence', t('证据等级', 'Evidence level')), `<label class="f-field"><span>${t('检索实验与结论', 'Search experiments and findings')}</span><input type="search" data-f-query disabled></label>`) +
      status('atlas-status', t('正在读取台账…', 'Loading the ledger…')) + place('ledger') + `<div class="f-ledger-pages" data-f-ledger-pages hidden><button class="action f-action" type="button" data-f-prev>&lt;- <span>${t('上一页', 'Previous')}</span></button><output data-f-page></output><button class="action f-action" type="button" data-f-next><span>${t('下一页', 'Next')}</span> -&gt;</button></div>`],
    ['curves', t('在组内对照训练日志', 'Compare logs within a curve group'),
      tools(pick('family', t('曲线组', 'Curve group')), pick('metric', t('读数', 'Metric'))) + place('plot')],
    ['frontier', t('传输量与掩码准确率', 'Transmitted scalars and masked accuracy'),
      text(t('主比较为 0.1485 @ 1,536 对 0.1418 @ 97,540，后者传输约 64 倍标量。协议为 corpus_v3、20K 步、seed 42。横轴以对数显示每 512 字节的传输标量数。', 'The main comparison is 0.1485 at 1,536 versus 0.1418 at 97,540, about 64 times as many transmitted scalars for the latter. The protocol uses corpus_v3, 20K steps and seed 42. The log x-axis measures scalars sent per 512 bytes.')) +
      pick('frontier', t('比较点', 'Comparison point')) + place('frontier-plot') +
      note(t('S0.7 是非默认诊断臂。AR H-Net 的 next-byte BPB 0.653 使用单独指标。', 'S0.7 is a non-default diagnostic arm. AR H-Net next-byte BPB 0.653 uses a separate metric.'))],
    ['reading', t('按证据等级读取结论', 'Read conclusions by evidence level'), register([
      [t('高可信度', 'High confidence'), t('以对应条目的协议为边界；版本或目标改变后重新比较。', 'Interpret results within the listed experiment protocol and rerun comparisons across versions or objectives.')],
      [t('受控单种子', 'Controlled single seed'), t('用于定位机制与建立待复验的模型比较。', 'Use these results for mechanism diagnosis and model comparisons that can be replicated.')],
      [t('历史记录', 'Historical records'), t('追溯实验假设和纠偏过程。含不同训练窗口、数据与日志粒度的条目。', 'Trace hypotheses and corrections. These entries may use different windows, datasets and logging intervals.')],
    ])],
  ]);
}

export const fluedPages = Object.fromEntries([
  ['FLUED', 'FLUED', '让模型从原始字节学习语义边界、压缩表示与还原。', 'Learn semantic boundaries, compressed representations and restoration directly from raw bytes.', 'flued-overview', outline],
  ['FLUED 架构', 'FLUED architecture', '追踪完整样本如何变成一个读出包。', 'Trace a full byte sample into a single readout package.', 'flued-architecture', architecture],
  ['FLUED 推理演示', 'FLUED inference demo', '在同一输入上检查五个模型的切分、补全和耗时。', 'Inspect segmentation, completion and timing from five models on the same input.', 'flued-demo', demo],
  ['FLUED 训练证据', 'FLUED training evidence', '在同一训练协议下读日志，并检查严格掩码对照。', 'Read training logs within one protocol and inspect strict masked-source comparisons.', 'flued-evidence', evidence],
  ['FLUED 实验图谱', 'FLUED experiment atlas', '检索实验记录，读取训练轨迹和传输量对照。', 'Search the experiment ledger and inspect training trajectories and transmission comparisons.', 'flued-atlas', atlas],
].map(([zh, en, introZh, introEn, tone, render], index) => [chapters[index][0], {
  title: [zh, en], intro: [introZh, introEn], tone, render,
}]));