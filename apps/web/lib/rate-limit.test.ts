/**
 * Tests for rate-limit utilities
 *
 * Run with: node --test --import tsx apps/web/lib/rate-limit.test.ts
 */

import assert from "node:assert";
import { describe, it } from "node:test";
import { getClientIp } from "./rate-limit";

function makeRequest(headers: Record<string, string>): Request {
  return new Request("http://localhost", { headers });
}

describe("getClientIp", () => {
  it("returns the LAST IP from x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" });
    assert.strictEqual(getClientIp(req), "10.0.0.1");
  });

  it("returns the only IP from x-forwarded-for when there is one", () => {
    const req = makeRequest({ "x-forwarded-for": "192.168.1.1" });
    assert.strictEqual(getClientIp(req), "192.168.1.1");
  });

  it("falls back to cf-connecting-ip when x-forwarded-for is absent", () => {
    const req = makeRequest({ "cf-connecting-ip": "203.0.113.1" });
    assert.strictEqual(getClientIp(req), "203.0.113.1");
  });

  it("prefers x-forwarded-for over cf-connecting-ip", () => {
    const req = makeRequest({
      "x-forwarded-for": "10.0.0.2",
      "cf-connecting-ip": "203.0.113.2",
    });
    assert.strictEqual(getClientIp(req), "10.0.0.2");
  });

  it("returns a derived key when no IP headers are present", () => {
    const req = makeRequest({});
    const ip = getClientIp(req);
    assert.strictEqual(ip.startsWith("anon-"), true);
    assert.strictEqual(ip.length > 5, true);
  });

  it("returns different derived keys for different requests", () => {
    const req1 = makeRequest({ "user-agent": "ua1" });
    const req2 = makeRequest({ "user-agent": "ua2" });
    const ip1 = getClientIp(req1);
    const ip2 = getClientIp(req2);
    assert.notStrictEqual(ip1, ip2);
  });

  it("ignores x-real-ip", () => {
    const req = makeRequest({ "x-real-ip": "1.2.3.4" });
    const ip = getClientIp(req);
    // Should NOT return 1.2.3.4; should fall back to derived key
    assert.notStrictEqual(ip, "1.2.3.4");
    assert.strictEqual(ip.startsWith("anon-"), true);
  });
});
