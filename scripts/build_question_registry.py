"""Discover candidate question/subquestion records from private page OCR.

This registry is an evidence map, never a completed answer match. It maps page
coverage, potential shared context and plausible markscheme pages, with flags
that require visual review before database publication.
"""

import argparse
import collections
import json
import re
from pathlib import Path


PATTERNS = [
    re.compile(r"(?<![\w])Q\s*(\d{1,2})\s*[.]\s*(\d{1,2})(?!\d)", re.I),
    re.compile(r"\b(?:Question|Pregunta|Q)\s*(\d{1,2})\s*([a-z])\b", re.I),
    re.compile(r"\b(?:Question|Task|Pregunta|Tarea)\s*(\d{1,2})(?!\d)", re.I),
    re.compile(r"(?<![\w])Q\s*(\d{1,2})(?!\w)", re.I),
]
SCHEME_PART = re.compile(r"(?m)^\s*(\d{1,2})([a-z])\s*$", re.I)
MARKS = re.compile(r"\(\s*(\d{1,2})\s*(?:marks?|puntos?|points?)\s*\)", re.I)
CRITERION_MARKS = re.compile(r"\b[A-D]\s*(\d{1,2})\b")
LINE_BADGE = re.compile(r"(?m)^\s*[A-D]\s*(\d{1,2})\s*$")


def candidate_labels(text, scheme=False):
    """Find distinct ordered anchors, keeping the precise text match for QA."""
    matches = []
    for priority, pattern in enumerate(PATTERNS + ([SCHEME_PART] if scheme else [])):
        for match in pattern.finditer(text):
            number = int(match.group(1))
            part = match.group(2).lower() if match.lastindex and match.lastindex > 1 else ""
            key = f"Q{number}{'.' if part.isdigit() else ''}{part}"
            matches.append((match.start(), match.end(), priority, key, match.group(0)))
    matches.sort(key=lambda x: (x[0], x[2], -(x[1] - x[0])))
    chosen = []
    for result in matches:
        if any(result[0] < old[1] and old[0] < result[1] for old in chosen):
            continue
        chosen.append(result)
    seen = set()
    items = []
    for start, end, _, key, evidence in chosen:
        if key in seen:
            continue
        seen.add(key)
        tail = text[end:end+85]
        mark = MARKS.search(tail)
        criteria_mark = CRITERION_MARKS.search(tail[:25]) if not mark else None
        items.append({"key": key, "evidence": evidence, "offset": start,
                      "marks": int(mark.group(1)) if mark else
                      int(criteria_mark.group(1)) if criteria_mark else None,
                      "mark_source": "explicit_marks" if mark else "criterion_badge_candidate" if criteria_mark else None})
    return items


def is_parent(key):
    return bool(re.fullmatch(r"Q\d+", key))


def root(key):
    m = re.match(r"Q\d+", key)
    return m.group(0) if m else key


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audit", required=True, type=Path)
    parser.add_argument("--index-checkpoints", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--rescue-dir", type=Path, help="Optional high-resolution OCR supplements")
    args = parser.parse_args()
    audit = json.loads(args.audit.read_text(encoding="utf-8"))
    sources = {}
    failures = []
    for row in audit["files"]:
        checkpoint = args.index_checkpoints / (row["id"] + ".json")
        if not checkpoint.is_file():
            failures.append({"file_id": row["id"], "issue": "index_missing"})
            continue
        try:
            pages = json.loads(checkpoint.read_text(encoding="utf-8"))
            if len(pages) != row["pages"]:
                raise ValueError("indexed page count differs")
            if args.rescue_dir:
                rescue_path = args.rescue_dir / (row["id"] + ".json")
                if rescue_path.is_file():
                    rescue = json.loads(rescue_path.read_text(encoding="utf-8"))
                    if rescue["sha256"] != row["sha256"]:
                        raise ValueError("OCR supplement source checksum differs")
                    additions = {item["page"]: item["text"] for item in rescue["pages"]
                                 if item["status"] == "ocr" and item["text"]}
                    for entry in pages:
                        if entry["page"] in additions:
                            entry["text"] += "\n\n[High resolution image OCR]\n" + additions[entry["page"]]
            sources[row["id"]] = pages
        except Exception as exc:
            failures.append({"file_id": row["id"], "issue": str(exc)})

    papers = []
    source_page_cover = {}
    for group in audit["folder_pairs"]:
        for paper_id in group["question_file_ids"]:
            pages = sources.get(paper_id)
            if not pages:
                continue
            questions = collections.OrderedDict()
            page_coverage = []
            previous = None
            for entry in pages:
                anchors = candidate_labels(entry["text"])
                anchors = [x for x in anchors if x["key"].startswith("Q")]
                unique = [a for a in anchors if not is_parent(a["key"])]
                if not unique:
                    unique = [a for a in anchors if is_parent(a["key"])]
                unique.sort(key=lambda x: x["offset"])
                for ix, anchor in enumerate(unique):
                    if anchor["marks"] is not None:
                        continue
                    start = anchor["offset"] + len(anchor["evidence"])
                    end = unique[ix+1]["offset"] if ix+1 < len(unique) else len(entry["text"])
                    segment = entry["text"][start:end]
                    badges = list(LINE_BADGE.finditer(segment))
                    if badges and int(badges[-1].group(1)) <= 15:
                        anchor["marks"] = int(badges[-1].group(1))
                        anchor["mark_source"] = "criterion_badge_candidate"
                keys = [a["key"] for a in unique]
                inferred = False
                if not keys and previous:
                    keys = [previous]
                    inferred = True
                for key in keys:
                    record = questions.setdefault(key, {"key": key, "root": root(key),
                                                       "marks": None, "mark_source": None,
                                                       "source_pages": [], "markscheme_pages": [],
                                                       "shared_context_pages": [], "review_status": "pending_visual_verification",
                                                       "matching_status": "not_matched"})
                    matched = next((a for a in unique if a["key"] == key), None)
                    if matched and record["marks"] is None and matched["marks"] is not None:
                        record["marks"] = matched["marks"]
                        record["mark_source"] = matched["mark_source"]
                    record["source_pages"].append({"page": entry["page"], "assignment": "inferred_continuation" if inferred else "anchor",
                                                   "sibling_keys": keys, "evidence": matched["evidence"] if matched else None,
                                                   "method": entry["method"]})
                page_coverage.append({"page": entry["page"], "keys": keys,
                                      "status": "inferred_continuation" if inferred else "anchored" if keys else "unassigned",
                                      "observed_anchor_count": len(anchors)})
                if keys:
                    previous = keys[-1]
            mark_candidates = []
            mark_segments = collections.defaultdict(list)
            for scheme_id in group["markscheme_file_ids"]:
                previous_scheme_key = None
                for page in sources.get(scheme_id, []):
                    anchors = candidate_labels(page["text"], scheme=True)
                    unique = [x for x in anchors if not is_parent(x["key"])]
                    if not unique:
                        unique = [x for x in anchors if is_parent(x["key"])]
                    # An answer may start after the preceding page's question
                    # header, and continue ABOVE a new header on this page.
                    if previous_scheme_key and (not unique or previous_scheme_key not in [x["key"] for x in unique]):
                        mark_segments[(scheme_id, previous_scheme_key)].append({
                            "file_id": scheme_id, "page": page["page"],
                            "assignment": "leading_continuation" if unique else "inferred_continuation",
                            "evidence": None})
                    for anchor in unique:
                        mark_segments[(scheme_id, anchor["key"])].append({
                            "file_id": scheme_id, "page": page["page"],
                            "assignment": "anchor", "evidence": anchor["evidence"]})
                    if unique:
                        previous_scheme_key = unique[-1]["key"]
                    mark_candidates.append({"scheme_id": scheme_id, "page": page["page"],
                                            "keys": [x["key"] for x in anchors],
                                            "method": page["method"]})
            for key, record in questions.items():
                exact = [m for m in mark_candidates if key in m["keys"]]
                parent = [] if exact else [m for m in mark_candidates if root(key) in m["keys"]]
                matches = exact or parent
                matching_ids = {m["scheme_id"] for m in matches}
                matched_key = key if exact else root(key)
                record["markscheme_pages"] = [item for sid in matching_ids
                                                for item in mark_segments.get((sid, matched_key), [])]
                record["matching_status"] = "candidate_exact_key_unverified" if exact else (
                    "candidate_parent_unverified" if parent else
                    "no_matching_source" if not group["markscheme_file_ids"] else "not_located_in_scheme")
                if len(record["source_pages"]) > 1:
                    record["review_notes"] = ["Multiple source pages; check continuation and context"]
                else:
                    record["review_notes"] = []
                if record["marks"] is None:
                    record["review_notes"].append("Marks not reliably recognized")
                if record["mark_source"] == "criterion_badge_candidate":
                    record["review_notes"].append("Criterion badge may not equal marks")
            papers.append({"subject": group["subject"], "folder": group["folder"],
                           "paper_file_id": paper_id, "possible_markscheme_file_ids": group["markscheme_file_ids"],
                           "source_pages": len(pages), "page_coverage": page_coverage,
                           "questions": list(questions.values()),
                           "unassigned_pages": [x["page"] for x in page_coverage if x["status"] == "unassigned"],
                           "review_status": "automated_discovery_unverified"})
            source_page_cover[paper_id] = len(page_coverage)
    summary = {"files_in_audit": len(audit["files"]), "files_indexed": len(sources),
               "index_failures": len(failures), "question_papers_with_candidates": len(papers),
               "candidate_question_records": sum(len(p["questions"]) for p in papers),
               "question_source_pages_covered": sum(p["source_pages"] for p in papers),
               "unassigned_front_pages": sum(len(p["unassigned_pages"]) for p in papers),
               "candidate_exact_matches": sum(q["matching_status"] == "candidate_exact_key_unverified" for p in papers for q in p["questions"]),
               "candidate_parent_matches": sum(q["matching_status"] == "candidate_parent_unverified" for p in papers for q in p["questions"])}
    result = {"status": "candidate_automated_not_ready_for_publication", "summary": summary,
              "index_failures": failures, "papers": papers}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
