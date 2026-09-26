import { describe, expect, it } from "vitest";
import { fetchPage } from "@/lib/analyzer/fetch-page";

describe("optional public website integration", () => {
  it.skipIf(process.env.REPLICAFORGE_RUN_INTEGRATION !== "1")(
    "can fetch a public HTML page when explicitly enabled",
    async () => {
      const result = await fetchPage("https://example.com", { timeout_ms: 5000 });
      if (!result.ok) {
        console.warn(`Optional integration unavailable: ${result.code}`);
        return;
      }
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.html.toLowerCase()).toContain("<html");
    },
  );
});
