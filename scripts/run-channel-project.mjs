import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const channelProjects = require("../apps/studio/channel-projects.cjs");

const root = fileURLToPath(new URL("../", import.meta.url));
const [mode, channelId] = process.argv.slice(2);
const modes = {
  web: { cwd: "web", task: "dev" },
  "build-web": { cwd: "web", task: "build" },
  studio: { cwd: "core", task: "start:studio" },
  "dev-studio": { cwd: "core", task: "dev:studio" },
};
if (!modes[mode] || !channelId || !/^[a-z0-9-]+$/.test(channelId)) {
  console.error("Kullanım: node scripts/run-channel-project.mjs <web|build-web|studio|dev-studio> <kanal-kodu>");
  process.exit(2);
}
const channelDir = path.join(root, "channels", channelId);
let channel;
try {
  channel = JSON.parse(readFileSync(path.join(channelDir, "channel.json"), "utf8"));
  if (channel.id !== channelId || !channel.displayName) throw new Error("Geçersiz kanal kimliği.");
} catch (error) {
  console.error(`Kanal çalışma alanı bulunamadı: ${error.message}`);
  process.exit(2);
}
const selected = modes[mode];
const cwd = selected.cwd === "web" ? path.join(channelDir, "web") : root;
if (selected.cwd === "web" && !existsSync(path.join(cwd, "package.json"))) {
  console.error(`${channel.displayName} web reposu bulunamadı: ${cwd}`);
  process.exit(2);
}
if (selected.cwd === "core") {
  channelProjects.setActiveProject(channelId, root);
}
const env = { ...process.env };
delete env.CHANNEL_FOUNDRY_DATA_ROOT;
console.log(`ChannelFoundry · ${channel.displayName} · ${mode}`);
const command = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(command, ["run", selected.task], { cwd, env, stdio: "inherit" });
child.on("error", (error) => {
  console.error("Çalışma ortamı başlatılamadı:", error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
