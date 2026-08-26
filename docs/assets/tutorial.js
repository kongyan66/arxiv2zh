/* global document, Element, HTMLButtonElement, HTMLElement, window */

(() => {
  const root = document.documentElement;
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector("#site-menu");

  if (
    !(toggle instanceof HTMLButtonElement) ||
    !(menu instanceof HTMLElement)
  ) {
    return;
  }

  const desktop = window.matchMedia("(min-width: 721px)");

  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    menu.toggleAttribute("data-open", open);
  };

  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  menu.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      setOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      toggle.getAttribute("aria-expanded") === "true"
    ) {
      setOpen(false);
      toggle.focus();
    }
  });

  desktop.addEventListener("change", (event) => {
    if (event.matches) {
      setOpen(false);
    }
  });

  setOpen(false);
  root.classList.add("nav-ready");
})();
