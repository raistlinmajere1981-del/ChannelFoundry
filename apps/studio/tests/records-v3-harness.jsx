import React from 'react';
import { createRoot } from 'react-dom/client';
import '../src/studio-theme-tokens.css';
import '../src/styles.css';
import '../src/studio-next.css';
import '../src/visual-profile.css';
import '../src/records-workspace-v3.css';
import Workspace from '../src/EditorialWorkspaceV3';
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
const actions=[];window.__actions=actions;
window.channelFoundryStudio={
 universeWorkspaceRelations:async()=>relations,aiAnalysisSupportRecords:async()=>supports,aiAnalysisSupportSources:async()=>sources,onDataChanged:()=>()=>{},
 visualProfileGet:async()=>null,aiImageCapability:async()=>({supported:true,provider:'test',model:'fixture',controllerModel:''}),
 visualProfileSave:async data=>{actions.push({name:'visual-save',data});return {...data,attributes:data.attributes??[],imagePath:null,imageDataUrl:null};},
 visualImagePick:async data=>{actions.push({name:'visual-pick',data});return {canceled:false,profile:{source:'manual',description:'',attributes:[],atmosphere:'',prompt:'',negativePrompt:'',imagePath:'/tmp/test.png',imageDataUrl:'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='}};},
 visualImageGenerate:async data=>{actions.push({name:'visual-generate',data});return {generation:{provider:'test',model:'fixture'},profile:{...data,imagePath:'/tmp/generated.png',imageDataUrl:'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='}};},
 visualImageClear:async key=>{actions.push({name:'visual-clear',key});return {profile:null};},visualImageShow:async()=>{},
 universeWorkspaceUpdate:async data=>{actions.push({name:'update',data});const index=nodes.findIndex(n=>n.key===data.key);nodes[index]={...nodes[index],...data,updatedAt:new Date().toISOString()};return nodes[index];},
 saveItem:async data=>{actions.push({name:'save-item',data});const idx=legacy.findIndex(i=>i.key===data.key);legacy[idx]={...legacy[idx],...data};},
 bulkApply:async data=>{actions.push({name:'bulk',data});return {affected:data.keys.length,affectedRelations:0};},
 aiAnalysisSupportSave:async data=>{actions.push({name:'support',data});if(data.delete)supports.splice(0,1);else if(data.originalName){supports[0]={...supports[0],name:data.name,kind:data.targetKind,videoId:data.targetVideoId};}else supports.push({id:'sp'+(supports.length+1),kind:data.kind,name:data.name,videoId:data.videoId,source:'manual'});return {ok:true,records:[...supports],sources};}
};
window.__mountRecords=()=>{const root=createRoot(document.getElementById('root'));root.render(<Workspace nodes={[...nodes]} legacyItems={[...legacy]} legacyRelations={legacyRelations} onReload={async()=>{window.__reloads=(window.__reloads||0)+1}} onCreate={()=>actions.push({name:'create'})}/>);};
