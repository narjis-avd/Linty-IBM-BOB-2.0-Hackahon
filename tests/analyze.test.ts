import { describe, expect, it, vi } from "vitest";
import { analyze } from "@/lib/analyzer/analyze";

describe("analyze", () => {
  it("runs the extraction pipeline and reports progress", async () => {
    const events: string[] = [];
    const result = await analyze("https://example.com", {
      render: "never",
      fetch: {
        validate_dns: false,
        fetch_impl: vi.fn().mockResolvedValue(
          new Response("<html><head><title>Example</title></head><body><main><section class='hero'><h1>Hello</h1></section></main></body></html>", {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
        ),
      },
      on_progress: (event) => events.push(event.message),
    });
    expect(result.status).toBe("completed");
    expect(result.website.title).toBe("Example");
    expect(events).toContain("Analysis complete");
  });

  it("returns useful typed failure data without throwing", async () => {
    const result = await analyze("http://127.0.0.1");
    expect(result.status).toBe("failed");
    expect(result.debug.extraction_warnings[0]?.code).toBe("analysis_failed");
  });
});
