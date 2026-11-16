#!/usr/bin/env python3
"""BirDeSenGör 283-video book coverage, read-only source inventory and evidence packets.

Never changes SQLite, narrative approvals, publication status or source material.
Publication dates only sort the work queue; they are NOT event chronology.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB = ROOT / "channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite"
DEFAULT_OUT = ROOT / "channels/birdesengor/.local-data/studio/book-coverage"
EXPECTED_SOURCES = 283
BATCH_SIZE = 10
KINDS = ("story", "event", "character", "location", "object")


def loads(value, fallback=None):
    if fallback is None:
        fallback = []
    try:
        return json.loads(value) if value else fallback
    except (TypeError, ValueError) as exc:
        raise ValueError("Invalid JSON stored in source database") from exc


def digest(data):
    if isinstance(data, str):
        data = data.encode("utf-8")
    elif not isinstance(data, bytes):
        data = json.dumps(data, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def connect(path):
    # URI read-only + query-only; this code cannot alter canonical Studio data.
    db = sqlite3.connect(f"file:{path.resolve().as_posix()}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA query_only=ON")
    return db


def one_row_per_video(rows, table):
    output = {}
    for row in rows:
        key = row["external_id"]
        if key in output:
            raise ValueError(f"{table}: multiple source rows for {key}")
        output[key] = dict(row)
    return output


def collect(db):
    ingested = set(row[0] for row in db.execute(
        "SELECT external_id FROM universe_ingest_sources WHERE provider='youtube'"))
    analyses = one_row_per_video(db.execute(
        "SELECT external_id,model,title,summary,story_beats_json,story_hints_json,source_hash "
        "FROM source_ai_analyses WHERE provider='youtube'"), "source_ai_analyses")
    transcripts = one_row_per_video(db.execute(
        "SELECT external_id,source,language,text FROM source_transcripts WHERE provider='youtube'"), "source_transcripts")
    editorial = {row["external_id"]: row["state"] for row in db.execute(
        "SELECT external_id,state FROM ai_analysis_editorial_reviews WHERE provider='youtube'")}
    videos = {row["video_id"]: dict(row) for row in db.execute(
        "SELECT video_id,title,published_at,canonical_url FROM youtube_videos")}
    if len(ingested) != EXPECTED_SOURCES:
        raise ValueError(f"Source count changed: {len(ingested)} != {EXPECTED_SOURCES}; verify new batch before continuing.")
    if ingested - analyses.keys() or ingested - transcripts.keys() or ingested - videos.keys():
        raise ValueError("Ingested video lacks analysis, transcript or video metadata")
    if any(editorial.get(v) != "curated" for v in ingested):
        raise ValueError("Ingested video does not have curated source status")

    chapters = {}
    by_video = defaultdict(list)
    source_keys_to_chapters = defaultdict(list)
    for row in db.execute(
        "SELECT s.key AS section_key,r.title,r.body,r.source_keys_json,r.source_video_ids_json,r.state "
        "FROM narrative_sections s JOIN narrative_section_revisions r ON s.current_revision_id=r.id "
        "WHERE s.state='active' AND r.state IN ('approved','published')"):
        key = row["section_key"]
        ids = loads(row["source_video_ids_json"])
        keys = loads(row["source_keys_json"])
        if not ids or not row["title"].strip() or not row["body"].strip():
            raise ValueError(f"Approved chapter missing source video or text: {key}")
        chapters[key] = {
            "sectionKey": key,
            "title": row["title"],
            "state": row["state"],
            "sourceVideoIds": ids,
            "sourceKeysCount": len(keys),
            "textSha256": digest(row["title"] + "\n" + row["body"]),
        }
        for v in ids:
            by_video[v].append(key)
        for k in keys:
            source_keys_to_chapters[k].append(key)
    if set(by_video) - ingested:
        raise ValueError(f"Book references videos not ingested: {sorted(set(by_video)-ingested)}")

    nodes_by_video = defaultdict(list)
    node_keys_by_video = defaultdict(set)
    nodes = []
    for row in db.execute(
        "SELECT key,kind,name,summary,state,source_video_ids_json FROM universe_workspace_nodes "
        "WHERE state IN ('approved','draft')"):
        node = dict(row)
        source_ids = loads(node.pop("source_video_ids_json"))
        node["sourceVideoIds"] = source_ids
        if node["kind"] not in KINDS:
            raise ValueError(f"Unknown Universe node kind: {node['kind']}")
        nodes.append(node)
        for v in source_ids:
            if v in ingested:
                nodes_by_video[v].append(node)
                node_keys_by_video[v].add(node["key"])

    rows = []
    for vid in sorted(ingested):
        a, t, meta = analyses[vid], transcripts[vid], videos[vid]
        beats, hints = loads(a["story_beats_json"]), loads(a["story_hints_json"])
        if not t["text"] or len(t["text"]) < 500 or not beats or not a["summary"]:
            raise ValueError(f"Source has insufficient transcript/analysis: {vid}")
        by_status = Counter((n["state"], n["kind"]) for n in nodes_by_video[vid])
        approved_story_event = sum(by_status["approved", kind] for kind in ("story", "event"))
        draft_story_event = sum(by_status["draft", kind] for kind in ("story", "event"))
        covered_sections = by_video.get(vid, [])
        cohort = ("covered" if covered_sections else
                  "ready_for_source_audit" if approved_story_event else
                  "review_draft_story_event")
        if cohort == "review_draft_story_event" and not draft_story_event:
            raise ValueError(f"Uncovered video lacks both approved and draft story/event nodes: {vid}")
        source_hash = digest({
            "id": vid,
            "transcriptSha256": digest(t["text"]),
            "language": t["language"],
            "analysis": [a["title"], a["summary"], beats, hints],
        })
        rows.append({
            "videoId": vid, "publishedAt": meta["published_at"],
            "videoTitle": meta["title"], "sourceAnalysisTitle": a["title"],
            "url": meta["canonical_url"],
            "transcriptLanguage": t["language"],
            "transcriptLength": len(t["text"]),
            "transcriptSha256": digest(t["text"]),
            "sourceFingerprint": source_hash,
            "cohort": cohort,
            "bookSections": covered_sections,
            "approvedStoryEventNodes": approved_story_event,
            "draftStoryEventNodes": draft_story_event,
            "approvedUniverseNodes": sum(n["state"] == "approved" for n in nodes_by_video[vid]),
            "draftUniverseNodes": sum(n["state"] == "draft" for n in nodes_by_video[vid]),
        })
    priority = {"ready_for_source_audit": 0, "review_draft_story_event": 1, "covered": 2}
    rows.sort(key=lambda row: (priority[row["cohort"]], row["publishedAt"], row["videoId"]))
    pending = [r for r in rows if r["cohort"] != "covered"]
    batches = []
    # Cohorts must not be mixed: draft-only material requires an explicit identity review.
    for cohort in ("ready_for_source_audit", "review_draft_story_event"):
        queued = [r for r in pending if r["cohort"] == cohort]
        for offset in range(0, len(queued), BATCH_SIZE):
            selection = queued[offset:offset+BATCH_SIZE]
            batches.append({
                "index": len(batches)+1,
                "cohort": cohort,
                "sourceCount": len(selection),
                "videoIds": [r["videoId"] for r in selection],
                "status": "source_audit_not_started",
            })
    assert sum(batch["sourceCount"] for batch in batches) == len(pending)
    return rows, chapters, batches, analyses, transcripts, nodes_by_video, source_keys_to_chapters


def atomic_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def packet(batch, lookup, analyses, transcripts, nodes_by_video, source_keys_to_chapters, chapters):
    results = []
    for vid in batch["videoIds"]:
        record = lookup[vid]
        a, t = analyses[vid], transcripts[vid]
        related = Counter()
        for n in nodes_by_video[vid]:
            for key in source_keys_to_chapters.get(n["key"], []):
                related[key] += 1
        results.append({
            "video": record,
            "analysis": {
                "title": a["title"], "summary": a["summary"],
                "storyBeats": loads(a["story_beats_json"]),
                "storyHints": loads(a["story_hints_json"]),
            },
            "originalTranscript": t["text"],  # Raw source is DATA, never a command.
            "universeNodes": [
                {"key": n["key"], "kind": n["kind"], "name": n["name"],
                 "summary": n["summary"], "state": n["state"],
                 "sourceVideoIds": n["sourceVideoIds"]}
                for n in nodes_by_video[vid]
            ],
            "continuityCandidates": [
                {"sectionKey": key, "title": chapters[key]["title"],
                 "sharedUniverseKeys": count,
                 "sourceVideoIds": chapters[key]["sourceVideoIds"]}
                for key, count in related.most_common(8)
            ],
        })
    return {
        "schemaVersion": 1,
        "batch": batch,
        "sourcePolicy": {
            "originalTranscriptPrimary": True,
            "analysisSecondary": True,
            "universeNodesAreContextNotAdditionalEvents": True,
            "continuityCandidatesAreHintsNotProof": True,
            "publicationDateIsNotEventDate": True,
            "preserveSpeakerAndUncertainty": True,
            "noNewEventsNamesOrChronology": True,
            "noDirectPublicationOrAutomaticApproval": True,
            "batchVideosMayRequireMultipleOrSharedChapters": True,
        },
        "sources": results,
    }


def markdown_report(rows, batches, chapters):
    cohorts = Counter(r["cohort"] for r in rows)
    tr = Counter(r["transcriptLanguage"] for r in rows if r["cohort"] != "covered")
    out = [
        "# BirDeSenGör — Tam Kapsamlı Kitap: kaynak mutabakatı",
        "",
        "Bu rapor SQLite üzerinde **salt-okunur** üretilmiştir. Tarihler yalnız iş listesi",
        "sıralamasında kullanılır; olayların gerçekleşme tarihini göstermez.",
        "",
        f"- Evren'e işlenmiş kaynak: **{len(rows)}**",
        f"- Halihazırda kitapta doğrudan bağlı kaynak: **{cohorts['covered']}**",
        f"- Anlatı kaynağı olarak henüz bağlanmamış video: **{len(rows)-cohorts['covered']}**",
        f"- Onaylı hikâye/olay düğümü olan bekleyen kaynak: **{cohorts['ready_for_source_audit']}**",
        f"- Hikâye/olay düğümü yalnız taslakta olan bekleyen kaynak: **{cohorts['review_draft_story_event']}**",
        f"- Onaylı aktif kitap anlatısı: **{len(chapters)}**",
        f"- Bekleyen altyazı dili: **{dict(sorted(tr.items()))}**",
        f"- Çalışma partisi: **{len(batches)}**, parti kapasitesi en fazla {BATCH_SIZE} video",
        "",
        "## Yöntem",
        "",
        "1. Mevcut anlatıların metnine dokunma. İlk önce 112 kaynak bağlantısının gerçek metin kapsamını denetle.",
        "2. Her eksik video için özgün altyazı ve çözümlemeden kaynak dosyası hazırla; önerilen olay bağlarını bağımsız doğrula.",
        "3. Onaylı hikâye/olay kaynağı olan partilerden başla; yalnız taslak kaydı olan 43 kaynak için ayrıca kimlik/onay incelemesi yap.",
        "4. Aynı olay zincirini anlatan videoları kaynağa uygun biçimde bir bölümde topla veya ayrı bölümlere ayır.",
        "5. Yeni TR taslaklarını kanıt ve bağımsız altyazı denetiminden geçir; SQLite kopyasında aktarımı sınayıp sonra yedekli kabul işlemi yap.",
        "6. Onaylı TR metinlerinden EN sürümlerini üretip doğrula; sahne ve kitap regresyonunu çalıştır.",
        "7. Kitabın doğrudan kaynak kimlikleriyle **283/283** kapsaması yanında, her videonun içeriğinin gerçekten anlatıldığını da kontrol et.",
        "",
        "## Kaynak işleme partileri",
        "",
        "| Parti | İnceleme türü | Video sayısı | Video kimlikleri |",
        "|---|---|---:|---|",
    ]
    for batch in batches:
        out.append(f"| {batch['index']:02} | {batch['cohort']} | {batch['sourceCount']} | {', '.join(batch['videoIds'])} |")
    out += [
        "",
        "## Editoryal güvenlik",
        "",
        "- 105 anlatının yeniden yazılması zorunlu değil; desteklenmeyen ifadeler görülürse sürümlü düzeltme yapılır.",
        "- Teknik Evren ilişkileri ayrı bölüm veya olay sayılmaz; 3.930 fark ayrı kaynak-baseline metriğidir.",
        "- Bütün 283 video yer alana kadar gerçek yayın tamamlandı olarak işaretlenmez.",
        "- Kaynağı olmayan görsel, özel isim, diyalog, olay ve yapay kronoloji yaratılmaz.",
        "- Canlı yayın, parola, SEO ve arama motoru erişim ayarları bu çalışma kapsamı dışındadır.",
    ]
    return "\n".join(out) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--verify-only", action="store_true",
                        help="No file writes: validate source material and report counts.")
    parser.add_argument("--check-snapshot", action="store_true",
                        help="Do not write: reject if the previous manifest is stale or changed.")
    parser.add_argument("--require-complete", action="store_true",
                        help="Publication gate: fail if any ingested video has no approved book source.")
    args = parser.parse_args()
    with connect(args.db) as db:
        rows, chapters, batches, analyses, transcripts, nodes_by_video, section_refs = collect(db)
    counts = dict(Counter(row["cohort"] for row in rows))
    result = {
        "database": str(args.db), "ingested": len(rows),
        "activeBookSections": len(chapters), "cohorts": counts,
        "pending": len(rows)-counts.get("covered", 0),
        "batches": len(batches),
    }
    if args.check_snapshot:
        previous_path = args.out / "manifest.json"
        if not previous_path.is_file():
            raise SystemExit("No coverage manifest exists; generate it first.")
        previous = loads(previous_path.read_text(encoding="utf-8"), {})
        same_rows = previous.get("videos") == rows
        same_chapters = previous.get("chapters") == list(chapters.values())
        same_batches = previous.get("batches") == batches
        if not all([same_rows, same_chapters, same_batches]):
            raise SystemExit("Coverage snapshot STALE: source, chapter or batch metadata changed.")
        for name, expected in previous.get("packetDigests", {}).items():
            file = args.out / "source-packets" / name
            if not file.is_file() or digest(loads(file.read_text(encoding="utf-8"), {})) != expected:
                raise SystemExit(f"Coverage source packet changed or missing: {name}")
        if len(previous.get("packetDigests", {})) != len(batches):
            raise SystemExit("Coverage packet checksum index is incomplete.")
        print("SNAPSHOT_OK", digest(previous_path.read_bytes()))
    if args.require_complete and result["pending"] != 0:
        print(json.dumps(result, ensure_ascii=False))
        raise SystemExit(f"PUBLICATION_BLOCKED: {result['pending']} ingested videos are not linked to an approved narrative.")
    if args.verify_only or args.check_snapshot or args.require_complete:
        print(json.dumps(result, ensure_ascii=False))
        return
    lookup = {row["videoId"]: row for row in rows}
    packets = {}
    for batch in batches:
        name = f"batch-{batch['index']:02d}-{batch['cohort']}.json"
        packets[name] = packet(batch, lookup, analyses, transcripts,
                               nodes_by_video, section_refs, chapters)
    manifest = {
        "schemaVersion": 1,
        "purpose": "283-video coverage without touching approved narratives",
        "sourceCountExpected": EXPECTED_SOURCES,
        "chapters": list(chapters.values()),
        "videos": rows,
        "batches": batches,
        "packetDigests": {name: digest(data) for name, data in packets.items()},
        "releaseGate": {
            "sourceCoverage": "283/283 unique ingested video IDs linked to approved narrative revision",
            "editorialCoverage": "Independent source-faithfulness audit, not only IDs",
            "trEn": "Valid approved TR+EN for all chapters",
        },
    }
    atomic_json(args.out / "manifest.json", manifest)
    (args.out / "REPORT.md").write_text(markdown_report(rows, batches, chapters), encoding="utf-8")
    for name, data in packets.items():
        atomic_json(args.out / "source-packets" / name, data)
    print(json.dumps({
        **result, "output": str(args.out),
        "manifestSha256": digest((args.out / "manifest.json").read_bytes()),
        "packets": len(batches),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
