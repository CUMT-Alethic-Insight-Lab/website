// Public addresses, reading order and historical home fragments share one table.
export const topics = [
  ['about','position','实验室介绍','About the lab','由繁得构，由构显真。中国矿业大学学生主导的 AI 研究与工程共同体。','A student-led AI research and engineering community at China University of Mining and Technology.','了解组织结构','Explore the organization','/structure.html'],
  ['structure','structure','组织结构','Organization','社区开放参与，社团和实验室各约 15 人。','The community is open to everyone. The society and lab each have approximately 15 members.','了解研究方向','Explore research directions','/research.html'],
  ['research','work','研究方向','Research directions','从七个方向找到你想研究的问题。','Explore the questions behind seven areas of research.','查看 FLUED 研究','Explore FLUED','/flued.html'],
  ['focus','focus','三大面向','What we do','通过公开实验、可用系统与竞赛记录，了解团队的工作。','Discover the work through experiments, working systems and competition records.','查看公开项目','View open projects','/projects.html'],
  ['projects','projects','公开项目','Open projects','从字节级语言建模到开源工具，查看研究如何成为可用的系统。','Explore research and tools, from byte-level language modeling to public infrastructure.','打开 FLUED','Explore FLUED','/flued.html'],
  ['awards','awards','获奖成果','Awards','查看竞赛队伍、获奖记录与原始证书。','Explore the teams, their results and the original certificates.','查看获奖队伍','View winning teams','#awards'],
  ['agreement','work-mode','协作公约','Working agreements','团队用公开记录支持评审、复现与交接。','Public records support review, reproducibility and handover.','查阅协作条款','Read the agreements','#work-mode'],
  ['documents','documents','关键文档','Key documents','从组织规则、招新资料和技术文章中找到原文。','Find original governance documents, recruitment information and research writing.','浏览文档目录','Browse documents','#documents'],
  ['join','join','加入方式','Join the team','当前招新已结束；可查看招新流程与准备建议。','Recruitment is currently closed; explore the process and preparation advice.','进入招新平台','Enter recruitment','/recruitment/'],
].map(([slug, section, zh, en, leadZh, leadEn, actionZh, actionEn, href]) => ({file:`${slug}.html`,section,title:[zh,en],intro:[leadZh,leadEn],action:[actionZh,actionEn],href}));

export const legacyHome = {entry:'about.html',main:'about.html','hero-title':'about.html'};
for (const {file,section} of topics) {
  legacyHome[section] = file;
  legacyHome[`${section}-title`] = file;
}
Object.assign(legacyHome, {'direction-story-title':'research.html#direction-story-title','project-story-title':'projects.html#project-story-title','award-story-title':'awards.html#award-story-title'});
for (const name of ['llm','cv','vlm','rl','agent','memory','infra']) legacyHome[`direction-${name}`] = `research.html#direction-${name}`;
export function migrateHomeLink(url) {
  const match = /^\/(?:index\.html)?#([^?]+)$/.exec(url);
  if (!match || !Object.hasOwn(legacyHome,match[1])) return url;
  return `/${legacyHome[match[1]]}`;
}
