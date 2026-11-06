"use strict";
const assert = require("node:assert/strict");
const d = require("./studio-diagnostics.cjs");
const { returnOutcome } = require("./studio-ipc-outcome.cjs");
const { routeStderrLine } = require("./studio-electron-launch.cjs");

(async () => {
  for (const line of [
    "Fontconfig warning: invalid attribute",
    "MESA-INTEL: warning: Haswell Vulkan support is incomplete",
    "[405:ERROR:ui/gl/gl_surface_presentation_helper.cc:260] GetVSyncParametersIfAvailable() failed for 1 times!",
    "(node:1234) ExperimentalWarning: SQLite is an experimental feature and might change at any time",
    "(Use " + String.fromCharCode(96) + "electron --trace-warnings ...",
    "[123:ERROR:content/browser/browser_main_loop.cc:278] GLib-GObject: instance has no handler with id '123'",
  ]) assert.equal(d.isRoutineElectronNoise(line), true, line);
  for (const line of ["Error: Database cannot open", "Fontconfig error: fonts missing", "[ERROR] Vite build failed"])
    assert.equal(d.isRoutineElectronNoise(line), false, line);
  routeStderrLine("MESA-INTEL: warning: Haswell Vulkan support is incomplete");
  const success = await returnOutcome("studio:ai-opencode-service", Promise.resolve("http://127.0.0.1:4096"));
  assert.deepEqual(success, {status:"success", value:"http://127.0.0.1:4096"});
  const failed = await returnOutcome("studio:ai-opencode-service",
    Promise.reject(new Error("OpenCode ortak servis adresi bulunamadı.")));
  assert.equal(failed.status, "failure");
  assert.match(failed.message, /OpenCode ortak servis/);
  const noSubs = await returnOutcome("studio:transcript-fetch-youtube",
    Promise.reject(new Error("YouTube altyazısı alınamadı. [youtube] No subtitles")));
  assert.equal(noSubs.message, "Bu video için seçili dillerde manuel veya otomatik altyazı alınamadı.");
  const limited = await returnOutcome("studio:transcript-fetch-youtube",
    Promise.reject(new Error("YouTube altyazısı alınamadı. HTTP Error 429")));
  assert.match(limited.message, /429/);
  assert(require("node:fs").existsSync(d.logFile()), "expected diagnostic file");
  console.log("PASS studio-diagnostics: filter; IPC outcomes; log file; 429");
})().catch((e) => { console.error(e); process.exitCode = 1; });
