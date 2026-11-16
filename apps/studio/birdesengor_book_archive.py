#!/usr/bin/env python3
"""Archive a source-audited, locally approved BirDeSenGör video batch, without deleting evidence.

Run only after the batch has been imported into the local Studio SQLite.
Example:
  python3 -B apps/studio/birdesengor_book_archive.py \
    --plan channels/birdesengor/.local-data/studio/book-coverage/batch-02-editorial-decisions.json \
    --packet channels/birdesengor/.local-data/studio/book-coverage/source-packets/batch-01-ready_for_source_audit.json \
    --name batch-02-20261116 --apply
By default prints what would be archived; moves only when --apply is given.
"""
import argparse
import hashlib
import json
import re
import shutil
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "channels/birdesengor/.local-data/studio/book-coverage"
STUDIO_DB = ROOT / "channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite"
FILES = (".json", ".audit.json", ".audit.seal.json", ".codex.log", ".audit.codex.log",
         ".metrics.json", ".audit.metrics.json")


def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def content(file):
    return json.loads(file.read_text(encoding="utf8"))


def safe_file(value):
    p = Path(value).resolve()
    if not p.is_file() or (BASE != p and BASE not in p.parents):
        raise ValueError(f"Only files inside the local book coverage directory: {p}")
    return p


def batch_files(plan_file, packet_file):
    plan = content(plan_file)
    packet = content(packet_file)
    records = packet["sources"]
    decisions = plan["decisions"]
    if not (len(records) == len(decisions) == plan["sourceCount"] <= 10):
        raise ValueError("Plan and source packet size do not match")
    db = sqlite3.connect(f"file:{STUDIO_DB}?mode=ro", uri=True)
    selected = []
    try:
        for record, dec in zip(records, decisions):
            vid = record["video"]["videoId"]
            if not re.fullmatch(r"[A-Za-z0-9_-]{11}", vid):
                raise ValueError(f"Invalid video ID {vid}")
            if vid != dec["videoId"] or dec["sectionKey"] != "narrative-section-video-" + vid:
                raise ValueError("Video and section identities mismatch")
            source_root = BASE / "drafts"
            files = [source_root / (vid + ext) for ext in FILES]
            for f in files[:3]:
                if not f.is_file():
                    raise ValueError(f"Draft/audit evidence missing: {f}")
            draft, audit, seal = [content(f) for f in files[:3]]
            if (draft["sourceVideoIds"] != [vid] or audit["videoId"] != vid
                or audit["verdict"] != "pass" or audit["issues"]):
                raise ValueError(f"Source audit not clean for {vid}")
            if (dec["draftSha256"] != sha(files[0])
                or dec["auditSha256"] != sha(files[1])
                or seal["draftSha256"] != sha(files[0])
                or seal["auditSha256"] != sha(files[1])
                or seal["sourceFingerprint"] != dec["sourceFingerprint"]
                or record["video"]["sourceFingerprint"] != dec["sourceFingerprint"]):
                raise ValueError(f"Audit/source fingerprint mismatch: {vid}")
            row = db.execute(
                """SELECT r.source_video_ids_json,r.state,s.state
                FROM narrative_sections s
                JOIN narrative_section_revisions r ON r.id=s.current_revision_id
                WHERE s.key=?""", (dec["sectionKey"],)
            ).fetchone()
            if not row or json.loads(row[0]) != [vid] or row[1] != "approved" or row[2] != "active":
                raise ValueError(f"Source has not been approved in the local book: {vid}")
            for item in (BASE / "drafts/audit-attempts").glob(vid + "*"):
                if item.is_file():
                    files.append(item)
            selected.append((vid, [f for f in files if f.exists()]))
    finally:
        db.close()
    return selected


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--plan", required=True)
    ap.add_argument("--packet", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    if not re.fullmatch(r"batch-\d{2}-\d{8}", args.name):
        ap.error("--name must look like batch-02-20261116")
    plan_file = safe_file(args.plan)
    packet_file = safe_file(args.packet)
    selected = batch_files(plan_file, packet_file)
    folder = BASE / "completed-batches" / args.name
    print(json.dumps({"archive": str(folder), "count": len(selected),
                      "videos": [x[0] for x in selected],
                      "files": sum(len(x[1]) for x in selected),
                      "apply": args.apply}, ensure_ascii=False))
    if not args.apply:
        return
    folder.mkdir(parents=True, exist_ok=True)
    for dest, original in (
        (folder / "packet.json", packet_file),
        (folder / "editorial-decisions.json", plan_file),
        (folder / "manifest-before.json", BASE / "manifest.json"),
        (folder / "REPORT-before.md", BASE / "REPORT.md"),
    ):
        if dest.resolve() == original.resolve():
            continue
        if dest.exists():
            # The first completed batch may already have its correct historical
            # manifest/report; never overwrite them with the *current* queue.
            if dest.name in ("packet.json", "editorial-decisions.json") and sha(dest) != sha(original):
                raise ValueError(f"Existing archived evidence changed: {dest}")
        elif original.is_file():
            shutil.copy2(original, dest)
    for vid, files in selected:
        for source in files:
            if "audit-attempts" in source.parts:
                dest = folder / "audit-attempts" / source.name
            else:
                dest = folder / "drafts" / source.name
            dest.parent.mkdir(parents=True, exist_ok=True)
            if dest.exists():
                raise ValueError(f"Refusing to overwrite archive evidence: {dest}")
            shutil.move(str(source), str(dest))
        print("ARCHIVED", vid)
    print("ARCHIVE_COMPLETE", folder)


if __name__ == "__main__":
    main()
