"""Index every source page, keeping OCR evidence private for manual segmentation.

This is a discovery aid, not verification of question content or answers.
Example:
  python3 scripts/index_exam_pages.py --source-dir /private/official-pdfs \
    --output /private/page-index.jsonl --workers 6
"""

import argparse
import concurrent.futures
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path

import fitz


HEADING = re.compile(r"\b(?:Question|Task)\s*(\d{1,2})\s*([a-z])?(?=\s|\(|\b)", re.I)
SCHEME_HEADING = re.compile(r"(?<!\w)Q\s*(\d{1,2})(?!\d)", re.I)


def index_pdf(path: Path, label=None, source_id=None, subject=None, folder=None, role=None,
              fallback_layout=True) -> list[dict]:
    is_scheme = role == "markscheme" or (
        role is None and ("Mark-Scheme" in path.name or path.name.endswith("-MS.pdf")))
    combined = role == "combined"
    source_sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
    rows = []
    ocr_env = {**os.environ, "OMP_THREAD_LIMIT": "1", "OMP_NUM_THREADS": "1"}
    with fitz.open(path) as pdf:
        for i, page in enumerate(pdf):
            embedded = page.get_text("text")
            if len(embedded.strip()) >= 80:
                text = embedded
                method = "embedded"
            else:
                # 145 dpi is enough to detect headings while keeping this pass affordable.
                dpi = 135 if fallback_layout else 115
                png = page.get_pixmap(matrix=fitz.Matrix(dpi / 72, dpi / 72), alpha=False).tobytes("png")
                try:
                    result = subprocess.run(
                        ["tesseract", "stdin", "stdout", "--psm", "11"],
                        input=png, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                        timeout=75, check=True, env=ocr_env,
                    )
                    text = result.stdout.decode("utf-8", errors="replace")
                    method = "ocr"
                except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
                    text = embedded
                    method = "ocr_error"
            # Keep ordered heading candidates and page text for subsequent manual review.
            candidates = []
            patterns = [SCHEME_HEADING, HEADING] if is_scheme or combined else [HEADING]
            for pattern in patterns:
                for match in pattern.finditer(text):
                    key = f"Q{int(match.group(1))}" + ((match.group(2) or "").lower() if pattern is HEADING else "")
                    if key not in candidates:
                        candidates.append(key)
            if fallback_layout and not candidates and method == "ocr" and not is_scheme:
                # Sparse-text mode often misses a small header next to a figure.
                # Recheck the whole page in automatic-layout mode before treating
                # the page as an unlabelled continuation.
                secondary = subprocess.run(
                    ["tesseract", "stdin", "stdout", "--psm", "3"],
                    input=png, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                    timeout=75, check=True, env=ocr_env,
                )
                secondary_text = secondary.stdout.decode("utf-8", errors="replace")
                for match in HEADING.finditer(secondary_text):
                    key = f"Q{int(match.group(1))}" + (match.group(2) or "").lower()
                    if key not in candidates:
                        candidates.append(key)
                if candidates:
                    text += "\n\n[Additional layout OCR]\n" + secondary_text
            rows.append({
                "source": label or path.name,
                "source_id": source_id,
                "subject": subject,
                "folder": folder,
                "source_sha256": source_sha256,
                "page": i + 1,
                "kind": "markscheme" if is_scheme else "combined" if combined else "question",
                "method": method,
                "headings": candidates,
                "text": text.strip(),
            })
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--sessions", nargs="*", help="Optional session prefixes, e.g. N24 M25")
    parser.add_argument("--inventory", type=Path, help="Drive source inventory JSON for all subjects")
    parser.add_argument("--retrieved", type=Path, help="Private downloaded PDFs named by Drive file ID")
    parser.add_argument("--extended", type=Path, help="Existing Extended Maths PDF folder")
    parser.add_argument("--no-layout-fallback", action="store_true", help="Fast first pass; flag pages for manual layout review")
    args = parser.parse_args()
    if args.inventory:
        from audit_exam_corpus import role_of, source_path
        docs = json.loads(args.inventory.read_text(encoding="utf-8"))["files"]
        if not args.retrieved or not args.extended:
            parser.error("--retrieved and --extended are required with --inventory")
        specs = [(source_path(d, args.retrieved, args.extended), d["name"], d["id"],
                  d["subject"], d["folder"], role_of(d["name"])) for d in docs]
    else:
        paths = sorted(args.source_dir.glob("[MN][0-9][0-9]-Extended-Maths*.pdf"))
        specs = [(p, p.name, None, None, None, None) for p in paths]
    if args.sessions:
        specs = [spec for spec in specs if spec[1][:3] in args.sessions]
    rows = []
    checkpoint_dir = args.output.parent / f"{args.output.stem}_checkpoints"
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as pool:
        futures = {}
        for path, name, identifier, subject, folder, role in specs:
            checkpoint = checkpoint_dir / f"{identifier or name}.json"
            sha = hashlib.sha256(path.read_bytes()).hexdigest()
            if checkpoint.exists():
                cached = json.loads(checkpoint.read_text(encoding="utf-8"))
                if cached and cached[0].get("source_sha256") == sha:
                    rows.extend(cached)
                    print(f"Resumed {name}: {len(cached)} pages", flush=True)
                    continue
            futures[pool.submit(index_pdf, path, name, identifier, subject, folder, role,
                                not args.no_layout_fallback)] = (name, checkpoint)
        for future in concurrent.futures.as_completed(futures):
            try:
                group = future.result()
            except Exception as exc:
                print(f"FAILED {futures[future][0]}: {exc}", flush=True)
                continue
            rows.extend(group)
            name, checkpoint = futures[future]
            checkpoint.write_text(json.dumps(group, ensure_ascii=False), encoding="utf-8")
            print(f"Indexed {name}: {len(group)} pages", flush=True)
    rows.sort(key=lambda row: (row["source"], row["page"]))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as out:
        for row in rows:
            out.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"Complete: {len(specs)} candidate files, {len(rows)} indexed pages, {args.output}")


if __name__ == "__main__":
    main()
