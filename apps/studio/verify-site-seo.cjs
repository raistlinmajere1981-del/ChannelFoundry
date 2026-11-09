"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const seo = require("./seo-workspace.cjs");
const root = path.resolve(__dirname, "../..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "bdsg-seo-"));
try {
  const snapshot = {
    schemaVersion:2,
    publication:{id:"pub-aaaaaaaaaaaaaaaaaaaaaaaa",contentFingerprint:"a".repeat(64),generatedAt:"2026-11-09T10:00:00.000Z"},
    journal:{ sections:[{sectionId:"book:chapter-1",title:"Bölüm başlığı",blocks:[{type:"paragraph",spans:[{type:"text",text:"İçerik yalnız onaylı bölüm metninden gelir."}]}]}]},
    youtubeAnalysis:{videos:[{videoId:"ABCDEFGHIJK",title:"Kaynak video",summary:"Kaynağın özeti.",publicationStatus:"published",analysisStatus:"complete",membersOnly:false},
      {videoId:"LMNOPQRSTUV",title:"Özel video",summary:"Yayınlanamaz.",publicationStatus:"published",analysisStatus:"complete",membersOnly:true}]},
    vefkCatalog:{entries:[{id:"vefk-1",title:"Örnek vefk",description:"Vefk örnek çalışması",document:{id:"vefk-1"}}]},
  };
  const status={status:'approved',sourceHash:'b'.repeat(64),revision:1};
  for(const s of snapshot.journal.sections) s.locales={tr:{...status,title:s.title,blocks:s.blocks},en:{...status,title:'English chapter',blocks:[{type:'paragraph',text:'Approved English source.'}]}};
  for(const v of snapshot.youtubeAnalysis.videos)v.locales={tr:{...status,title:v.title,summary:v.summary}};
  snapshot.vefkLanguages={'vefk-1':{tr:{...status,title:'Örnek vefk',description:'Vefk örnek çalışması'}}};
  const original = seo.overview(temp,snapshot);
  assert.equal(original.rows.length,4,"Yalnız yayımlanan içerikler SEO listesinde olmalı.");
  assert(!original.rows.some(x=>x.id==="LMNOPQRSTUV"),"Özel video SEO'da olmamalı.");
  seo.update(temp,{language:'tr',approved:true,sourceHash:seo.defaults(snapshot).find(r=>r.kind==='section'&&r.language==='tr').sourceHash,kind:"section",id:"book:chapter-1",title:"Özel başlık",description:"Editör onaylı açıklama."},snapshot);
  assert.equal(seo.manifest(temp,snapshot,'https://example.org').pages.length,1,'Yalnız elle onaylı SEO manifestte olmalı');
  const manifest=seo.manifest(temp,snapshot,"https://example.org");
  assert.equal(manifest.contentFingerprint,snapshot.publication.contentFingerprint);
  assert.equal(manifest.pages[0].title,"Özel başlık");
  assert.equal(manifest.pages[0].path,"/tr/evren/bolum/book%3Achapter-1");
  assert(!JSON.stringify(manifest).includes("Yayınlanamaz."));
  assert.throws(()=>seo.update(temp,{language:'tr',approved:true,sourceHash:seo.defaults(snapshot).find(r=>r.kind==='section'&&r.language==='tr').sourceHash,kind:"section",id:"unpublished",title:"X",description:"X"},snapshot));
  assert(!!manifest.pages[0].contentHash);
  const env={...process.env,CHANNEL_FOUNDRY_SEO_FILE:path.join(temp,"seo-manifest.json")};
  const encoded=Buffer.from(JSON.stringify({manifest,snapshot}),"utf8").toString("base64");
  const script=`require ${JSON.stringify(path.join(root,"apps/web/public/api/studio/bootstrap.php"))};
    require ${JSON.stringify(path.join(root,"apps/web/public/api/studio/publication.php"))};
    require ${JSON.stringify(path.join(root,"apps/web/public/api/studio/seo.php"))};
    $input=json_decode(base64_decode("${encoded}"),true);
    $valid=seo_validate_manifest($input["manifest"],$input["snapshot"]);
    seo_write_manifest($valid);
    $result=json_decode(file_get_contents(seo_manifest_file()),true);
    echo json_encode([$result["pages"][0]["title"],$result["pages"][0]["lastModified"]]);`;
  const run=spawnSync("php",["-r",script],{env,encoding:"utf8"});
  assert.equal(run.status,0,run.stderr);
  const value=JSON.parse(run.stdout);
  assert.equal(value[0],"Özel başlık");
  assert.equal(value[1],snapshot.publication.generatedAt);
  console.log("SEO: approved-only entries, manual overrides, fingerprint-bound PHP manifest, preview isolation PASS");
} finally { fs.rmSync(temp,{recursive:true,force:true}); }
