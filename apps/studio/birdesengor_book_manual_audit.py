#!/usr/bin/env python3
"""Prepare/commit assistant-conducted source audits with explicit quote evidence.

This tool makes NO model calls and writes NO SQLite data.
Preparing creates a blank review and a source reading sheet. Committing requires
the reviewer to have checked every draft paragraph and supplied distributed
verbatim evidence comparing original subtitle and draft. No automatic passes.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys

from birdesengor_book_batch import (
    audit_check, draft_check, files_for, job_data, load_json, seal_audit
)
from birdesengor_book_coverage import DEFAULT_OUT, digest


def find_job(video_id: str, out: Path):
    jobs = [job for job in job_data(out) if job["video"]["videoId"] == video_id]
    if len(jobs) != 1:
        raise ValueError(f"Video ID is not in the current source queue: {video_id}")
    return jobs[0]


def paths(out: Path, job):
    draft, audit = files_for(out, job)
    review = out / "drafts" / f"{job['video']['videoId']}.review.evidence.json"
    reading = out / "drafts" / f"{job['video']['videoId']}.source-reading.txt"
    return draft, audit, review, reading


def paragraphs(draft):
    return [p.strip() for p in re.split(r"\n\s*\n", draft["body"]) if p.strip()]


def prepare(out: Path, job):
    draft_path, audit, review, reading = paths(out, job)
    if not draft_path.is_file():
        raise ValueError("No first draft. Produce draft before manual review.")
    draft = load_json(draft_path)
    errors = draft_check(draft, job)
    if errors:
        raise ValueError(f"Draft invalid: {errors}")
    if audit.exists() and audit.stat().st_size:
        raise ValueError("Existing audit present; do not overwrite signed source review.")
    ps = paragraphs(draft)
    if not review.exists():
        template = {
            "schemaVersion": 1,
            "videoId": job["video"]["videoId"],
            "sourceFingerprint": job["video"]["sourceFingerprint"],
            "draftSha256": digest(draft_path.read_bytes()),
            "reviewMethod": "assistant-source-review",
            "paragraphsReviewed": [],
            "evidence": [],
            "verdict": "review",
            "issues": [],
            "coverageNote": "",
        }
        review.write_text(json.dumps(template, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    if reading.exists() and digest(draft_path.read_bytes()) not in reading.read_text(encoding="utf8").splitlines()[:7]:
        raise ValueError("Existing source reading sheet is stale; archive it before re-preparing")
    if not reading.exists():
        material = [
            f"VIDEO {job['video']['videoId']}",
            f"TITLE {draft['title']}",
            f"SOURCE FINGERPRINT {job['video']['sourceFingerprint']}",
            f"DRAFT SHA-256 {digest(draft_path.read_bytes())}",
            f"PARAGRAPH COUNT {len(ps)}",
            "",
            "=== DRAFT PARAGRAPHS (every paragraph requires independent source review) ===",
        ]
        for i, paragraph in enumerate(ps):
            material.append(f"\n[{i:02d}] {paragraph}")
        material.extend(["", "=== ORIGINAL SUBTITLE (PRIMARY SOURCE ONLY) ===", job["transcript"]])
        reading.write_text("\n".join(material) + "\n", encoding="utf8")
    print("MANUAL_REVIEW_PREPARED", json.dumps({
        "videoId": job["video"]["videoId"], "paragraphs": len(ps),
        "reviewEvidence": str(review), "readOnlySourceSheet": str(reading),
        "noModelCalls": True, "noDbWrites": True
    }, ensure_ascii=False))


def commit(out: Path, job):
    draft_path, audit_path, evidence_path, reading = paths(out, job)
    if audit_path.exists() and audit_path.stat().st_size:
        raise ValueError("Audit already exists; never silently replace an existing review.")
    draft = load_json(draft_path)
    if draft_check(draft, job):
        raise ValueError("Invalid source draft")
    e = load_json(evidence_path)
    if (e.get("schemaVersion") != 1
        or e.get("reviewMethod") != "assistant-source-review"
        or e.get("videoId") != job["video"]["videoId"]
        or e.get("sourceFingerprint") != job["video"]["sourceFingerprint"]
        or e.get("draftSha256") != digest(draft_path.read_bytes())):
        raise ValueError("Source review evidence is stale or belongs to a different draft")
    ps = paragraphs(draft)
    checked = e.get("paragraphsReviewed")
    if checked != list(range(len(ps))):
        raise ValueError(f"Each paragraph must be individually reviewed (expected 0..{len(ps)-1})")
    witnesses = e.get("evidence")
    if not isinstance(witnesses, list) or len(witnesses) < 5:
        raise ValueError("At least five concrete source-to-draft comparisons required")
    positions = set()
    for entry in witnesses:
        if not isinstance(entry, dict):
            raise ValueError("Invalid evidence entry")
        quote = entry.get("sourceExcerpt", "")
        claim = entry.get("draftExcerpt", "")
        reasoning = entry.get("comparison", "")
        if (not isinstance(quote, str) or len(quote.strip()) < 12 or
            quote not in job["transcript"]):
            raise ValueError("Evidence sourceExcerpt must appear verbatim in original subtitle")
        if (not isinstance(claim, str) or len(claim.strip()) < 12 or
            claim not in draft["body"]):
            raise ValueError("Evidence draftExcerpt must appear verbatim in actual draft")
        if not isinstance(reasoning, str) or len(reasoning.strip()) < 16:
            raise ValueError("Comparison must explain what was checked; no generic passes")
        offset = job["transcript"].find(quote)
        positions.add(min(2, 3 * offset // max(1, len(job["transcript"]))))
    if len(positions) < 3:
        raise ValueError("Witnesses must sample beginning, middle, and end of original subtitle")
    note = e.get("coverageNote", "")
    if not isinstance(note, str) or len(note.strip()) < 70:
        raise ValueError("Explain what was reviewed, uncertain names/actors and any omissions")
    result = {
        "videoId": job["video"]["videoId"], "verdict": e.get("verdict"),
        "issues": e.get("issues"), "coverageNote": note,
        "reviewMethod": "assistant-source-review",
        "reviewEvidenceSha256": digest(evidence_path.read_bytes()),
    }
    failures = audit_check(result, draft, job)
    if failures:
        raise ValueError(f"Cannot approve invalid review: {failures}")
    # Never transform non-pass findings into approval; only clean verified
    # evidence can be signed as an importable narrative.
    audit_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    try:
        seal = seal_audit(out, job)
    except Exception:
        audit_path.unlink(missing_ok=True)
        raise
    print("MANUAL_SOURCE_REVIEW_SEALED", json.dumps({
        "videoId": job["video"]["videoId"], "verdict": result["verdict"],
        "paragraphsReviewed": len(ps), "witnesses": len(witnesses),
        "evidenceSha256": result["reviewEvidenceSha256"],
        "auditSha256": seal["auditSha256"], "noModelCalls": True, "noDbWrites": True,
    }, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("prepare", "commit"))
    parser.add_argument("--video-id", required=True)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    job = find_job(args.video_id, args.out)
    if args.action == "prepare":
        prepare(args.out, job)
    else:
        commit(args.out, job)


if __name__ == "__main__":
    main()
