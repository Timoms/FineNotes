import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", async () => {
  const fakes = await import("../fakes/obsidian");
  interface Toggle {
    setValue(value: boolean): Toggle;
    onChange(handler: (value: boolean) => unknown): Toggle;
  }
  return {
    ...fakes,
    Setting: class extends fakes.Setting {
      addToggle(build: (toggle: Toggle) => unknown): this {
        const toggle: Toggle = {
          setValue: () => toggle,
          onChange: () => toggle,
        };
        build(toggle);
        return this;
      }
    },
  };
});
vi.mock("../../src/view/dialog-keyboard", () => ({
  DialogKeyboard: class {
    watch(): void {}
    end(): void {}
  },
}));

const { NoteSettingsModal } = await import("../../src/view/note-settings-modal");
const { notices } = await import("../fakes/obsidian");

beforeEach(() => {
  notices.length = 0;
});

describe("notebook settings rename", () => {
  it("restores the stored name and reports a rejected rename", async () => {
    const rename = vi.fn(async () => {
      throw new Error("A file with that name already exists");
    });
    const app = {
      vault: {
        on: () => ({ id: "rename" }),
        offref: vi.fn(),
      },
    };
    const modal = new NoteSettingsModal(app as never, {
      single: false,
      scrollDirection: () => "vertical",
      setScrollDirection: vi.fn(),
      readOnly: () => false,
      setReadOnly: vi.fn(),
      info: () => ({
        name: "Lecture",
        pages: 3,
        bytes: 100,
        created: 0,
        modified: 0,
        folder: "Notes",
      }),
      rename,
      openPluginSettings: vi.fn(),
    });
    modal.open();
    const field = modal.contentEl.find("finenotes-x-ns-name-input") as unknown as
      { value: string; dispatch(type: string): unknown } | undefined;
    if (!field) throw new Error("Rename field was not rendered");

    field.value = "Taken";
    field.dispatch("change");
    await Promise.resolve();
    await Promise.resolve();

    expect(rename).toHaveBeenCalledWith("Taken");
    expect(field.value).toBe("Lecture");
    expect(notices[0]).toContain("could not rename the notebook");
    expect(notices[0]).toContain("already exists");
  });
});
