import test from "node:test";
import assert from "node:assert/strict";
import { formatTimecode, VIDEO_EDITOR_VERSION } from "../dist/core/index.js";

test("formatTimecode renders m:ss.mmm", () => {
  assert.equal(formatTimecode(0), "0:00.000");
  assert.equal(formatTimecode(83.5), "1:23.500");
  assert.equal(formatTimecode(600.0071), "10:00.007");
});

test("formatTimecode carries a rounded second and clamps negatives", () => {
  assert.equal(formatTimecode(59.9996), "1:00.000");
  assert.equal(formatTimecode(-2), "0:00.000");
});

test("the package reports its version", () => {
  assert.equal(VIDEO_EDITOR_VERSION, "0.1.0");
});
