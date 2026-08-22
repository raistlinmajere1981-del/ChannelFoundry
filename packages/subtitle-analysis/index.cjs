const TURKISH_LOCALE = "tr-TR";
const MAX_QUERY_LENGTH = 200;

function normalizeQuery(value) {
  const query = String(value ?? "").replace(/\s+/gu, " ").trim();
  if (!query) throw new Error("Aranacak kelime veya ifade gerekli.");
  if (query.length > MAX_QUERY_LENGTH) throw new Error(`Arama ifadesi en fazla ${MAX_QUERY_LENGTH} karakter olabilir.`);
  return query;
}

function fold(value) {
  return String(value ?? "").normalize("NFC").toLocaleLowerCase(TURKISH_LOCALE);
}

function normalizeTranscript(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/gu, " ")
    .replace(/\n+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function sentenceSegments(value) {
  const text = normalizeTranscript(value);
  if (!text) return [];
  if (typeof Intl?.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(TURKISH_LOCALE, { granularity: "sentence" });
    return [...segmenter.segment(text)]
      .map((entry) => String(entry.segment ?? "").trim())
      .filter(Boolean);
  }
  return (text.match(/[^.!?…]+(?:[.!?…]+["'”’\])}]*|$)/gu) ?? [text])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function countLiteralOccurrences(value, rawQuery) {
  const query = fold(normalizeQuery(rawQuery));
  const text = fold(value);
  if (!text || !query) return 0;
  let count = 0;
  let offset = 0;
  while (offset <= text.length - query.length) {
    const index = text.indexOf(query, offset);
    if (index < 0) break;
    count += 1;
    offset = index + Math.max(1, query.length);
  }
  return count;
}

function analyzeTranscript(value, rawQuery) {
  const query = normalizeQuery(rawQuery);
  const sentences = [];
  let occurrenceCount = 0;
  for (const sentence of sentenceSegments(value)) {
    const count = countLiteralOccurrences(sentence, query);
    if (!count) continue;
    occurrenceCount += count;
    sentences.push({ sentence, occurrenceCount: count });
  }
  return { query, matchMode: "literal", occurrenceCount, sentences };
}

module.exports = {
  MAX_QUERY_LENGTH,
  analyzeTranscript,
  countLiteralOccurrences,
  fold,
  normalizeQuery,
  normalizeTranscript,
  sentenceSegments,
};
