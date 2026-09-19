const header = document.querySelector("[data-site-header]");
const root = document.documentElement;
const themeToggle = document.querySelector("[data-theme-toggle]");
const themeToggleLabel = document.querySelector("[data-theme-toggle-label]");
const themeColor = document.querySelector('meta[name="theme-color"]');
const railLinks = document.querySelectorAll("[data-rail-link]");

// Mega menu：同页锚点点击后强制收起面板（悬停离场时解标恢复悬停行为）
const menuClose = () => {
  if (header) header.setAttribute("data-menu-closed", "");
  window.setTimeout(() => {
    if (header) header.removeAttribute("data-menu-closed");
  }, 600);
};
document.querySelectorAll(".mega-links a").forEach((link) => {
  link.addEventListener("click", menuClose);
});

const themeMeta = {
  dark: "#0b0e12",
  light: "#f3f5f6",
};

const readStoredTheme = () => {
  try {
    return localStorage.getItem("theme");
  } catch {
    return null;
  }
};

const storeTheme = (theme) => {
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Theme switching should keep working even when storage is unavailable.
  }
};

const applyTheme = (theme) => {
  const nextTheme = theme === "dark" ? "dark" : "light";

  root.dataset.theme = nextTheme;
  storeTheme(nextTheme);

  if (themeColor) {
    themeColor.setAttribute("content", themeMeta[nextTheme]);
  }

  if (themeToggle) {
    const isLight = nextTheme === "light";
    themeToggle.setAttribute("aria-pressed", String(isLight));
    themeToggle.setAttribute(
      "aria-label",
      isLight ? "切换到深色主题" : "切换到亮色主题"
    );
  }

  if (themeToggleLabel) {
    themeToggleLabel.textContent = nextTheme === "light" ? "Light" : "Dark";
  }
};

applyTheme(readStoredTheme() || "dark");

themeToggle?.addEventListener("click", () => {
  applyTheme(root.dataset.theme === "light" ? "dark" : "light");
});

/* ── language ── */
const langToggle = document.querySelector("[data-lang-toggle]");
const langToggleLabel = document.querySelector("[data-lang-toggle-label]");

const readStoredLang = () => {
  try {
    return localStorage.getItem("lang");
  } catch {
    return null;
  }
};

const storeLang = (lang) => {
  try {
    localStorage.setItem("lang", lang);
  } catch {
    // Language switching should keep working even when storage is unavailable.
  }
};

const defaultLang = () =>
  (navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";

const applyLang = (lang, { persist = true } = {}) => {
  const next = lang === "en" ? "en" : "zh";

  root.dataset.lang = next;
  root.lang = next === "zh" ? "zh-CN" : "en";
  if (persist) storeLang(next);

  if (langToggle) {
    langToggle.setAttribute(
      "aria-label",
      next === "zh" ? "Switch to English" : "切换到中文"
    );
  }

  if (langToggleLabel) {
    langToggleLabel.textContent = next === "zh" ? "EN" : "中";
  }

  document.querySelectorAll("[data-aria-zh]").forEach((el) => {
    const value = el.getAttribute(next === "zh" ? "data-aria-zh" : "data-aria-en");
    if (value) el.setAttribute("aria-label", value);
  });

  document.querySelectorAll("[data-placeholder-zh]").forEach((el) => {
    const value = el.getAttribute(
      next === "zh" ? "data-placeholder-zh" : "data-placeholder-en"
    );
    if (value) el.setAttribute("placeholder", value);
  });

  document.querySelectorAll("[data-label-zh]").forEach((el) => {
    const value = el.getAttribute(next === "zh" ? "data-label-zh" : "data-label-en");
    if (value) el.textContent = value;
  });

  const titleEl = document.querySelector("title[data-title-en]");
  if (titleEl) {
    const value =
      next === "zh" ? titleEl.getAttribute("data-title-zh") : titleEl.getAttribute("data-title-en");
    if (value) titleEl.textContent = value;
  }

  window.dispatchEvent(new CustomEvent("langchange", { detail: { lang: next } }));
};

applyLang(readStoredLang() || defaultLang(), { persist: false });

langToggle?.addEventListener("click", () => {
  applyLang(root.dataset.lang === "en" ? "zh" : "en");
});

const updateHeader = () => {
  if (!header) return;
  header.toggleAttribute("data-scrolled", window.scrollY > 16);
};

updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

const sections = document.querySelectorAll(".section-observe");
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  // Trigger by the section's top edge entering the lower 90% of the viewport.
  // A fractional threshold (e.g. 0.16) can never be reached by sections taller
  // than viewport/threshold on phones, which left whole chapters invisible.
  { threshold: 0, rootMargin: "0px 0px -10% 0px" }
);

sections.forEach((section) => observer.observe(section));

const railTargets = [...railLinks]
  .map((link) => {
    const id = link.getAttribute("data-rail-link");
    return id ? document.getElementById(id) : null;
  })
  .filter(Boolean);

const setActiveRail = (id) => {
  railLinks.forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("data-rail-link") === id);
  });
};

const updateActiveRail = () => {
  if (!railTargets.length) return;

  const anchor = window.scrollY + window.innerHeight * 0.38;
  let active = railTargets[0];

  railTargets.forEach((target) => {
    if (target.offsetTop <= anchor) {
      active = target;
    }
  });

  setActiveRail(active.id);
};

updateActiveRail();
window.addEventListener("scroll", updateActiveRail, { passive: true });
window.addEventListener("resize", updateActiveRail);
