#!/usr/bin/env python3
"""Prepare first-ten source evidence packets without changing publication or approvals."""
from pathlib import Path
from collections import Counter
from datetime import datetime,timezone
import sqlite3,json,hashlib
ROOT=Path(__file__).resolve().parents[2]
DB=ROOT/"channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite"
INVENTORY=ROOT/"channels/birdesengor/.local-data/studio/invitation-inventory.json"
OUTPUT=ROOT/"channels/birdesengor/.local-data/studio/dugumlu-first10-source-packet.json"
REPORT=ROOT/"docs/BIRDESENGOR_FIRST10_SOURCE_READINESS_20261116.md"

def j(s,default):
    try:return json.loads(s) if s is not None else default
    except (ValueError,TypeError):return default

def main():
    inv=json.loads(INVENTORY.read_text())["invitations"][:10]
    conn=sqlite3.connect("file:"+str(DB)+"?mode=ro",uri=True)
    conn.row_factory=sqlite3.Row
    try:
        rows=[dict(x) for x in conn.execute(
         "SELECT key,kind,name,summary,state,source_video_ids_json,payload_json "
         "FROM universe_workspace_nodes")]
        packets=[]
        for entry in inv:
            src=entry["primary"][0]
            vid=src["videoId"]
            analysis=conn.execute("SELECT summary,story_beats_json,story_hints_json,core_json "
                "FROM source_ai_analyses WHERE external_id=?",(vid,)).fetchone()
            assert analysis,vid
            transcript=conn.execute("SELECT source,language,text FROM source_transcripts WHERE provider='youtube' AND external_id=?",(vid,)).fetchone()
            assert transcript and transcript['language']=='tr' and transcript['text'],('Source subtitle missing',vid)
            evidence=[]
            for node in rows:
                ids=j(node["source_video_ids_json"],[])
                if vid not in ids:continue
                payload=j(node["payload_json"],{})
                precise=[]
                for field in ("sequence","details"):
                    for item in payload.get(field,[]):
                        if isinstance(item,dict) and vid in item.get("sourceVideoIds",[]):
                            precise.append({"kind":field,"text":item.get("text","")})
                evidence.append({
                  "nodeKey":node["key"],"kind":node["kind"],"name":node["name"],
                  "approval":node["state"],"summary":node["summary"],
                  "preciseVideoEvidence":precise})
            tally=Counter((node["kind"],node["approval"]) for node in evidence)
            packets.append({
                "number":entry["number"],"sourceVideoId":vid,"publishedAt":src["publishedAt"],
                "originalSubtitle":transcript['text'],
                "subtitleSource":transcript['source'],
                "subtitleLanguage":transcript['language'],
                "originalSubtitleSha256":hashlib.sha256(transcript['text'].encode('utf8')).hexdigest(),
                "analysisTitle":src["analysisTitle"],
                "summary":analysis["summary"],
                "storyBeats":j(analysis["story_beats_json"],[]),
                "storyHints":j(analysis["story_hints_json"],[]),
                "evidenceNodes":evidence,
                "reviewStats":{kind+":"+state:count for (kind,state),count in sorted(tally.items())},
                "readyForExistingApprovedOnlyNarration":bool(tally.get(("story","approved")) or tally.get(("event","approved"))),
            })
        report={
          "schemaVersion":1,"generatedAt":datetime.now(timezone.utc).isoformat(),
          "dataRules":[
             "All summaries and story beats are copied from local source AI analyses; not rewritten.",
             "originalSubtitle contains the exact Turkish source transcript; its SHA-256 can be verified.",
             "preciseVideoEvidence contains only details/sequence records with the exact sourceVideoId.",
             "A draft Universe record is not an approved source. This packet is a review staging area, not a narrative publication.",
             "Video publication date is not event chronology."
          ],
          "records":packets,
        }
        OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
        md=["# Düğümlü Kitap — ilk 10 davet / kaynak hazırlık kontrolü","",
            "Kaynak özeti ve hikâye ipuçları özgün AI çözümlemelerinden alınmıştır; onaylı anlatı metni değildir.",
            "",
            "| Davet | Kaynak video | Evren kaynakları | Onaylı olay/hikâye | Taslak olay/hikâye |",
            "|---:|---|---:|---:|---:|"]
        for record in packets:
            count=len(record["evidenceNodes"])
            accepted=sum(1 for n in record["evidenceNodes"] if n["kind"] in ("story","event") and n["approval"]=="approved")
            draft=sum(1 for n in record["evidenceNodes"] if n["kind"] in ("story","event") and n["approval"]=="draft")
            md.append("| "+str(record["number"])+" | "+record["sourceVideoId"]+" | "+
              str(count)+" | "+str(accepted)+" | "+str(draft)+" |")
        md.extend(["","## İlk 10 için editoryal işlem","",
           "1. Olay ve hikâye taslaklarını, orijinal çözümleme metinleriyle karşılaştırarak kontrol etmek.",
           "2. Gerçek çekilmiş davetler için ayrı anlatı üretimine yeterli kanıtları onaylı kaynak olarak belirlemek.",
           "3. Birden fazla davete yayılan story node'larından üç videoyu tek bölümde birleştirmeden, davet başına kaynak izli metin üretmek.",
           "4. Çıktıları onaylamadan ve konu başlığına yerleştirmeden kitap kayıtlarını değiştirmemek.",
           "",
           "## Kaynak başlıkları",""])
        for x in packets:
            md.append("- "+str(x["number"])+". Davet: "+x["analysisTitle"]+" ("+x["sourceVideoId"]+")")
        md.append("")
        REPORT.write_text("\n".join(md),encoding="utf8")
        print(json.dumps({"json":str(OUTPUT),"report":str(REPORT),
          "packets":len(packets),"totalEvidenceNodes":sum(len(p["evidenceNodes"]) for p in packets),
          "reviewRequired":[p["number"] for p in packets if not p["readyForExistingApprovedOnlyNarration"]]},
          ensure_ascii=False,indent=2))
    finally:conn.close()

if __name__=="__main__":main()
