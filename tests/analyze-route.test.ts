import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/analyze/route";

const analyzeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/analyzer", () => ({
  analyze: analyzeMock,
}));

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function completedResult() {
  return {
    status: "completed",
    website: { url: "https://example.com", final_url: "https://example.com/", response_status: 200 },
    metadata: {},
    navigation: { trees: [], links: [] },
    sections: [],
    products: [],
    images: [],
    links: [],
    debug: { counters: [], rejection_reasons: [], extraction_warnings: [], processing_stages: [], duration_ms: 10 },
  };
}

function failedResult(source: string) {
  return {
    ...completedResult(),
    status: "failed",
    debug: { ...completedResult().debug, extraction_warnings: [{ code: "analysis_failed", message: "internal", source }] },
  };
}

describe("POST /api/analyze", () => {
  beforeEach(() => analyzeMock.mockReset());

  it("validates input and returns the typed analyzer result", async () => {
    analyzeMock.mockResolvedValue(completedResult());
    const response = await POST(request({ url: "https://example.com" }));
    expect(response.status).toBe(200);
    expect((await response.json()).result.status).toBe("completed");
    expect(analyzeMock).toHaveBeenCalledWith("https://example.com/", { render: "auto" });
  });

  it("normalizes a bare domain before invoking the analyzer", async () => {
    analyzeMock.mockResolvedValue(completedResult());
    const response = await POST(request({ url: " acn.com.pk " }));
    expect(response.status).toBe(200);
    expect(analyzeMock).toHaveBeenCalledWith("https://acn.com.pk/", { render: "auto" });
  });

  it("returns 400 for invalid JSON shape", async () => {
    const response = await POST(request({ url: "not-a-url" }));
    expect(response.status).toBe(400);
    expect(analyzeMock).not.toHaveBeenCalled();
  });

  it.each([
    ["ssrf_rejected", 403],
    ["timeout", 408],
    ["non_html_response", 422],
    ["network_failure", 500],
  ])("maps %s failures to HTTP %s", async (source, status) => {
    analyzeMock.mockResolvedValue(failedResult(source));
    const response = await POST(request({ url: "https://example.com" }));
    expect(response.status).toBe(status);
    expect((await response.json()).result.status).toBe("failed");
  });

});
