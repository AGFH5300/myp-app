"""Non-destructive coverage audit for private exam crops and question registry.

Checks explicit key/page coverage and image readability. Does not certify that
an answer is mathematically or semantically correct; human review is required.
"""

import argparse
import collections
import csv
import json
import re
from pathlib import Path

from PIL import Image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", required=True, type=Path)
    parser.add_argument("--asset-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    registry = json.loads(args.registry.read_text(encoding="utf-8"))
    checkpoints = {}
    for path in args.asset_root.rglob("paper_assets.json"):
        checkpoint = json.loads(path.read_text(encoding="utf-8"))
        checkpoints[path.parent.name] = (path.parent.parent, checkpoint)
    review_rows = []
    crop_methods = collections.Counter()
    failures = []
    asset_count = 0
    image_errors = 0
    for paper in registry["papers"]:
        paper_id = paper["paper_file_id"]
        record = checkpoints.get(paper_id)
        if not record:
            failures.append({"paper_id": paper_id, "subject": paper["subject"], "error": "paper_asset_checkpoint_missing"})
            continue
        root, checkpoint = record
        assets = checkpoint["assets"]
        asset_count += len(assets)
        crop_methods.update(a["crop_method"] for a in assets)
        existing_q = {(a["key"], a["source_page"]) for a in assets
                      if a["role"] == "question" and isinstance(a["key"], str)}
        existing_m = {(a["key"], a["source_id"], a["source_page"]) for a in assets
                      if a["role"] == "markscheme" and isinstance(a["key"], str)}
        needed_q = {(q["key"], page["page"]) for q in paper["questions"] for page in q["source_pages"]}
        needed_m = {(q["key"], page["file_id"], page["page"]) for q in paper["questions"] for page in q["markscheme_pages"]}
        missing_q = needed_q - existing_q
        missing_m = needed_m - existing_m
        unreadable = []
        for asset in assets:
            image_path = root / asset["file"]
            try:
                with Image.open(image_path) as img:
                    if img.width < 100 or img.height < 80:
                        raise ValueError(f"implausibly small {img.width}x{img.height}")
                    img.verify()
            except Exception as exc:
                unreadable.append({"image": asset["file"], "error": str(exc)})
                image_errors += 1
        nums = sorted({int(m.group(1)) for q in paper["questions"]
                       if (m := re.match(r"Q(\d+)", q["key"]))})
        root_gaps = [n for n in range(1, max(nums) + 1) if n not in nums] if nums else []
        review_rows.append({
            "subject": paper["subject"], "folder": paper["folder"], "paper_file_id": paper_id,
            "candidate_questions": len(paper["questions"]), "unassigned_pages": len(paper["unassigned_pages"]),
            "missing_source_crops": len(missing_q), "missing_markscheme_crops": len(missing_m),
            "unreadable_assets": len(unreadable), "paper_render_warnings": len(checkpoint.get("warnings", [])),
            "missing_root_numbers": ",".join(map(str, root_gaps)),
            "not_located_in_scheme": sum(q["matching_status"] == "not_located_in_scheme" for q in paper["questions"]),
            "no_matching_source": sum(q["matching_status"] == "no_matching_source" for q in paper["questions"]),
            "missing_marks": sum(q["marks"] is None for q in paper["questions"]),
        })
        if missing_q or missing_m or unreadable or checkpoint.get("warnings"):
            failures.append({"paper_id": paper_id, "subject": paper["subject"],
                             "missing_question_crops": sorted(list(missing_q)),
                             "missing_markscheme_crops": sorted(list(missing_m)),
                             "unreadable": unreadable, "warnings": checkpoint.get("warnings", [])})
    summary = {"papers_in_registry": len(registry["papers"]), "papers_with_checkpoints": len(review_rows),
               "asset_records": asset_count, "unreadable_asset_images": image_errors,
               "papers_with_asset_failures": len(failures),
               "missing_question_crop_links": sum(r["missing_source_crops"] for r in review_rows),
               "missing_scheme_crop_links": sum(r["missing_markscheme_crops"] for r in review_rows),
               "crop_methods": dict(crop_methods)}
    args.output.write_text(json.dumps({"status": "coverage_checked_semantic_review_pending",
                                       "summary": summary, "failures": failures, "papers": review_rows},
                                      indent=2), encoding="utf-8")
    with args.output.with_suffix(".csv").open("w", newline="", encoding="utf-8") as out:
        writer = csv.DictWriter(out, fieldnames=list(review_rows[0].keys()) if review_rows else [])
        writer.writeheader()
        writer.writerows(review_rows)
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
