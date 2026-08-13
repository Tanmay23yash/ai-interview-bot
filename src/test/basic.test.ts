import { describe, it, expect } from "vitest";

describe("Basic Calculator Tests", () => {
  it("should add two numbers correctly", () => {
    expect(5 + 5).toBe(10);
  });

  it("should subtract two numbers correctly", () => {
    expect(10 - 5).toBe(5);
  });

  it("should multiply two numbers correctly", () => {
    expect(4 * 5).toBe(20);
  });

  it("should divide two numbers correctly", () => {
    expect(10 / 5).toBe(2);
  });
});