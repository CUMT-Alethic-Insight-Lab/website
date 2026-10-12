import { initGlobal, initPage, reapplyLang } from "./main.js";
import { initNarrative } from "./bg/narrative.js";
import { createTransition } from "./bg/transition.js";
import { initCursor } from "./bg/cursor.js";

const ROUTES = new Map([
  ["/", "index"],
  ["/index.html", "index"],
  ["/people.html", "people"],
  ["/insights-memory-hierarchy.html", "insights"],
]);

const transitionCanvas = document.createElement("canvas");
transitionCanvas.id = "bg-transition";
transitionCanvas.setAttribute("aria-hidden", "true");
document.body.append(transitionCanvas);

initGlobal();
let pageCleanup = initPage();
let narrativeCleanup = initNarrative();
initCursor();
const transition = createTransition(transitionCanvas);

const swapDocument = (doc, page) => {
  const newTitle = doc.querySelector("title");
  const curTitle = document.querySelector("title");
  if (newTitle && curTitle) {
    if (newTitle.hasAttribute("data-title-zh")) {
      curTitle.setAttribute("data-title-zh", newTitle.getAttribute("data-title-zh"));
      curTitle.setAttribute("data-title-en", newTitle.getAttribute("data-title-en"));
      const lang = document.documentElement.dataset.lang === "en" ? "en" : "zh";
      curTitle.textContent = newTitle.getAttribute(`data-title-${lang}`);
    } else {
      curTitle.removeAttribute("data-title-zh");
      curTitle.removeAttribute("data-title-en");
      curTitle.textContent = newTitle.textContent;
    }
  }

  const newDesc = doc.querySelector('meta[name="description"]');
  const curDesc = document.querySelector('meta[name="description"]');
  if (newDesc && curDesc) {
    curDesc.setAttribute("content", newDesc.getAttribute("content") || "");
  }

  document.body.className = doc.body.className;
  document.body.dataset.page = page;

  // Brand logo follows the swapped page's convention: home link off-index,
  // scroll-to-top anchor on index.
  const brand = document.querySelector("a.brand");
  if (brand) brand.setAttribute("href", page === "index" ? "#top" : "/");

  pageCleanup?.();

  const curRail = document.querySelector("nav.section-rail");
  const newRail = doc.querySelector("nav.section-rail");
  if (curRail && newRail) curRail.replaceWith(newRail);
  else if (curRail) curRail.remove();

  const curMain = document.querySelector("main");
  const newMain = doc.querySelector("main");
  narrativeCleanup?.();
  if (curMain && newMain) curMain.replaceWith(newMain);

  pageCleanup = initPage();
  reapplyLang();
  narrativeCleanup = initNarrative();
};

let busy = false;
let pendingNav = null;

const navigate = async (url, { push = true, scrollY = 0 } = {}) => {
  const page = ROUTES.get(url.pathname);
  if (!page) return;
  if (busy) {
    // Queue the latest target instead of dropping the click; it runs
    // as soon as the in-flight transition settles.
    pendingNav = { url, opts: { push, scrollY } };
    return;
  }
  busy = true;
  if (push) history.replaceState({ scrollY: window.scrollY }, "");

  const fetched = fetch(url.pathname).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  });

  await transition.run(async () => {
    try {
      const html = await fetched;
      const doc = new DOMParser().parseFromString(html, "text/html");
      swapDocument(doc, page);
      if (push) history.pushState({ scrollY: 0 }, "", url.pathname + url.search + url.hash);
      if (push && url.hash) {
        const el = document.getElementById(url.hash.slice(1));
        if (el) el.scrollIntoView({ behavior: "instant" });
        else window.scrollTo({ top: scrollY, behavior: "instant" });
      } else {
        window.scrollTo({ top: scrollY, behavior: "instant" });
      }
    } catch {
      // Hard fallback: a normal full load still gets the user there.
      window.location.href = url.pathname + url.hash;
    }
  });
  busy = false;
  if (pendingNav) {
    const next = pendingNav;
    pendingNav = null;
    navigate(next.url, next.opts);
  }
};

document.addEventListener("click", (e) => {
  if (e.defaultPrevented || e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest?.("a[href]");
  if (!a || a.target || a.hasAttribute("download")) return;

  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;

  // Brand logo: on subpages it means "home" (their original headers link
  // to "/"); on the index page it is the #top anchor and scrolls.
  if (a.classList.contains("brand") && ROUTES.get(location.pathname) !== "index") {
    e.preventDefault();
    navigate(new URL("/", location.origin));
    return;
  }

  if (!ROUTES.has(url.pathname)) return; // FLUED / recruitment / dl → full load
  if (url.pathname === location.pathname) {
    if (!url.hash) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return; // same-page anchors keep default smooth-scroll
  }

  e.preventDefault();
  navigate(url);
});

window.addEventListener("popstate", (e) => {
  const url = new URL(window.location.href);
  const page = ROUTES.get(url.pathname);
  if (!page) return;
  if (page === document.body.dataset.page) {
    if (typeof e.state?.scrollY === "number") {
      window.scrollTo({ top: e.state.scrollY, behavior: "instant" });
    }
    return;
  }
  navigate(url, { push: false, scrollY: e.state?.scrollY ?? 0 });
});
