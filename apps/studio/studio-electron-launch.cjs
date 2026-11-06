"use strict";
const {spawn} = require("node:child_process");
const d = require("./studio-diagnostics.cjs");

function routeStderrLine(line) {
  const raw = String(line).replace(/\r$/, "");
  if (!raw) return;
  const routine = d.isRoutineElectronNoise(raw);
  d.record(routine ? "debug" : "error", "electron", raw);
  if (!routine) process.stderr.write(raw + "\n");
}

function run() {
  const child = spawn(require("electron"), ["."], {
    cwd: __dirname,
    env: process.env,
    stdio: ["inherit","inherit","pipe"],
  });
  let pending = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    pending += chunk;
    const parts = pending.split(/\n/);
    pending = parts.pop();
    for (const line of parts) routeStderrLine(line);
    if (pending.length > 32768) { routeStderrLine(pending); pending = ""; }
  });
  child.stderr.on("end", () => {
    if (pending) routeStderrLine(pending);
    pending = "";
  });
  child.on("error", (error) => {
    d.record("error", "launcher", error.stack || error.message);
    process.stderr.write("Yayin Atolyesi baslatilamadi: " + error.message + "\n");
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    process.exitCode = signal ? 128 + (require("node:os").constants.signals[signal] || 0) : code ?? 1;
  });
  for (const signal of ["SIGINT","SIGTERM"]) {
    process.on(signal, () => {
      if (child.exitCode === null && !child.killed) child.kill(signal);
    });
  }
}
if (require.main === module) run();
module.exports = {routeStderrLine};
