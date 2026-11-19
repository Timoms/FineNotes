import { Notice } from "obsidian";
import html2canvas from "html2canvas-pro";

interface NativeImage {
  toDataURL(): string;
}

interface CurrentWindow {
  webContents: { capturePage(): Promise<NativeImage> };
}

export interface ClipBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Screenshot {
  image: CanvasImageSource;
  width: number;
  height: number;
  release(): void;
}

/** The positive rectangle between two pointer positions, or no usable clip. */
export function clipBounds(
  start: { x: number; y: number },
  end: { x: number; y: number },
): ClipBounds | null {
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return width >= 2 && height >= 2
    ? { left: Math.min(start.x, end.x), top: Math.min(start.y, end.y), width, height }
    : null;
}

/** Select part of the current Obsidian window and copy it as a PNG. */
export async function startAppSmartClip(): Promise<void> {
  let screenshot: Screenshot;
  try {
    screenshot = await captureScreenshot();
  } catch {
    new Notice("FineNotes: Obsidian could not capture this window.");
    return;
  }

  const overlay = document.body.createDiv({ cls: "finenotes-x-app-clip" });
  overlay.tabIndex = -1;
  overlay.setAttribute("aria-label", "Drag a rectangle to copy a screenshot; press Escape to cancel");
  const selection = overlay.createDiv({ cls: "finenotes-x-app-clip-selection" });
  overlay.focus();
  new Notice("FineNotes: drag a rectangle anywhere in Obsidian to copy it.");

  let start: { x: number; y: number } | null = null;
  const point = (event: PointerEvent) => ({
    x: Math.max(0, Math.min(window.innerWidth, event.clientX)),
    y: Math.max(0, Math.min(window.innerHeight, event.clientY)),
  });
  const show = (bounds: ClipBounds): void => {
    selection.style.left = `${bounds.left}px`;
    selection.style.top = `${bounds.top}px`;
    selection.style.width = `${bounds.width}px`;
    selection.style.height = `${bounds.height}px`;
  };
  const close = (): void => {
    overlay.remove();
    screenshot.release();
  };

  overlay.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    start = point(event);
    selection.addClass("is-drawing");
    show({ left: start.x, top: start.y, width: 0, height: 0 });
    overlay.setPointerCapture(event.pointerId);
  });
  overlay.addEventListener("pointermove", (event) => {
    const bounds = start ? clipBounds(start, point(event)) : null;
    if (bounds) show(bounds);
  });
  overlay.addEventListener("pointerup", (event) => {
    if (!start) return;
    const bounds = clipBounds(start, point(event));
    start = null;
    if (!bounds) return;
    overlay.remove();
    void copyClip(screenshot, bounds).finally(() => screenshot.release());
  });
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
}

async function captureScreenshot(): Promise<Screenshot> {
  const currentWindow = electronWindow();
  if (currentWindow) {
    const native = await currentWindow.webContents.capturePage();
    const image = await loadImage(native.toDataURL());
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => (image.src = ""),
    };
  }

  const canvas = await html2canvas(document.body, {
    backgroundColor: null,
    height: window.innerHeight,
    logging: false,
    scale: window.devicePixelRatio,
    scrollX: -window.scrollX,
    scrollY: -window.scrollY,
    useCORS: true,
    width: window.innerWidth,
    windowHeight: window.innerHeight,
    windowWidth: window.innerWidth,
  });
  return {
    image: canvas,
    width: canvas.width,
    height: canvas.height,
    release: () => {
      canvas.width = 1;
      canvas.height = 1;
    },
  };
}

function electronWindow(): CurrentWindow | null {
  try {
    const runtimeRequire = (window as Window & { require?: (id: string) => unknown }).require;
    if (!runtimeRequire) return null;
    const electron = runtimeRequire("electron") as {
      remote?: { getCurrentWindow(): CurrentWindow };
    };
    const remote =
      electron.remote ??
      (runtimeRequire("@electron/remote") as { getCurrentWindow(): CurrentWindow });
    return remote.getCurrentWindow();
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The window screenshot could not be decoded"));
    image.src = src;
  });
}

async function copyClip(screenshot: Screenshot, bounds: ClipBounds): Promise<void> {
  const clipboard = navigator.clipboard;
  if (!clipboard?.write || typeof ClipboardItem === "undefined") {
    new Notice("FineNotes: this device cannot copy image clips.");
    return;
  }
  const scaleX = screenshot.width / window.innerWidth;
  const scaleY = screenshot.height / window.innerHeight;
  const canvas = createEl("canvas");
  canvas.width = Math.max(1, Math.round(bounds.width * scaleX));
  canvas.height = Math.max(1, Math.round(bounds.height * scaleY));
  canvas.getContext("2d")?.drawImage(
    screenshot.image,
    Math.round(bounds.left * scaleX),
    Math.round(bounds.top * scaleY),
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const png = new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))),
      "image/png",
    ),
  );
  try {
    await clipboard.write([new ClipboardItem({ "image/png": png })]);
    new Notice("Smart Clip copied.");
  } catch {
    new Notice("FineNotes: the clipboard refused the clip.");
  }
}
