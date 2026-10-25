/**
 * When a character may move. Its CSS animation runs only while it is on screen,
 * and none run until the page has painted and gone idle: thirty-odd agents
 * starting their loops in the first frame doubled the time to first paint on a
 * mid-range phone. Off screen they stop, which also spares the battery.
 * Until then each one shows its still pose, the same one reduced motion shows.
 */
let io: IntersectionObserver | null = null;
let booting = false;
const waiting = new Set<Element>();

function boot() {
  if (booting) return;
  booting = true;
  const start = () => {
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.target.toggleAttribute("data-on", e.isIntersecting);
      },
      { rootMargin: "160px 0px" },
    );
    waiting.forEach((el) => io!.observe(el));
    waiting.clear();
  };
  const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 400));
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
}

export function watchMotion(el: Element): () => void {
  if (typeof IntersectionObserver === "undefined") {
    el.setAttribute("data-on", "");
    return () => undefined;
  }
  if (io) io.observe(el);
  else {
    waiting.add(el);
    boot();
  }
  return () => {
    waiting.delete(el);
    io?.unobserve(el);
  };
}
