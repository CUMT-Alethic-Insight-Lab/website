import { topics } from './topic-routes.mjs';
import { drawTopic } from './home-layout.mjs';
import { readFileSync } from 'node:fs';
// Content from the migration candidate HEAD (c912836); all rendering is original.

const directions = [
  [
    "direction-llm",
    "NLP / LLM",
    [
      "大模型与检索增强，面向中文场景的评测与数据构建。",
      "LLM applications and retrieval augmentation, with evaluation and dataset construction for Chinese scenarios."
    ]
  ],
  [
    "direction-cv",
    "CV",
    [
      "图像与视频理解，从视觉表征到几何与三维重建。",
      "Image and video understanding, from visual representation to geometry and 3D reconstruction."
    ]
  ],
  [
    "direction-vlm",
    "VLM / MLLM",
    [
      "视觉语言与多模态大模型，跨模态推理的对齐与落地。",
      "Vision-language and multimodal LLMs — alignment and deployment of cross-modal reasoning."
    ]
  ],
  [
    "direction-rl",
    "RL",
    [
      "强化学习与对齐训练，在交互环境中打磨策略与反馈回路。",
      "Reinforcement learning and alignment — policies and feedback loops trained in interactive environments."
    ]
  ],
  [
    "direction-agent",
    "Agent",
    [
      "工具调用、规划与多智能体编排，面向真实任务的可靠执行。",
      "Tool use, planning, and multi-agent orchestration — reliable execution for real-world tasks."
    ]
  ],
  [
    "direction-memory",
    "Memory",
    [
      "长期记忆与检索系统，让智能体沉淀经验、越用越强。",
      "Long-term memory and retrieval systems — agents that accumulate experience and improve with use."
    ]
  ],
  [
    "direction-infra",
    "AI Infra",
    [
      "部署、实验追踪与模型服务，GPU 与存储的工程化工作流。",
      "Deployment, experiment tracking, and model serving — engineered workflows for GPUs and storage."
    ]
  ]
];

const projects = [
  [
    "/flued.html",
    "FLUED",
    [
      "Byte-to-latent 语言编码接口研究",
      "Research on a byte-to-latent language encoding interface"
    ]
  ],
  [
    "https://github.com/CUMT-Alethic-Insight-Lab/website",
    "website",
    [
      "组织官网源码与部署",
      "Source code and deployment of this site"
    ]
  ],
  [
    "/recruitment/",
    "recruitment",
    [
      "招新平台：报名与机试入口",
      "Recruitment platform: application and coding-test entry"
    ]
  ],
  [
    "https://github.com/CUMT-Alethic-Insight-Lab/governance-public",
    "governance-public",
    [
      "公开章程、成员规则和项目治理",
      "Public charter, membership rules, and project governance"
    ]
  ],
  [
    "https://github.com/CUMT-Alethic-Insight-Lab/awesome-ai",
    "awesome-ai",
    [
      "AI 学习与研究工程资源索引",
      "An index of AI learning and research-engineering resources"
    ]
  ],
  [
    "https://huggingface.co/Alethic-Insight",
    "Hugging Face",
    [
      "模型、数据集、Spaces 和公开实验产物",
      "Models, datasets, Spaces, and public experiment artifacts"
    ]
  ]
];

const people = [
  [
    [
      "王张嘉",
      "Zhangjia Wang"
    ],
    [
      "社团社长，负责组织整体方向与运营；NLP 方向负责人；FLUED 项目主持人：字节级语言编码接口、动态边界与压缩读出。",
      "President of the society, responsible for overall direction and operations; NLP direction lead; FLUED project lead, studying byte-level language interfaces, dynamic boundaries and compressed readout."
    ],
    [
      [
        "https://github.com/wdd9700",
        "GitHub"
      ],
      [
        "https://wdd9700.github.io",
        "Homepage"
      ],
      [
        "mailto:08252689@cumt.edu.cn",
        "08252689@cumt.edu.cn"
      ]
    ]
  ],
  [
    [
      "张岩",
      "Yan Zhang"
    ],
    [
      "社团前任社长，曾负责组织整体方向与运营。",
      "Former president of the society, previously responsible for overall direction and operations."
    ],
    [
      [
        "https://github.com/zhangyan289",
        "GitHub"
      ],
      [
        "mailto:08232670@cumt.edu.cn",
        "08232670@cumt.edu.cn"
      ]
    ]
  ],
  [
    [
      "朱泊衡",
      "Boheng Zhu"
    ],
    [
      "CV 方向负责人，负责计算机视觉方向的研究与工程。",
      "CV direction lead, owning computer-vision research and engineering."
    ],
    [
      [
        "https://github.com/sawakage",
        "GitHub"
      ],
      [
        "https://sawakage.space",
        "Homepage"
      ],
      [
        "mailto:sawakage@outlook.com",
        "sawakage@outlook.com"
      ]
    ]
  ],
  [
    [
      "谢圣民",
      "Shengmin Xie"
    ],
    [
      "「孤独的根号五」队长（第十七届服创大赛 AI 专项赛道一等奖）。",
      "Core member; captain of \"Lonely Sqrt-5\" (First Prize, 17th Service Outsourcing AI track)."
    ],
    [
      [
        "mailto:542664908@qq.com",
        "542664908@qq.com"
      ]
    ]
  ],
  [
    [
      "王天宇",
      "Tianyu Wang"
    ],
    [
      "「孤独的根号七」队长（第十七届服创大赛 AI 专项赛道三等奖）。",
      "Core member; captain of \"Lonely Sqrt-7\" (Third Prize, 17th Service Outsourcing AI track)."
    ],
    [
      [
        "https://github.com/tianyuwang122",
        "GitHub"
      ],
      [
        "mailto:benberrygamboa711@gmail.com",
        "benberrygamboa711@gmail.com"
      ]
    ]
  ],
  [
    [
      "陈德涛",
      "Detao Chen"
    ],
    [
      "学术合作伙伴，为研究与工程提供指导。",
      "Academic partner advising on research and engineering."
    ],
    [
      [
        "https://github.com/noahc1510",
        "GitHub"
      ],
      [
        "mailto:noahc1510@gmail.com",
        "noahc1510@gmail.com"
      ]
    ]
  ]
];

const awards = [
  [
    "一等奖",
    "孤独的根号五",
    [
      "第17届中国大学生服务外包创新创业大赛 · 人工智能专项赛道【D01】智能体决策算法（腾讯开悟） / 谢圣民（队长）、利楚、程致远、季成洋、罗若涵 · 指导老师：祝汉城",
      "17th China College Student Service Outsourcing Innovation &amp; Entrepreneurship Competition, AI Track D01 \"Agent Decision Algorithms\" (Tencent Kaiwu) / Xie Shengmin (captain), Li Chu, Cheng Zhiyuan, Ji Chengyang, Luo Ruohan · Advisor: Zhu Hancheng"
    ],
    "FT2614983D1004"
  ],
  [
    "三等奖",
    "孤独的根号三",
    [
      "第17届中国大学生服务外包创新创业大赛 · 人工智能专项赛道【D01】智能体决策算法（腾讯开悟） / 张岩（队长）、韩文艳、李豪、王张嘉、文艺学 · 指导老师：祝汉城",
      "17th China College Student Service Outsourcing Innovation &amp; Entrepreneurship Competition, AI Track D01 \"Agent Decision Algorithms\" (Tencent Kaiwu) / Zhang Yan (captain), Han Wenyan, Li Hao, Wang Zhangjia, Wen Yixue · Advisor: Zhu Hancheng"
    ],
    "FT2608179D3065"
  ],
  [
    "三等奖",
    "孤独的根号七",
    [
      "第17届中国大学生服务外包创新创业大赛 · 人工智能专项赛道【D01】智能体决策算法（腾讯开悟） / 王天宇（队长）、肖逸涵、刘彬、张雅晗、王紫菲 · 指导老师：姚睿、杜文亮",
      "17th China College Student Service Outsourcing Innovation &amp; Entrepreneurship Competition, AI Track D01 \"Agent Decision Algorithms\" (Tencent Kaiwu) / Wang Tianyu (captain), Xiao Yihan, Liu Bin, Zhang Yahan, Wang Zifei · Advisors: Yao Rui, Du Wenliang"
    ],
    "FT2617974D3101"
  ]
];

const focus = [
  [
    [
      "科研",
      "Research"
    ],
    [
      "围绕方向议题做公开研究，实验可复现、产物可追溯。",
      "Open research on our directions — reproducible experiments and traceable artifacts."
    ]
  ],
  [
    [
      "交付项目",
      "Delivered Projects"
    ],
    [
      "从招新平台到内部工具，把想法交付成真实可用的系统。",
      "From the recruitment platform to internal tooling — ideas delivered as working systems."
    ]
  ],
  [
    [
      "比赛",
      "Competitions"
    ],
    [
      "以赛促学，组队打榜并沉淀方法与复盘。",
      "Learning by competing — team runs, methods, and post-mortems worth sharing."
    ]
  ]
];

const agreements = [
  [
    "Disclose",
    [
      "公开 AI 辅助的模型、使用范围与验证方式。",
      "We disclose the AI models involved, their scope of use, and how outputs are verified."
    ]
  ],
  [
    "Review",
    [
      "一切改动走 Pull Request，讨论全程可追踪。",
      "Every change goes through a pull request, with the full discussion traceable."
    ]
  ],
  [
    "Reproduce",
    [
      "实验记录、数据来源与部署过程全部留档。",
      "Experiment logs, data sources, and deployment procedures are all archived."
    ]
  ],
  [
    "Handoff",
    [
      "交接文档、权限清单与维护边界预先写明。",
      "Handover docs, permission lists, and maintenance boundaries are written down in advance."
    ]
  ]
];

const documents = [
  [
    "https://github.com/CUMT-Alethic-Insight-Lab/governance-public/blob/main/docs/zh-CN/charter.md",
    [
      "章程",
      "Charter"
    ]
  ],
  [
    "https://github.com/CUMT-Alethic-Insight-Lab/governance-public/blob/main/docs/zh-CN/membership.md",
    [
      "成员规则",
      "Membership"
    ]
  ],
  [
    "https://github.com/CUMT-Alethic-Insight-Lab/governance-public/blob/main/docs/zh-CN/project-governance.md",
    [
      "项目治理",
      "Project Governance"
    ]
  ],
  [
    "https://github.com/CUMT-Alethic-Insight-Lab/governance-public/blob/main/docs/zh-CN/open-source-policy.md",
    [
      "开源政策",
      "Open-Source Policy"
    ]
  ],
  [
    "https://github.com/CUMT-Alethic-Insight-Lab/governance-public/blob/main/docs/zh-CN/ai-assistance-policy.md",
    [
      "AI 辅助规则",
      "AI Assistance Policy"
    ]
  ],
  [
    "https://github.com/CUMT-Alethic-Insight-Lab/governance-public/blob/main/docs/zh-CN/review-policy.md",
    [
      "Review 规则",
      "Review Policy"
    ]
  ],
  [
    "/recruitment/",
    [
      "招新流程",
      "Recruitment Process"
    ]
  ],
  [
    "/recruitment/",
    [
      "准备建议",
      "Preparation Advice"
    ]
  ],
  [
    "/flued.html",
    [
      "FLUED 研究展示",
      "FLUED Research Showcase"
    ]
  ],
  [
    "/insights-memory-hierarchy.html",
    [
      "技术博客：当模型开始吞掉记忆",
      "Insight: When Models Swallow Memory"
    ]
  ]
];

const peopleLead = [
  "名单随研究与工程进展更新，实名展示、链接可核验。 每个人都有自己负责的方向与可追踪的公开产出；了解未来加入方式，见文末招新流程。",
  "The roster is updated as research and engineering progress — real names, verifiable links. Everyone owns a direction with trackable public output; for future recruitment, see the process at the bottom."
];

const showcase = JSON.parse(readFileSync(new URL('../public/flued-segmentation-showcase.json', import.meta.url), 'utf8'));
const contact = 'contact@alethicinsight.org';
const L = (lang, pair) => pair[lang === 'en' ? 1 : 0];
const number = i => String(i + 1).padStart(2, '0');
const datum = label => `<span class="ed-datum" aria-hidden="true">[${label}]</span>`;
const terminal = '<span class="ed-terminal" aria-hidden="true">-&gt;</span>';
const action = (href, label) => `<a class="action ed-action" href="${href}">${label}${terminal}</a>`;

function chapter(id, code, title, body) {
  return `<section class="bay ed-chapter" id="${id}" aria-labelledby="${id}-title">
    <header class="ed-heading">${datum(code)}<h2 id="${id}-title">${title}</h2></header>
    <div class="ed-body">${body}</div>
  </section>`;
}

function index(items, label) {
  return `<nav class="ed-index" aria-label="${label}"><ol class="register">${items.map(([id, label], i) =>
    `<li><a href="#${encodeURIComponent(id)}">${datum(number(i))}<span>${label}</span>${terminal}</a></li>`).join('')}</ol></nav>`;
}

function rows(items) {
  return `<ul class="register ed-register">${items.map((item, i) =>
    `<li class="ed-row">${datum(number(i))}<div>${item}</div></li>`).join('')}</ul>`;
}

const levels = [
  [['社区层', 'Community'], ['无门槛', 'Open to all'], ['分享会、读书会与公开学习。通过社区群参与。', 'Join talks, reading groups, and open study sessions through the community group.']],
  [['社团层', 'Society'], ['约 15 人', 'Approx. 15 members'], ['正式成员参与项目、学习和评审，承接真实任务。', 'Full members work on projects, learn together, attend reviews and take on real tasks.']],
  [['实验室层', 'Lab'], ['约 15 人', 'Approx. 15 members'], ['参与前沿研究与平台项目，承担交付责任。', 'Work on frontier research and platform projects with responsibility for delivery.']],
];

function recruitment(lang) {
  const t = pair => L(lang, pair);
  const steps = [['申请表', 'Application'], ['机试', 'Coding test'], ['面试', 'Interview'], ['入组', 'Onboarding']];
  return chapter('join', 'JOIN', t(['加入方式', 'How to join']), `
    <p>${t(['当前招新已结束，以下为招新流程参考。', 'Recruitment is currently closed. The following steps are provided for reference.'])}</p>
    <ol class="ed-axis" aria-label="${t(['招新流程', 'Recruitment process'])}">${steps.map((step, i) =>
      `<li>${datum(number(i))}<span>${t(step)}</span></li>`).join('')}</ol>
    <div class="ed-actions">${action('/recruitment/', t(['进入招新平台', 'Enter recruitment']))}${action(`mailto:${contact}`, contact)}</div>`);
}

function renderTopic(lang, section) {
  return drawTopic(lang, { directions, projects, awards, focus, agreements, documents, levels, showcase, contact },section);
}
function renderPeople(lang) {
  const t = pair => L(lang, pair);
  return `<span id="people-title"></span>${chapter('roster', 'TEAM', t(['成员名录', 'Member roster']), `
    <p>${t(['以下为已公开的实验室成员与合作伙伴资料。身份标签以公开资料的记录时点为准。社团名册单独维护，获得本人公开授权后再发布。', 'This list contains previously published profiles of lab members and collaborators. Roles reflect the time of the public record. The society maintains a separate roster and publishes entries with each person’s consent.'])}</p>
    <ul class="register ed-people">${people.map(([names, role, links], i) => `<li>
      ${datum(number(i))}
      <div><h3>${t(names)} <span class="ed-person-other" lang="${lang === 'en' ? 'zh-CN' : 'en'}">${lang === 'en' ? names[0] : names[1]}</span></h3><p>${t(role)}</p></div>
      <div class="ed-person-links">${links.map(([href, title]) => action(href, title === 'Homepage' ? t(['个人主页', 'Homepage']) : title)).join('')}</div>
    </li>`).join('')}</ul>
    <p>${t(['关注后续招新。当前招新已结束，可查阅准备建议与招新流程。', 'Stay tuned for future recruitment. Recruitment is currently closed; preparation advice and the recruitment process remain available.'])}</p><div class="ed-actions">
      ${action('#join', t(['查看招新流程', 'View recruitment process']))}
      ${action(documents[7][0], t(documents[7][1]))}
    </div>`)}${recruitment(lang)}`;
}

const articleChinese = [
  [
    "引子",
    "引子：一条容易被误读的新闻",
    [
      [
        "p",
        [
          "2026年8月底，Qwen3.8-Flash-Next 发布。技术细节里最刺眼的不是 6B 激活参数， 而是它体内那张 ",
          [
            "51B 的 N-gram embedding 表"
          ],
          "——两千万条 bigram/trigram 条目， 插在第二层，平时躺在主机内存里，前向开始前地址就已经算好，异步预取，GPU 零争抢。"
        ]
      ],
      [
        "p",
        [
          "社区的反应很诚实：“一张巨大的作弊小抄。”"
        ]
      ],
      [
        "p",
        [
          "但这件事的真正含义不在小抄本身，而在于它",
          [
            "被放在了哪里"
          ],
          "。 这张表不进注意力、不占上下文窗口、不参与推理计算——它就是一张表，模型查它，用完就走。 这是主流大模型第一次在生产级规模上承认一件事："
        ]
      ],
      [
        "p",
        [
          [
            "知识不一定要住在权重里。"
          ]
        ]
      ],
      [
        "p",
        [
          "半年前的 DeepSeek Engram 论文（arXiv:2601.07372）把这句话说得更正式： Transformer 一直缺少原生的“查表”原语，被迫用计算模拟检索； 他们补上了这条与 MoE“条件计算”互补的稀疏轴——“条件记忆”， 并且发现了一条 U 形分配律：专家参数和记忆参数之间存在最优配比，纯 MoE 是次优解。"
        ]
      ],
      [
        "p",
        [
          "换成人话：",
          [
            "“模型该记多少东西”从此不再是一个信仰问题，而是一个有标定曲线的工程变量。"
          ]
        ]
      ]
    ]
  ],
  [
    "坐标系",
    "一个被混淆已久的问题",
    [
      [
        "p",
        [
          "过去五年，持续学习领域的争吵——灾难性遗忘怎么办、memory layer 还是 RAG、 长上下文还是检索——在我看来是同一个问题被错误地放进了错误的坐标系。"
        ]
      ],
      [
        "p",
        [
          "这个问题的正确坐标系不在机器学习里，在存储工程里。"
        ]
      ],
      [
        "p",
        [
          "任何一台计算机都在运行同一个答案：寄存器、L1/L2 缓存、内存、磁盘、网络。 没有人问“为什么不让 CPU 寄存器装上 1PB 数据”，因为每个人都理解延迟-容量权衡。 但轮到 AI，我们却一直在认真讨论“为什么不让权重记住一切”或“为什么不让上下文窗口装下一切”—— 这两个问题在存储工程师眼里，和给寄存器装硬盘是同一种荒谬。"
        ]
      ],
      [
        "p",
        [
          "一旦换到存储层次的坐标系，持续学习的整个问题图景会重新排列："
        ]
      ],
      [
        "ul",
        [
          [
            [
              "权重"
            ],
            "是寄存器：零延迟，容量最小，改动最难，只该放“热到每次都用”的东西——能力、常识、取用策略；"
          ],
          [
            [
              "KV cache"
            ],
            " 是内存：会话内精确，易失，有界；"
          ],
          [
            [
              "外置记忆"
            ],
            "是磁盘：容量近乎无限（一个硬盘柜就是 PB 级，纯文本绰绰有余），但访问要付出延迟；"
          ],
          [
            [
              "互联网"
            ],
            "是网络存储：无界，不可控，信任度未知。"
          ]
        ]
      ],
      [
        "p",
        [
          "灾难性遗忘在这个坐标系里甚至不需要“被解决”——它自动降级为缓存替换策略问题。 真正的问题变成了另外三个：索引怎么建、什么该被提升进更快的楼层、信任边界画在哪。"
        ]
      ]
    ]
  ],
  [
    "架构",
    "一个具体的形状：运行时三层，离线一层",
    [
      [
        "p",
        [
          "沿着这个思路，我在 FLUED（Fluid Language Unified Encoder-Decoder， 一个字节级语言接口的架构项目）的 v4 设计中推出了一个相当具体的形状。 FLUED 这个名字本身就是主张：Fluid 指记忆像流体，倒进什么容器就是什么形状—— 会话内是 KV，跨会话是日志，压缩了是状态矩阵，层级化了是树； Unified 指一切与主干共享字节底物的部件以无感方式参与前向， 不共享底物的资源（搜索、命令行、MCP）才以显式工具方式被调用。 ",
          [
            "以下是工作假设，不是共识。"
          ]
        ]
      ],
      [
        "p",
        [
          [
            "第一层，权重。"
          ],
          "只保留推理能力和“什么存、怎么存、取什么、怎么取、怎么用”的元策略。知识从 scaling 方程里被拿掉，从容量维度变成检索维度。"
        ]
      ],
      [
        "p",
        [
          [
            "第二层，树状模糊层。"
          ],
          "这是整个架构唯一真正的新部件。一棵 gist 树： 叶子是近无损的记忆条目，内部节点是其子树的概要。 每次前向，模型默认沿着树做 O(log n) 次 gist 比对——不是每条记忆都被检查， 而是每条记忆都在某个被检查过的 gist 的覆盖范围内。 超过阈值的，指针定位、物化进上下文；没超的，以“背景可知”的方式无感参与。"
        ]
      ],
      [
        "p",
        [
          "写入用 delta rule：先查旧记忆的预测，只写回实际值与预测值的差。 已知的东西差值近零、不写；意外的东西强写。 残差沿树上溯，写入强度逐层衰减——粗层慢变，细层快变， 多时间尺度不是调出来的超参，是树深度的自然函数。"
        ]
      ],
      [
        "p",
        [
          [
            "第三层，KV cache。"
          ],
          "现有框架一行不用改。"
        ]
      ],
      [
        "p",
        [
          [
            "第零层（离线），append-only 日志。"
          ],
          "全量、只增不改、唯一事实源。 它不出现在任何一次前向里，但三件事离不开它：树塌了从它重建、 权重周期性蒸馏时从它回放、审计时对它查询。 灾难性遗忘由此从“每次推理的在线结构必然”被搬迁成“每年一次的离线采样率超参问题”—— 后者是这个领域里被研究得最透、工具最多、可以反复重试的那种问题。"
        ]
      ],
      [
        "p",
        [
          "连接这一切的是一条接口规范：",
          [
            "主干对树节点、KV 条目、自身输出使用同一套 query-key 几何， 任何一层返回的记忆在表示空间里不可区分。"
          ],
          " 满足这条，“模型对记忆无感”就不是设计目标而是定义性事实—— 层间差异只剩延迟和保真度，而这两者恰好是路由策略可以动态权衡的量。"
        ]
      ]
    ]
  ],
  [
    "证据",
    "证据正在向这个方向收敛",
    [
      [
        "p",
        [
          "这个架构里的大部分零件，过去一年里被不同团队从完全不同的动机独立做出来了："
        ]
      ],
      [
        "ul",
        [
          [
            "Google 的 Titans 证明了“意外驱动写入”（surprise）在 200 万 token 尺度上有效；"
          ],
          [
            "NVIDIA 的 GDN2 把记忆的“擦除”和“写入”解耦，消融显示擦除侧贡献更大——",
            [
              "维护已有关联比写入新内容更关键"
            ],
            "；"
          ],
          [
            "LiveMem 已经实现了“冻结主干 + 并行记忆分支 + KV 逐出后信息留存”的完整骨架；"
          ],
          [
            "DeepSeek 的 Engram 和 Qwen 的 N-gram 表证明了查表记忆可以生产化——并且诚实地报告了天花板：词表扩大单调降 loss，但下游收益饱和；"
          ],
          [
            "更微妙的两篇：Tokenizer-Agnostic Engram 把 N-gram 建立在字节序列上以摆脱分词器锁死；Cross-Model Memory Transfer 证明冻结的记忆表可以迁移到别的模型——",
            [
              "只要寻址、存储、读取三者分离"
            ],
            "。"
          ]
        ]
      ],
      [
        "p",
        [
          "最后这一点值得停顿一下。记忆可移植的前提是接口标准化—— 这和一个世纪前螺丝螺纹标准化是同一个逻辑。谁先定下接口，谁定义生态。"
        ]
      ],
      [
        "p",
        [
          "而天花板之上——可写的、分层的、随经验在线增长的那部分记忆——目前没人占位。 Qwen 的表是字典，出厂封版、只读、平坦；真正难也真正值钱的是日记：可写、有层级、随生命周期生长。"
        ]
      ]
    ]
  ],
  [
    "硬件",
    "硬件经济学：另一个被忽略的论据",
    [
      [
        "p",
        [
          "三条稀疏化路线对应三种资源禀赋。MoE 吃计算；Engram 吃 DRAM 的容量和带宽 （靠数据无关寻址做异步预取，把带宽问题转化为调度问题）； 树状记忆吃 SSD 的容量——每 TB 成本和 HBM 差着两个数量级，每次查询只付 O(log n) 次小读取。"
        ]
      ],
      [
        "p",
        [
          "软肋也诚实交代：树搜索是数据依赖的指针追逐，下一跳地址由本跳结果决定， 无法像 Engram 那样整体预取。 缓解方案是分层放置（热点 gist 钉在内存，深叶落盘）加批量投机预取（比较当前节点时把子节点一次顺序读入）。"
        ]
      ],
      [
        "p",
        [
          "把三条路线放一起看，结论比任何单独一条都大：",
          [
            "记忆外置不存在单一的硬件形态，而是一条从 HBM 到硬盘的连续放置谱系——数据温度决定物理楼层。"
          ],
          "智能的成本结构由架构决定，不由模型决定。"
        ]
      ]
    ]
  ],
  [
    "预测",
    "预测（可证伪，欢迎打脸）",
    [
      [
        "ol",
        [
          [
            [
              "6 个月内"
            ],
            "，头部开源基座模型会原生集成“可在线写入的分层记忆”部件（区别于 Engram 的只读静态表），大概率以 GDN 类状态矩阵为基底加分层索引； ",
            [
              "状态："
            ],
            "[待验证，期限 2027-03-03]"
          ],
          [
            [
              "12 个月内"
            ],
            "，会出现记忆接口标准化的认真尝试——“记忆的 CUDA 时刻”，即寻址/存储/读取分离成为设计共识； ",
            [
              "状态："
            ],
            "[待验证，期限 2027-09-03]"
          ],
          [
            "“可审计性 vs 端到端可微”的张力会成为显学：凡是能被查账的系统必有离散边界，离散边界必然收训练税——围绕“税率”而非“免税”的工程会增多； ",
            [
              "状态："
            ],
            "[待验证，期限 2028-09-03]"
          ],
          [
            "周期性离线蒸馏 + 全量日志回放会成为持续学习的主流工程范式，在线权重更新在多数场景被证伪为不值得； ",
            [
              "状态："
            ],
            "[待验证，期限 2028-09-03]"
          ],
          [
            "工作记忆容量的认知科学结论（4±1 槽位）会反向约束物化带宽设计——Anthropic 的 J-space 工作及其开源复现已经在给出数量级证据。 ",
            [
              "状态："
            ],
            "[待验证，期限 2028-09-03]"
          ]
        ]
      ],
      [
        "p",
        [
          "如果以上有一条在期限内被证伪，这篇博客的相应部分就应该被修订——这正是把它写成预测而非观点的原因。"
        ]
      ]
    ]
  ],
  [
    "结尾",
    "结尾：智能住在哪一层",
    [
      [
        "p",
        [
          "有一个观察我越想越觉得不是巧合：这套四层结构——慢而稳的内核、快而变的记忆、 易失的工作区、不可变的事实源——和一个运行良好的心智几乎同构。 人的内核（性格、能力）更新极慢且需要睡眠般的离线回放； 日常经验先以概要形式存在，细节按需还原； 而日记和档案之所以被发明，正是因为我们早就知道内核装不下一切。"
        ]
      ],
      [
        "p",
        [
          "也许这暗示着，“智能”从来不住在某一层里。 它住在层与层之间的接口上——住在“什么该被记住、什么该被忘掉、什么该被信任、什么时候该去查”的调度里。 模型只是租户，架构才是建筑。"
        ]
      ],
      [
        "p",
        [
          "而我们现在正处在建筑图纸刚刚可以被画出来的时刻。"
        ]
      ]
    ]
  ]
];

const articleReferences = [
  [
    "DeepSeek Engram — Conditional Memory via Scalable Lookup: ",
    [
      "arXiv:2601.07372",
      "https://arxiv.org/abs/2601.07372"
    ],
    " · ",
    [
      "GitHub",
      "https://github.com/deepseek-ai/Engram"
    ]
  ],
  [
    "Qwen3.8-Flash-Next — ",
    [
      "GitHub",
      "https://github.com/QwenLM/Qwen3.8-Flash-Next"
    ],
    " · ",
    [
      "Hugging Face",
      "https://huggingface.co/Qwen/Qwen3.8-Flash-Next"
    ],
    " · 架构分析 ",
    [
      "arXiv:2608.30320",
      "https://arxiv.org/abs/2608.30320"
    ]
  ],
  [
    "Google Titans — ",
    [
      "arXiv:2501.00663",
      "https://arxiv.org/abs/2501.00663"
    ],
    " · MIRAS ",
    [
      "arXiv:2504.13173",
      "https://arxiv.org/abs/2504.13173"
    ],
    " · Nested Learning ",
    [
      "arXiv:2512.24695",
      "https://arxiv.org/abs/2512.24695"
    ]
  ],
  [
    "NVIDIA Gated DeltaNet-2 — ",
    [
      "arXiv:2605.22791",
      "https://arxiv.org/abs/2605.22791"
    ]
  ],
  [
    "LiveMem — ",
    [
      "arXiv:2608.02515",
      "https://arxiv.org/abs/2608.02515"
    ]
  ],
  [
    "DeepSeek-V3.2 DSA — ",
    [
      "arXiv:2512.02556",
      "https://arxiv.org/abs/2512.02556"
    ]
  ],
  [
    "RAPTOR — ",
    [
      "arXiv:2401.18059",
      "https://arxiv.org/abs/2401.18059"
    ]
  ],
  [
    "Tokenizer-Agnostic Engram — ",
    [
      "arXiv:2607.29065",
      "https://arxiv.org/abs/2607.29065"
    ],
    " · Cross-Model Memory Transfer ",
    [
      "arXiv:2608.17050",
      "https://arxiv.org/abs/2608.17050"
    ]
  ],
  [
    "Anthropic J-space / Global Workspace — ",
    [
      "研究主页",
      "https://www.anthropic.com/research/global-workspace"
    ]
  ]
];

const articleTitle = ['当模型开始吞掉记忆：从 Engram 到一种分层记忆架构的前瞻', 'When models start to swallow memory: from Engram to a hierarchical memory architecture'];
const articleIntro = ['一篇关于持续学习、存储层次与「知识到底该住在哪」的讨论与预测。', 'An essay and a set of predictions about continual learning, storage hierarchies, and where knowledge should live.'];
const englishTitles = ['A piece of news that is easy to misread', 'A problem in the wrong coordinate system', 'Three runtime layers and one offline layer', 'Evidence is converging', 'The economics of hardware', 'Five falsifiable predictions', 'Where intelligence lives'];
const englishProse = [
  [
    'Qwen3.8-Flash-Next was released in late August 2026. The most striking detail was its 51B-parameter N-gram embedding table, more than the 6B active parameters. Some 20 million bigram and trigram entries feed the second layer. They sit in host memory, with addresses computed before the forward pass for asynchronous prefetch without GPU contention.',
    'The community called it a giant cheat sheet. Its placement is what matters. The table stays out of attention, takes up no context window, and adds no inference computation. The model looks things up as it needs them. At production scale, it shows that knowledge can live outside model weights.',
    'The earlier DeepSeek Engram paper (arXiv:2601.07372) framed this more formally. Transformers lack a native lookup primitive and approximate retrieval with computation. Engram introduces conditional memory as a sparse axis alongside conditional computation in MoE. Its U-shaped allocation curve suggests an optimal mix of expert and memory parameters, with pure MoE falling short of that optimum.',
    'How much a model should remember becomes an engineering variable with a calibration curve.',
  ],
  [
    'Debates in continual learning about catastrophic forgetting, memory layers versus RAG, and long context versus retrieval have placed one problem in the wrong coordinate system. Storage engineering offers a better frame.',
    'Every computer uses a hierarchy of registers, L1 and L2 caches, RAM, disks, and the network. Nobody puts a petabyte in CPU registers. The latency–capacity tradeoff is obvious. Asking weights to memorize everything or context to hold everything is much the same mistake.',
    ['ul', [
      'Weights are like registers: zero lookup latency, the smallest capacity, and the hardest to change. Reserve them for frequently used skills, common knowledge, and access strategies.',
      'The KV cache is like RAM: exact within the session, volatile, and bounded.',
      'External memory is like disk: very large, with an access-latency cost. A rack can hold petabytes, plenty for text.',
      'The internet is like network storage: unbounded, uncontrolled, and of uncertain trust.',
    ]],
    'Catastrophic forgetting then becomes a cache replacement problem. The questions become how to index, what to promote to faster tiers, and where to draw the trust boundary.',
  ],
  [
    'FLUED (Fluid Language Unified Encoder-Decoder) is an architecture project for a byte-level language interface. In my v4 proposal, “fluid” means memory takes the form of its container: KV within a session, logs across sessions, a state matrix when compressed, and a tree when organized hierarchically. “Unified” means components sharing the backbone’s byte substrate participate directly in the forward pass. Search, command lines, and MCP are explicitly invoked tools because they do not share that substrate. This is a working hypothesis.',
    'Layer 1, weights. Keep reasoning and the policies for what to store, retrieve, and use. Knowledge enters the scaling problem through retrieval instead of weight capacity.',
    'Layer 2, a tree of approximate memories. Leaves contain near-lossless entries. Internal nodes summarize their subtrees. Each forward pass does O(log n) comparisons against these gists. A memory may be covered by a gist without being inspected individually. Above-threshold matches are located through pointers and materialized in context. Lower-scoring matches remain available as background.',
    'Writing uses a delta rule. Look up the prediction made by older memories and write back only the error. Familiar inputs produce near-zero updates. Surprises produce larger ones. Residuals propagate up the tree and weaken at each level. Coarse layers change slowly and fine layers change quickly, with timescales emerging from tree depth.',
    'Layer 3, KV cache. The existing framework stays as it is.',
    'Layer 0, the offline append-only log. This is the complete, immutable source of truth. It sits outside the forward pass and supports tree reconstruction, replay during periodic distillation, and auditing. Forgetting moves from an online constraint on each inference to an offline choice of sampling rate, where experiments can be repeated and the tools are mature.',
    'The interface uses the same query–key geometry for tree nodes, KV entries, and backbone outputs. Memory from different layers is indistinguishable in representation space. Latency and fidelity remain different, so routing can trade them off dynamically.',
  ],
  [
    'Separate teams have built many of these pieces over the past year for different reasons.',
    ['ul', [
      'Google’s Titans shows the value of surprise-driven writing at the scale of two million tokens.',
      'NVIDIA’s GDN2 separates erasing from writing. Ablation shows a larger contribution from erasure, suggesting that maintaining associations matters more than adding new ones.',
      'LiveMem combines a frozen backbone, a parallel memory branch, and information retention after KV eviction.',
      'DeepSeek Engram and Qwen’s N-gram table show that lookup memory can be used in production. They also report a ceiling: expanding vocabulary steadily reduces loss while downstream gains saturate.',
      'Tokenizer-Agnostic Engram constructs N-grams on bytes to avoid tokenizer lock-in. Cross-Model Memory Transfer shows that frozen tables can move between models when addressing, storage, and readout are separate.',
    ]],
    'Portable memory needs a standardized interface. As with standardized screw threads, defining the interface shapes the ecosystem.',
    'Writable hierarchical memory that grows online with experience remains open territory in this essay’s assessment. Qwen’s table is like a printed dictionary: read-only and flat. A diary adds writing, levels, and growth over its lifetime.',
  ],
  [
    'The three routes to sparsity draw on different resources. MoE uses compute. Engram uses DRAM capacity and bandwidth, turning bandwidth into a scheduling issue through asynchronous prefetch with data-independent addressing. Tree memory uses SSD capacity. Its cost per terabyte is about two orders of magnitude below HBM, with O(log n) small reads per lookup.',
    'The drawback is data-dependent pointer chasing: the next address depends on the current result, so Engram-style bulk prefetch is unavailable. Possible mitigations include pinning hot gists in memory, storing deep leaves on disk, and speculatively reading a node’s children in sequence while scoring the node.',
    'Taken together, memory can live anywhere along the spectrum from HBM to disk, with data temperature dictating physical placement. Architecture determines the cost structure of intelligence.',
  ],
  [
    ['ol', [
      'Within six months, a leading open foundation model will integrate writable hierarchical memory, likely using a GDN-like state matrix with hierarchical indexing. Status: pending. Due 2027-03-03.',
      'Within twelve months, there will be a serious effort to standardize the memory interface, separating addressing, storage, and readout. Status: pending. Due 2027-09-03.',
      'The tradeoff between auditability and end-to-end differentiability will become a mainstream engineering concern. Auditable discrete boundaries carry a training cost, and more work will measure and manage it. Status: pending. Due 2028-09-03.',
      'Periodic offline distillation with full log replay will become a mainstream continual learning approach. Online weight updates will prove poor value in most settings. Status: pending. Due 2028-09-03.',
      'Cognitive-science estimates of working memory at 4 ± 1 slots will constrain materialization bandwidth. Anthropic’s J-space work and open replications already suggest the order of magnitude. Status: pending. Due 2028-09-03.',
    ]],
    'If an experiment falsifies a prediction before its deadline, the corresponding section of the essay should change.',
  ],
  [
    'A slow, stable core, fast-changing memory, volatile workspace, and immutable source of truth look remarkably like a functioning mind. Character and ability change slowly and need offline replay like sleep. Experience starts as a summary with details reconstructed on demand. Diaries and archives exist because the core cannot hold everything.',
    'Intelligence may live in the interfaces between the layers, in how a system chooses what to remember, forget, trust, and look up. The model is a tenant. The architecture is the building.',
    'We are at the point where the blueprints can finally be drawn.',
  ],
];

function inline(tokens, lang) {
  return tokens.map(token => {
    if (typeof token === 'string') return lang === 'en' ? token.replace('架构分析', 'analysis') : token;
    const [label, href] = token;
    if (!href) return `<strong>${label}</strong>`;
    return `<a href="${href}">${lang === 'en' && label === '研究主页' ? 'Research page' : label}</a>`;
  }).join('');
}

function prose(blocks, lang) {
  return blocks.map(([kind, value]) => kind === 'p'
    ? `<p>${inline(value, lang)}</p>`
    : `<${kind}>${value.map(item => `<li>${inline(item, lang)}</li>`).join('')}</${kind}>`).join('');
}

function renderArticle(lang) {
  const t = pair => L(lang, pair);
  const titleFor = (zh, i) => t([zh, englishTitles[i]]);
  const note = t([
    '文中 FLUED v4 为作者尚未发表的工作假设。文末五条预测附有验证期限与状态，欢迎用实验检验，到期回填。',
    'FLUED v4 is the author’s unpublished working hypothesis. The five predictions include verification deadlines and statuses. The author invites experimental tests and plans to record the results when the deadlines arrive.',
  ]);
  const sections = articleChinese.map(([id, zh, blocks], i) => {
    const content = lang === 'en' ? englishProse[i].map(item => Array.isArray(item)
      ? [item[0], item[1].map(line => [line])]
      : ['p', [item]]) : blocks;
    return `<section class="ed-reading-stop" aria-labelledby="${id}"><h2 id="${id}">${datum(number(i))}${titleFor(zh, i)}</h2>${prose(content, lang)}</section>`;
  });
  const refs = t(['参考文献', 'References']);
  return `<div class="bay ed-paper" id="insight-title">
    ${index([...articleChinese.map(([id, zh], i) => [id, titleFor(zh, i)]), ['refs-title', refs]], t(['文章目录', 'Article contents']))}
    <article class="ed-prose" aria-label="${t(['文章正文', 'Article text'])}">
      <div class="ed-byline"><p>${t(['作者', 'Author'])} · <a href="/people.html">${t(['王张嘉', 'Zhangjia Wang'])}</a> · <time datetime="2026-09-03">2026-09-03</time> · v1.0</p>
      <p>${t(['本文为作者个人观点，不代表实验室立场。', 'The views expressed are the author’s own.'])} ${note}</p></div>
      ${sections.join('')}
      <section class="ed-reading-stop" aria-labelledby="refs-title"><h2 id="refs-title">${datum('08')}${refs}</h2>
        ${prose([['ul', articleReferences]], lang)}
        <p>${t(['文中 FLUED v4 为思想层描述，不含具体实现细节。证据等级与完整溯源以内部备忘录为准。', 'This essay discusses FLUED v4 at the conceptual level. The internal memo contains the evidence ratings and full provenance.'])}</p>
      </section>
    </article>
  </div>`;
}

const editorialPages = {
  'index.html': {
    title: ['CUMT Alethic Insight AI Lab', 'CUMT Alethic Insight AI Lab'],
    intro: ['中国矿业大学学生主导的 AI 研究与工程共同体。', 'A student-led AI research and engineering community at China University of Mining and Technology.'],
    render: () => '',
  },
  'people.html': { title: ['成员', 'People'], intro: peopleLead, render: renderPeople },
  'insights-memory-hierarchy.html': { title: articleTitle, intro: articleIntro, render: renderArticle },

};

for (const topic of topics) {
  const render = editorialPages[topic.file]?.render || (lang => renderTopic(lang,topic.section));
  editorialPages[topic.file] = { ...topic, render };
}
export { editorialPages };
