const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const webConnection = require("./web-connection.cjs");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "channel-foundry-web-connection-"));
try {
  webConnection.configure(root);
  const activeProject = require("./channel-projects.cjs").activeProject();
  assert.equal(webConnection.getConfig().url, activeProject?.webUrl || webConnection.DEFAULT_WEB_URL);
  assert.equal(webConnection.normalizeWebUrl("example.com/"), "https://example.com");
  assert.equal(webConnection.normalizeWebUrl("http://localhost:5173/preview/"), "http://localhost:5173/preview");
  assert.throws(() => webConnection.normalizeWebUrl("http://example.com"), /HTTPS/);
  assert.throws(() => webConnection.normalizeWebUrl("file:///tmp/site"), /HTTP/);
  assert.equal(webConnection.normalizeYoutubeChannelUrl("youtube.com/@Example/videos"), "https://www.youtube.com/@Example");
  assert.throws(() => webConnection.normalizeYoutubeChannelUrl("https://example.com/@Example"), /YouTube/);

  const saved = webConnection.saveConfig({
    url: "https://example.com/channel-foundry/",
    youtubeChannelUrl: "https://www.youtube.com/@Example/videos",
  });
  assert.equal(saved.url, activeProject?.webUrl || "https://example.com/channel-foundry");
  assert.equal(saved.youtubeChannelUrl, activeProject?.youtubeChannelUrl || "https://www.youtube.com/@Example");
  assert.equal(saved.endpoints.community, new URL("api/community/", (activeProject?.webUrl || "https://example.com/channel-foundry") + "/").toString());
  assert.equal(saved.endpoints.studio, new URL("api/studio/", (activeProject?.webUrl || "https://example.com/channel-foundry") + "/").toString());
  assert.equal(saved.endpoints.publicationAsset, new URL("api/studio/asset.php", (activeProject?.webUrl || "https://example.com/channel-foundry") + "/").toString());
  assert.equal(saved.endpoints.publication, new URL("content/publication.json", (activeProject?.webUrl || "https://example.com/channel-foundry") + "/").toString());
  assert.equal(webConnection.youtubeChannelUrl(), activeProject?.youtubeChannelUrl || "https://www.youtube.com/@Example");
  // production default boş olmalı
  assert.equal(webConnection.DEFAULT_YOUTUBE_CHANNEL_URL, "");
  const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "channel-foundry-web-connection-empty-"));
  try {
    webConnection.configure(emptyRoot);
    assert.equal(webConnection.youtubeChannelUrl(), activeProject?.youtubeChannelUrl || "");
    assert.equal(webConnection.getConfig().youtubeChannelUrl, activeProject?.youtubeChannelUrl || "");
  } finally {
    fs.rmSync(emptyRoot, { recursive: true, force: true });
    webConnection.configure(root);
  }
  assert.equal(fs.statSync(path.join(root, "web-connection.json")).mode & 0o777, 0o600);
  console.log("custom web connection configuration ready");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
