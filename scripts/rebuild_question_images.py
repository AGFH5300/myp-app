"""Render privately staged question/markscheme crops from a reviewed manifest.

Usage:
    python3 scripts/rebuild_question_images.py \
      --manifest scripts/image-manifests/N24-extended-maths.json \
      --source-dir /path/to/official-pdfs \
      --output-dir /path/to/new-private-staging-directory

Requires PyMuPDF (`pip install pymupdf`). Original PDFs are never modified.
"""

import argparse
import hashlib
import json
from pathlib import Path

import fitz


def digest(path: Path) -> str:
    sha = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            sha.update(block)
    return sha.hexdigest()


def validate_crop(crop: dict, documents: dict) -> tuple[fitz.Document, fitz.Rect]:
    source = crop["source"]
    if source not in documents:
        raise ValueError(f"Unknown source type: {source}")
    document = documents[source]
    page_number = crop["page"]
    if type(page_number) is not int or not 1 <= page_number <= len(document):
        raise ValueError(f"Invalid source page: {page_number}")
    region = crop["region"]
    if not isinstance(region, list) or len(region) != 4:
        raise ValueError("Crop region must be [left, top, right, bottom]")
    left, top, right, bottom = region
    if not all(type(value) in (int, float) for value in region) or not (0 <= left < right <= 1 and 0 <= top < bottom <= 1):
        raise ValueError(f"Crop region is out of bounds: {region}")
    page = document[page_number - 1]
    return document, fitz.Rect(
        page.rect.x0 + left * page.rect.width,
        page.rect.y0 + top * page.rect.height,
        page.rect.x0 + right * page.rect.width,
        page.rect.y0 + bottom * page.rect.height,
    )


def rebuild(manifest_path: Path, source_dir: Path, output_dir: Path) -> int:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    paper_code = manifest["paper_code"]
    if not paper_code or any(char not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_" for char in paper_code):
        raise ValueError(f"Invalid paper code: {paper_code}")
    documents = {}
    source_hashes = {}
    for source, config in manifest["sources"].items():
        name = config["filename"]
        if Path(name).name != name or not name.endswith(".pdf"):
            raise ValueError(f"Invalid source filename: {name}")
        path = source_dir / name
        sha256 = digest(path)
        if sha256 != config["sha256"]:
            raise ValueError(f"Source checksum changed: {name}")
        source_hashes[source] = sha256
        documents[source] = fitz.open(path)

    assets = []
    names = set()
    for question in manifest["questions"]:
        key = question["question_key"]
        if not key or any(char not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_" for char in key):
            raise ValueError(f"Invalid question key: {key}")
        for asset_type in ("question", "markscheme"):
            for index, crop in enumerate(question.get(asset_type, []), start=1):
                if crop["source"] != asset_type:
                    raise ValueError(f"Incorrect source for {key} {asset_type}")
                _, rectangle = validate_crop(crop, documents)
                name = f"{paper_code}_{key}_{asset_type}_{index:02d}.png"
                if name in names:
                    raise ValueError(f"Duplicate asset: {name}")
                names.add(name)
                assets.append((name, question, asset_type, crop, rectangle))

    # Refuse to overwrite any previously staged or reviewed image archive.
    output_dir.mkdir(parents=True, exist_ok=False)
    audit = {"paper_code": manifest["paper_code"], "source_hashes": source_hashes, "assets": []}
    for name, question, asset_type, crop, rectangle in assets:
        page = documents[crop["source"]][crop["page"] - 1]
        image_path = output_dir / name
        page.get_pixmap(matrix=fitz.Matrix(2.5, 2.5), clip=rectangle, alpha=False).save(image_path)
        audit["assets"].append({
            "question_key": question["question_key"],
            "asset_type": asset_type,
            "filename": name,
            "source_page": crop["page"],
            "source_region": crop["region"],
            "sha256": digest(image_path),
            "review_status": "pending_human_verification",
            "notes": question.get("notes", ""),
        })
    (output_dir / "audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    return len(assets)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    print(f"Staged {rebuild(args.manifest, args.source_dir, args.output_dir)} images for visual review")
