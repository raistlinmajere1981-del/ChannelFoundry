"use strict";

// Read-only: never bootstrap a schema, merge nodes, or infer identity from names.
function normalizeSourceEntityKeys(value = []) {
  if (!Array.isArray(value) || value.some(key => typeof key !== "string" || !key.trim() || key.trim().length > 220)) {
    throw new Error("Anlatıcı kaynak kimlikleri geçerli kaynak ID'lerinden oluşan bir liste olmalı.");
  }
  return [...new Set(value.map(key => key.trim()))].sort();
}

function approvedCharacterSources(db) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='universe_workspace_nodes'").get()) return [];
  return db.prepare(`SELECT key AS sourceKey, name FROM universe_workspace_nodes
    WHERE kind='character' AND state='approved' ORDER BY name, key`).all()
    .map(row => ({ sourceKey: String(row.sourceKey), name: String(row.name) }));
}

function resolveSourceEntities(db, keys) {
  const approved = new Map(approvedCharacterSources(db).map(source => [source.sourceKey, source]));
  return normalizeSourceEntityKeys(keys).map(key => {
    const source = approved.get(key);
    if (!source || !source.name.trim()) {
      throw new Error(`Anlatıcı kaynak kimliği çözümlenemiyor: ${key}. Bu kanalın güncel onaylı character kaydı olmalı; silinmiş, taslak veya başka türdeki kayıt kullanılamaz.`);
    }
    return source;
  });
}

module.exports = { normalizeSourceEntityKeys, approvedCharacterSources, resolveSourceEntities };
