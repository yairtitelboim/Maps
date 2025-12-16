# Article Data Collection Report

**Date:** 2025-01-XX  
**Focus:** What we actually collect from articles and what we need to extract

---

## What We Store From Articles

### **Mentions Table** (Raw Article Data)
- ✅ `title` - Article headline
- ✅ `snippet` - Article excerpt (from search results)
- ✅ `raw_text` - Full article content (if fetched - **17.8% coverage**)
- ✅ `published_at` - When article was published
- ✅ `publisher` - News source
- ✅ `url` / `canonical_url` - Article link

**Storage Location:** `data/news/news_pipeline.db` → `mentions` table

---

## What We Currently Extract

### **Project Cards Table** (Extracted Structured Data)
- ✅ `size_mw` - **31.7% coverage** (32 out of 101 projects)
- ✅ `size_sqft` - **2.0% coverage** (2 out of 101 projects)
- ⚠️ `announced_date` - **100% coverage** BUT this is just the article publish date, NOT expected completion date
- ✅ `company` - Company name
- ✅ `location_text` - Location (city/county)
- ✅ `site_hint` - Site details (substation, road, etc.)

**Extraction Source:** 
- `title` + `snippet` (always available)
- `raw_text` (only 17.8% of articles have this)

**Storage Location:** `data/news/news_pipeline.db` → `project_cards` table

---

## What We NEED But Don't Extract

### ❌ **1. Expected Completion/Operational Date**
**What we need:** When is the project expected to be operational/complete?

**Current status:** We only extract `announced_date` which is the article publish date, not the project timeline.

**What to extract from articles:**
- "Expected to open in 2026"
- "Scheduled for completion in Q2 2027"
- "Will be operational by 2025"
- "Breaking ground in 2025, operational 2026"
- "Phase 1: 2025, Phase 2: 2026"

**Where it might be:**
- In `title`: "Google to open data center in 2026"
- In `snippet`: "expected to be operational by late 2025"
- In `raw_text`: More detailed timeline information

---

### ❌ **2. Probability/Likelihood of Progress This Year**
**What we need:** How likely is this project to make progress this year?

**Current status:** We have `status_current` (active/uncertain/dead) but no probability score.

**What to extract from articles:**
- **High probability signals:**
  - "Breaking ground" / "Groundbreaking"
  - "Construction started" / "Construction begins"
  - "Permit approved" / "Zoning approved"
  - "Breaking ground in [current year]"
  - "Construction to begin [current year]"
  
- **Medium probability signals:**
  - "Plans to build" / "Announced plans"
  - "Proposed" / "Proposal"
  - "Expected to begin [current year]"
  
- **Low probability signals:**
  - "Exploring" / "Considering"
  - "In discussions"
  - "No timeline announced"
  - "Future plans"

**Where it might be:**
- In `title`: "Meta breaks ground on $1.5B data center"
- In `snippet`: "construction is set to begin in 2025"
- In `raw_text`: More detailed status information

---

### ⚠️ **3. Size Extraction (Needs Improvement)**
**Current status:**
- MW: 31.7% coverage (needs improvement)
- Sqft: 2.0% coverage (very low)
- Acres: Not extracted at all

**What to improve:**
- Extract acres: "1,200 acres", "500-acre campus"
- Better MW extraction from `raw_text` (when available)
- Better sqft extraction patterns

---

## Data Availability by Source

### **Title + Snippet** (100% available)
- ✅ Company name
- ✅ Location
- ⚠️ Size (MW) - partial
- ❌ Expected date - rarely in snippet
- ⚠️ Probability signals - sometimes in title

### **Raw Text** (17.8% available)
- ✅ Full article content
- ✅ More detailed size information
- ✅ Expected dates and timelines
- ✅ Construction status details
- ✅ Probability signals

**Problem:** Only 18 out of 101 articles have `raw_text` fetched.

---

## Extraction Patterns We Currently Use

### **Size (MW):**
```python
Patterns:
- "(\d+(?:\.\d+)?)\s*MW"
- "(\d+(?:\.\d+)?)\s*megawatts?"
- "\$(\d+(?:\.\d+)?)\s*billion"  # Estimates MW from cost
```

### **Size (Sqft):**
```python
Patterns:
- "(\d+(?:,\d{3})*)\s*sq\.?\s*ft\.?"
- "(\d+(?:,\d{3})*)\s*square\s+feet"
```

### **What We DON'T Extract:**
- ❌ Acres: "1,200 acres", "500-acre campus"
- ❌ Expected dates: "2026", "Q2 2027", "late 2025"
- ❌ Timeline phrases: "breaking ground", "construction begins", "operational by"

---

## Recommended Extraction Patterns to Add

### **1. Expected Completion Date:**
```python
Patterns to add:
- "expected to (?:open|complete|operational|launch) (?:in|by|during) (\d{4})"
- "scheduled for (?:completion|opening) (?:in|by) (\d{4})"
- "will be operational (?:in|by) (\d{4})"
- "breaking ground (?:in|by) (\d{4}), (?:operational|complete) (?:in|by) (\d{4})"
- "phase \d+: (\d{4})"
- "(\d{4}) (?:completion|opening|operational)"
```

### **2. Probability Signals:**
```python
High probability:
- "breaking ground" / "groundbreaking"
- "construction (?:started|begins|began)"
- "permit (?:approved|filed|granted)"
- "zoning (?:approved|filed)"

Medium probability:
- "plans to build" / "announced plans"
- "proposed" / "proposal"
- "expected to begin"

Low probability:
- "exploring" / "considering"
- "in discussions"
- "future plans"
```

### **3. Size (Acres):**
```python
Patterns to add:
- "(\d+(?:,\d{3})*)\s*acres?"
- "(\d+(?:,\d{3})*)-acre"
```

---

## Implementation Priority

### **Priority 1: Expected Completion Date** ⭐⭐⭐
- **Impact:** High - answers "how soon"
- **Effort:** Medium - need regex patterns
- **Data Source:** Title + Snippet (100%), Raw Text (17.8%)

### **Priority 2: Probability Signals** ⭐⭐⭐
- **Impact:** High - answers "how probable"
- **Effort:** Medium - need signal detection
- **Data Source:** Title + Snippet (100%), Raw Text (17.8%)

### **Priority 3: Improve Size Extraction** ⭐⭐
- **Impact:** Medium - improves "how large"
- **Effort:** Low - add acre patterns, improve MW/sqft
- **Data Source:** Title + Snippet (100%), Raw Text (17.8%)

---

## Current Data Flow

```
Article (SerpAPI)
    ↓
mentions table
    ├─ title (stored)
    ├─ snippet (stored)
    ├─ raw_text (fetched later, 17.8% coverage)
    └─ published_at (stored)
        ↓
extract_project_cards.py
    ├─ Extracts: size_mw, size_sqft, company, location
    ├─ Uses: title + snippet (always)
    └─ Uses: raw_text (when available)
        ↓
project_cards table
    └─ Exported to GeoJSON
        ↓
Frontend Popup
    └─ Displays: size_mw, size_sqft, announced_date
```

---

## What's Missing in the Flow

```
extract_project_cards.py
    ❌ Does NOT extract: expected_completion_date
    ❌ Does NOT extract: probability_score
    ❌ Does NOT extract: acres
        ↓
project_cards table
    ❌ Missing: expected_completion_date column
    ❌ Missing: probability_score column
    ❌ Missing: acres column
        ↓
Frontend Popup
    ❌ Cannot display: "Expected: 2026"
    ❌ Cannot display: "High probability of progress"
```

---

## Next Steps

1. **Add extraction patterns** for expected completion dates
2. **Add probability signal detection** based on article content
3. **Add acres extraction** pattern
4. **Update schema** to add new columns
5. **Re-run extraction** on existing articles
6. **Update frontend** to display new data

