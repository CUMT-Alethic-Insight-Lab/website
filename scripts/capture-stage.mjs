/* Wheel-step verification for the FLUED narrative stage. */
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

// Land on the projects stage and let the settle magnet park at stop 0.
await page.evaluate(() => {
  document.querySelector('[data-narrative-stage="projects"]').scrollIntoView({ behavior: "instant", block: "start" });
});
await new Promise((r) => setTimeout(r, 2600));
await page.screenshot({ path: `${out}1-bits.png` });

const wheel = async (dy) => {
  await page.mouse.move(800, 450);
  await page.mouse.wheel({ deltaY: dy });
};
const shots = [
  ["2-flued", 700, 2400],
  ["3-exit", 700, 2400],
  ["4-after", 700, 2400],
];
for (const [name, dy, wait] of shots) {
  await wheel(dy);
  await new Promise((r) => setTimeout(r, wait));
  await page.screenshot({ path: `${out}${name}.png` });
  console.log("captured", name);
}
await browser.close();
