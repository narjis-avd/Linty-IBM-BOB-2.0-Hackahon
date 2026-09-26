import { describe, expect, it } from "vitest";
import { parseSrcset } from "@/lib/analyzer/parse-srcset";

describe("parseSrcset", () => {
  it("parses URLs and descriptors", () => {
    expect(parseSrcset("small.jpg 480w, large.jpg 1024w")).toEqual([
      { url: "small.jpg", descriptor: "480w" },
      { url: "large.jpg", descriptor: "1024w" },
    ]);
  });
});
