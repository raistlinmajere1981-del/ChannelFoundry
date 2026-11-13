import {readFileSync,writeFileSync,copyFileSync,renameSync,unlinkSync,existsSync,mkdirSync,readdirSync,statSync,realpathSync,rmSync} from 'node:fs';
import {resolve,join,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {validateProject,exportProject} from '../../packages/effect-engine/src/model/project.mjs';
import {compileObjectScene} from '../../packages/effect-engine/src/runtime/object-compile.mjs';
import {defaultScenePresentation,validateScenePresentation} from '../../packages/effect-engine/src/model/scene-presentation.mjs';
import {webpDimensions,MAX_ASSET_BYTES,MAX_TOTAL_ASSET_BYTES} from '../../packages/effect-engine/src/model/webp-assets.mjs';

export const LOCAL_BACKGROUND='/scene-assets/approved/room-background.webp';
const LOCAL_BASE=resolve(dirname(fileURLToPath(import.meta.url)),'resources/blank-room.webp');
const ID=/^[a-z][a-z0-9-]{1,48}$/;
const IMAGE=/^\/scene-assets\/custom\/[a-z0-9-]+\.webp$/;
const HASH=data=>createHash('sha256').update(data).digest('hex');
const projectDir=(userData,id)=>join(resolve(userData),'scene-workshop','projects',id);
const localPath=(dir,asset)=>asset===LOCAL_BACKGROUND?join(dir,'room.webp'):
  IMAGE.test(asset)?join(dir,'custom',basename(asset)):null;
const referenced=scene=>[...new Set([LOCAL_BACKGROUND,...scene.objects.filter(o=>o.kind==='artwork')
  .flatMap(o=>[o.visual.asset,...(o.visual.layers??[]).map(l=>l.asset)])])];
function safeProjectId(id){
  if(typeof id!=='string'||!ID.test(id)||id.endsWith('-')||id.includes('--'))
    throw Error('Yerel sahne kimliği geçersiz.');
  return id;
}
function ensureRegular(file) {
  if(realpathSync(file)!==resolve(file)||!statSync(file).isFile())
    throw Error('Sahne dosyası güvenilir bir yerel dosya olmalı.');
  return readFileSync(file);
}
function checkName(name){
  if(typeof name!=='string'||!name.trim()||name.trim().length>90)
    throw Error('Sahne adı 1–90 karakter olmalı.');
  return name.trim();
}
export function listLocalScenes(userData){
  const root=join(resolve(userData),'scene-workshop','projects');
  if(!existsSync(root))return [];
  return readdirSync(root,{withFileTypes:true}).filter(x=>x.isDirectory()&&ID.test(x.name))
    .flatMap(x=>{
      try{
        const dir=projectDir(userData,x.name);
        const info=JSON.parse(ensureRegular(join(dir,'project.json')).toString('utf8'));
        if(info.id!==x.name||info.version!==1)return [];
        return [{id:x.name,label:checkName(info.name),siteBound:false,canPublish:false,
          description:'Studio içinde bağımsız, yerel sahne'}];
      }catch{return [];}
    }).sort((a,b)=>a.label.localeCompare(b.label,'tr'));
}
export function createLocalScene(userData,name){
  const label=checkName(name);
  const root=join(resolve(userData),'scene-workshop','projects');
  mkdirSync(root,{recursive:true,mode:0o700});
  let id,dir;
  do{id='sahne-'+randomUUID().replaceAll('-','').slice(0,12);dir=projectDir(userData,id);}
  while(existsSync(dir));
  mkdirSync(dir,{mode:0o700});
  try{
    const scene={format:'efekt-atolyesi',version:2,kind:'objectScene',
      sceneId:'local-'+id,name:label,seed:'1',viewport:{width:1600,height:800},
      objects:[],effects:[]};
    validateProject(scene);
    writeFileSync(join(dir,'project.json'),JSON.stringify({version:1,id,name:label},null,2)+'\n',{flag:'wx',mode:0o600});
    writeFileSync(join(dir,'scene.json'),exportProject(scene),{flag:'wx',mode:0o600});
    copyFileSync(LOCAL_BASE,join(dir,'room.webp'));
  }catch(error){rmSync(dir,{recursive:true,force:true});throw error;}
  return {id,label,siteBound:false,canPublish:false,
    description:'Studio içinde bağımsız, yerel sahne'};
}
export function localSceneSource(userData,id){
  safeProjectId(id);
  const dir=projectDir(userData,id);
  // Only installed projects can be loaded, never arbitrary paths from IPC.
  const project=JSON.parse(ensureRegular(join(dir,'project.json')).toString('utf8'));
  if(project.version!==1||project.id!==id)throw Error('Yerel sahne kaydı geçersiz.');
  const identity=scene=>{
    validateProject(scene);
    if(scene.version!==2||scene.kind!=='objectScene'||scene.sceneId!=='local-'+id)
      throw Error('Sahne kimliği seçilen yerel projeyle eşleşmiyor.');
    if(scene.viewport.width!==scene.viewport.height*2)
      throw Error('Bağımsız sahnede koordinatlar 2:1 oranında olmalı.');
    if(scene.objects.some(item=>item.kind!=='artwork'))
      throw Error('Bağımsız sahne yalnız kaynak görselli nesneleri kullanabilir.');
  };
  function loadFiles(scene){
    const entries=new Map([['scene.json',ensureRegular(join(dir,'scene.json'))]]);
    for(const asset of referenced(scene)){
      const file=localPath(dir,asset);
      if(!file)throw Error('Yerel sahne görsel kaynağı desteklenmiyor.');
      entries.set(asset,ensureRegular(file));
    }
    return entries;
  }
  async function snapshot(){
    const bytes=ensureRegular(join(dir,'scene.json'));
    const scene=JSON.parse(bytes.toString('utf8'));
    identity(scene);compileObjectScene(scene);
    const entries=loadFiles(scene);
    const sourceHash=HASH(JSON.stringify([...entries].map(([k,b])=>[k,b.toString('base64')])));
    return {scene,sourceHash,entries,presentation:defaultScenePresentation()};
  }
  function validate(scene,state,presentation=state.presentation){
    identity(scene);compileObjectScene(scene);
    validateScenePresentation(presentation);
    return scene;
  }
  function readiness(scene,state,presentation=state.presentation){
    const problems=[];
    try{validate(scene,state,presentation);}catch(e){problems.push(e.message);}
    return {ready:problems.length===0,effectCount:scene.effects.length,
      enabledCount:scene.effects.filter(e=>e.enabled).length,
      mountedCount:scene.effects.length,problems};
  }
  function validateAssets(assets,state,scene=state.scene){
    if(!Array.isArray(assets)||assets.length>32)throw Error('En fazla 32 görsel düzenlenebilir.');
    const allowed=new Set(referenced(scene));
    const seen=new Set(),parsed=[];let total=0;
    for(const entry of assets){
      if(!entry||Object.keys(entry).sort().join(',')!=='dataUrl,path'||
        typeof entry.path!=='string'||!allowed.has(entry.path)||seen.has(entry.path))
        throw Error('Bu yerel sahneye ait olmayan görsel kaynağı reddedildi.');
      seen.add(entry.path);
      const match=/^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/.exec(entry.dataUrl??'');
      if(!match)throw Error('Görsel yalnız yerel WebP olabilir.');
      const bytes=Buffer.from(match[1],'base64');
      if(!bytes.length||bytes.length>MAX_ASSET_BYTES)throw Error('Tek görsel 8 MB sınırını aşamaz.');
      const size=webpDimensions(bytes);
      if(entry.path===LOCAL_BACKGROUND&&(size.width!==2*size.height||size.width<1024))
        throw Error('Yerel arka plan 2:1 oranında, en az 1024 piksel olmalı.');
      total+=bytes.length;
      if(total>MAX_TOTAL_ASSET_BYTES)throw Error('Toplam görseller 24 MB sınırını aşamaz.');
      parsed.push({path:entry.path,bytes});
    }
    for(const asset of allowed){
      if(!state.entries.has(asset)&&!seen.has(asset))
        throw Error('Yeni görsel için WebP dosyası gerekli: '+asset);
    }
    return parsed;
  }
  const preview=async state=>'data:image/webp;base64,'+state.entries.get(LOCAL_BACKGROUND).toString('base64');
  function backgroundInfo(state){
    const bytes=state.entries.get(LOCAL_BACKGROUND),{width,height}=webpDimensions(bytes);
    if(width!==2*height)throw Error('Yerel sahnenin arka planı 2:1 oranında olmalı.');
    return {asset:LOCAL_BACKGROUND,width,height,bytes:bytes.length,aspect:2,
      layout:'contain',note:'Bağımsız sahne: orijinal görsel tamamen görünür.'};
  }
  const previewObjects=state=>state.scene.objects.filter(o=>o.kind==='artwork').map(o=>({
    objectId:o.id,asset:o.visual.asset,
    image:'data:image/webp;base64,'+state.entries.get(o.visual.asset).toString('base64'),
    layers:(o.visual.layers??[]).map(layer=>({...layer,
      image:'data:image/webp;base64,'+state.entries.get(layer.asset).toString('base64')})),
  }));
  async function stage(scene,expectedSourceHash,assets=[],presentation=null){
    const source=await snapshot();
    if(source.sourceHash!==expectedSourceHash)throw Error('Yerel sahne kaynağı değişmiş; yeniden yükleyin.');
    const targetPresentation=presentation??source.presentation;
    const report=readiness(scene,source,targetPresentation);
    if(!report.ready)throw Error('Sahne doğrulaması başarısız: '+report.problems.join('; '));
    const uploads=validateAssets(assets,source,scene);
    const updates=new Map([['scene.json',Buffer.from(exportProject(scene))],
      ...uploads.map(u=>[u.path,u.bytes])]);
    const removed=[...source.entries.keys()].filter(file=>IMAGE.test(file)&&!referenced(scene).includes(file));
    const change=[...updates].filter(([file,bytes])=>!source.entries.has(file)||!source.entries.get(file).equals(bytes));
    const staging=join(dir,'.stage-'+randomUUID());
    mkdirSync(staging,{mode:0o700});
    // Install binary sources first, scene.json last, then remove unused files.
    // A crash before the manifest switch must not expose references to missing art.
    const files=change.map(([file])=>file);
    const affected=[...files.filter(file=>file!=='scene.json'),
      ...(files.includes('scene.json')?['scene.json']:[]),...removed];
    const target=file=>file==='scene.json'?join(dir,'scene.json'):localPath(dir,file);
    const old=new Map(),installed=[];
    try{
      for(const file of affected){
        const destination=target(file);
        if(!destination)throw Error('Hedef dosya geçersiz.');
        if(existsSync(destination))old.set(file,ensureRegular(destination));
        const relative=file==='scene.json'?'scene.json':file.slice(1).replaceAll('/','_');
        const temp=join(staging,relative);
        if(updates.has(file))writeFileSync(temp,updates.get(file),{flag:'wx',mode:0o600});
      }
      if((await snapshot()).sourceHash!==expectedSourceHash)
        throw Error('Kaynak hazırlık sırasında değişti; işlem iptal edildi.');
      for(const file of affected){
        const destination=target(file),temp=join(staging,
          file==='scene.json'?'scene.json':file.slice(1).replaceAll('/','_'));
        mkdirSync(dirname(destination),{recursive:true,mode:0o700});
        if(realpathSync(dirname(destination))!==resolve(dirname(destination)))
          throw Error('Sahne görselleri yalnız proje veri klasörüne yazılabilir.');
        if(updates.has(file))renameSync(temp,destination);
        else unlinkSync(destination);
        installed.push(file);
      }
    }catch(error){
      for(const file of installed.reverse()){
        const destination=target(file),original=old.get(file);
        if(original)writeFileSync(destination,original,{mode:0o600});
        else if(existsSync(destination))unlinkSync(destination);
      }
      throw error;
    }finally{rmSync(staging,{recursive:true,force:true});}
    const after=await snapshot();
    return {changed:affected.length>0,changedFiles:affected,sourceHash:after.sourceHash,
      readiness:report};
  }
  return {siteBound:false,identity,snapshot,validate,validateAssets,readiness,
    preview,backgroundInfo,previewObjects,previewArt:()=>[],roomObjects:()=>[],
    focusTargets:()=>[],stage};
}
