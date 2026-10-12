/* Entry-spill regression check across all sticky-copy stages. */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../.shots/entry-check/", import.meta.url));
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

for (const kind of ["directions", "projects", "awards"]) {
  await page.evaluate((k) => {
    const stage = document.querySelector(`[data-narrative-stage="${k}"]`);
    window.scrollTo({ top: stage.getBoundingClientRect().top + scrollY - 520, behavior: "instant" });
  }, kind);
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: `${out}${kind}-entry.png` });
  console.log("captured", kind);
}
await browser.close();
