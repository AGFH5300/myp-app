import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

import fitz


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from audit_exam_corpus import role_of  # noqa: E402
from build_question_registry import candidate_labels  # noqa: E402
from build_private_import_manifest import paper_identity  # noqa: E402
from render_all_question_assets import image_regions, write_png  # noqa: E402


class SourceClassificationTests(unittest.TestCase):
    def test_idu_questions_plus_ms_is_a_markscheme(self):
        self.assertEqual(role_of("M19-Questions+MS.pdf"), "markscheme")

    def test_combined_topic_sheet(self):
        self.assertEqual(role_of("Question Paper and Mark Scheme.pdf"), "combined")


class QuestionLabelTests(unittest.TestCase):
    def test_english_spanish_and_decimal_subparts(self):
        labels = candidate_labels("Question 1a (2 marks)\nPregunta 2b (3 puntos)\nQ 3.2")
        self.assertEqual([(x["key"], x["marks"]) for x in labels],
                         [("Q1a", 2), ("Q2b", 3), ("Q3.2", None)])

    def test_markscheme_standalone_parts(self):
        labels = candidate_labels("Tarea 1\n1a\n1b", scheme=True)
        self.assertEqual([x["key"] for x in labels], ["Q1", "Q1a", "Q1b"])


class OfflineImportTests(unittest.TestCase):
    def test_past_math_paper_uses_level_and_session(self):
        info = paper_identity("Mathematics", "Maths Extended/Past Papers/2024/Nov", "sourceid")
        self.assertEqual((info["session_year"], info["session_month"], info["level"]),
                         (2024, "Nov", "Extended"))
        self.assertTrue(info["proposed_paper_code"].startswith("MYP-MATHEMATICS-2024-Nov-"))

    def test_mock_has_no_invented_session(self):
        info = paper_identity("Biology", "Mock Papers/Biology Mock 4", "sourceid")
        self.assertIsNone(info["session_year"])
        self.assertIsNone(info["session_month"])
        self.assertEqual(info["source_kind"], "MOCK")


class CropRegionTests(unittest.TestCase):
    def setUp(self):
        self.doc = fitz.open()
        self.page = self.doc.new_page(width=595, height=842)

    def tearDown(self):
        self.doc.close()

    def test_vertical_splits_keep_full_width(self):
        self.page.insert_text((50, 160), "Question 1a")
        self.page.insert_text((50, 520), "Question 1b")
        regions, context = image_regions(self.page, [
            ("Q1a", "Question 1a", "anchor"), ("Q1b", "Question 1b", "anchor")])
        self.assertEqual(regions["Q1a"][1], "text_anchor_vertical")
        self.assertGreater(regions["Q1a"][0].width, 590)
        self.assertLess(regions["Q1a"][0].y1, regions["Q1b"][0].y0 + 15)
        self.assertIsNone(context)

    def test_horizontal_split_keeps_right_of_first_panel(self):
        self.page.insert_text((80, 420), "Question 1a")
        self.page.insert_text((360, 420), "Question 1b")
        regions, context = image_regions(self.page, [
            ("Q1a", "Question 1a", "anchor"), ("Q1b", "Question 1b", "anchor")])
        self.assertEqual(regions["Q1a"][1], "text_anchor_columns")
        self.assertGreater(regions["Q1a"][0].x1, 330)
        self.assertGreater(regions["Q1b"][0].x1, 590)
        self.assertIsNotNone(context)

    def test_poppler_recovers_when_mupdf_cannot_render(self):
        with tempfile.TemporaryDirectory() as folder:
            pdf_path = Path(folder) / "broken-render.pdf"
            output_path = Path(folder) / "crop.png"
            doc = fitz.open()
            doc.new_page(width=595, height=842).insert_text((90, 150), "Question 1a")
            doc.save(pdf_path)
            doc.close()

            def fail_pixmap(**_):
                raise RuntimeError("Invalid bandwriter header dimensions/setup")

            simulated = SimpleNamespace(rect=fitz.Rect(0, 0, 595, 842), number=0,
                                        parent=SimpleNamespace(name=str(pdf_path)),
                                        get_pixmap=fail_pixmap)
            digest = write_png(simulated, fitz.Rect(60, 90, 240, 200), output_path, 2)
            self.assertEqual(len(digest), 64)
            self.assertTrue(output_path.is_file())
            from PIL import Image
            with Image.open(output_path) as img:
                self.assertEqual(img.size, (360, 220))


if __name__ == "__main__":
    unittest.main()
