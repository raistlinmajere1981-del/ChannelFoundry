#!/usr/bin/env python3
"""Offline checks: source-isolated generation, manual review evidence and status.

No Codex calls and NO SQLite working copies or live database changes.
"""
import json
from pathlib import Path
import tempfile
import unittest

from birdesengor_book_batch import (
    draft_check, job_data, load_json, prompt_generate, status
)
from birdesengor_book_coverage import DEFAULT_OUT, digest
from birdesengor_book_manual_audit import prepare, commit


def fixture():
    beginning = "Birinci defa kapıya geldim. Yalnız ben gördüm. " * 38
    middle = "İkinci bölümde haberci konuştu. Ben yalnız dinledim. " * 38
    ending = ("Sonunda taşı almak istediğimi söyledim, ama almadım. " * 38
              + "Kaydın sonunda anahtarı bıraktım ve dışarı çıktım.")
    transcript = beginning + middle + ending
    body_parts = [
        "Birinci defa kapıya geldim. Görüşmeyi tek başıma sürdürdüm. " * 3,
        "Yalnız ben gördüm ve habercinin sesini duydum. " * 4,
        "İkinci bölümde haberci konuştu; ben yalnız dinledim. " * 4,
        "Haberciye söylediklerini neden aktardığını sordum. " * 4,
        "Sonunda taşı almak istediğimi söyledim, ama almadım. " * 4
        + "Kaydın sonunda anahtarı bıraktım ve dışarı çıktım.",
    ]
    draft = {
        "sourceVideoIds": ["SAMPLEID001"],
        "title": "Kapıdaki Konuşma",
        "body": "\n\n".join(body_parts),
        "reviewNotes": ["Uydurulmuş özel ad yok, örnek deneme verisi"],
        "sourceAnchors": [
            "Birinci defa kapıya geldim.", "İkinci bölümde haberci konuştu.",
            "Sonunda taşı almak istediğimi söyledim",
        ],
    }
    job = {"serial": 1, "batch": 1, "video": {
        "videoId": "SAMPLEID001", "videoTitle": "Örnek",
        "sourceFingerprint": "unit-test-source-fingerprint",
        "publishedAt": "2026-01-01"}, "transcript": transcript}
    return job, draft, (beginning, middle, ending)


class LeanWorkflowTests(unittest.TestCase):
    def test_generation_context_is_one_transcript_not_ten_video_packet(self):
        next_job = job_data(DEFAULT_OUT)[0]
        prompt = prompt_generate(next_job)
        payload = prompt.split("<untrusted_source_json>")[1].split("</untrusted_source_json>")[0].strip()
        source = json.loads(payload)
        self.assertEqual(source["videoId"], next_job["video"]["videoId"])
        self.assertEqual(source["originalTranscript"], next_job["transcript"])
        self.assertNotIn("source-packets/", prompt)
        self.assertLess(len(prompt), len(next_job["transcript"]) + 4300)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.out = Path(self.temp.name)
        (self.out / "drafts").mkdir()
        self.job, self.draft, self.sections = fixture()
        self.assertEqual(draft_check(self.draft, self.job), [])
        self.draft_path = self.out / "drafts/SAMPLEID001.json"
        self.draft_path.write_text(json.dumps(self.draft, ensure_ascii=False) + "\n")

    def example_evidence(self):
        review_path = self.out / "drafts/SAMPLEID001.review.evidence.json"
        e = load_json(review_path)
        e["paragraphsReviewed"] = list(range(5))
        e["coverageNote"] = ("Özgün altyazıyı tüm beş paragrafla karşılaştırdım. "
            "Konuşmacı, görüşme sırası, henüz yapılmayan eylem, kişi adı ve "
            "metnin kapsamını kontrol ettim; denemede düzeltilmesi gereken bulgu yok.")
        e["evidence"] = [
            {"sourceExcerpt": "Birinci defa kapıya geldim.",
             "draftExcerpt": "Birinci defa kapıya geldim.",
             "comparison": "İlk olay yalnız anlatıcının karşılaşmasıdır, yer doğru"},
            {"sourceExcerpt": "Yalnız ben gördüm.",
             "draftExcerpt": "Yalnız ben gördüm",
             "comparison": "Görme eylemini başka kişiye aktarmıyor"},
            {"sourceExcerpt": "İkinci bölümde haberci konuştu.",
             "draftExcerpt": "İkinci bölümde haberci konuştu",
             "comparison": "Habercinin konuşması anlatıcıyla karıştırılmamış"},
            {"sourceExcerpt": "Ben yalnız dinledim.",
             "draftExcerpt": "ben yalnız dinledim",
             "comparison": "Konuşmacı ve dinleyen doğru ayrılmış"},
            {"sourceExcerpt": "Sonunda taşı almak istediğimi söyledim",
             "draftExcerpt": "Sonunda taşı almak istediğimi söyledim",
             "comparison": "Yalnız niyet anlatılmış, gerçekleşme iddiası yok"},
            {"sourceExcerpt": "Kaydın sonunda anahtarı bıraktım ve dışarı çıktım.",
             "draftExcerpt": "Kaydın sonunda anahtarı bıraktım ve dışarı çıktım.",
             "comparison": "Kaynak sona yaklaşıp tamamlanmış son eylemi doğru aktarıyor"},
        ]
        e["verdict"] = "pass"
        review_path.write_text(json.dumps(e, ensure_ascii=False, indent=2) + "\n")
        return review_path

    def test_prepare_creates_review_not_automatic_pass(self):
        prepare(self.out, self.job)
        evidence = load_json(self.out / "drafts/SAMPLEID001.review.evidence.json")
        self.assertEqual(evidence["paragraphsReviewed"], [])
        self.assertEqual(evidence["verdict"], "review")
        with self.assertRaisesRegex(ValueError, "Each paragraph"):
            commit(self.out, self.job)
        self.assertFalse((self.out / "drafts/SAMPLEID001.audit.json").exists())

    def test_manual_review_requires_reviewer_checked_evidence(self):
        prepare(self.out, self.job)
        path = self.example_evidence()
        e = load_json(path)
        e["evidence"][2]["sourceExcerpt"] = "invented subtitle passage"
        path.write_text(json.dumps(e))
        with self.assertRaisesRegex(ValueError, "verbatim"):
            commit(self.out, self.job)
        self.assertFalse((self.out / "drafts/SAMPLEID001.audit.json").exists())

    def test_manually_reviewed_source_can_be_sealed_without_codex(self):
        prepare(self.out, self.job)
        path = self.example_evidence()
        commit(self.out, self.job)
        audit = load_json(self.out / "drafts/SAMPLEID001.audit.json")
        seal = load_json(self.out / "drafts/SAMPLEID001.audit.seal.json")
        self.assertEqual(audit["reviewMethod"], "assistant-source-review")
        self.assertEqual(audit["reviewEvidenceSha256"], digest(path.read_bytes()))
        self.assertEqual(seal["reviewEvidenceSha256"], audit["reviewEvidenceSha256"])
        self.assertEqual(seal["reviewMethod"], "assistant-source-review")
        self.assertEqual(status(self.out, [self.job], 1)[0]["status"], "audited_pass")

    def test_draft_edit_invalidates_prior_review(self):
        prepare(self.out, self.job)
        path = self.example_evidence()
        self.draft["body"] += "\n\nEk yeni paragraf"
        self.draft_path.write_text(json.dumps(self.draft, ensure_ascii=False))
        with self.assertRaisesRegex(ValueError, "stale"):
            commit(self.out, self.job)


if __name__ == "__main__":
    unittest.main(verbosity=2)
