"""High-resolution OCR rescue for image-only question pages.

The first-pass index is never overwritten. Each supplemental page result is
checksum-linked to the same PDF and must be reviewed before publication.
"""

import argparse
import concurrent.futures
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

import fitz

from build_question_registry import candidate_labels


def rescue_file(path, index_path, dpi, smart=False):
    fitz.TOOLS.mupdf_display_errors(False)
    pages = json.loads(index_path.read_text(encoding="utf-8"))
    env = {**os.environ, "OMP_THREAD_LIMIT": "1", "OMP_NUM_THREADS": "1"}
    candidates = [entry for entry in pages if entry["kind"] in ("question", "combined") and entry["method"] == "ocr"
                  and (not smart or not candidate_labels(entry["text"])
                       or re.search(r"/202[3-6]/", entry.get("folder") or ""))]
    results = []
    if not candidates:
        return results
    # Poppler's resampling produces materially clearer tiny eAssessment text
    # than PyMuPDF for some image-based PDFs (confirmed against N25 Q1a/b).
    with tempfile.TemporaryDirectory(prefix="myp-poppler-") as temp:
        prefix = Path(temp) / "page"
        rendered = {}
        try:
            page_numbers = sorted({x["page"] for x in candidates})
            ranges = []
            for num in page_numbers:
                if ranges and num == ranges[-1][1] + 1:
                    ranges[-1][1] = num
                else:
                    ranges.append([num, num])
            for first, last in ranges:
                subprocess.run(["pdftoppm", "-f", str(first), "-l", str(last),
                                "-r", str(dpi), "-png", str(path), str(prefix)],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               check=True, timeout=180)
            rendered = {int(p.stem.rsplit("-", 1)[-1]): p for p in Path(temp).glob("page-*.png")}
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError):
            pass
        for entry in candidates:
            try:
                png_path = rendered.get(entry["page"])
                if png_path is None:
                    with fitz.open(path) as pdf:
                        png = pdf[entry["page"] - 1].get_pixmap(
                            matrix=fitz.Matrix(dpi / 72, dpi / 72), alpha=False).tobytes("png")
                    ocr_input = "stdin"
                else:
                    png = None
                    ocr_input = str(png_path)
                process = subprocess.run(["tesseract", ocr_input, "stdout", "--psm", "11"],
                                         input=png, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                         timeout=120, check=True, env=env)
                text = process.stdout.decode("utf-8", errors="replace")
                old_keys = {a["key"] for a in candidate_labels(entry["text"])}
                new_keys = {a["key"] for a in candidate_labels(text)}
                results.append({"page": entry["page"], "text": text,
                                "new_keys": sorted(new_keys - old_keys),
                                "all_keys": sorted(new_keys), "status": "ocr"})
            except (subprocess.TimeoutExpired, subprocess.CalledProcessError) as exc:
                results.append({"page": entry["page"], "text": "", "new_keys": [],
                                "all_keys": [], "status": type(exc).__name__})
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audit", required=True, type=Path)
    parser.add_argument("--index-checkpoints", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--dpi", type=int, default=270)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--smart", action="store_true", help="Prioritize missing-label pages and 2023–26 scans")
    args = parser.parse_args()
    audit = json.loads(args.audit.read_text(encoding="utf-8"))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    jobs = []
    for source in audit["files"]:
        if source["role"] not in ("question", "combined"):
            continue
        checkpoint = args.output_dir / (source["id"] + ".json")
        if checkpoint.is_file():
            continue
        jobs.append((source, checkpoint))
    done = 0
    recovered = 0
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(rescue_file, Path(source["path"]),
                               args.index_checkpoints / (source["id"] + ".json"), args.dpi, args.smart):
                   (source, checkpoint) for source, checkpoint in jobs}
        for future in concurrent.futures.as_completed(futures):
            source, checkpoint = futures[future]
            try:
                results = future.result()
                checkpoint.write_text(json.dumps({"id": source["id"], "sha256": source["sha256"],
                                                  "pages": results}, ensure_ascii=False), encoding="utf-8")
                recovered += sum(len(r["new_keys"]) for r in results)
            except Exception as exc:
                print(f"FAILED {source['subject']} {source['name']}: {exc}", flush=True)
            done += 1
            if done % 10 == 0:
                print(f"Rescued {done}/{len(jobs)} source files, new OCR anchors: {recovered}", flush=True)
    print(f"Finished {done}/{len(jobs)} files; new OCR anchors {recovered}", flush=True)


if __name__ == "__main__":
    main()
