import React from 'react';
import {createRoot} from 'react-dom/client';
import '../src/studio-theme-tokens.css';
import '../src/styles.css';
import '../src/pipeline.css';
import '../src/studio-layout.css';
import '../src/studio-workspace-layout.css';
import '../src/studio-accessibility.css';
import '../src/studio-theme-bindings.css';
import '../src/channel-projects.css';
import '../src/studio-workspace-system.css';
import '../src/studio-fixed-viewport.css';
import '../src/settings-v3.css';
import {Settings} from '../src/StudioPipeline';
window.__actions=[];
const project={id:'birdesengor',displayName:'BirDeSenGör',youtubeChannelUrl:'https://www.youtube.com/@BirDeSenGor',youtubePlaylistUrl:'',webRepository:'',webUrl:'https://example.test',hostingProvider:'TestHosting',deploymentEnabled:true,narrator:{displayName:'Ömer',mode:'source_bound_first_person',editorialNote:'Kayıtlı üslup',sourceEntityKeys:[]}};
const config={provider:'codex-cli',endpoint:'',apiKeyConfigured:false,model:'codex-saved-model',fallbackModel:'',reasoningEffort:'',reasoningMode:'',timeoutSeconds:420,image:{mode:'enabled',provider:'codex-cli',endpoint:'',model:'image-saved-model',reasoningEffort:'',reasoningMode:'',apiKeyConfigured:false}};
const seo={site:{title:'BirDeSenGör',description:'Türkçe site açıklaması.',image:''},sites:{tr:{title:'BirDeSenGör',description:'Türkçe site açıklaması.',image:''},en:{title:'BirDeSenGor',description:'English site description.',image:''}},rows:[{kind:'section',id:'section1',language:'tr',title:'Kayıtlı birinci hikâye',description:'Kaynağın SEO açıklaması.',source:'Onaylı içerikten alınan kaynak anlatım.',sourceHash:'h1',path:'/tr/evren/bolum/section1',override:false,needsReview:true,candidate:null},{kind:'section',id:'section1',language:'en',title:'First story',description:'Story description.',source:'Approved source story.',sourceHash:'h2',path:'/en/evren/bolum/section1',override:false,needsReview:true,candidate:null}],draftCount:2};
window.__storedConfig=config;
window.channelFoundryStudio={
 channelProjects:async()=>({activeId:'birdesengor',projects:[project]}),youtubeCatalogActive:async()=>({id:'y1',url:project.youtubeChannelUrl,playlistUrl:'',name:'BirDeSenGör'}),channelNarratorSources:async()=>[],
 channelProjectUpdate:async input=>{window.__actions.push({type:'project-save',input});Object.assign(project,input);return {...project};},channelProjectCreate:async input=>({...project,...input}),
 aiConfig:async()=>window.__storedConfig,aiProviders:async()=>[
  {id:'codex-cli',label:'Codex CLI',role:'both',transport:'cli',endpoint:'',secret:false},
  {id:'ollama',label:'Ollama',role:'text',transport:'local',endpoint:'http://localhost:11434',secret:false},
  {id:'disabled',label:'Kapalı',role:'image',transport:'none',endpoint:'',secret:false},
 ],
 aiModels:async()=>({models:[{id:'codex-saved-model',label:'Saved Model',text:true},{id:'codex-new-model',label:'New Model',text:true}]}),
 aiImageModels:async()=>({models:[{id:'image-saved-model',label:'Saved Image Model'},{id:'image-new-model',label:'New Image Model'}]}),
 aiSaveConfig:async input=>{window.__actions.push({type:'ai-save',input});window.__storedConfig={...config,...input,image:{...config.image,mode:input.imageMode,provider:input.imageProvider,model:input.imageModel,endpoint:input.imageEndpoint,reasoningEffort:input.imageReasoningEffort,reasoningMode:input.imageReasoningMode}};return window.__storedConfig;},
 seoOverview:async()=>seo,seoBatchStatus:async()=>({rows:[],counts:{queued:0,running:0,done:0,failed:0,skipped:0},running:false,paused:true}),
 seoSave:async input=>{if(window.__failSeoOnce){window.__failSeoOnce=false;window.__actions.push({type:'seo-save-error',input});throw Error('SEO geçici kayıt hatası');}window.__actions.push({type:'seo-save',input});if(input.kind==='site')Object.assign(seo.sites[input.language],input);else{const r=seo.rows.find(r=>r.id===input.id&&r.language===input.language);Object.assign(r,input);r.needsReview=!input.approved;}return structuredClone(seo);},
 seoSuggest:async input=>{window.__actions.push({type:'seo-suggest',input});return {title:'AI SEO Önerisi',description:'Kaynak metne bağlı AI açıklaması'};},
 seoBatchEnqueue:async input=>{window.__actions.push({type:'seo-queue',input});return {rows:[],counts:{queued:input.items.length,running:0,done:0,failed:0,skipped:0},running:true,paused:false,queued:input.items.length,skipped:0};},
 seoBatchPause:async()=>({rows:[],counts:{queued:0,running:0,done:0,failed:0,skipped:0},running:false,paused:true}),seoBatchResume:async()=>({rows:[],counts:{queued:0,running:0,done:0,failed:0,skipped:0},running:false,paused:true}),seoBatchRetry:async()=>({rows:[],counts:{queued:0,running:0,done:0,failed:0,skipped:0},running:false,paused:true}),
 communitySession:async()=>({connected:true,configured:true,secureStorageAvailable:true,endpoint:'https://example.test/api/community',username:'admin'}),communityAdminSetupStatus:async()=>({setupRequired:false,deploymentReady:true}),
 universeMaintenanceStatus:async()=>({confirmation:'EVRENİ SIFIRLA',reset:{universe_workspace_nodes:457,universe_workspace_relations:922,universe_ingest_sources:50},preserved:{source_ai_analyses:50,ai_analysis_editorial_reviews:50},resetCount:457,active:false,narratorLinks:1,activeRunId:null,blockedReason:''}),
 analyticsSummary:async()=>({ok:true,anonymous:true,days:30,visits:3,activeSeconds:212,areas:[{area:'evren',seconds:190,opens:2}],daily:[],contents:[]}),universeWorkspaceList:async()=>[],onDataChanged:()=>()=>{},
};
window.__mountSettings=()=>{createRoot(document.getElementById('root')).render(<Settings databaseInfo={{file:'/tmp/test.sqlite',itemCount:5}} catalog={{imported:0,total:5,pendingImport:0,transcripts:0}} workspaceStatus={{counts:{total:457}}}/>);};
