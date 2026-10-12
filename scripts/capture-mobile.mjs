/* Headless mobile-viewport capture: intro timeline, stages, static lists. */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../.shots/mobile/", import.meta.url));
mkdirSync(out, { recursive: true });

const base = process.argv[2] || "http://127.0.0.1:4173/";
/* Direct line to the prod host is unreliable from this machine; remote
 * captures go through the local proxy, local captures bypass it. */
const remote = base.startsWith("https");
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: [remote ? "--proxy-server=http://127.0.0.1:7897" : "--no-proxy-server", "--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => {
  await page.screenshot({ path: `${out}${name}.png` });
  console.log("captured", name);
};
const jumpTravel = (sel, p) => page.evaluate(([s, pp]) => {
  const el = document.querySelector(s);
  const docTop = scrollY + el.getBoundingClientRect().top;
  scrollTo({ top: Math.max(0, docTop + pp * (innerHeight + el.offsetHeight) - innerHeight), behavior: "instant" });
}, [sel, p]);
const jumpSticky = (sel, p) => page.evaluate(([s, pp]) => {
  const el = document.querySelector(s);
  const top = scrollY + el.getBoundingClientRect().top;
  scrollTo({ top: top + pp * Math.max(0, el.offsetHeight - innerHeight), behavior: "instant" });
}, [sel, p]);

/* Pass 1: real-time intro timeline. */
await page.goto(base + "?cap=" + Date.now(), { waitUntil: "load" });
const t0 = Date.now();
const at = async (s, name) => {
  const wait = t0 + s * 1000 - Date.now();
  if (wait > 0) await sleep(wait);
  await shot(name);
};
await at(4.6, "01-intro-ai");
await at(12.6, "02-intro-risen");
await at(17.6, "03-intro-slogan");
await at(20.5, "04-intro-resident");

/* Later passes skip the intro; reload between stages so the scroll-settle
 * magnet never drags a jump back to an earlier stage's first stop. */
await page.evaluateOnNewDocument(() => { window.__introPlayed = true; });

await page.goto(base + "?cap=" + Date.now(), { waitUntil: "load" });
await sleep(1500);
await jumpTravel('[data-narrative-stage="directions"]', 0.44);
await sleep(1400);
await shot("05-directions");
await jumpTravel('[data-narrative-stage="projects"]', 0.25);
await sleep(1400);
await shot("06-projects-bits");
await jumpTravel('[data-narrative-stage="projects"]', 0.5);
await sleep(1600);
await shot("07-projects-flued");
await jumpTravel('[data-narrative-stage="awards"]', 0.25);
await sleep(1400);
await shot("08-awards-noise");
await jumpTravel('[data-narrative-stage="awards"]', 0.5);
await sleep(1600);
await shot("09-awards-word");
await page.evaluate(() => document.querySelector("#awards").scrollIntoView());
await sleep(1200);
await shot("10-awards-list");

/* The finale keeps its pinned phase locks on mobile: step stop by stop. */
await page.goto(base + "?cap=" + Date.now(), { waitUntil: "load" });
await sleep(1500);
await jumpSticky('[data-narrative-stage="finale"]', 0.06);
await sleep(1600);
await jumpSticky('[data-narrative-stage="finale"]', 0.34);
await sleep(1700);
await shot("11-finale-mark");
await jumpSticky('[data-narrative-stage="finale"]', 0.6);
await sleep(1800);
await shot("12-finale-ai");
await jumpSticky('[data-narrative-stage="finale"]', 0.86);
await sleep(1800);
await shot("13-finale-brand");

await browser.close();
