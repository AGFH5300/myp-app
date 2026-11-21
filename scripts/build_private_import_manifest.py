"""Prepare a private, NON-EXECUTABLE MYP question-bank import handoff.

This maps exact source IDs, candidate question keys and image locations to the
existing Supabase schema without writing to an unavailable production database.
Every record remains blocked on manual verification and ID reconciliation.
Keep the produced manifest out of a public git repository: it may contain
private Drive identifiers and paths to licensed exam assets.
"""

import argparse
import collections
import csv
import hashlib
import json
import re
from pathlib import Path


def paper_identity(subject, folder, paper_id):
    slug = re.sub(r"[^A-Z0-9]+", "-", subject.upper()).strip("-")
    match = re.search(r"(?:^|/)Past Papers/(20\d{2})/(May|Nov)(?:/|$)", folder, re.I)
    year = int(match.group(1)) if match else None
    month = match.group(2).title() if match else None
    level = "Extended" if "Maths Extended" in folder else (
        "Standard" if "Maths Standard" in folder else None)
    fingerprint = hashlib.sha256(paper_id.encode()).hexdigest()[:10].upper()
    kind = "PAST" if match else "MOCK" if "Mock Papers" in folder else "OTHER"
    code = f"MYP-{slug}-{year or kind}-{month or 'NA'}-{fingerprint}"
    return {"proposed_paper_code": code, "session_year": year,
            "session_month": month, "level": level, "source_kind": kind}


def build_manifest(registry, audit, asset_root):
    source_info = {file["id"]: file for file in audit["files"]}
    checkpoints = {}
    for file in asset_root.rglob("paper_assets.json"):
        checkpoint = json.loads(file.read_text(encoding="utf-8"))
        checkpoints[file.parent.name] = (file.parent.parent, checkpoint)

    papers = []
    rows = []
    counts = collections.Counter()
    for paper in registry["papers"]:
        source = source_info[paper["paper_file_id"]]
        parent, checkpoint = checkpoints.get(paper["paper_file_id"], (None, {"assets": [], "warnings": []}))
        keyed_assets = collections.defaultdict(list)
        if parent:
            for asset in checkpoint["assets"]:
                keys = asset["key"] if isinstance(asset["key"], list) else [asset["key"]]
                for key in keys:
                    keyed_assets[(key, asset["role"])].append({
                        "relative_file": str((parent / asset["file"]).relative_to(asset_root)),
                        "source_id": asset["source_id"],
                        "source_page": asset["source_page"],
                        "crop_method": asset["crop_method"],
                        "sha256": asset["sha256"],
                        "rect_pdf_points": asset["region"],
                        "exists": (parent / asset["file"]).is_file(),
                        "review_status": "pending_human_verification"})
        identity = paper_identity(paper["subject"], paper["folder"], paper["paper_file_id"])
        entries = []
        for order, question in enumerate(paper["questions"], 1):
            key = question["key"]
            question_images = keyed_assets[(key, "question")]
            scheme_images = keyed_assets[(key, "markscheme")]
            shared_images = keyed_assets[(key, "context")]
            blockers = []
            if not question_images:
                blockers.append("question_crop_missing")
            if any(not x["exists"] for x in question_images + scheme_images + shared_images):
                blockers.append("source_image_file_missing")
            if not scheme_images:
                blockers.append("markscheme_crop_missing")
            if question["marks"] is None:
                blockers.append("marks_unverified")
            if question["matching_status"] not in (
                    "candidate_exact_key_unverified", "candidate_parent_unverified"):
                blockers.append(question["matching_status"])
            if checkpoint.get("warnings"):
                blockers.append("paper_render_warnings")
            # Human review, copyright, database UUID and source-license checks
            # are global blockers even for geometrically perfect crops.
            blockers.extend(["visual_semantic_review_pending", "database_id_unresolved",
                             "source_license_review_pending"])
            entries.append({"question_key": key, "proposed_question_number": key.removeprefix("Q"),
                            "question_order": order, "marks_candidate": question["marks"],
                            "mark_source": question["mark_source"],
                            "matching_status": question["matching_status"],
                            "source_pages": question["source_pages"],
                            "candidate_scheme_pages": question["markscheme_pages"],
                            "question_images": question_images, "context_images": shared_images,
                            "markscheme_images": scheme_images,
                            "database_question_id": None,
                            "publication_ready": False, "blockers": blockers})
            rows.append({"subject": paper["subject"], "folder": paper["folder"],
                         "proposed_paper_code": identity["proposed_paper_code"],
                         "question_key": key, "marks_candidate": question["marks"],
                         "matching_status": question["matching_status"],
                         "question_image_count": len(question_images),
                         "scheme_image_count": len(scheme_images),
                         "context_image_count": len(shared_images),
                         "blockers": ";".join(blockers)})
            counts[paper["subject"]] += 1
        papers.append({"subject_name": paper["subject"], "folder": paper["folder"],
                       **identity, "source_drive_file_id": source["id"],
                       "source_sha256": source["sha256"],
                       "candidate_scheme_drive_file_ids": paper["possible_markscheme_file_ids"],
                       "database_paper_id": None, "questions": entries,
                       "publication_ready": False})
    result = {"status": "private_staging_only_NO_DATABASE_WRITES",
              "instructions": "Reconcile real paper/question UUIDs, verify every source diagram, answer and mark, review rights, then upload to private bucket and update question_assets transactionally.",
              "summary": {"papers": len(papers), "questions": len(rows),
                          "question_records_by_subject": dict(counts)}, "papers": papers}
    return result, rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", required=True, type=Path)
    parser.add_argument("--audit", required=True, type=Path)
    parser.add_argument("--asset-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    result, rows = build_manifest(
        json.loads(args.registry.read_text(encoding="utf-8")),
        json.loads(args.audit.read_text(encoding="utf-8")), args.asset_root)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    with args.output.with_suffix(".csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]) if rows else [])
        writer.writeheader()
        writer.writerows(rows)
    print(json.dumps(result["summary"], indent=2))


if __name__ == "__main__":
    main()
