# Question image reconstruction (private staging)

The old question-by-question crop set is **not** a verified reference. Rebuild
from the official PDFs, and keep source documents and rendered images outside
the public repository. This directory contains crop coordinates and source
checksums only.

The `N24-extended-maths.json` manifest is a **three-subquestion pilot**, not a
complete November 2024 paper. Its question 1c maps provisionally to the
three-mark entry labelled `d` in the official markscheme; that discrepancy
needs explicit human review before import.

To render a staged set:

```bash
python3 scripts/rebuild_question_images.py \
  --manifest scripts/image-manifests/N24-extended-maths.json \
  --source-dir /private/official-pdfs \
  --output-dir /private/new-staging-directory
```

The command refuses to overwrite a staging directory, validates exact source
SHA-256 hashes, checks source pages and crop coordinates, and writes an
`audit.json` with **pending** review status for every rendered image. It does
not upload, delete, replace, or publish any Supabase data.

Before replacing any legacy image:

1. Inspect the entire source paper, shared context, diagrams, every question
   part and the matching markscheme page (including continuation pages).
2. Render each part into one or more readable, correctly ordered crops.
3. Verify each rendered asset visually against its source; record any ambiguity
   and resolve it before declaring the part complete.
4. Reconcile the stable paper/part key against the **restored** live database
   IDs, preserving any student-linked records and applying access controls.
5. Take a recoverable snapshot of legacy metadata and storage objects before
   an approved replacement, then verify the student view.

Do not add copyrighted source PDFs, crop PNGs, or confidential markschemes to
this public GitHub repository. Store reviewed assets in a private, authorized
location until licensing and access are confirmed.
