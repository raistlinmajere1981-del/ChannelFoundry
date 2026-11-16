#!/usr/bin/env python3
"""Create and validate ONE pre-import SQLite backup of the canonical Studio DB.

Uses SQLite's online-backup API (safe with WAL); destination is restricted to
the private backup directory. Never creates a disposable working database.
"""
import argparse
import os
from pathlib import Path
import sqlite3
import tempfile

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite"
BACKUPS = ROOT / "channels/birdesengor/.local-data/studio/backups"


def counts(db):
    sections = db.execute("SELECT COUNT(*) FROM narrative_sections WHERE state='active'").fetchone()[0]
    variants = dict(db.execute(
        "SELECT language,COUNT(*) FROM publication_language_variants "
        "WHERE kind='section' AND state='approved' GROUP BY language"))
    videos = set()
    import json
    for (raw,) in db.execute(
        "SELECT r.source_video_ids_json FROM narrative_sections s "
        "JOIN narrative_section_revisions r ON r.id=s.current_revision_id WHERE s.state='active'"):
        videos.update(json.loads(raw))
    return {"sections": sections, "languages": variants, "coveredVideos": len(videos)}


def integrity(db):
    quick = db.execute("PRAGMA quick_check").fetchone()[0]
    foreign = db.execute("PRAGMA foreign_key_check").fetchall()
    if quick != "ok" or foreign:
        raise ValueError(f"SQLite integrity failure: {quick}, foreign_key_violations={len(foreign)}")


def verified_backup(destination: Path, expected_sections: int):
    destination = destination.resolve()
    if destination.parent != BACKUPS.resolve() or destination.suffix != ".sqlite":
        raise ValueError("Backup destination must be a direct .sqlite file in the private backups directory")
    if destination.exists():
        raise FileExistsError(f"Refusing to overwrite existing backup: {destination}")
    BACKUPS.mkdir(parents=True, exist_ok=True)
    temp = None
    source = sqlite3.connect(f"file:{SOURCE.resolve()}?mode=ro", uri=True)
    try:
        integrity(source)
        before = counts(source)
        if before["sections"] != expected_sections:
            raise ValueError(f"Expected {expected_sections} active chapters, got {before['sections']}")
        fd, temp_name = tempfile.mkstemp(prefix=".online-backup-", suffix=".sqlite", dir=BACKUPS)
        os.close(fd)
        temp = Path(temp_name)
        backup = sqlite3.connect(str(temp))
        try:
            source.backup(backup)
        finally:
            backup.close()
        saved = sqlite3.connect(f"file:{temp}?mode=ro", uri=True)
        try:
            integrity(saved)
            actual = counts(saved)
            if before != actual:
                raise ValueError(f"Backup source mismatch: {before} != {actual}")
        finally:
            saved.close()
        # Atomic exclusive link: never replace any existing previous backup.
        os.link(temp, destination)
        return {"path": str(destination), "bytes": destination.stat().st_size,
                "verified": True, **before}
    finally:
        source.close()
        if temp is not None:
            temp.unlink(missing_ok=True)


def verify_existing(destination: Path, expected_sections: int):
    destination = destination.resolve()
    if destination == SOURCE.resolve() or not destination.is_file():
        raise ValueError("Verified backup must be an existing noncanonical SQLite file")
    saved = sqlite3.connect(f"file:{destination}?mode=ro", uri=True)
    try:
        integrity(saved)
        actual = counts(saved)
        if actual["sections"] != expected_sections:
            raise ValueError(f"Backup chapter count mismatch: {actual['sections']}")
        return {"path": str(destination), "bytes": destination.stat().st_size,
                "verified": True, **actual}
    finally:
        saved.close()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    dest = p.add_mutually_exclusive_group(required=True)
    dest.add_argument("--out", type=Path)
    dest.add_argument("--verify-existing", type=Path)
    p.add_argument("--expected-sections", type=int, required=True)
    args = p.parse_args()
    result = (verified_backup(args.out, args.expected_sections)
              if args.out is not None
              else verify_existing(args.verify_existing, args.expected_sections))
    import json
    print("VERIFIED_STUDIO_BACKUP", json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
