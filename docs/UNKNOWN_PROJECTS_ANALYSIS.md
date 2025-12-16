# Unknown Projects Analysis

## Summary

**Total Unknown Projects: 19** (out of 144 total projects, 13.2%)

These are projects where our extraction logic couldn't determine a specific project name, so they defaulted to "Unknown Project".

---

## What We Know vs. Don't Know

### ✅ What We HAVE (Data Quality)

| Data Point | Count | Percentage |
|------------|-------|------------|
| **Geocoded (lat/lng)** | 18/19 | 94.7% ✅ |
| **Source URLs** | 19/19 | 100% ✅ |
| **Announcement dates** | 16/19 | 84.2% ✅ |
| **Specific locations** | 15/19 | 78.9% ✅ |
| **Size information** | 10/19 | 52.6% ⚠️ |

### ❌ What We're MISSING

| Data Point | Count | Percentage |
|------------|-------|------------|
| **Company name** | 19/19 | 100% ❌ |
| **Project name** | 19/19 | 100% ❌ |
| **Vague locations** | 4/19 | 21.1% ⚠️ |

---

## Root Causes: Why Are They "Unknown"?

### 1. **No Company Mentioned in Article (100%)**

**Problem:** The articles don't explicitly name the company building the data center.

**Examples:**
- "$10bn data center project receives approval in Lacy Lakeview, Texas" - No company name
- "$430 million data center project filed for Whitney, Texas" - No company name
- "Data center on 431 acres in southeast Fort Worth moving forward" - No company name

**Why this matters:** Our extraction logic relies on company names to generate project names like "Company Location" or "Company Data Center". Without a company, we can't generate a meaningful name.

### 2. **Vague Location Text (21.1%)**

Some projects have location text like:
- "ew" (extraction error)
- "ey" (extraction error)
- "and Beyond" (from article title)
- "Texas" (too generic)

### 3. **Articles Are Generic/Contextual**

Many articles are:
- Market overviews ("Data Centers Could be a Bright Star in Texas Construction for 2026 and Beyond")
- Zoning/permitting news (mentions project but not company)
- Community opposition stories (focuses on impact, not details)

---

## What We DO Know About Unknown Projects

### Location Information (78.9% have specific locations)

**Top locations:**
- Fort Worth (multiple projects)
- Hays County
- Austin County
- Armstrong County
- Jarrell, TX
- Cedar Creek, TX
- Bosque County

### Size Information (52.6% have size data)

**Examples:**
- 285 MW, 271 acres (Austin County)
- 210 MW (Cedar Creek)
- 180 MW (Bosque County)
- 431 acres (Fort Worth)
- 155 acres (Dorrance Twp)

### Geocoding (94.7% are geocoded)

Most unknown projects **do have coordinates**, meaning:
- ✅ They appear on the map
- ✅ We know where they are
- ✅ We just don't know the company/project name

---

## Sample Unknown Projects

### 1. Lacy Lakeview Project ($10bn)
- **Location:** Lacy Lakeview, TX (geocoded: 31.6175, -97.1203)
- **Size:** Unknown
- **Date:** 2025-12-10
- **Article:** "$10bn data center project receives approval in Lacy Lakeview, Texas"
- **Why unknown:** No company mentioned in title/snippet

### 2. Whitney Project ($430M)
- **Location:** Whitney, TX (geocoded: 31.8474, -97.3893)
- **Size:** Unknown
- **Date:** 2025-12-09
- **Article:** "$430 million data center project filed for Whitney, Texas"
- **Why unknown:** No company mentioned

### 3. Austin County Project (285 MW)
- **Location:** Austin County, TX (geocoded: 29.8260, -96.1430)
- **Size:** 285 MW, 271 acres
- **Date:** 2025-10-29
- **Article:** "CleanSpark (NASDAQ: CLSK) plans Texas AI campus with 285 MW via 271-acre land deal"
- **Why unknown:** Company is "CleanSpark" but our extraction didn't catch it (might be in full article text)

### 4. Fort Worth Project (431 acres)
- **Location:** Fort Worth (geocoded: 32.6200, -97.2640)
- **Size:** 431 acres
- **Date:** 2025-09-30
- **Article:** "Data center on 431 acres in southeast Fort Worth moving forward"
- **Why unknown:** No company mentioned

---

## Why This Happens

### 1. **Extraction Logic Limitations**

Our current extraction (`extract_project_cards.py`) looks for:
- Quoted project names
- "Company + Location" patterns
- "Company + Identifier" patterns

**But it misses:**
- Articles that mention investment size but not company
- Zoning/permitting articles (focus on process, not company)
- Market overview articles (multiple projects, no specific company)

### 2. **Company Detection Gaps**

Our `company_dict` has ~30 companies, but:
- New/unknown companies aren't in the list
- Companies mentioned only in full article text (not snippet)
- Companies mentioned by ticker symbol (e.g., "CLSK" for CleanSpark)

### 3. **Article Type Issues**

Many "Unknown" projects come from:
- **Zoning articles:** "Data center approved in X location" (no company)
- **Investment articles:** "$X million data center in Y" (no company)
- **Opposition articles:** "Residents fight data center" (focus on conflict, not details)

---

## Potential Solutions

### Option 1: Improve Company Extraction
- Expand `company_dict` with more companies
- Add ticker symbol → company mapping (CLSK → CleanSpark)
- Use full article text (`raw_text`) for company detection (not just snippet)
- Add LLM-based company extraction for edge cases

### Option 2: Generate Better Fallback Names
- Use location + size: "285 MW Austin County Data Center"
- Use location + date: "Fort Worth Data Center (2025)"
- Use investment amount: "$10B Lacy Lakeview Project"

### Option 3: Manual Review Queue
- Flag "Unknown" projects with good location/size data
- Manually review articles to extract company names
- Use Perplexity to extract company from full article text

### Option 4: Enhanced Article Fetching
- Many unknown projects might have company in full article text
- Fetch full text for all "Unknown" projects
- Re-run extraction with full text

---

## Current State

**Good news:**
- ✅ 94.7% are geocoded (appear on map)
- ✅ 78.9% have specific locations
- ✅ 52.6% have size information
- ✅ 100% have source URLs (can investigate)

**Bad news:**
- ❌ 100% missing company name
- ❌ 100% missing project name
- ⚠️ 21.1% have vague locations

---

## Recommendation

**Priority: Medium**

These 19 projects represent real data centers (they have locations, sizes, dates), but we're missing the company/project name. 

**Quick wins:**
1. Re-run extraction on articles with `raw_text` (if available)
2. Expand company dictionary with ticker symbols
3. Generate better fallback names using location + size

**Longer-term:**
1. Use Perplexity to extract company from full article text for these 19
2. Manual review of high-value projects (large size, specific location)
3. Improve extraction patterns for investment/zoning articles

---

## Impact

- **Map visualization:** ✅ 18/19 appear on map (94.7%)
- **Analysis:** ⚠️ Can't group by company, can't track by project name
- **User experience:** ⚠️ Users see "Unknown Project" markers (confusing)

**Bottom line:** These are real projects, we just need better extraction to identify them.

