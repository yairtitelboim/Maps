# Enhanced Location Extraction Plan

**Goal:** Extract more precise locations (neighborhood/area level) from raw article text for projects that still have city-level coordinates.

---

## Current Status

- **82 total projects** with coordinates
- **28 projects** still overlapping (down from 35)
- **54 unique locations** (up from 47)

## Remaining Overlaps

1. **San Antonio (29.424600, -98.495141)**: 4 projects
   - Microsoft (3x), CyrusOne
   - Need: Specific area/neighborhood in San Antonio

2. **Shackelford County (32.708875, -99.330762)**: 4 projects
   - Vantage (3x), Oracle
   - Need: Specific town/area within county

3. **Fort Worth (32.753177, -97.332746)**: 4 projects
   - All Unknown companies
   - Need: Specific neighborhoods (southeast, Forest Hill area, etc.)

4. **Dallas (32.776272, -96.796856)**: 4 projects
   - Aligned, Switch, Unknown (2x)
   - Need: Specific areas (uptown, downtown, suburbs)

5. **El Paso (31.760116, -106.487040)**: 3 projects
   - Meta (2x), Oracle
   - Need: More specific areas (already have "Northeast El Paso" for one)

6. **Midlothian (32.482361, -96.994449)**: 3 projects
   - Google (3x) - likely same project
   - Should be merged via entity resolution

7. **Other smaller overlaps**: 2-3 projects each

---

## Strategy

### Phase 1: Entity Resolution (Current Task)
- Merge projects with same company + same coordinates
- Focus on obvious duplicates (e.g., 3 Google projects in Midlothian)
- **Script:** `merge_duplicate_projects.py`

### Phase 2: Enhanced Location Extraction from Raw Text

#### 2.1 Extract from Article Content
- Parse raw article text from `mentions` table
- Look for:
  - Street addresses or intersections
  - Neighborhood names
  - Landmarks or nearby features
  - Specific area descriptions ("northeast of", "near X", "in Y district")

#### 2.2 Pattern Matching
- **Address patterns:**
  - `\d+\s+[A-Z][a-z]+\s+(Street|Avenue|Road|Drive|Lane|Boulevard)`
  - `(at|on|near)\s+([A-Z][a-z]+\s+[A-Z][a-z]+\s+(Street|Avenue|Road|Drive))`
  
- **Neighborhood patterns:**
  - `(in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(neighborhood|district|area|region)`
  - `([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(suburb|community|town)`
  
- **Landmark patterns:**
  - `(near|close to|adjacent to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)`
  - `(on|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(Road|Street|Avenue)`

#### 2.3 Geocoding Strategy
- Try most specific location first (address > neighborhood > area > city)
- Use city context for disambiguation
- Validate coordinates are in Texas
- Only update if significantly different (>1km) from current

#### 2.4 Data Sources Priority
1. **Raw article text** (most detailed)
2. **Snippet** (summary, often has key info)
3. **Title** (sometimes has location)
4. **location_text** (already extracted, may be incomplete)
5. **site_hint** (additional context)

---

## Implementation Plan

### Script: `extract_locations_from_articles.py`

**Features:**
1. Query projects with overlapping coordinates
2. Fetch raw text from all mentions for each project
3. Apply pattern matching to extract precise locations
4. Try geocoding each candidate (with rate limiting)
5. Update database if more precise location found

**Patterns to Extract:**
- Street addresses
- Neighborhood names (from known lists)
- Area descriptions ("northeast", "southeast", etc.)
- Landmarks and intersections
- Specific town names within metro areas

**Geocoding:**
- Use Nominatim with Texas context
- Try multiple query formats:
  - `"{location}, {city}, Texas, USA"`
  - `"{location}, Texas, USA"`
  - `"{neighborhood}, {city}, Texas, USA"`
- Validate results are in Texas bounding box
- Check distance from current coordinates

**Output:**
- Log all attempts and results
- Update projects with improved coordinates
- Track confidence levels (address > neighborhood > area > city)

---

## Expected Outcomes

### After Entity Resolution:
- **~15-20 fewer projects** (merged duplicates)
- **~65-70 unique projects** remaining
- **~10-15 remaining overlaps** (legitimate separate projects at same location)

### After Enhanced Location Extraction:
- **~5-10 more projects** with precise locations
- **~70-75 unique locations** total
- **~5-10 remaining overlaps** (true co-located projects)

---

## Success Metrics

1. **Overlap reduction:** <10 projects overlapping
2. **Precision improvement:** >50% of projects have neighborhood-level or better coordinates
3. **Data quality:** Merged projects have combined mention_ids and source_urls
4. **Coverage:** All high-value projects (major companies) have precise locations

---

## Next Steps

1. ✅ Run `merge_duplicate_projects.py` (dry-run first)
2. ✅ Review merge results
3. ⏳ Implement `extract_locations_from_articles.py`
4. ⏳ Run enhanced extraction on remaining overlaps
5. ⏳ Manual review of any remaining high-value overlaps

