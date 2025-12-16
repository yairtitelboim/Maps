# Hill County Deep Dive - Findings

## Summary

**Hill County has 2 confirmed data center projects** (both CyrusOne), both with "uncertain" status.

## Key Findings

### 1. Articles/Mentions
- **Total mentions of "Hill":** 22 articles
- **Actual Hill County mentions:** ~2-3 (most are false positives)
- **False positives include:**
  - "Forest Hill" (Fort Worth area)
  - "New Hill" (Wake County, NC)
  - "Hillsboro" (Oregon)
  - Other places with "Hill" in name

### 2. Project Cards
- **Total project cards:** 1
- **Issue:** The 1 project card is misclassified (location says "fort worth", not Hill County)
- **Conclusion:** Project card extraction didn't properly identify Hill County projects

### 3. Confirmed Data Center Projects in Hill County

**CLARIFICATION:**
- **2 data center projects** confirmed in Hill County (by point-in-polygon geocoding)
- **Both are in the database** (processed through the news pipeline)
- **These are DATA CENTER projects** (not ERCOT energy projects)

**Project 1: "CyrusOne bosque county"**
- **Company:** CyrusOne
- **Location text:** "bosque county" (incorrect - actually in Hill County)
- **Size:** 180 MW
- **Announced:** 2025-07-30
- **Status:** uncertain (low confidence)
- **Project ID:** proj_6c5910e85a48

**Project 2: "CyrusOne co"**
- **Company:** CyrusOne
- **Location text:** "co" (very vague)
- **Size:** Unknown
- **Announced:** 2025-12-08
- **Status:** uncertain (low confidence)
- **Project ID:** proj_ee843a3e2057

**Note:** Earlier analysis found 6 projects using a rough bounding box, but the actual Hill County boundary (point-in-polygon) contains only these 2 projects. The other 4 projects are likely in adjacent counties (Bosque County, etc.).

### 4. Status Analysis
- **Both projects:** Status = "uncertain" (low confidence)
- **No active projects** in Hill County
- **No dead projects** in Hill County
- **Timeline:** Both announced in 2025 (July and December)

## Scenario Assessment

**SCENARIO A:** Hill has 2 announced data center projects, both uncertain status
- **2 data center projects** (both CyrusOne)
- **Total capacity:** 180 MW (one project has unknown size)
- Both announced in 2025 (July and December)
- Both have uncertain status (low confidence)
- Location text is incorrect/misleading (says "bosque county" or "co")
- **Conclusion:** Hill County has 2 announced data center projects, but they're not yet operational and status is uncertain. Both are CyrusOne projects, suggesting a coordinated development effort.

## Key Insights

1. **Location Text Issues:**
   - Both projects say "bosque county" or "co" but are actually in Hill County
   - Point-in-polygon geocoding correctly identified Hill County despite bad location text
   - **Data quality issue:** Location extraction is failing for this area

2. **CyrusOne Focus:**
   - **Both projects are CyrusOne** (not multiple companies)
   - May be part of a larger CyrusOne expansion in the Waco area
   - Could be a coordinated campus development
   - Total capacity: 180 MW (one project size unknown)

3. **Waco-Area Development:**
   - Hill County is adjacent to Bosque County (where CyrusOne has expansion)
   - These 2 projects may be part of a larger regional development
   - Could be a "sleeper" market waking up

4. **Status Uncertainty:**
   - Both projects marked "uncertain" with low confidence
   - No clear signals of progress or cancellation
   - Need more recent articles to determine current status
   - Both announced in 2025 (recent)

5. **Energy Surplus:**
   - Hill County has 3.23 GW operational energy capacity (from ERCOT)
   - Current DC demand: ~0.18-0.28 GW (depending on second project size)
   - **Energy surplus: 2.95+ GW** - Hill is a winner!
   - Has significant energy surplus even if both projects proceed

## Recommendations

1. **Monitor for updates:** Check for recent articles about CyrusOne projects in Hill County
2. **Verify project status:** Contact CyrusOne or check local permits to confirm if projects are moving forward
3. **Location extraction:** Improve location extraction to correctly identify Hill County projects
4. **Follow-up analysis:** Check if these are part of a larger CyrusOne campus development

## Data Quality Notes

- **Location text extraction failed** for both projects (said "bosque county" or "co" instead of "Hill County")
- **Point-in-polygon geocoding saved the day** - correctly identified Hill County despite bad location text
- **Status tracking needs improvement** - both projects marked "uncertain" but may have more definitive status

