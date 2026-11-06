"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawnSync} = require("node:child_process");

// A real input file also works in restricted environments where child-process
// stdin pipes cannot deliver EOF. No shell, networking or production storage.
function runPhp(args, {input = "", ...options} = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vefk-s6-php-input-"));
  let fd;
  try {
    const file = path.join(directory, "input.json");
    fs.writeFileSync(file, input, {mode: 0o600});
    fd = fs.openSync(file, "r");
    return spawnSync("php", args, {...options, stdio: [fd, "pipe", "pipe"]});
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    fs.rmSync(directory, {recursive: true, force: true});
  }
}
module.exports = {runPhp};
