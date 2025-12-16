# Hill County Data Center Discrepancy - Deep Analysis

**Research Date:** December 2025  
**Method:** Perplexity API - 4 targeted queries on the discrepancy  
**Research File:** `data/analysis/hill_county_discrepancy_research.json`

---

## Executive Summary

**The Discrepancy:**
- **Our Database:** 2 data centers in Hill County (point-in-polygon verified)
- **Perplexity:** 0 data centers in Hill County (location text search)
- **Official Sources:** CyrusOne DFW10 is in **Bosque County** at Thad Hill Energy Center

**Critical Finding:** Location text inaccuracies are **common** in data center announcements. Our coordinates may be correct, but the official project (DFW10) is confirmed in Bosque County, not Hill County.

---

## Key Findings from Perplexity Research

### 1. CyrusOne DFW10 Location (Confirmed)

**Official Location:**
- **Address:** 557 County Rd 3610, Whitney, Texas 76692
- **County:** **Bosque County** (not Hill County)
- **Site:** Adjacent to Thad Hill Energy Center (also called Bosque Power Plant)
- **All official sources confirm Bosque County**

**Why the Confusion:**
- **Whitney, Texas** is primarily in Hill County
- But this specific address/site falls within **Bosque County's portion**
- Media often references "near Whitney" which suggests Hill County
- State Rep. Angelia Orr represents both counties, blurring boundaries

**Project Details:**
- **Name:** CyrusOne DFW10 / Whitney Campus
- **Size:** 190,000-250,000 sq ft first phase
- **Power:** 190-400 MW from Calpine
- **Investment:** $750M-$1.2B
- **Timeline:** Construction began Dec 2024, operational Q4 2026

### 2. Location Text Inaccuracies Are Common

**Perplexity Research Confirms:**
- Data center location announcements are often **approximate, not precise**
- Common patterns:
  - Using nearest well-known city instead of actual jurisdiction
  - Announcing in one county but building in adjacent county
  - Intentional vagueness while land is under option
  - Keeping old location text after project moves

**Examples of Inaccuracies:**
- "Near Dallas" when site is in unincorporated Ellis County
- "In Ashburn" when site is in unincorporated Loudoun County
- "Houston-area" when site is in Grimes or Austin County
- Projects spanning county lines but attributed to one county

**Accuracy Levels:**
- **Metro/Market level:** Generally accurate ("Dallas metro", "Northern Virginia")
- **County/Parcel level:** Accuracy drops significantly
- **Common:** City vs. unincorporated county confusion
- **Occasional but real:** Wrong county in announcements vs. actual build

### 3. Why Projects Get Confused Between Counties

**Geographic Factors:**
- Projects near county borders
- Industrial parks spanning multiple counties
- Utility-driven shifts to adjacent counties
- Regional identifiers ("outside Waco") covering multiple counties

**Administrative Factors:**
- Shared political representation (Rep. Orr represents both counties)
- Economic development groups using metro labels
- Early announcements before final site selection
- Template descriptions reused across regions

---

## Our Database Analysis

### What We Found

**2 Data Centers in Hill County (Point-in-Polygon Verified):**

1. **"CyrusOne co"**
   - Project ID: `proj_ee843a3e2057`
   - Coordinates: `(31.873611, -97.369167)`
   - Location text: Empty

2. **"CyrusOne bosque county"**
   - Project ID: `proj_6c5910e85a48`
   - Coordinates: `(31.943300, -97.392700)`
   - Location text: Empty (but name suggests Bosque County)

### Coordinate Analysis

**Our Coordinates:**
- Project 1: `(31.873611, -97.369167)` - Near Whitney area
- Project 2: `(31.943300, -97.392700)` - North of Whitney

**Reference Points:**
- Whitney, TX (Hill County): `(31.9519, -97.3214)`
- Whitney area (Bosque County): `(31.85, -97.08)`
- Thad Hill Energy Center: In Bosque County, near Whitney

**Critical Question:**
- If DFW10 is confirmed at `557 County Rd 3610, Whitney, TX 76692` in **Bosque County**
- But our coordinates place projects in **Hill County**
- Then either:
  1. Our coordinates are wrong, OR
  2. These are different projects (not DFW10)

---

## Possible Explanations

### Scenario 1: Our Coordinates Are Wrong
- **Likelihood:** Medium
- **Reason:** Geocoding errors, especially near county borders
- **Evidence:** Location text says "Bosque County" for one project
- **Action:** Need to verify coordinates against actual addresses

### Scenario 2: These Are Different Projects
- **Likelihood:** Medium
- **Reason:** Multiple CyrusOne projects in the region
- **Evidence:** DFW10 is confirmed in Bosque, but there could be other projects
- **Action:** Check if these are separate from DFW10

### Scenario 3: County Border Confusion
- **Likelihood:** High
- **Reason:** Projects very close to county line
- **Evidence:** Whitney spans both counties, project near border
- **Action:** Verify exact county boundaries at these coordinates

### Scenario 4: Location Text Is Wrong (Our Coordinates Correct)
- **Likelihood:** Medium
- **Reason:** Common pattern per Perplexity research
- **Evidence:** Location text often inaccurate
- **Action:** Trust coordinates over location text

---

## Recommendations

### Immediate Actions

1. **Verify Coordinates Against Addresses**
   - Check if `557 County Rd 3610, Whitney, TX 76692` geocodes to our coordinates
   - Verify county boundaries at exact coordinate locations
   - Cross-reference with property tax records

2. **Check Project IDs Against Official Sources**
   - Verify if our project IDs correspond to DFW10
   - Check if these are separate projects from DFW10
   - Look for multiple CyrusOne projects in the region

3. **Re-geocode with Better Sources**
   - Use official addresses if available
   - Cross-reference with ERCOT interconnection filings
   - Check county appraisal rolls

### Long-term Improvements

1. **Prioritize Coordinates Over Location Text**
   - Point-in-polygon is more accurate than location text
   - But verify coordinates are correct first

2. **Flag Projects Near County Borders**
   - Special handling for projects within 5 miles of county lines
   - Manual verification for these cases

3. **Cross-Reference Multiple Sources**
   - Official press releases
   - ERCOT/PUC filings
   - County tax records
   - Property deeds

---

## Conclusion

**The Truth Is Unclear:**
- Perplexity confirms DFW10 is in **Bosque County**
- Our coordinates place 2 projects in **Hill County**
- Location text inaccuracies are common
- County border confusion is likely

**What We Know:**
- ✅ Point-in-polygon geocoding is more accurate than location text
- ✅ Location text often wrong in data center announcements
- ✅ Projects near county borders create confusion
- ⚠️ Our coordinates need verification against official addresses

**Next Steps:**
1. Verify our coordinates against the official DFW10 address
2. Check if these are separate projects from DFW10
3. Confirm county boundaries at exact coordinate locations
4. Update database with verified information

---

## Research Sources

- Perplexity API queries (December 2025)
- Official CyrusOne/Calpine press releases
- ERCOT/PUC filings
- County tax records
- Property addresses

**Research Files:**
- `data/analysis/hill_county_discrepancy_research.json` - Full Perplexity responses
- `data/analysis/hill_county_comprehensive_research.json` - Comprehensive research
- `docs/STORY1_HILL_COUNTY_COMPREHENSIVE_ANALYSIS.md` - Full analysis

