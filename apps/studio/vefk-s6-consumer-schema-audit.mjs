/** S6 schema strictness audit — read-only, uses a NEW 3x3 fixture.
 * Exits 2 while the V2 site consumer accepts a schema v1 document carrying
 * an unknown 'easing' key that S1 rejects. Never publishes or writes state. */
import {createRequire} from "node:module";
import phpRunner from "./vefk-s6-php-runner.cjs";
import crypto from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {readVefkPublication} from "../../docs/contracts/vefk-site-consumer.mjs";
const require=createRequire(import.meta.url);
const core=require("./vefk-core/index.cjs");
const publisher=require("./vefk-publication.cjs");
const sha=value=>crypto.createHash("sha256").update(value).digest("hex");
const doc=structuredClone(core.createVefk({id:"s6-schema-3x3",title:"S6 · Şema denetimi",
  kind:"magicSquare",parameters:{order:3}}));
doc.drawPlan.strokes[0].easing="ease-in";
doc.contentHash=core.documentHash(doc);
const body=JSON.stringify(core.canonical(doc),null,2)+String.fromCharCode(10);
const fileSha=sha(body);
const entry={id:doc.id,revision:doc.revision,order:0,title:doc.title,
  contentHash:doc.contentHash,url:`vefk/documents/${doc.id}-r${doc.revision}-${fileSha.slice(0,16)}.json`,
  sha256:fileSha,document:doc};
const logical={format:"birdesengor.vefk-catalog",schemaVersion:1,
  binding:publisher.BINDING,entries:[entry]};
const raw={
  schemaVersion:2,
  publication:{id:"pub-"+("a".repeat(24)),generatedAt:"2026-11-04T09:00:00.000Z",contentFingerprint:""},
  journal:{sections:[]},archive:{entities:[],relations:[]},assets:[],
  youtubeAnalysis:{},support:{sponsors:[],contributors:[]},
  vefkCatalog:{...logical,fingerprint:sha(core.canonicalString(logical))},
};
const semantic={schemaVersion:2,journal:raw.journal,archive:raw.archive,assets:raw.assets,
  youtubeAnalysis:raw.youtubeAnalysis,support:raw.support,vefkCatalog:raw.vefkCatalog};
raw.publication.contentFingerprint=sha(core.canonicalString(semantic));
let coreRejected=false,siteRejected=false,phpRejected=false;
try{core.validateVefk(doc);}catch{coreRejected=true;}
try{await readVefkPublication(raw);}catch{siteRejected=true;}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const phpGate=path.join(root,"docs/contracts/vefk-s6-php-gate.php");
const phpCode=`
require getenv('BDG_S6_GATE_FILE');
try{$typed=json_decode(stream_get_contents(STDIN),false,512,JSON_THROW_ON_ERROR);
vefk_s6_validate_publication($typed);echo 'ACCEPT';}
catch(Throwable $e){echo 'REJECT';}
`;
const php=phpRunner.runPhp(["-r",phpCode],{input:JSON.stringify(raw),encoding:"utf8",
  timeout:9000,env:{...process.env,BDG_S6_GATE_FILE:phpGate}});
if(php.error||php.status!==0)throw new Error("PHP şema testi çalıştırılamadı.");
phpRejected=php.stdout.trim()==="REJECT";
console.log(JSON.stringify({
  testcase:"unknown_schema_v1_stroke_easing_with_all_hashes_recomputed",
  s1CoreRejected:coreRejected,siteConsumerRejected:siteRejected,
  phpReferenceRejected:phpRejected,
}));
if(!coreRejected||!phpRejected||!siteRejected){
  console.error("S6_SITE_SCHEMA_STRICTNESS_BLOCKED: Site tüketicisi v1'e yeni easing alanını sessizce kabul ediyor.");
  process.exitCode=2;
}else console.log("S6_SITE_SCHEMA_STRICTNESS_PASS");
