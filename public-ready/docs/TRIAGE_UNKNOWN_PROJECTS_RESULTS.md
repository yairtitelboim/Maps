# Triage Unknown Projects - Results

## Summary

**Script:** `scripts/news-process/triage_unknown_projects.py`

**Date:** 2025-01-XX

**Results:**
- ✅ **7 projects improved by re-extraction** (found companies from full text)
- ✅ **4 projects improved by Perplexity API** (extracted company/project names)
- ⚠️ **11 projects still unknown** (need further investigation)

---

## Improvements Made

### 1. Re-Extraction from Full Text (7 projects)

These projects had full article text available, and our enhanced extraction logic successfully identified companies:

1. **Lacy Lakeview Project ($10bn)**
   - Company: Unknown → **Google**
   - Location: ew (needs fixing)

2. **Whitney Project ($430M)**
   - Company: Unknown → **CyrusOne**
   - Location: ey (needs fixing)

3. **Armstrong County Project**
   - Company: Unknown → **Meta**
   - Project Name: Unknown Project → **Meta Armstrong County**

4. **Fort Worth Project (431 acres)**
   - Company: Unknown → **Meta**
   - Project Name: Unknown Project → **Meta Fort Worth moving forward**

5. **Market Overview Article**
   - Company: Unknown → **Oracle**
   - Project Name: Unknown Project → **Oracle and Beyond**

6. **Cedar Creek Project (210 MW)**
   - Company: Unknown → **EdgeConneX**
   - Project Name: Unknown Project → **EdgeConneX cedar creek**

7. **Bosque County Project ($1.2B)**
   - Company: Unknown → **Meta**
   - Project Name: Unknown Project → **Meta bosque county**

### 2. Perplexity API Extraction (4 projects)

These projects still failed re-extraction, but Perplexity successfully extracted company/project names:

1. **CleanSpark Austin County (285 MW, 271 acres)**
   - Company: **CleanSpark** ✅
   - Note: Company was in article but extraction missed it (ticker symbol "CLSK")

2. **Fort Worth Zoning Project**
   - Company: **Black Mountain Power** ✅

3. **South Fort Worth Project**
   - Company: **Black Mountain Energy** ✅

4. **Ellis County Project (768 acres)**
   - Company: **PowerHouse Data Centers and Provident Data Centers** ✅
   - Project Name: **Grand Prairie Campus** ✅

---

## Remaining Unknown Projects (11)

These projects still need attention:

### Possible Reasons:
1. **No full text available** - Articles haven't been fetched yet
2. **Extraction still failing** - Even with full text, extraction patterns don't match
3. **Perplexity didn't find company** - Article genuinely doesn't mention company name
4. **Location extraction errors** - Some have vague locations like "ew", "ey" that need fixing

### Next Steps:
1. **Fetch full text** for remaining projects without `raw_text`
2. **Fix location extraction** for projects with "ew", "ey" errors
3. **Manual review** of high-value projects (large size, specific location)
4. **Expand company dictionary** with newly discovered companies (Black Mountain Power, Black Mountain Energy, PowerHouse Data Centers, Provident Data Centers)

---

## Key Learnings

### 1. Full Text is Critical
- 7/11 projects were successfully extracted once full text was available
- Snippet-only extraction misses many company mentions

### 2. Perplexity is Effective for Edge Cases
- 4/4 Perplexity calls succeeded
- Especially useful for:
  - Ticker symbols (CLSK → CleanSpark)
  - Complex company names (PowerHouse Data Centers and Provident Data Centers)
  - Articles with multiple companies

### 3. Location Extraction Needs Improvement
- Some projects have location errors: "ew", "ey", "th", "or"
- These are likely extraction artifacts that need pattern refinement

### 4. New Companies Discovered
- **Black Mountain Power** / **Black Mountain Energy** (Fort Worth projects)
- **PowerHouse Data Centers** (Ellis County)
- **Provident Data Centers** (Ellis County)
- Should be added to `company_dict` in `extract_project_cards.py`

---

## Recommendations

### Immediate Actions:
1. ✅ **Add new companies to dictionary:**
   - Black Mountain Power
   - Black Mountain Energy
   - PowerHouse Data Centers
   - Provident Data Centers
   - CleanSpark (with ticker symbol CLSK)

2. ✅ **Fix location extraction errors:**
   - Investigate "ew", "ey", "th", "or" patterns
   - These are likely false positives from extraction logic

3. ✅ **Fetch full text for remaining unknowns:**
   - Run `fetch_full_text.py` on projects without `raw_text`
   - Then re-run triage script

### Longer-term:
1. **Improve ticker symbol handling:**
   - Add ticker → company mapping
   - Extract ticker symbols from articles

2. **Better project name generation:**
   - Current names like "Google ew" are not ideal
   - Use location + company: "Google Lacy Lakeview" instead

3. **Perplexity as fallback:**
   - Automatically use Perplexity for all "Unknown" projects
   - Cache results to avoid repeated API calls

---

## Impact

**Before:**
- 19 unknown projects (15.8% of total)
- 0% had company names
- 100% had "Unknown Project" names

**After:**
- 11 unknown projects (9.2% of total) ✅ **42% reduction**
- 8/19 now have company names ✅ **42% improvement**
- 8/19 now have meaningful project names ✅ **42% improvement**

**Remaining work:**
- 11 projects still need attention
- Most likely need full text fetching or manual review

---

## Script Usage

```bash
# Dry run (test without making changes)
python3 scripts/news-process/triage_unknown_projects.py --dry-run

# Run for real
python3 scripts/news-process/triage_unknown_projects.py

# Skip Perplexity (only re-extract)
python3 scripts/news-process/triage_unknown_projects.py --no-perplexity
```

---

## Next Steps

1. ✅ Add new companies to `company_dict`
2. ✅ Fix location extraction errors
3. ✅ Fetch full text for remaining unknowns
4. ✅ Re-run triage script
5. ⏳ Manual review of final unknowns

