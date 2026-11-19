import { setIcon } from "obsidian";
import type { ActiveTool, ToolbarState } from "./toolbar";

export function hoverIcon(state: Pick<ToolbarState, "tool" | "eraserMode">): string {
  if (state.tool === "eraser")
    return state.eraserMode === "stroke"
      ? "delete"
      : state.eraserMode === "ruled"
        ? "list-minus"
        : "eraser";
  const icons: Record<ActiveTool, string> = {
    pen: "pen-tool",
    highlighter: "highlighter",
    select: "crosshair",
    shape: "shapes",
    text: "type",
    laser: "pointer",
    eraser: "eraser",
  };
  return icons[state.tool];
}

export function isPencilHover(
  event: Pick<PointerEvent, "pointerType" | "buttons" | "pressure">,
): boolean {
  return event.pointerType === "pen" && event.buttons === 0 && event.pressure === 0;
}

/** Non-contact feedback only. Never prevents input or changes a drawing value. */
export function installPencilHover(host: HTMLElement, state: () => ToolbarState): () => void {
  const tip = host.createDiv({
    cls: "finenotes-x-pencil-hover is-hidden",
    attr: { "aria-hidden": "true" },
  });
  tip.createSpan({ cls: "finenotes-x-pencil-hover-dot" });
  const glyph = tip.createSpan({ cls: "finenotes-x-pencil-hover-icon" });
  const preview = host.createDiv({
    cls: "finenotes-x-hover-color is-hidden",
    attr: { "aria-hidden": "true" },
  });
  let lit: HTMLElement | null = null;
  let icon = "";
  let contactAt = -Infinity;
  let hoverSince = -Infinity;
  let lastHover = -Infinity;
  const clear = (): void => {
    tip.addClass("is-hidden");
    preview.addClass("is-hidden");
    lit?.removeClass("is-pencil-hovered");
    lit = null;
  };
  const move = (event: PointerEvent): void => {
    if (!isPencilHover(event)) {
      if (event.pointerType === "pen" && (event.buttons !== 0 || event.pressure > 0))
        contactAt = Date.now();
      hoverSince = -Infinity;
      clear();
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target?.closest) {
      clear();
      return;
    }
    const control = target.closest<HTMLElement>(
      "button, select, input, [role=tab], [role=menuitem], [role=switch]",
    );
    if (lit !== control) {
      lit?.removeClass("is-pencil-hovered");
      lit = control;
    }
    if (control && !control.matches(":disabled")) {
      const box = control.getBoundingClientRect();
      const x = event.clientX - box.left,
        y = event.clientY - box.top;
      const strength =
        1 -
        Math.min(
          1,
          Math.hypot(
            (x / Math.max(1, box.width) - 0.5) * 2,
            (y / Math.max(1, box.height) - 0.5) * 2,
          ),
        );
      control.addClass("is-pencil-hovered");
      control.style.setProperty("--hover-x", `${x}px`);
      control.style.setProperty("--hover-y", `${y}px`);
      control.style.setProperty("--hover-glow", `${5 + strength * 9}px`);
    }
    const box = host.getBoundingClientRect();
    const x = event.clientX - box.left,
      y = event.clientY - box.top;
    if (target.matches(".finenotes-x-touch-color-strip")) {
      const bounds = target.getBoundingClientRect();
      const hue = Math.round(
        Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width))) * 359,
      );
      preview.setCssStyles({
        left: `${Math.min(box.width - 42, Math.max(4, x - 18))}px`,
        top: `${Math.max(4, y - 48)}px`,
        backgroundColor: `hsl(${hue} 100% 50%)`,
      });
      preview.removeClass("is-hidden");
    } else preview.addClass("is-hidden");
    if (!control && target.closest(".finenotes-x-surface")) {
      const current = state(),
        nextIcon = hoverIcon(current);
      if (nextIcon !== icon) {
        setIcon(glyph, nextIcon);
        icon = nextIcon;
      }
      tip.setCssStyles({
        left: `${x}px`,
        top: `${y}px`,
        color:
          current.tool === "pen" || current.tool === "highlighter"
            ? current.color
            : "var(--text-normal)",
      });
      const now = Date.now();
      if (now - lastHover > 250 || hoverSince === -Infinity) hoverSince = now;
      lastHover = now;
      if (contactAt === -Infinity || (now - contactAt >= 2000 && now - hoverSince >= 2000))
        tip.removeClass("is-hidden");
      else tip.addClass("is-hidden");
    } else tip.addClass("is-hidden");
  };
  // Range entry can arrive without movement; range exit may only emit pointerout.
  const out = (event: PointerEvent): void => {
    if (event.pointerType !== "pen") return;
    const next = event.relatedTarget as Node | null;
    if (!next || !host.contains(next)) {
      hoverSince = lastHover = -Infinity;
      clear();
      return;
    }
    if (lit && !lit.contains(next)) {
      lit.removeClass("is-pencil-hovered");
      lit = null;
    }
    preview.addClass("is-hidden");
    tip.addClass("is-hidden");
  };
  host.addEventListener("pointerover", move, { passive: true, capture: true });
  host.addEventListener("pointerout", out, { passive: true, capture: true });
  host.addEventListener("pointermove", move, { passive: true, capture: true });
  const contact = (event: PointerEvent): void => {
    if (event.pointerType === "pen") {
      contactAt = Date.now();
      hoverSince = -Infinity;
    }
    clear();
  };
  host.addEventListener("pointerdown", contact, true);
  host.addEventListener("pointerleave", clear);
  host.addEventListener("pointercancel", clear);
  return () => {
    clear();
    tip.remove();
    preview.remove();
    host.removeEventListener("pointerover", move, true);
    host.removeEventListener("pointerout", out, true);
    host.removeEventListener("pointermove", move, true);
    host.removeEventListener("pointerdown", contact, true);
    host.removeEventListener("pointerleave", clear);
    host.removeEventListener("pointercancel", clear);
  };
}
