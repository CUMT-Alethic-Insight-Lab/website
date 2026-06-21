const header = document.querySelector("[data-site-header]");

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
  { threshold: 0.16 }
);

sections.forEach((section) => observer.observe(section));
