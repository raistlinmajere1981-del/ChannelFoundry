#!/usr/bin/env node
"use strict";
// Usage: node apps/studio/nexa-analysis-cli.cjs next --count 3
//        node apps/studio/nexa-analysis-cli.cjs check --file <response.json>
//        node apps/studio/nexa-analysis-cli.cjs import --file <response.json>
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const channelProjects = require("./channel-projects.cjs");
const bridge = require("./nexa-analysis-bridge.cjs");

const ROOT = path.resolve(__dirname, "../..");
const HELP = [
  "Nexa terminal çözümleme köprüsü (AI sağlayıcısı çağırmaz)",
  "  next [--count 3] [--project birdesengor] [--out DIZIN]",
  "  check --file SONUC.json [--project birdesengor]",
  "  import --file SONUC.json [--project birdesengor] [--replace]",
  "  --replace yalnız önceden kayıtlı çözümleme üzerine yazmak için kullanılır.",
].join("\n");

function options(args) {
  const result = {};
  for (let index = 0; index < args.length; index++) {
    const item = args[index];
    if (!item.startsWith("--")) throw new Error("Bilinmeyen parametre: " + item);
    const key = item.slice(2);
    if (!["count", "project", "out", "file", "replace"].includes(key) || Object.hasOwn(result, key)) {
      throw new Error("Geçersiz veya tekrar eden seçenek: " + item);
    }
    if (key === "replace") result.replace = true;
    else if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(item + " değer bekliyor.");
    else result[key] = args[++index];
  }
  return result;
}

function databaseFile(input) {
  const id = String(input.project ?? channelProjects.activeProjectId(ROOT) ?? "").trim();
  if (!/^[a-z][a-z0-9-]{1,48}$/.test(id)) {
    throw new Error("Bir kanal seçilmeli veya --project birdesengor belirtilmeli.");
  }
  const channel = path.join(ROOT, "channels", id);
  const config = path.join(channel, "channel.json");
  if (!fs.existsSync(config) || JSON.parse(fs.readFileSync(config, "utf8")).id !== id) {
    throw new Error("Kanal projesi bulunamadı: " + id);
  }
  const envRoot = String(process.env.CHANNEL_FOUNDRY_DATA_ROOT ?? "").trim();
  const dataRoot = envRoot
    ? (path.isAbsolute(envRoot) ? envRoot : path.resolve(ROOT, envRoot))
    : path.join(channel, ".local-data");
  const studio = path.join(dataRoot, "studio");
  const file = path.join(studio, "channel-foundry-studio.sqlite");
  if (!fs.existsSync(file)) {
    throw new Error("Studio veritabanı bulunamadı; boş veritabanı oluşturulmadı: " + file);
  }
  return { file, studio, project: id };
}

function writeOnce(file, data) {
  try {
    fs.writeFileSync(file, data, { flag: "wx", mode: 0o600 });
    return "created";
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    return "existing";
  }
}

function exportNext(db, dir, count) {
  const selected = bridge.next(db, count);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const responses = path.join(path.dirname(dir), "responses");
  fs.mkdirSync(responses, { recursive: true, mode: 0o700 });
  const exported = [];
  for (const item of selected) {
    const { request, transcript } = bridge.requestFor(db, item.videoId);
    const stem = item.videoId + "-" + item.sourceHash.slice(0, 12);
    const requestFile = path.join(dir, stem + ".request.json");
    const transcriptFile = path.join(dir, stem + ".transcript.txt");
    const responseFile = path.join(responses, stem + ".response.json");
    const input = { ...request, transcriptFile };
    writeOnce(requestFile, JSON.stringify(input, null, 2) + "\n");
    writeOnce(transcriptFile, transcript);
    const responseState = writeOnce(responseFile, JSON.stringify(bridge.blankResponse(request), null, 2) + "\n");
    exported.push({
      videoId: item.videoId, title: item.title, date: item.publishedAt,
      reason: item.reason, characters: item.transcriptLength,
      requestFile, transcriptFile, responseFile,
      responseState,
    });
  }
  return { project: dir, requested: count, found: selected.length, videos: exported };
}

function check(db, result) {
  const row = db.prepare([
    "SELECT st.language,st.text AS transcript",
    "FROM source_transcripts st",
    "JOIN youtube_videos v ON v.video_id=st.external_id",
    "JOIN youtube_channels c ON c.id=v.channel_id AND c.is_active=1",
    "WHERE st.provider='youtube' AND st.external_id=?"
  ].join(" ")).get(result.videoId);
  if (!row) throw new Error("Seçili kanalda kaynak altyazı bulunamadı.");
  const currentHash = bridge.sourceHash({
    videoId: result.videoId, language: row.language, transcript: row.transcript,
  });
  if (result.sourceHash !== currentHash) throw new Error("Altyazı sürümü değişmiş.");
  bridge.validateResult(result, row.transcript);
  return { videoId: result.videoId, valid: true, sourceHash: currentHash };
}

function main(argv = process.argv.slice(2)) {
  const [command, ...rawOptions] = argv;
  if (!command || ["help", "-h", "--help"].includes(command)) {
    process.stdout.write(HELP + "\n");
    return;
  }
  if (!["next", "check", "import"].includes(command)) throw new Error(HELP);
  const input = options(rawOptions);
  if (command !== "next" && (input.out || input.count)) throw new Error("Bu seçenek yalnız next komutunda kullanılabilir.");
  if (command === "next" && (input.file || input.replace)) throw new Error("next yalnız --count veya --out alabilir.");
  if (command === "check" && input.replace) throw new Error("--replace yalnız import komutunda kullanılabilir.");
  const resolved = databaseFile(input);
  const db = new DatabaseSync(resolved.file, { readOnly: command !== "import", timeout: 5000 });
  try {
    db.exec("PRAGMA foreign_keys=ON;");
    let output;
    if (command === "next") {
      const count = input.count === undefined ? 3 : Number(input.count);
      const dir = path.resolve(input.out ?? path.join(resolved.studio, "nexa-analysis", "requests"));
      output = exportNext(db, dir, count);
      output.project = resolved.project;
    } else {
      if (!input.file) throw new Error("--file SONUC.json gerekli.");
      const file = path.resolve(input.file);
      const result = JSON.parse(fs.readFileSync(file, "utf8"));
      if (command === "check") output = { project: resolved.project, ...check(db, result) };
      else {
        check(db, result);
        output = { project: resolved.project, ...bridge.importResult(db, result, { replace: Boolean(input.replace) }) };
      }
    }
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } finally {
    db.close();
  }
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    process.stderr.write("Nexa köprüsü: " + (error?.message ?? error) + "\n");
    process.exitCode = 1;
  }
}

module.exports = { main, options, databaseFile, exportNext, check };
