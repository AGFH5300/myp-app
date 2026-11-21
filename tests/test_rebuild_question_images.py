"""Offline validation for the source-checked crop staging workflow."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import fitz

from scripts.rebuild_question_images import rebuild, validate_crop


class RebuildTests(unittest.TestCase):
    def test_crop_coordinates_are_restricted_to_a_real_page(self):
        with fitz.open() as document:
            document.new_page()
            _, region = validate_crop({"source": "question", "page": 1, "region": [0.1, 0.2, 0.9, 0.8]}, {"question": document})
            self.assertGreater(region.width, 0)
            for invalid in ([0, 0, 1, 1.1], [0.4, 0.5, 0.3, 0.9]):
                with self.assertRaises(ValueError):
                    validate_crop({"source": "question", "page": 1, "region": invalid}, {"question": document})

    def test_checksum_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "sample.pdf"
            with fitz.open() as document:
                document.new_page()
                document.save(source)
            checksum = hashlib.sha256(source.read_bytes()).hexdigest()
            manifest = {
                "paper_code": "sample",
                "sources": {"question": {"filename": source.name, "sha256": checksum}},
                "questions": [{"question_key": "Q1", "question": [{"source": "question", "page": 1, "region": [0, 0, 1, 1]}]}],
            }
            manifest_path = root / "manifest.json"
            manifest_path.write_text(json.dumps(manifest))
            output = root / "staging"
            self.assertEqual(rebuild(manifest_path, root, output), 1)
            self.assertEqual(json.loads((output / "audit.json").read_text())["assets"][0]["review_status"], "pending_human_verification")
            with self.assertRaises(FileExistsError):
                rebuild(manifest_path, root, output)
            manifest["sources"]["question"]["sha256"] = "0" * 64
            manifest_path.write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError, "checksum changed"):
                rebuild(manifest_path, root, root / "other")


if __name__ == "__main__":
    unittest.main()
