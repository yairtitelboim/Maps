# Data Center Popup Card Enhancement Analysis

**Date:** 2025-01-XX  
**Objective:** Identify meaningful data to add to data center marker popup cards that provides context about timing, content, sentiment, and relationship to ERCOT energy projects

---

## Current Popup Content

### Currently Displayed:
- ✅ Project name (clickable header)
- ✅ Status badge (active/uncertain/dead_candidate)
- ✅ Company name
- ✅ Location
- ✅ Size (MW, sqft)
- ✅ Site hint (in details)
- ✅ Announced date (in details)
- ✅ Source URL link (in details)
- ✅ Source count indicator (if multiple)

### Current Limitations:
- No ERCOT context (energy projects in same county)
- No article timeline/recency context
- No sentiment/content indicators
- No evidence/signal strength
- No publisher diversity
- No relationship to other data centers

---

## Available Data Sources

### 1. **Projects Table** (SQLite)
- `project_id`, `project_name`, `company`, `location_text`
- `size_mw`, `size_sqft`, `announced_date`
- `mention_ids` (JSON array) - links to articles
- `source_urls` (JSON array) - all source URLs
- `lat`, `lng`, `geocode_confidence`
- `status_current`, `status_confidence` (from `project_status` table)

### 2. **Mentions Table** (SQLite)
- `published_at` - article publication date
- `title` - article headline
- `publisher` - news source
- `snippet` - article excerpt
- `raw_text` - full article content (if fetched)
- `query_matched` - which search query found it

### 3. **Project Evidence Table** (SQLite)
- `evidence_type` - type of signal (announcement, construction, etc.)
- `evidence_text` - extracted evidence snippet
- `signal_strength` - confidence in the evidence

### 4. **ERCOT County Data** (GeoJSON)
- `project_count` - number of energy projects in county
- `total_capacity_mw` - total energy capacity in county
- `fuel_solar_count`, `fuel_wind_count`, `fuel_battery_count`, etc.
- `fuel_solar_capacity`, `fuel_wind_capacity`, etc.
- `dominant_fuel_type` - most common fuel type
- `has_projects` - boolean

---

## Recommended Enhancements

### **Priority 1: ERCOT County Context** ⭐⭐⭐
**Why:** Most meaningful - shows how data center relates to energy infrastructure in the same area

**Implementation:**
1. Match data center coordinates to ERCOT county using point-in-polygon
2. Display county-level energy project statistics

**Data to Show:**
```
📊 Energy Context (Bexar County)
   • 82 energy projects
   • 13.2 GW total capacity
   • Dominant: Solar (42 projects, 3.1 GW)
   • Battery: 1 project, 255 MW
```

**Value:**
- Shows if data center is in energy-rich county
- Indicates potential for power purchase agreements
- Highlights counties with both data centers AND energy projects

---

### **Priority 2: Article Timeline & Recency** ⭐⭐⭐
**Why:** Shows story evolution and how recent/active the project is

**Implementation:**
- Use `published_at` from multiple mentions
- Calculate time since first/last article
- Show article count and date range

**Data to Show:**
```
📰 Coverage (3 articles)
   • First: Aug 2025
   • Latest: Dec 2025
   • Last update: 2d ago
```

**Value:**
- Indicates project activity level
- Shows if story is developing or stale
- Helps identify "hot" vs "cold" projects

---

### **Priority 3: Source Diversity & Quality** ⭐⭐
**Why:** Multiple sources = more credible; diverse publishers = broader coverage

**Implementation:**
- Count unique publishers from `mentions.publisher`
- Show publisher names (top 2-3)
- Identify if coverage is from major outlets

**Data to Show:**
```
📰 Sources (3 articles)
   • Bisnow, The Business Journals, FOX 4
   • All from Dec 2025
```

**Value:**
- Credibility indicator
- Shows if project has mainstream attention
- Helps identify "real" vs "rumor" projects

---

### **Priority 4: Status Evidence** ⭐⭐
**Why:** Shows WHY we think project is active/uncertain/dead

**Implementation:**
- Query `project_evidence` table for signals
- Show evidence type and strength

**Data to Show:**
```
✅ Status Signals
   • Construction start (high confidence)
   • Permit filed (medium confidence)
```

**Value:**
- Transparency in status determination
- Helps users understand confidence levels
- Shows what evidence supports the status

---

### **Priority 5: Geocode Confidence** ⭐
**Why:** Shows location accuracy (city vs county vs state)

**Implementation:**
- Already have `geocode_confidence` in props
- Display as badge or text

**Data to Show:**
```
📍 Location: Dallas, TX
   (County-level accuracy)
```

**Value:**
- Helps users understand location precision
- Important for ERCOT county matching

---

### **Priority 6: Related Projects** ⭐
**Why:** Shows if company has multiple projects nearby

**Implementation:**
- Query for other projects by same company
- Show count of nearby projects

**Data to Show:**
```
🏢 Company Projects
   • 3 other Vantage projects in Texas
   • 1 in same county
```

**Value:**
- Shows company investment patterns
- Identifies "campus" vs "single facility" projects

---

## Implementation Strategy

### Phase 1: ERCOT County Matching (Highest Value)
1. **Backend:** Create script to match data center coordinates to ERCOT counties
   - Use point-in-polygon with `ercot_counties_aggregated.geojson`
   - Add county name and ERCOT stats to GeoJSON export

2. **Frontend:** Display ERCOT context in popup
   - Add new section in details
   - Show project count, capacity, fuel breakdown

### Phase 2: Article Timeline
1. **Backend:** Enhance GeoJSON export
   - Add `first_article_date`, `last_article_date`
   - Add `article_count`, `publisher_list`

2. **Frontend:** Display timeline in popup
   - Show date range
   - Show recency (e.g., "2d ago")

### Phase 3: Status Evidence
1. **Backend:** Join `project_evidence` in export
   - Add `evidence_types` array
   - Add `signal_strengths`

2. **Frontend:** Display evidence badges
   - Show what signals support the status

---

## Data Availability Assessment

### ✅ **Available Now:**
- ERCOT county data (GeoJSON with aggregations)
- Article dates and publishers (mentions table)
- Source URLs and counts
- Status and confidence
- Geocode confidence

### ⚠️ **Needs Processing:**
- County matching (point-in-polygon) - needs script
- Article timeline aggregation - needs SQL query
- Evidence signals - needs join to `project_evidence`

### ❌ **Not Available:**
- Sentiment analysis (would need NLP)
- Content keywords (would need extraction)
- Related projects (would need spatial query)

---

## Recommended MVP Implementation

### **Step 1: Add ERCOT County Context** (Highest ROI)
- **Backend:** Modify `export_projects_geojson.py` to:
  1. Load ERCOT counties GeoJSON
  2. Match each data center to county using point-in-polygon
  3. Add county name and ERCOT stats to properties

- **Frontend:** Add to popup details:
  ```
  📊 Energy Context
     • [X] projects in [County]
     • [Y] GW total capacity
     • Dominant: [Fuel Type]
  ```

### **Step 2: Add Article Timeline** (Medium ROI)
- **Backend:** Enhance export to include:
  - `first_article_date`
  - `last_article_date`
  - `article_count`
  - `publishers` (top 3)

- **Frontend:** Add to popup:
  ```
  📰 Coverage ([N] articles)
     • First: [Date]
     • Latest: [Date] ([X]d ago)
     • Sources: [Publisher1], [Publisher2]...
  ```

---

## Example Enhanced Popup

```
┌─────────────────────────────────────┐
│ Vantage Texas                    [X]│
│ [Active]                            │
│ Vantage                             │
│ Shackelford County, TX              │
│ 1,200 MW • 1,200 acres              │
│                                      │
│ [Click to expand details]           │
│                                      │
│ ─────────────────────────────────── │
│                                      │
│ 📊 Energy Context (Shackelford)     │
│    • 15 energy projects             │
│    • 2.4 GW total capacity          │
│    • Dominant: Solar (8 projects)   │
│                                      │
│ 📰 Coverage (3 articles)            │
│    • First: Jul 2025                │
│    • Latest: Aug 2025 (4mo ago)     │
│    • Sources: BigCountry, REBusiness│
│                                      │
│ ✅ Status Signals                   │
│    • Groundbreaking (high)          │
│    • Permit filed (medium)          │
│                                      │
│ 📰 View Article →                   │
└─────────────────────────────────────┘
```

---

## Next Steps

1. **Create county matching script** - Match data centers to ERCOT counties
2. **Enhance GeoJSON export** - Add ERCOT stats and article timeline
3. **Update popup component** - Display new data sections
4. **Test with sample projects** - Verify data accuracy
5. **Iterate based on feedback** - Refine display and data

---

## Questions to Consider

1. **Should we show ALL ERCOT stats or just summary?**
   - Recommendation: Summary (project count, total capacity, dominant fuel)

2. **How to handle counties with no ERCOT projects?**
   - Recommendation: Show "No energy projects in county" or hide section

3. **Should we show fuel breakdown or just dominant?**
   - Recommendation: Dominant fuel + total capacity (keep it simple)

4. **How to handle multiple counties (if location is ambiguous)?**
   - Recommendation: Show "Multiple counties possible" or use geocode confidence

5. **Should article timeline be always visible or in details?**
   - Recommendation: In details (keep main popup clean)

