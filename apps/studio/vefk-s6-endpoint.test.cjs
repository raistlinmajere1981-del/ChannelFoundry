"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const net = require("node:net");
const {spawn} = require("node:child_process");
const {once} = require("node:events");
const {setTimeout: delay} = require("node:timers/promises");
const {runPhp} = require("./vefk-s6-php-runner.cjs");
const {fixture, v2Fixture, v2Attacks, rehash, rehashTop, sha, schemaAttacks} = require("./vefk-s6-fixtures.cjs");
const repo = path.resolve(__dirname, "../..");
const endpoint = path.join(repo, "channels/birdesengor/web/public/api/studio");

function php(args, options) {
  const result = runPhp(args, {encoding: "utf8", timeout: 10000, maxBuffer: 48 * 1024 * 1024, ...options});
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "", result.stderr);
  return result.stdout;
}
function snapshot(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).sort((a,b) => a.name.localeCompare(b.name)).flatMap(item => {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) return snapshot(file).map(([name,...rest]) => [item.name + "/" + name,...rest]);
    const stat = fs.statSync(file, {bigint: true});
    return [[item.name, sha(fs.readFileSync(file)), String(stat.mtimeNs), String(stat.mode)]];
  });
}
function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vefk-s6-endpoint-"));
  let httpServer;
  t.after(async () => {
    if (httpServer && httpServer.exitCode === null && httpServer.signalCode === null) {
      const stopped = once(httpServer, "exit");
      httpServer.kill();
      await stopped;
    }
    fs.rmSync(root, {recursive: true, force: true});
  });
  const shipped = path.join(root, "site/api/studio");
  // Exercise a portable deployed layout with no repository docs/ available.
  fs.cpSync(endpoint, shipped, {recursive: true});
  const storage = path.join(root, "storage"), content = path.join(storage, "content"), assets = path.join(content, "assets");
  fs.mkdirSync(assets, {recursive: true});
  fs.writeFileSync(path.join(content, "publication.json"), '{"previous":"publication"}\n');
  fs.writeFileSync(path.join(content, "community-credits.json"), '{"previous":"credits"}\n');
  fs.writeFileSync(path.join(assets, "kept.png"), "synthetic kept bytes");
  fs.writeFileSync(path.join(assets, "orphan.png"), "must survive every failed request");
  const database = path.join(storage, "community.sqlite");
  const env = {...process.env, CHANNEL_FOUNDRY_COMMUNITY_DB: database,
    CHANNEL_FOUNDRY_PUBLICATION_CONTENT_DIR: content, CHANNEL_FOUNDRY_PUBLICATION_ASSET_DIR: assets};
  const password = "isolated-s6-test-password";
  php(["-r", `
    $password=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
    $db=new PDO('sqlite:'.getenv('CHANNEL_FOUNDRY_COMMUNITY_DB'));
    $db->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, display_name TEXT, password_hash TEXT, role TEXT, status TEXT)');
    $stmt=$db->prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)');
    $hash=password_hash($password,PASSWORD_DEFAULT);
    foreach ([[1,'admin','admin','active'],[2,'reader','member','active'],[3,'suspended','admin','suspended']] as $u)
      $stmt->execute([$u[0],$u[1],$u[1],$hash,$u[2],$u[3]]);
  `], {env, input: JSON.stringify(password)});
  function request(raw = fixture(), options = {}) {
    const body = options.body ?? JSON.stringify({publication: raw});
    const server = {REQUEST_METHOD: options.method ?? "POST"};
    if (!options.noContentLength) server.CONTENT_LENGTH = String(options.contentLength ?? Buffer.byteLength(body));
    if (options.user !== null) server.HTTP_AUTHORIZATION = "Basic " + Buffer.from(
      `${options.user ?? "admin"}:${options.password ?? password}`).toString("base64");
    const resultFile = path.join(root, "response-status.json");
    const output = php([path.join(__dirname, "vefk-s6-endpoint-harness.php")], {env, cwd: root,
      input: JSON.stringify({body, server, query: {action: options.action ?? "publish"}, resultFile,
        handler: path.join(shipped, "index.php")})});
    return {...JSON.parse(fs.readFileSync(resultFile, "utf8")), response: JSON.parse(output)};
  }
  function withAsset(raw = fixture()) {
    const bytes = fs.readFileSync(path.join(assets, "kept.png"));
    raw.assets.push({assetId: "s6-asset", url: "assets/kept.png", sha256: sha(bytes), bytes: bytes.length});
    return raw.vefkCatalog ? rehash(raw) : rehashTop(raw);
  }
  function rejected(raw, options = {}, status = 422, reads = 1) {
    const before = snapshot(storage);
    const result = request(raw, options);
    assert.equal(result.status, status, JSON.stringify(result));
    assert.equal(result.response.ok, false);
    assert.equal(result.inputReads, reads, "one input read, after auth and declared-size checks");
    assert.deepEqual(snapshot(storage), before, "all publication/credits/assets/DB bytes and metadata must survive");
    return result;
  }
  async function startHttp() {
    const reservation = net.createServer();
    reservation.listen(0, "127.0.0.1");
    await once(reservation, "listening");
    const {port} = reservation.address();
    await new Promise(resolve => reservation.close(resolve));
    // Only this copied endpoint and disposable SQLite/content are reachable.
    // Allow the SAPI to receive >16MiB so the application's own limit is tested.
    httpServer = spawn("php", ["-d", "post_max_size=32M", "-d", "display_errors=0",
      "-S", `127.0.0.1:${port}`, "-t", path.join(root, "site")],
      {env, cwd: root, stdio: ["ignore", "ignore", "pipe"]});
    let log = "", launchError;
    httpServer.stderr.on("data", bytes => {log = (log + bytes).slice(-4000);});
    httpServer.on("error", error => {launchError = error;});
    function httpRequest(raw = fixture(), options = {}) {
      const body = options.body ?? JSON.stringify({publication: raw});
      const headers = {"Content-Type": "application/json"};
      if (!options.chunked) headers["Content-Length"] = Buffer.byteLength(body);
      if (options.user !== null) headers.Authorization = "Basic " + Buffer.from(
        `${options.user ?? "admin"}:${options.password ?? password}`).toString("base64");
      return new Promise((resolve, reject) => {
        const req = http.request({hostname: "127.0.0.1", port, method: options.method ?? "POST",
          path: `/api/studio/?action=${options.action ?? "publish"}`, headers, agent: false}, res => {
          let output = "";
          res.setEncoding("utf8");
          res.on("data", bytes => {output += bytes;});
          res.on("error", reject);
          res.on("end", () => {
            try {resolve({status: res.statusCode, response: JSON.parse(output)});}
            catch (error) {reject(new Error(`Invalid HTTP JSON (${res.statusCode}): ${output}`, {cause: error}));}
          });
        });
        req.on("error", reject);
        req.setTimeout(10000, () => req.destroy(new Error("S6 local HTTP timeout")));
        if (options.chunked) req.write(body);
        req.end(options.chunked ? undefined : body);
      });
    }
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (launchError) throw launchError;
      if (httpServer.exitCode !== null) throw new Error(`Local PHP exited: ${log}`);
      try {
        const health = await httpRequest(undefined, {method: "GET", action: "health", body: ""});
        ready = health.status === 200 && health.response.ok === true;
        if (ready) break;
      } catch {}
      await delay(25);
    }
    assert.ok(ready, `Local PHP did not become ready: ${log}`);
    async function httpRejected(raw, options = {}, status = 422) {
      const before = snapshot(storage);
      const result = await httpRequest(raw, options);
      assert.equal(result.status, status, JSON.stringify(result));
      assert.equal(result.response.ok, false);
      assert.deepEqual(snapshot(storage), before, "HTTP rejection must preserve publication/credits/assets/DB bytes and metadata");
      return result;
    }
    return {request: httpRequest, rejected: httpRejected};
  }
  return {root, content, assets, request, rejected, withAsset, storage, startHttp};
}

test("S6 installed gate is byte-identical to the reference", () => {
  assert.deepEqual(fs.readFileSync(path.join(endpoint, "vefk-s6-php-gate.php")),
    fs.readFileSync(path.join(repo, "docs/contracts/vefk-s6-php-gate.php")));
});
test("S6 shipped PHP sources have server-readable 644 permissions", () => {
  for (const name of ["bootstrap.php", "index.php", "publication.php", "publication-vefk.php", "vefk-s6-php-gate.php"]) {
    assert.equal(fs.statSync(path.join(endpoint, name)).mode & 0o777, 0o644, name);
  }
});
test("S6 real handler accepts a new catalog and retains JSON objects and valid stored hashes", async t => {
  const fx = setup(t), raw = fx.withAsset();
  const result = fx.request(raw);
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(result.inputReads, 1);
  assert.equal(result.response.published, true);
  assert.equal(result.response.admin.username, "admin");
  const stored = JSON.parse(fs.readFileSync(path.join(fx.content, "publication.json"), "utf8"));
  assert.deepEqual(stored, raw);
  assert.deepEqual(stored.archive.entities[0].visual, {});
  const {readVefkPublication} = await import("../../docs/contracts/vefk-site-consumer.mjs");
  assert.equal((await readVefkPublication(stored)).status, "ready");
  assert.equal(result.response.sha256, sha(fs.readFileSync(path.join(fx.content, "publication.json"))));
  assert.ok(fs.existsSync(path.join(fx.assets, "kept.png")));
  assert.ok(!fs.existsSync(path.join(fx.assets, "orphan.png")), "successful requests still clean assets");
  // Prove a later rejected publish retains an actual previously accepted one.
  const corrupt = structuredClone(raw); corrupt.vefkCatalog.entries[0].document.drawPlan.strokes[0].easing = "ease-in";
  rehash(corrupt); fx.rejected(corrupt);
});
test("S6 real handler keeps legacy behavior for publications without Vefk", t => {
  const fx = setup(t), raw = fx.withAsset(); delete raw.vefkCatalog;
  raw.publication.contentFingerprint = "b".repeat(64); // legacy does not recalculate it
  const result = fx.request(raw);
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(result.inputReads, 1);
  const stored = JSON.parse(fs.readFileSync(path.join(fx.content, "publication.json"), "utf8"));
  assert.equal(stored.vefkCatalog, undefined);
  assert.equal(stored.publication.contentFingerprint, raw.publication.contentFingerprint);
  assert.deepEqual(stored.archive.entities[0].visual, []); // historical associative serialization
  assert.ok(fs.existsSync(path.join(fx.assets, "kept.png")));
  assert.ok(!fs.existsSync(path.join(fx.assets, "orphan.png")));
});
test("S6 handler rejects every rehashed v1 schema attack before writing or cleaning", t => {
  const fx = setup(t);
  for (const [name, mutate] of schemaAttacks) {
    const raw = fx.withAsset(); mutate(raw.vefkCatalog.entries[0].document); rehash(raw);
    const result = fx.rejected(raw);
    assert.equal(result.response.error, "invalid_vefk_publication", name);
  }
});
test("S6 handler rejects catalog/hash/binding/URL/type/semantic attacks without writing", t => {
  const fx = setup(t);
  for (const mutate of [
    r => {r.vefkCatalog.entries[0].document.title = "tampered";},
    r => {r.vefkCatalog.fingerprint = "0".repeat(64); rehashTop(r);},
    r => {r.vefkCatalog.binding.pen.anchorId = "forged.tip"; rehash(r);},
    r => {r.vefkCatalog.binding.bindingVersion = 1;
      r.vefkCatalog.binding.surface = {objectId: "parchment", anchorId: "parchment.ink-plane"}; rehash(r);},
    r => {r.vefkCatalog.binding.surface = {objectId: "parchment", anchorId: "parchment.ink-plane"}; rehash(r);},
    r => {rehash(r); r.vefkCatalog.entries[0].url = "../outside.json";
      const {fingerprint,...meaning} = r.vefkCatalog; r.vefkCatalog.fingerprint = sha(JSON.stringify(require("./vefk-core/index.cjs").canonical(meaning))); rehashTop(r);},
    r => {r.vefkCatalog.entries[0].revision++; rehashTop(r);},
    r => {r.vefkCatalog.entries = {}; rehashTop(r);},
    r => {r.vefkCatalog = []; rehashTop(r);},
    r => {r.vefkCatalog = false; rehashTop(r);},
    r => {r.vefkCatalog.entries[0].document.geometry.paths[0].d = "M 0 0 L 1 1 onclick=bad"; rehash(r);},
    r => {r.vefkCatalog.entries[0].document.construction.grid[0][0] = 42; rehash(r);},
    r => {r.archive.entities[0].visual = [];}, // {} is not [] for the top hash
  ]) {
    const raw = fx.withAsset(); mutate(raw); fx.rejected(raw);
  }
});
test("S6 handler preserves real Basic auth and rejects before reading a body", t => {
  const fx = setup(t);
  for (const [options,status] of [
    [{user: null},401], [{password: "wrong"},401], [{user: "reader"},403], [{user: "suspended"},403],
  ]) fx.rejected(undefined, {...options, body: "malformed JSON"}, status, 0);
  fx.rejected(undefined, {method: "GET"}, 405, 0);
  fx.rejected(undefined, {action: "unknown"}, 404, 0);
});
test("S6 handler enforces actual and declared 16MiB limits, malformed JSON and depth", t => {
  const fx = setup(t), max = 16 * 1024 * 1024;
  fx.rejected(undefined, {body: "{}", contentLength: max + 1}, 413, 0);
  const body = JSON.stringify({publication: fixture()});
  const exact = body + " ".repeat(max - Buffer.byteLength(body));
  const accepted = fx.request(undefined, {body: exact});
  assert.equal(accepted.status, 200, JSON.stringify(accepted));
  fx.rejected(undefined, {body: exact + " ", noContentLength: true}, 413);
  fx.rejected(undefined, {body: exact + " ", contentLength: 2}, 413);
  for (const invalid of ["", "{", '{"publication":', "null", "[[[[", "[".repeat(513) + "]".repeat(513)]) {
    fx.rejected(undefined, {body: invalid}, 400);
  }
  fx.rejected(undefined, {body: '{"publication":[]}'}, 422);
});
test("S6 legacy asset and physical-layout gates still run before the Vefk gate", t => {
  const fx = setup(t);
  const wrongAsset = fx.withAsset(); wrongAsset.assets[0].sha256 = "0".repeat(64); rehash(wrongAsset);
  assert.equal(fx.rejected(wrongAsset, {}, 409).response.error, "asset_hash_mismatch");
  const layout = fx.withAsset(); layout.journal.page = 1; rehash(layout);
  assert.equal(fx.rejected(layout).response.error, "physical_layout_forbidden");
});

test("S6 loopback HTTP publishes typed JSON and rejects all rehashed schema attacks without writes", async t => {
  const fx = setup(t), transport = await fx.startHttp(), raw = fx.withAsset();
  const result = await transport.request(raw);
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(result.response.published, true);
  assert.equal(result.response.admin.username, "admin");
  const file = path.join(fx.content, "publication.json");
  const stored = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.deepEqual(stored, raw); // includes {}, [] and all nested JSON types
  const {readVefkPublication} = await import("../../docs/contracts/vefk-site-consumer.mjs");
  assert.equal((await readVefkPublication(stored)).status, "ready");
  assert.equal(result.response.sha256, sha(fs.readFileSync(file)));
  assert.ok(fs.existsSync(path.join(fx.assets, "kept.png")));
  assert.ok(!fs.existsSync(path.join(fx.assets, "orphan.png")));
  fs.writeFileSync(path.join(fx.assets, "orphan.png"), "preserve after a successful publish too");
  for (const [name, mutate] of schemaAttacks) {
    const bad = structuredClone(raw); mutate(bad.vefkCatalog.entries[0].document); rehash(bad);
    const rejected = await transport.rejected(bad);
    assert.equal(rejected.response.error, "invalid_vefk_publication", name);
  }
  const wrongType = structuredClone(raw); wrongType.archive.entities[0].visual = [];
  await transport.rejected(wrongType); // stale object hash cannot survive {} -> []
  rehashTop(wrongType);
  assert.equal((await transport.request(wrongType)).status, 200);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")).archive.entities[0].visual, []);
});
test("S4b loopback HTTP accepts mixed v2 and multi-M/Z with typed JSON, denies bad contracts and roles without writes", async t => {
  const fx = setup(t), transport = await fx.startHttp();
  const {readVefkPublication, createVefkPlayer} = await import("../../docs/contracts/vefk-site-consumer.mjs");
  for (const options of [{}, {manual: true}, {manual: true, easing: "omitted"}]) {
    const raw = fx.withAsset(v2Fixture(options));
    const accepted = await transport.request(raw);
    assert.equal(accepted.status, 200, JSON.stringify(accepted));
    const bytes = fs.readFileSync(path.join(fx.content, "publication.json"));
    const stored = JSON.parse(bytes);
    assert.deepEqual(stored, raw);
    assert.deepEqual(stored.archive.entities[0].visual, {});
    assert.deepEqual(stored.youtubeAnalysis, {});
    assert.deepEqual(stored.vefkCatalog.entries.at(-1).document.provenance.references, []);
    if (options.manual) assert.deepEqual(stored.vefkCatalog.entries.at(-1).document.construction.parameters, {});
    assert.equal(accepted.response.sha256, sha(bytes));
    const read = await readVefkPublication(stored);
    assert.equal(read.status, "ready");
    const doc = read.entries.at(-1).document;
    assert.deepEqual(createVefkPlayer(doc).frameAt(350), createVefkPlayer(raw.vefkCatalog.entries.at(-1).document).frameAt(350));
  }
  fs.writeFileSync(path.join(fx.assets, "orphan.png"), "must survive all v2 rejections");
  for (const [name, mutate] of v2Attacks) {
    const raw = fx.withAsset(v2Fixture()); mutate(raw); rehash(raw);
    assert.equal((await transport.rejected(raw)).response.error, "invalid_vefk_publication", name);
  }
  for (const mutate of [
    r => {r.vefkCatalog.entries.at(-1).document.contentHash = "0".repeat(64);},
    r => {r.vefkCatalog.entries.at(-1).sha256 = "0".repeat(64);},
    r => {r.vefkCatalog.fingerprint = "0".repeat(64);},
    r => {r.vefkCatalog.entries = Array(33).fill(r.vefkCatalog.entries[0]);},
    r => {r.vefkCatalog.entries.at(-1).document.description = "x".repeat(5 * 1024 * 1024);},
  ]) {
    const raw = fx.withAsset(v2Fixture()); mutate(raw); rehashTop(raw);
    await transport.rejected(raw);
  }
  const badTop = fx.withAsset(v2Fixture()); badTop.publication.contentFingerprint = "0".repeat(64);
  await transport.rejected(badTop);
  const raw = fx.withAsset(v2Fixture({manual: true}));
  await transport.rejected(raw, {user: "reader"}, 403);
  await transport.rejected(raw, {user: "suspended"}, 403);
  await transport.rejected(raw, {user: null}, 401);
  const typed = structuredClone(raw); typed.archive.entities[0].visual = [];
  await transport.rejected(typed);
  rehashTop(typed);
  assert.equal((await transport.request(typed)).status, 200);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(fx.content, "publication.json"))).archive.entities[0].visual, []);
});
test("S6 loopback HTTP retains Basic role auth and request error statuses with zero writes", async t => {
  const fx = setup(t), transport = await fx.startHttp();
  for (const [options, status] of [
    [{user: null}, 401], [{password: "wrong"}, 401], [{user: "reader"}, 403],
    [{user: "suspended"}, 403], [{method: "GET"}, 405], [{action: "unknown"}, 404],
  ]) await transport.rejected(undefined, {...options, body: "malformed JSON"}, status);
  for (const body of ["", "{", "null", "[".repeat(513) + "]".repeat(513)]) {
    await transport.rejected(undefined, {body}, 400);
  }
  await transport.rejected(undefined, {body: '{"publication":[]}'}, 422);
});
test("S6 loopback HTTP enforces the exact 16MiB boundary for sized and chunked bodies", async t => {
  const fx = setup(t), transport = await fx.startHttp(), max = 16 * 1024 * 1024;
  const body = JSON.stringify({publication: fx.withAsset()});
  const exact = body + " ".repeat(max - Buffer.byteLength(body));
  assert.equal((await transport.request(undefined, {body: exact})).status, 200);
  await transport.rejected(undefined, {body: exact + " "}, 413);
  await transport.rejected(undefined, {body: exact + " ", chunked: true}, 413);
});
test("S6 loopback HTTP preserves legacy asset/layout gates and Vefk-free publishing", async t => {
  const fx = setup(t), transport = await fx.startHttp();
  const asset = fx.withAsset(); asset.assets[0].sha256 = "0".repeat(64); rehash(asset);
  assert.equal((await transport.rejected(asset, {}, 409)).response.error, "asset_hash_mismatch");
  const layout = fx.withAsset(); layout.journal.page = 1; rehash(layout);
  assert.equal((await transport.rejected(layout)).response.error, "physical_layout_forbidden");
  const raw = fx.withAsset(); delete raw.vefkCatalog;
  const result = await transport.request(rehashTop(raw));
  assert.equal(result.status, 200);
  assert.equal(JSON.parse(fs.readFileSync(path.join(fx.content, "publication.json"), "utf8")).vefkCatalog, undefined);
});
