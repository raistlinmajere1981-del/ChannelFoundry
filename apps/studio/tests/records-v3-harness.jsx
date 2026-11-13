import React from 'react';
import { createRoot } from 'react-dom/client';
import '../src/studio-theme-tokens.css';
import '../src/styles.css';
import '../src/studio-next.css';
import '../src/visual-profile.css';
import '../src/records-workspace-v3.css';
import '../src/records-language-v3.css';
import '../src/publish-center-v3.css';
import Workspace from '../src/EditorialWorkspaceV3';
import PublishCenter from '../src/PublishCenter';
const nodes=[
  {key:'story-67',kind:'story',state:'approved',name:'67. Davet ve Defterin Mezna Planı',summary:'Umman’dan gelen davetli hakkında bir hikâye.',aliases:[],sourceVideoIds:['abc123'],isMainCharacter:false,updatedAt:'2026-11-10T12:00:00',payload:{sequence:[{text:'67. davetli bir defter götürmek üzere Mezna’ya hareket eder.',sourceVideoIds:['abc123']}],characterNames:['Ömer'],locationNames:['Mezna']}},
  {key:'character-omer',kind:'character',state:'approved',name:'Ömer',summary:'Anlatıcı',aliases:['Konuk'],sourceVideoIds:['abc123'],isMainCharacter:true,updatedAt:'2026-11-10T12:00:00',payload:{roles:['Anlatıcı'],storyNames:['67. Davet ve Defterin Mezna Planı']}},
  {key:'object-stone',kind:'object',state:'draft',name:'Taş numune',summary:'Bir taş',aliases:[],sourceVideoIds:['abc123'],updatedAt:'2026-11-10T12:00:00',payload:{}}
];
const legacy=[{key:'file:manual-1',kind:'file',title:'Bağımsız dosya',id:'manual-1',status:'draft',meta:'13 Kas 2026',summary:'Manuel kayıt',relatedCount:1}];
const relations=[{key:'relation1',runId:1,fromKey:'story-67',toKey:'character-omer',label:'olaya katılır',sourceVideoIds:['abc123'],state:'approved',updatedAt:'2026-11-10T12:00:00'}];
const legacyRelations=[{id:'r2',fromKey:'file:manual-1',toKey:'file:manual-1',label:'ilişkili'}];
const supports=[{id:'sp1',videoId:'abc123',kind:'sponsor',name:'Test Sponsor',source:'analysis'}];
const sources=[{videoId:'abc123',title:'Örnek kaynak video',url:'https://example.test',sourceValid:true,state:'curated',publishedAt:'2026-07-18T00:00:00'}];
const languageRows=[
 {kind:'entity',id:'story-publication-67',sourceHash:'h1',source:{name:'67. Davet ve Defterin Mezna Planı',kind:'story',summary:'Umman’dan gelen davetli.',details:[],sourceVideoIds:['abc123']},variants:{tr:{language:'tr',state:'approved',stale:false,revision:1,data:{name:'67. Davet ve Defterin Mezna Planı',kind:'story',summary:'Onaylı Türkçe anlatı.',details:[],sourceVideoIds:['abc123']}},en:{language:'en',state:'draft',stale:false,revision:1,data:{name:'67. Davet ve Defterin Mezna Planı',kind:'story',summary:'',details:[],sourceVideoIds:['abc123']}}},flags:{missing:true,ready:false,pending:false,stale:false,errors:false}},
 {kind:'video',id:'abc123',sourceHash:'h2',source:{title:'Kamera yayın metni',summary:'Türkçe kamera özeti',description:'Açıklama',core:{}},variants:{tr:{language:'tr',state:'approved',stale:false,revision:1,data:{title:'Kamera yayın metni',summary:'Türkçe kamera özeti',description:'Açıklama',core:{}}},en:{language:'en',state:'approved',stale:false,revision:2,data:{title:'Camera publication',summary:'Camera summary',description:'Description',core:{}}}},flags:{ready:true,missing:false,pending:false,stale:false,errors:false}},
];
window.__languageRows=languageRows;
window.__preview={baselineAvailable:true,changed:true,readiness:{narrativeSections:40,narrativeChangesPending:false,visualComplete:true,readyForTheme:true},counts:{sections:40,entities:434,relations:901,assets:4,vefks:1},coverage:{requiresFull:true,reasons:['1 yeni evren kaydı'],newSections:0,newEntities:1,newRelations:0,newVideos:0,drawingsChanged:false,supportChanged:false,outlineChanged:false},update:{ready:true,changes:{updated:4,images:1,assetUploads:1}},baseline:{generatedAt:'2026-11-12T03:00:00.000Z',publicationId:'pub-old',contentFingerprint:'hash-old'}};
window.__readyLanguages=false;
window.__batchStatus={rows:[],counts:{queued:0,running:0,done:0,failed:0,skipped:0},running:false,paused:true};
const languageOverview=()=>({rows:languageRows,counts:{ready:window.__readyLanguages?languageRows.length:1,missing:1,pending:0,stale:0,errors:0}});
const actions=[];window.__actions=actions;
window.channelFoundryStudio={
 languagesOverview:async()=>languageOverview(),languagesGet:async({kind,id})=>languageRows.find(row=>row.kind===kind&&row.id===id)||null,
 languagesGenerate:async({kind,id,language})=>{actions.push({name:'translation-generate',kind,id,language});const entry=languageRows.find(row=>row.kind===kind&&row.id===id);entry.variants.en={...entry.variants.en,state:'draft',data:{...entry.source,summary:'Generated English summary.'},candidate:null,revision:2};return {...entry};},
 languagesSave:async({kind,id,language,data,approved})=>{actions.push({name:'translation-save',kind,id,language,approved});const entry=languageRows.find(row=>row.kind===kind&&row.id===id);entry.variants[language]={...entry.variants[language],data,state:approved?'approved':'draft',revision:(entry.variants[language]?.revision||0)+1,stale:false};return {...entry};},
 languagesBatchStatus:async()=>window.__batchStatus,
 languagesBatchEnqueue:async payload=>{actions.push({name:'batch',payload});window.__batchStatus={...window.__batchStatus,counts:{...window.__batchStatus.counts,queued:payload.items.length},running:true,paused:false};return {...window.__batchStatus,queued:payload.items.length,skipped:0};},
 languagesBatchPause:async()=>({...window.__batchStatus,running:false,paused:true}),languagesBatchResume:async()=>({...window.__batchStatus,running:true,paused:false}),languagesBatchRetry:async()=>window.__batchStatus,
 publicationPreview:async()=>window.__preview, getPublicationInfo:async()=>null,
 communitySession:async()=>({connected:true}),channelProjects:async()=>({activeId:'birdesengor',projects:[{id:'birdesengor',webUrl:'https://birdesengorgizlievren.com',deploymentEnabled:true}]}),
 publishPublicSnapshot:async mode=>{actions.push({name:'publish',mode});return {publicationId:'pub-new',contentFingerprint:'new',sectionCount:40,entityCount:434,assetCount:4,relationCount:901,vefkCount:1,generatedAt:'2026-11-13T03:00:00.000Z',file:'/tmp/publication.json',live:{verified:true,generatedAt:'2026-11-13T03:00:00.000Z',publicationId:'pub-new',contentFingerprint:'new',sectionCount:40,entityCount:434,assetCount:4,relationCount:901,bytes:1024,sha256:'sha',publicUrl:'https://example.test/content/publication.json'}};},
 showPublicExport:async()=>true,
 universeWorkspaceRelations:async()=>relations,aiAnalysisSupportRecords:async()=>supports,aiAnalysisSupportSources:async()=>sources,onDataChanged:()=>()=>{},
 visualProfileGet:async()=>null,aiImageCapability:async()=>({supported:true,provider:'test',model:'fixture',controllerModel:''}),
 visualProfileSave:async data=>{actions.push({name:'visual-save',data});return {...data,attributes:data.attributes??[],imagePath:null,imageDataUrl:null};},
 visualImagePick:async data=>{actions.push({name:'visual-pick',data});return {canceled:false,profile:{source:'manual',description:'',attributes:[],atmosphere:'',prompt:'',negativePrompt:'',imagePath:'/tmp/test.png',imageDataUrl:'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='}};},
 visualImageGenerate:async data=>{actions.push({name:'visual-generate',data});return {generation:{provider:'test',model:'fixture'},profile:{...data,imagePath:'/tmp/generated.png',imageDataUrl:'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='}};},
 visualImageClear:async key=>{actions.push({name:'visual-clear',key});return {profile:null};},visualImageShow:async key=>{actions.push({name:'visual-show',key});},
 universeWorkspaceUpdate:async data=>{actions.push({name:'update',data});const index=nodes.findIndex(n=>n.key===data.key);nodes[index]={...nodes[index],...data,updatedAt:new Date().toISOString()};return nodes[index];},
 saveItem:async data=>{actions.push({name:'save-item',data});const idx=legacy.findIndex(i=>i.key===data.key);legacy[idx]={...legacy[idx],...data};},
 bulkApply:async data=>{actions.push({name:'bulk',data});return {affected:data.keys.length,affectedRelations:0};},
 aiAnalysisSupportSave:async data=>{actions.push({name:'support',data});if(data.delete)supports.splice(0,1);else if(data.originalName){supports[0]={...supports[0],name:data.name,kind:data.targetKind,videoId:data.targetVideoId};}else supports.push({id:'sp'+(supports.length+1),kind:data.kind,name:data.name,videoId:data.videoId,source:'manual'});return {ok:true,records:[...supports],sources};}
};
window.__mountRecords=()=>{const root=createRoot(document.getElementById('root'));root.render(<Workspace nodes={[...nodes]} legacyItems={[...legacy]} legacyRelations={legacyRelations} onReload={async()=>{window.__reloads=(window.__reloads||0)+1}} onCreate={()=>actions.push({name:'create'})}/>);};

window.__mountPublish=()=>{const root=createRoot(document.getElementById("root"));root.render(<PublishCenter/>);};
