# News Processing Pipeline - Phases B & C

## Phase B: Deduplication

Normalizes and deduplicates raw articles into mentions using tiered approach:

1. **Exact canonical URL** match
2. **Exact (publisher, normalized_title)** match  
3. **Fuzzy match** only within candidate set (same publisher OR same day)

### Usage
```bash
python3 scripts/news-process/deduplicate.py
```

### Features
- ✅ O(n) complexity (avoids O(n²) fuzzy matching)
- ✅ Timeout protection (<60 seconds)
- ✅ Health checks every 100 articles
- ✅ Merges duplicate source URLs

## Phase C: Classification

Classifies mentions into 3 buckets:
- **project_announcement** - Specific project with location/size/company
- **context** - General news about data centers
- **noise** - Jobs, pricing, crypto mining, etc.

### Usage
```bash
python3 scripts/news-process/classify.py
```

### Classification Rules
- Requires at least 1 data center keyword match
- Requires at least 2 signals (location, size, company, timeline, permit)
- Noise detection runs first (filters out jobs/pricing)

### Features
- ✅ Rules-based (fast, no API calls)
- ✅ Timeout protection (<60 seconds)
- ✅ Health checks every 50 mentions
- ✅ Confidence scoring (low/medium/high)

## Pipeline Flow

```
Raw Articles (Phase A)
    ↓
Deduplicate (Phase B)
    ↓
Classify (Phase C)
    ↓
[Next: Extract Project Cards (Phase D)]
```

## Database Tables

- `raw_articles` - Initial ingestion
- `mentions` - Normalized after deduplication
- `classified_mentions` - Classification results

## Test Results

From sample data:
- ✅ 5 raw articles → 5 unique mentions
- ✅ 2 project announcements identified
- ✅ 3 context/news articles
- ✅ All scripts complete in <1 second

