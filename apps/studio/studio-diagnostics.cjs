"use strict";
const fs = require("node:fs");
const path = require("node:path");
const channelProjects = require("./channel-projects.cjs");
const ROOT = path.resolve(__dirname, "../..");
let pruned = "";

function logDirectory() {
  const override = String(process.env.CHANNEL_FOUNDRY_DATA_ROOT || "").trim();
  const root = override ? path.resolve(ROOT, override) : channelProjects.activeDataRoot(ROOT);
  return path.join(root, "studio", "logs");
}

function logFile(date = new Date()) {
  return path.join(logDirectory(), "studio-" + date.toISOString().slice(0,10) + ".log");
}

function isRoutineElectronNoise(line) {
  const s = String(line).trim();
  return /^Fontconfig warning:/.test(s)
    || /^MESA-INTEL: warning: Haswell Vulkan support is incomplete/.test(s)
    || /GetVSyncParametersIfAvailable\(\) failed for \d+ times!/.test(s)
    || /^\(node:\d+\) ExperimentalWarning: SQLite is an experimental feature/.test(s)
    || /^\(Use .?electron --trace-warnings/.test(s)
    || (/GLib-GObject:.*no handler with id/.test(s) && /ERROR:content\/browser\/browser_main_loop\.cc/.test(s));
}

function record(level, source, detail) {
  try {
    const now = new Date();
    const dir = logDirectory();
    fs.mkdirSync(dir, {recursive: true, mode: 0o700});
    const day = now.toISOString().slice(0,10);
    if (pruned !== day) {
      pruned = day;
      const cutoff = Date.now() - 14 * 86400000;
      for (const f of fs.readdirSync(dir)) {
        if (/^studio-\d{4}-\d{2}-\d{2}\.log$/.test(f)
            && Date.parse(f.slice(7,17) + "T00:00:00Z") < cutoff) {
          fs.rmSync(path.join(dir, f), {force: true});
        }
      }
    }
    const safe = String(detail ?? "")
      .replace(/(Authorization:\s*(?:Basic|Bearer)\s+)[^\s]+/gi, "$1[REDACTED]")
      .replace(/((?:api[_-]?key|token|password|secret)=)[^\s&]+/gi, "$1[REDACTED]");
    const entry = "[" + now.toISOString() + "][" + String(level).toUpperCase() + "][" + source + "] "
      + safe.replace(/\r?\n/g, "\n    ") + "\n";
    fs.appendFileSync(logFile(now), entry, {encoding:"utf8", mode:0o600});
  } catch { /* Log arizasi uygulamayi etkilemez. */ }
}
module.exports = { record, logFile, isRoutineElectronNoise };
