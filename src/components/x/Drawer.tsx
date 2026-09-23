"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * A sheet from the right, or from the bottom on a phone.
 *
 * It behaves like a dialog because it is one: focus moves into it and cannot
 * wander out, Escape closes it, the page behind is inert and does not scroll,
 * and focus returns to whatever opened it. Without those a keyboard or screen
 * reader user can tab straight past a payment step into the page underneath.
 */
export default function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    const host = panel.current?.closest("[data-drawer-host]") as HTMLElement | null;
    const others = [...document.body.children].filter((el) => el !== host) as HTMLElement[];
    const wasInert = others.map((el) => el.inert);
    others.forEach((el) => (el.inert = true));
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const focusables = () =>
      [...(panel.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex]:not([tabindex="-1"])') ?? [])].filter(
        (el) => el.offsetParent !== null,
      );
    // The dialog itself takes focus, so a screen reader announces its title and
    // nothing lights up on open; the next Tab reaches the first control.
    panel.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      others.forEach((el, i) => (el.inert = wasInert[i]));
      document.documentElement.style.overflow = overflow;
      opener.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="x-drawer" data-drawer-host="">
      <div className="x-drawer__scrim" onClick={onClose} aria-hidden="true" />
      <div className="x-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="x-drawer-title" ref={panel} tabIndex={-1}>
        <header className="x-drawer__head">
          <h2 id="x-drawer-title" className="x-drawer__title">
            {title}
          </h2>
          <button type="button" className="x-drawer__close" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="x-drawer__body">{children}</div>
        {footer ? <footer className="x-drawer__foot">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
