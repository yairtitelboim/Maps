#!/bin/bash
# Step 4: LLM Extraction (Optional)

echo "=========================================="
echo "Step 4: LLM Extraction (Optional)"
echo "=========================================="
echo ""

if [ -z "$OPENAI_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠ No LLM API key found (OPENAI_KEY or ANTHROPIC_API_KEY)"
    echo "⚠ Skipping LLM extraction step"
    exit 0
fi

python3 scripts/grda/grda_llm_extraction.py

echo ""
echo "Summary:"
if [ -f "data/grda/processed/extraction_summary.json" ]; then
    python3 -c "
import json
try:
    d = json.load(open('data/grda/processed/extraction_summary.json'))
    stats = d.get('stats', {})
    print(f'✓ Documents processed: {stats.get(\"processed\", 0)}')
    print(f'✓ Failed: {stats.get(\"failed\", 0)}')
    print(f'✓ API calls: {stats.get(\"api_calls\", 0)}')
except Exception as e:
    print(f'Error: {e}')
"
else
    find data/grda/processed -name "*_enriched.json" 2>/dev/null | wc -l | xargs echo "Enriched files found:"
fi

