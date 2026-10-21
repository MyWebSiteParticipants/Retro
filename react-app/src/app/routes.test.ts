import { describe, expect, it } from "vitest";
import { boardHash, parseHash } from "./routes";

describe("routes", () => {
  it("parses a board link", () => {
    expect(parseHash("#/r/MyWebSiteParticipants/Bullpen/42")).toEqual({ view: "board", repo: "MyWebSiteParticipants/Bullpen", number: 42 });
  });
  it("round-trips", () => {
    expect(parseHash(boardHash("a/b", 7))).toEqual({ view: "board", repo: "a/b", number: 7 });
  });
  it("defaults to sessions", () => {
    expect(parseHash("")).toEqual({ view: "sessions" });
    expect(parseHash("#/nonsense")).toEqual({ view: "sessions" });
    expect(parseHash("#/history").view).toBe("history");
  });
});
