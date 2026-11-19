import type { App, TFile } from "obsidian";
import type { ImportResult } from "../../src/import/import-notebook";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  pdfResult: null as ImportResult | null,
  saveAttachment: vi.fn(),
}));

vi.mock("obsidian", () => import("../fakes/obsidian"));
vi.mock("../../src/import/pdf", () => ({
  isPdf: () => true,
  readPdf: () => state.pdfResult,
}));
vi.mock("../../src/view/pdf-reading", () => ({
  readPdfPages: async () => ({ pages: [], madeBy: undefined }),
}));
vi.mock("../../src/view/image-import", () => ({
  saveImageAttachment: (...args: unknown[]) => state.saveAttachment(...args),
}));

const { emptyDocument } = await import("../../src/model/document");
const { ImportNotebookModal } = await import("../../src/view/import-notebook-modal");
const { Setting } = await import("../fakes/obsidian");

type Subject = {
  run(files: readonly { name: string; read: () => Promise<ArrayBuffer> }[]): Promise<void>;
  save(result: ImportResult): Promise<TFile>;
};

function result(attachments = 0): ImportResult {
  return {
    source: "pdf",
    title: "Lecture",
    doc: emptyDocument(),
    attachments: Array.from({ length: attachments }, (_, index) => ({
      name: `page-${index + 1}.png`,
      bytes: new Uint8Array([index]),
      mime: "image/png",
    })),
    warnings: [],
  };
}

function setup() {
  const trashFile = vi.fn(async () => undefined);
  const create = vi.fn(async () => ({ path: "Notes/Lecture.notebook.md" }) as TFile);
  const app = {
    vault: {
      getFolderByPath: () => ({ children: [] }),
      getRoot: () => ({ children: [] }),
      createFolder: vi.fn(async () => undefined),
      create,
    },
    fileManager: { trashFile },
  } as unknown as App;
  const modal = new ImportNotebookModal(app, {
    folder: "Notes",
    ownFolder: false,
    open: async () => undefined,
  });
  return { modal, subject: modal as unknown as Subject, trashFile, create };
}

beforeEach(() => {
  Setting.created.length = 0;
  state.pdfResult = null;
  state.saveAttachment.mockReset();
});

describe("notebook import saving", () => {
  it("trashes attachments when the notebook file cannot be created", async () => {
    const first = { path: "Notes/page-1.png" } as TFile;
    const second = { path: "Notes/page-2.png" } as TFile;
    state.saveAttachment.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const { subject, trashFile, create } = setup();
    create.mockRejectedValueOnce(new Error("Disk full"));

    await expect(subject.save(result(2))).rejects.toThrow("Disk full");

    expect(trashFile).toHaveBeenNthCalledWith(1, second);
    expect(trashFile).toHaveBeenNthCalledWith(2, first);
  });

  it("reports a PDF write failure as a save failure", async () => {
    state.pdfResult = result();
    const { modal, subject } = setup();
    vi.spyOn(subject, "save").mockRejectedValue(new Error("Read-only vault"));

    await subject.run([{ name: "Lecture.pdf", read: async () => new Uint8Array([1]).buffer }]);

    expect((modal.titleEl as unknown as { text: string }).text).toBe("Nothing was imported");
    expect(Setting.created[0]?.nameEl.text).toBe("Lecture");
    expect(Setting.created[0]?.descEl.text).toContain("could not be saved (Read-only vault)");
  });
});
