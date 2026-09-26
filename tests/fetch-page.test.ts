import { describe, expect, it, vi } from "vitest";
import { fetchPage } from "@/lib/analyzer/fetch-page";

function response(body: string, init: ResponseInit = {}) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", ...init.headers },
    ...init,
  });
}

describe("fetchPage", () => {
  it("returns bounded HTML page data", async () => {
    const result = await fetchPage("https://example.com", {
      validate_dns: false,
      fetch_impl: vi.fn().mockResolvedValue(response("<html>ok</html>")),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.html).toBe("<html>ok</html>");
      expect(result.final_url).toBe("https://example.com/");
      expect(result.headers["content-type"]).toContain("text/html");
    }
  });

  it("revalidates redirect targets", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response("", { status: 302, headers: { location: "http://127.0.0.1/admin" } }));
    const result = await fetchPage("https://example.com", { validate_dns: false, fetch_impl: fetchMock });
    expect(result).toMatchObject({ ok: false, code: "ssrf_rejected" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("handles non-html, HTTP errors, oversized bodies, and network failures", async () => {
    await expect(fetchPage("https://example.com", { validate_dns: false, fetch_impl: vi.fn().mockResolvedValue(response("image", { headers: { "content-type": "image/png" } })) })).resolves.toMatchObject({ ok: false, code: "non_html_response" });
    await expect(fetchPage("https://example.com", { validate_dns: false, fetch_impl: vi.fn().mockResolvedValue(response("no", { status: 503 })) })).resolves.toMatchObject({ ok: false, code: "http_error" });
    await expect(fetchPage("https://example.com", { validate_dns: false, max_response_bytes: 3, fetch_impl: vi.fn().mockResolvedValue(response("toolong")) })).resolves.toMatchObject({ ok: false, code: "oversized_response" });
    await expect(fetchPage("https://example.com", { validate_dns: false, fetch_impl: vi.fn().mockRejectedValue(new Error("offline")) })).resolves.toMatchObject({ ok: false, code: "network_failure" });
  });
});
