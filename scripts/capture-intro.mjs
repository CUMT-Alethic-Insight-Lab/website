/* Headless capture of the intro timeline + key stages for visual review. */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../.shots/intro/", import.meta.url));
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--window-size=1600,900", "--hide-scrollbars", "--no-proxy-server"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
const base = process.argv[3] || "http://127.0.0.1:4173/";
await page.goto(base + (base.includes("?") ? "&" : "?") + "cap=" + Date.now(), { waitUntil: "load" });

const marks = process.argv[2] ? process.argv[2].split(",").map(Number) : [1, 4, 7.5, 11.5, 14, 17, 20];
const t0 = Date.now();
for (const m of marks) {
  const wait = t0 + m * 1000 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  await page.screenshot({ path: `${out}t${String(m).replace(".", "_")}.png` });
  console.log("captured", m);
}
await browser.close();
