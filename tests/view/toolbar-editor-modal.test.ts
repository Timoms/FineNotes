import { describe, expect, it, vi } from "vitest";
import { FakeEl } from "../fakes/obsidian";
import type { ToolbarItemChoice } from "../../src/model/toolbar-items";

vi.mock("obsidian", () => import("../fakes/obsidian"));
const { ToolbarEditorModal } = await import("../../src/view/toolbar-editor-modal");

class PreviewEl extends FakeEl {
  dataset: Record<string, string> = {};

  override createEl(tag: string, info?: string | { cls?: string; text?: string }): PreviewEl {
    const child = new PreviewEl(tag, info);
    this.append(child);
    return child;
  }
}

describe("toolbar editor preview", () => {
  it("divides unused slots between flexible spaces without adding empty slots", () => {
    const items: ToolbarItemChoice[] = [
      ...Array.from({ length: 9 }, (_, i) => ({
        id: "fixed-space" as const,
        key: String(i),
        visible: true,
        group: "strip" as const,
      })),
      { id: "flexible-space", key: "a", visible: true, group: "strip" },
      { id: "group", key: "group", visible: true, group: "strip" },
      { id: "flexible-space", key: "b", visible: true, group: "strip", container: "group" },
    ];
    const editor = Object.assign(Object.create(ToolbarEditorModal.prototype), { items }) as {
      area(host: HTMLElement, destination: string, label: string): void;
    };
    const host = new PreviewEl();
    editor.area(host as unknown as HTMLElement, "strip", "Menu strip");

    const list = host.find("finenotes-x-strip-preview")!;
    const flexible = list.findAll("is-flexible-space");
    expect(flexible).toHaveLength(2);
    expect(flexible.map((tile) => tile.style["--preview-slots"])).toEqual(["7.5", "7.5"]);
    expect(list.find("finenotes-x-strip-preview-pill")?.style["--preview-slots"]).toBe("7.5");
    expect(list.findAll("finenotes-x-strip-empty-slot")).toHaveLength(0);
    expect(host.find("finenotes-x-strip-slot-count")?.text).toBe("10 / 25 slots");
  });
});
