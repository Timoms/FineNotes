import { beforeEach, describe, expect, it, vi } from "vitest";
import { TFile, WorkspaceLeaf } from "./fake-obsidian";

interface ExportHost {
  export: (
    pages: readonly number[],
    onProgress: (done: number, total: number) => void,
    cancelled: () => boolean,
  ) => Promise<{ path: string; name: string; bytes: ArrayBuffer }>;
}

const state = vi.hoisted(() => ({
  hosts: [] as ExportHost[],
  failAfterFirstChunk: false,
}));

vi.mock("obsidian", () => import("./fake-obsidian"));
vi.mock("../../src/view/export-modal", () => ({
  ExportPdfModal: class {
    constructor(_app: unknown, host: ExportHost) {
      state.hosts.push(host);
    }
    open(): void {}
  },
}));
vi.mock("../../src/view/pdf-export", () => ({
  exportPagesToPdf: vi.fn(),
  paintPagePreview: vi.fn(),
  writePagesToPdf: async (
    _pages: unknown,
    _sources: unknown,
    _options: unknown,
    write: (chunk: Uint8Array) => Promise<void>,
  ) => {
    await write(new Uint8Array([1]));
    if (state.failAfterFirstChunk) throw new Error("Encoding failed");
    await write(new Uint8Array([2]));
    await write(new Uint8Array([3]));
  },
}));

const { InkView } = await import("../../src/view/ink-view");
const { DEFAULT_SETTINGS } = await import("../../src/settings");

function setup() {
  const stored = new Map<string, number[]>();
  const files = new Map<string, TFile>();
  const createBinary = vi.fn(async (path: string, buffer: ArrayBuffer) => {
    const file = new TFile(path, buffer.byteLength);
    files.set(path, file);
    stored.set(path, Array.from(new Uint8Array(buffer)));
    return file;
  });
  const appendBinary = vi.fn(async (file: TFile, buffer: ArrayBuffer) => {
    stored.set(file.path, [...(stored.get(file.path) ?? []), ...new Uint8Array(buffer)]);
  });
  const rename = vi.fn(async (file: TFile, path: string) => {
    const bytes = stored.get(file.path) ?? [];
    files.delete(file.path);
    stored.delete(file.path);
    (file as unknown as { path: string }).path = path;
    files.set(path, file);
    stored.set(path, bytes);
  });
  const readBinary = vi.fn(
    async (file: TFile) => new Uint8Array(stored.get(file.path) ?? []).buffer,
  );
  const trashFile = vi.fn(async (file: TFile) => {
    files.delete(file.path);
    stored.delete(file.path);
  });
  const app = {
    vault: {
      getFolderByPath: () => null,
      getFileByPath: (path: string) => files.get(path) ?? null,
      createFolder: vi.fn(async () => undefined),
      createBinary,
      appendBinary,
      rename,
      readBinary,
    },
    fileManager: { trashFile },
  };
  const plugin = {
    settings: { ...DEFAULT_SETTINGS },
  };
  const view = new InkView(new WorkspaceLeaf(app) as never, plugin as never);
  const note = new TFile("Lecture.notebook.md");
  note.parent = { path: "", children: [note] };
  (view as unknown as { file: TFile }).file = note;
  view.exportPdf();
  const host = state.hosts.at(-1);
  if (!host) throw new Error("Export dialog did not open");
  return { host, createBinary, appendBinary, rename, readBinary, trashFile, stored };
}

beforeEach(() => {
  state.hosts.length = 0;
  state.failAfterFirstChunk = false;
});

describe("ordinary-page PDF export", () => {
  it("appends rendered chunks and reads the completed file once for sharing", async () => {
    const { host, createBinary, appendBinary, rename, readBinary, stored } = setup();

    const saved = await host.export([0], vi.fn(), () => false);

    expect(createBinary).toHaveBeenCalledTimes(1);
    expect(appendBinary).toHaveBeenCalledTimes(2);
    expect(rename).toHaveBeenCalledTimes(1);
    expect(readBinary).toHaveBeenCalledTimes(1);
    expect(stored.get(saved.path)).toEqual([1, 2, 3]);
    expect(Array.from(new Uint8Array(saved.bytes))).toEqual([1, 2, 3]);
  });

  it("trashes a partial streamed file when rendering fails", async () => {
    state.failAfterFirstChunk = true;
    const { host, trashFile, stored } = setup();

    await expect(host.export([0], vi.fn(), () => false)).rejects.toThrow("Encoding failed");

    expect(trashFile).toHaveBeenCalledTimes(1);
    expect(stored.size).toBe(0);
  });
});
