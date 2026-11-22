import { oldTopic, renderStory, storyHref } from './src/story-template.mjs';
import { topicHeading } from './src/page-template.mjs';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { editorialPages } from './src/editorial.mjs';
import { fluedPages } from './src/flued.mjs';

const base = new URL('./', import.meta.url);
const dist = new URL('dist/', base);
const files = {
  ...editorialPages,
  ...fluedPages,
  '404.html': { title: ['找不到这一页', 'Page not found'], intro: ['这个地址没有对应的页面。', 'This address has no matching page.'], render: lang => `<section class="bay"><a class="action" href="/">${lang === 'zh' ? '返回首页' : 'Back to home'} <span aria-hidden="true">-&gt;</span></a></section>` },
};
const styles = ['system.css', 'editorial.css', 'flued.css', 'signals.css', 'field-theme.css', 'header.css', 'home-chapters.css', 'home-nav.css', 'editorial-refresh.css', 'paged.css', 'page-scene.css','scroll-story.css', 'controls.css', 'lab-edition.css','site-cursor.css', 'design-system.css'];
const modules = ['coordinates.mjs','site-cursor.mjs', 'page-scene.mjs','scroll-story.mjs', 'anchor-scroll.mjs', 'travel.mjs', 'field.mjs', 'lab-engraving.mjs', 'org-wires.mjs', 'lab-workbench.mjs', 'award-archive.mjs', 'home-chapters.mjs', 'home-nav.mjs', 'entry.mjs', 'meeting-ui.mjs', 'flued-ui.mjs', 'flued.mjs', 'flued-source-notes.mjs'];
const css = (await Promise.all(styles.map(name => readFile(new URL(`src/${name}`, base), 'utf8')))).join('\n');
const scriptSources = await Promise.all(modules.map(name => readFile(new URL(`src/${name}`, base))));
const version = createHash('sha256').update(css);
scriptSources.forEach(source => version.update(source));
const release = version.digest('hex').slice(0, 12);
const assets = new URL(`assets/${release}/`, dist);
await mkdir(assets, { recursive: true });
await cp(new URL('public/', base), dist, { recursive: true });
await writeFile(new URL('drawing.css', assets), css);
await Promise.all(modules.map((name, i) => writeFile(new URL(name, assets), scriptSources[i])));

const escape = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const translate = (lang, text) => Array.isArray(text) ? text[lang === 'en' ? 1 : 0] : text;
const organization = 'https://github.com/CUMT-Alethic-Insight-Lab';
const huggingFace = 'https://huggingface.co/Alethic-Insight';
const researchRoutes = [
  ['FLUED 总览', 'FLUED overview', '/flued.html'],
  ['架构', 'Architecture', '/flued-architecture.html'],
  ['推理演示', 'Inference demo', '/flued-demo.html'],
  ['训练证据', 'Training evidence', '/flued-evidence.html'],
  ['实验图谱', 'Experiment atlas', '/flued-experiments.html'],
];
const governance = `${organization}/governance-public/blob/main/docs/zh-CN`;
const documentRoutes = [
  ['技术文章', 'Technical essay', '/insights-memory-hierarchy.html'],
  ['章程', 'Charter', `${governance}/charter.md`],
  ['成员规则', 'Membership', `${governance}/membership.md`],
  ['项目治理', 'Project governance', `${governance}/project-governance.md`],
  ['招新流程', 'Recruitment', '/recruitment/'],
];
const siteNavigation = [
  ['组织', 'Organization', [
    ['组织定位', 'About the lab', '/about.html', 'position'], ['组织架构', 'Structure', '/structure.html', 'structure'],
    ['成员', 'People', '/people.html'], ['协作公约', 'Working agreement', '/agreement.html', 'work-mode'],
  ]],
  ['研究', 'Research', [
    ['研究方向', 'Research directions', '/research.html', 'work'], ['三大面向', 'What we do', '/focus.html', 'focus'],
    ['公开项目', 'Open projects', '/projects.html', 'projects'], ['FLUED 总览', 'FLUED overview', '/flued.html', null, '/flued'],
  ]],
  ['成果与资料', 'Outcomes & Resources', [
    ['竞赛成果', 'Awards', '/awards.html', 'awards'], ['文档', 'Documents', '/documents.html', 'documents'],
    ['技术文章', 'Technical essay', '/insights-memory-hierarchy.html'],
  ]],
  ['参与', 'Get involved', [
    ['会议', 'Meetings', '/meeting.html', 'meeting'], ['加入', 'Join', '/join.html', 'join'], ['招新平台', 'Recruitment platform', '/recruitment/'],
  ]],
];

function localizeLinks(html) {
  return html.replace(/\bhref=(["'])\/(?!\/)([^"']*)\1/g, (original, quote, url) => {
    const path = url.split(/[?#]/)[0];
    return (!path || Object.hasOwn(files, path)) ? `href=${quote}/en/${url}${quote}` : original;
  });
}

function html(page, file, lang) {
  const home = file === 'index.html';
  const en = lang === 'en';
  const t = (zh, english) => (en ? english : zh);
  const title = escape(translate(lang, page.title));
  const intro = escape(translate(lang, page.intro));
  const path = home ? '/' : `/${file}`;
  const canon = `https://alethicinsight.com${en ? '/en' : ''}${oldTopic(file) ? '/#'+oldTopic(file) : path}`;
  const opening = home ? `<section id="top" class="opening" aria-label="Alethic Insight 真知灼见"><a href="#entry" aria-label="${t('进入 Alethic Insight 官网', 'Enter Alethic Insight website')}"><canvas aria-hidden="true"></canvas><pre aria-hidden="true">    +     :     /     +

  A L E T H I C
  I N S I G H T

    +     /     :     +</pre></a></section>` : '';
  const navigationLabel = t('网站导航', 'Site navigation');
  const routeState = ([,, url,, family]) => url === path ? 'page' : family && path.startsWith(family) ? 'family' : '';
  const navigation = `<header id="entry" class="sheet site-header" data-site-header${home ? ' data-site-longform' : ''} tabindex="-1" aria-label="${navigationLabel}">
      <div class="site-nav-bar">
        <a href="${home ? '#top' : '/'}" class="identity" aria-label="Alethic Insight ${t('首页', 'home')}">
          <img class="brand-logo" src="/mark.svg" width="44" height="44" alt="">
          <span>ALETHIC INSIGHT<small>CUMT · AI SOCIETY &amp; LAB</small></span>
        </a>
        <div class="site-nav-main" data-site-main-menu>
          <button type="button" class="site-nav-control site-nav-toggle" data-site-nav-toggle aria-controls="site-nav-content" aria-expanded="false" hidden>${t('栏目', 'Menu')}<i class="site-nav-chevron" aria-hidden="true"></i></button>
          <nav class="site-nav-content" id="site-nav-content" aria-label="${t('主要栏目', 'Primary navigation')}">
            <ul class="site-nav-list">${siteNavigation.map(([zh, english, routes], index) => {
              const label = escape(t(zh, english));
              return `<li class="site-nav-group" data-site-group="${index}"${routes.some(routeState) ? ' data-current' : ''}>
                <button type="button" id="site-nav-trigger-${index}" class="site-nav-control site-nav-primary" data-site-disclosure aria-expanded="false" aria-controls="site-nav-panel-${index}" hidden><span>${label}</span><i class="site-nav-chevron" aria-hidden="true"></i></button>
                <span class="site-nav-fallback" id="site-nav-label-${index}">${label}</span>
                <ul class="site-nav-flyout" id="site-nav-panel-${index}" aria-labelledby="site-nav-label-${index}">
                  ${routes.map(route => {
                    const [zh, english, url, section] = route;
                    const state = routeState(route);
                    const href = section ? `${home ? '' : '/'}#${section}` : url;
                    return `<li><a href="${href}"${section ? ` data-site-chapter="${section}" data-site-page="${url.slice(1)}"` : ''}${state === 'page' ? ' aria-current="page"' : state === 'family' ? ' data-family="true"' : ''}>${escape(t(zh, english))}</a></li>`;
                  }).join('')}
                </ul>
              </li>`;
            }).join('')}</ul>
          </nav>
        </div>
        <div class="site-nav-actions">
          <a class="site-nav-control" href="/login" data-site-account data-account-href="/account" data-account-label="${t('个人中心', 'Account')}">${t('登录', 'Log in')}</a>


        </div>
        <div class="site-nav-context">
          <nav class="site-nav-resources" aria-label="${t('组织资源', 'Organization resources')}">
            <a class="site-nav-control" href="${organization}" aria-label="GitHub" title="GitHub"><svg class="site-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.52-1.3-1.26-1.65-1.26-1.65-1.02-.7.08-.69.08-.69 1.14.08 1.74 1.16 1.74 1.16 1 1.72 2.64 1.22 3.28.93.1-.73.39-1.22.71-1.5-2.5-.29-5.13-1.25-5.13-5.57 0-1.23.44-2.23 1.16-3.02-.12-.29-.5-1.43.11-2.98 0 0 .95-.3 3.09 1.15a10.73 10.73 0 0 1 5.63 0c2.14-1.45 3.08-1.15 3.08-1.15.62 1.55.23 2.69.12 2.98.72.79 1.15 1.79 1.15 3.02 0 4.33-2.63 5.28-5.14 5.56.4.35.76 1.04.76 2.09v3.1c0 .3.2.65.77.54A11.25 11.25 0 0 0 12 .75Z"/></svg><span>GitHub</span></a>
            <a class="site-nav-control" href="${huggingFace}" aria-label="Hugging Face" title="Hugging Face"><span class="site-nav-icon site-nav-emoji" aria-hidden="true">🤗</span><span>Hugging Face</span></a>
          </nav>
          ${home ? '<span class="site-nav-current" data-site-current hidden></span>' : ''}
        </div>
      </div>
    </header>
    <div class="sheet site-preferences-lane">
      <details class="site-preferences" data-site-preferences${home ? ' data-preferences-offstage' : ''}>
        <summary class="site-preferences-handle" data-preferences-handle title="${t('语言与外观偏好', 'Language and appearance preferences')}">
          <span aria-hidden="true">[Aa]</span><span class="site-preferences-caption">${t('偏好', 'Preferences')}</span>
        </summary>
        <div class="site-preferences-panel">
          <a class="site-preferences-control" data-language="${en ? 'zh' : 'en'}" href="@lang" lang="${en ? 'zh-CN' : 'en'}"><span aria-hidden="true">[Aa]</span>${t('English', '简体中文')}</a>
          <button type="button" class="site-preferences-control" data-theme-toggle aria-pressed="false" hidden><span aria-hidden="true">[*]</span>${t('深色模式', 'Dark mode')}</button>
          <button type="button" class="site-preferences-control" data-theme-system aria-pressed="false" hidden><span aria-hidden="true">[=]</span>${t('跟随系统', 'Use system theme')}</button>
        </div>
      </details>
    </div>`;
  const flued = file.startsWith('flued');
  const directoryLinks = routes => routes.map(([zh, english, url]) => `<a href="${url}">${t(zh, english)}</a>`).join('');
  const directory = flued ? '' : `<details class="site-directory"><summary>${t('站点索引','Site directory')}</summary><nav class="footer-directory" aria-label="${t('站点索引', 'Site directory')}">
      <div><strong>FLUED</strong>${directoryLinks(researchRoutes)}</div>
      <div><strong>${t('文档与招新', 'Documents and recruitment')}</strong>${directoryLinks(documentRoutes)}</div>
    </nav></details>`;
  const footer = `<footer class="sheet colophon">
      ${directory}<a href="/">ALETHIC INSIGHT</a><span>${t('中国矿业大学 · 真知灼见','China University of Mining and Technology')}</span>
      <a href="mailto:contact@alethicinsight.org">${t('联系实验室', 'Contact the lab')}</a>
      <a href="${flued ? '#top' : '#entry'}">${t('返回顶部','Back to top')} <span aria-hidden="true">^</span></a>
    </footer>`;
  const alias=oldTopic(file);
  const content=home ? renderStory(files,lang) : alias ? '' : page.render(lang);
  let body=home
    ? opening + navigation + '<main id="main" class="sheet story-pages" data-longform data-page="index.html" tabindex="-1">'+content+'</main>'+footer
    : alias ? '<main id="main"><a href="/#'+alias+'">'+title+'</a></main>' : navigation + '<main id="main" tabindex="-1" class="sheet paged" data-page="'+ file +'">'+topicHeading(page,file,lang)+'<div class="reading-body">'+content+'</div></main>'+footer;
  body=body.replace(/href="(\/[^" ]*)"/g,(_,url)=>'href="'+storyHref(url,home)+'"');
  if (en) body = localizeLinks(body);
  body = body.replace('href="@lang"', `href="${en ? '' : '/en'}${path}"`);
  return `<!doctype html>
<html lang="${en ? 'en' : 'zh-CN'}" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${home ? 'Alethic Insight · 真知灼见' : `${title} · Alethic Insight`}</title>
<meta name="description" content="${intro}">
<meta property="og:title" content="${title}"><meta property="og:description" content="${intro}"><meta property="og:url" content="${canon}"><meta property="og:type" content="website">
<link rel="canonical" href="${canon}"><link rel="alternate" hreflang="${en ? 'zh-CN' : 'en'}" href="https://alethicinsight.com${en ? '' : '/en'}${path}">
<link rel="icon" href="/mark.svg" type="image/svg+xml">
<script>try{const x=localStorage.getItem('alethic.theme')||localStorage.getItem('theme');document.documentElement.dataset.theme=x||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(!location.pathname.startsWith('/en/')&&(localStorage.getItem('alethic.lang')||localStorage.getItem('lang'))==='en'&&!location.search.includes('lang=zh'))location.replace('/en'+location.pathname+location.search+location.hash)}catch{}</script>
${alias ? `<script>const url=new URL('${en?'/en/':'/'}', location.origin);url.search=location.search;let id=location.hash.slice(1);if(id.startsWith('item-'))id='${alias}-'+id;url.hash=id || '${alias}';location.replace(url.href)</script>` : ''}
<link rel="stylesheet" href="/assets/${release}/drawing.css">
<script type="module" src="/assets/${release}/entry.mjs"></script>
</head>
<body><a class="skip" href="#main">${t('直接进入正文','Skip to content')}</a>${body}</body>
</html>`;
}

for (const lang of ['zh', 'en']) {
  const directory = lang === 'en' ? new URL('en/', dist) : dist;
  await mkdir(directory, { recursive: true });
  await Promise.all(Object.entries(files).map(([file, page]) => writeFile(new URL(file, directory), html(page, file, lang))));
}
console.log(`Built ${Object.keys(files).length} pages per language (${release})`);
