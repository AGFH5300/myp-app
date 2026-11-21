"""Render private, auditable first-pass images for every discovered exam part.

Uses exact embedded-text positions where possible; otherwise seeks header boxes
with OCR. Never calls an automated crop a verified question or answer.
Uncertain pages fall back to complete-page images to avoid dropping diagrams.
"""

import argparse
import collections
import csv
import hashlib
import io
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

import fitz
from PIL import Image

from build_question_registry import candidate_labels


def tesseract_positions(page, scale=1.7):
    if scale > 3 and page.parent.name:
        try:
            dpi = 280
            png = subprocess.run(["pdftoppm", "-f", str(page.number + 1),
                                  "-l", str(page.number + 1), "-r", str(dpi),
                                  "-singlefile", "-png", page.parent.name],
                                 stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                 timeout=90, check=True).stdout
            scale = dpi / 72
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            png = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False).tobytes("png")
    else:
        png = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False).tobytes("png")
    env = {**os.environ, "OMP_THREAD_LIMIT": "1", "OMP_NUM_THREADS": "1"}
    try:
        result = subprocess.run(["tesseract", "stdin", "stdout", "--psm", "11", "tsv"],
                                input=png, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                env=env, timeout=55, check=True)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return {}
    lines = collections.defaultdict(list)
    reader = csv.DictReader(io.StringIO(result.stdout.decode("utf-8", errors="replace")), delimiter="\t")
    for item in reader:
        word = item.get("text", "").strip()
        if not word or item.get("level") != "5":
            continue
        key = tuple(item[k] for k in ("block_num", "par_num", "line_num"))
        try:
            left, top, width, height = [int(item[k]) for k in ("left", "top", "width", "height")]
            lines[key].append((left, top, left + width, top + height, word))
        except ValueError:
            continue
    found = collections.defaultdict(list)
    for words in lines.values():
        words.sort(key=lambda x: x[0])
        text = ""
        spans = []
        for w in words:
            start = len(text)
            text += (" " if text else "") + w[4]
            spans.append((start + (1 if start else 0), len(text), w))
        for item in candidate_labels(text):
            start = item["offset"]
            end = start + len(item["evidence"])
            selected = [w for a, b, w in spans if a < end and b > start]
            if not selected:
                continue
            x = min(w[0] for w in selected) / scale
            y = min(w[1] for w in selected) / scale
            found[item["key"]].append((x, y))
    return found


def anchor_positions(page, entries):
    found = {}
    for key, evidence, assignment in entries:
        if assignment == "leading_continuation":
            found[key] = (0, 0)
            continue
        if not evidence:
            continue
        hits = page.search_for(evidence)
        if hits:
            found[key] = (hits[0].x0, hits[0].y0)
    if len(found) < len(entries) and len(entries) > 1:
        ocr = tesseract_positions(page)
        for key, _, _ in entries:
            if key not in found and ocr.get(key):
                found[key] = ocr[key][0]
    if len(found) < len(entries) and len(entries) > 1:
        # Small screenshot text (especially 2024–26) often needs 270 dpi.
        ocr = tesseract_positions(page, scale=3.75)
        for key, _, _ in entries:
            if key not in found and ocr.get(key):
                found[key] = ocr[key][0]
    return found


def image_regions(page, entries):
    """Return {key: (rect, confidence)} plus a shared context rect, if warranted."""
    width, height = page.rect.width, page.rect.height
    if len(entries) == 1:
        return {entries[0][0]: (fitz.Rect(0, 0, width, height), "full_page_single")}, None
    locations = anchor_positions(page, entries)
    if len(locations) != len(entries):
        return {key: (fitz.Rect(0, 0, width, height), "full_page_ambiguous") for key, _, _ in entries}, None
    positioned = sorted(((key, *locations[key]) for key, _, _ in entries), key=lambda z: (z[2], z[1]))
    bands = []
    for entry in positioned:
        if bands and abs(entry[2] - bands[-1][0][2]) <= height * 0.045:
            bands[-1].append(entry)
        else:
            bands.append([entry])
    regions = {}
    for band_idx, band in enumerate(bands):
        top = max(0, min(e[2] for e in band) - height * 0.012)
        bottom = (min(e[2] for e in bands[band_idx + 1]) - height * 0.015) if band_idx + 1 < len(bands) else height
        bottom = min(height, max(top + height * 0.06, min(height, bottom)))
        if len(band) == 1:
            regions[band[0][0]] = (fitz.Rect(0, top, width, bottom), "text_anchor_vertical")
            continue
        sorted_x = sorted(band, key=lambda e: e[1])
        if any(sorted_x[j+1][1] - sorted_x[j][1] < width * 0.22 for j in range(len(sorted_x)-1)):
            for key, _, _ in sorted_x:
                regions[key] = (fitz.Rect(0, top, width, bottom), "full_width_same_row_ambiguous")
            continue
        # The anchor is near each panel's left edge; the next panel generally
        # begins just before its own header. Midpoints can cut a wide diagram.
        separators = [0] + [sorted_x[j+1][1] - width * 0.025 for j in range(len(sorted_x)-1)] + [width]
        for j, (key, x, y) in enumerate(sorted_x):
            left = max(0, separators[j] - width * (0.01 if j else 0))
            right = min(width, separators[j+1] + width * (0.01 if j < len(sorted_x) - 1 else 0))
            regions[key] = (fitz.Rect(left, top, right, bottom), "text_anchor_columns")
    first = min(b[0][2] for b in bands)
    context = fitz.Rect(0, 0, width, first - height * 0.02) if first > height * 0.18 else None
    return regions, context


def write_png(page, rect, output_path, scale):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=rect, alpha=False)
        pix.save(output_path)
    except Exception as original_error:
        # Some MYP 2016 PDFs display in Poppler but their image streams trigger
        # MuPDF's "Invalid bandwriter header dimensions/setup" exception.
        # Render the exact source page via a second engine before declaring the
        # question image missing. Keep its original PDF/page/rect provenance.
        source_pdf = page.parent.name
        if not source_pdf:
            raise original_error
        with tempfile.TemporaryDirectory(prefix="myp-pdf-render-") as tmpdir:
            prefix = Path(tmpdir) / "page"
            dpi = max(72, round(72 * scale))
            subprocess.run(["pdftoppm", "-f", str(page.number + 1),
                            "-l", str(page.number + 1), "-r", str(dpi),
                            "-singlefile", "-png", source_pdf, str(prefix)],
                           check=True, timeout=90, stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL)
            with Image.open(prefix.with_suffix(".png")) as rendered:
                x_scale = rendered.width / page.rect.width
                y_scale = rendered.height / page.rect.height
                bounds = (max(0, int(rect.x0 * x_scale)),
                          max(0, int(rect.y0 * y_scale)),
                          min(rendered.width, int(rect.x1 * x_scale + 0.999)),
                          min(rendered.height, int(rect.y1 * y_scale + 0.999)))
                with rendered.crop(bounds) as crop:
                    crop.save(output_path)
    return hashlib.sha256(output_path.read_bytes()).hexdigest()


def main():
    # Some historical PDFs have noisy, recoverable broken-xref warnings.
    # File-level failures are still captured in the per-paper audit.
    fitz.TOOLS.mupdf_display_errors(False)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", type=Path, required=True)
    parser.add_argument("--audit", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--scale", type=float, default=2.0)
    parser.add_argument("--subject", help="Process one subject, useful for resumable batches")
    parser.add_argument("--limit", type=int, help="Pilot number of papers")
    parser.add_argument("--shard-index", type=int, default=0)
    parser.add_argument("--shard-count", type=int, default=1)
    parser.add_argument("--resume", action="store_true", help="Reuse verified per-paper staging checkpoints")
    args = parser.parse_args()
    registry = json.loads(args.registry.read_text(encoding="utf-8"))
    audit = json.loads(args.audit.read_text(encoding="utf-8"))
    source_paths = {s["id"]: Path(s["path"]) for s in audit["files"]}
    if not 1 <= args.shard_count <= 128 or not 0 <= args.shard_index < args.shard_count:
        parser.error("Shard index must be between 0 and shard count - 1")
    papers = [p for p in registry["papers"] if (not args.subject or p["subject"] == args.subject)]
    papers = [p for index, p in enumerate(papers) if index % args.shard_count == args.shard_index]
    if args.limit:
        papers = papers[:args.limit]
    args.output_dir.mkdir(parents=True, exist_ok=args.resume)
    outputs = []
    warnings = []
    for i, paper in enumerate(papers):
        paper_id = paper["paper_file_id"]
        paper_checkpoint = args.output_dir / paper_id / "paper_assets.json"
        if args.resume and paper_checkpoint.is_file():
            prior = json.loads(paper_checkpoint.read_text(encoding="utf-8"))
            existing_q = {(a["key"], a["source_page"]) for a in prior["assets"]
                          if a["role"] == "question" and isinstance(a["key"], str)}
            existing_m = {(a["key"], a["source_id"], a["source_page"]) for a in prior["assets"]
                          if a["role"] == "markscheme" and isinstance(a["key"], str)}
            needed_q = {(q["key"], p["page"]) for q in paper["questions"] for p in q["source_pages"]}
            needed_m = {(q["key"], p["file_id"], p["page"]) for q in paper["questions"]
                        for p in q["markscheme_pages"]}
            tiny = any((a["region"][2] - a["region"][0] < 100 or
                        a["region"][3] - a["region"][1] < 42) for a in prior["assets"])
            if (not prior.get("warnings") and not tiny and needed_q <= existing_q and needed_m <= existing_m
                    and all((args.output_dir / asset["file"]).is_file() for asset in prior["assets"])):
                outputs.extend(prior["assets"])
                warnings.extend(prior.get("warnings", []))
                continue
        paper_start = len(outputs)
        warning_start = len(warnings)
        source_ids = {paper_id} | {s for q in paper["questions"] for s in (m["file_id"] for m in q["markscheme_pages"])}
        documents = {}
        try:
            for source_id in source_ids:
                documents[source_id] = fitz.open(source_paths[source_id])
            items = collections.defaultdict(list)
            for question in paper["questions"]:
                for source_page in question["source_pages"]:
                    items[(paper_id, source_page["page"], "question")].append((question["key"], source_page.get("evidence"), source_page.get("assignment")))
                for scheme_page in question["markscheme_pages"]:
                    items[(scheme_page["file_id"], scheme_page["page"], "markscheme")].append((question["key"], scheme_page.get("evidence"), scheme_page.get("assignment")))
            for (source_id, page_no, role), entries in items.items():
                keys = [(key, *evidence_assignment) for key, evidence_assignment in dict((k, (e, a)) for k, e, a in entries).items()]
                page = documents[source_id][page_no - 1]
                regions, context = image_regions(page, keys)
                for key, (rect, method) in regions.items():
                    filename = f"{paper_id}/{key}_{role}_p{page_no:03d}.png"
                    output = args.output_dir / filename
                    rect = rect & page.rect
                    if rect.width < max(100, page.rect.width * 0.2) or rect.height < max(42, page.rect.height * 0.055):
                        rect, method = page.rect, "full_page_invalid_split"
                    try:
                        sha = write_png(page, rect, output, args.scale)
                    except Exception as exc:
                        try:
                            rect, method = page.rect, "full_page_render_retry"
                            sha = write_png(page, rect, output, args.scale)
                        except Exception as retry_error:
                            warnings.append({"paper_id": paper_id, "file": filename,
                                             "error": str(retry_error), "first_error": str(exc)})
                            continue
                    outputs.append({"paper_id": paper_id, "key": key, "role": role, "file": filename,
                                    "source_id": source_id, "source_page": page_no,
                                    "region": [round(v, 2) for v in rect], "crop_method": method,
                                    "sha256": sha, "review_status": "pending_human_verification"})
                if role == "question" and context:
                    shared_key = re.sub(r"[^a-zA-Z0-9_-]", "_", "_".join(k for k, _, _ in keys))
                    filename = f"{paper_id}/shared_{shared_key}_p{page_no:03d}.png"
                    try:
                        sha = write_png(page, context, args.output_dir / filename, args.scale)
                    except Exception as exc:
                        warnings.append({"paper_id": paper_id, "file": filename, "error": str(exc)})
                        continue
                    outputs.append({"paper_id": paper_id, "key": [k for k, _, _ in keys], "role": "context", "file": filename,
                                    "source_id": source_id, "source_page": page_no,
                                    "region": [round(v, 2) for v in context], "crop_method": "pre_anchor_shared_context",
                                    "sha256": sha, "review_status": "pending_human_verification"})
        except Exception as exc:
            warnings.append({"paper_id": paper_id, "error": str(exc)})
        finally:
            for doc in documents.values():
                doc.close()
        paper_checkpoint.parent.mkdir(parents=True, exist_ok=True)
        paper_checkpoint.write_text(json.dumps({"assets": outputs[paper_start:],
                                                "warnings": warnings[warning_start:]}, indent=2), encoding="utf-8")
        if (i + 1) % 10 == 0:
            print(f"Rendered {i+1}/{len(papers)} paper sources, {len(outputs)} assets", flush=True)
    (args.output_dir / "assets_audit.json").write_text(json.dumps({"status": "unverified", "assets": outputs,
                                                                    "warnings": warnings}, indent=2), encoding="utf-8")
    print(json.dumps({"papers": len(papers), "assets": len(outputs), "warnings": len(warnings)}, indent=2))


if __name__ == "__main__":
    main()
