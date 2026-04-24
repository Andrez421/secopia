import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { LruCache } from "./cache.js";

describe("LruCache", () => {
  describe("basic operations", () => {
    it("stores and retrieves a value", () => {
      const cache = new LruCache<string>({ ttlMs: 60_000, maxEntries: 10 });
      cache.set("key1", "value1");
      assert.equal(cache.get("key1"), "value1");
    });

    it("returns undefined for missing keys", () => {
      const cache = new LruCache<string>({ ttlMs: 60_000, maxEntries: 10 });
      assert.equal(cache.get("missing"), undefined);
    });

    it("reports correct size", () => {
      const cache = new LruCache<string>({ ttlMs: 60_000, maxEntries: 10 });
      cache.set("a", "1");
      cache.set("b", "2");
      assert.equal(cache.size, 2);
    });

    it("clears all entries", () => {
      const cache = new LruCache<string>({ ttlMs: 60_000, maxEntries: 10 });
      cache.set("a", "1");
      cache.set("b", "2");
      cache.clear();
      assert.equal(cache.size, 0);
      assert.equal(cache.get("a"), undefined);
    });
  });

  describe("TTL expiration", () => {
    it("returns undefined for expired entries", async () => {
      const cache = new LruCache<string>({ ttlMs: 10, maxEntries: 10 });
      cache.set("key1", "value1");

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 20));

      assert.equal(cache.get("key1"), undefined);
    });

    it("returns value before TTL expires", () => {
      const cache = new LruCache<string>({ ttlMs: 60_000, maxEntries: 10 });
      cache.set("key1", "value1");
      assert.equal(cache.get("key1"), "value1");
    });
  });

  describe("LRU eviction", () => {
    let cache: LruCache<string>;

    beforeEach(() => {
      cache = new LruCache<string>({ ttlMs: 60_000, maxEntries: 3 });
    });

    it("evicts oldest entry when at capacity", () => {
      cache.set("a", "1");
      cache.set("b", "2");
      cache.set("c", "3");
      cache.set("d", "4"); // Should evict "a"

      assert.equal(cache.get("a"), undefined);
      assert.equal(cache.get("b"), "2");
      assert.equal(cache.get("d"), "4");
      assert.equal(cache.size, 3);
    });

    it("accessing an entry makes it most recently used", () => {
      cache.set("a", "1");
      cache.set("b", "2");
      cache.set("c", "3");

      // Access "a" to make it most recently used
      cache.get("a");

      cache.set("d", "4"); // Should evict "b" (now oldest), not "a"

      assert.equal(cache.get("a"), "1");
      assert.equal(cache.get("b"), undefined);
    });

    it("updating an entry refreshes its position", () => {
      cache.set("a", "1");
      cache.set("b", "2");
      cache.set("c", "3");

      // Update "a"
      cache.set("a", "updated");

      cache.set("d", "4"); // Should evict "b"

      assert.equal(cache.get("a"), "updated");
      assert.equal(cache.get("b"), undefined);
    });
  });

  describe("disabled cache (ttlMs = 0)", () => {
    it("never stores values when disabled", () => {
      const cache = new LruCache<string>({ ttlMs: 0, maxEntries: 10 });
      cache.set("key1", "value1");
      assert.equal(cache.get("key1"), undefined);
      assert.equal(cache.size, 0);
    });

    it("reports not enabled", () => {
      const cache = new LruCache<string>({ ttlMs: 0, maxEntries: 10 });
      assert.equal(cache.enabled, false);
    });
  });
});
