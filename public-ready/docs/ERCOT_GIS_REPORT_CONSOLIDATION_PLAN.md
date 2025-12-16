# ERCOT GIS Report - Data Consolidation Plan

**Date:** 2025-12-11  
**Source:** ERCOT GIS Report (Monthly Generation Interconnection Status)  
**URL:** https://www.ercot.com/mp/data-products/data-product-details?id=pg7-200-er  
**Objective:** Download and consolidate all monthly XLSX files into single dataset for mapping

---

## Overview

The ERCOT GIS Report provides monthly interconnection milestone and trend information for generation resources. Based on our experience with the LBL dataset, we need to:

1. **Identify** all available monthly XLSX files
2. **Download** them (may require automation due to JavaScript/modals)
3. **Inspect** each file's structure
4. **Consolidate** into single dataset
5. **Map** the data

---

## Step 1: Identify Available Files (30 min)

### 1.1 Navigate to ERCOT GIS Report Page

**URL:** https://www.ercot.com/mp/data-products/data-product-details?id=pg7-200-er

**Page Details (from ERCOT website):**
- **Report Type:** GIS Report
- **Generation Frequency:** Monthly (Chron)
- **First Run Date:** 2-1-2017
- **File Type:** xlsx
- **Status:** Active
- **Audience:** Public
- **Posting Type:** Report

**Tasks:**
- [ ] Take screenshot of page structure
- [ ] Identify "Available Files" table (mentioned in page description)
- [ ] Check for file listing with "Friendly Name" and "Posted" columns
- [ ] Document file naming pattern
- [ ] Note date range of available files
- [ ] Check if files are direct download links or require clicking

**Actual Findings (from page inspection):**
- ✅ **File table found** with download links
- ✅ **Two file types:**
  1. `GIS_Report_[Month][Year].xlsx` - Main GIS reports (monthly)
  2. `Co-located_Battery_Identification_Report_[Month]_[Year].xlsx` - Battery reports (monthly)
- ✅ **File naming pattern:** `GIS_Report_September2025`, `GIS_Report_August2025`, etc.
- ✅ **Download links:** Direct "xl x" links in table (clickable)
- ✅ **Date range:** Visible files from 2025 (likely goes back to 2017-02-01)
- ✅ **Table structure:** Friendly Name | Posted Date | Time | Download Link
- ⚠️ **May need scrolling:** Table may be paginated or require scrolling to see all files

### 1.2 Document File Structure

**Check:**
- How many files are available?
- What date range? (First Run Date: 2-1-2017, so potentially 2017-2024)
- File naming convention?
- Are files listed in a table or as download links?

**Document:**
```markdown
Files Found: [X] files
Date Range: [YYYY-MM] to [YYYY-MM]
Naming Pattern: [pattern]
File Size Range: [X] MB to [Y] MB
```

---

## Step 2: Download Strategy (1-2 hours)

### 2.1 Assess Download Method

**Based on our LBL experience:**

**Option A: Direct Download Links (Best Case)**
- If files have direct download URLs
- Can use `curl` or `wget` in batch
- Fastest method

**Option B: Playwright Automation (Likely Needed)**
- If page uses JavaScript to load file list
- If downloads require clicking links
- If there are modals/popups (like LBL had)
- Use our proven Playwright script pattern

**Option C: Manual Download (Fallback)**
- If automation fails
- Download files manually
- Document each file

### 2.2 Create Download Script

**If Playwright needed (most likely):**

```python
# scripts/ercot/download_gis_reports.py
from playwright.sync_api import sync_playwright
from pathlib import Path
import time

def download_gis_reports(output_dir="data/ercot/gis_reports/raw"):
    """
    Download all ERCOT GIS Report XLSX files.
    Based on our LBL download experience.
    """
    # Similar structure to download_lbl_playwright.py
    # Handle modals, JavaScript, file downloads
```

**Key Features:**
- Handle modals (like LBL email signup)
- Click download links
- Save files with original names
- Rate limiting (don't overwhelm server)
- Error handling and retry logic
- Progress tracking

### 2.3 Test Download

**Start Small:**
- [ ] Download 1-2 files first (most recent)
- [ ] Verify file structure
- [ ] Check if files are consistent
- [ ] Verify file naming convention
- [ ] Then download all files in batch

**Expected File Count:**
- **GIS Reports:** ~100 files (monthly since 2017-02-01)
- **Battery Reports:** ~100 files (monthly, may have started later)
- **Total:** ~200 files potentially
- **File size:** Likely 1-5 MB each (XLSX format)
- **Total download size:** ~200-1000 MB

**Note:** Two file types means we may need to:
- Download both types
- Consolidate separately OR together
- Understand relationship between GIS reports and battery reports

---

## Step 3: Inspect File Structure (1 hour)

### 3.1 Sample File Inspection

**Pick 2-3 files from different time periods:**
- Recent file (e.g., latest)
- Middle file (e.g., 2022)
- Early file (e.g., 2017-2018)

**For each file:**
```python
# scripts/ercot/inspect_gis_file.py
import pandas as pd

def inspect_gis_file(file_path):
    """Inspect single GIS report file structure."""
    xl_file = pd.ExcelFile(file_path)
    
    # Check:
    # - Number of sheets
    # - Sheet names
    # - Column headers
    # - Data types
    # - Row counts
    # - Date ranges
```

**Document:**
- Number of sheets per file
- Sheet names (are they consistent?)
- Column structure (do columns change over time?)
- Data format (dates, numbers, text)
- Any structural changes over time?

### 3.2 Identify Data Schema Evolution

**Check for:**
- Column name changes over time
- New columns added
- Columns removed
- Data format changes
- Sheet structure changes

**This is critical** - ERCOT may have changed their reporting format over 7+ years (2017-2024).

---

## Step 4: Consolidation Strategy (2-3 hours)

### 4.1 Determine Consolidation Approach

**Based on file structure, choose approach:**

**Approach A: Simple Append (If Structure Consistent)**
- All files have same columns
- Just append rows
- Add `report_date` or `report_month` column

**Approach B: Schema Mapping (If Structure Changed)**
- Map old columns to new columns
- Handle missing columns
- Normalize data types

**Approach C: Multi-Sheet Consolidation (If Multiple Sheets)**
- Each file may have multiple sheets
- Need to consolidate across sheets AND files
- More complex

### 4.2 Create Consolidation Script

```python
# scripts/ercot/consolidate_gis_reports.py
import pandas as pd
from pathlib import Path
import json

def consolidate_gis_reports(
    input_dir="data/ercot/gis_reports/raw",
    output_file="data/ercot/gis_reports/consolidated/gis_reports_consolidated.csv"
):
    """
    Consolidate all GIS report XLSX files into single dataset.
    """
    # 1. Load all files
    # 2. Extract main data sheet (identify which sheet)
    # 3. Standardize column names
    # 4. Add metadata (file_date, report_month)
    # 5. Handle schema changes
    # 6. Append all data
    # 7. Deduplicate if needed
    # 8. Save consolidated file
```

**Key Features:**
- Handle schema evolution
- Add metadata columns (source file, report date)
- Data type normalization
- Missing value handling
- Deduplication logic
- Progress tracking
- Error logging

### 4.3 Data Quality Checks

**After consolidation:**
- [ ] Check for duplicates
- [ ] Verify date ranges
- [ ] Check for missing data
- [ ] Validate data types
- [ ] Check for outliers
- [ ] Compare row counts (sum of files vs consolidated)

---

## Step 5: Mapping Preparation (1-2 hours)

### 5.1 Geocoding Strategy

**Based on our experience:**

**Option A: Use Existing Location Data**
- If files have county/state (like LBL dataset)
- Use county centroids (we have this logic)
- Fast and reliable

**Option B: Geocode from Addresses**
- If files have addresses
- Use geopy/Nominatim (we have this)
- Slower but more precise

**Option C: Use Coordinates if Available**
- If files already have lat/lng
- Use directly
- Best case scenario

### 5.2 Create Mapping Dataset

**Generate GeoJSON for map:**
```python
# scripts/ercot/prepare_gis_for_mapping.py
def prepare_for_mapping(consolidated_file):
    """
    Prepare consolidated GIS data for mapping.
    """
    # 1. Load consolidated data
    # 2. Geocode locations (if needed)
    # 3. Create GeoJSON
    # 4. Add styling properties
    # 5. Save for map integration
```

**Output:**
- `gis_reports_mapped.geojson` - For map visualization
- Include properties: capacity, type, status, date, etc.

---

## Step 6: Integration with Existing Map (1 hour)

### 6.1 Map Integration

**Based on our Columbus migration experience:**

**Add to OSMCall.jsx:**
- New function: `loadErcotGisReports()`
- Create Mapbox layers for GIS data
- Style by generation type, status, capacity
- Add popups with project details

**Add to Legend:**
- Update `legendConfig.js` with GIS layers
- Update `buildLegendSections.js` to include GIS data
- Update `LegendContainer.jsx` for visibility toggles

### 6.2 Layer Styling

**Style by:**
- Generation type (Battery, Solar, Wind, Gas)
- Status (Active, Withdrawn, Operational)
- Capacity (size by MW)
- Date (color by report month/year)

---

## Implementation Checklist

### Phase 1: Discovery (30 min)
- [ ] Navigate to ERCOT GIS Report page
- [ ] Document available files
- [ ] Take screenshots
- [ ] Identify download method needed

### Phase 2: Download (1-2 hours)
- [ ] Create download script (Playwright if needed)
- [ ] Test on 1-2 files
- [ ] Download all files
- [ ] Verify all downloads successful
- [ ] Document any issues

### Phase 3: Inspection (1 hour)
- [ ] Inspect 3 sample files (recent, middle, early)
- [ ] Document schema
- [ ] Identify schema changes over time
- [ ] Create schema mapping if needed

### Phase 4: Consolidation (2-3 hours)
- [ ] Create consolidation script
- [ ] Handle schema evolution
- [ ] Consolidate all files
- [ ] Data quality checks
- [ ] Save consolidated dataset

### Phase 5: Mapping (1-2 hours)
- [ ] Geocode locations
- [ ] Create GeoJSON
- [ ] Integrate with map
- [ ] Add to legend
- [ ] Test visualization

**Total Estimated Time:** 6-9 hours

---

## Expected Challenges (Based on Our Experience)

### 1. JavaScript/Modal Issues
**Solution:** Use Playwright (we've done this successfully)

### 2. Schema Evolution
**Solution:** Inspect multiple files, create mapping logic

### 3. Large File Count
**Solution:** Batch processing, progress tracking, checkpointing

### 4. Rate Limiting
**Solution:** Add delays between downloads, respect server limits

### 5. Missing Files
**Solution:** Log missing files, handle gracefully, continue with available data

---

## Files to Create

1. ✅ `scripts/ercot/download_gis_reports.py` - Download script (created)
2. `scripts/ercot/inspect_gis_file.py` - File inspection
3. `scripts/ercot/consolidate_gis_reports.py` - Consolidation script
4. `scripts/ercot/prepare_gis_for_mapping.py` - Mapping preparation
5. `data/ercot/gis_reports/raw/` - Raw downloaded files
6. `data/ercot/gis_reports/consolidated/` - Consolidated dataset
7. ✅ `docs/ERCOT_GIS_REPORT_CONSOLIDATION_PLAN.md` - This plan (created)

## Key Findings from Page Inspection

**File Types Found:**
1. **GIS_Report_[Month][Year].xlsx** - Main monthly reports
2. **Co-located_Battery_Identification_Report_[Month]_[Year].xlsx** - Battery-specific reports

**File Table Structure:**
- Table with columns: Friendly Name | Posted Date | Time | Download Link
- Download links are "xl x" text links
- Files visible in snapshot: September 2025 back to at least May 2025
- Likely goes back to 2017-02-01 (First Run Date)

**Download Strategy:**
- Use Playwright (proven approach from LBL)
- Handle modals (we know this pattern)
- Extract links from table
- Filter by file type if needed
- Batch download with rate limiting

---

## Test Results (2025-12-11)

### ✅ Download Script Tested

**Results:**
- ✅ Found 90 GIS_Report files in table
- ✅ Successfully downloaded 1 test file (667 KB)
- ✅ File structure confirmed: 14 sheets per file
- ⚠️  Some timeout issues (fixed with increased timeout)

**File Structure Discovered:**
- **Main Data Sheets:**
  - `Project Details - Large Gen` - Large generation projects
  - `Project Details - Small Gen` - Small generation projects
- **Other Sheets:**
  - Summary, Trends, Commissioning, Inactive, Cancellation
- **Total:** 14 sheets per file

**Next:** Need to inspect "Project Details" sheets to understand data structure

---

## Success Criteria

- [x] Download script created and tested
- [ ] All available GIS report files downloaded (90 files)
- [ ] Files consolidated into single dataset
- [ ] Schema changes handled
- [ ] Data quality verified
- [ ] GeoJSON created for mapping
- [ ] Integrated into map application
- [ ] Legend updated with GIS layers

---

## Next Steps

1. **Start with Step 1:** Navigate to page and identify files
2. **Assess download method:** Check if Playwright needed
3. **Download sample files:** Test on 2-3 files first
4. **Inspect structure:** Understand data format
5. **Proceed with consolidation:** Based on findings

---

**Status:** Plan ready - Awaiting execution  
**Based on:** Our successful LBL dataset download and ERCOT analysis experience

