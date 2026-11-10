"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { SceneWorkshop, digest, validateIdentity } = require("./scene-workshop.cjs");

function mockSite(original) {
  let scene = structuredClone(original), sourceHash = "source-initial";
  const source = {
    async snapshot() { return { scene: structuredClone(scene), sourceHash }; },
    validate(value) {
      validateIdentity(value);
      if (value.effects.length !== original.effects.length ||
          value.objects.length !== original.objects.length) throw new Error("Effect inventory changed.");
    },
    readiness(value) { return { ready: true, effectCount: value.effects.length,
      enabledCount: value.effects.filter(item => item.enabled).length,
      mountedCount: value.effects.length, problems: [] }; },
    async preview() { return "data:image/webp;base64,UklGR"; },
    previewObjects() { return []; },
    async stage(value, expectedSourceHash) {
      if (expectedSourceHash !== sourceHash) throw new Error("Source drift.");
      const changed = digest(scene) !== digest(value);
      scene = structuredClone(value);
      sourceHash = "source-" + digest(scene);
      return { changed, sourceHash, readiness: this.readiness(scene) };
    },
    drift() { sourceHash += "-changed"; },
    scene() { return structuredClone(scene); },
  };
  return source;
}
function sandbox(source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-scene-workshop-"));
  const calls = [];
  let dryRunFails = false;
  const runner = {};
  for (const name of ["build", "plan", "dryRun", "deploy", "verifyLive"]) {
    runner[name] = async () => {
      calls.push(name);
      if (name === "dryRun" && dryRunFails) throw new Error("FTPS not configured");
    };
  }
  return { dir, calls, source, runner,
    service: new SceneWorkshop({ userDataDir: dir, site: source, runner }),
    failDryRun(value) { dryRunFails = value; },
    cleanup() { fs.rmSync(dir, { recursive: true, force: true }); } };
}

test("Channel Foundry reads canonical live scene without writing web or Admin data", async () => {
  const { siteSceneSource, BIRDESENGOR_SITE } = await import("./scene-workshop-site.mjs");
  const site = siteSceneSource();
  const current = await site.snapshot();
  assert.ok(BIRDESENGOR_SITE.endsWith("/ChannelFoundry/channels/birdesengor/web"));
  assert.equal(current.scene.sceneId, "birdesengor-study-v2");
  assert.equal(current.scene.effects.length, 13);
  assert.deepEqual(site.readiness(current.scene, current), {
    ready: true, effectCount: 13, enabledCount: 13, mountedCount: 13, problems: [],
  });
  validateIdentity(current.scene);
  const valid = structuredClone(current.scene);
  valid.sceneId = "unexpected";
  assert.throws(() => validateIdentity(valid), /kanonik V2/);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "cf-scene-check-source-"));
  try {
    const service = new SceneWorkshop({ userDataDir: temporary, site, runner: {} });
    const loaded = await service.load();
    assert.equal(loaded.origin, "site");
    assert.equal(loaded.readiness.effectCount, 13);
    assert.match(loaded.previewImage, /^data:image\/webp;base64,/);
    assert.ok(Array.isArray(loaded.previewObjects));
    await assert.rejects(service.save({
      scene: loaded.scene, expectedSourceHash: "obsolete",
    }), /Web sahnesi değişmiş/);
    assert.equal(fs.existsSync(path.join(temporary, "scene-workshop")), false);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

test("draft persists only in Studio, stage is separate, publication is explicitly token-gated", async () => {
  const { siteSceneSource } = await import("./scene-workshop-site.mjs");
  const original = (await siteSceneSource().snapshot()).scene;
  const state = sandbox(mockSite(original));
  try {
    const loaded = await state.service.load();
    assert.equal(loaded.origin, "site");
    const changed = structuredClone(loaded.scene);
    changed.name = changed.name === "BirDeSenGör" ? "Sahne" : "BirDeSenGör";
    const saved = await state.service.save({ scene: changed, expectedSourceHash: loaded.sourceHash });
    assert.equal(saved.ok, true);
    const draftFile = path.join(state.dir, "scene-workshop", "birdesengor-scene-v2.json");
    assert.equal(fs.existsSync(draftFile), true);
    assert.deepEqual(state.calls, [], "Saving never publishes or builds");
    assert.equal((await state.service.load()).origin, "draft");
    await assert.rejects(state.service.preflight(), /Siteye hazırla/);
    const staged = await state.service.prepare();
    assert.equal(staged.changed, true);
    assert.deepEqual(state.calls, [], "Staging never performs a network operation");
    assert.deepEqual(state.source.scene(), changed);
    const gate = await state.service.preflight();
    assert.match(gate.token, /^[a-f0-9-]{36}$/i);
    assert.deepEqual(state.calls, ["build", "plan", "dryRun"]);
    await assert.rejects(state.service.deploy({ token: "wrong" }), /Yayın onayı geçersiz/);
    await assert.rejects(state.service.deploy({ token: gate.token }), /Yayın onayı geçersiz/);
    const second = await state.service.preflight();
    assert.deepEqual(state.calls.slice(-3), ["build", "plan", "dryRun"]);
    const released = await state.service.deploy({ token: second.token });
    assert.equal(released.ok, true);
    assert.deepEqual(state.calls.slice(-3), ["build", "deploy", "verifyLive"]);
    await assert.rejects(state.service.deploy({ token: second.token }), /Yayın onayı geçersiz/);
  } finally { state.cleanup(); }
});

test("failed dry-run, changed source and concurrent calls cannot deploy", async () => {
  const { siteSceneSource } = await import("./scene-workshop-site.mjs");
  const original = (await siteSceneSource().snapshot()).scene;
  const state = sandbox(mockSite(original));
  try {
    const load = await state.service.load();
    await state.service.save({ scene: load.scene, expectedSourceHash: load.sourceHash });
    await state.service.prepare();
    state.failDryRun(true);
    await assert.rejects(state.service.preflight(), /FTPS not configured/);
    await assert.rejects(state.service.deploy({ token: "guessed" }), /Yayın onayı geçersiz/);
    assert.equal(state.calls.includes("deploy"), false);
    state.failDryRun(false);
    const ready = await state.service.preflight();
    state.source.drift();
    await assert.rejects(state.service.deploy({ token: ready.token }), /kaynağı.*değişti|web sahnesi/i);
    assert.equal(state.calls.includes("deploy"), false);
    await assert.rejects(state.service.save({
      scene: original, expectedSourceHash: load.sourceHash,
    }), /Web sahnesi değişmiş/);
  } finally { state.cleanup(); }
});

test("real site source stages atomically in isolated clone and rejects a stale revision", async () => {
  const { siteSceneSource, SITE_SCENE } = await import("./scene-workshop-site.mjs");
  const actual = siteSceneSource();
  const snapshot = await actual.snapshot();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-scene-source-stage-"));
  try {
    for (const [relative, bytes] of snapshot.entries) {
      const file = path.join(temp, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
    }
    const isolated = siteSceneSource(temp);
    const source = await isolated.snapshot();
    const scene = structuredClone(source.scene);
    scene.effects[0].seed += "-isolated";
    assert.equal(isolated.readiness(scene, source).ready, true);
    const result = await isolated.stage(scene, source.sourceHash);
    assert.equal(result.changed, true);
    assert.equal((await isolated.snapshot()).sourceHash, result.sourceHash);
    assert.equal(JSON.parse(fs.readFileSync(path.join(temp, SITE_SCENE), "utf8")).effects[0].seed, scene.effects[0].seed);
    await assert.rejects(isolated.stage(scene, source.sourceHash), /Site kaynağı değişmiş/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test("concurrent edits are rejected while the release preflight is running", async () => {
  const { siteSceneSource } = await import("./scene-workshop-site.mjs");
  const original = (await siteSceneSource().snapshot()).scene;
  const state = sandbox(mockSite(original));
  let openGate, enteredGate;
  const entered = new Promise(resolve => { enteredGate = resolve; });
  const held = new Promise(resolve => { openGate = resolve; });
  state.runner.build = async () => { state.calls.push("build"); enteredGate(); await held; };
  try {
    const loaded = await state.service.load();
    await state.service.save({ scene: original, expectedSourceHash: loaded.sourceHash });
    await state.service.prepare();
    const release = state.service.preflight();
    await entered;
    await assert.rejects(state.service.save({
      scene: original, expectedSourceHash: (await state.service.load()).sourceHash,
    }), /Başka bir sahne işlemi/);
    openGate();
    const result = await release;
    assert.ok(result.token);
  } finally { openGate?.(); state.cleanup(); }
});
