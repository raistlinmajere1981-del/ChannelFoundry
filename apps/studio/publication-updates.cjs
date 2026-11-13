"use strict";
// Safe publication v2 overlay: only records already in the live baseline can change.
const fs = require("node:fs");
const path = require("node:path");
const publication = require("./publication-v2.cjs");

function valid(snapshot) {
  if (snapshot?.schemaVersion !== 2 || snapshot?.languageVersion !== 1 ||
      JSON.stringify(snapshot.languages) !== JSON.stringify(["tr","en"]) ||
      !snapshot.publication?.contentFingerprint || !snapshot.journal?.sections ||
      !snapshot.archive?.entities || !Array.isArray(snapshot.assets)) {
    throw new Error("Güncelleme için geçerli TR/EN canlı publication v2 gerekli.");
  }
  const {publication: meta, ...logical} = snapshot;
  if (publication.fingerprint(logical) !== meta.contentFingerprint ||
      meta.id !== `pub-${meta.contentFingerprint.slice(0,24)}`) {
    throw new Error("Canlı publication fingerprint doğrulanamadı; güncelleme engellendi.");
  }
  return snapshot;
}
const by = (arr, key) => new Map((arr ?? []).map(item => [item[key], item]));
const approved = item => item?.locales?.tr?.status === "approved" && item?.locales?.en?.status === "approved";
function collectAssets(value, found = new Set()) {
  if (Array.isArray(value)) for (const item of value) collectAssets(item, found);
  else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) {
    if (key === "assetId" && typeof item === "string" && item) found.add(item);
    else collectAssets(item, found);
  }
  return found;
}
function assertReferences(snapshot) {
  const ids = new Set(snapshot.archive.entities.map(e => e.entityId));
  const walk = node => {
    if (Array.isArray(node)) { for (const n of node) walk(n); return; }
    if (!node || typeof node !== "object") return;
    if (node.type === "reference" && !ids.has(node.entityId)) {
      throw new Error(`Gizlenen kayıt, yayındaki anlatı tarafından kullanılıyor: ${node.entityId}`);
    }
    for (const value of Object.values(node)) walk(value);
  };
  for (const section of snapshot.journal.sections) for (const locale of Object.values(section.locales ?? {})) walk(locale.blocks);
  const assetIds = new Set(snapshot.assets.map(a => a.assetId));
  for (const id of collectAssets([snapshot.archive, snapshot.journal, snapshot.youtubeAnalysis])) {
    if (!assetIds.has(id)) throw new Error(`Güncellemede çözümlenemeyen görsel: ${id}`);
  }
}
function compareCoverage(local,baseline){
  if(!baseline)return {requiresFull:true,reasons:['Henüz doğrulanmış canlı paket yok.'],newSections:local.journal?.sections?.length??0,newEntities:local.archive?.entities?.length??0,newRelations:local.archive?.relations?.length??0,newVideos:local.youtubeAnalysis?.videos?.length??0,drawingsChanged:(local.vefkCatalog?.entries?.length??0)>0,supportChanged:false,outlineChanged:false,vefkLanguageChanged:false,relationRemoved:false,videoMetadataChanged:false,partialLocaleChanges:false};
  const newCount=(a,b,key)=>{const old=new Set((b??[]).map(x=>x[key]));return (a??[]).filter(x=>!old.has(x[key])).length;};
  const newSections=newCount(local.journal?.sections,baseline.journal?.sections,'sectionId');
  const newEntities=newCount(local.archive?.entities,baseline.archive?.entities,'entityId');
  const newRelations=newCount(local.archive?.relations,baseline.archive?.relations,'relationId');
  const newVideos=newCount(local.youtubeAnalysis?.videos,baseline.youtubeAnalysis?.videos,'videoId');
  const relationRemoved=newCount(baseline.archive?.relations,local.archive?.relations,'relationId')>0;
  const localVideos=new Map((local.youtubeAnalysis?.videos??[]).map(v=>[v.videoId,v]));
  const stripLocales=(value)=>Array.isArray(value)?value.map(stripLocales):value&&typeof value==='object'
    ?Object.fromEntries(Object.entries(value).filter(([key])=>!['locales','generatedAt'].includes(key)).map(([key,child])=>[key,stripLocales(child)])):value;
  const videoMetadataChanged=(baseline.youtubeAnalysis?.videos??[]).some(old=>{
    const current=localVideos.get(old.videoId);
    return current&&JSON.stringify(stripLocales(current))!==JSON.stringify(stripLocales(old));
  });
  const vefkLanguageChanged=JSON.stringify(local.vefkLanguages??null)!==JSON.stringify(baseline.vefkLanguages??null);
  // Safe overlays only refresh dual-approved locales. If an existing record
  // changed to TR-only, full publication is needed to avoid silently omitting it.
  const partialChanges=(current,old,key)=>{
    const known=by(old,key);
    return (current??[]).some(item=>{
      const previous=known.get(item[key]);
      if(!previous||JSON.stringify(item.locales??{})===JSON.stringify(previous.locales??{}))return false;
      return !(item.locales?.tr?.status==='approved'&&item.locales?.en?.status==='approved');
    });
  };
  const partialLocaleChanges=partialChanges(local.archive?.entities,baseline.archive?.entities,'entityId')
    ||partialChanges(local.journal?.sections,baseline.journal?.sections,'sectionId')
    ||partialChanges(local.youtubeAnalysis?.videos,baseline.youtubeAnalysis?.videos,'videoId');

  const drawingsChanged=JSON.stringify(local.vefkCatalog??null)!==JSON.stringify(baseline.vefkCatalog??null);
  const supportChanged=JSON.stringify(local.support??null)!==JSON.stringify(baseline.support??null);
  const outlineChanged=JSON.stringify(stripLocales(local.journal?.outline??null))!==JSON.stringify(stripLocales(baseline.journal?.outline??null));
  const reasons=[];
  if(newSections)reasons.push(`${newSections} yeni anlatı bölümü`);
  if(newEntities)reasons.push(`${newEntities} yeni evren kaydı`);
  if(newRelations)reasons.push(`${newRelations} yeni ilişki`);
  if(relationRemoved)reasons.push('Canlı yayındaki bazı ilişkiler kaldırıldı');
  if(newVideos)reasons.push(`${newVideos} yeni kamera kaydı`);
  if(drawingsChanged)reasons.push('Çizim Atölyesi yayın kataloğu değişti');
  if(vefkLanguageChanged)reasons.push('Çizim Atölyesi TR/EN metinleri değişti');
  if(partialLocaleChanges)reasons.push('Tek dil onaylı mevcut kayıtların yayın metinleri değişti');
  if(videoMetadataChanged)reasons.push('Kamera kaynak metaverisi değişti');
  if(supportChanged)reasons.push('Sponsor/katkı kayıtları değişti');
  if(outlineChanged)reasons.push('İçindekilere yeni bölüm/seri eklendi');
  return {requiresFull:reasons.length>0,reasons,newSections,newEntities,newRelations,newVideos,drawingsChanged,supportChanged,outlineChanged,vefkLanguageChanged,relationRemoved,videoMetadataChanged,partialLocaleChanges};
}
function buildUpdatePublication(baseline, built, visibility = {}) {
  valid(baseline);
  const current = valid(built.snapshot);
  const result = structuredClone(baseline);
  const hiddenEntities = new Set(visibility.hiddenEntityIds ?? []);
  const hiddenSections = new Set(visibility.hiddenSectionIds ?? []);
  let updated = 0;
  let hidden = 0;
  let images = 0;
  const currentEntities = by(current.archive.entities,"entityId");
  result.archive.entities = result.archive.entities.flatMap(old => {
    const candidate = currentEntities.get(old.entityId);
    if (!candidate) {
      if (hiddenEntities.has(old.entityId)) { hidden++; return []; }
      // Missing from the current export is not evidence that an older live
      // record should disappear; only an explicit editorial draft can hide it.
      return [old];
    }
    if (old.kind !== candidate.kind) throw new Error(`Arşiv kayıt türü değişti: ${old.entityId}`);
    const next = structuredClone(old);
    if (approved(candidate)) {
      next.locales = structuredClone(candidate.locales);
      next.name = candidate.name;
      next.aliases = structuredClone(candidate.aliases);
    }
    // Images are independent of language source text and story revisions.
    next.visual = structuredClone(candidate.visual ?? {});
    if (JSON.stringify(next.visual) !== JSON.stringify(old.visual)) images++;
    if (JSON.stringify(next) !== JSON.stringify(old)) updated++;
    return [next];
  });
  const entityIds = new Set(result.archive.entities.map(e => e.entityId));
  const relationCandidates = by(current.archive.relations,"relationId");
  result.archive.relations = result.archive.relations.filter(r => entityIds.has(r.fromEntityId) && entityIds.has(r.toEntityId)).map(old => {
    const candidate = relationCandidates.get(old.relationId);
    return candidate && candidate.fromEntityId === old.fromEntityId && candidate.toEntityId === old.toEntityId
      ? {...old, label: candidate.label} : old;
  });
  const survivingRelations = new Set(result.archive.relations.map(r => r.relationId));
  for (const e of result.archive.entities) e.relations = (e.relations ?? []).filter(id => survivingRelations.has(id));

  const currentSections = by(current.journal.sections,"sectionId");
  result.journal.sections = result.journal.sections.flatMap(old => {
    const candidate = currentSections.get(old.sectionId);
    if (!candidate) {
      if (hiddenSections.has(old.sectionId)) { hidden++; return []; }
      return [old];
    }
    if (!approved(candidate)) return [old];
    const next = {...old, revision:candidate.revision, locales:structuredClone(candidate.locales)};
    if (JSON.stringify(old) !== JSON.stringify(next)) updated++;
    return [next];
  });
  const sectionIds = new Set(result.journal.sections.map(s => s.sectionId));
  const currentOutline = new Map();
  for (const s of current.journal.outline?.series ?? []) {
    currentOutline.set(s.key,s);
    for (const c of s.chapters ?? []) currentOutline.set(c.key,c);
  }
  result.journal.outline.series = (result.journal.outline.series ?? []).map(s => ({
    ...s,
    ...(approved(currentOutline.get(s.key)) ? {locales:structuredClone(currentOutline.get(s.key).locales)} : {}),
    chapters:(s.chapters ?? []).map(c => ({
      ...c,
      ...(approved(currentOutline.get(c.key)) ? {locales:structuredClone(currentOutline.get(c.key).locales)} : {}),
      sectionIds:(c.sectionIds ?? []).filter(id => sectionIds.has(id)),
    })).filter(c => c.sectionIds.length),
  })).filter(s => s.chapters.length);
  result.journal.outline.ungroupedSectionIds =
    (result.journal.outline.ungroupedSectionIds ?? []).filter(id => sectionIds.has(id));

  const videos = by(current.youtubeAnalysis.videos,"videoId");
  result.youtubeAnalysis.videos = result.youtubeAnalysis.videos.flatMap(old => {
    const candidate = videos.get(old.videoId);
    if (!candidate) return [old];
    if (!approved(candidate)) return [old];
    const next = {...old, locales: structuredClone(candidate.locales)};
    if (JSON.stringify(old) !== JSON.stringify(next)) updated++;
    return [next];
  });

  const currentAssets = by(current.assets,"assetId");
  const knownAssets = by(result.assets,"assetId");
  const referenced = collectAssets([result.journal,result.archive,result.youtubeAnalysis]);
  for (const assetId of referenced) {
    const asset = currentAssets.get(assetId);
    if (asset) knownAssets.set(assetId, structuredClone(asset));
    else if (!knownAssets.has(assetId)) throw new Error(`Görsel kaynağı bulunamadı: ${assetId}`);
  }
  // Preserve existing remote assets so unfinished visual decisions cannot erase them.
  result.assets = [...knownAssets.values()].filter(a => !a.entityId || entityIds.has(a.entityId))
    .sort((a,b) => a.assetId.localeCompare(b.assetId));
  assertReferences(result);
  const {publication: _, ...logical} = result;
  const contentFingerprint = publication.fingerprint(logical);
  result.publication = {
    id: `pub-${contentFingerprint.slice(0,24)}`,
    generatedAt: new Date().toISOString(),
    contentFingerprint,
  };
  const changed = contentFingerprint !== baseline.publication.contentFingerprint;
  const oldAssets = by(baseline.assets,"assetId");
  const assetSources = (built.assetSources ?? []).filter(source => {
    const next = by(result.assets,"assetId").get(source.assetId);
    return next && next.url === `assets/${source.filename}` &&
      oldAssets.get(source.assetId)?.sha256 !== next.sha256;
  });
  return {
    snapshot:result, assetSources, changed,
    baselineFingerprint:baseline.publication.contentFingerprint,
    changes:{updated,hidden,images,assetUploads:assetSources.length},
    readiness:{...built.readiness,readyForUpdate:changed},
  };
}
function exportUpdatePublication(update, userDataPath) {
  if (!update.changed) throw new Error("Canlı paketle karşılaştırıldığında güncellenecek kayıt yok.");
  const root = path.join(String(userDataPath),"public-export","content");
  const assetsDirectory = path.join(root,"assets");
  fs.mkdirSync(assetsDirectory,{recursive:true});
  for (const asset of update.assetSources) {
    const destination = path.join(assetsDirectory,asset.filename);
    if (!fs.existsSync(destination)) fs.copyFileSync(asset.file,destination);
  }
  const file = path.join(root,"publication.json");
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp,JSON.stringify(update.snapshot,null,2)+"\n","utf8");
  fs.renameSync(temp,file);
  return {
    file,assetsDirectory,
    publicationId:update.snapshot.publication.id,
    generatedAt:update.snapshot.publication.generatedAt,
    contentFingerprint:update.snapshot.publication.contentFingerprint,
    sectionCount:update.snapshot.journal.sections.length,
    entityCount:update.snapshot.archive.entities.length,
    relationCount:update.snapshot.archive.relations.length,
    assetCount:update.snapshot.assets.length,
    vefkCount:update.snapshot.vefkCatalog?.entries?.length ?? 0,
    readiness:update.readiness, assetUploads:update.assetSources.map(s=>s.assetId),
    baselineFingerprint:update.baselineFingerprint,
    changes:update.changes,
  };
}
module.exports = {valid,buildUpdatePublication,exportUpdatePublication,compareCoverage};
