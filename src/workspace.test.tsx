import { afterEach, describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Workspace from "./Workspace";

afterEach(() => vi.unstubAllGlobals());
describe("lightweight academic workspace", () => {
  it("shows the full manual calendar and capture controls without graphics, Workers or storage writes", () => {
    const forbidden = vi.fn(() => {
      throw Error("Unexpected resource or write");
    });
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: forbidden,
      removeItem: forbidden,
    });
    vi.stubGlobal("navigator", { locks: undefined });
    vi.stubGlobal("Worker", forbidden);
    vi.stubGlobal("WebGLRenderingContext", forbidden);
    const html = renderToStaticMarkup(<Workspace route="#calendar" />);
    expect(html).toContain('aria-label="Weekly calendar"');
    expect(html).toContain("Quick Add");
    expect(html).toContain("Schedule time");
    expect(html).toContain("New assignment");
    expect(html).toContain("Workspace tools");
    expect(html).toContain("Read-only workspace");
    expect(html).not.toContain("<canvas");
    expect(html).not.toContain("Enable on-device AI");
    expect(forbidden).not.toHaveBeenCalled();
  });
  it("keeps AI approval separate and exposes model limitations only on the Assistant surface", () => {
    const forbidden = vi.fn(() => {
      throw Error("Unexpected inference");
    });
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: forbidden,
      removeItem: forbidden,
    });
    vi.stubGlobal("navigator", { locks: undefined });
    vi.stubGlobal("Worker", forbidden);
    const html = renderToStaticMarkup(<Workspace route="#assistant" />);
    expect(html).toContain("Enable on-device AI");
    expect(html).toContain("Model &amp; compatibility");
    expect(html).toContain("Supported requests &amp; clarification");
    expect(html).not.toContain("Approve changes");
    expect(forbidden).not.toHaveBeenCalled();
  });
});
