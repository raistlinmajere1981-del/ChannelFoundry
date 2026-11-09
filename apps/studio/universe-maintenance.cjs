const fs = require("node:fs");
const path = require("node:path");
const universeMerge = require("./universe-merge.cjs");
const channelProjects = require("./channel-projects.cjs");
const { resetUniverseWorkspace, snapshot } = require("./studio-universe-reset.cjs");

const CONFIRMATION = "EVRENİ YENİDEN OLUŞTUR";

function databaseFile(db) {
  const rows = db.prepare("PRAGMA database_list").all();
  const main = rows.find((row) => String(row.name) === "main");
  return String(main?.file ?? "").trim();
}

function total(values) {
  return Object.values(values ?? {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function narratorResetScope(db) {
  const owner = channelProjects.databaseProjectScope(db);
  if (!owner) return null;
  const project = channelProjects.readProject(owner.id, owner.projectRoot);
  return {
    owner,
    file: path.join(owner.projectRoot, "channels", owner.id, "channel.json"),
    sourceEntityKeys: project.narrator.sourceEntityKeys,
  };
}

function status(db) {
  const counts = snapshot(db);
  const narratorLinks = narratorResetScope(db)?.sourceEntityKeys.length ?? 0;
  const merge = universeMerge.status(db);
  const active = Boolean(merge?.run && ["waiting", "running"].includes(merge.run.state));
  return {
    confirmation: CONFIRMATION,
    reset: counts.reset,
    preserved: counts.preserved,
    resetCount: total(counts.reset) + narratorLinks,
    narratorLinks,
    active,
    activeRunId: active ? Number(merge.run.id) : null,
    blockedReason: active ? "Evrene İşleme çalışırken Evren yeniden oluşturulamaz. Önce çalışan işlemi durdur." : "",
  };
}

function backupFile(databasePath, userDataPath) {
  const directory = path.join(userDataPath, "backups");
  fs.mkdirSync(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const extension = path.extname(databasePath) || ".sqlite";
  const base = path.basename(databasePath, extension);
  return path.join(directory, `${base}.before-universe-rebuild-${stamp}${extension}`);
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function reset(db, userDataPath, input = {}) {
  const before = status(db);
  if (before.active) throw new Error(before.blockedReason);
  if (String(input?.confirmation ?? "").trim() !== CONFIRMATION) {
    throw new Error(`Onay metni tam olarak “${CONFIRMATION}” olmalı.`);
  }
  const databasePath = databaseFile(db);
  if (!databasePath) throw new Error("Studio veritabanı dosyası bulunamadı.");
  db.exec("PRAGMA wal_checkpoint(FULL);");
  const backup = backupFile(databasePath, userDataPath);
  db.exec(`VACUUM INTO ${sqlString(backup)};`);
  const scope = narratorResetScope(db);
  const narratorLinks = scope?.sourceEntityKeys.length ?? 0;
  let narratorBackup = "";
  let narratorChanged = false;
  if (narratorLinks) {
    narratorBackup = backup.replace(/\.sqlite$/i, ".channel.json");
    if (narratorBackup === backup) narratorBackup += ".channel.json";
    fs.copyFileSync(scope.file, narratorBackup, fs.constants.COPYFILE_EXCL);
  }
  let result;
  try {
    if (narratorLinks) {
      // These exact keys point into the Universe being deleted. Keep the
      // narrator's name, perspective and editorial notes; never guess new IDs.
      channelProjects.updateProject({
        id: scope.owner.id,
        narrator: { sourceEntityKeys: [] },
      }, scope.owner.projectRoot);
      narratorChanged = true;
    }
    result = resetUniverseWorkspace(db);
  } catch (error) {
    if (narratorChanged) {
      const temporary = scope.file + ".restore-universe.tmp";
      try {
        fs.copyFileSync(narratorBackup, temporary);
        fs.renameSync(temporary, scope.file);
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], "Evren sıfırlanamadı ve anlatıcı ayarları geri yüklenemedi. Yedek dosyaları incele.");
      }
    }
    throw error;
  }
  return {
    ok: true,
    backup,
    narratorBackup,
    narratorLinksCleared: narratorLinks,
    removed: result.removed,
    after: status(db),
  };
}

module.exports = { CONFIRMATION, databaseFile, reset, status };
