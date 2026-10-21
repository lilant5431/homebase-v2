import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Auditions from "./Auditions";

afterEach(() => vi.unstubAllGlobals());

describe("isolated visual auditions", () => {
  it.each(["aether", "meridian", "prism"])(
    "%s renders academic fixtures without reading storage or starting a worker",
    (concept) => {
      vi.stubGlobal("location", { hash: `#auditions/${concept}` });
      const read = vi.fn(() => {
        throw new Error("Real data is forbidden in an audition");
      });
      const write = vi.fn(() => {
        throw new Error("Real data is forbidden in an audition");
      });
      const worker = vi.fn(() => {
        throw new Error("Inference is forbidden in an audition");
      });
      vi.stubGlobal("localStorage", { getItem: read, setItem: write });
      vi.stubGlobal("Worker", worker);
      const html = renderToStaticMarkup(<Auditions />);
      expect(html).toContain(`au-${concept}`);
      expect(html).toContain("Weekly calendar");
      expect(html).toContain("Cognitive psychology");
      expect(html).toContain("Reading response: Modernism");
      expect(html).toContain("FIXTURE DATA ONLY");
      expect(read).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
      expect(worker).not.toHaveBeenCalled();
    },
  );
});
