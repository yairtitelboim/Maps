# Geocoding Improvement Plan

## Problem Statement

The current geocoding pipeline misses specific addresses and city names in articles, resulting in:
- Vague locations like "Texas" being geocoded to wrong cities (Houston instead of Midlothian)
- Low-confidence geocodes not being re-processed
- Enhanced extraction only running on duplicates, missing many incorrect geocodes

## Root Causes Identified

1. **Narrow Scope of Enhanced Extraction**
   - `extract_locations_from_articles.py` only processes projects with overlapping coordinates
   - Projects with wrong but unique coordinates are never re-processed
   - Low-confidence geocodes are ignored

2. **Initial Extraction Limitations**
   - Uses only title/snippet, not full article text
   - Falls back to vague locations when specific info isn't in snippet
   - No mechanism to re-extract after full text is available

3. **Missing Triggers**
   - No flag to identify projects needing re-extraction
   - No confidence-based filtering for re-processing
   - No validation of geocoded coordinates against mentioned cities

## Proposed Solution

### Phase 1: Expand Enhanced Extraction Scope (High Priority)

**File:** `scripts/news-output/extract_locations_from_articles.py`

**Changes:**
1. Expand query to include low-confidence geocodes:
   ```python
   # Current: Only overlapping coordinates
   # New: Also include:
   #   - geocode_confidence IN ('area', 'county')
   #   - location_text IN ('Texas', 'Dallas-area', etc.)
   #   - Projects where coordinates don't match mentioned cities
   ```

2. Add confidence-based filtering:
   - Process all projects with `geocode_confidence = 'area'`
   - Process projects with vague location_text
   - Process projects where coordinates are >50km from mentioned cities

3. Add city validation:
   - Extract city names from article text
   - Check if geocoded coordinates are within that city
   - Flag for re-extraction if mismatch

**Expected Impact:**
- Fix ~100+ projects with low-confidence geocodes
- Catch cases like "Texas" → Houston when article says "Midlothian"

### Phase 2: Improve Initial Extraction (Medium Priority)

**File:** `scripts/news-output/extract_from_sources.py` or initial extraction script

**Changes:**
1. Wait for full article text when available:
   - Check if full article text exists before finalizing location
   - If not available, mark for re-extraction later

2. Improve address pattern matching:
   - Add "Parkway" to address patterns (already done, verify)
   - Add patterns for "at [address] in [city]" format
   - Prioritize addresses over city names

3. Better fallback handling:
   - If only "Texas" found, try to extract city from context
   - Use "Dallas-area" → "Dallas" not "Texas"
   - Don't geocode vague locations immediately

**Expected Impact:**
- Reduce initial geocoding errors by 30-40%
- Fewer projects needing re-extraction

### Phase 3: Add Re-extraction Trigger System (Medium Priority)

**New File:** `scripts/news-output/flag_for_reextraction.py`

**Purpose:**
Identify projects that need re-extraction based on:
- Low confidence geocodes
- Vague location text
- Coordinate/city mismatches
- Projects with full article text available but not processed

**Implementation:**
```python
def flag_projects_for_reextraction():
    # 1. Low confidence
    # 2. Vague locations
    # 3. City mismatches
    # 4. Full text available but not used
    # Mark with flag or add to processing queue
```

**Expected Impact:**
- Systematic identification of problematic geocodes
- Can be run periodically to catch new issues

### Phase 4: Add Validation Layer (Low Priority)

**New File:** `scripts/news-output/validate_geocodes.py`

**Purpose:**
Validate geocoded coordinates against article content:
- Extract all city/county names from article
- Check if coordinates are within mentioned area
- Flag mismatches for manual review or re-extraction

**Implementation:**
```python
def validate_geocode(project_id, lat, lng, article_text):
    # Extract cities/counties from text
    # Check if coordinates are within reasonable distance
    # Return validation score
```

**Expected Impact:**
- Catch systematic errors
- Quality assurance for geocoding

## Implementation Priority

1. **Phase 1** (Immediate): Expand enhanced extraction scope
   - Highest impact, fixes existing problems
   - Can be implemented quickly
   - Will fix the Google Texas / Midlothian case

2. **Phase 2** (Short-term): Improve initial extraction
   - Prevents future errors
   - Reduces need for re-extraction

3. **Phase 3** (Medium-term): Re-extraction triggers
   - Systematic approach
   - Enables ongoing quality improvement

4. **Phase 4** (Long-term): Validation layer
   - Quality assurance
   - Catches edge cases

## Success Metrics

- **Accuracy**: % of geocodes with confidence >= 'city'
- **Specificity**: % of projects with specific city/address (not "Texas")
- **Validation**: % of geocodes matching mentioned cities in articles
- **Re-extraction**: % of low-confidence geocodes successfully improved

## Testing Plan

1. Test on known problematic cases:
   - Google Texas / Midlothian case
   - Other "Texas" → wrong city cases
   - Projects with addresses in articles

2. Validate improvements:
   - Before/after comparison
   - Manual spot checks
   - Coordinate validation

3. Monitor for regressions:
   - Ensure existing good geocodes aren't broken
   - Check processing time doesn't increase significantly

## Rollout Plan

1. **Week 1**: Implement Phase 1, test on sample
2. **Week 2**: Run Phase 1 on full dataset, measure improvements
3. **Week 3**: Implement Phase 2, test
4. **Week 4**: Deploy Phase 2, implement Phase 3
5. **Ongoing**: Phase 4 validation layer

