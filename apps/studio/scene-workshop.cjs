"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");

const SCENE_ID = "birdesengor-study-v2";
const DRAFT_FILENAME = "birdesengor-scene-v2.json";
const APPROVAL_TTL = 10 * 60 * 1000;
const MAX_SCENE_BYTES = 25 * 1024 * 1024;
const {createRunner}=require("./scene-workshop-birdesengor-publisher.cjs");

function digest(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function atomicWrite(filename, data) {
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = filename + "." + randomUUID() + ".tmp";
  try {
    fs.writeFileSync(temporary, data, { flag: "wx", mode: 0o600 });
    fs.renameSync(temporary, filename);
  } finally { try { fs.unlinkSync(temporary); } catch {} }
}
function validateIdentity(scene) {
  if (!scene || typeof scene !== "object" || scene.version !== 2 ||
    scene.kind !== "objectScene" || scene.sceneId !== SCENE_ID ||
    scene.viewport?.width !== 1600 || scene.viewport?.height !== 900)
    throw new Error("Yalnız BirDeSenGör 1600×900 kanonik V2 sahnesi düzenlenebilir.");
  const bytes = Buffer.byteLength(JSON.stringify(scene));
  if (bytes > MAX_SCENE_BYTES) throw new Error("Sahne taslağı 25 MB sınırını aşıyor.");
}
function readDraft(filename) {
  try {
    const value = JSON.parse(fs.readFileSync(filename, "utf8"));
    return value?.version === 1 && value.scene && typeof value.sourceHash === "string" ? value : null;
  } catch { return null; }
}
class SceneWorkshop {
  constructor({ userDataDir, site, runner, clock = () => Date.now(),
    identity = validateIdentity, draftFilename = DRAFT_FILENAME, canPublish = site?.siteBound !== false }) {
    if (!userDataDir || !site) throw new Error("Sahne Atölyesi yapılandırması eksik.");
    if(!/^[a-z0-9-]+(?:\.json)$/.test(draftFilename))
      throw Error('Geçersiz sahne taslağı dosyası.');
    this.draftFile = path.join(userDataDir, "scene-workshop", draftFilename);
    this.identity = identity;
    this.canPublish=Boolean(canPublish);
    this.site = site;
    this.runner = runner;
    this.clock = clock;
    this.approved = null;
    this.running = false;
  }
  async locked(fn) {
    if (this.running) throw new Error("Başka bir sahne işlemi devam ediyor.");
    this.running = true;
    try { return await fn(); } finally { this.running = false; }
  }
  async snapshot() {
    const source = await this.site.snapshot();
    this.identity(source.scene);
    return source;
  }
  async load() {
    const source = await this.snapshot();
    const saved = readDraft(this.draftFile);
    let scene = source.scene, presentation = source.presentation, assets = [], origin = "site", note = this.site.siteBound===false ? "Yerel sahne açıldı." : "Güncel web sahnesi açıldı.";
    if (saved && saved.sourceHash === source.sourceHash) {
      try {
        this.identity(saved.scene);
        this.site.validate(saved.scene, source, saved.presentation ?? source.presentation);
        scene = saved.scene; presentation = saved.presentation ?? source.presentation;
        assets = saved.assets ?? []; this.site.validateAssets?.(assets, source, scene);
        origin = "draft"; note = "Kayıtlı yerel taslak açıldı.";
      } catch { note = this.site.siteBound===false ? "Eski yerel taslak geçersiz; kayıtlı sahne açıldı." : "Eski taslak geçersiz; güncel web sahnesi açıldı."; }
    } else if (saved) note = this.site.siteBound===false ? "Yerel kaynak değişmiş; eski taslak yüklenmedi." : "Site kaynağı değişmiş; eski taslak yerine güncel sahne açıldı.";
    return {
      scene, presentation, assets, origin, sourceHash: source.sourceHash, note,
      readiness: this.site.readiness(scene, source), siteSource: this.site.siteBound !== false, canPublish:this.canPublish,
      previewImage: await this.site.preview(source),
      background: this.site.backgroundInfo?.(source) ?? null,
      previewObjects: [
        ...this.site.previewObjects(source),
        ...scene.objects.filter(o=>o.kind==='artwork'&&!source.scene.objects.some(entry=>entry.id===o.id))
          .map(o=>({objectId:o.id,asset:o.visual.asset,
            image:assets.find(a=>a.path===o.visual.asset)?.dataUrl,
            layers:(o.visual.layers??[]).map(layer=>({...layer,
              image:assets.find(a=>a.path===layer.asset)?.dataUrl}))})),
      ],
      previewArt: this.site.previewArt?.(source) ?? [],
      roomObjects: this.site.roomObjects?.(source) ?? [],
      focusTargets: this.site.focusTargets?.(source) ?? [],
    };
  }
  async save({ scene, presentation = null, assets = [], expectedSourceHash }) {
    return this.locked(async () => {
      this.approved = null;
      this.identity(scene);
      const source = await this.snapshot();
      if (!expectedSourceHash || expectedSourceHash !== source.sourceHash)
        throw new Error(this.site.siteBound===false
          ? "Yerel sahne değişmiş. Düzenleyiciyi yenilemeden kayıt yapılamaz."
          : "Web sahnesi değişmiş. Düzenleyiciyi yenilemeden kayıt yapılamaz.");
      const targetPresentation = presentation ?? source.presentation;
      this.site.validate(scene, source, targetPresentation);
      this.site.validateAssets?.(assets, source, scene);
      const readiness = this.site.readiness(scene, source, targetPresentation);
      if (!readiness.ready) throw new Error("Sahne doğrulanamadı: " + readiness.problems.join("; "));
      atomicWrite(this.draftFile, JSON.stringify({ version: 1, sourceHash: source.sourceHash, scene, assets, presentation: targetPresentation }, null, 2) + "\n");
      return { ok: true, sourceHash: source.sourceHash, draftHash: digest(scene), readiness,
        message: this.site.siteBound===false
          ? "Yerel sahne taslağı kaydedildi. Yayın bağlantısı yok."
          : "Efekt taslağı kaydedildi; web kaynağı ve canlı site değişmedi." };
    });
  }
  async prepare() {
    return this.locked(async () => {
      this.approved = null;
      const source = await this.snapshot();
      const draft = readDraft(this.draftFile);
      if (!draft || draft.sourceHash !== source.sourceHash)
        throw new Error("Güncel kaynakla kaydedilmiş taslak yok. Önce Kaydet kullanılmalı.");
      this.identity(draft.scene);
      this.site.validate(draft.scene, source, draft.presentation ?? source.presentation);
      const readiness = this.site.readiness(draft.scene, source, draft.presentation ?? source.presentation);
      if (!readiness.ready) throw new Error("Sahne kaynak dosyasına hazır değil: " + readiness.problems.join("; "));
      this.site.validateAssets?.(draft.assets ?? [], source, draft.scene);
      const staged = await this.site.stage(draft.scene, source.sourceHash, draft.assets ?? [], draft.presentation ?? source.presentation);
      atomicWrite(this.draftFile, JSON.stringify({ version: 1, sourceHash: staged.sourceHash, scene: draft.scene, assets: draft.assets ?? [], presentation: draft.presentation ?? source.presentation }, null, 2) + "\n");
      return { ok: true, ...staged, draftHash: digest(draft.scene),
        message: this.site.siteBound===false
          ? staged.changed?"Yerel sahne dosyaları hazırlandı. Yayın bağlantısı yok.":"Yerel sahne zaten güncel."
          : staged.changed ? "BirDeSenGör yerel efekt sahnesi hazırlandı. Canlıya yayın yapılmadı."
          : "Web sahnesi zaten güncel. Canlıya yayın yapılmadı." };
    });
  }
  async preflight(onProgress = () => {}) {
    if(!this.canPublish)throw Error('Bu yerel sahne için canlı yayın bağlantısı tanımlı değil.');
    return this.locked(async () => {
      this.approved = null;
      const source = await this.snapshot();
      const draft = readDraft(this.draftFile);
      if (!draft || draft.sourceHash !== source.sourceHash)
        throw new Error("Ön kontrol için güncel taslağın kaydedilmiş ve siteye hazırlanmış olması gerekiyor.");
      this.site.validate(draft.scene, source, draft.presentation ?? source.presentation);
      const readiness = this.site.readiness(draft.scene, source, draft.presentation ?? source.presentation);
      if (!readiness.ready || digest(draft.scene) !== digest(source.scene) ||
        JSON.stringify(draft.presentation ?? null) !== JSON.stringify(source.presentation ?? null))
        throw new Error("Taslak ve yerel web sahnesi eşit/doğrulanmış olmalı. Önce Siteye hazırla.");
      onProgress('Yerel site derlemesi doğrulanıyor…');
      await this.runner.build();
      onProgress('Yayın dosyalarının planı doğrulanıyor…');
      await this.runner.plan();
      // Do not issue a live-deploy token unless remote FTPS dry-run succeeded.
      onProgress('FTPS bağlantısı ve uzak kuru deneme kontrol ediliyor…');
      await this.runner.dryRun();
      const after = await this.snapshot();
      const latest = readDraft(this.draftFile);
      if (after.sourceHash !== source.sourceHash || digest(latest?.scene) !== digest(draft.scene) ||
        JSON.stringify(latest?.presentation ?? null) !== JSON.stringify(draft.presentation ?? null) ||
        latest?.sourceHash !== source.sourceHash)
        throw new Error("Ön kontrol sırasında kaynak veya taslak değişti; yeni kontrol gerekiyor.");
      const token = randomUUID();
      this.approved = { token, sourceHash: source.sourceHash, draftHash: digest(draft.scene), expiresAt: this.clock() + APPROVAL_TTL };
      return { ok: true, token, expiresAt: this.approved.expiresAt, readiness,
        message: "Yerel derleme ve uzak kuru deneme geçti. Canlı yayın için ayrıca onay gerekiyor." };
    });
  }
  async deploy({ token }, onProgress = () => {}) {
    if(!this.canPublish)throw Error('Bu yerel sahne için canlı yayın bağlantısı tanımlı değil.');
    return this.locked(async () => {
      const approved = this.approved;
      this.approved = null;
      if (!approved || typeof token !== "string" || token !== approved.token || this.clock() >= approved.expiresAt)
        throw new Error("Yayın onayı geçersiz veya süresi doldu. Yeniden ön kontrol gerekiyor.");
      const source = await this.snapshot();
      const draft = readDraft(this.draftFile);
      if (approved.sourceHash !== source.sourceHash || draft?.sourceHash !== source.sourceHash ||
        digest(draft?.scene) !== approved.draftHash || digest(source.scene) !== approved.draftHash ||
        JSON.stringify(draft?.presentation ?? null) !== JSON.stringify(source.presentation ?? null))
        throw new Error("Onaydan sonra web sahnesi veya kayıtlı taslak değişti. Yayın engellendi.");
      onProgress('Site derlemesi hazırlanıyor…');
      await this.runner.build();
      const final = await this.snapshot();
      if (final.sourceHash !== approved.sourceHash)
        throw new Error("Derleme sırasında kaynak değişti; canlı yayın başlatılmadı.");
      onProgress('Yayın paketi kontrol ediliyor ve FTPS ile site dosyaları aktarılıyor…');
      await this.runner.deploy();
      onProgress('Dosyalar aktarıldı; canlı HTTPS ve SHA-256 kontrol ediliyor…');
      await this.runner.verifyLive();
      onProgress('Canlı site doğrulandı.');
      return { ok: true, message: "BirDeSenGör efekt sahnesi yayınlandı; canlı doğrulama geçti." };
    });
  }
  invalidate() { this.approved = null; }
}
async function registerSceneWorkshopIpc(ipcMain, app) {
  const { siteSceneSource, BIRDESENGOR_SITE } = await import("./scene-workshop-site.mjs");
  const {localSceneSource,listLocalScenes,createLocalScene}=await import("./scene-workshop-local.mjs");
  const userDataDir=app.getPath("userData");
  const instances=new Map([['birdesengor',new SceneWorkshop({
    userDataDir,site:siteSceneSource(),runner:createRunner(BIRDESENGOR_SITE),
  })]]);
  const projects=()=>[{id:'birdesengor',label:'BirDeSenGör',
    siteBound:true,canPublish:true,description:'Mevcut web sahnesi ve onaylı yayın bağlantısı'},
    ...listLocalScenes(userDataDir)];
  const getService=input=>{
    const projectId=input?.projectId??'birdesengor';
    if(typeof projectId!=='string'||!projects().some(project=>project.id===projectId))
      throw Error('Sahne projesi bulunamadı.');
    if(!instances.has(projectId)){
      const site=localSceneSource(userDataDir,projectId);
      instances.set(projectId,new SceneWorkshop({
        userDataDir,site,runner:null,identity:site.identity,
        draftFilename:projectId+'.json',canPublish:false,
      }));
    }
    return instances.get(projectId);
  };
  ipcMain.handle("studio:scene-projects",()=>projects());
  ipcMain.handle("studio:scene-create",(_event,input)=>{
    const project=createLocalScene(userDataDir,input?.name);
    return project;
  });
  ipcMain.handle("studio:scene-load",(_event,input)=>getService(input).load());
  ipcMain.handle("studio:scene-save",(_event,input)=>getService(input).save(input??{}));
  ipcMain.handle("studio:scene-prepare",(_event,input)=>getService(input).prepare());
  function progressTo(sender,operation) {
    return message=>{if(!sender.isDestroyed())sender.send('studio:scene-progress',{operation,message});};
  }
  ipcMain.handle("studio:scene-preflight",(event,input)=>
    getService(input).preflight(progressTo(event.sender,"preflight")));
  ipcMain.handle("studio:scene-deploy",(event,input)=>
    getService(input).deploy(input??{},progressTo(event.sender,"deploy")));
  ipcMain.handle("studio:scene-invalidate",(_event,input)=>{
    getService(input).invalidate();return {ok:true};
  });
  return instances.get('birdesengor');
}
module.exports = { SceneWorkshop, createRunner, registerSceneWorkshopIpc, digest, validateIdentity };
