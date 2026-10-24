import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { seed } from "../domain";
import { setSessionCompleted } from "../academic";
const hooks = vi.hoisted(() => ({ values: [] as unknown[], index: 0 }));
vi.mock("react", () => ({
  useRef: (value: unknown) => ({ current: value }),
  useState: () => [hooks.values[hooks.index++], vi.fn()],
}));
import { useAcademicEditor } from "../useAcademicEditor";
beforeEach(() => {
  hooks.index = 0;
});
afterEach(() => vi.unstubAllGlobals());
it("the actual edit submission strips study-only status when a reopened session becomes personal", async () => {
  const state = setSessionCompleted(
    setSessionCompleted(seed(), "b6", true),
    "b6",
    false,
  );
  const block = state.blocks.find((b) => b.id === "b6")!;
  hooks.values = ["block", block, null, ""];
  const fields = new Map([
    ["assignment", ""],
    ["title", "Personal study"],
    ["start", block.start],
    ["end", block.end],
  ]);
  vi.stubGlobal(
    "FormData",
    class {
      get(key: string) {
        return fields.get(key);
      }
    },
  );
  const save = vi.fn(async () => true),
    editor = useAcademicEditor(state, save);
  await editor.submit({ preventDefault: vi.fn(), currentTarget: {} } as never);
  expect(save).toHaveBeenCalledOnce();
  const saved = save.mock.calls[0] as unknown as [typeof state];
  const converted = saved[0].blocks.find((b) => b.id === "b6")!;
  expect(converted.assignmentId).toBeUndefined();
  expect(converted.sessionCompleted).toBeUndefined();
  expect(converted.title).toBe("Personal study");
});
