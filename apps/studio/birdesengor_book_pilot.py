#!/usr/bin/env python3
"""Isolated A/B pilot: same sources, two Codex strategies, independent audit and token metering.

No Studio SQLite mutation, chapter approvals, translation, publish, deployment or Git actions.
Outputs go only under ignored .local-data/studio/book-coverage/pilots/<name>.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import time

from birdesengor_book_batch import (
    AUDIT_SCHEMA, CODEX_QUOTA_EXHAUSTED, DRAFT_SCHEMA, audit_check, draft_check,
    files_for, job_data, load_json, prompt_audit, prompt_generate, seal_audit,
    is_codex_quota_exhausted,
)
from birdesengor_book_coverage import DEFAULT_OUT, ROOT, digest
from birdesengor_codex_telemetry import parse_events, sum_usages

PROFILES = (
    {"key": "sol-medium-solo", "model": "gpt-6.1-sol", "effort": "medium",
     "native": False, "subagentModel": None, "subagentEffort": None},
    {"key": "terra-high-multi", "model": "gpt-6.1-terra", "effort": "high",
     "native": True, "subagentModel": "gpt-6.1-sol", "subagentEffort": "medium"},
)
AUDITOR = {"model": "gpt-6.1-sol", "effort": "high", "native": False}
MAX_VIDEO_COUNT = 2


def prepare(args):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,45}", args.name):
        raise SystemExit("Pilot name must be simple lowercase letters/digits/hyphens")
    subprocess.run([sys.executable, "-B", "apps/studio/birdesengor_book_coverage.py",
                    "--check-snapshot"], cwd=ROOT, check=True, capture_output=True, text=True)
    all_jobs = job_data(DEFAULT_OUT)
    selected = [job for job in all_jobs if job["batch"] == args.batch][:args.count]
    if len(selected) != args.count:
        raise SystemExit("Requested video count not found in current batch")
    if not 1 <= args.count <= MAX_VIDEO_COUNT:
        raise SystemExit("Pilot accepts only 1..2 videos; no unbounded multi-video trials")
    base = DEFAULT_OUT / "pilots" / args.name
    for job in selected:
        assert job["video"]["videoId"] not in (None, "")
    return base, selected


def sha(value):
    return hashlib.sha256(value).hexdigest()


def meta_file(base, job, profile, stage):
    return base / job["video"]["videoId"] / profile["key"] / "metrics" / (stage + ".json")


def work_dir(base, job, profile):
    return base / job["video"]["videoId"] / profile["key"]


def result_file(out, job, stage):
    draft, audit = files_for(out, job)
    return draft if stage == "generate" else audit


def validate_result(out, job, stage):
    file = result_file(out, job, stage)
    if not file.is_file() or not file.stat().st_size:
        return False, ["Missing/empty output"]
    try:
        data = load_json(file)
        if stage == "generate":
            return not (errors := draft_check(data, job)), errors
        draft = load_json(result_file(out, job, "generate"))
        return not (errors := audit_check(data, draft, job)), errors
    except (ValueError, OSError, KeyError, TypeError) as e:
        return False, [str(e)]


def remove_only_invalid_source_anchors(out, job):
    """Repair machine-verifiable quote mismatch, never alter narrative text."""
    file = result_file(out, job, "generate")
    obj = load_json(file)
    anchors = obj.get("sourceAnchors")
    if not isinstance(anchors, list):
        return 0
    good = [a for a in anchors if isinstance(a, str) and a.strip()
            and a in job["transcript"]]
    if len(good) == len(anchors) or len(good) < 3:
        return 0
    errors = draft_check({**obj, "sourceAnchors": good}, job)
    if errors:
        return 0
    raw = file.with_suffix(".raw.json")
    if raw.exists():
        raise ValueError("Existing raw draft must never be overwritten")
    raw.write_bytes(file.read_bytes())
    obj["sourceAnchors"] = good
    file.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return len(anchors) - len(good)


def codex_command(out, profile, stage):
    schema = out / ("draft-schema.json" if stage == "generate" else "audit-schema.json")
    schema.parent.mkdir(parents=True, exist_ok=True)
    schema.write_text(json.dumps(DRAFT_SCHEMA if stage == "generate" else AUDIT_SCHEMA),
                      encoding="utf-8")
    target = out / "drafts"
    target.mkdir(parents=True, exist_ok=True)
    command = ["codex", "exec", "--json", "--ephemeral",
               "-m", profile["model"], "-c", f'model_reasoning_effort="{profile["effort"]}"',
               "-s", "read-only", "-C", str(ROOT), "--output-schema", str(schema)]
    if profile["native"]:
        command += ["--enable", "multi_agent_v2",
                    "-c", "agents.max_concurrent_threads_per_session=2",
                    "-c", f'agents.default_subagent_model="{profile["subagentModel"]}"',
                    "-c", f'agents.default_subagent_reasoning_effort="{profile["subagentEffort"]}"']
    else:
        command += ["--disable", "multi_agent_v2"]
    return command


def stage_call(base, job, profile, stage, timeout, allow_run):
    folder = work_dir(base, job, profile)
    folder.mkdir(parents=True, exist_ok=True)
    target = result_file(folder, job, stage)
    metrics_path = meta_file(base, job, profile, stage)
    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    existing, errors = validate_result(folder, job, stage)
    if existing:
        # A previously valid output cannot be silently reused after source edits.
        meta = load_json(metrics_path) if metrics_path.exists() else {}
        expected_hash = sha(target.read_bytes())
        if (meta.get("sourceFingerprint") != job["video"]["sourceFingerprint"] or
            meta.get("outputSha256") != expected_hash or not meta.get("valid")):
            print(f"BLOCK {job['video']['videoId']} {profile['key']} {stage}: "
                  "previously generated output has stale/missing sealed metrics",
                  file=sys.stderr, flush=True)
            return False
        if stage == "audit":
            seal = target.with_suffix(".seal.json")
            if not seal.exists():
                print("BLOCK existing audit: missing source seal", file=sys.stderr, flush=True)
                return False
            sealed = load_json(seal)
            draft = result_file(folder, job, "generate")
            if (sealed.get("sourceFingerprint") != job["video"]["sourceFingerprint"] or
                sealed.get("draftSha256") != digest(draft.read_bytes()) or
                sealed.get("auditSha256") != digest(target.read_bytes())):
                print("BLOCK existing audit: invalid source seal", file=sys.stderr, flush=True)
                return False
        print(f"SKIP {job['video']['videoId']} {profile['key']} {stage} (already valid)", flush=True)
        return True
    if target.exists() and target.stat().st_size:
        print(f"BLOCK {job['video']['videoId']} {profile['key']} {stage}: {errors}", flush=True)
        return False
    if stage == "audit":
        good, problems = validate_result(folder, job, "generate")
        if not good:
            print(f"BLOCK audit: invalid source draft: {problems}", flush=True)
            return False
    if CODEX_QUOTA_EXHAUSTED.is_set():
        print("CODEX_QUOTA_EXHAUSTED: further calls blocked", flush=True)
        return False
    prompt = prompt_generate(job) if stage == "generate" else prompt_audit(job, target.with_name(job["video"]["videoId"] + ".json"))
    if stage == "generate" and profile["native"]:
        prompt += ("""

YALNIZ BU TEK VIDEO KAPSAMINDA çalış. Kaynağa sadık kalmak için mümkünse
en fazla iki sınırlı subagent kullan: biri altyazıdaki olayların sırasını ve
konuşmacılarını çıkarsın; diğeri özel ad / tamamlanmış-planlanmış eylem
belirsizliklerini kontrol etsin. Alt ajanlar yalnız sources[index].originalTranscript
metnini kanıt saysın ve asla dosya / SQLite değiştirmesin. Son JSON'un tek yazarı
ana ajandır. Subagent özelliği kullanılamıyorsa görevi tek başına yerine getir,
uydurma subagent çalışması bildirme.
""")
    log = folder / (stage + ".codex.jsonl")
    command = codex_command(folder, profile, stage) + ["-o", str(target), "-"]
    if not allow_run:
        print("DRY_RUN",job["video"]["videoId"],profile["key"],stage,
              "model", profile["model"],"effort", profile["effort"],
              "native",profile["native"], "sourceFingerprint",job["video"]["sourceFingerprint"])
        return True
    started = time.monotonic()
    code = None
    failure = None
    try:
        with log.open("w", encoding="utf8") as stream:
            proc = subprocess.run(command, input=prompt, text=True, cwd=ROOT,
                                  stdout=stream, stderr=subprocess.STDOUT, timeout=timeout)
            code = proc.returncode
    except (subprocess.TimeoutExpired, OSError) as exc:
        failure = type(exc).__name__ + ": " + str(exc)[:200]
    meter = parse_events(log)
    invalid_anchors = 0
    if code == 0 and stage == "generate" and target.is_file() and target.stat().st_size:
        try:
            invalid_anchors = remove_only_invalid_source_anchors(folder, job)
        except (ValueError, KeyError, TypeError) as exc:
            failure = f"Anchor normalizer: {exc}"
    valid, errors = validate_result(folder, job, stage)
    success = code == 0 and valid and failure is None
    if stage == "audit" and success:
        seal_audit(folder, job)
    if is_codex_quota_exhausted(log):
        CODEX_QUOTA_EXHAUSTED.set()
        failure = "Codex provider usage limit reached"
        success = False
    metrics = {
        "schemaVersion": 1, "videoId": job["video"]["videoId"],
        "sourceFingerprint": job["video"]["sourceFingerprint"],
        "profile": profile["key"], "stage": stage,
        "model": profile["model"], "reasoning": profile["effort"],
        "nativeSubagentsRequested": profile["native"],
        "subagentModel": profile["subagentModel"], "subagentEffort": profile["subagentEffort"],
        "elapsedSeconds": round(time.monotonic() - started, 2),
        "recordedAt": datetime.now(timezone.utc).isoformat(),
        "cliExitCode": code, "valid": success, "verdict": None,
        "validationErrors": errors, "failure": failure,
        "invalidSourceAnchorsRemoved": invalid_anchors,
        "usage": meter["usage"], "metering": {k: v for k, v in meter.items() if k != "usage"},
        "promptSha256": sha(prompt.encode("utf8")),
        "outputSha256": sha(target.read_bytes()) if target.is_file() else None,
    }
    if stage == "audit" and valid:
        metrics["verdict"] = load_json(target).get("verdict")
        metrics["issueCount"] = len(load_json(target).get("issues", []))
    metrics_path.write_text(json.dumps(metrics, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf8")
    print(f"{'OK' if success else 'FAIL'} {job['video']['videoId']} "
          f"{profile['key']} {stage}: {metrics['elapsedSeconds']}s "
          f"tokens={((meter['usage'] or {}).get('total_tokens'))} "
          f"issues={metrics.get('issueCount')} errors={errors or failure}", flush=True)
    return success


def report(base, jobs):
    all_rows = []
    print("| Video | Strateji | Üretim | Denetim | Sonuç | Bulgu | Token | Cache | Süre (sn) | Ajan olayları |")
    print("|---|---|---|---|---|---:|---:|---:|---:|---:|")
    for job in jobs:
        for profile in PROFILES:
            meta = []
            for stage in ("generate", "audit"):
                f = meta_file(base, job, profile, stage)
                if f.exists():
                    meta.append(load_json(f))
            counts = sum_usages(meta)
            done = {x["stage"]: x for x in meta}
            draft = done.get("generate", {})
            audit = done.get("audit", {})
            verdict = audit.get("verdict") or "—"
            tokens = counts["total_tokens"]
            cached = counts["cached_input_tokens"]
            elapsed = sum(x.get("elapsedSeconds", 0) for x in meta)
            agent_events = draft.get("metering", {}).get("agentEvents")
            issues = audit.get("issueCount")
            print(f"| {job['video']['videoId']} | {profile['key']} | "
                  f"{'PASS' if draft.get('valid') else '—'} | "
                  f"{'PASS' if audit.get('valid') else '—'} | {verdict} | "
                  f"{issues if issues is not None else '—'} | "
                  f"{tokens if tokens is not None else 'ölçülmedi'} | "
                  f"{cached if cached is not None else 'ölçülmedi'} | "
                  f"{elapsed:.1f} | {agent_events if agent_events is not None else '—'} |")
            all_rows.extend(meta)
    totals = sum_usages(all_rows)
    print("\nCLI'nin bildirdiği toplam tokenlar (eksik sayaç varsa toplam bilinmiyor):",totals)
    print("Not: Sol/Medium tek ajan ile Terra/High+subagent birlikte değiştiği için "
          "bu ilk tur tek başına saf bir model karşılaştırması değildir.")
    print("Kullanım limiti, API dolar maliyeti değildir; gerçek fatura hesaplanmadı.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("plan", "run", "report"))
    parser.add_argument("--name", default="batch04-ab-v1")
    parser.add_argument("--batch", type=int, default=1)
    parser.add_argument("--count", type=int, default=2)
    parser.add_argument("--workers", type=int, choices=(1, 2), default=1)
    parser.add_argument("--timeout", type=int, default=900)
    parser.add_argument("--execute", action="store_true",
                        help="Explicit opt-in for live Codex token consumption")
    args = parser.parse_args()
    base, jobs = prepare(args)
    if args.action == "plan":
        print("PILOT_PLAN",json.dumps({
            "name": args.name, "videos": [j["video"]["videoId"] for j in jobs],
            "variants": PROFILES, "auditor": AUDITOR,
             "rootCodexSessionsExpected": len(jobs) * len(PROFILES) * 2,
            "note": "Native subagents may create extra model calls inside a root session",
            "output": str(base), "writesCanonical": False,
        }, ensure_ascii=False, indent=2))
        for job in jobs:
            for profile in PROFILES:
                codex_command(work_dir(base, job, profile), profile, "generate")
                print("ROLE",job["video"]["videoId"],profile["key"],
                      "native" if profile["native"] else "single",
                      "model",profile["model"],"reasoning",profile["effort"])
        return
    if args.action == "report":
        report(base, jobs)
        return
    if not args.execute:
        raise SystemExit("No requests made: add --execute after reviewing 'plan'")
    for stage in ("generate", "audit"):
        tasks = [(job, profile) for job in jobs for profile in PROFILES]
        def call(task):
            job, profile = task
            effective = profile if stage == "generate" else {
                **AUDITOR, "key": profile["key"],
                "subagentModel": None, "subagentEffort": None,
            }
            return stage_call(base, job, effective, stage, args.timeout, True)
        if args.workers == 1:
            for task in tasks:
                if CODEX_QUOTA_EXHAUSTED.is_set():
                    break
                call(task)
        else:
            with ThreadPoolExecutor(max_workers=args.workers) as pool:
                futures = [pool.submit(call, task) for task in tasks]
                for future in as_completed(futures):
                    future.result()
        if CODEX_QUOTA_EXHAUSTED.is_set():
            print("PILOT_STOPPED_BY_USAGE_LIMIT",flush=True)
            break
    report(base, jobs)
    if not CODEX_QUOTA_EXHAUSTED.is_set():
        incomplete = []
        for job in jobs:
            for profile in PROFILES:
                for stage in ("generate", "audit"):
                    metric = meta_file(base, job, profile, stage)
                    if not metric.is_file() or not load_json(metric).get("valid"):
                        incomplete.append((job["video"]["videoId"], profile["key"], stage))
        if incomplete:
            print("INCOMPLETE_OR_INVALID_PILOT", incomplete, file=sys.stderr)
            raise SystemExit(2)
    else:
        raise SystemExit(3)


if __name__ == "__main__":
    main()
