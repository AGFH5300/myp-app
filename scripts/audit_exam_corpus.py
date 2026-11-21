"""Read-only integrity and pairing audit of a private MYP exam PDF corpus.

Never commits or uploads the source files; reports metadata and review flags.
The file's folder supplies the pairing scope, which is a candidate association,
not a verified question-to-answer relationship.
"""

import argparse
import collections
import csv
import hashlib
import json
import re
from pathlib import Path

import fitz


def role_of(name):
    # The eight IDU files named "Questions+MS" are actually *markschemes*.
    # Their first pages identify them as such; they quote prompts but lack
    # original on-screen questions and media. Never treat them as both sources.
    if re.search(r"Questions\s*\+\s*MS", name, re.I):
        return "markscheme"
    if re.search(r"Question Paper\s*(and|&)\s*Mark Scheme", name, re.I):
        return "combined"
    if re.search(r"mark[\s-]*scheme|marks[\s-]*scheme|(?:^|[-_ ])MS(?:[-_. ]|$)", name, re.I):
        return "markscheme"
    return "question"


def source_path(item, retrieved, extended):
    external = retrieved / (item["id"] + ".pdf")
    if external.exists():
        return external
    candidate = extended / item["name"]
    if candidate.exists() and item["subject"] == "Mathematics" and "Maths Extended/Past Papers" in item["folder"]:
        return candidate
    return external


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--inventory", type=Path, required=True)
    p.add_argument("--retrieved", type=Path, required=True)
    p.add_argument("--extended", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))["files"]
    records = []
    for i, item in enumerate(inventory):
        path = source_path(item, args.retrieved, args.extended)
        row = {k: item[k] for k in ("id", "subject", "folder", "name", "bytes", "url")}
        row["role"] = role_of(item["name"])
        row.update(path=str(path), status="missing", pages=0, sha256=None, pdf_repaired=None, issue=None)
        try:
            if not path.is_file():
                raise FileNotFoundError("not retrieved")
            row["actual_bytes"] = path.stat().st_size
            row["sha256"] = hashlib.file_digest(path.open("rb"), "sha256").hexdigest()
            if item["bytes"] and row["actual_bytes"] != item["bytes"]:
                row["issue"] = f"File size differs: {row['actual_bytes']} versus source {item['bytes']}"
            with fitz.open(path) as pdf:
                row["pages"] = len(pdf)
                row["pdf_repaired"] = bool(pdf.is_repaired)
                if not pdf.is_pdf or not len(pdf):
                    raise ValueError("not a nonempty PDF")
                for ix in sorted(set([0, len(pdf) - 1])):
                    page = pdf[ix]
                    page.get_pixmap(matrix=fitz.Matrix(0.4, 0.4), alpha=False)
            row["status"] = "rendered_end_pages"
            if row["pdf_repaired"]:
                row["issue"] = (row["issue"] + "; " if row["issue"] else "") + "PDF needed repair"
        except Exception as exc:
            row["status"] = "error"
            row["issue"] = ((row["issue"] + "; ") if row["issue"] else "") + str(exc)
        records.append(row)
        if (i + 1) % 50 == 0:
            print(f"Audited {i+1}/{len(inventory)}", flush=True)

    pairs = []
    folder_groups = collections.defaultdict(list)
    for row in records:
        folder_groups[(row["subject"], row["folder"])].append(row)
    for (subject, folder), group in sorted(folder_groups.items()):
        q = [r["id"] for r in group if r["role"] in ("question", "combined")]
        m = [r["id"] for r in group if r["role"] in ("markscheme", "combined")]
        pairs.append({"subject": subject, "folder": folder, "question_file_ids": q,
                      "markscheme_file_ids": m, "pair_status": "source_candidate" if q and m else
                      "missing_question" if not q else "missing_markscheme",
                      "ambiguous_multiple": len(q) > 1 or len(m) > 1})

    subjects = {}
    for subject in sorted(set(r["subject"] for r in records)):
        rows = [r for r in records if r["subject"] == subject]
        p_rows = [p for p in pairs if p["subject"] == subject]
        subjects[subject] = {"files": len(rows), "pages": sum(r["pages"] for r in rows),
                             "errors": sum(r["status"] == "error" for r in rows),
                             "question_source_folders": sum(bool(p["question_file_ids"]) for p in p_rows),
                             "candidate_pair_folders": sum(p["pair_status"] == "source_candidate" for p in p_rows),
                             "missing_mark_folders": sum(p["pair_status"] == "missing_markscheme" for p in p_rows),
                             "missing_question_folders": sum(p["pair_status"] == "missing_question" for p in p_rows)}
    result = {"status": "source_integrity_and_folder_level_candidates_only_not_question_verification",
              "files": records, "folder_pairs": pairs, "subjects": subjects}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    csv_path = args.output.with_suffix(".csv")
    with csv_path.open("w", newline="", encoding="utf-8") as out:
        w = csv.DictWriter(out, fieldnames=["subject", "folder", "pair_status", "ambiguous_multiple", "question_file_ids", "markscheme_file_ids"])
        w.writeheader()
        for x in pairs:
            w.writerow({**x, "question_file_ids": ",".join(x["question_file_ids"]), "markscheme_file_ids": ",".join(x["markscheme_file_ids"])})
    print(json.dumps(subjects, indent=2), flush=True)
    print(f"Outputs: {args.output}; {csv_path}", flush=True)


if __name__ == "__main__":
    main()
