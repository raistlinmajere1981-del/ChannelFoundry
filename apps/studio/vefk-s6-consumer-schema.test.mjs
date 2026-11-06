import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import core from "./vefk-core/index.cjs";
import fixtures from "./vefk-s6-fixtures.cjs";
import * as canonical from "../../docs/contracts/vefk-site-consumer.mjs";
import * as site from "../../channels/birdesengor/web/src/vefk/vefk-site-consumer.mjs";

test("S6 canonical and deployed consumer stay byte-identical", () => {
  assert.deepEqual(fs.readFileSync(new URL("../../docs/contracts/vefk-site-consumer.mjs", import.meta.url)),
    fs.readFileSync(new URL("../../channels/birdesengor/web/src/vefk/vefk-site-consumer.mjs", import.meta.url)));
});
test("S6 consumer accepts a new v1 fixture without mutating its document or frames", async () => {
  const raw = fixtures.fixture(), before = structuredClone(raw);
  const result = await canonical.readVefkPublication(raw);
  assert.equal(result.status, "ready");
  assert.deepEqual(raw, before);
  const doc = result.entries[0].document;
  for (const time of [0, 1, 350, 700, 750, doc.drawPlan.durationMs]) {
    assert.deepEqual(canonical.createVefkPlayer(doc).frameAt(time), site.createVefkPlayer(doc).frameAt(time));
  }
});
for (const [name, mutate] of fixtures.schemaAttacks) {
  test(`S6 v1 fail-closed with consistent hashes: ${name}`, async () => {
    const raw = fixtures.fixture(), doc = raw.vefkCatalog.entries[0].document;
    mutate(doc); fixtures.rehash(raw);
    assert.throws(() => core.validateVefk(doc), `S1 must reject ${name}`);
    for (const consumer of [canonical, site]) {
      assert.throws(() => consumer.createVefkPlayer(doc), name);
      await assert.rejects(consumer.readVefkPublication(raw), undefined, name);
    }
  });
}
