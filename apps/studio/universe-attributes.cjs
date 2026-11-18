"use strict";

// Editorial metadata: kept separate from source narratives and image profiles.
const { chat, parseAssistantJson } = require("./ai-client.cjs");

const { VALID:VALID_SIDES, parse:parseSideStatus } = require("./universe-side-status.cjs");
const quality = require("./universe-attribute-quality.cjs");
const FIELDS = Object.freeze({
  character: ["sideStatus", "age", "species", "dimension", "rank"],
  object: ["type", "property", "custodian"],
  location: ["type", "position", "dimension"],
});

function transaction(db, operation) {
  db.exec("BEGIN IMMEDIATE;");
  try {
    const result = operation();
    db.exec("COMMIT;");
    return result;
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}
function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS universe_entity_attributes (
      entity_key TEXT PRIMARY KEY REFERENCES universe_workspace_nodes(key) ON DELETE CASCADE,
      fields_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) STRICT;
    CREATE TABLE IF NOT EXISTS universe_entity_attribute_proposals (
      entity_key TEXT NOT NULL REFERENCES universe_workspace_nodes(key) ON DELETE CASCADE,
      field TEXT NOT NULL,
      value TEXT NOT NULL,
      baseline TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT '',
      source_video_ids_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(entity_key, field)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS universe_entity_attribute_analysis (
      entity_key TEXT PRIMARY KEY REFERENCES universe_workspace_nodes(key) ON DELETE CASCADE,
      evaluated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      proposal_count INTEGER NOT NULL DEFAULT 0
    ) STRICT;
    CREATE TABLE IF NOT EXISTS universe_entity_attribute_evidence (
      entity_key TEXT NOT NULL REFERENCES universe_workspace_nodes(key) ON DELETE CASCADE,
      field TEXT NOT NULL,
      evidence_json TEXT NOT NULL DEFAULT '[]',
      reason TEXT NOT NULL DEFAULT '',
      PRIMARY KEY(entity_key,field)
    ) STRICT;
  `);
  // Existing Studio databases were created before evidence-backed proposals.
  if (!db.prepare("PRAGMA table_info(universe_entity_attribute_proposals)").all().some(row=>row.name==="evidence_json")) {
    db.exec("ALTER TABLE universe_entity_attribute_proposals ADD COLUMN evidence_json TEXT NOT NULL DEFAULT '[]'");
  }
}
function getNode(db, key) {
  const node = db.prepare("SELECT key,kind,name,summary,source_video_ids_json,payload_json FROM universe_workspace_nodes WHERE key=? AND state='approved'").get(key);
  if (!node || !FIELDS[node.kind]) throw new Error("Yalnız onaylı muhatap, nesne ve mekân kayıtları düzenlenebilir.");
  return node;
}
function validField(kind, field) {
  if (!FIELDS[kind]?.includes(field)) throw new Error("Bu kategori için geçersiz özellik: " + field);
}
function normalize(kind, field, value) {
  validField(kind, field);
  const text = String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 140);
  if (field === "sideStatus" && !VALID_SIDES.has(text)) throw new Error("Geçersiz taraf durumu: " + text);
  return text;
}
function values(db, key) {
  const row = db.prepare("SELECT fields_json FROM universe_entity_attributes WHERE entity_key=?").get(key);
  try { return row ? JSON.parse(row.fields_json) : {}; } catch { return {}; }
}
function publicFields(kind, fields) {
  const approved=Object.fromEntries(Object.entries(fields||{}).filter(([field,value])=>value&&FIELDS[kind]?.includes(field)));
  if(kind==="character"&&approved.sideStatus) {
    const status=parseSideStatus(approved.sideStatus);
    if(status.side)approved.side=status.side;
    if(status.formerSide)approved.formerSide=status.formerSide;
  }
  return approved;
}
function list(db) {
  ensureSchema(db);
  const profiles = db.prepare("SELECT entity_key AS entityKey,fields_json AS fieldsJson FROM universe_entity_attributes").all()
    .map(row => ({ entityKey: row.entityKey, fields: JSON.parse(row.fieldsJson) }));
  const proposals = db.prepare("SELECT entity_key AS entityKey,field,value,baseline,reason,source_video_ids_json AS sourceJson,evidence_json AS evidenceJson FROM universe_entity_attribute_proposals ORDER BY entity_key,field").all()
    .map(row => ({ entityKey: row.entityKey, field: row.field, value: row.value, baseline: row.baseline, reason: row.reason, sourceVideoIds: JSON.parse(row.sourceJson), evidence:JSON.parse(row.evidenceJson) }));
  const analyses = db.prepare("SELECT entity_key AS entityKey,evaluated_at AS evaluatedAt,proposal_count AS proposalCount FROM universe_entity_attribute_analysis").all();
  const provenance = db.prepare("SELECT entity_key AS entityKey,field,reason,evidence_json AS evidenceJson FROM universe_entity_attribute_evidence").all()
    .map(row=>({entityKey:row.entityKey,field:row.field,reason:row.reason,evidence:JSON.parse(row.evidenceJson)}));
  return { profiles, proposals, analyses, provenance };
}
function saveMany(db, input) {
  ensureSchema(db);
  const edits = input?.edits;
  if (!Array.isArray(edits) || edits.length < 1 || edits.length > 2000) throw new Error("1–2000 özellik değişikliği gerekli.");
  const duplicates = new Set();
  const prepared = edits.map(item => {
    const key = String(item?.entityKey || "").slice(0, 180);
    const node = getNode(db, key);
    const field = String(item?.field || "");
    const value = normalize(node.kind, field, item?.value);
    const identity = key + ":" + field;
    if (duplicates.has(identity)) throw new Error("Aynı hücre birden fazla değiştirilemez.");
    duplicates.add(identity);
    return { key, field, value };
  });
  return transaction(db, () => {
    const put = db.prepare("INSERT INTO universe_entity_attributes(entity_key,fields_json) VALUES (?,?) ON CONFLICT(entity_key) DO UPDATE SET fields_json=excluded.fields_json,updated_at=CURRENT_TIMESTAMP");
    const clear = db.prepare("DELETE FROM universe_entity_attribute_proposals WHERE entity_key=? AND field=?");
    const clearEvidence = db.prepare("DELETE FROM universe_entity_attribute_evidence WHERE entity_key=? AND field=?");
    const cache = new Map();
    for (const entry of prepared) {
      if (!cache.has(entry.key)) cache.set(entry.key, values(db, entry.key));
      cache.get(entry.key)[entry.field] = entry.value;
      clear.run(entry.key, entry.field);
      clearEvidence.run(entry.key, entry.field); // Manual override has no AI source provenance.
    }
    for (const [key, fields] of cache) put.run(key, JSON.stringify(fields));
    return { changed: prepared.length };
  });
}
function review(db, input) {
  ensureSchema(db);
  const action = input?.action;
  if (!["approve", "reject"].includes(action)) throw new Error("Geçersiz inceleme işlemi.");
  const items = input?.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 2000) throw new Error("Onaylanacak öneriler seçilmeli.");
  const unique = new Set();
  const prepared = items.map(item => {
    const key = String(item?.entityKey || "");
    const node = getNode(db, key);
    const field = String(item?.field || "");
    validField(node.kind, field);
    const id = key + ":" + field;
    if (unique.has(id)) throw new Error("Tekrarlanan öneri.");
    unique.add(id);
    return { key, field };
  });
  return transaction(db, () => {
    const get = db.prepare("SELECT value,baseline,reason,evidence_json FROM universe_entity_attribute_proposals WHERE entity_key=? AND field=?");
    const del = db.prepare("DELETE FROM universe_entity_attribute_proposals WHERE entity_key=? AND field=?");
    const put = db.prepare("INSERT INTO universe_entity_attributes(entity_key,fields_json) VALUES (?,?) ON CONFLICT(entity_key) DO UPDATE SET fields_json=excluded.fields_json,updated_at=CURRENT_TIMESTAMP");
    const evidencePut = db.prepare("INSERT INTO universe_entity_attribute_evidence(entity_key,field,evidence_json,reason) VALUES(?,?,?,?) ON CONFLICT(entity_key,field) DO UPDATE SET evidence_json=excluded.evidence_json,reason=excluded.reason");
    const cache = new Map();
    for (const {key, field} of prepared) {
      const proposal = get.get(key, field);
      if (!proposal) throw new Error("Öneri artık mevcut değil: " + key + ":" + field);
      if (!cache.has(key)) cache.set(key, values(db, key));
      const current = String(cache.get(key)[field] ?? "");
      if (action === "approve" && current !== proposal.baseline) throw new Error("Öneri oluşturulduktan sonra kayıt değişmiş. Önce yenile.");
      if (action === "approve") {
        cache.get(key)[field] = proposal.value;
        evidencePut.run(key,field,proposal.evidence_json,proposal.reason);
      }
      del.run(key, field);
    }
    if (action === "approve") for (const [key, fields] of cache) put.run(key, JSON.stringify(fields));
    return { reviewed: prepared.length, action };
  });
}
function parsePayload(node) {
  try { return JSON.parse(node.payload_json || "{}"); } catch { return {}; }
}
async function suggest(db, userDataPath, input) {
  ensureSchema(db);
  const keys = input?.keys;
  if (!Array.isArray(keys) || !keys.length || keys.length > 8 || new Set(keys).size !== keys.length) {
    throw new Error("AI çağrısı başına 1–8 benzersiz kayıt seçilmeli.");
  }
  const nodes = keys.map(key => getNode(db, String(key)));
  const current = new Map(nodes.map(node => [node.key, values(db, node.key)]));
  const snapshots = new Map(nodes.map(node=>[node.key,parsePayload(node)]));
  const brief = nodes.map(node => {
    const payload=snapshots.get(node.key);
    return {
      key:node.key,kind:node.kind,name:node.name,
      summary:String(node.summary||"").slice(0,1000),
      details:quality.sourceContext(node,payload),
      fields:current.get(node.key),
    };
  });
  const raw = await chat(userDataPath, [
    {role:"system",content:`Sen BirDeSenGör anlatı evreninin kaynak-sadık, son derece seçici bir kayıt editörüsün. Bu evreni dış dünya gerçekliğiyle karşılaştırma. Sadece gönderilen kaydın açıkça desteklenen, ilk bakışta önemli, atlas/görselleştirme için anlamlı özelliklerini öner. Az sayıda güvenilir öneri, çok sayıda genel/geçersiz etiket üretmekten üstündür.

KAYNAK KURALI:
- Her alanın dayanağı, gönderilen details listesindeki bir cümlenin BİREBİR alıntısı olmalı. evidence=[{"detailIndex":notun_indexi,"quote":"... kaynaktan kesintisiz en az 14 karakter ...","sourceVideoId":"o notta listelenen video ID"}].
- Bir kaynak yalnız başka bir kişiden bahsediyorsa o kişi için kayıt özelliği uydurma. Bir olasılığı, korku tarifini, planı veya reddedilen görevi gerçekleşmiş sayma.
- Özetten veya roles listesinden kaynağı olmayan etiket türetme. Görsel tarifi, kıyafet, renk, küçüklük, eskilik, ham madde nesnenin 'property' alanına konmaz.
- Destek yoksa alanı üretme; bilinmiyor/belirsiz/yok vb. etiketleri doldurma.
- Kısa 1–5 kelimelik değerler tercih et. İçerik Türkçe ve kaynak anlatının kendi bakış açısında olsun.

MUHATAP: "sideStatus", "age", "species", "dimension", "rank".
* sideStatus TEK alandır. SADECE şu değerleri kullan: notr,aydinlik,karanlik,karanlik_once_aydinlik,aydinlik_once_karanlik. Destek yoksa ALANI ATLA (Belirsiz görüntülemesi boş kayıtta varsayılandır). Eskiden/şimdi ayrımı tek bir birleşik durum etiketidir.
* Bu anlatının kendi sınıflandırma sözlüğünde "Aydınlık" çoğunlukla Müslüman aidiyetine, "Karanlık" Müslüman-olmayan aidiyete karşılık gelir. Bu, gerçek dünyadaki din veya kişilere ahlaki hüküm değildir; YALNIZCA anlatı içi sınıflandırmadır.
* Kaydın muhatabı Müslüman olduğunu açıkça söylüyorsa veya olduğu açıkça doğrulanıyorsa aydinlik. Müslüman olmadığını açıkça belirtiyorsa karanlik. "Nötr" yalnızca muhatabın tarafsız/bağımsız kaldığı açıkça söylenirse notr.
* Tamamlanmış sonradan Müslüman olma veya şahadet getirme ANLATISI varsa karanlik_once_aydinlik öner: "Müslüman olduktan sonra..." veya "Müslüman olmak istediğini söyledi, ardından şehadet getirdi" bu kategoriye girer. Sonraki not önceki beyanı tamamlıyorsa ikisinden de alıntı gösterebilirsin.
* Ters yön (aydinlik_once_karanlik) SADECE geçmişteki Müslüman/açıkça aydınlık aidiyeti ile sonraki vazgeçme/karanlık aidiyeti birlikte doğrulanmışsa.
* Yalnız "Müslüman olduğunu söyler" geçmişin ne olduğunu kanıtlamaz; bu durumda SADECE aydinlik. "İslam anlatıldı", "Müslüman olmak istiyor", "karar verdi" ama kabul/şehadet gerçekleşmedi ise taraf önerme. Çelişkiler varsa önerme.
* Başka karakter, konuk, mahkûm veya kabile Müslüman oldu diye bu kaydın sahibi Müslüman sayılmaz. Birinin karanlık yere gitmesi, ittifakı, görünüşü veya korkutucu olması karanlık tarafta olduğu anlamına gelmez.
* Kaynak alıntıları gerçekten MUHATABIN durumuna ait olmalı. Kaynakların sıralaması önem önceliğine göredir ama evidence.detailIndex her zaman orijinal not indeksidir.
* age yalnız açıkça karakterin yaşı bildirildiyse; zaman yolculuğu tarihi veya 'eskiden yaşadı' yaşı değildir.
* species yalnız açıkça tür adı söyleniyorsa.
* dimension yalnız karakterin ait olduğu/yaşadığı boyutsa, ziyaret veya yolculuk değil.
* rank yalnız gerçek/sabit unvan; 'davetli','konuk','katılımcı' gibi geçici roller değil. "Mahkemeye başkanlık etti/eder" ifadesi kalıcı "Mahkeme Başkanı" unvanını KANITLAMAZ. Atanma, başkan sıfatı veya kalıcı görev açıkça anlatılmıyorsa böyle bir unvan önerme. Geçici yönetim, görev devri veya tek olaya başkanlık eylemden statü türetme.

NESNE: type (ayırt edici nesne sınıfı), property (ne işe yaradığı, özel işlevi/yeteneği; sadece 'eski','mavi','küçük','gizemli','büyülü','taş' vb. OLAMAZ), custodian (açıkça sahibi, taşıyıcısı veya koruyucusu).
MEKÂN: type (ayırt edici yer sınıfı), position (açıkça belirtilen coğrafi/evrensel konumu; "evren" tek başına değildir), dimension (ait olduğu boyut; gezilen boyut değildir).

HER kayıt için records satırı ver; desteklenen alan yoksa fields:{} kullan. evidence yalnız kaynak details içinde bulunan index, sourceVideoId ve birebir kısa quote içersin. İddia ve açıklama üretmek yerine doğrulanabilir alan öner.

SADECE JSON ŞEKLİ:
{"records":[{"key":"verilen key","fields":{"rank":{"value":"Kral","reason":"Anlatıda unvanı doğrudan belirtiliyor","evidence":[{"detailIndex":3,"quote":"... kaynak nottan aynen kesilmiş alıntı ...","sourceVideoId":"ID"}]},"sideStatus":{"value":"karanlik_once_aydinlik","reason":"Geçmiş ve mevcut taraf ikisi de açık","evidence":[...]}}}]}`},
    {role:"user",content:JSON.stringify(brief)},
  ], {json:true,temperature:0,maxTokens:4800});
  const parsed = parseAssistantJson(raw);
  if (!parsed || !Array.isArray(parsed.records)) throw new Error("AI geçerli özellik listesi döndürmedi.");
  const byKey = new Map(nodes.map(n => [n.key, n]));
  const evaluated = new Set();
  const changes = [];
  const filtered={invalidField:0,invalidEvidence:0,qualityRejected:0,unchanged:0};
  for (const record of parsed.records) {
    const node = byKey.get(record?.key);
    if (!node || !record.fields || typeof record.fields !== "object" || Array.isArray(record.fields)) continue;
    evaluated.add(node.key);
    const payload=snapshots.get(node.key);
    for (const [field, proposal] of Object.entries(record.fields)) {
      if (!FIELDS[node.kind].includes(field) || !proposal || typeof proposal !== "object") {filtered.invalidField++;continue;}
      let value;
      try { value = normalize(node.kind, field, proposal.value); } catch {filtered.invalidField++;continue;}
      const baseline = String(current.get(node.key)?.[field] || "");
      const evidence=quality.evidenceFor(node,payload,proposal.evidence);
      if (!evidence.length) {filtered.invalidEvidence++;continue;}
      if (!quality.validateSuggestion(node.kind,field,value,evidence)) {filtered.qualityRejected++;continue;}
      const ids=[...new Set(evidence.map(x=>x.sourceVideoId))];
      if (!value || value === baseline || !ids.length) {filtered.unchanged++;continue;}
      changes.push({key:node.key,field,value,baseline,reason:String(proposal.reason || "").trim().slice(0, 320),sourceVideoIds:ids,evidence});
    }
  }
  if (!evaluated.size) throw new Error("AI değerlendirilen kayıtları yanıtlamadı.");
  let saved = 0;
  transaction(db, () => {
    const put = db.prepare(`INSERT INTO universe_entity_attribute_proposals(entity_key,field,value,baseline,reason,source_video_ids_json,evidence_json)
      VALUES (?,?,?,?,?,?,?) ON CONFLICT(entity_key,field) DO UPDATE SET
      value=excluded.value, baseline=excluded.baseline,reason=excluded.reason,source_video_ids_json=excluded.source_video_ids_json,evidence_json=excluded.evidence_json,created_at=CURRENT_TIMESTAMP`);
    const mark = db.prepare(`INSERT INTO universe_entity_attribute_analysis(entity_key,proposal_count)
      VALUES (?,?) ON CONFLICT(entity_key) DO UPDATE SET
      evaluated_at=CURRENT_TIMESTAMP, proposal_count=excluded.proposal_count`);
    const counts = new Map([...evaluated].map(key => [key,0]));
    for (const change of changes) {
      // Concurrent editor changes must not turn an old AI response into a new proposal.
      if (String(values(db,change.key)[change.field] || "") !== change.baseline) continue;
      put.run(change.key,change.field,change.value,change.baseline,change.reason,JSON.stringify(change.sourceVideoIds),JSON.stringify(change.evidence));
      counts.set(change.key,counts.get(change.key)+1);
      saved++;
    }
    for (const [key, count] of counts) mark.run(key,count);
  });
  return { evaluated: evaluated.size, proposed: saved, filtered };
}
module.exports = { FIELDS, publicFields, ensureSchema, list, saveMany, review, suggest, normalize };
