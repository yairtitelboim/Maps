#!/bin/bash
# Step 1: Map GRDA Website

echo "=========================================="
echo "Step 1: Mapping GRDA Website"
echo "=========================================="
echo ""

python3 scripts/grda/grda_website_mapper.py

echo ""
echo "Summary:"
python3 -c "
import json
try:
    d = json.load(open('data/grda/website_structure.json'))
    pages = len(d.get('pages', []))
    pdfs = len(d.get('all_pdfs', []))
    print(f'✓ Pages crawled: {pages}')
    print(f'✓ PDFs discovered: {pdfs}')
    print('\nPDFs by vertical:')
    for k, v in d.get('pdfs_by_vertical', {}).items():
        if v:
            print(f'  {k}: {len(v)} PDFs')
except Exception as e:
    print(f'Error: {e}')
"

