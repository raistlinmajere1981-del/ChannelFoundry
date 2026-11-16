#!/usr/bin/env python3
"""Offline tests: no Codex credentials, network or Studio SQLite writes."""
from __future__ import annotations

import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from birdesengor_book_coverage import DEFAULT_OUT
from birdesengor_book_batch import CODEX_QUOTA_EXHAUSTED, run_codex
from birdesengor_codex_telemetry import parse_events, sum_usages
from birdesengor_book_pilot import (
    AUDITOR, PROFILES, codex_command, meta_file, result_file,
    stage_call, validate_result,
)


SOURCE = "İlk kapıda durdum. İkinci soruyu sordum. Üçüncü ses duyuldu."
VIDEO_ID = "ABCDEFGHIJK"


def job():
    return {"serial": 1, "batch": 1, "packet": "fake-local-source.json", "index": 0,
            "video": {"videoId": VIDEO_ID, "sourceFingerprint": "mock-fingerprint"},
            "transcript": SOURCE}


def draft():
    return {"sourceVideoIds": [VIDEO_ID], "title": "Kapıdaki Görüşme",
            "body": "Bir görüşmede bekledim. " * 40,
            "reviewNotes": ["Doğrudan kaynaktan doğrulanacak"],
            "sourceAnchors": ["İlk kapıda durdum.", "İkinci soruyu sordum.",
                              "Üçüncü ses duyuldu.", "Kaynak dışı sahte alıntı"]}


def fake_codex(args, *, input, text, cwd, stdout, stderr, timeout, **kwargs):
    target = Path(args[args.index("-o") + 1])
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.name.endswith(".audit.json"):
        payload = {"videoId": VIDEO_ID, "verdict": "pass",
                   "issues": [], "coverageNote": "Kaynak karşılaştırması temiz"}
    else:
        payload = draft()
    target.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf8")
    stdout.write(json.dumps({"type": "turn.started"}) + "\n")
    stdout.write(json.dumps({"type": "turn.completed", "usage": {
        "input_tokens": 200, "cached_input_tokens": 120, "output_tokens": 25}}) + "\n")
    return subprocess.CompletedProcess(args, 0)


class TelemetryTests(unittest.TestCase):
    def test_json_usage_and_unknown(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "stream.jsonl"
            p.write_text(
                '{"type":"turn.started"}\n'
                '{"type":"turn.completed","usage":{"input_tokens":200,"cached_input_tokens":150,"output_tokens":20}}\n'
                'NOT JSON\n'
                '{"type":"turn.completed","usage":{"input_tokens":100,"cached_input_tokens":50,"output_tokens":30}}\n',
                encoding="utf8")
            result = parse_events(p)
            self.assertEqual(result["turns"], 2)
            self.assertEqual(result["usage"]["input_tokens"], 300)
            self.assertEqual(result["usage"]["cached_input_tokens"], 200)
            self.assertEqual(result["usage"]["uncached_input_tokens"], 100)
            self.assertEqual(result["usage"]["total_tokens"], 350)
            self.assertEqual(result["malformedLines"], 1)
            self.assertIsNone(sum_usages([{"usage": result["usage"]}, {"usage": None}])["total_tokens"])

    def test_error_has_unknown_tokens(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "err.jsonl"
            p.write_text('ERROR: usage limit\n', encoding="utf8")
            self.assertIsNone(parse_events(p)["usage"])


class PilotTests(unittest.TestCase):
    def setUp(self):
        CODEX_QUOTA_EXHAUSTED.clear()
        (DEFAULT_OUT / "pilots").mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix="unit-test-", dir=DEFAULT_OUT / "pilots")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)

    def tearDown(self):
        CODEX_QUOTA_EXHAUSTED.clear()

    def test_native_subagent_flags_are_explicit_and_bounded(self):
        native = codex_command(self.base / "a", PROFILES[1], "generate")
        solo = codex_command(self.base / "b", PROFILES[0], "generate")
        self.assertIn("--json", native)
        self.assertIn("--ephemeral", native)
        self.assertEqual(native[native.index("--enable") + 1], "multi_agent_v2")
        self.assertIn("agents.max_concurrent_threads_per_session=2", native)
        self.assertIn('agents.default_subagent_model="gpt-6.1-sol"', native)
        self.assertEqual(solo[solo.index("--disable") + 1], "multi_agent_v2")
        self.assertNotIn("--dangerously-bypass-approvals-and-sandbox", native)

    def test_fake_draft_and_independent_audit_are_measured_and_sealed(self):
        with patch("birdesengor_book_pilot.subprocess.run", side_effect=fake_codex):
            self.assertTrue(stage_call(self.base, job(), PROFILES[0], "generate", 15, True))
            audit_profile = {**AUDITOR, "key": PROFILES[0]["key"],
                             "subagentModel": None, "subagentEffort": None}
            self.assertTrue(stage_call(self.base, job(), audit_profile, "audit", 15, True))
        f = self.base / VIDEO_ID / PROFILES[0]["key"]
        is_valid, failures = validate_result(f, job(), "generate")
        self.assertTrue(is_valid, failures)
        corrected = json.loads(result_file(f, job(), "generate").read_text())
        self.assertEqual(len(corrected["sourceAnchors"]), 3)
        self.assertTrue(result_file(f, job(), "generate").with_suffix(".raw.json").exists())
        self.assertTrue((f / "drafts" / (VIDEO_ID + ".audit.seal.json")).exists())
        generate = json.loads(meta_file(self.base, job(), PROFILES[0], "generate").read_text())
        audit = json.loads(meta_file(self.base, job(), PROFILES[0], "audit").read_text())
        self.assertTrue(generate["valid"])
        self.assertTrue(audit["valid"])
        self.assertEqual(audit["verdict"], "pass")
        self.assertEqual(generate["invalidSourceAnchorsRemoved"], 1)
        self.assertEqual(generate["usage"]["input_tokens"], 200)
        self.assertEqual(sum_usages([generate, audit])["total_tokens"], 450)

    def test_existing_batch_tool_optional_token_metrics(self):
        output = self.base / "original-engine"
        output.mkdir(parents=True)
        def fake_valid_batch(*args, **kwargs):
            result = fake_codex(*args, **kwargs)
            path = Path(args[0][args[0].index("-o") + 1])
            obj = json.loads(path.read_text())
            obj["sourceAnchors"] = obj["sourceAnchors"][:3]
            path.write_text(json.dumps(obj, ensure_ascii=False), encoding="utf8")
            return result
        with patch("birdesengor_book_batch.subprocess.run", side_effect=fake_valid_batch):
            self.assertTrue(run_codex(output, job(), "generate", "gpt-6.1-sol",
                                      "medium", 15, meter_tokens=True))
        metrics_file = output / "drafts" / (VIDEO_ID + ".metrics.json")
        metrics = json.loads(metrics_file.read_text())
        self.assertTrue(metrics["success"])
        self.assertEqual(metrics["model"], "gpt-6.1-sol")
        self.assertEqual(metrics["reasoning"], "medium")
        self.assertEqual(metrics["usage"]["total_tokens"], 225)

    def test_resume_refuses_stale_source_fingerprint(self):
        with patch("birdesengor_book_pilot.subprocess.run", side_effect=fake_codex):
            self.assertTrue(stage_call(self.base, job(), PROFILES[0], "generate", 15, True))
        with patch("birdesengor_book_pilot.subprocess.run") as mock_run:
            self.assertTrue(stage_call(self.base, job(), PROFILES[0], "generate", 15, True))
            changed = job()
            changed["video"]["sourceFingerprint"] = "different-source"
            self.assertFalse(stage_call(self.base, changed, PROFILES[0], "generate", 15, True))
            mock_run.assert_not_called()

    def test_quota_failure_stops_following_task(self):
        def denied(args, **kwargs):
            kwargs["stdout"].write("ERROR: You've hit your usage limit. Try again later.\n")
            return subprocess.CompletedProcess(args, 1)
        with patch("birdesengor_book_pilot.subprocess.run", side_effect=denied) as mocked:
            self.assertFalse(stage_call(self.base, job(), PROFILES[0], "generate", 15, True))
            self.assertTrue(CODEX_QUOTA_EXHAUSTED.is_set())
            self.assertFalse(stage_call(self.base, job(), PROFILES[1], "generate", 15, True))
            self.assertEqual(mocked.call_count, 1)
            meta = json.loads(meta_file(self.base, job(), PROFILES[0], "generate").read_text())
            self.assertIsNone(meta["usage"])
            self.assertFalse(meta["valid"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
