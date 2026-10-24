import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import CrystalWorkspace from "./CrystalWorkspace";

afterEach(() => vi.unstubAllGlobals());

describe("isolated Lumen demonstration", () => {
  it("keeps the world workbench renderable even without graphics, storage or Workers", () => {
    vi.stubGlobal("location", { hash: "#world" });
    const forbidden = vi.fn(() => {
      throw new Error("Real academic data is forbidden");
    });
    vi.stubGlobal("localStorage", { getItem: forbidden, setItem: forbidden });
    vi.stubGlobal("Worker", forbidden);
    const html = renderToStaticMarkup(<CrystalWorkspace />);
    expect(html).toContain("au-world");
    expect(html).toContain("FIXTURE DATA");
    expect(html).toContain("lumimark");
    expect(html).not.toContain("Visual concept");
    expect(html).toContain("Weekly calendar");
    expect(html).toContain("Disable graphics");
    expect(html).toContain("World instrument panel");
    expect(forbidden).not.toHaveBeenCalled();
  });
});
