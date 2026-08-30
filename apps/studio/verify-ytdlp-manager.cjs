const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const manager = require("./ytdlp-manager.cjs");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "channel-foundry-ytdlp-settings-"));

(async () => {
  try {
    manager.configure(root, () => undefined);
    assert.deepEqual(manager.mediaOptions(), {
      metadataLanguage: "tr",
      subtitleLanguages: ["tr", "en"],
      thumbnailSize: "standard",
    });
    await manager.saveOptions({ autoCheck: true, autoUpdate: false });
    assert.deepEqual(manager.mediaOptions(), {
      metadataLanguage: "tr",
      subtitleLanguages: ["tr", "en"],
      thumbnailSize: "standard",
    });
    const status = await manager.status();
    assert.equal(status.autoCheck, true);
    assert.equal(status.autoUpdate, false);
    console.log("yt-dlp tool preferences remain global while media preferences stay channel-owned");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
