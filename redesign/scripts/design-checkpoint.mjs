import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { launch, open, viewport, sleep } from './browser-qa.mjs';

const [version, route] = process.argv.slice(2);
if (!/^V[1-4]$/.test(version || '') || !route?.startsWith('/')) throw new Error('Usage: node scripts/design-checkpoint.mjs V1 /#work');
const target = resolve('../设计交付/四版迭代', version);
await mkdir(target, { recursive: true });
const html = await readFile('dist/index.html', 'utf8');
const release = html.match(/assets\/([0-9a-f]+)\/drawing\.css/)[1];
const browser = await launch();
try {
  const page = await browser.newPage();
  for (const width of [1440, 390]) {
    await viewport(page, width);
    await open(page, route);
    await page.waitForFunction(expected => document.querySelector('link[rel="stylesheet"]').href.includes(expected), {}, release);
    await sleep(450);
    await page.screenshot({ path: resolve(target, `${width}.png`) });
  }
} finally { await browser.close(); }
const archive = resolve(target, '工程.zip');
execFileSync('tar.exe', ['-acf',archive,'src','public','functions','tests','scripts','build.mjs','preview.mjs','package.json']);
const output = { version, release, route, sha256: createHash('sha256').update(await readFile(archive)).digest('hex') };
await writeFile(resolve(target,'版本.json'), JSON.stringify(output,null,2));
console.log(output);
