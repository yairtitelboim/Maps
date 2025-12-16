# News Ingestion Pipeline - Phase A

## Quick Start

### 1. Initialize Database
```bash
python3 scripts/news-ingest/init_db.py
```

### 2. Fetch Articles (Single Query)
```bash
python3 scripts/news-ingest/serpapi_fetcher.py --query "data center Texas" --max-results 50
```

### 3. Fetch Articles (From Config)
```bash
# TODO: Create batch fetcher that reads from config/news_queries.json
```

## Features

- ✅ **Timeout Protection**: Scripts automatically stop after 55 seconds
- ✅ **Health Checks**: Periodic checks ensure we stay under 1 minute
- ✅ **SerpAPI Integration**: Uses your `SERP_API_KEY` from `.env.local`
- ✅ **URL Canonicalization**: Removes tracking parameters
- ✅ **Deduplication**: Uses canonical URLs to prevent duplicates
- ✅ **SQLite Storage**: All articles saved to `data/news/news_pipeline.db`

## Database Schema

- `raw_articles` - Initial ingestion (Phase A)
- `mentions` - Normalized after deduplication (Phase B)
- `classified_mentions` - After classification (Phase C)
- `project_cards` - Extracted structured data (Phase D)
- `projects` - Merged projects (Phase E)
- `project_status` - Status tracking (Phase F)

## Time Limits

All scripts are designed to complete in **<60 seconds**:
- SerpAPI fetcher: ~1-3 seconds per query
- Health checks every 10 results
- Graceful timeout handling

## Next Steps

- [ ] Phase B: Deduplication script
- [ ] Phase C: Classification script
- [ ] Phase D: Project card extraction
- [ ] Phase E: Entity resolution
- [ ] Phase F: Status tracking
- [ ] Phase G: Output generation

