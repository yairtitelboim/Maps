# High-Value Projects Triage Plan

**Date:** 2025-12-12  
**Focus:** Geocode high-value projects from major companies

---

## 🎯 Priority Tiers

### Tier 1: CRITICAL (Major Companies, Known Locations)
**Target:** 8 projects  
**Expected Success:** 90-100%

### Tier 2: HIGH (Major Companies, Need Extraction)
**Target:** 5 projects  
**Expected Success:** 60-80%

### Tier 3: MEDIUM (Other Companies, Good Signals)
**Target:** 10 projects  
**Expected Success:** 40-60%

---

## 🔴 Tier 1: CRITICAL (Do First)

### 1. Meta El Paso
- **Project ID:** `proj_2527bab15f1b`
- **Company:** Meta
- **Location Text:** "the AI future"
- **Source:** "meta-launches-ai-data-center-project-el-paso-texas"
- **Action:** Extract "El Paso" from URL/title
- **Expected:** El Paso, TX (31.7619, -106.4850)
- **Confidence:** 95%

### 2. Vantage Frontier (Shackelford County)
- **Project ID:** `proj_5d353b34c2ec`
- **Company:** Vantage
- **Location Text:** "Texas Located on"
- **Source:** "vantage-data-centers-unveils-plans-for-frontier-a-us25b-mega-campus-in-texas"
- **Action:** Extract "Shackelford County" from article
- **Expected:** Shackelford County, TX (32.7089, -99.3308)
- **Confidence:** 95%

### 3. Vantage Frontier (Duplicate/Related)
- **Project ID:** `proj_4867abff1592`
- **Company:** Vantage
- **Location Text:** Empty
- **Source:** "inside-vantages-us-25bn-ai-data-centre-mega-campus-in-texas"
- **Action:** Extract "Shackelford County" from article
- **Expected:** Shackelford County, TX (32.7089, -99.3308)
- **Confidence:** 95%

### 4. Google Texas AI Campuses
- **Project ID:** `proj_bb58dfa6c724`
- **Company:** Google
- **Location Text:** "Texas AI Data Centers The announcement includes three new data center campuses"
- **Source:** "google-announces-40-billion-in-texas-ai-data-centers"
- **Action:** Extract specific cities from article (likely Dallas, Austin, San Antonio)
- **Expected:** Multiple locations or primary location
- **Confidence:** 80%

### 5. Microsoft (Substation Hint)
- **Project ID:** `proj_7c19a2e07bf0`
- **Company:** Microsoft
- **Location Text:** Empty
- **Site Hint:** "substation forms"
- **Source:** "anthropic-microsoft-announce-new-ai-data-center-projects"
- **Action:** Extract location from article text
- **Expected:** TBD (likely Central Texas)
- **Confidence:** 70%

### 6. Google (Permit Hearing)
- **Project ID:** `proj_82db00db8d71`
- **Company:** Google
- **Location Text:** Empty
- **Source:** "local-residents-pack-idem-hearing-to-challenge-google-data-center-permit"
- **Action:** Extract location from article (IDEM = Indiana, but check if Texas)
- **Expected:** TBD
- **Confidence:** 60%

### 7. Oracle Texas Hyperscale
- **Project ID:** `proj_14d55b09a2ea`
- **Company:** Oracle
- **Location Text:** "Texas"
- **Source:** "texas-hyperscale-data-center-site-opens-1000-mw-power"
- **Action:** Extract specific location from article
- **Expected:** TBD
- **Confidence:** 70%

### 8. CyrusOne Calpine Power
- **Project ID:** `proj_4573106dc8ed`
- **Company:** CyrusOne
- **Location Text:** "Texas Calpine agrees to power CyrusOne data centre in Texas"
- **Source:** "calpine-agreement-power-cyrusone-texas"
- **Action:** Extract location from article (likely Bosque County or Central Texas)
- **Expected:** TBD
- **Confidence:** 75%

---

## 🟡 Tier 2: HIGH (Major Companies, Need Better Extraction)

### 9. Amazon
- **Project ID:** `proj_f0ac7379c402`
- **Company:** Amazon
- **Location Text:** Empty
- **Source:** "data-center-locations-us-map-ai-boom"
- **Action:** Check if article lists Texas locations
- **Confidence:** 50%

### 10. Google (Terawulf Partnership)
- **Project ID:** `proj_387262542303`
- **Company:** Google
- **Location Text:** "contracted revenue Google backstops"
- **Source:** "terawulf-expands-strategic-partnership-with-fluidstack"
- **Action:** Extract location from article
- **Confidence:** 40%

### 11. Oracle Stargate (New Mexico - Verify)
- **Project ID:** `proj_fb0d90ca16d9`
- **Company:** Oracle
- **Location Text:** "mammoth Stargate venture Open AI"
- **Source:** "open-ai-oracle-softbank-put-santa-teresa-new-mexico"
- **Action:** Verify if Texas or New Mexico (likely New Mexico)
- **Confidence:** 30% (may be non-Texas)

---

## 🟢 Tier 3: MEDIUM (Other Projects)

### 12-23. Remaining Projects
- Various companies and unknown companies
- Need article text extraction
- Lower priority

---

## 🎯 Immediate Action Plan

### Step 1: Quick Wins (Tier 1, Items 1-4)
**Time:** 15 minutes  
**Expected:** +4 projects geocoded

1. **Meta El Paso** - Extract from URL → El Paso, TX
2. **Vantage Frontier (2 projects)** - Extract "Shackelford County" → Geocode
3. **Google Texas AI** - Extract cities from article → Geocode primary location

### Step 2: Article Extraction (Tier 1, Items 5-8)
**Time:** 30 minutes  
**Expected:** +3-4 projects geocoded

4. **Microsoft** - Read article, extract location
5. **Google Permit** - Read article, extract location
6. **Oracle** - Read article, extract location
7. **CyrusOne** - Read article, extract location

### Step 3: Manual Review (Tier 2)
**Time:** 30 minutes  
**Expected:** +2-3 projects geocoded

8. **Amazon** - Check article for Texas locations
9. **Google Terawulf** - Extract location
10. **Oracle Stargate** - Verify location

---

## 🔧 Implementation Script

Create a focused script that:
1. Targets Tier 1 projects specifically
2. Uses known location patterns
3. Extracts from URLs/titles when possible
4. Falls back to article text extraction

---

## 📊 Expected Outcomes

### Optimistic:
- **Tier 1:** 8/8 geocoded (100%)
- **Tier 2:** 3/3 geocoded (100%)
- **Total:** +11 projects
- **Final:** 89 geocoded (88% coverage)

### Realistic:
- **Tier 1:** 6-7/8 geocoded (75-88%)
- **Tier 2:** 1-2/3 geocoded (33-67%)
- **Total:** +7-9 projects
- **Final:** 85-87 geocoded (84-86% coverage)

### Conservative:
- **Tier 1:** 5-6/8 geocoded (63-75%)
- **Tier 2:** 1/3 geocoded (33%)
- **Total:** +6-7 projects
- **Final:** 84-85 geocoded (83-84% coverage)

---

## ✅ Success Criteria

- **Minimum:** +5 high-value projects geocoded
- **Target:** +8 high-value projects geocoded
- **Stretch:** +11 high-value projects geocoded

---

**Priority:** Focus on Tier 1 projects first for maximum impact.

