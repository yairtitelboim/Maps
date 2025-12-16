# DFW10 Coordinate Verification - Final Report

**Date:** December 2025  
**Purpose:** Verify coordinates against official DFW10 address and check county boundaries

---

## Executive Summary

**Key Findings:**
- ✅ **2 CyrusOne projects in Hill County** (point-in-polygon verified)
- ✅ **1 CyrusOne project in Bosque County** (point-in-polygon verified)
- ⚠️ **"CyrusOne DFW10" in our database is in Dallas County** (104km from Whitney - different project)
- 📍 **Whitney, TX geocoded to Hill County** at (31.951823, -97.3214012)
- 🎯 **Projects near Whitney (6-10km) are in Hill County**, not Bosque County

---

## All CyrusOne Projects in Database

### 1. "CyrusOne co"
- **Project ID:** `proj_ee843a3e2057`
- **Coordinates:** (31.873611, -97.369167)
- **County:** ✅ **Hill County** (point-in-polygon verified)
- **Distance from Whitney:** 9.80 km
- **Status:** Near Whitney area, in Hill County

### 2. "CyrusOne bosque county" (Project 1)
- **Project ID:** `proj_6c5910e85a48`
- **Coordinates:** (31.943300, -97.392700)
- **County:** ✅ **Hill County** (point-in-polygon verified)
- **Distance from Whitney:** 6.79 km
- **Status:** Closest to Whitney, but in Hill County (not Bosque despite name)

### 3. "CyrusOne bosque county" (Project 2)
- **Project ID:** `proj_974e38b25f62`
- **Coordinates:** (31.877836, -97.656101)
- **County:** ✅ **Bosque County** (point-in-polygon verified)
- **Distance from Whitney:** 32.65 km
- **Status:** In Bosque County, but further from Whitney than Hill County projects

### 4. "CyrusOne DFW10"
- **Project ID:** `proj_4573106dc8ed`
- **Coordinates:** (32.776700, -96.797000)
- **County:** ✅ **Dallas County**
- **Distance from Whitney:** 104.10 km
- **Status:** ⚠️ **Different DFW10 project** - This is in Dallas, not the Whitney/Bosque area DFW10

### 5. "CyrusOne bexar county"
- **Project ID:** `proj_51b06f4013fa`
- **Coordinates:** (29.426399, -98.510478)
- **County:** ✅ **Bexar County** (San Antonio area)
- **Distance from Whitney:** 302.96 km
- **Status:** Unrelated to Whitney/Bosque area

---

## Official DFW10 Address Verification

**Official Address:** 557 County Rd 3610, Whitney, Texas 76692

**Geocoding Results:**
- **Whitney, TX center:** (31.951823, -97.3214012)
- **County:** Hill County (geocoded result)
- **Note:** Specific address "557 County Rd 3610" did not geocode, but Whitney itself is in Hill County

**Perplexity Research:**
- Confirmed DFW10 is at this address
- Stated it's in **Bosque County** (not Hill County)
- Address is "in Whitney, Bosque County" per Perplexity

**Discrepancy:**
- Geocoding places Whitney in **Hill County**
- Perplexity says the specific address is in **Bosque County**
- This suggests the address is very close to the county border

---

## County Boundary Analysis

### Projects in Hill County (2)
1. **"CyrusOne co"** - 9.80 km from Whitney
2. **"CyrusOne bosque county"** (proj_6c5910e85a48) - 6.79 km from Whitney

**Characteristics:**
- Both are **closest to Whitney** (6-10 km)
- Both are **point-in-polygon verified in Hill County**
- One has misleading name ("bosque county") but is actually in Hill County

### Projects in Bosque County (1)
1. **"CyrusOne bosque county"** (proj_974e38b25f62) - 32.65 km from Whitney

**Characteristics:**
- **Further from Whitney** than the Hill County projects
- **Point-in-polygon verified in Bosque County**
- May be the actual DFW10 or a different project

---

## Are These the Same as DFW10?

### Analysis by Distance from Whitney

**Whitney, TX is the reference point** (where DFW10 is supposed to be):

1. **"CyrusOne bosque county" (proj_6c5910e85a48)**
   - Distance: **6.79 km** from Whitney
   - County: **Hill County**
   - **Most likely candidate** - closest to Whitney

2. **"CyrusOne co"**
   - Distance: **9.80 km** from Whitney
   - County: **Hill County**
   - **Possible candidate** - second closest

3. **"CyrusOne bosque county" (proj_974e38b25f62)**
   - Distance: **32.65 km** from Whitney
   - County: **Bosque County**
   - **Less likely** - much further from Whitney

### Analysis by County

**Perplexity says DFW10 is in Bosque County:**
- Only one project in Bosque County: `proj_974e38b25f62`
- But it's **32.65 km from Whitney** (far)
- The projects **closest to Whitney are in Hill County**

**Possible Explanations:**
1. **County border confusion** - Projects very close to border, geocoded to wrong county
2. **Different projects** - These are separate from DFW10
3. **Coordinate errors** - Our coordinates may be wrong
4. **Multiple phases** - DFW10 may span both counties or have multiple sites

---

## Critical Questions

### 1. Which Project is DFW10?

**Most Likely:**
- **"CyrusOne bosque county" (proj_6c5910e85a48)** - Closest to Whitney (6.79 km)
- But it's in **Hill County**, not Bosque County

**Alternative:**
- **"CyrusOne bosque county" (proj_974e38b25f62)** - In Bosque County as Perplexity says
- But it's **32.65 km from Whitney** (far)

### 2. Why the County Mismatch?

**Possible Reasons:**
- County border runs very close to Whitney
- Address "557 County Rd 3610" may be on Bosque side of border
- Our coordinates may be slightly off, placing projects in wrong county
- Point-in-polygon may have edge case issues near borders

### 3. Is "CyrusOne DFW10" in Dallas the Same Project?

**No - Different Project:**
- Coordinates: (32.776700, -96.797000) - **Dallas County**
- Distance: **104.10 km from Whitney**
- This is clearly a **different DFW10 facility** (probably in Dallas metro)

---

## Recommendations

### Immediate Actions

1. **Verify Exact County Border at Address**
   - Check property records for "557 County Rd 3610, Whitney, TX 76692"
   - Confirm which county the parcel is actually in
   - May require county appraisal district lookup

2. **Re-geocode with Better Sources**
   - Use county tax records
   - Check ERCOT interconnection filings
   - Verify with property deeds

3. **Check for Multiple DFW10 Projects**
   - DFW10 may refer to multiple facilities
   - Dallas DFW10 is clearly different
   - Whitney-area DFW10 may be separate from both

### Data Quality Improvements

1. **Flag Projects Near County Borders**
   - Special handling for projects within 5 km of county lines
   - Manual verification required
   - Cross-reference multiple sources

2. **Improve Location Text**
   - Update misleading names ("bosque county" when in Hill County)
   - Add county verification to geocoding process
   - Flag discrepancies between name and coordinates

3. **Coordinate Verification**
   - Cross-reference coordinates with official addresses
   - Use multiple geocoding services
   - Verify against property records

---

## Conclusion

**The Truth:**
- ✅ We have **2 projects in Hill County** near Whitney (6-10 km away)
- ✅ We have **1 project in Bosque County** further from Whitney (32 km away)
- ⚠️ **County mismatch** - Projects closest to Whitney are in Hill County, but Perplexity says DFW10 is in Bosque County
- ⚠️ **Possible coordinate errors** or county border confusion

**What We Know:**
- Point-in-polygon geocoding is generally accurate
- But county borders near Whitney may be causing confusion
- Projects closest to Whitney are in Hill County (not Bosque)
- Need to verify exact county boundary at the official DFW10 address

**Next Steps:**
1. Verify exact county for "557 County Rd 3610, Whitney, TX 76692"
2. Check if our coordinates need adjustment
3. Determine which of our projects (if any) is the actual DFW10
4. Update database with verified information

---

## Files Generated

- `data/analysis/dfw10_coordinate_verification.json` - Verification data
- `docs/STORY1_DFW10_COORDINATE_VERIFICATION.md` - This report

