"use strict";
const assert = require("node:assert/strict");
const { resolveYoutubeSyncChannel } = require("./youtube-sync-source.cjs");
const expected = "https://www.youtube.com/@BirDeSenGor";
const playlist = "https://www.youtube.com/playlist?list=PL1234567890123456";
const project = { youtubeChannelUrl: expected, youtubePlaylistUrl: "" };
const db = {};
function fakeCatalog(start = null) {
  const state = { active: start, addCalls: 0, lastArgs: null, sourceChecks: 0 };
  return {
    state,
    normalizeChannelUrl: (url) => url,
    normalizePlaylistUrl: (url) => url,
    activeChannel: () => state.active,
    async addChannel(_db, args) {
      state.addCalls++;
      state.lastArgs = args;
      state.active = { id: "UC_REAL", url: args.url, playlistUrl: args.playlistUrl, active: true };
      return { channel: state.active, created: true };
    },
  };
}
async function main() {
  const fresh = fakeCatalog();
  const progress = [];
  const attached = await resolveYoutubeSyncChannel({
    catalog: fresh, project, db, onProgress: (p) => progress.push(p),
  });
  assert.equal(attached.id, "UC_REAL");
  assert.equal(fresh.state.addCalls, 1);
  assert.deepEqual(fresh.state.lastArgs, { url: expected, playlistUrl: "" });
  assert.match(progress[0].currentTitle, /bağlanıyor/);
  const attachedAgain = await resolveYoutubeSyncChannel({ catalog: fresh, project, db });
  assert.equal(attachedAgain.id, attached.id);
  assert.equal(fresh.state.addCalls, 1, "Existing connected channel must not be re-added");

  const activeDifferent = fakeCatalog({ id: "UC_OTHER", url: "https://www.youtube.com/@Other", playlistUrl: "" });
  await assert.rejects(resolveYoutubeSyncChannel({ catalog: activeDifferent, project, db }), /farklı/);
  assert.equal(activeDifferent.state.addCalls, 0, "Existing different channel must not be overwritten");

  const activePlaylist = fakeCatalog({ id: "UC_REAL", url: expected, playlistUrl: "" });
  await assert.rejects(resolveYoutubeSyncChannel({
    catalog: activePlaylist, project: { ...project, youtubePlaylistUrl: playlist }, db,
  }), /farklı/);
  assert.equal(activePlaylist.state.addCalls, 0);

  const newPlaylist = fakeCatalog();
  await resolveYoutubeSyncChannel({
    catalog: newPlaylist, project: { ...project, youtubePlaylistUrl: playlist }, db,
  });
  assert.equal(newPlaylist.state.lastArgs.playlistUrl, playlist);

  await assert.rejects(resolveYoutubeSyncChannel({
    catalog: fakeCatalog(), project: {}, db,
  }), /YouTube kanal adresini/);

  const canceled = fakeCatalog();
  await assert.rejects(resolveYoutubeSyncChannel({
    catalog: canceled, project, db, signal: { aborted: true },
  }), (e) => e.code === "CHANNEL_FOUNDRY_SYNC_CANCELLED");
  assert.equal(canceled.state.addCalls, 0);
  console.log("First synchronization: project auto-connect, repeat, playlist, mismatch and cancellation PASS");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
