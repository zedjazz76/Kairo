import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("repository excludes known PHI fixture markers outside synthetic fixture boundaries", () => {
  const result = spawnSync(
    "git",
    ["grep", "-n", "patient" + "MrnTestValue", "--", ":!validation/fixtures/synthetic/**"],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 1, result.stdout.toString());
});
