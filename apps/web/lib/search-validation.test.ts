/**
 * Tests for search-validation utilities
 *
 * Run with: node --test --import tsx apps/web/lib/search-validation.test.ts
 */

import assert from "node:assert";
import { describe, it } from "node:test";
import { validateSearchParams } from "./search-validation";

describe("validateSearchParams", () => {
  it("returns null for valid params", () => {
    const result = validateSearchParams({
      limite: "50",
      offset: "0",
      valorMin: null,
      valorMax: null,
    });
    assert.strictEqual(result, null);
  });

  it("returns 400 when limite is NaN", () => {
    const result = validateSearchParams({
      limite: "abc",
      offset: "0",
      valorMin: null,
      valorMax: null,
    });
    assert.notStrictEqual(result, null);
    assert.strictEqual(result?.status, 400);
    assert.ok(result?.error.includes("limite"));
  });

  it("returns 400 when offset is NaN", () => {
    const result = validateSearchParams({
      limite: "50",
      offset: "xyz",
      valorMin: null,
      valorMax: null,
    });
    assert.notStrictEqual(result, null);
    assert.strictEqual(result?.status, 400);
  });

  it("returns 400 when both limite and offset are missing", () => {
    const result = validateSearchParams({
      limite: null,
      offset: null,
      valorMin: null,
      valorMax: null,
    });
    assert.notStrictEqual(result, null);
    assert.strictEqual(result?.status, 400);
  });

  it("returns 400 when valor_min > valor_max", () => {
    const result = validateSearchParams({
      limite: "50",
      offset: "0",
      valorMin: "1000000",
      valorMax: "500000",
    });
    assert.notStrictEqual(result, null);
    assert.strictEqual(result?.status, 400);
    assert.ok(result?.error.includes("mínimo"));
  });

  it("returns null when valor_min <= valor_max", () => {
    const result = validateSearchParams({
      limite: "50",
      offset: "0",
      valorMin: "500000",
      valorMax: "1000000",
    });
    assert.strictEqual(result, null);
  });

  it("returns null when only valor_min is present", () => {
    const result = validateSearchParams({
      limite: "50",
      offset: "0",
      valorMin: "1000000",
      valorMax: null,
    });
    assert.strictEqual(result, null);
  });
});
