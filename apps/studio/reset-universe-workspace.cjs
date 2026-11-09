const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { snapshot } = require("./studio-universe-reset.cjs");
const maintenance = require("./universe-maintenance.cjs");

const CONFIRM_FLAG = "--confirm-reset-universe";

function databasePathFromArgs(args) {
  const index = args.indexOf("--database");
  if (index >= 0 && args[index + 1]) return path.resolve(args[index + 1]);
  return path.resolve(process.cwd(), "local-data/studio/channel-foundry-studio.sqlite");
}

function formatCounts(values) {
  return Object.entries(values)
    .filter(([, count]) => count != null)
    .map(([name, count]) => `  ${name}: ${count}`)
    .join("\n");
}

const args = process.argv.slice(2);
const databasePath = databasePathFromArgs(args);
const confirmed = args.includes(CONFIRM_FLAG);

if (!fs.existsSync(databasePath)) {
  console.error(`Studio veritabanı bulunamadı: ${databasePath}`);
  process.exit(1);
}

const db = new DatabaseSync(databasePath, { timeout: 5000 });
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA journal_mode = WAL;");

try {
  const before = snapshot(db);
  console.log(`Studio veritabanı: ${databasePath}`);
  console.log("\nSİLİNECEK EVREN TÜREV VERİLERİ");
  console.log(formatCounts(before.reset) || "  kayıt yok");
  console.log("\nKORUNACAK ÇÖZÜMLEME / AYIKLAMA / KAYNAK VERİLERİ");
  console.log(formatCounts(before.preserved) || "  kayıt yok");

  if (!confirmed) {
    console.log("\nHenüz hiçbir veri silinmedi.");
    console.log("AI çözümlemeleri, Ayıklama kararları, sponsor/katkı kayıtları, katalog ve altyazılar korunur.");
    console.log("Evrene daha önce işlenmiş kaynak kilitleri kaldırılır; Ayıklama yeniden düzenlenebilir ve tüm ayıklanmış kaynaklar yeni Evrene İşleme turuna tekrar girebilir.");
    console.log(`Studio kapalıyken gerçekten Evren çalışma alanını sıfırlamak için:\n  node apps/studio/reset-universe-workspace.cjs ${CONFIRM_FLAG}`);
    process.exitCode = 0;
  } else {
    const result = maintenance.reset(db, path.dirname(databasePath), { confirmation: maintenance.CONFIRMATION });
    console.log(`\nYedek oluşturuldu: ${result.backup}`);
    if (result.narratorLinksCleared) console.log(`Anlatıcıdaki eski Evren kimliği eşlemeleri temizlendi (${result.narratorLinksCleared}); ayar yedeği: ${result.narratorBackup}`);
    console.log("\nTEMİZLENEN EVREN KAYITLARI");
    console.log(formatCounts(result.removed) || "  kayıt yok");
    console.log("\nKORUNAN VERİLER");
    console.log(formatCounts(result.after.preserved) || "  kayıt yok");
    console.log("\nEvren çalışma alanı yeniden oluşturmaya hazır. Mevcut canlı Web yayını bu işlem tarafından değiştirilmez.");
  }
} finally {
  db.close();
}
