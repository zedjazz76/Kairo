import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("repository excludes release-scan secret and PHI markers outside synthetic fixture boundaries", () => {
  const releasePattern = [
    "s" + "k-[A-Za-z0-9_-]{20,}",
    "BEGIN (RSA|EC|OPENSSH) PRIVATE KEY",
    "patient" + "MrnTestValue",
  ].join("|");
  const result = spawnSync(
    "git",
    ["grep", "-n", "-E", releasePattern, "--", ":!validation/fixtures/synthetic/**"],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 1, result.stdout.toString());
});
