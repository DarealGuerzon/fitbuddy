import { describe, it, expect } from "vitest";
import { estimate1RM } from "./epley";

describe("estimate1RM", () => {
  it("returns the weight itself for a 1-rep set", () => {
    expect(estimate1RM(100, 1)).toBe(100);
  });

  it("applies the Epley formula for multi-rep sets", () => {
    // Epley: weight * (1 + reps / 30)
    expect(estimate1RM(100, 5)).toBeCloseTo(116.67, 1);
  });

  it("returns 0 for a 0-weight set", () => {
    expect(estimate1RM(0, 5)).toBe(0);
  });
});
