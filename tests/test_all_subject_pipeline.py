import sys
import unittest
from pathlib import Path

import fitz


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from audit_exam_corpus import role_of  # noqa: E402
from build_question_registry import candidate_labels  # noqa: E402
from render_all_question_assets import image_regions  # noqa: E402


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


if __name__ == "__main__":
    unittest.main()
