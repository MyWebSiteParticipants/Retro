import { describe, expect, it } from "vitest";
import { decode, encode, parseTitle, retroTitle, type NoteMeta } from "./codec";

describe("codec", () => {
  it("round-trips a note", () => {
    const meta: NoteMeta = { v: 1, app: "retro", column: "start" };
    const body = encode(meta, "Write tests **first**");
    const out = decode<NoteMeta>(body);
    expect(out?.meta).toEqual(meta);
    expect(out?.text).toBe("Write tests **first**");
  });

  it("ignores ordinary comments", () => {
    expect(decode("Just a comment")).toBeUndefined();
    expect(decode("<!-- retro:not json -->\nx")).toBeUndefined();
    expect(decode('<!-- retro:{"app":"other"} -->\nx')).toBeUndefined();
  });

  it("keeps multi-line markdown", () => {
    const body = encode({ v: 1, app: "retro", column: "stop" }, "line 1\n\n- a\n- b");
    expect(decode(body)?.text).toBe("line 1\n\n- a\n- b");
  });

  it("titles parse back", () => {
    expect(parseTitle(retroTitle("Sprint 3"))).toBe("Sprint 3");
    expect(parseTitle("Something else")).toBeUndefined();
  });
});
