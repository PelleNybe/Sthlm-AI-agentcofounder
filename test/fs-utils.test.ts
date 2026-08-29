import { describe, it, expect } from "vitest";
import { isInside, isInsideOrEqual } from "../src/fs-utils.js";
import path from "node:path";

describe("fs-utils", () => {
  describe("isInsideOrEqual", () => {
    it("returns true for identical paths", () => {
      expect(isInsideOrEqual("/foo/bar", "/foo/bar")).toBe(true);
      expect(isInsideOrEqual("foo/bar", "foo/bar")).toBe(true);
    });

    it("returns true for subdirectories", () => {
      expect(isInsideOrEqual("/foo/bar", "/foo/bar/baz")).toBe(true);
      expect(isInsideOrEqual("foo/bar", "foo/bar/baz")).toBe(true);
      expect(isInsideOrEqual("/foo", "/foo/bar/baz")).toBe(true);
    });

    it("returns false for outside directories", () => {
      expect(isInsideOrEqual("/foo/bar", "/foo")).toBe(false);
      expect(isInsideOrEqual("/foo/bar", "/foo/baz")).toBe(false);
      expect(isInsideOrEqual("/foo/bar", "/bar")).toBe(false);
    });

    it("resolves paths with .. before checking", () => {
      expect(isInsideOrEqual("/foo/bar", "/foo/bar/baz/../qux")).toBe(true);
      expect(isInsideOrEqual("/foo/bar", "/foo/bar/../../etc/passwd")).toBe(false);
    });

    it("returns false for sibling directories with matching prefixes", () => {
      expect(isInsideOrEqual("/foo/bar", "/foo/bar-suffix")).toBe(false);
    });
  });

  describe("isInside", () => {
    it("returns false for identical paths", () => {
      expect(isInside("/foo/bar", "/foo/bar")).toBe(false);
      expect(isInside("foo/bar", "foo/bar")).toBe(false);
    });

    it("returns true for subdirectories", () => {
      expect(isInside("/foo/bar", "/foo/bar/baz")).toBe(true);
      expect(isInside("foo/bar", "foo/bar/baz")).toBe(true);
      expect(isInside("/foo", "/foo/bar/baz")).toBe(true);
    });

    it("returns false for outside directories", () => {
      expect(isInside("/foo/bar", "/foo")).toBe(false);
      expect(isInside("/foo/bar", "/foo/baz")).toBe(false);
      expect(isInside("/foo/bar", "/bar")).toBe(false);
    });

    it("resolves paths with .. before checking", () => {
      expect(isInside("/foo/bar", "/foo/bar/baz/../qux")).toBe(true);
      expect(isInside("/foo/bar", "/foo/bar/../../etc/passwd")).toBe(false);
    });

    it("returns false for sibling directories with matching prefixes", () => {
      expect(isInside("/foo/bar", "/foo/bar-suffix")).toBe(false);
    });
  });
});
