/* Entry-transition check: stage partially entered must not spill copy. */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../.shots/flued-stage/", import.meta.url));
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--window-size=1600,900", "--hide-scrollbars", "--no-proxy-server"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
await page.goto("http://127.0.0.1:4173/?cap=" + Date.now(), { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 2500));

await page.evaluate(() => {
  const stage = document.querySelector('[data-narrative-stage="projects"]');
  const y = stage.getBoundingClientRect().top + scrollY - 520;
  window.scrollTo({ top: y, behavior: "instant" });
});
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: `${out}entry.png` });
console.log("captured entry");
await browser.close();
