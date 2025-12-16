# Phase 4.4: Full-Text Article Fetching - Implementation Guide

## Overview

Phase 4.4 fetches full article content for mentions that don't have `raw_text`. This enables Phase 4.3 (LLM extraction) to work with sufficient text.

## Installation

Install required packages:

```bash
pip install readability-lxml newspaper3k requests
```

Or install individually:
```bash
pip install readability-lxml  # Primary method (better quality)
pip install newspaper3k        # Fallback method
pip install requests           # For basic fetching
```

## Usage

### Dry Run (Preview)
```bash
python3 scripts/news-process/fetch_full_text.py --dry-run --limit 20
```

### Fetch Full Text
```bash
python3 scripts/news-process/fetch_full_text.py --limit 20
```

### Options
- `--limit N`: Maximum number of articles to fetch (default: 20)
- `--dry-run`: Show what would be fetched without actually fetching
- `--db-path PATH`: Custom database path (default: `data/news/news_pipeline.db`)

## How It Works

1. **Identifies articles that need fetching:**
   - No `raw_text` in database
   - No company extracted OR no specific location (beyond "Texas")
   - Has valid URL

2. **Fetches article content:**
   - Tries `readability-lxml` first (best quality)
   - Falls back to `newspaper3k` if readability fails
   - Falls back to basic HTML parsing if both fail

3. **Stores results:**
   - Updates `mentions.raw_text` with full article text
   - Marks failed fetches with empty string to avoid re-trying

4. **Timeout protection:**
   - Max 55 seconds runtime
   - Processes articles in batches
   - Graceful shutdown on timeout

## Expected Results

After running Phase 4.4:
- Articles will have `raw_text` populated
- Phase 4.3 (LLM extraction) can then process these articles
- Better extraction of companies and locations from full article content

## Troubleshooting

### Package Installation Issues
If `readability-lxml` fails to install:
```bash
# Try installing dependencies first
pip install lxml html5lib
pip install readability-lxml
```

### Rate Limiting
If you encounter rate limiting:
- Reduce `--limit` to smaller batches (e.g., 10)
- Add delays between fetches (modify script)
- Run multiple times with different limits

### Timeout Issues
If script times out:
- Reduce `--limit` (fewer articles per run)
- Run multiple times to process all articles
- Check network connectivity

## Next Steps

After Phase 4.4:
1. Run Phase 4.3 (LLM extraction) to extract companies/locations from full text
2. Re-run extraction on articles with newly fetched text
3. Verify improvements in project name extraction

