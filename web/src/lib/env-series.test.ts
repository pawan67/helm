import { describe, it, expect } from "vitest";
import { bucketFor, normalizeDays, round1 } from "./env-series";

describe("bucketFor", () => {
  it("uses hourly buckets for a week or less", () => {
    expect(bucketFor(1)).toBe("hour");
    expect(bucketFor(7)).toBe("hour");
  });

  it("rolls up to daily buckets beyond a week", () => {
    expect(bucketFor(8)).toBe("day");
    expect(bucketFor(30)).toBe("day");
  });
});

describe("normalizeDays", () => {
  it("only accepts the ranges the UI offers", () => {
    expect(normalizeDays(30)).toBe(30);
    expect(normalizeDays(7)).toBe(7);
  });

  it("falls back to 7 for anything else", () => {
    expect(normalizeDays(undefined)).toBe(7);
    expect(normalizeDays(1)).toBe(7);
    expect(normalizeDays(365)).toBe(7);
    expect(normalizeDays(NaN)).toBe(7);
  });
});

describe("round1", () => {
  it("rounds to one decimal", () => {
    expect(round1(22.34)).toBe(22.3);
    expect(round1(22.35)).toBe(22.4);
    expect(round1(50)).toBe(50);
  });

  it("preserves gaps (null) and rejects non-finite values", () => {
    expect(round1(null)).toBeNull();
    expect(round1(undefined)).toBeNull();
    expect(round1(NaN)).toBeNull();
    expect(round1(Infinity)).toBeNull();
  });
});
