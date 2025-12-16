# Geocoding Plan for Remaining 30 Projects

**Date:** 2025-12-12  
**Current Status:** 71 geocoded / 101 total (30 remaining)

---

## 📊 Analysis of Remaining 30 Projects

### Categories Breakdown

| Category | Count | Strategy |
|----------|-------|----------|
| **Non-Texas Projects** | 4 | Filter out / Mark as non-Texas |
| **Empty location_text** | 11 | Extract from source articles |
| **Vague text** | 5 | Extract from source articles |
| **Has site_hint** | 3 | Use site_hint + context |
| **Generic Texas** | 2 | Extract from source articles |
| **City name only** | 2 | Add state context |
| **Other** | 3 | Case-by-case |

---

## 🎯 Detailed Plan

### Phase 1: Filter Non-Texas Projects (4 projects)

**Projects to filter:**
1. `proj_01f2c334bb2d` - Yukon, Oklahoma
2. `proj_d73770e67ce4` - Iowa (Google)
3. `proj_a3efd1b7ff5b` - Charlotte, North Carolina (Digital Realty)
4. `proj_21d99cfe7f97` - Central Ohio (Cologix)

**Action:** Mark these as `geocode_confidence = 'non_texas'` or exclude from Texas dataset.

---

### Phase 2: Extract from Source Articles (18 projects)

**Projects with empty or vague location_text that need article extraction:**

#### High Priority (Have source URLs/articles):
1. `proj_96ac0eafe063` - "Texas The deal secures power" → Check Calpine article
2. `proj_bb58dfa6c724` - Google: "Texas AI Data Centers" → Check article for specific cities
3. `proj_5d353b34c2ec` - Vantage: "Texas Located on" → Check Frontier article (should be Shackelford County)
4. `proj_4867abff1592` - Vantage: Empty → Check article
5. `proj_7c19a2e07bf0` - Microsoft: Empty → Check article
6. `proj_82db00db8d71` - Google: Empty → Check article
7. `proj_f0ac7379c402` - Amazon: Empty → Check article
8. `proj_2527bab15f1b` - Meta: "the AI future" → Check El Paso article
9. `proj_14d55b09a2ea` - Oracle: "Texas" → Check article
10. `proj_4573106dc8ed` - CyrusOne: "Texas Calpine" → Check article

#### Medium Priority:
11. `proj_543fe0cf4720` - Empty → Check video/article
12. `proj_7c91fbc5eefa` - Empty → Check Virginia article (may be non-Texas)
13. `proj_f371632cd4fe` - "unprecedented" → Check article
14. `proj_2d5e0ba10dda` - "its Aug" → Check San Marcos article
15. `proj_c12cc89dd0c4` - "the city" → Check article
16. `proj_95b4fe59418b` - Empty → Check generic article
17. `proj_fb96122ba2af` - Empty → Check Taylor Press article
18. `proj_cf274828cf57` - Empty → Check "West Texas Panhandle" article

**Strategy:**
- Use `extract_from_sources.py` but enhance it to:
  1. Read `raw_text` field if available (full article text)
  2. Extract from URLs/titles when location_text is empty
  3. Better pattern matching for Texas locations
  4. Handle "West Texas Panhandle", "San Marcos", "Shackelford County" patterns

---

### Phase 3: Use Site Hints (3 projects)

**Projects with site_hint:**
1. `proj_7c19a2e07bf0` - Microsoft: site_hint = "substation forms" → Need location from article
2. `proj_173ff0d94437` - QTS: site_hint = "southwest Cedar" → Already tried, need better extraction
3. `proj_c12cc89dd0c4` - Unknown: site_hint = "southeast side" → Need city context

**Strategy:**
- Combine site_hint with location_text or article extraction
- Use site_hint as additional context for geocoding

---

### Phase 4: Handle Ambiguous City Names (2 projects)

**Projects:**
1. `proj_a60eedde0cfd` - "Taylor" → Could be Taylor, TX (Williamson County) or other states
2. `proj_2939ca7d3063` - "Jarrell" → Jarrell, TX (Williamson County)

**Strategy:**
- Add ", Texas" context when geocoding
- Check article for state confirmation
- Use company context (e.g., Microsoft = likely Taylor, TX)

---

### Phase 5: Specific Location Patterns (3 projects)

**Projects needing specific extraction:**
1. `proj_cf274828cf57` - "West Texas Panhandle" → Extract county/city
2. `proj_7ac3069f6d8e` - "West Texas" → Extract specific location
3. `proj_557567dbbc16` - "West Texas" → Extract specific location

**Strategy:**
- Pattern: "West Texas Panhandle" → Look for county names (Amarillo area)
- Pattern: "West Texas" → Look for city/county in article

---

## 🔧 Implementation Steps

### Step 1: Create Enhanced Extraction Script

**File:** `scripts/news-output/enhanced_location_extraction.py`

**Features:**
1. **Read raw_text** from mentions table (full article text)
2. **Better pattern matching:**
   - "West Texas Panhandle" → Extract county/city
   - "Shackelford County" → Direct geocode
   - "San Marcos" → Geocode with Texas context
   - "Taylor" → Check article for state, default to Texas
3. **Use site_hint** as additional context
4. **Filter non-Texas** projects automatically
5. **Handle empty location_text** by extracting from titles/URLs

### Step 2: Enhanced Pattern Matching

**New patterns to add:**
```python
patterns = [
    r"West Texas Panhandle",
    r"Shackelford County",
    r"San Marcos",
    r"Taylor,?\s+Texas",
    r"Jarrell,?\s+Texas",
    r"(\d+)\s+acres?\s+(?:in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
    r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County,?\s+Texas",
    r"data center (?:in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s+Texas",
]
```

### Step 3: Geocode with Context

**For ambiguous names:**
- "Taylor" → Try "Taylor, Texas" first
- "Jarrell" → Try "Jarrell, Texas" first
- "Cedar Rapids" → Check if Texas (there's a Cedar Rapids, TX)

### Step 4: Manual Review Queue

**Create manual review list:**
- Projects with no location found after all attempts
- Projects with low confidence geocoding
- Projects needing human verification

---

## 📋 Specific Project Actions

### High Confidence (Can extract from articles):

1. **Vantage Frontier** (`proj_5d353b34c2ec`)
   - Article mentions "Shackelford County"
   - Should geocode to: 32.7089, -99.3308

2. **Meta El Paso** (`proj_2527bab15f1b`)
   - Article title mentions "El Paso, Texas"
   - Should geocode to: 31.7619, -106.4850

3. **Google Texas AI** (`proj_bb58dfa6c724`)
   - Article mentions "three new data center campuses"
   - Need to extract specific cities from article

4. **West Texas Panhandle** (`proj_cf274828cf57`, `proj_7ac3069f6d8e`, `proj_557567dbbc16`)
   - Article mentions "West Texas Panhandle"
   - Need to extract county/city (likely Amarillo area)

5. **San Marcos** (`proj_2d5e0ba10dda`)
   - Article mentions "San Marcos City Council"
   - Should geocode to: 29.8833, -97.9414

6. **Taylor** (`proj_a60eedde0cfd`, `proj_fb96122ba2af`)
   - Article mentions "Taylor Press" or "Taylor"
   - Should geocode to: 30.5708, -97.4095 (Taylor, TX)

### Medium Confidence (Need article text):

7. **Microsoft** (`proj_7c19a2e07bf0`)
   - Site hint: "substation forms"
   - Need to check article for location

8. **Google** (`proj_82db00db8d71`)
   - Need to check article for location

9. **Amazon** (`proj_f0ac7379c402`)
   - Need to check article for location

### Low Confidence (May need manual review):

10. **Empty location projects** (11 projects)
    - Need full article text extraction
    - May require manual review

---

## 🎯 Expected Outcomes

### Optimistic:
- **Filter out:** 4 non-Texas projects
- **Geocode:** 20-22 projects (from articles/hints)
- **Remaining:** 4-6 projects needing manual review

### Realistic:
- **Filter out:** 4 non-Texas projects
- **Geocode:** 15-18 projects
- **Remaining:** 8-11 projects needing manual review

### Conservative:
- **Filter out:** 4 non-Texas projects
- **Geocode:** 10-12 projects
- **Remaining:** 14-16 projects needing manual review

---

## ✅ Success Criteria

- **Filter non-Texas projects:** 4 projects
- **Geocode from articles:** ≥15 projects
- **Final geocoded count:** ≥85 projects (84% coverage)
- **Manual review queue:** ≤10 projects

---

## 📝 Next Steps

1. **Create enhanced extraction script** with raw_text support
2. **Run extraction** on all 30 projects
3. **Filter non-Texas** projects
4. **Geocode** extracted locations
5. **Create manual review** list for remaining projects
6. **Update GeoJSON** with new coordinates

---

**Priority:** HIGH - These 30 projects represent 30% of total projects and should be geocoded for complete coverage.

