"use strict";
/** Read-only editorial hints; never rewrite or invent evidence. */
const { POLICY } = require("./narrative-evidence.cjs");

function narrativeIdentity(label, narrator, entityId, policy) {
  if (policy === POLICY || (policy === undefined && Object.hasOwn(narrator ?? {}, "sourceEntityKeys"))) {
    return (narrator?.sourceEntityKeys ?? []).includes(entityId);
  }
  // Historical v1 approval gates retain their exact label-based behavior.
  if (narrator?.mode !== "source_bound_first_person") return false;
  const name = String(label ?? "").trim().toLocaleLowerCase("tr-TR");
  const owner = String(narrator.displayName ?? "").trim().toLocaleLowerCase("tr-TR");
  return Boolean(name) && ((Boolean(owner) && name === owner) || name === "anlatıcı" || name === "sunucu");
}

// References must replace words inside prose; consecutive entity labels or
// metadata appended after a finished sentence cannot be published.
function inlineReferenceFindings(blocks, narrator = {}, policy) {
  const findings = [];
  for (const [blockIndex, block] of (Array.isArray(blocks) ? blocks : []).entries()) {
    if (block?.type !== "paragraph") continue;
    const spans = Array.isArray(block.spans) ? block.spans : [];
    let seenOrphan = false;
    for (let i = 0; i < spans.length; i += 1) {
      const span = spans[i];
      if (span?.type !== "reference") continue;
      const label = String(span.label ?? "").trim();
      if (narrativeIdentity(label, narrator, span.entityId, policy)) {
        findings.push({
          code: "narrator_reference_" + blockIndex + "_" + i,
          severity: "blocker",
          message: "Anlatıcı kimliği (“" + label + "”) ayrı bir kişi bağlantısı olamaz. Kaynağı silmeden bu bağlantıyı kaldır.",
        });
      }
      const before = spans.slice(0, i).filter(s => s?.type === "text" || s?.type === "emphasis").map(s => s.text ?? "").join("");
      const after = spans.slice(i + 1).filter(s => s?.type === "text" || s?.type === "emphasis").map(s => s.text ?? "").join("");
      const neighbor = spans[i - 1]?.type === "reference" || spans[i + 1]?.type === "reference";
      const dangling = !after.trim() && /[.!?…]["»”’')\]]*\s*$/u.test(before);
      const isolated = !before.trim() && !after.trim();
      if ((neighbor || dangling || isolated) && !seenOrphan) {
        findings.push({
          code: "detached_reference_" + blockIndex,
          severity: "blocker",
          message: "Paragrafın sonuna bağlantı/isim dizisi eklenmiş. Referanslar anlatının içindeki gerçek adların yerini almalı; ayrı isim listesi olarak onaylanamaz.",
        });
        seenOrphan = true;
      }
    }
  }
  return findings;
}

function analyzeDraft(draft, narrator = {}, context = {}) {
  if (draft?.retire) return [];
  const linkFindings = inlineReferenceFindings(draft?.blocks, narrator, context.evidencePolicy);
  const body = String(draft?.body ?? "").trim();
  const paragraphs = body.split(/\n\s*\n/u).map(s => s.trim()).filter(Boolean);
  const findings = [...linkFindings];
  const add = (code, severity, message) => findings.push({ code, severity, message });
  if (!body) {
    add("empty", "attention", "Anlatı metni boş; bölümün kaynağını kontrol et.");
    return findings;
  }
  // Check *each* paragraph. AI sometimes leaks a title just before a blank
  // line ('... söylenir. Yedi Kapı'), not only at the end of the draft.
  const stray = paragraphs.map((paragraph, index) => {
    if (/[.!?…»”"’]$/u.test(paragraph)) return null;
    const tail = paragraph.match(/[.!?…]\s+([\p{Lu}][\p{L}’'-]*(?:\s+[\p{Lu}][\p{L}’'-]*){0,4})\s*$/u);
    if (tail) return { index, phrase: tail[1] };
    const words = paragraph.split(/\s+/u).filter(Boolean);
    if (paragraphs.length > 1 && words.length <= 5) return { index, phrase: paragraph };
    return null;
  }).filter(Boolean);
  for (const entry of stray) add("detached_tail_" + entry.index, "attention", "Anlatıdan kopuk ifade olabilir: “" + entry.phrase.slice(0, 100) + "”.");
  if (!stray.length && !/[.!?…»”"’]$/u.test(body)) {
    add("unfinished_end", "warning", "Son paragraf bitmemiş olabilir; cümle sonunu kontrol et.");
  }
  if (/\bhikâye(?:de|nin|ye)\s+(?:yer alıyor|mekânı|geçiyor)\b/iu.test(body)) {
    add("technical_relation", "attention", "Teknik Evren ilişki etiketi anlatı metnine sızmış olabilir.");
  }
  if (namedThirdPerson(draft, narrator, context)) {
    add("named_third_person", "warning", "Eşlenen anlatıcı kaynak karakteri üçüncü şahısla eylem anlatıyor olabilir; özneyi ve kaynak atfını kontrol et.");
  }
  // Narrow style review only: absence of evidence is never a regex verdict.
  // Quoted wording and ordinary uncertainty ("bilinmiyor") are not reports.
  const unquoted = body.replace(/“[^”]*”|«[^»]*»|"[^"\n]*"|‘[^’]*’|(?<![\p{L}\p{N}])'[^'\n]+'(?![\p{L}\p{N}])|(?:^|\n)\s*[—–]\s+[^\n]*/gu, " ");
  if (/(?<![\p{L}])(?:kaynakta\s+(?:(?:bundan\s+)?(?:daha\s+)?fazla\s+ayrıntı\s+(?:yok|yer\s+almıyor|bulunmuyor)|açıklanmamaktadır)|bu\s+bilgilerin\s+anlatıcı\s+tarafından\s+izleyicilere\s+aktarıldığı\s+belirtilmiştir)(?![\p{L}])/iu.test(unquoted)) {
    add("editorial_source_report", "warning", "Okuyucu metninde editoryal kaynak raporu dili olabilir; günlük üslubunu gözden geçir. Bu uyarı olayın doğru veya yanlış olduğuna karar vermez.");
  }
  if ((draft?.sourceVideoIds?.length ?? 0) >= 4) {
    add("cross_video", "review", "Bu bölüm " + draft.sourceVideoIds.length + " videoya dayanıyor; olayların hangi videodan geldiğini ayrı ayrı kontrol et.");
  }
  if (!(draft?.sourceVideoIds?.length ?? 0)) add("no_video", "attention", "Taslağın ilişkilendirildiği kaynak video bulunmuyor.");
  if (!Array.isArray(draft?.sourceKeys) || draft.sourceKeys.length === 0) add("no_source", "attention", "Taslakta onaylı Evren kaynak kimliği bulunmuyor.");
  return findings;
}

function namedThirdPerson(draft, narrator, context) {
  if (narrator.mode !== "source_bound_first_person") return false;
  const keys = new Set(narrator.sourceEntityKeys ?? []);
  const owners = (context.narratorSourceEntities ?? []).filter(source => keys.has(source.sourceKey));
  if (!owners.length) return false;
  const lower = value => String(value).trim().toLocaleLowerCase("tr-TR");
  // A plain name shared by another approved character cannot establish who
  // acted. Explicit non-owner reference spans are excluded from this heuristic.
  const ambiguous = new Set((context.otherCharacterNames ?? []).map(lower));
  const text = Array.isArray(draft.blocks) && draft.blocks.length
    ? draft.blocks.filter(block => block.type === "paragraph").map(block => (block.spans ?? []).map(span =>
      span.type === "reference" ? (keys.has(span.entityId) ? span.label : " [başka kişi] ") : span.text ?? ""
    ).join("")).join("\n\n") : String(draft.body ?? "");
  const unquoted = text.replace(/“[^”]*”|«[^»]*»|"[^"\n]*"|‘[^’]*’|(?<![\p{L}\p{N}])'[^'\n]+'(?![\p{L}\p{N}])|(?:^|\n)\s*[—–]\s+[^\n]*/gu, " ");
  const actions = "(?:gitti|gider|gidiyor|gidecek|gitmiş|gitmişti|gitmiyor|gitmedi|geldi|geliyor|gelecek|görüştü|görüşüyor|görüşecek|görüşmüştü|gördü|görüyor|görmüştü|anlattı|anlatıyor|anlatmıştı|belirtti|belirtiyor|aktardı|aktarıyor|söyledi|söylüyor|dedi|çağırdı|çağırır|çağırıyor|çağıracak|içti|içer|içiyor|buldu|bulur|bulmuştu|alır|aldı|yapar|yaptı|görüşür|okudu|okuyor|açtı|döndü|dönüyor|karşılaştı|karşılaşıyor|yaşadı|yaşıyor|sordu|soruyor)";
  return owners.some(({ name }) => {
    if (!name?.trim() || ambiguous.has(lower(name))) return false;
    const safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Unicode boundaries handle Ö correctly. A comma, colon, case suffix or
    // quotation after the name is not a third-person subject match.
    const pattern = new RegExp("(?<![\\p{L}\\p{N}_])" + safe + "\\s+(?!(?:ile|için|hakkında|diye|adlı|sen|siz|ben|biz)(?![\\p{L}]))(?:[\\p{L}’'-]+\\s+){0,6}" + actions + "(?![\\p{L}\\p{N}_])", "iu");
    return pattern.test(unquoted);
  });
}
module.exports = { analyzeDraft, inlineReferenceFindings, narrativeIdentity };
