#!/usr/bin/env python3
"""Source-verified invitation inventory. Read-only against the Studio database."""
from __future__ import annotations
import json, sqlite3
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite"
JSON_PATH = ROOT / "channels/birdesengor/.local-data/studio/invitation-inventory.json"
MD_PATH = ROOT / "docs/BIRDESENGOR_INVITATION_SOURCE_INVENTORY_20261116.md"

# Format: invitation number | primary source video ID(s) | contextual or interrupted video ID(s)
CURATED = """
1|d2E63kVyPOE|
2|B49wSEMIJp4|
3|LEXITVry_KM|
4|CY1p1Kl3yq8|
5|GBWjZdDdQnM|
6|Hgfcw5d7qQ0|
7|ISMxJ21z2hE|
8|Rkgb5m1_hCU|
9|FY_4RKkKgP8|
10|Qwihe3g4YMk|
11|Ex0jZfdwm8A|
12|lNS2PlBbcRQ|
13|dT_acDEbszs|
14|GykoHHq8dwY|
15|lh3t9im7_XM|
16|JHIJhiO46uc|
17|Kt8viodA4fo|
18|UDNgpzPnqLI|
19|ihgYd_g5LRc|
20|nf5wF2522J4|
21|qxXCjDb_aDk|
22|9rRImbG4i7g|
23|is6FwYJGqQM|
24|qZ-1pE-hegw|
25||xD-hwrjnwN4
26|26tlNsiIWAs|
27|xD-hwrjnwN4|
28|hjTPBm-Vhfs|
29|4C6DTVJmV6k|
30|Dyc3mWCivdU|c-_2frDys3A
31|PM3iOrQz9Go|
32|RFFja8s-rZc|
33|YC8tQuDiAUs|
34|zV-4dBIzxkE|
35|2_f3Q12UWUI|
36|FWZv3gZwzWQ|
37|ks_t-2qG70c|
38|mMV8CaTuJfg|
39|p6fOLHMNjIw|
40|M7fegtjQ77c|
41|eHbb65Uwosc|
42|yd_kFRMZyBg|EqZnbZ79CX0
43|kqKGA8OFfjk|83zRrtHOLpY
44|MDZ2eN2jwLw|ssIoRuvNVVI
45|PjJnC72eqC4|
46|VONpyD0uiRw|
47|bPbtTSMhZzY|
48|l0lAhn3GONY|
49|hBAKlZU3Ks8|
50|NFwoVjcL24c|
51|4JoGFIy52J8|
52|DfWJVaWecEY|
53|gk_MMLQbtV4;DJr6qb4e7Zw|
54|Sy3vXDLdbwQ|hwvh1DqbKig
55|I8ec5jhbTH4|
56||buuuup7zp-E
57|dYHnca5K4aI|
58|Kcub4XOy1bY|
59|rGIKSmpOnGM|
60|lN2bmzcMoNc|tRrjV_6byFE
61|8L9rWJ1Jb4Y|
62|698Ia17OvZU|
63|XciFJGYIb6o|ocEL2eD-q7Q
64|hzLrp3OHiMY|
65|HGzLMopTOcE;SRuNOrQt7Mk|
66||Dm-So3B-sOc
67|onYXwP5erec|
68|EOduw3YyN4g|
""".strip()

NOTES = {
 25: "27. davet çözümlemesinde Ömer'in bireysel yaptığını fakat çekmediğini anlattığı davet. Görüntüsü varmış gibi yazılmamalı.",
 30: "Hedna görüşmesi gerçek 30. davetli değil, ön hazırlıktır.",
 42: "Önce gelen Necemin yardımcısı 42. davetli olmadığını söyler; sonraki video asıl davetli görüşmesidir.",
 43: "İlk çağrıda davetsiz kişiler; sonraki videoda asıl 43. davetli tanıtılır.",
 44: "İlk haberci 44. davetli değildir, asıl görüşme sonraki videodadır.",
 53: "Ekim ve Aralık kayıtlarında 53. davetli adı yeniden kullanılıyor; ayrı görüşmeler birleştirilmemeli.",
 54: "27 Nisan'da mühürlü kapıdan davetsizler gelir, 2 Mayıs'ta asıl 54. davetli görüşülür.",
 56: "Çağrı engellenir, asıl davetli görünmez; yardımcının aktardığı haber asıl kişiyle görüşme değildir.",
 60: "İlk görüşmedeki Rauf 60. davetli değildir; sonraki kayıt asıl davetli görüşmesidir.",
 63: "İlk kayıt Efendi Karon müdahalesi, sonraki kayıt asıl 63. davetli görüşmesidir.",
 65: "Ağustos ve Eylül videolarında ikisinde de 65. davetli anılıyor. Tek kişi/tek kesintisiz görüşme varsayılmamalı.",
 66: "Davet engellenmiş. Asıl 66. davetlinin konuştuğu bir kayıt henüz eşleşmedi.",
}
def main():
    connection = sqlite3.connect("file:" + str(DB) + "?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        sources = {row["external_id"]: dict(row) for row in connection.execute(
          "SELECT a.external_id, a.title analyzedTitle, a.summary, y.title videoTitle,"
          " y.published_at publishedAt FROM source_ai_analyses a"
          " JOIN youtube_videos y ON y.video_id=a.external_id")}
        story_ids=set()
        for row in connection.execute("SELECT r.source_video_ids_json vids FROM narrative_sections s"
          " JOIN narrative_section_revisions r ON r.id=s.current_revision_id"):
            try: story_ids.update(json.loads(row["vids"]))
            except (ValueError,TypeError): pass
        seen={}
        rows=[]
        for line in CURATED.splitlines():
            number, primary_csv, context_csv = line.split("|")
            number=int(number)
            def video_list(text,role):
                result=[]
                for key in filter(None,text.split(";")):
                    assert key in sources, ("Unknown source ID",key)
                    assert key not in seen or (key=="xD-hwrjnwN4" and number in (25,27) and seen[key] in (25,27)), ("Duplicate conflicting video",key)
                    seen.setdefault(key,number)
                    src=sources[key]
                    result.append({
                      "videoId":key,"role":role,"publishedAt":src["publishedAt"],
                      "analysisTitle":src["analyzedTitle"],"videoTitle":src["videoTitle"],
                      "summary":src["summary"],"alreadyNarrated":key in story_ids,
                      "url":"https://www.youtube.com/watch?v="+key})
                return result
            primary=video_list(primary_csv,"primary")
            context=video_list(context_csv,"context")
            status=("not_filmed" if number==25 else "interrupted_only" if not primary
               else "multiple_recordings_same_number" if len(primary)>1
               else "direct_with_interruption_or_prelude" if context else "direct_recording")
            rows.append({"series":"Düğümlü Kitap","number":number,"status":status,
              "primary":primary,"context":context,"note":NOTES.get(number,""),
              "requiresEditorialReview":len(primary)!=1 or bool(context)})
        assert [r["number"] for r in rows]==list(range(1,69))
        stats={
          "allAnalyzedVideos":len(sources),
          "bookNarratives":connection.execute("SELECT count(*) FROM narrative_sections").fetchone()[0],
          "invitationNumbers":len(rows),
          "numberedWithDirectVideos":sum(bool(r["primary"]) for r in rows),
          "withoutDirectVideo":[r["number"] for r in rows if not r["primary"]],
          "multiVideoNumbers":[r["number"] for r in rows if len(r["primary"])>1],
          "primaryVideos":sum(len(r["primary"]) for r in rows),
          "uniqueMappedVideos":len(seen),
          "firstTenPrepared":all(len(r["primary"])==1 and not r["context"]
                                  and not r["primary"][0]["alreadyNarrated"] for r in rows[:10]),
        }
        output={"schemaVersion":1,"generatedAt":datetime.now(timezone.utc).isoformat(),
                "method":"Manual invitation/video matching reviewed against source_ai_analyses and youtube_videos. Dates are publication dates, not event dates.",
                "stats":stats,"invitations":rows}
        JSON_PATH.parent.mkdir(parents=True,exist_ok=True)
        JSON_PATH.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
        md=[
          "# BirDeSenGör — Düğümlü Kitap davet kaynak envanteri",
          "",
          "Kaynak: Studio AI çözümlemeleri ve video kayıtları. Bu bir kaynak envanteridir, tamamlanmış kitap anlatısı değildir.",
          "Yayın tarihi çekim/olay tarihi değildir. Her kaynak video bağlantısı doğrudan yerel kaydın video ID'sinden üretilmiştir.",
          "",
          "## Envanter sayıları",
          "",
          "- 283 çözümleme, 40 mevcut kitap anlatısı.",
          "- 68 davet numarasından "+str(stats["numberedWithDirectVideos"])+" tanesinde doğrudan davet kaydı eşleşiyor.",
          "- Doğrudan video bulunmayan numaralar: "+", ".join(map(str,stats["withoutDirectVideo"]))+".",
          "- Aynı numarayla farklı doğrudan kayıt bulunanlar: "+", ".join(map(str,stats["multiVideoNumbers"]))+".",
          "- Toplam "+str(stats["primaryVideos"])+" birincil video bağlantısı; bağlam dahil "+str(stats["uniqueMappedVideos"])+" benzersiz video.",
          "",
          "## 1–68 kaynak haritası",
          "",
          "| Davet | Durum | Birincil kaynak | Ön hazırlık / kesinti | Not |",
          "|---:|---|---|---|---|",
        ]
        for r in rows:
            link=lambda a:"; ".join("["+x["videoId"]+"]("+x["url"]+") ("+x["publishedAt"]+")" for x in a) or "—"
            md.append("| "+str(r["number"])+" | "+r["status"]+" | "+link(r["primary"])+
              " | "+link(r["context"])+" | "+r["note"].replace("|","/")+" |")
        md.extend(["","## İlk 10 davetin anlatı kaynakları",""])
        for r in rows[:10]:
            x=r["primary"][0]
            md.extend(["### "+str(r["number"])+". Davet — "+x["analysisTitle"],
               "", "- Kaynak: ["+x["videoId"]+"]("+x["url"]+")",
               "- Video yayın tarihi: "+x["publishedAt"],
               "- Kaynak çözümlemesi: "+x["summary"].replace("\n"," "), ""])
        md.extend(["## Editoryal kurallar","",
          "1. Bir davet numarası her zaman bir video demek değildir. Önceki/sonraki görüşme ve müdahale olayları kaynağa göre ayrılır.",
          "2. 25, 56 ve 66 için gerçekleşmiş ve doğrudan kaydedilmiş bir davetli görüşmesi varsayılmaz.",
          "3. 53 ve 65 tekrar eden numaraların aynı kişi veya aynı sahneye ait olduğu kendiliğinden varsayılmaz.",
          "4. Bu envanterdeki bilgiler kitap metinlerini, onayları, yayın paketini veya Evren kayıtlarını değiştirmez.",
          "5. Kayıtlardan anlatıya dönüşüm ayrı bir onaylı Hikâyeleştirme aşamasıdır.",""])
        MD_PATH.write_text("\n".join(md),encoding="utf8")
        print(json.dumps({"json":str(JSON_PATH),"markdown":str(MD_PATH),"stats":stats},ensure_ascii=False,indent=2))
    finally: connection.close()

if __name__=="__main__":main()
