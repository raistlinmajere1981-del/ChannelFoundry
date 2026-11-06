"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

test("channel launcher passes startup selection without changing the running Studio's active project", { skip: process.platform === "win32" }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "studio-channel-launch-"));
  try {
    for (const folder of ["scripts", "channels/alpha", "bin"]) fs.mkdirSync(path.join(root, folder), { recursive: true });
    fs.copyFileSync(path.join(__dirname, "../../scripts/run-channel-project.mjs"), path.join(root, "scripts/run-channel-project.mjs"));
    fs.writeFileSync(path.join(root, "channels/alpha/channel.json"), JSON.stringify({ id: "alpha", displayName: "Alpha" }));
    const state = path.join(root, ".channel-active.json");
    fs.writeFileSync(state, JSON.stringify({ id: "beta" }));
    const before = fs.readFileSync(state);
    const capture = path.join(root, "launch.json");
    fs.writeFileSync(path.join(root, "bin/npm"), `#!/usr/bin/env node
require('node:fs').writeFileSync(process.env.STUDIO_TEST_CAPTURE, JSON.stringify({
  project: process.env.CHANNEL_FOUNDRY_START_PROJECT,
  dataRoot: process.env.CHANNEL_FOUNDRY_DATA_ROOT,
  args: process.argv.slice(2)
}));\n`, { mode: 0o700 });
    execFileSync(process.execPath, [path.join(root, "scripts/run-channel-project.mjs"), "studio", "alpha"], {
      env: { ...process.env, PATH: path.join(root, "bin") + path.delimiter + process.env.PATH,
        CHANNEL_FOUNDRY_DATA_ROOT: "/must-not-leak", STUDIO_TEST_CAPTURE: capture },
    });
    assert.deepEqual(fs.readFileSync(state), before);
    assert.deepEqual(JSON.parse(fs.readFileSync(capture, "utf8")), { project: "alpha", args: ["run", "start:studio"] });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
