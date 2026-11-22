import { migrateHomeLink, topics } from './topic-routes.mjs';

const detailActions = {
  'people.html':['查看成员名录','Meet the members','#roster'],
  'insights-memory-hierarchy.html':['开始阅读','Read the essay','#引子'],
  'flued.html':['打开推理演示','Run the demo','/flued-demo.html#input'],
  'flued-architecture.html':['查看架构流程','Explore the pipeline','#pipeline'],
  'flued-demo.html':['选择输入样本','Choose a sample','#input'],
  'flued-evidence.html':['查看训练曲线','Read the curves','#curves'],
  'flued-experiments.html':['检索实验记录','Search experiments','#ledger'],
  '404.html':['返回实验室介绍','About the lab','/about.html'],
};

export function topicHeading(page,file,lang) {
  const index=lang==='en'?1:0;
  const subject=topics.find(item=>item.file===file);
  const action=subject ? [...subject.action,subject.href] : detailActions[file];
  const id=subject ? `${subject.section}-title` : 'page-heading';
  return `<header class="topic-hero" id="top"><div class="topic-lead"><h1 id="${id}">${page.title[index]}</h1><p>${page.intro[index]}</p><a class="topic-primary" data-primary href="${action[2]}">${action[index]}<span aria-hidden="true">→</span></a></div></header>`;
}

export function readingLinks(file,lang) {
  const index=topics.findIndex(item=>item.file===file);
  if (index<0)return '';
  const en=lang==='en';
  const next=topics[(index+1)%topics.length];
  const previous=topics[(index+topics.length-1)%topics.length];
  return `<nav class="reading-links" aria-label="${en?'Continue reading':'连续阅读'}"><a href="/${previous.file}" rel="prev">${en?'Previous':'上一页'} · ${previous.title[en?1:0]}</a><a data-next-topic rel="next" href="/${next.file}">${en?'Next':'下一页'} · ${next.title[en?1:0]} <span aria-hidden="true">→</span></a></nav>`;
}

export function normalizeLinks(markup) {
  return markup.replace(/href="(\/(?:index\.html)?#[^" ]+)"/g,(_,url)=>`href="${migrateHomeLink(url)}"`);
}
