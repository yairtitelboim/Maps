#!/bin/bash
# Step 2: Download PDFs

echo "=========================================="
echo "Step 2: Downloading PDFs"
echo "=========================================="
echo ""

python3 scripts/grda/grda_pdf_downloader.py

echo ""
echo "Summary:"
if [ -f "data/grda/pdf_manifest.json" ]; then
    python3 -c "
import json
try:
    d = json.load(open('data/grda/pdf_manifest.json'))
    total = d.get('total_pdfs', 0)
    success = d.get('successful_downloads', 0)
    failed = d.get('failed_downloads', 0)
    print(f'✓ Total PDFs: {total}')
    print(f'✓ Successfully downloaded: {success}')
    print(f'✓ Failed: {failed}')
    print(f'✓ Location: data/grda/pdfs/')
except Exception as e:
    print(f'Error: {e}')
"
else
    echo "⚠ Manifest not found. Checking downloaded files..."
    find data/grda/pdfs -name "*.pdf" 2>/dev/null | wc -l | xargs echo "PDFs found:"
fi

