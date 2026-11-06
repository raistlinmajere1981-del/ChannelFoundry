/** Read-only S6 runner for the legacy validator + the installed endpoint gate.
 * Never posts/deploys. An optional fourth argument substitutes the standalone
 * reference gate; that mode is explicitly labelled reference-only. */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import phpRunner from "./vefk-s6-php-runner.cjs";
import {fileURLToPath} from "node:url";
import {readVefkPublication} from "../../docs/contracts/vefk-site-consumer.mjs";
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const source=path.resolve(process.argv[2]??path.join(repo,
  "channels/birdesengor/.local-data/studio/public-export/content/publication.json"));
const phpModule=path.resolve(process.argv[3]??path.join(repo,
  "channels/birdesengor/web/public/api/studio/publication.php"));
const candidateGate=process.argv[4]?path.resolve(process.argv[4]):null;
if(candidateGate&&!fs.existsSync(candidateGate))throw new Error("Aday S6 PHP doğrulayıcısı bulunamadı.");
if(!fs.existsSync(source)||!fs.existsSync(phpModule)){
  console.error("S6 audit: publication JSON veya PHP doğrulayıcı bulunamadı.");
  process.exit(3);
}
const original=JSON.parse(fs.readFileSync(source,"utf8"));
if(!Array.isArray(original?.vefkCatalog?.entries)||
   original.vefkCatalog.entries.length===0){
  console.error("S6 audit: En az bir gerçek Studio vefk kataloğu girdisi gerekiyor.");
  process.exit(3);
}
const phpScript=String.raw`
  function fail(string $message,int $status=422,string $code='invalid'): never {
    throw new RuntimeException($code.':'.$message,$status);
  }
  require getenv('BDG_VEFK_VALIDATOR_PHP');
  try {
    $incoming=stream_get_contents(STDIN);
    $raw=json_decode($incoming,true,512,JSON_THROW_ON_ERROR);
    publication_validate($raw);
    $candidate=getenv('BDG_VEFK_CANDIDATE_PHP');
    if($candidate){
      require_once $candidate;
      $typed=json_decode($incoming,false,512,JSON_THROW_ON_ERROR);
      vefk_s6_validate_publication($typed);
    } else {
      require_once dirname(getenv('BDG_VEFK_VALIDATOR_PHP')).'/publication-vefk.php';
      $typed=json_decode($incoming,false,512,JSON_THROW_ON_ERROR);
      publication_validate_vefk($typed);
    }
    echo json_encode(['accepted'=>true]);
  } catch (Throwable $error) {
    echo json_encode(['accepted'=>false,'error'=>$error->getMessage()]);
  }
`;
function phpCheck(raw){
  const result=phpRunner.runPhp(["-r",phpScript],{
    input:JSON.stringify(raw),encoding:"utf8",
    timeout:10000,maxBuffer:1024*1024,
    env:{...process.env,
      BDG_VEFK_VALIDATOR_PHP:phpModule,
      BDG_VEFK_CANDIDATE_PHP:candidateGate??"",
      CHANNEL_FOUNDRY_PUBLICATION_CONTENT_DIR:path.dirname(source)},
  });
  if(result.error||result.status!==0)throw new Error(
    "PHP test harness çalışmadı: "+(result.stderr||result.error?.message||result.status));
  return JSON.parse(result.stdout);
}
async function jsCheck(raw){
  try { const answer=await readVefkPublication(raw);return {accepted:true,status:answer.status};}
  catch(error){return {accepted:false,error:error.message};}
}
// An invalid path with ALL hashes recomputed must still be rejected by actual
// semantic grammar validation, not merely by a stale top-level fingerprint.
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value===null||typeof value!=="object")return value;
  return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
}
function sha(value){return crypto.createHash("sha256").update(value).digest("hex");}
function rehashPackage(raw){
  const catalog=raw.vefkCatalog, entry=catalog.entries[0],doc=entry.document;
  const {contentHash,...meaning}=doc;
  doc.contentHash=sha(JSON.stringify(canonical(meaning)));
  entry.title=doc.title;
  entry.contentHash=doc.contentHash;
  entry.sha256=sha(JSON.stringify(canonical(doc),null,2)+String.fromCharCode(10));
  entry.url=`vefk/documents/${doc.id}-r${doc.revision}-${entry.sha256.slice(0,16)}.json`;
  const {fingerprint,...catalogMeaning}=catalog;
  catalog.fingerprint=sha(JSON.stringify(canonical(catalogMeaning)));
  const snapshotMeaning={schemaVersion:2,journal:raw.journal,archive:raw.archive,
    assets:raw.assets,youtubeAnalysis:raw.youtubeAnalysis,support:raw.support,vefkCatalog:catalog};
  raw.publication.contentFingerprint=sha(JSON.stringify(canonical(snapshotMeaning)));
}
const corruptions=[
  ["valid_rehashed_title",v=>{v.vefkCatalog.entries[0].document.title="New synthetic title"; rehashPackage(v);}],
  ["unsafe_svg_rehashed",v=>{v.vefkCatalog.entries[0].document.geometry.paths[0].d="M 0 0 L 1 1 onload=unsafe";rehashPackage(v);}],
  ["overlap_strokes_rehashed",v=>{v.vefkCatalog.entries[0].document.drawPlan.strokes[1].startMs=0;rehashPackage(v);}],
  ["unknown_ink_rehashed",v=>{v.vefkCatalog.entries[0].document.geometry.paths[0].ink="missing-style";v.vefkCatalog.entries[0].document.drawPlan.strokes[0].ink="missing-style";rehashPackage(v);}],
  ["semantic_document",v=>{v.vefkCatalog.entries[0].document.title="tampered-document";}],
  ["unsafe_svg_path",v=>{v.vefkCatalog.entries[0].document.geometry.paths[0].d
    ="M 0 0 L 1 1 onload=unsafe";}],
  ["invalid_scene_anchor",v=>{v.vefkCatalog.binding.pen.anchorId="false-quill-tip";}],
  ["catalog_fingerprint",v=>{v.vefkCatalog.fingerprint="0".repeat(64);}],
  ["document_url_traversal",v=>{v.vefkCatalog.entries[0].url="../escape.json";}],
  ["revision_mismatch",v=>{v.vefkCatalog.entries[0].revision+=1;}],
];
let gap=0;
for(const [name,mutate] of [["valid",null],...corruptions]){
  const payload=structuredClone(original);
  mutate?.(payload);
  const [php,js]=await Promise.all([Promise.resolve().then(()=>phpCheck(payload)),jsCheck(payload)]);
  const correct=(name==="valid"||name==="valid_rehashed_title")
    ?php.accepted&&js.accepted:!php.accepted&&!js.accepted;
  if(!correct)gap++;
  console.log(JSON.stringify({scenario:name,phpAccepted:php.accepted,
    siteConsumerAccepted:js.accepted,meetsAcceptance:correct,
    ...(!correct?{phpError:php.error,siteError:js.error}:{})}));
}
if(gap){
  console.error("S6_ACCEPTANCE_BLOCKED="+gap+"; PHP publication_validate derin Vefk doğrulaması gerektiriyor.");
  process.exitCode=2;
}else{
  console.log(candidateGate
    ? "S6_ACCEPTANCE_PASS_REFERENCE_ONLY: PHP referans kapısı ve kanonik tüketici aynı kararları verdi; canlı PHP değişmedi."
    : "S6_ACCEPTANCE_PASS: PHP yayın kabulü ve kanonik tüketici aynı kararları verdi.");
}
