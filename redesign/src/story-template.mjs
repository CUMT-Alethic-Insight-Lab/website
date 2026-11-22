import {renderLab} from './lab-workbench.mjs';
import { topics } from './topic-routes.mjs';

const compatibilityPages = new Map(topics.filter(topic => topic.file !== 'meeting.html').map(topic => [topic.file, topic.section]));
export function oldTopic(file) { return compatibilityPages.get(file); }
export function storyHref(url, onHome) {
  const match = /^\/(?:index\.html)?#(.+)$/.exec(url);
  if (match) return onHome ? `#${match[1]}` : `/#${match[1]}`;
  const page = /^\/([\w-]+\.html)(?:#([\w-]+))?$/.exec(url);
  if (!page || !compatibilityPages.has(page[1])) return url;
  const section = compatibilityPages.get(page[1]);
  const anchor = page[2]?.startsWith('item-') ? `${section}-${page[2]}` : page[2] || section;
  return `${onHome ? '' : '/'}#${anchor}`;
}

const action = {
  position: [['认识团队','Meet the team'],'/people.html'],
  work: [['查看 FLUED 研究','Explore FLUED'],'/flued.html'],
  meeting: [['打开流程演示','Explore the review process'],'/meeting.html'],
};
function meetingPreview(en) {
  const steps=[['submission','投稿','Submit','作者','Author'],['review','评审','Review','评审人','Reviewer'],['discussion','讨论','Discuss','作者与评审人','Author and reviewers'],['decision','决定','Decide','组织者','Organizer']];
  return `<ol class="story-meeting-path">${steps.map(([id,zh,english,role,roleEn])=>`<li><a href="/meeting.html#stage-${id}"><small>${en?roleEn:role}</small><strong>${en?english:zh}</strong></a></li>`).join('')}</ol>`;
}
export function renderStory(files,lang) {
  const en=lang==='en';
  return topics.map((topic,index)=>{
    const {section,file}=topic;
    if(section==='position')return renderLab(lang);
    const copy=files[file];
    let body = file === 'meeting.html' ? meetingPreview(en) : copy.render(lang).replace(`class="topic-content" id="${section}"`, `class="topic-content"`);
    if(section==='position') body=body.replace(/<h2 class="about-heading">.*?<\/h2>/,'').replace(/<a class="chart-link" href="\/people.html">.*?<\/a>/,'');
    if(section==='projects') {
      const marker='<div class="project-directory">';
      const start=body.indexOf(marker);
      const end=body.lastIndexOf('</section>');
      if(start>=0 && end>start) {
        const summary=en?'Other projects, governance and resources':'其他项目、治理与学习资源';
        body=body.slice(0,start)+'<details class="story-directory"><summary>'+summary+'</summary>'+body.slice(start,end)+'</details>'+body.slice(end);
      }
    }
    let titleArt='';
    if (section==='awards') {
      body=body.replace(/<pre data-award-medal[^>]*>[\s\S]*?<\/pre>/, markup=>{titleArt=markup;return '';});
    }
    const item=action[section];
    const title=index===0 ? ['从问题，走到系统。','From question to system.'][+en] : topic.title[+en];
    const heading=index===0?'h1':'h2';
    const lead=section==='position'?['中国矿业大学 · Alethic Insight','China University of Mining and Technology · Alethic Insight'][+en]:topic.intro[+en];
    return `<section class="story-screen" id="${section}" data-scene-page="${file}" aria-labelledby="${section}-title"><div class="story-layout"><header class="story-intro"><${heading} id="${section}-title">${title}</${heading}><p>${lead}</p>${item?`<a class="story-action" data-primary href="${item[1]}">${item[0][+en]}<span aria-hidden="true">↗</span></a>`:''}${titleArt}</header><div class="story-content">${body}</div></div></section>`;
  }).join('');
}
