# Data Architecture Overview

**Last Updated:** 2025-01-XX  
**Project:** Texas Data Center & ERCOT Energy Infrastructure Tracking

---

## Executive Summary

This project tracks **two complementary datasets**:

1. **Data Center Projects** (~100 articles → 73 projects) - Discovered from news articles
2. **ERCOT Energy Projects** (76,001 projects) - Official interconnection queue data

These datasets are visualized together on an interactive map to show the relationship between data center development and energy infrastructure in Texas.

---

## Dataset 1: Data Center Projects (News Pipeline)

### Overview
Data centers are discovered through a **news-first discovery pipeline** that ingests articles, extracts structured project information, and tracks project status over time.

### Data Flow

```
News Articles (SerpAPI/Google News)
    ↓
Phase A: Ingest → raw_articles table
    ↓
Phase B: Deduplicate → mentions table
    ↓
Phase C: Classify → classified_mentions table
    ↓
Phase D: Extract → project_cards table
    ↓
Phase E: Resolve → projects table
    ↓
Phase F: Status Tracking → project_status table
    ↓
Phase G: Export → texas_data_centers.geojson
```

### Database Location
**File:** `data/news/news_pipeline.db` (SQLite)

### Current Statistics
- **Raw Articles:** 628
- **Mentions:** 627 (normalized, deduplicated)
- **Project Cards:** 101 (extracted structured data)
- **Projects:** 92 (merged from multiple articles)
- **Exported Projects:** 73 (with valid Texas coordinates)

### Database Schema

#### `raw_articles` (Phase A)
- Initial article ingestion from SerpAPI
- Fields: `url`, `canonical_url`, `title`, `publisher`, `published_at`, `snippet`, `raw_text`

#### `mentions` (Phase B)
- Normalized, deduplicated articles
- Fields: Same as `raw_articles`, plus `source_urls` (JSON array for merged duplicates)

#### `classified_mentions` (Phase C)
- Classification results: `project_announcement`, `context`, or `noise`
- Fields: `classification`, `confidence`, `matched_signals`, `reasoning`

#### `project_cards` (Phase D)
- Extracted structured data from articles
- Fields: `project_name`, `company`, `location_text`, `size_mw`, `size_sqft`, `size_acres`, `announced_date`, `expected_completion_date`, `probability_score`, `site_hint`

#### `projects` (Phase E)
- Merged projects from multiple articles/mentions
- Fields: Same as `project_cards`, plus `mention_ids` (JSON array), `source_urls` (JSON array), `lat`, `lng`, `geocode_confidence`

#### `project_status` (Phase F)
- Status tracking: `active`, `uncertain`, `dead_candidate`, `revived`
- Fields: `status_current`, `status_confidence`, `status_history`, `last_signal_at`

### Extraction Coverage
- **Size (MW):** 31.7% (32/101 projects)
- **Size (Sqft):** 2.0% (2/101 projects)
- **Size (Acres):** 26.7% (27/101 projects) - **NEW**
- **Expected Completion Date:** 4.0% (4/101 projects) - **NEW**
- **Probability Score:** 21.8% (22/101 projects) - **NEW**
- **Company:** 82.2% (83/101 projects)
- **Location:** 100% (all projects have location)

### Output File
**File:** `public/data/texas_data_centers.geojson`

**Properties:**
- `project_id`, `project_name`, `company`, `location`
- `size_mw`, `size_sqft`, `size_acres`
- `announced_date`, `expected_completion_date`
- `probability_score` (high/medium/low/unknown)
- `status` (active/uncertain/dead_candidate/revived)
- `source_url`, `article_title`
- `lat`, `lng`, `geocode_confidence`

### Pipeline Scripts

**Phase A - Ingestion:**
- `scripts/news-ingest/init_db.py` - Initialize database
- `scripts/news-ingest/serpapi_fetcher.py` - Fetch articles from SerpAPI
- `scripts/news-ingest/batch_fetcher.py` - Batch fetch from `config/news_queries.json`

**Phase B - Deduplication:**
- `scripts/news-process/deduplicate.py` - Normalize and deduplicate

**Phase C - Classification:**
- `scripts/news-process/classify.py` - Classify articles

**Phase D - Extraction:**
- `scripts/news-process/extract_project_cards.py` - Extract structured data
- `scripts/news-process/fetch_full_text.py` - Fetch full article content (optional)

**Phase E - Entity Resolution:**
- `scripts/news-process/resolve_entities.py` - Merge multiple articles into projects

**Phase F - Status Tracking:**
- `scripts/news-process/status_tracking_improved.py` - Track project status

**Phase G - Export:**
- `scripts/news-output/export_projects_geojson.py` - Export to GeoJSON

**Utilities:**
- `scripts/news-process/backfill_enhanced_extraction.py` - Re-extract with improved patterns
- `scripts/news-process/backfill_new_fields.py` - Backfill new fields (acres, expected date, probability)

### Configuration
**File:** `config/news_queries.json`

Defines search queries:
- **Core queries:** General data center searches
- **Company queries:** Company-specific searches (Google, Meta, Microsoft, etc.)
- **Geographic queries:** Location-specific searches (Dallas, Austin, etc.)

---

## Dataset 2: ERCOT Energy Projects

### Overview
Official ERCOT (Electric Reliability Council of Texas) interconnection queue data for energy generation projects (solar, wind, battery, gas, etc.).

### Data Source
**Source:** ERCOT GIS (Generator Interconnection Status) Reports  
**Format:** Excel files (`.xlsx`)  
**Frequency:** Monthly reports  
**Coverage:** 2017-2025 (8+ years of data)

### Current Statistics
- **Total Projects:** 76,001
- **Counties with Projects:** 207 out of 254 Texas counties
- **Project Types:** Solar, Wind, Battery, Gas, Other

### Data Processing Pipeline

```
ERCOT GIS Reports (Excel files)
    ↓
Download → data/ercot/gis_reports/raw/*.xlsx
    ↓
Consolidate → data/ercot/gis_reports/consolidated/ercot_gis_reports_consolidated_latest.json
    ↓
Geocode → data/ercot/gis_reports/geocoded/ercot_gis_reports_geocoded_latest.json
    ↓
Export → public/data/ercot/ercot_gis_reports.geojson
    ↓
Aggregate by County → data/ercot/county_aggregations.json
    ↓
Merge with Boundaries → public/data/ercot/ercot_counties_aggregated.geojson
```

### Key Data Fields

**Project-Level Data:**
- `INR` - Interconnection Request Number (unique ID)
- `Project Name` - Project name
- `County` - Texas county name
- `POI Location` - Point of Interconnection location
- `Capacity (MW)` - Project capacity
- `Fuel` - Fuel type (SOL, WIN, BAT, GAS, etc.)
- `Technology` - Technology type (PV, WT, etc.)
- `Projected COD` - Projected Commercial Operation Date
- `GIM Study Phase` - Study phase status
- `Interconnecting Entity` - Entity name

**County Aggregations:**
- `project_count` - Number of projects in county
- `total_capacity_mw` - Total capacity (MW)
- `avg_capacity_mw` - Average capacity (MW)
- `fuel_solar_count`, `fuel_wind_count`, `fuel_battery_count`, etc.
- `fuel_solar_capacity`, `fuel_wind_capacity`, `fuel_battery_capacity`, etc.
- `dominant_fuel_type` - Most common fuel type

### Output Files

**1. Project-Level GeoJSON:**
**File:** `public/data/ercot/ercot_gis_reports.geojson`
- 76,001 point features (one per project)
- Located at county centroids or POI locations
- All project-level fields included

**2. County Aggregations GeoJSON:**
**File:** `public/data/ercot/ercot_counties_aggregated.geojson`
- 254 county polygons (all Texas counties)
- Aggregated statistics per county
- 207 counties have projects

**3. County Boundaries:**
**File:** `public/data/texas/texas_counties.geojson`
- 254 Texas county boundaries
- Source: U.S. Census Bureau TIGER/Line Shapefiles

### Processing Scripts

**Data Collection:**
- `scripts/ercot/download_gis_reports.py` - Download ERCOT GIS reports
- `scripts/ercot/inspect_gis_file.py` - Inspect Excel file structure

**Data Processing:**
- `scripts/ercot/consolidate_gis_reports.py` - Consolidate multiple Excel files
- `scripts/ercot/geocode_gis_reports.py` - Geocode project locations
- `scripts/ercot/create_geojson.py` - Convert to GeoJSON

**Aggregation:**
- `scripts/ercot/aggregate_by_county.py` - Aggregate projects by county
- `scripts/ercot/merge_county_data.py` - Merge aggregations with county boundaries

**Analysis:**
- `scripts/ercot/county_level_analysis.py` - County-level statistical analysis
- `scripts/ercot/battery_dc_proximity_test.py` - Test proximity between batteries and data centers

### Raw Data Location
**Directory:** `data/ercot/gis_reports/raw/`
- Contains ~90 Excel files (monthly reports from 2017-2025)

**Consolidated Data:**
- `data/ercot/gis_reports/consolidated/ercot_gis_reports_consolidated_latest.json`
- `data/ercot/gis_reports/geocoded/ercot_gis_reports_geocoded_latest.json`

---

## How The Datasets Work Together

### Geographic Connection
Both datasets are geocoded and can be matched by:
- **County name** - Data centers and ERCOT projects share Texas counties
- **Coordinates** - Both have lat/lng for spatial analysis

### Frontend Integration

**Map Layers:**
1. **Texas Data Centers Layer** (`TexasDataCentersLayer.jsx`)
   - Displays 73 data center projects as markers
   - Popup shows: project name, company, location, size, status, expected date, probability
   - Article title as clickable link

2. **ERCOT Counties Layer** (`ERCOTCountiesLayer.jsx`)
   - Displays 254 Texas counties with color-coding by project density/capacity
   - Popup shows: county name, project count, total capacity, fuel breakdown

3. **ERCOT GIS Reports Layer** (`ERCOTGISReportsLayer.jsx`)
   - Displays 76,001 individual energy projects as point markers
   - Optional: Can be toggled on/off (very dense visualization)

**UI Components:**
- **AITransmissionNav** - Sidebar with:
  - ERCOT Counties table (county-level statistics)
  - Texas Data Centers table (project list with sorting)
  - Bidirectional interaction: Click marker → highlights table row, Click row → shows popup

### Data Relationships

**Potential Connections:**
1. **County-Level Context:** Data center popups could show ERCOT energy project statistics for the same county
2. **Proximity Analysis:** Find ERCOT projects near data centers (e.g., battery storage near data centers)
3. **Capacity Analysis:** Compare data center demand vs. available energy capacity in county
4. **Timeline Analysis:** Compare data center announcement dates vs. ERCOT project COD dates

**Current Implementation:**
- ✅ Both datasets displayed on same map
- ✅ County-level ERCOT aggregations available
- ⚠️ **Not yet implemented:** ERCOT context in data center popups (planned enhancement)

---

## Data Quality & Coverage

### Data Center Articles
- **Coverage:** 73 projects with coordinates (out of 92 total)
- **Geocoding:** 97.6% of projects geocoded
- **Size Data:** 31.7% have MW, 26.7% have acres
- **Timeline Data:** 4% have expected completion dates
- **Status Data:** 100% have status (active/uncertain/dead)

### ERCOT Energy Projects
- **Coverage:** 76,001 projects (100% geocoded)
- **Data Quality:** Excellent - all key fields populated
- **Time Range:** 2017-2025 (8+ years)
- **Geographic Coverage:** 207 of 254 Texas counties

---

## File Structure

```
data/
├── news/
│   └── news_pipeline.db          # SQLite database (all article data)
├── ercot/
│   ├── gis_reports/
│   │   ├── raw/                  # ~90 Excel files
│   │   ├── consolidated/         # Consolidated JSON
│   │   └── geocoded/             # Geocoded JSON
│   ├── county_aggregations.json  # County-level stats
│   └── datacenters/
│       └── texas_data_centers.csv

public/data/
├── texas_data_centers.geojson    # Data center projects (73)
├── ercot/
│   ├── ercot_gis_reports.geojson # ERCOT projects (76,001)
│   └── ercot_counties_aggregated.geojson  # County aggregations (254)
└── texas/
    └── texas_counties.geojson    # County boundaries (254)
```

---

## Key Documentation

### Data Center Pipeline
- `docs/NEWS_FIRST_DISCOVERY_PIPELINE.md` - Complete pipeline documentation
- `docs/ARTICLE_DATA_COLLECTION_REPORT.md` - What we extract from articles
- `docs/DATA_CENTER_POPUP_ENHANCEMENT_ANALYSIS.md` - Popup enhancement plan
- `scripts/news-ingest/README.md` - Phase A (Ingestion)
- `scripts/news-process/README.md` - Phases B & C (Processing)

### ERCOT Data
- `docs/ERCOT_GIS_REPORT_DATA_STRUCTURE.md` - ERCOT data structure
- `docs/ERCOT_COUNTY_BOUNDARIES_PLAN.md` - County aggregation plan
- `docs/ERCOT_QUEUE_DEEP_DIVE_README.md` - ERCOT queue analysis

### Extraction Improvements
- `scripts/news-process/EXTRACTION_IMPROVEMENT_PLAN.md` - Extraction enhancement plan
- `scripts/news-process/PHASE1_TEST_RESULTS.md` - Phase 1 results
- `scripts/news-process/BACKFILL_GUIDE.md` - Backfill instructions

---

## Quick Reference

### Run Data Center Pipeline
```bash
# 1. Initialize database
python3 scripts/news-ingest/init_db.py

# 2. Fetch articles
python3 scripts/news-ingest/batch_fetcher.py

# 3. Deduplicate
python3 scripts/news-process/deduplicate.py

# 4. Classify
python3 scripts/news-process/classify.py

# 5. Extract project cards
python3 scripts/news-process/extract_project_cards.py

# 6. Resolve entities
python3 scripts/news-process/resolve_entities.py

# 7. Track status
python3 scripts/news-process/status_tracking_improved.py

# 8. Export to GeoJSON
python3 scripts/news-output/export_projects_geojson.py
```

### Update ERCOT Data
```bash
# 1. Download new GIS reports
python3 scripts/ercot/download_gis_reports.py

# 2. Consolidate
python3 scripts/ercot/consolidate_gis_reports.py

# 3. Geocode
python3 scripts/ercot/geocode_gis_reports.py

# 4. Aggregate by county
python3 scripts/ercot/aggregate_by_county.py

# 5. Merge with boundaries
python3 scripts/ercot/merge_county_data.py
```

---

## Future Enhancements

### Planned
1. **ERCOT Context in Popups:** Show county-level ERCOT statistics in data center popups
2. **Proximity Analysis:** Find ERCOT projects within X miles of data centers
3. **Timeline Correlation:** Match data center announcements with ERCOT project timelines
4. **Enhanced Extraction:** Improve coverage of size, expected dates, probability scores
5. **Full-Text Fetching:** Increase raw_text coverage from 17.8% to 50%+

### Under Consideration
1. **LLM Extraction:** Use LLM for complex extraction cases (Phase 4.3)
2. **Sentiment Analysis:** Extract sentiment from articles
3. **Related Projects:** Show other projects by same company
4. **Evidence Packs:** Generate evidence documents for each project

---

## Data Refresh Strategy

### Data Centers (News Pipeline)
- **Frequency:** Daily or weekly
- **Process:** Run full pipeline (A→G)
- **New Articles:** Fetched from SerpAPI based on `config/news_queries.json`
- **Updates:** New projects added, existing projects updated with new mentions

### ERCOT Data
- **Frequency:** Monthly (when new GIS reports published)
- **Process:** Download → Consolidate → Geocode → Aggregate
- **Updates:** New projects added, existing projects updated with new status

---

## Summary

**Data Centers:** ~100 articles → 73 mapped projects  
**ERCOT Energy:** 76,001 projects across 207 counties  
**Connection:** Geographic (county-level), potential for proximity/timeline analysis  
**Visualization:** Interactive map with both datasets, county aggregations, and detailed popups

This architecture enables tracking of data center development in relation to energy infrastructure capacity and planning in Texas.

