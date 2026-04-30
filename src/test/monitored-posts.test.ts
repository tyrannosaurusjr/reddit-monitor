import { describe, expect, it } from "vitest";
import { deriveMonitoredPostStatus, normalizeRedditPermalink } from "@/lib/monitored-posts";

describe("deriveMonitoredPostStatus", () => {
  it("marks a post as replied when any reply is posted", () => {
    expect(deriveMonitoredPostStatus("queued", ["draft", "posted"])).toBe("replied");
  });

  it("keeps a post queued while an active reply exists", () => {
    expect(deriveMonitoredPostStatus("new", ["draft"])).toBe("queued");
    expect(deriveMonitoredPostStatus("new", ["scheduled"])).toBe("queued");
    expect(deriveMonitoredPostStatus("new", ["failed"])).toBe("queued");
  });

  it("returns a post to new when queued replies are gone", () => {
    expect(deriveMonitoredPostStatus("queued", [])).toBe("new");
  });

  it("preserves dismissed posts when there are no replies", () => {
    expect(deriveMonitoredPostStatus("dismissed", [])).toBe("dismissed");
  });
});

describe("normalizeRedditPermalink", () => {
  it("prefixes relative Reddit permalinks", () => {
    expect(normalizeRedditPermalink("/r/test/comments/abc123/post")).toBe(
      "https://reddit.com/r/test/comments/abc123/post"
    );
  });

  it("leaves absolute Reddit permalinks untouched", () => {
    expect(normalizeRedditPermalink("https://reddit.com/r/test/comments/abc123/post")).toBe(
      "https://reddit.com/r/test/comments/abc123/post"
    );
  });
});
