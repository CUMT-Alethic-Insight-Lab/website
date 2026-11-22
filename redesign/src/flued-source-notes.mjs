// Bilingual research details from website c912836, public/flued*.html.
// Content is placed beside the corresponding summary in a native disclosure.
export const sourceNotes = {
  'flued.html': {
    thesis: [
      `<div>
<div>
<p> BPE 把字符串先离散切成 token，再让 embedding 表承载大量语义先验。 FLUED 的出发点是把这一步改成可训练、可还原、可压缩的 byte-to-latent 翻译过程。 </p>
</div>
<div>
<div>
<h3>输入保持字节级</h3>
<p>所有语言、符号和编码细节都保留在 byte stream 中，避免词表边界提前丢失信息。</p>
</div>
<div>
<h3>表示进入连续空间</h3>
<p>readout latent 承载局部语义和位置信息，让外部 backbone 在更平滑的空间中学习。</p>
</div>
<div>
<h3>输出必须可还原</h3>
<p>latent representation 必须能通过 tied decoder 回到 byte，不能只追求不可解释的中间特征。</p>
</div>
</div>
<div>
<div> 核心判断 <strong>语言可以先被翻译为连续潜空间表示，而不是先被永久离散化。</strong>
</div>
<div> 工程约束 <strong>编码成本必须接近 tokenizer / BPE 级别，否则语义优势没有部署价值。</strong>
</div>
<div> 评估底线 <strong>补全任务必须先在 byte 输入层 mask，不能 clean encode 后再遮 readout。</strong>
</div>
</div>
</div>`,
      `<div>
<div>
<p> BPE first discretizes a string into tokens, then lets the embedding table carry much of the semantic prior. FLUED's starting point is to turn this step into a trainable, recoverable, and compressible byte-to-latent translation process. </p>
</div>
<div>
<div>
<h3>Byte-level input</h3>
<p>All languages, symbols, and encoding details stay in the byte stream, so no information is lost early at vocabulary boundaries.</p>
</div>
<div>
<h3>Representation enters a continuous space</h3>
<p>The readout latent carries local semantics and position, letting an external backbone learn in a smoother space.</p>
</div>
<div>
<h3>Output must be recoverable</h3>
<p>The latent representation must return to bytes through a tied decoder; uninterpretable intermediate features alone are not enough.</p>
</div>
</div>
<div>
<div> Core claim <strong>Language can be translated into a continuous latent representation first, instead of being permanently discretized up front.</strong>
</div>
<div> Engineering constraint <strong>Encoding cost must stay near tokenizer / BPE levels, or the semantic advantage has no deployment value.</strong>
</div>
<div> Evaluation baseline <strong>Completion tasks must mask at the byte input layer first — never clean-encode and then mask the readout.</strong>
</div>
</div>
</div>`,
    ],
    history: [
      `<div>
<div>
<p> FLUED 的迭代不是从“小模型”走到“大模型”，而是沿一个问题逐代排雷：软切分能跑通吗、训练稳吗、 严格口径下还有效吗、压到最硬还剩什么。节点是版本，判词是结局——判死的也留在线上，点击跳到对应证据。 </p>
</div>
<div><a href="/flued-architecture.html#evolution"> v0.4 tied 自编码器 软切分 + O(T²) 池化跑通 byte→latent→byte；共享逆后被三重证据判死 历史 </a><a href="/flued-experiments.html#ledger"> v1 最小假设验证 E1v5 recon_acc 0.99999；历史 E3 BPB 1.21 vs BPE 1.48——最早强信号，仅作背景 历史信号 </a><a href="/flued-evidence.html#curves"> v2 训练动力学 三种子重建稳定（0.9993±0.0005）；公平 D1 0.8732 落后 BPE 0.8066——稳定但落后 公平口径 </a><a href="/flued-evidence.html#strict"> v3.2.1 严格 masked-source 先在 byte 层 mask 再 encode：latent readout 0.1898 对 byte 0.1440——v3 最干净正证据 关键证据 </a><a href="/flued-architecture.html#evolution"> v3.3–3.4 模块化与消融矩阵 七模块拆分逐个过消融：共享逆判死、memory/emit 关闭，canonical_v35 固化 截止点 </a><a href="/flued-architecture.html#pipeline"> v3.6 KDA 状态机 512B → 1×1,536 readout 包；同口径 masked 0.149 对 HNet-DiT 瓶颈臂 0.142，传输少约 60× 当前主线 </a><a href="/flued-architecture.html#frontier"> S0.5–0.6 粒度与容量 GRPO 自选停在 24.3 段 ≈ 用户手标 21B；summarizer 容量全因子无效——两案了结 已了结 </a><a href="/flued-experiments.html#frontier"> S0.7 瓶颈定位 逐段条件化 unmasked acc 0.190→0.351、PPL 33.9→12.1：检索瓶颈在 readout 通道，路线活 前沿 </a>
</div>
<p>逐代展开：三代的问题意识</p>
<div>
<div> v1 · 最小假设 <h3>先证明 soft boundary codec 能跑通</h3>
<p> v1 的价值在于把 byte stream -&gt; latent units -&gt; tied inverse bytes 这条链路跑通， E1v5 达到 recon_acc 0.9999、m/n 0.379、bp_std 0.443，并在历史 E3 中出现强 BPB 信号。 问题是短序列还原能力差， 压缩率、阈值和训练参数仍像 magic number，语义质量也不能只靠重建证明。 </p>
</div>
<div> v2 · 训练动力学 <h3>去噪增强了重建，也扰动了压缩目标</h3>
<p> v2 加入 denoising 后三种子重建稳定，但去噪任务、压缩约束和边界分化之间存在冲突。 latent consistency 的均方误差损失曾直接触发 loss 爆炸和边界塌缩； 去噪比例扫描显示 m/n 随噪声漂移，压缩权重扫描在部分 target 上出现 NaN。 </p>
</div>
<div> v3 · 研究谱系 <h3>从自编码器转向语言编码接口</h3>
<p> v3 不再把 reconstruction 当作唯一目标，而是追问 latent readout 是否真的降低外部 backbone 的学习难度。 这让 FLUED 接近 BLT、H-Net、ByteFlow、FLEXITOKENS 等方向共同面对的问题： 如何扩大计算复杂度、语义自然度、训练难度的不可能三角面积。 </p>
</div>
</div>
<div>
<div> historical v1 fair run <strong>1.2114 vs 1.4786 BPB</strong>
<p> v1 soft-boundary autoencoder 在历史 E3 20K 设置中，相比 BPE 有约 18.1% 更低的 bits-per-byte， 并在同一历史设置下优于当时的 BLT reproduction。这是 FLUED 路线最早的强阳性信号。 </p>
</div>
<div> v2 fair D1 rerun <strong>0.8732 BPB vs BPE-8K 0.8066</strong>
<p> v2 在 2048 原始 byte、100K steps、统一 downstream backbone 的矩阵下稳定但落后 BPE。 这说明 v1 信号值得重视，但不能直接外推为生产 tokenizer 替代结论。 </p>
</div>
<div> v3.2.1 strict masked-source <strong>+0.0458 mask accuracy</strong>
<p> 严格在 byte 输入层 mask 后，no-memory latent backbone 明显超过 byte baseline。 这是 v3 系列目前最干净的正向证据。 </p>
</div>
</div>
<div>
<div>v1<p>最小假设：soft segmentation + tied inverse decoder，证明可微 byte codec 有信号，但短序列和超参魔数暴露完成度不足。</p>
</div>
<div>v2<p>大模型与去噪：328M tied model 三种子重建稳定，同时暴露 denoising、compression、boundary 之间的训练动力学冲突。</p>
</div>
<div>v3.1<p>语言编码器原型：readout latent / summary memory / minimal backbone，但早期 clean encode 评估有侧漏风险。</p>
</div>
<div>v3.2.1<p>严格 masked-source：先在 byte 输入层 mask，再 encode，确认 latent readout 对小 backbone 有正向作用。</p>
</div>
<div>v3.3<p>架构截止点：segmentor、interpreter、memory、decoder 职责拆开，转向系统消融和公开复现。</p>
</div>
<div>v3.4<p>消融矩阵（2026-07）：共享逆以三重证据判死、独立 decoder 成为默认；提出 CBIU（counterfactual boundary utility，反事实边界效用）协议评估单点边界贡献。</p>
</div>
<div>v3.6<p>KDA 世代（2026-07/08）：S0 segmentor 预训 F1 0.886；组件预训 +5.8pp 判死端到端；归因矩阵确认增益全部来自 S0 动态边界；S0.5 GRPO 边界优化停于 24.3 段 ≈ 用户手标 21B；S0.7 逐段条件化证明检索瓶颈可解、路线活。</p>
</div>
</div>
</div>`,
      `<div>
<div>
<p> FLUED's iteration is not a march from a small model to a large one, but a generation-by-generation clearing of one question: does soft segmentation work, is training stable, does it survive a strict protocol, and what remains at the hardest setting. Nodes are versions and verdicts are outcomes — even the ruled-out stay on record, each linking to its evidence. </p>
</div>
<div><a href="/flued-architecture.html#evolution"> v0.4 tied autoencoder Soft segmentation + O(T²) pooling ran byte→latent→byte; the shared inverse was later ruled out by triple evidence History </a><a href="/flued-experiments.html#ledger"> v1 Minimal-hypothesis validation E1v5 recon_acc 0.99999; historical E3 BPB 1.21 vs BPE 1.48 — the earliest strong signal, kept as background only Historical signal </a><a href="/flued-evidence.html#curves"> v2 Training dynamics Three-seed reconstruction stable (0.9993±0.0005); fair D1 0.8732 trails BPE 0.8066 — stable but behind Fair protocol </a><a href="/flued-evidence.html#strict"> v3.2.1 Strict masked-source Mask at the byte layer before encode: latent readout 0.1898 vs byte 0.1440 — the cleanest positive evidence of v3 Key evidence </a><a href="/flued-architecture.html#evolution"> v3.3–3.4 Modularity &amp; ablation matrix Seven modules ablated one by one: shared inverse ruled out, memory/emit closed, canonical_v35 frozen Cutoff point </a><a href="/flued-architecture.html#pipeline"> v3.6 KDA state machine 512B → one 1×1,536 readout package; masked 0.149 vs the HNet-DiT bottleneck arm's 0.142 under the same protocol, ~60× less transmission Current mainline </a><a href="/flued-architecture.html#frontier"> S0.5–0.6 Granularity &amp; capacity GRPO chose to stop at 24.3 segments ≈ 21B human-marked granularity; the summarizer-capacity full factorial came back null — both cases settled Settled </a><a href="/flued-experiments.html#frontier"> S0.7 Bottleneck localization Per-chunk conditioning lifted unmasked acc 0.190→0.351 and PPL 33.9→12.1: the retrieval bottleneck sits in the readout channel; the line stays alive Frontier </a>
</div>
<p>Generation by generation: three eras of framing</p>
<div>
<div> v1 · Minimal hypothesis <h3>First prove a soft-boundary codec can run</h3>
<p> v1's value was getting the byte stream -&gt; latent units -&gt; tied inverse bytes chain to work: E1v5 reached recon_acc 0.9999, m/n 0.379, and bp_std 0.443, with a strong BPB signal in the historical E3. The problems: poor short-sequence recovery, compression rate, thresholds, and training hyperparameters still looking like magic numbers, and semantic quality that reconstruction alone cannot prove. </p>
</div>
<div> v2 · Training dynamics <h3>Denoising strengthened reconstruction — and disturbed the compression target</h3>
<p> With denoising added, v2's three-seed reconstruction was stable, but the denoising task, the compression constraint, and boundary divergence conflicted. The MSE loss on latent consistency once directly triggered a loss explosion and boundary collapse; the denoise-ratio scan showed m/n drifting with noise, and the compression-weight scan produced NaN at some targets. </p>
</div>
<div> v3 · Research lineage <h3>From autoencoder to language encoding interface</h3>
<p> v3 stopped treating reconstruction as the sole goal and instead asked whether the latent readout genuinely lowers an external backbone's learning difficulty. This brought FLUED to the question it shares with BLT, H-Net, ByteFlow, and FLEXITOKENS: how to enlarge the impossible triangle of compute complexity, semantic naturalness, and training difficulty. </p>
</div>
</div>
<div>
<div> historical v1 fair run <strong>1.2114 vs 1.4786 BPB</strong>
<p> In the historical E3 20K setting, the v1 soft-boundary autoencoder reached about 18.1% lower bits-per-byte than BPE, and beat the BLT reproduction of the time under the same historical setting — the earliest strong positive signal for the FLUED line. </p>
</div>
<div> v2 fair D1 rerun <strong>0.8732 BPB vs BPE-8K 0.8066</strong>
<p> Under a matrix of 2048 raw bytes, 100K steps, and a unified downstream backbone, v2 was stable but trailed BPE. The v1 signal deserves attention, but it cannot be extrapolated into a production tokenizer-replacement conclusion. </p>
</div>
<div> v3.2.1 strict masked-source <strong>+0.0458 mask accuracy</strong>
<p> With strict masking at the byte input layer, the no-memory latent backbone clearly beat the byte baseline — currently the cleanest positive evidence in the v3 series. </p>
</div>
</div>
<div>
<div>v1<p>Minimal hypothesis: soft segmentation + tied inverse decoder showed a differentiable byte codec has signal, but short sequences and hyperparameter magic numbers exposed its immaturity.</p>
</div>
<div>v2<p>Scale-up and denoising: the 328M tied model reconstructed stably across three seeds, while exposing training-dynamics conflicts among denoising, compression, and boundary.</p>
</div>
<div>v3.1<p>Language-encoder prototype: readout latent / summary memory / minimal backbone, but early clean-encode evaluation risked information leakage.</p>
</div>
<div>v3.2.1<p>Strict masked-source: mask at the byte input layer before encode, confirming latent readout helps a small backbone.</p>
</div>
<div>v3.3<p>Architecture cutoff: segmentor, interpreter, memory, and decoder responsibilities separated; the focus turned to systematic ablation and public reproduction.</p>
</div>
<div>v3.4<p>Ablation matrix (2026-07): the shared inverse was ruled out by triple evidence and a standalone decoder became the default; the CBIU (counterfactual boundary utility) protocol was proposed to score single-point boundary contributions.</p>
</div>
<div>v3.6<p>KDA generation (2026-07/08): S0 segmentor pretraining F1 0.886; component pretraining beat end-to-end by +5.8pp, ruling the latter out; the attribution matrix confirmed all gains come from S0 dynamic boundaries; S0.5 GRPO boundary optimization settled at 24.3 segments ≈ 21B human-marked granularity; S0.7 per-chunk conditioning showed the retrieval bottleneck is solvable — the line stays alive.</p>
</div>
</div>
</div>`,
    ],
    evidence: [
      `<div>
<div>
<div>
<p> 这里保留官网摘要。完整训练历程、100-step 曲线、NaN 断点和 strict masked-source 对照表放在独立证据浏览器中，方便读者直接比较。 </p>
<div><a href="/flued-evidence.html">Open training curves</a><a href="#roi">View boundary ROI</a>
</div>
</div>
<div>
<div> v2 reconstruction <strong>0.9993 +/- 0.0005</strong>
</div>
<div> fair D1 BPE-8K <strong>0.8066 BPB</strong>
</div>
<div> fair D1 FLUED-v2 <strong>0.8732 BPB</strong>
</div>
<div> v3.2.1 gain <strong>+0.0458 mask acc</strong>
</div>
<div> v3.6 masked acc <strong>0.149 @ 1,536 标量</strong>
</div>
</div>
<div>
<h4>v2</h4>
<dl class="register f-register">
<div>
<dt>发现</dt>
<dd>A-class 三种子 eval_acc 0.9991 / 0.9993 / 0.9996，均值 0.9993 +/- 0.0005；说明可微 byte-boundary / reconstruction 稳定。</dd>
</div>
<div>
<dt>研究含义</dt>
<dd>稳定边界学习成立，但不支撑“优于 BPE”。</dd>
</div>
</dl>
<h4>v2 D1</h4>
<dl class="register f-register">
<div>
<dt>发现</dt>
<dd>2048-byte / 100K 公平矩阵中，BPE-8K 0.8066 BPB，FLUED-v2 0.8732 BPB，BLT theta=0.3 reproduction 2.3996 BPB。</dd>
</div>
<div>
<dt>研究含义</dt>
<dd>FLUED 稳定但落后 BPE，这是官网主口径。</dd>
</div>
</dl>
<h4>v3.2.1</h4>
<dl class="register f-register">
<div>
<dt>发现</dt>
<dd>严格 byte-level mask 后，byte baseline mask_acc 0.1440，no-memory latent backbone 达到 0.1898；memory 分支接近但未稳定超过 no-memory。</dd>
</div>
<div>
<dt>研究含义</dt>
<dd>证明 latent interface 可能降低 backbone 学习难度，但 memory gain 仍需严格消融。</dd>
</div>
</dl>
<h4>v3.4</h4>
<dl class="register f-register">
<div>
<dt>发现</dt>
<dd>one-shot DiT-style refinement、硬执行/软反传、并行 no-self memory、RoPE + 小 AR 与 shared inverse decoder 已实现；40K 归因显示动态边界与 hard emit 的课程仍耦合。</dd>
</div>
<div>
<dt>研究含义</dt>
<dd>当前公开重点是架构与梯度的可审计性，不将单种子归因写成最终性能结论。</dd>
</div>
</dl>
<h4>v3.6</h4>
<dl class="register f-register">
<div>
<dt>发现</dt>
<dd>38–44M 同规模、同 20K 步、同语料、同 masked infilling 口径（单 seed）：FLUED v3.6 masked 0.149 @ 1,536 标量，HNet-DiT 瓶颈臂 0.142 @ ~97,540 标量；HNet-DiT 标准臂 0.324 为无压缩天花板锚，不在同一压缩口径。</dd>
</div>
<div>
<dt>研究含义</dt>
<dd>同指标下约 60× 信息效率；受控单种子证据，不做多种子或尺度外推。</dd>
</div>
</dl>
<h4>v3.6 S0.7</h4>
<dl class="register f-register">
<div>
<dt>发现</dt>
<dd>逐段条件化诊断臂：unmasked 全位置 acc 0.351 / PPL 12.1，masked 0.141 未过预注册线；该臂为非默认口径，canonical 维持 v36.1。</dd>
</div>
<div>
<dt>研究含义</dt>
<dd>证明 KDA 状态的检索瓶颈可解、路线活；不进入主结论。</dd>
</div>
</dl>
</div>
</div>
</div>`,
      `<div>
<div>
<div>
<p> This page keeps the site summary. The full training history, 100-step curves, NaN breakpoints, and strict masked-source tables live in a standalone evidence browser for direct comparison. </p>
<div><a href="/flued-evidence.html">Open training curves</a><a href="#roi">View boundary ROI</a>
</div>
</div>
<div>
<div> v2 reconstruction <strong>0.9993 +/- 0.0005</strong>
</div>
<div> fair D1 BPE-8K <strong>0.8066 BPB</strong>
</div>
<div> fair D1 FLUED-v2 <strong>0.8732 BPB</strong>
</div>
<div> v3.2.1 gain <strong>+0.0458 mask acc</strong>
</div>
<div> v3.6 masked acc <strong>0.149 @ 1,536 scalars</strong>
</div>
</div>
<div>
<h4>v2</h4>
<dl class="register f-register">
<div>
<dt>Finding</dt>
<dd>A-class three-seed eval_acc 0.9991 / 0.9993 / 0.9996, mean 0.9993 +/- 0.0005; differentiable byte-boundary / reconstruction is stable.</dd>
</div>
<div>
<dt>Implication</dt>
<dd>Stable boundary learning holds, but does not support "better than BPE".</dd>
</div>
</dl>
<h4>v2 D1</h4>
<dl class="register f-register">
<div>
<dt>Finding</dt>
<dd>In the 2048-byte / 100K fair matrix: BPE-8K 0.8066 BPB, FLUED-v2 0.8732 BPB, BLT theta=0.3 reproduction 2.3996 BPB.</dd>
</div>
<div>
<dt>Implication</dt>
<dd>FLUED is stable but trails BPE — this is the site's main protocol.</dd>
</div>
</dl>
<h4>v3.2.1</h4>
<dl class="register f-register">
<div>
<dt>Finding</dt>
<dd>Under strict byte-level masking: byte baseline mask_acc 0.1440, no-memory latent backbone 0.1898; the memory branch comes close but does not stably beat no-memory.</dd>
</div>
<div>
<dt>Implication</dt>
<dd>Suggests a latent interface can lower backbone learning difficulty, but the memory gain still needs strict ablation.</dd>
</div>
</dl>
<h4>v3.4</h4>
<dl class="register f-register">
<div>
<dt>Finding</dt>
<dd>One-shot DiT-style refinement, hard-execution/soft-backprop, parallel no-self memory, RoPE + small AR, and a shared inverse decoder are implemented; 40K attribution shows the curricula of dynamic boundaries and hard emit remain coupled.</dd>
</div>
<div>
<dt>Implication</dt>
<dd>The current public focus is auditability of architecture and gradients; single-seed attribution is not presented as a final performance conclusion.</dd>
</div>
</dl>
<h4>v3.6</h4>
<dl class="register f-register">
<div>
<dt>Finding</dt>
<dd>Matched 38–44M scale, same 20K steps, same corpus, same masked-infilling protocol (single seed): FLUED v3.6 masked 0.149 @ 1,536 scalars; HNet-DiT bottleneck arm 0.142 @ ~97,540 scalars; the HNet-DiT standard arm's 0.324 is an uncompressed ceiling anchor outside this compression protocol.</dd>
</div>
<div>
<dt>Implication</dt>
<dd>About 60× information efficiency at the same metric; controlled single-seed evidence, with no multi-seed or scale extrapolation.</dd>
</div>
</dl>
<h4>v3.6 S0.7</h4>
<dl class="register f-register">
<div>
<dt>Finding</dt>
<dd>Per-chunk conditioning diagnostic arm: unmasked all-position acc 0.351 / PPL 12.1; masked 0.141 missed the pre-registered bar; the arm is a non-default protocol and canonical stays v36.1.</dd>
</div>
<div>
<dt>Implication</dt>
<dd>Shows the retrieval bottleneck of KDA state is solvable and the line stays alive; it does not enter the main conclusions.</dd>
</div>
</dl>
</div>
</div>
</div>`,
    ],
    references: [
      `<div>
<div>
<div>
<p> FLUED 不是孤立提出的结构。它吸收了 tokenizer-free、动态分块、信息论压缩、 latent diffusion、草稿修正和控制空间映射等方向的启发，但最终目标仍是语言编码器， 不是直接复刻某一种 byte-level LM。 </p>
</div>
<div>
<div> BLT <h3>熵驱动动态 patching</h3>
<p>启发 FLUED 关注 byte-level 动态分块和局部不确定性；FLUED 不依赖大型预训练 ByteLM 作为唯一边界来源。</p>
</div>
<div> ByteFlow / coding rate <h3>用编码率约束压缩</h3>
<p>启发 readout 数量不应只靠 reconstruction loss 控制；v3.3 保留 rate pressure 和消融入口。</p>
</div>
<div> H-Net / FLEXITOKENS / SOMBRERO <h3>边界学习与边界质量</h3>
<p>启发 signed boundary、边界置信度诊断和 ROI 可视化；FLUED 避免把硬规则当作最终 tokenizer。</p>
</div>
<div> MANTa / Charformer / GBST <h3>可微分词与梯度分块</h3>
<p>证明“切分可以学习”这一路线有先例；FLUED 进一步要求 latent 可被 decoder 反向还原为 byte span。</p>
</div>
<div> DiffusionGemma / ELF <h3>连续 latent 空间建模</h3>
<p>启发把 denoise 放在 latent refinement 上，而不是把 FLUED 变成纯 next-byte 自回归模型。</p>
</div>
<div> DSpark <h3>小自回归头做轻量修正</h3>
<p>启发少量串行 correction head，但 v3.3 当前先保留一阶段接口，避免训练和推理成本过早膨胀。</p>
</div>
<div> Mapping Network <h3>低维控制到高维行为</h3>
<p>启发 memory/readout 的控制与 payload 分离：memory 不直接暴露给 backbone，readout 才是外部接口。</p>
</div>
<div> MEGABYTE / Hourglass / Perceiver <h3>层次压缩与长上下文</h3>
<p>启发“本段高清、历史压缩”的长上下文路线；FLUED 把该思想放在 encoder memory，而不是固定 patch。</p>
</div>
</div>
</div>
</div>`,
      `<div>
<div>
<div>
<p> FLUED was not proposed in isolation. It borrows from tokenizer-free modeling, dynamic chunking, information-theoretic compression, latent diffusion, draft correction, and control-space mapping — but its end goal remains a language encoder, not a replica of any particular byte-level LM. </p>
</div>
<div>
<div> BLT <h3>Entropy-driven dynamic patching</h3>
<p>Inspired FLUED's focus on byte-level dynamic chunking and local uncertainty; FLUED does not rely on a large pretrained ByteLM as its only boundary source.</p>
</div>
<div> ByteFlow / coding rate <h3>Compression constrained by coding rate</h3>
<p>Motivated the idea that readout count should not be governed by reconstruction loss alone; v3.3 keeps rate pressure and an ablation entry.</p>
</div>
<div> H-Net / FLEXITOKENS / SOMBRERO <h3>Boundary learning and boundary quality</h3>
<p>Inspired signed boundaries, boundary-confidence diagnostics, and ROI visualization; FLUED avoids treating hard rules as the final tokenizer.</p>
</div>
<div> MANTa / Charformer / GBST <h3>Differentiable tokenization and gradient chunking</h3>
<p>Established precedent that segmentation can be learned; FLUED further requires the latent to be decodable back into byte spans.</p>
</div>
<div> DiffusionGemma / ELF <h3>Modeling in a continuous latent space</h3>
<p>Motivated placing denoising on latent refinement rather than turning FLUED into a pure next-byte autoregressive model.</p>
</div>
<div> DSpark <h3>A small autoregressive head for lightweight correction</h3>
<p>Inspired a few serial correction heads, though v3.3 keeps a one-stage interface for now to avoid inflating training and inference cost too early.</p>
</div>
<div> Mapping Network <h3>Low-dimensional control to high-dimensional behavior</h3>
<p>Inspired the control/payload split between memory and readout: memory is never exposed directly to the backbone; the readout is the external interface.</p>
</div>
<div> MEGABYTE / Hourglass / Perceiver <h3>Hierarchical compression and long context</h3>
<p>Inspired the "current segment in high resolution, history compressed" long-context line; FLUED places this idea in the encoder memory rather than fixed patches.</p>
</div>
</div>
</div>
</div>`,
    ],
    boundary: [
      `<div>
<div>
<div>
<h3>可以主张</h3>
<ul>
<li>FLUED 是 Alethic Insight 的 tokenizer-free language interface 研究项目。</li>
<li>v2 证明了稳定重建和可微边界的可行性。</li>
<li>v2 公平 D1 证明 FLUED-v2 稳定但仍落后 BPE。</li>
<li>v3.2.1 在严格协议下证明 latent readout 对小 backbone 有帮助：0.1898 mask_acc vs byte baseline 0.1440。</li>
<li>v3.3 把问题明确推进到 byte-level language encoder 的计算复杂度、语义自然度、训练难度三角。</li>
<li>v3.3 提供了清晰的开源架构、参数接口和消融入口。</li>
<li>v3.6 在同规模、同步数、同语料、同 masked infilling 口径下 masked 0.149 超过 HNet-DiT 瓶颈臂 0.142，信息传输少约 60×（单 seed 受控证据）。</li>
</ul>
</div>
<div>
<h3>暂不主张</h3>
<ul>
<li>FLUED 已经替代 BPE。</li>
<li>FLUED 已经击败 BLT、H-Net、ByteFlow 等近期系统。</li>
<li>memory branch 已被证明是默认主线。</li>
<li>v1 历史 BPB 优势已经被 v2/v3 在所有新设置中复现。</li>
<li>reconstruction accuracy 等于语义质量。</li>
<li>v3.3 已经彻底解决训练参数 magic number 和可塑性问题。</li>
<li>v3.3 已经完成系统实验并证明优于近期 tokenizer-free 系统。</li>
</ul>
</div>
</div>
</div>`,
      `<div>
<div>
<div>
<h3>We claim</h3>
<ul>
<li>FLUED is Alethic Insight's research project on tokenizer-free language interfaces.</li>
<li>v2 demonstrated stable reconstruction and feasible differentiable boundaries.</li>
<li>The v2 fair D1 run showed FLUED-v2 is stable but still trails BPE.</li>
<li>v3.2.1 showed under a strict protocol that latent readout helps a small backbone: 0.1898 mask_acc vs byte baseline 0.1440.</li>
<li>v3.3 sharpened the problem into the compute-complexity / semantic-naturalness / training-difficulty triangle of a byte-level language encoder.</li>
<li>v3.3 provides a clear open-source architecture, parameter interface, and ablation entries.</li>
<li>v3.6, at matched scale, steps, corpus, and masked-infilling protocol, reached masked 0.149 vs the HNet-DiT bottleneck arm's 0.142 with ~60× less information transmission (controlled single-seed evidence).</li>
</ul>
</div>
<div>
<h3>We do not claim</h3>
<ul>
<li>That FLUED has replaced BPE.</li>
<li>That FLUED has beaten recent systems such as BLT, H-Net, or ByteFlow.</li>
<li>That the memory branch is proven as the default mainline.</li>
<li>That v1's historical BPB advantage has been reproduced by v2/v3 across all new settings.</li>
<li>That reconstruction accuracy equals semantic quality.</li>
<li>That v3.3 has fully solved the magic-number hyperparameter and plasticity problems.</li>
<li>That v3.3 has completed systematic experiments proving superiority over recent tokenizer-free systems.</li>
</ul>
</div>
</div>
</div>`,
    ],
  },
  'flued-architecture.html': {
    evolution: [
      `<div>
<div>
<p>追踪的意思是逐节点对照真实代码：每张卡是一条从上而下的前向流水线，节点对应公开仓库里的具体模块，卡尾记录该代的结局。下方先给当前主线 v3.6（S0.5 GRPO 是它的训练阶段延伸，作从属卡挂在主卡之后，不占独立代际），再按时间序回溯 v0.4 → v2 → v3.1 → v3.2 → v3.3 → v3.4 六代，最后把竞争对手 BLT / H-Net / BPE 放到同一尺度上对照。</p>
</div>
<h3>当前主线 · v3.6（KDA 世代）</h3>
<div>
<div> v3.6 · flued/v36/model.py（369 行）· canonical v36.1 <h3>整条 prompt → 单个 readout 包</h3>
<p><strong>状态：</strong>当前主线。S0 动态边界 + KDA 串行状态把 512B prompt 压成 1×1,536 标量；masked 0.149 打赢 HNet-DiT 瓶颈臂 0.142（单 seed 同口径）。</p>
<ol>
<li>字节流 512B<small>单样本全上下文 · 无窗口无 stride</small>
</li>
<li>PlainByteLookup<small>d_byte 384 · PAD-offset</small>
</li>
<li>byte encoder ×3<small>DiTStyleBlock · RoPE + ALiBi</small>
</li>
<li>segmentor ×9 + head<small>S0 段落标签预训后冻结 · 教师 F1 0.886</small>
</li>
<li>tanh 有界置信度 → 动态切分<small>conf &gt; 0.94 · UTF-8 续字节禁切 · 首字节强切 · 容量截断</small>
</li>
<li>ChunkBuilder<small>max 64 chunks / span 64</small>
</li>
<li>ChunkSummarizer<small>4 slot 注意力池化 + FFN → d_mem 512（每段一个 memory）</small>
</li>
<li>WriteHead<small>k L2 归一 · v · β sigmoid（bias −2）· α 逐通道衰减</small>
</li>
<li>KDAStateMachine<small>S ← αS − βk(kᵀS) + βkvᵀ · 4 头 k128/v256 · 状态随样本生灭</small>
</li>
<li>readout query ×1 + realign<small>终态读出 4×256=1,024 → MLP realign → 包 1×1,536</small>
</li>
<li>TinyBackbone<small>3L pre-norm · 仅任务二经过</small>
</li>
<li>GlobalSpanDecoder<small>与 encoder 共享 byte 表 · cosine logits</small>
</li>
<li>byte logits<small>任务一 direct 精准还原 · 任务二 backbone 改写后还原（5% span 1-8 原生 mask）</small>
</li>
</ol>
<p><strong>瓶颈备注：</strong>v36.1 decoder 条件 = package.mean + chunk_pos 广播；S0.7 逐段条件化已证检索瓶颈可解（unmasked 0.351 / PPL 12.1），但非默认。</p>
</div>
<div> S0.5 · 挂在 v3.6 主线之后 · 不改架构 <h3>GRPO 边界优化 训练阶段 · 非独立架构</h3>
<p><strong>结局：</strong>hard 停点 24.3 段 ≈ 用户手标 21B，教师粒度之争了结；质量与控制臂打平——GRPO 当前价值 = 选粒度，非提质量。</p>
<ol>
<li>v3.6 已训基线<small>自 3K 检查点续训 2K 步</small>
</li>
<li>同前缀采 G=8 个切分方案<small>组内排名优势 · 免 value net</small>
</li>
<li>约束走可微直接损失<small>E[count] = Σcut_prob（不走采样计数率项）</small>
</li>
<li>微调边界 + β 写入门<small>R4 定稿；R1–R3 三轮失败教训见下方 #frontier</small>
</li>
</ol>
</div>
</div>
<h3>历代架构（按时间序 v0.4 → v3.4）</h3>
<div>
<div> v0.4 · flued/model.py · FLUEDAutoencoder <h3>tied 权重自编码器</h3>
<p><strong>结局：</strong>共享逆被三重证据判死，tied inverse 路线关闭。</p>
<ol>
<li>byte ids<small>vocab 257 · PAD-offset</small>
</li>
<li>tied Transformer blocks<small>encoder / decoder 共享同一组权重</small>
</li>
<li>sigmoid(Linear(ΔH))<small>相邻隐状态差 ΔH = h_t − h_{t−1} → 边界概率</small>
</li>
<li>软指派矩阵 A<small>O(T²) 池化 · 可微切分（训练期）</small>
</li>
<li>latent units</li>
<li>tied inverse decoder<small>逆序减块（MHA / FFN 减回）· 与正向共享参数</small>
</li>
<li>bytes 还原</li>
</ol>
</div>
<div> v2 · flued/model.py · 328M tied 放大 + 去噪目标 <h3>去噪重建规模化</h3>
<p><strong>结局：</strong>三种子重建稳定，但暴露 denoising / compression / boundary 训练动力学冲突；公平 D1 稳定但落后 BPE（0.8732 vs 0.8066 BPB）。</p>
<ol>
<li>byte / mask ids<small>vocab 258 · MASK_ID 257 · PAD-offset</small>
</li>
<li>tied Transformer blocks<small>SDPA + SwiGLU 3072 · 动态正弦 PE</small>
</li>
<li>boundary_head(ΔH)<small>五类字节类型边界先验（utf8_cont / ascii / cjk / op / digit）</small>
</li>
<li>banded 软指派矩阵 A<small>log-space · assignment_window 128</small>
</li>
<li>latent units<small>length-aware 压缩目标</small>
</li>
<li>tied inverse decoder<small>逆序减块 · 与正向共享参数</small>
</li>
<li>bytes 还原<small>clean / denoise 混合（denoise_prob 0.7 · corrupt 15% · span 1-8）</small>
</li>
</ol>
</div>
<div> v3.1 · tools/analysis/v3_1/ · 语言编码器原型 <h3>readout / summary 分工确立</h3>
<p><strong>结局：</strong>2M codec 闭环能学（recon 0.506 · length_acc 0.973 · units/byte 0.117）；latent backbone 小胜 segment-mask byte 基线（0.178 vs 0.150），但早期 clean encode 评估有侧漏风险。</p>
<ol>
<li>byte ids</li>
<li>weak boundary starts<small>UTF-8 / 标点 / 长度弱规则标签</small>
</li>
<li>shared segment representation<small>mean_first_last 聚合</small>
</li>
<li>readout latent<small>对外 backbone 唯一接口</small>
</li>
<li>summary latent → causal memory<small>内部机制 · 只读旧 memory · 段后写入</small>
</li>
<li>length / slot allocator<small>显式 span 长度 1..Lmax</small>
</li>
<li>latent-to-byte decoder</li>
<li>byte span</li>
</ol>
</div>
<div> v3.2 / v3.2.1 · strict masked-source <h3>先 mask 后 encode</h3>
<p><strong>结局：</strong>先在 byte 输入层 mask、再 encode，堵住 clean readout 侧漏；严格口径下 latent backbone 明显超过 byte 基线（mask_acc 0.1898 vs 0.1440，+0.046）——当时 v3 系列最干净的正向证据。</p>
<ol>
<li>byte ids</li>
<li>byte 输入层先 mask<small>strict masked-source · 堵 clean encode 侧漏</small>
</li>
<li>memory-free boundary<small>boundary 不读 memory，防互相污染</small>
</li>
<li>memory-conditioned interpreter<small>chunk + 过去 memory → readout</small>
</li>
<li>causal append-only summary<small>top-k retrieval 未证默认收益，留实验分支</small>
</li>
<li>readout latent → minimal backbone<small>masked latent infill 验证</small>
</li>
<li>latent-to-byte decoder</li>
<li>byte span</li>
</ol>
</div>
<div> v3.3 · flued/v33/ · 模块化拆分 <h3>职责边界确立</h3>
<p><strong>结局：</strong>架构截止点——各职责拆成独立模块，转向系统消融与公开复现。</p>
<ol>
<li>StructuredByteLookup</li>
<li>SignedBoundarySegmentor</li>
<li>DualThresholdPolicy</li>
<li>ChunkBuilder</li>
<li>LatentMemoryInterpreter<small>读 other-memory，不读当前段</small>
</li>
<li>CausalLowRankSequenceMemory</li>
<li>SharedParameterDecoder</li>
</ol>
</div>
<div> v3.4 · flued/v34/model.py · 单体 probe + 消融矩阵 <h3>消融驱动取舍</h3>
<p><strong>结局：</strong>memory / emit 举证失败关闭；plain lookup + 独立 decoder + uniform 边界固化为 canonical_v35。</p>
<ol>
<li>PlainByteLookup</li>
<li>DiTStyleBlock 堆叠<small>RoPE + ALiBi + 噪声条件</small>
</li>
<li>FixedDualThresholdPolicy<small>+ SoftBoundaryBridge 硬执行软反传</small>
</li>
<li>ChunkBuilder</li>
<li>QueryPool / DenseNoSelfMemory<small>并行 · no-self</small>
</li>
<li>SmallChunkARCorrection<small>chunk 内小 AR 修正</small>
</li>
<li>rate_emit<small>硬发声计入真实计算账本</small>
</li>
<li>SpanDecoder<small>独立 / 共享逆两臂对照</small>
</li>
</ol>
</div>
</div>
<h3>竞争对手：同一个问题的三种回答</h3>
<div>
<div> 竞争对手 · BLT · blt_baseline/model.py <h3>熵驱动动态 patching</h3>
<p><strong>信号性质：</strong>纯局部统计——边界来自 byte LM 的逐字节熵，不为下游任务学习语义边界。</p>
<ol>
<li>byte LM<small>d512 / 4L · 逐字节 entropy</small>
</li>
<li>EntropyPatcher<small>熵超阈值下刀</small>
</li>
<li>local encoder / decoder<small>patch 内局部进出</small>
</li>
</ol>
</div>
<div> 竞争对手 · H-Net · flued/hnet_repro/model.py <h3>余弦不相似度动态分块</h3>
<p><strong>E20 现象：</strong>无显式压缩激励时边界退化——DiT 标准臂 ~1 chunk，瓶颈臂 ~190 chunks，无中间态。</p>
<ol>
<li>byte encoder ×2<small>causal block · RoPE</small>
</li>
<li>余弦不相似度 DC<small>0.5·(1−cos) &gt; 0.5 硬下采样 · 直通估计回传</small>
</li>
<li>因果主干 ×9<small>复现用 causal Transformer · 论文 Mamba-2 留 R2</small>
</li>
<li>dechunk → decoder ×3<small>chunk 表示回投字节位</small>
</li>
</ol>
</div>
<div> 竞争对手 · BPE · 离线统计分词 <h3>固定词表，与语义无关</h3>
<p><strong>切分最碎：</strong>同一中文样本 148 段（对照 v3.6 S0 臂 ~13 段）；边界由离线频次合并决定，与模型语义无关。</p>
<ol>
<li>离线语料统计<small>频次最高字节对迭代合并</small>
</li>
<li>固定词表<small>vocab 8,192</small>
</li>
<li>查表切分<small>在线无参数、不看上下文</small>
</li>
</ol>
</div>
</div>
</div>`,
      `<div>
<div>
<p>Tracing means checking each node against real code: every card is a top-to-bottom forward pipeline whose nodes map to concrete modules in the public repository, with the generation's outcome recorded at the end. Below we start with the current mainline v3.6 (S0.5 GRPO is its training-stage extension, attached as a subordinate card rather than its own generation), then go back in time through v0.4 → v2 → v3.1 → v3.2 → v3.3 → v3.4, and finally place the competitors BLT / H-Net / BPE on the same scale.</p>
</div>
<h3>Current mainline · v3.6 (KDA generation)</h3>
<div>
<div> v3.6 · flued/v36/model.py（369 lines）· canonical v36.1 <h3>Whole prompt → a single readout package</h3>
<p><strong>Status:</strong> current mainline. S0 dynamic boundaries + a serial KDA state compress a 512B prompt into 1×1,536 scalars; masked 0.149 beats the HNet-DiT bottleneck arm's 0.142 (single seed, same protocol).</p>
<ol>
<li>byte stream 512B<small>one sample, full context · no window, no stride</small>
</li>
<li>PlainByteLookup<small>d_byte 384 · PAD-offset</small>
</li>
<li>byte encoder ×3<small>DiTStyleBlock · RoPE + ALiBi</small>
</li>
<li>segmentor ×9 + head<small>pretrained on S0 paragraph labels, then frozen · teacher F1 0.886</small>
</li>
<li>tanh-bounded confidence → dynamic segmentation<small>conf &gt; 0.94 · no cuts at UTF-8 continuation bytes · forced cut at first byte · capacity truncation</small>
</li>
<li>ChunkBuilder<small>max 64 chunks / span 64</small>
</li>
<li>ChunkSummarizer<small>4-slot attention pooling + FFN → d_mem 512 (one memory per chunk)</small>
</li>
<li>WriteHead<small>k L2-normalized · v · β sigmoid (bias −2) · α channel-wise decay</small>
</li>
<li>KDAStateMachine<small>S ← αS − βk(kᵀS) + βkvᵀ · 4 heads k128/v256 · state lives and dies with each sample</small>
</li>
<li>readout query ×1 + realign<small>final-state readout 4×256=1,024 → MLP realign → package 1×1,536</small>
</li>
<li>TinyBackbone<small>3L pre-norm · task two only</small>
</li>
<li>GlobalSpanDecoder<small>shares the byte table with the encoder · cosine logits</small>
</li>
<li>byte logits<small>task one: direct exact restoration · task two: restoration after backbone rewriting (native 5% span 1-8 mask)</small>
</li>
</ol>
<p><strong>Bottleneck note:</strong> the v36.1 decoder condition is package.mean + chunk_pos broadcast; S0.7 per-chunk conditioning has shown the retrieval bottleneck is solvable (unmasked 0.351 / PPL 12.1), but it is not the default.</p>
</div>
<div> S0.5 · attached after the v3.6 mainline · no architecture change <h3>GRPO boundary optimization training stage · not a separate architecture</h3>
<p><strong>Outcome:</strong> hard stop at 24.3 segments ≈ 21B human-marked granularity — the teacher-granularity debate is settled; quality ties the control arm, so GRPO's current value = choosing granularity, not improving quality.</p>
<ol>
<li>trained v3.6 baseline<small>continued 2K steps from the 3K checkpoint</small>
</li>
<li>sample G=8 segmentations per prefix<small>within-group ranking advantage · no value net</small>
</li>
<li>constraint as a differentiable direct loss<small>E[count] = Σcut_prob (no sampled count-rate term)</small>
</li>
<li>fine-tune boundaries + the β write gate<small>R4 finalized; the three failed rounds R1–R3 are documented under #frontier below</small>
</li>
</ol>
</div>
</div>
<h3>Past generations (in time order, v0.4 → v3.4)</h3>
<div>
<div> v0.4 · flued/model.py · FLUEDAutoencoder <h3>tied-weight autoencoder</h3>
<p><strong>Outcome:</strong> the shared inverse was ruled out by triple evidence; the tied-inverse line is closed.</p>
<ol>
<li>byte ids<small>vocab 257 · PAD-offset</small>
</li>
<li>tied Transformer blocks<small>encoder / decoder share one set of weights</small>
</li>
<li>sigmoid(Linear(ΔH))<small>adjacent hidden-state delta ΔH = h_t − h_{t−1} → boundary probability</small>
</li>
<li>soft assignment matrix A<small>O(T²) pooling · differentiable segmentation (during training)</small>
</li>
<li>latent units</li>
<li>tied inverse decoder<small>reverse-order block subtraction (MHA / FFN subtracted back) · shares parameters with the forward pass</small>
</li>
<li>bytes restored</li>
</ol>
</div>
<div> v2 · flued/model.py · 328M tied scale-up + denoising objective <h3>Denoising reconstruction at scale</h3>
<p><strong>Outcome:</strong> three-seed reconstruction stable, but training-dynamics conflicts among denoising / compression / boundary exposed; fair D1 stable but behind BPE (0.8732 vs 0.8066 BPB).</p>
<ol>
<li>byte / mask ids<small>vocab 258 · MASK_ID 257 · PAD-offset</small>
</li>
<li>tied Transformer blocks<small>SDPA + SwiGLU 3072 · dynamic sinusoidal PE</small>
</li>
<li>boundary_head(ΔH)<small>boundary priors over five byte types (utf8_cont / ascii / cjk / op / digit)</small>
</li>
<li>banded soft assignment matrix A<small>log-space · assignment_window 128</small>
</li>
<li>latent units<small>length-aware compression target</small>
</li>
<li>tied inverse decoder<small>reverse-order block subtraction · shares parameters with the forward pass</small>
</li>
<li>bytes restored<small>clean / denoise mix（denoise_prob 0.7 · corrupt 15% · span 1-8）</small>
</li>
</ol>
</div>
<div> v3.1 · tools/analysis/v3_1/ · language-encoder prototype <h3>readout / summary division of labor established</h3>
<p><strong>Outcome:</strong> the 2M codec loop is learnable (recon 0.506 · length_acc 0.973 · units/byte 0.117); the latent backbone edged out the segment-mask byte baseline (0.178 vs 0.150), but early clean-encode evaluation risked information leakage.</p>
<ol>
<li>byte ids</li>
<li>weak boundary starts<small>weak-rule labels from UTF-8 / punctuation / length</small>
</li>
<li>shared segment representation<small>mean_first_last aggregation</small>
</li>
<li>readout latent<small>the only interface to the external backbone</small>
</li>
<li>summary latent → causal memory<small>internal mechanism · reads only old memory · written after each chunk</small>
</li>
<li>length / slot allocator<small>explicit span length 1..Lmax</small>
</li>
<li>latent-to-byte decoder</li>
<li>byte span</li>
</ol>
</div>
<div> v3.2 / v3.2.1 · strict masked-source <h3>Mask first, encode after</h3>
<p><strong>Outcome:</strong> masking at the byte input layer before encode closed the clean-readout leak; under the strict protocol the latent backbone clearly beat the byte baseline (mask_acc 0.1898 vs 0.1440, +0.046) — then the cleanest positive evidence of the v3 series.</p>
<ol>
<li>byte ids</li>
<li>mask at the byte input layer first<small>strict masked-source · closes the clean-encode leak</small>
</li>
<li>memory-free boundary<small>boundary never reads memory, avoiding cross-contamination</small>
</li>
<li>memory-conditioned interpreter<small>chunk + past memory → readout</small>
</li>
<li>causal append-only summary<small>top-k retrieval showed no proven default benefit; kept as an experimental branch</small>
</li>
<li>readout latent → minimal backbone<small>validated by masked latent infill</small>
</li>
<li>latent-to-byte decoder</li>
<li>byte span</li>
</ol>
</div>
<div> v3.3 · flued/v33/ · modular decomposition <h3>Responsibility boundaries established</h3>
<p><strong>Outcome:</strong> architecture cutoff — each responsibility split into its own module; focus turned to systematic ablation and public reproduction.</p>
<ol>
<li>StructuredByteLookup</li>
<li>SignedBoundarySegmentor</li>
<li>DualThresholdPolicy</li>
<li>ChunkBuilder</li>
<li>LatentMemoryInterpreter<small>reads other-memory, never the current chunk</small>
</li>
<li>CausalLowRankSequenceMemory</li>
<li>SharedParameterDecoder</li>
</ol>
</div>
<div> v3.4 · flued/v34/model.py · monolithic probe + ablation matrix <h3>Ablation-driven trade-offs</h3>
<p><strong>Outcome:</strong> memory / emit failed to justify themselves and were closed; plain lookup + standalone decoder + uniform boundaries were frozen as canonical_v35.</p>
<ol>
<li>PlainByteLookup</li>
<li>DiTStyleBlock stack<small>RoPE + ALiBi + noise conditioning</small>
</li>
<li>FixedDualThresholdPolicy<small>+ SoftBoundaryBridge hard execution, soft backprop</small>
</li>
<li>ChunkBuilder</li>
<li>QueryPool / DenseNoSelfMemory<small>parallel · no-self</small>
</li>
<li>SmallChunkARCorrection<small>small in-chunk AR correction</small>
</li>
<li>rate_emit<small>hard emission counted in the real compute ledger</small>
</li>
<li>SpanDecoder<small>standalone vs shared-inverse arms compared</small>
</li>
</ol>
</div>
</div>
<h3>Competitors: three answers to the same question</h3>
<div>
<div> Competitor · BLT · blt_baseline/model.py <h3>Entropy-driven dynamic patching</h3>
<p><strong>Nature of the signal:</strong> purely local statistics — boundaries come from a byte LM's per-byte entropy, not learned for the downstream task.</p>
<ol>
<li>byte LM<small>d512 / 4L · per-byte entropy</small>
</li>
<li>EntropyPatcher<small>cuts where entropy exceeds the threshold</small>
</li>
<li>local encoder / decoder<small>local in/out within each patch</small>
</li>
</ol>
</div>
<div> Competitor · H-Net · flued/hnet_repro/model.py <h3>Cosine-dissimilarity dynamic chunking</h3>
<p><strong>The E20 phenomenon:</strong> without explicit compression pressure, boundaries degenerate — ~1 chunk in the DiT standard arm, ~190 chunks in the bottleneck arm, no middle ground.</p>
<ol>
<li>byte encoder ×2<small>causal block · RoPE</small>
</li>
<li>cosine-dissimilarity DC<small>0.5·(1−cos) &gt; 0.5 hard downsampling · straight-through estimator</small>
</li>
<li>causal trunk ×9<small>reproduction uses a causal Transformer · the paper's Mamba-2 is left to R2</small>
</li>
<li>dechunk → decoder ×3<small>chunk representations projected back to byte positions</small>
</li>
</ol>
</div>
<div> Competitor · BPE · offline statistical tokenization <h3>A fixed vocabulary, semantics-blind</h3>
<p><strong>The finest cuts:</strong> 148 segments on the same Chinese sample (vs ~13 for the v3.6 S0 arm); boundaries are decided by offline frequency merges, unrelated to model semantics.</p>
<ol>
<li>offline corpus statistics<small>iterative merging of the most frequent byte pairs</small>
</li>
<li>fixed vocabulary<small>vocab 8,192</small>
</li>
<li>table-lookup segmentation<small>no parameters at inference, no context</small>
</li>
</ol>
</div>
</div>
</div>`,
    ],
    tasks: [
      `<div>
<div>
<div>
<p>训练由两个任务共同约束：一个考精准记忆，一个考经主干改写后的信息存活。掩码为原生 5%、span 1-8 的字节掩码。</p>
</div>
<div>
<div>
<h3>任务一 · 精准还原（direct）</h3>
<ul>
<li>readout 包直接进共享 span decoder。</li>
<li>目标：逐字节精准还原文本，指标 direct_acc。</li>
<li>检验状态本身是否无损携带全文信息。</li>
</ul>
</div>
<div>
<h3>任务二 · 经主干改写还原（backbone）</h3>
<ul>
<li>readout 包先经 TinyBackbone 改写，再由 decoder 全部还原。</li>
<li>目标：掩码位置补全，指标 backbone_masked_acc（即演示与评估的主口径 masked_acc）。</li>
<li>检验信息经过主干计算后是否仍然存活。</li>
</ul>
</div>
</div>
<p>两个任务共享同一份编码与切分，差别只在 readout 包之后是否插入主干。v3.6 报告的主指标一律是任务二口径。</p>
</div>
</div>`,
      `<div>
<div>
<div>
<p>Training is constrained jointly by two tasks: one tests exact memory, the other tests whether information survives rewriting by the backbone. Masks are native byte masks at 5%, span 1-8.</p>
</div>
<div>
<div>
<h3>Task one · exact restoration (direct)</h3>
<ul>
<li>The readout package goes straight into the shared span decoder.</li>
<li>Goal: restore the text byte for byte; metric direct_acc.</li>
<li>Tests whether the state itself carries the full text losslessly.</li>
</ul>
</div>
<div>
<h3>Task two · restoration after backbone rewriting</h3>
<ul>
<li>The readout package is first rewritten by TinyBackbone, then fully restored by the decoder.</li>
<li>Goal: complete the masked positions; metric backbone_masked_acc (the main masked_acc protocol used in the demo and evaluation).</li>
<li>Tests whether information survives a pass of backbone computation.</li>
</ul>
</div>
</div>
<p>The two tasks share the same encoding and segmentation; they differ only in whether a backbone is inserted after the readout package. All headline metrics reported for v3.6 use the task-two protocol.</p>
</div>
</div>`,
    ],
    evidence: [
      `<div>
<div>
<p>对比只在同一信息传输预算下成立：v3.6 与 HNet-DiT 瓶颈臂在可比压缩档位上比较 masked acc；H-Net AR 复现作为 next-byte 天花板锚。HNet-DiT 标准臂边界退化（约 1 个 chunk），不在同一压缩口径，故不作锚点。</p>
</div>
<div>
<h4>FLUED v3.6 (S0)</h4>
<dl class="register f-register">
<div>
<dt>口径</dt>
<dd>任务二 masked acc（eval）</dd>
</div>
<div>
<dt>指标</dt>
<dd><b>0.149</b>
</dd>
</div>
<div>
<dt>信息传输</dt>
<dd><b>1,536 标量</b>
</dd>
</div>
<div>
<dt>定位</dt>
<dd>主模型 · 单 readout 包</dd>
</div>
</dl>
<h4>HNet-DiT 瓶颈臂</h4>
<dl class="register f-register">
<div>
<dt>口径</dt>
<dd>masked acc（eval）</dd>
</div>
<div>
<dt>指标</dt>
<dd>0.142</dd>
</div>
<div>
<dt>信息传输</dt>
<dd>97,540 标量</dd>
</div>
<div>
<dt>定位</dt>
<dd>公平对比臂 · 过度切分</dd>
</div>
</dl>
<h4>H-Net AR 复现</h4>
<dl class="register f-register">
<div>
<dt>口径</dt>
<dd>next-byte BPB</dd>
</div>
<div>
<dt>指标</dt>
<dd>0.653</dd>
</div>
<div>
<dt>信息传输</dt>
<dd>逐位置 hidden state</dd>
</div>
<div>
<dt>定位</dt>
<dd>天花板锚（不同任务口径）</dd>
</div>
</dl>
</div>
<div>
<div>
<h3>~60× 信息传输效率</h3>
<p>在 masked acc 基本持平（0.149 vs 0.142）的档位上，v3.6 的跨块通信量为 1,536 标量，瓶颈臂 97,540 标量，约 60 倍差距。</p>
</div>
<div>
<h3>两臂退化是现象不是 bug</h3>
<p>无显式压缩激励时动态切分无中间态：标准臂几乎不切（约 1 chunk），瓶颈臂过度切分（约 190 chunks）。演示页可直观看到这两条臂的真实切分。</p>
</div>
<div>
<h3>口径声明</h3>
<p>以上均为单 seed、演示性质证据，用于锚定当前研究方向；不构成多种子或尺度上的性能结论。</p>
</div>
</div>
</div>`,
      `<div>
<div>
<p>Comparisons only hold at the same information-transmission budget: v3.6 and the HNet-DiT bottleneck arm are compared on masked acc at comparable compression tiers; the H-Net AR reproduction serves as a next-byte ceiling anchor. The HNet-DiT standard arm's boundaries degenerate (~1 chunk), so it sits outside this compression protocol and is not used as an anchor.</p>
</div>
<div>
<h4>FLUED v3.6 (S0)</h4>
<dl class="register f-register">
<div>
<dt>Protocol</dt>
<dd>task-two masked acc (eval)</dd>
</div>
<div>
<dt>Metric</dt>
<dd><b>0.149</b>
</dd>
</div>
<div>
<dt>Transmission</dt>
<dd><b>1,536 scalars</b>
</dd>
</div>
<div>
<dt>Role</dt>
<dd>main model · single readout package</dd>
</div>
</dl>
<h4>HNet-DiT bottleneck arm</h4>
<dl class="register f-register">
<div>
<dt>Protocol</dt>
<dd>masked acc（eval）</dd>
</div>
<div>
<dt>Metric</dt>
<dd>0.142</dd>
</div>
<div>
<dt>Transmission</dt>
<dd>97,540 scalars</dd>
</div>
<div>
<dt>Role</dt>
<dd>fair-comparison arm · over-segmented</dd>
</div>
</dl>
<h4>H-Net AR reproduction</h4>
<dl class="register f-register">
<div>
<dt>Protocol</dt>
<dd>next-byte BPB</dd>
</div>
<div>
<dt>Metric</dt>
<dd>0.653</dd>
</div>
<div>
<dt>Transmission</dt>
<dd>per-position hidden state</dd>
</div>
<div>
<dt>Role</dt>
<dd>ceiling anchor (different task protocol)</dd>
</div>
</dl>
</div>
<div>
<div>
<h3>~60× information-transmission efficiency</h3>
<p>At essentially tied masked acc (0.149 vs 0.142), v3.6 transmits 1,536 scalars across chunks versus 97,540 for the bottleneck arm — roughly a 60-fold gap.</p>
</div>
<div>
<h3>Both degenerate arms are a phenomenon, not a bug</h3>
<p>Without explicit compression pressure, dynamic segmentation has no middle ground: the standard arm barely cuts (~1 chunk) while the bottleneck arm over-segments (~190 chunks). The demo page shows both arms' real segmentations directly.</p>
</div>
<div>
<h3>Protocol statement</h3>
<p>All of the above is single-seed, demo-grade evidence meant to anchor the current research direction; it is not a multi-seed or scale-level performance claim.</p>
</div>
</div>
</div>`,
    ],
    compare: [
      `<div>
<div>
<p>比的是训练方式与不同模块的算子差异：边界怎么切、梯度怎么回传、怎么汇聚压缩、怎么上采样还原。第一列是 FLUED v3.6；第二列是原 H-Net 的论文机制；第三列是我方把 H-Net 主干换成 DiT 的公平对比臂，与 v3.6 同口径跑 masked infilling。</p>
</div>
<div>
<h4>边界算子</h4>
<dl class="register f-register">
<div>
<dt>FLUED v3.6</dt>
<dd>segmentor 9 层细长 DiT → tanh 有界置信度 &gt;0.94 下刀 + UTF-8 续字节禁切</dd>
</div>
<div>
<dt>H-Net 原版（论文机制）</dt>
<dd>相邻隐状态余弦不相似度 0.5·(1−cos) &gt;0.5 下刀（routing module，2 层 encoder 之上）</dd>
</div>
<div>
<dt>HNet-DiT（我方公平对比臂）</dt>
<dd>同 H-Net 原版（余弦不相似度）</dd>
</div>
</dl>
<h4>边界梯度（训练方式）</h4>
<dl class="register f-register">
<div>
<dt>FLUED v3.6</dt>
<dd><b>不走主任务梯度</b>：S0 段落标签 BCE 独立预训后冻结；S0.5 用 GRPO（组相对策略梯度）做离散边界优化</dd>
</div>
<div>
<dt>H-Net 原版（论文机制）</dt>
<dd><b>STE 直通估计器端到端回传</b>（hard boundary + (prob − prob.detach())）+ ratio loss 把边界率压向 0.2</dd>
</div>
<div>
<dt>HNet-DiT（我方公平对比臂）</dt>
<dd>同原版 STE，但训练目标换成 masked infilling</dd>
</div>
</dl>
<h4>汇聚 / 压缩算子</h4>
<dl class="register f-register">
<div>
<dt>FLUED v3.6</dt>
<dd>ChunkSummarizer 4-slot 注意力池化逐段产 memory → WriteHead k/v/β/α 门控 → KDA 状态机串行 delta-rule 写入</dd>
</div>
<div>
<dt>H-Net 原版（论文机制）</dt>
<dd>按边界硬切 + chunk 均值池化 → chunk_proj 进主干</dd>
</div>
<div>
<dt>HNet-DiT（我方公平对比臂）</dt>
<dd>同原版</dd>
</div>
</dl>
<h4>主干</h4>
<dl class="register f-register">
<div>
<dt>FLUED v3.6</dt>
<dd>TinyBackbone 3 层双向 Transformer，只看 1 个 readout 包（1,536 标量）</dd>
</div>
<div>
<dt>H-Net 原版（论文机制）</dt>
<dd>层级主干，论文为 Mamba-2；我方复现因 Windows 环境用 9 层因果 Transformer（已披露差异）</dd>
</div>
<div>
<dt>HNet-DiT（我方公平对比臂）</dt>
<dd>7 层双向 Transformer（38.2M 对齐 39M 目标）</dd>
</div>
</dl>
<h4>解码 / 上采样算子</h4>
<dl class="register f-register">
<div>
<dt>FLUED v3.6</dt>
<dd>GlobalSpanDecoder：slot+cond 经 DiTStyleBlock，与 encoder 共享字节表做 cosine logits</dd>
</div>
<div>
<dt>H-Net 原版（论文机制）</dt>
<dd>dechunk：取「最后完成 chunk」的主干输出回贴字节级 + 边界概率平滑 + encoder 残差（decoder_skip）</dd>
</div>
<div>
<dt>HNet-DiT（我方公平对比臂）</dt>
<dd>同原版；标准臂保留 byte 旁路（skip），瓶颈臂砍旁路逼信息走瓶颈</dd>
</div>
</dl>
<h4>训练目标</h4>
<dl class="register f-register">
<div>
<dt>FLUED v3.6</dt>
<dd>两任务：readout→decoder 精准还原 + readout→backbone 改写→decoder 全量还原（5% span 1-8 mask 原生）</dd>
</div>
<div>
<dt>H-Net 原版（论文机制）</dt>
<dd>next-byte 自回归</dd>
</div>
<div>
<dt>HNet-DiT（我方公平对比臂）</dt>
<dd>masked infilling（5% span 1-8，与 v3.6 同口径）</dd>
</div>
</dl>
<h4>压缩激励</h4>
<dl class="register f-register">
<div>
<dt>FLUED v3.6</dt>
<dd>率控制 100% 归边界（CBIU 锚点协议 + GRPO 线）</dd>
</div>
<div>
<dt>H-Net 原版（论文机制）</dt>
<dd>ratio loss = (边界率 − 0.2)² × 0.03</dd>
</div>
<div>
<dt>HNet-DiT（我方公平对比臂）</dt>
<dd><b>无显式激励 → 边界退化</b>：标准臂塌成 ~1 chunk、瓶颈臂碎到 ~190 chunks（E20 的对照证据）</dd>
</div>
</dl>
<h4>实测（单 seed）</h4>
<dl class="register f-register">
<div>
<dt>FLUED v3.6</dt>
<dd>masked <b>0.149</b> @ <b>1,536 标量</b>
</dd>
</div>
<div>
<dt>H-Net 原版（论文机制）</dt>
<dd>AR 复现 next-byte BPB 0.653（全信息天花板锚）</dd>
</div>
<div>
<dt>HNet-DiT（我方公平对比臂）</dt>
<dd>std 0.324 @ 262,144 标量（天花板）/ 瓶颈 <b>0.142</b> @ 97,540</dd>
</div>
</dl>
</div>
<p>总结论：同口径硬指标 v3.6 masked 0.149 ≈ HNet-DiT 瓶颈臂 0.142，但 v3.6 只传 1,536 标量，约 60× 信息传输效率；H-Net 两臂在无显式压缩激励时边界必退化，动态切分无中间态。</p>
</div>`,
      `<div>
<div>
<p>Compared here are training regimes and operator differences per module: how boundaries cut, how gradients flow back, how chunks are pooled and compressed, and how upsampling restores bytes. Column one is FLUED v3.6; column two is the original H-Net paper mechanism; column three is our fair-comparison arm that swaps H-Net's trunk for DiT, run under the same masked-infilling protocol as v3.6.</p>
</div>
<div>
<h4>Boundary operator</h4>
<dl class="register f-register">
<div>
<dt>FLUED v3.6</dt>
<dd>segmentor: 9 slim DiT layers → cut at tanh-bounded confidence &gt;0.94 + no cuts at UTF-8 continuation bytes</dd>
</div>
<div>
<dt>H-Net original (paper mechanism)</dt>
<dd>cut where adjacent hidden-state cosine dissimilarity 0.5·(1−cos) &gt;0.5 (routing module, above a 2-layer encoder)</dd>
</div>
<div>
<dt>HNet-DiT (our fair-comparison arm)</dt>
<dd>same as H-Net original (cosine dissimilarity)</dd>
</div>
</dl>
<h4>Boundary gradient (training regime)</h4>
<dl class="register f-register">
<div>
<dt>FLUED v3.6</dt>
<dd><b>No main-task gradient</b>: independently pretrained on S0 paragraph labels with BCE, then frozen; S0.5 uses GRPO (group relative policy optimization) for discrete boundary optimization</dd>
</div>
<div>
<dt>H-Net original (paper mechanism)</dt>
<dd><b>STE straight-through estimator, end-to-end</b> (hard boundary + (prob − prob.detach())) + a ratio loss pushing the boundary rate toward 0.2</dd>
</div>
<div>
<dt>HNet-DiT (our fair-comparison arm)</dt>
<dd>same STE as the original, but the training objective is masked infilling</dd>
</div>
</dl>
<h4>Pooling / compression operator</h4>
<dl class="register f-register">
<div>
<dt>FLUED v3.6</dt>
<dd>ChunkSummarizer 4-slot attention pooling produces one memory per chunk → WriteHead k/v/β/α gating → serial delta-rule writes into the KDA state machine</dd>
</div>
<div>
<dt>H-Net original (paper mechanism)</dt>
<dd>hard cuts at boundaries + chunk mean pooling → chunk_proj into the trunk</dd>
</div>
<div>
<dt>HNet-DiT (our fair-comparison arm)</dt>
<dd>same as the original</dd>
</div>
</dl>
<h4>Backbone</h4>
<dl class="register f-register">
<div>
<dt>FLUED v3.6</dt>
<dd>TinyBackbone: 3-layer bidirectional Transformer seeing only 1 readout package (1,536 scalars)</dd>
</div>
<div>
<dt>H-Net original (paper mechanism)</dt>
<dd>hierarchical trunk, Mamba-2 in the paper; our reproduction uses a 9-layer causal Transformer due to the Windows environment (difference disclosed)</dd>
</div>
<div>
<dt>HNet-DiT (our fair-comparison arm)</dt>
<dd>7-layer bidirectional Transformer (38.2M, aligned to the 39M target)</dd>
</div>
</dl>
<h4>Decoding / upsampling operator</h4>
<dl class="register f-register">
<div>
<dt>FLUED v3.6</dt>
<dd>GlobalSpanDecoder: slot+cond through DiTStyleBlock, cosine logits against the byte table shared with the encoder</dd>
</div>
<div>
<dt>H-Net original (paper mechanism)</dt>
<dd>dechunk: paste the trunk output of the "last completed chunk" back to byte level + boundary-probability smoothing + encoder residual (decoder_skip)</dd>
</div>
<div>
<dt>HNet-DiT (our fair-comparison arm)</dt>
<dd>same as the original; the standard arm keeps the byte bypass (skip), while the bottleneck arm removes it to force information through the bottleneck</dd>
</div>
</dl>
<h4>Training objective</h4>
<dl class="register f-register">
<div>
<dt>FLUED v3.6</dt>
<dd>two tasks: readout→decoder exact restoration + readout→backbone rewrite→decoder full restoration (native 5% span 1-8 mask)</dd>
</div>
<div>
<dt>H-Net original (paper mechanism)</dt>
<dd>next-byte autoregression</dd>
</div>
<div>
<dt>HNet-DiT (our fair-comparison arm)</dt>
<dd>masked infilling (5% span 1-8, same protocol as v3.6)</dd>
</div>
</dl>
<h4>Compression pressure</h4>
<dl class="register f-register">
<div>
<dt>FLUED v3.6</dt>
<dd>rate control assigned 100% to boundaries (CBIU anchor protocol + the GRPO line)</dd>
</div>
<div>
<dt>H-Net original (paper mechanism)</dt>
<dd>ratio loss = (boundary rate − 0.2)² × 0.03</dd>
</div>
<div>
<dt>HNet-DiT (our fair-comparison arm)</dt>
<dd><b>No explicit pressure → boundary degeneration</b>: the standard arm collapses to ~1 chunk, the bottleneck arm fragments to ~190 chunks (the E20 control evidence)</dd>
</div>
</dl>
<h4>Measured (single seed)</h4>
<dl class="register f-register">
<div>
<dt>FLUED v3.6</dt>
<dd>masked <b>0.149</b> @ <b>1,536 scalars</b>
</dd>
</div>
<div>
<dt>H-Net original (paper mechanism)</dt>
<dd>AR reproduction next-byte BPB 0.653 (full-information ceiling anchor)</dd>
</div>
<div>
<dt>HNet-DiT (our fair-comparison arm)</dt>
<dd>std 0.324 @ 262,144 scalars (ceiling) / bottleneck <b>0.142</b> @ 97,540</dd>
</div>
</dl>
</div>
<p>Bottom line: under the same protocol, v3.6 masked 0.149 ≈ the HNet-DiT bottleneck arm's 0.142, but v3.6 transmits only 1,536 scalars — about 60× information-transmission efficiency. Without explicit compression pressure, both H-Net arms' boundaries degenerate; dynamic segmentation has no middle ground.</p>
</div>`,
    ],
    frontier: [
      `<div>
<div>
<div>
<p>三条新证据（E21 / E22 / E23，候选口径）：GRPO 改变的是切分粒度而不是质量；summarizer 容量消融全线无效；真正的瓶颈在下游 readout 的包均值条件通道。均为单 seed 演示口径，不构成性能结论。</p>
</div>
<div>
<div>
<h3>E21 · S0.5 GRPO 边界优化</h3>
<p>对 segmentor 边界 + β 写入门做组相对策略优化（GRPO：同前缀采 G 个切分方案、组内排名优势、免 value network）。R1–R3 三轮失败教训：纯质量奖励 → 碎切捷径冲 59/64 段；采样计数率项 → 温度涂抹脱钩；确定性罚项 → 组内零方差被优势归一化消掉——核心教训：组相对优势只能优化组内有方差的量。R4 定稿：约束走可微直接损失 E[count]=Σcut_prob，预算 18 ≈ 部署 24 段锚用户粒度 → masked 与控制臂双口径打平，但<b>边界裁决成功：hard 停点 24.3 段 ≈ 用户 21B，教师粒度之争了结</b>。GRPO 当前价值 = 选粒度，非提质量。</p>
</div>
<div>
<h3>E22 · S0.6 summarizer 容量全因子</h3>
<p>slots / hidden / d_mem 三因子 2³ 共 8 臂、20K step 从零消融：主效应 ≤ 0.24pp，全部无效。天花板不在 summarizer——瓶颈锁定到下游 readout 的包均值条件通道，直接把问题推向 S0.7 的逐段条件化诊断。</p>
</div>
<div>
<h3>E23 · S0.7 逐段条件化诊断</h3>
<p>per_chunk_readout：KDA 每消费一段即从当前状态读出该段条件向量，替代均值 + 位置广播。unmasked 全位置 acc 0.190 → 0.351（+16pp）、PPL 33.9 → 12.1——信息确实在 KDA 状态里，均值通道是检索瓶颈，路线活。masked 0.154 → 0.141 未过预注册线（口径：masked 测的是从未进状态的字节，靠推断而非检索）。率口径修正：该臂传输 ~27K 标量，仍比 HNet-DiT 瓶颈臂（~97K）便宜 ~3.6×。</p>
</div>
</div>
<p>用户裁定（2026-08-04）：masked 保持必备项不降级；S0.7 不设默认——canonical 维持 v36.1，per_chunk_readout 默认关；新条件化下 GRPO 是否重跑待定。</p>
</div>
</div>`,
      `<div>
<div>
<div>
<p>Three new pieces of evidence (E21 / E22 / E23, candidate protocol): GRPO changes segmentation granularity, not quality; the summarizer-capacity ablation came back null across the board; the real bottleneck is the package-mean conditioning channel of the downstream readout. All single-seed demo protocol — not performance claims.</p>
</div>
<div>
<div>
<h3>E21 · S0.5 GRPO boundary optimization</h3>
<p>Group relative policy optimization on the segmentor boundaries + the β write gate (GRPO: sample G segmentations per prefix, within-group ranking advantage, no value network). Lessons from the three failed rounds R1–R3: a pure quality reward → a fragmenting shortcut rushing to 59/64 segments; a sampled count-rate term → decoupled by temperature smearing; a deterministic penalty → zero within-group variance erased by advantage normalization. Core lesson: group-relative advantage can only optimize what varies within the group. R4 finalized: the constraint becomes a differentiable direct loss E[count]=Σcut_prob, budget 18 ≈ 24 deployed segments anchored to human granularity → masked ties the control arm on both protocols, but <b>the boundary ruling succeeded: hard stop at 24.3 segments ≈ 21B human-marked — the teacher-granularity debate is settled</b>. GRPO's current value = choosing granularity, not improving quality.</p>
</div>
<div>
<h3>E22 · S0.6 summarizer-capacity full factorial</h3>
<p>A 2³ full factorial over slots / hidden / d_mem — 8 arms trained from scratch for 20K steps: main effects ≤ 0.24pp, all null. The ceiling is not in the summarizer — the bottleneck was localized to the package-mean conditioning channel of the downstream readout, pushing the question directly to S0.7's per-chunk conditioning diagnostic.</p>
</div>
<div>
<h3>E23 · S0.7 per-chunk conditioning diagnostic</h3>
<p>per_chunk_readout: after consuming each chunk, KDA reads that chunk's conditioning vector from the current state, replacing mean + position broadcast. Unmasked all-position acc 0.190 → 0.351 (+16pp), PPL 33.9 → 12.1 — the information is indeed in the KDA state; the mean channel is the retrieval bottleneck, and the line stays alive. Masked 0.154 → 0.141 missed the pre-registered bar (protocol note: masked measures bytes that never entered the state — inference, not retrieval). Rate correction: this arm transmits ~27K scalars, still ~3.6× cheaper than the HNet-DiT bottleneck arm (~97K).</p>
</div>
</div>
<p>Ruling (2026-08-04): masked stays a required metric and is not downgraded; S0.7 is not made default — canonical stays v36.1 with per_chunk_readout off by default; whether GRPO reruns under the new conditioning is undecided.</p>
</div>
</div>`,
    ],
  },
  'flued-demo.html': {
    input: [
      `<p>本页面在本机访问时连接本机推理服务（127.0.0.1:8722，CPU 实时推理），公网访问时自动展示预录样例。演示把同一段输入同时送入 FLUED v3.6 的两个边界臂（S0 教师粒度 + GRPO R4 自选粒度）和三个 H-Net 基线：先展示每个模型把字节流切成了哪些语义段，再随机掩盖约 5% 的字节让模型补全。KDA（逐通道门控 delta 规则的线性注意力）是 v3.6 的主干状态机；readout 包指整条 prompt 被压缩成的单个逻辑读出单位（1536 个标量）。</p>
<p>掩码补全协议在过短的文本上会退化（掩盖位置太少、上下文不足），预置样本均为 300 字节以上的中英混合文本。在线模式下输入会原样发送到本机推理服务；离线模式下无论输入什么都渲染同一份静态样例。</p>`,
      `<p>When visited locally, this page connects to a local inference service (127.0.0.1:8722, real-time CPU inference); on the public web it automatically shows recorded samples instead. The demo feeds the same input to FLUED v3.6's two boundary arms (S0 teacher granularity + GRPO R4 self-chosen granularity) and three H-Net baselines: first showing how each model segments the byte stream into semantic chunks, then randomly masking about 5% of the bytes for the models to complete. KDA (linear attention with a channel-wise gated delta rule) is v3.6's backbone state machine; the readout package is the single logical readout unit (1,536 scalars) that the whole prompt is compressed into.</p>
<p>The masked-completion protocol degenerates on very short text (too few masked positions, too little context), so the preset samples are all mixed Chinese-English text over 300 bytes. Online, your input is sent as-is to the local inference service; offline, the same static sample renders regardless of input.</p>`,
    ],
    segments: [
      `<p>每个模型各自决定边界：同一段文本按切分结果用交替底色渲染，段与段之间以分隔标记区分。每字节位置的切分置信度画成迷你条形图（与文本位置对齐），超过阈值的高亮柱即实际切点。</p>
<p>HNet-DiT 两臂的行为是真实模型输出，不是渲染问题：标准臂边界退化（几乎不切，约 1 个 chunk），瓶颈臂过度切分（约 190 个 chunk）。没有显式压缩激励时，动态切分不存在中间态——这正是公平对比要说明的现象。</p>`,
      `<p>Each model decides its own boundaries: the same text renders in alternating shades by segmentation, with divider marks between segments. Per-byte cutting confidence is drawn as a mini bar chart (aligned with text positions); highlighted bars above the threshold are the actual cuts.</p>
<p>The behavior of both HNet-DiT arms is real model output, not a rendering issue: the standard arm's boundaries degenerate (barely cuts, ~1 chunk) and the bottleneck arm over-segments (~190 chunks). Without explicit compression pressure, dynamic segmentation has no middle ground — exactly the phenomenon the fair comparison is meant to show.</p>`,
    ],
    completion: [
      `<p>五个模型共享同一份随机字节掩码（下方高亮位置）。逐位置列出真值与预测：绿色为命中，红色为未命中；多字节字符的每个字节位置单独计分，无法单独解码的预测字节显示为占位符「·」。</p>
<p>v3.6 有两个训练任务：任务一 readout 包直接进 decoder 做精准还原（direct_acc）；任务二 readout 包先经 TinyBackbone 改写、再由 decoder 全部还原（backbone_masked_acc，即演示的主口径 masked_acc）。H-Net AR 臂是纯因果模型，其口径为「mask 位置的 next-byte argmax 命中率」，与掩码重建不严格可比。</p>`,
      `<p>All five models share one random byte mask (highlighted below). Truth and prediction are listed per position: green for hits, red for misses; every byte position of a multi-byte character is scored separately, and predicted bytes that cannot be decoded alone show as the placeholder "·".</p>
<p>v3.6 has two training tasks: task one sends the readout package straight to the decoder for exact restoration (direct_acc); task two routes it through TinyBackbone first, then the decoder restores everything (backbone_masked_acc — the demo's main masked_acc protocol). The H-Net AR arm is a purely causal model scored by next-byte argmax hit rate at mask positions, not strictly comparable to masked reconstruction.</p>`,
    ],
    timing: [
      `<p>推理服务当前运行在 CPU 上：每个模型的 forward 耗时为单次完整前向的实测墙上时钟，总耗时为五个模型串行完整推理的端到端时间（含数据准备）。CPU 串行下端到端为秒级（实测约 1–5 s），这是正常预期，不做毫秒级宣传。</p>
<p>S0.7 逐段条件化（per-chunk readout）已证明检索瓶颈可解：unmasked 全位置 acc 0.190→0.351、PPL 33.9→12.1。本演示为 canonical v36.1 口径（per_chunk_readout 默认关），不构成性能结论。</p>`,
      `<p>The inference service currently runs on CPU: each model's forward time is the measured wall clock of one complete forward pass, and the total is the end-to-end time for all five models run sequentially (including data preparation). Seconds-level e2e on serial CPU (measured ~1–5 s) is expected — we make no millisecond claims.</p>
<p>S0.7 per-chunk conditioning (per-chunk readout) has shown the retrieval bottleneck is solvable: unmasked all-position acc 0.190→0.351, PPL 33.9→12.1. This demo runs the canonical v36.1 protocol (per_chunk_readout off by default) and is not a performance claim.</p>`,
    ],
  },
  'flued-evidence.html': {
    reading: [
      `<div>
<div>
<div>
<h3>应该看什么</h3>
<ul>
<li><code>recon_acc</code> 是否稳定上升，而不是只看最终点。</li>
<li><code>soft_m/n</code> 是否被压缩目标牵引，还是被去噪任务推高。</li>
<li><code>bp_std</code> 是否形成边界分化，避免全体边界概率塌成常数。</li>
<li>压缩扫描里的 NaN 不是坏点，而是训练动力学失稳的证据。</li>
</ul>
</div>
<div>
<h3>不应该混用什么</h3>
<ul>
<li>v1 历史 BPB 阳性不能覆盖 v2 2048-byte / 100K 公平矩阵。</li>
<li>reconstruction accuracy 不能等价成 latent semantic quality。</li>
<li>memory 在 clean reconstruction 中的收益不能直接宣称为严格补全收益。</li>
<li>v3.3 当前是架构和消融入口，不是已完成 SOTA 结果。</li>
</ul>
</div>
</div>
</div>`,
      `<div>
<div>
<div>
<h3>What to look at</h3>
<ul>
<li>Whether <code>recon_acc</code> rises steadily, not just the final point.</li>
<li>Whether <code>soft_m/n</code> is pulled by the compression target or pushed up by the denoising task.</li>
<li>Whether <code>bp_std</code> shows boundary divergence rather than all boundary probabilities collapsing to a constant.</li>
<li>NaN in the compression scan is not a bad data point — it is evidence of training-dynamics instability.</li>
</ul>
</div>
<div>
<h3>What not to conflate</h3>
<ul>
<li>The v1 historical BPB positive does not override the v2 2048-byte / 100K fair matrix.</li>
<li>Reconstruction accuracy is not equivalent to latent semantic quality.</li>
<li>Memory's gains in clean reconstruction cannot be claimed directly as strict completion gains.</li>
<li>v3.3 is currently an architecture with ablation entries, not a finished SOTA result.</li>
</ul>
</div>
</div>
</div>`,
    ],
  },
  'flued-experiments.html': {
    reading: [
      `<div>
<div>
<div>
<h3>可作为当前主结论</h3>
<ul>
<li>v3.6 公平对比：masked acc 0.149 对 HNet-DiT 瓶颈臂 0.142（同规模同步数同语料单 seed），信息传输 1,536 vs ~97,540 标量。</li>
<li>v2 A-class 多种子：稳定可微边界和近无损重建。</li>
<li>v2 D1：统一 2048 原始 byte / 100K 下，FLUED 稳定但尚未超过 BPE。</li>
<li>v3.2.1 strict masked-source：latent no-memory 使小主干 mask accuracy 从 0.1440 提升至 0.1898。</li>
</ul>
</div>
<div>
<h3>只用于定位或历史叙事</h3>
<ul>
<li>v3.6 S0.7 逐段条件化（unmasked 0.351 / PPL 12.1）是非默认口径诊断臂，不进入主结论。</li>
<li>v1 的 E3 20K BPB 阳性不是 D1 公平比较的替代品。</li>
<li>v3.4 迁移前 5K 筛选用于发现候选组件，不能绕过后续代码纠偏。</li>
<li>v3.4 40K/20K 单种子矩阵可定位失稳机制，不能据此声称多种子或尺度规律。</li>
</ul>
</div>
</div>
</div>`,
      `<div>
<div>
<div>
<h3>Usable as current headline conclusions</h3>
<ul>
<li>The v3.6 fair comparison: masked acc 0.149 vs the HNet-DiT bottleneck arm's 0.142 (matched scale, steps, and corpus, single seed), transmitting 1,536 vs ~97,540 scalars.</li>
<li>v2 A-class multi-seed: stable differentiable boundaries and near-lossless reconstruction.</li>
<li>v2 D1: under the unified 2048 raw-byte / 100K setting, FLUED is stable but has not yet beaten BPE.</li>
<li>v3.2.1 strict masked-source: latent no-memory lifts a small backbone's mask accuracy from 0.1440 to 0.1898.</li>
</ul>
</div>
<div>
<h3>For localization or historical narrative only</h3>
<ul>
<li>v3.6 S0.7 per-chunk conditioning (unmasked 0.351 / PPL 12.1) is a non-default diagnostic arm and does not enter the headline conclusions.</li>
<li>v1's E3 20K BPB positive is not a substitute for the D1 fair comparison.</li>
<li>v3.4's pre-migration 5K screening was for discovering candidate components and cannot bypass the later code corrections.</li>
<li>v3.4's 40K/20K single-seed matrices can localize instability mechanisms but cannot support claims of multi-seed or scaling laws.</li>
</ul>
</div>
</div>
</div>`,
    ],
  },
};
