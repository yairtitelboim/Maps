# News Discovery Pipeline - Implementation Status

## ✅ Completed Phases

### Phase A: Ingest ✅
- **Status:** Complete and tested
- **Scripts:**
  - `scripts/news-ingest/init_db.py` - Database initialization
  - `scripts/news-ingest/serpapi_fetcher.py` - Single query fetcher
  - `scripts/news-ingest/batch_fetcher.py` - Batch query fetcher
- **Features:**
  - SerpAPI integration with timeout protection
  - URL canonicalization
  - SQLite storage
  - Health checks every 10 results
  - Hard timeout at 55 seconds

### Phase B: Deduplication ✅
- **Status:** Complete and tested
- **Script:** `scripts/news-process/deduplicate.py`
- **Features:**
  - Tiered deduplication (avoids O(n²))
  - Exact URL matching
  - Publisher + title matching
  - Fuzzy matching within candidate sets
  - Health checks every 100 articles

### Phase C: Classification ✅
- **Status:** Complete and tested
- **Script:** `scripts/news-process/classify.py`
- **Features:**
  - Rules-based classification
  - 3 buckets: project_announcement, context, noise
  - Confidence scoring
  - Health checks every 50 mentions

### Phase D: Extract Project Cards ✅
- **Status:** Complete and tested
- **Script:** `scripts/news-process/extract_project_cards.py`
- **Features:**
  - Extracts company, location, size (MW/sqft)
  - Probabilistic extraction (many nulls expected)
  - Pattern matching for various formats
  - Confidence scoring
  - Health checks every 20 mentions

### Phase E: Entity Resolution ✅
- **Status:** Complete and tested
- **Script:** `scripts/news-process/entity_resolution.py`
- **Features:**
  - Merges multiple articles into projects
  - Same company + location within time window
  - Same site hint matching
  - Merges source URLs
  - Health checks every 10 cards

### Phase F: Status Tracking ✅
- **Status:** Complete and tested
- **Script:** `scripts/news-process/status_tracking.py`
- **Features:**
  - Tracks alive vs dead signals
  - Conflict resolution (newest signal wins)
  - Status history tracking
  - Handles revived projects
  - Health checks every 10 projects

## 📊 Current Stats

- **Raw Articles:** 15+ articles ingested
- **Unique Mentions:** 15+ after deduplication
- **Project Announcements:** 2+ identified
- **Project Cards Extracted:** 2
- **Projects Merged:** 2
- **All Scripts:** Complete in <5 seconds each

## 🚀 Quick Start

### 1. Initialize Database (one-time)
```bash
python3 scripts/news-ingest/init_db.py
```

### 2. Fetch Articles
```bash
# Single query
python3 scripts/news-ingest/serpapi_fetcher.py --query "data center Texas" --max-results 50

# Batch from config
python3 scripts/news-ingest/batch_fetcher.py --limit 5
```

### 3. Process Articles
```bash
# Deduplicate
python3 scripts/news-process/deduplicate.py

# Classify
python3 scripts/news-process/classify.py

# Extract Project Cards
python3 scripts/news-process/extract_project_cards.py

# Entity Resolution
python3 scripts/news-process/entity_resolution.py

# Status Tracking
python3 scripts/news-process/status_tracking.py
```

## ⏱️ Performance

All scripts designed to complete in **<60 seconds**:
- Single query fetch: ~1-3 seconds
- Deduplication: <1 second (for 100 articles)
- Classification: <1 second (for 100 mentions)
- Extract project cards: <1 second (for 20 cards)
- Entity resolution: <1 second (for 10 projects)
- Status tracking: <1 second (for 10 projects)
- Batch fetcher: ~2-5 seconds per query

## 📋 Next Phase

### Phase G: Output Products (TODO)
- GeoJSON map layer (with geocoding)
- Timeline view (per project)
- CSV export (all projects)
- Evidence packs (per-project JSON with URLs and quotes)

## 🔧 Configuration

- **Queries:** `config/news_queries.json`
- **Database:** `data/news/news_pipeline.db`
- **API Key:** `SERP_API_KEY` in `.env.local`

## 📝 Notes

- All scripts include timeout protection
- Health checks prevent runaway processes
- Designed for Texas data centers only (MVP)
- Probabilistic data model (many fields will be null)

