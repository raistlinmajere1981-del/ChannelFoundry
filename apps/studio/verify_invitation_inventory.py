#!/usr/bin/env python3
"""Verify source inventory and first-ten evidence packet without writing to the SQLite DB."""
from pathlib import Path
import json,sqlite3,hashlib
root=Path(__file__).resolve().parents[2]
db=root/"channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite"
inv_path=root/"channels/birdesengor/.local-data/studio/invitation-inventory.json"
packet_path=root/"channels/birdesengor/.local-data/studio/dugumlu-first10-source-packet.json"
inv=json.loads(inv_path.read_text(encoding="utf8"))
packet=json.loads(packet_path.read_text(encoding="utf8"))
rows=inv["invitations"]
assert len(rows)==68 and [r["number"] for r in rows]==list(range(1,69))
assert len(packet["records"])==10 and [r["number"] for r in packet["records"]]==list(range(1,11))
assert [r["number"] for r in rows if not r["primary"]]==[25,56,66]
assert [r["number"] for r in rows if len(r["primary"])>1]==[53,65]
assert inv["stats"]["allAnalyzedVideos"]==283
assert inv["stats"]["bookNarratives"]==40
assert not any(r["evidenceNodes"]==[] for r in packet["records"])
with sqlite3.connect("file:"+str(db)+"?mode=ro",uri=True) as connection:
    valid={row[0] for row in connection.execute("SELECT external_id FROM source_ai_analyses")}
    seen=set()
    for r in rows:
        for s in r["primary"]+r["context"]:
            assert s["videoId"] in valid
            assert s["publishedAt"] and s["analysisTitle"] and s["summary"]
            seen.add(s["videoId"])
    assert len(seen)==76
    for x in packet["records"]:
        source=x["sourceVideoId"]
        original=connection.execute("SELECT text FROM source_transcripts WHERE provider='youtube' AND external_id=?",(source,)).fetchone()
        assert original and original[0]==x["originalSubtitle"]
        assert hashlib.sha256(original[0].encode("utf8")).hexdigest()==x["originalSubtitleSha256"]
        assert source==rows[x["number"]-1]["primary"][0]["videoId"]
        assert x["storyBeats"] and x["storyHints"]
        for n in x["evidenceNodes"]:
            assert n["approval"] in ("approved","draft")
            assert n["kind"] in ("character","object","location","event","story")
            for piece in n["preciseVideoEvidence"]:
                assert piece["kind"] in ("details","sequence") and piece["text"]
    assert connection.execute("PRAGMA quick_check").fetchone()[0]=="ok"
print("PASS Düğümlü source inventory: 68 ordinals, 76 sourced videos, 10 complete dossiers, 25/56/66 and 53/65 constraints.")
