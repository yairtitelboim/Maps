#!/bin/bash
# Step 3: Process PDFs

echo "=========================================="
echo "Step 3: Processing PDFs"
echo "=========================================="
echo ""

python3 scripts/grda/grda_pdf_processor.py

echo ""
echo "Summary:"
if [ -f "data/grda/processing_summary.json" ]; then
    python3 -c "
import json
try:
    d = json.load(open('data/grda/processing_summary.json'))
    stats = d.get('stats', {})
    print(f'✓ Processed: {stats.get(\"processed\", 0)} PDFs')
    print(f'✓ Failed: {stats.get(\"failed\", 0)} PDFs')
    print(f'✓ Total pages: {stats.get(\"total_pages\", 0)}')
    print(f'✓ Total characters: {stats.get(\"total_characters\", 0):,}')
    print(f'✓ Location: data/grda/processed/')
except Exception as e:
    print(f'Error: {e}')
"
else
    find data/grda/processed -name "*.json" 2>/dev/null | wc -l | xargs echo "Processed files found:"
fi

