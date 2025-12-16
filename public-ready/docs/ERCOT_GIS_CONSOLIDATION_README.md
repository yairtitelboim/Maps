# ERCOT GIS Report Consolidation - README

**Date:** 2025-12-11  
**Status:** ✅ Scripts created and tested

---

## Overview

This directory contains scripts to download and consolidate ERCOT GIS Report monthly files into a single dataset for analysis and mapping.

---

## Files

### 1. `download_gis_reports.py`
Downloads all ERCOT GIS Report XLSX files from the ERCOT website.

**Usage:**
```bash
# Test mode (2 files)
python3 scripts/ercot/download_gis_reports.py --test

# Full download (all ~90 files)
python3 scripts/ercot/download_gis_reports.py
```

**Output:** `data/ercot/gis_reports/raw/GIS_Report_*.xlsx`

---

### 2. `consolidate_gis_reports.py`
Consolidates all downloaded files into a single dataset.

**Usage:**
```bash
# Consolidate all files
python3 scripts/ercot/consolidate_gis_reports.py

# Output formats: csv, json, or both (default: both)
python3 scripts/ercot/consolidate_gis_reports.py csv
```

**Output:**
- `data/ercot/gis_reports/consolidated/ercot_gis_reports_consolidated_[timestamp].csv`
- `data/ercot/gis_reports/consolidated/ercot_gis_reports_consolidated_[timestamp].json`
- `data/ercot/gis_reports/consolidated/ercot_gis_reports_consolidated_latest.csv`
- `data/ercot/gis_reports/consolidated/ercot_gis_reports_consolidated_latest.json`
- `data/ercot/gis_reports/consolidated/consolidation_summary_[timestamp].json`

---

### 3. `test_consolidation.py`
Tests consolidation on a few sample files first.

**Usage:**
```bash
python3 scripts/ercot/test_consolidation.py
```

---

### 4. `inspect_gis_file.py`
Inspects a single file to understand its structure.

**Usage:**
```bash
# Inspect most recent file
python3 scripts/ercot/inspect_gis_file.py

# Inspect specific file
python3 scripts/ercot/inspect_gis_file.py data/ercot/gis_reports/raw/GIS_Report_October2025.xlsx
```

---

## Data Structure

### File Structure
- **Newer files (2021+):** 
  - Sheet: `Project Details - Large Gen`
  - Header at row 31 (skip 30 rows)
  
- **Older files (pre-2021):**
  - Sheet: `Project Details` (combined Large + Small)
  - Header at row 31 (skip 30 rows)

### Key Columns
- `INR` - Interconnection Request Number (unique ID)
- `Project Name` - Project name
- `County` - Texas county name (for geocoding)
- `POI Location` - Point of Interconnection location
- `Capacity (MW)` - Project capacity in megawatts
- `Fuel` - Fuel type (WIN, SOL, BAT, etc.)
- `Technology` - Technology type (WT, PV, etc.)
- `Projected COD` - Projected Commercial Operation Date
- `GIM Study Phase` - Study phase status

### Metadata Added
- `source_file` - Original filename
- `report_month` - Month name (e.g., "October")
- `report_year` - Year (e.g., "2025")
- `report_date` - ISO date (e.g., "2025-10-01")
- `extraction_date` - When data was extracted

---

## Workflow

### Step 1: Download Files
```bash
python3 scripts/ercot/download_gis_reports.py
```
- Downloads ~90 files
- Takes 15-30 minutes
- Files saved to `data/ercot/gis_reports/raw/`

### Step 2: Test Consolidation (Optional)
```bash
python3 scripts/ercot/test_consolidation.py
```
- Tests on 3 sample files
- Verifies script works before full run

### Step 3: Consolidate All Files
```bash
python3 scripts/ercot/consolidate_gis_reports.py
```
- Processes all downloaded files
- Handles schema differences between old/new files
- Generates CSV, JSON, and summary

### Step 4: Geocode (Next Step)
- Use county centroids for geocoding
- Create GeoJSON for mapping
- Integrate into map application

---

## Schema Evolution

The script handles differences between file versions:

1. **Sheet Names:**
   - Newer: `Project Details - Large Gen`
   - Older: `Project Details`

2. **Column Names:**
   - Generally consistent, but script standardizes variations

3. **Header Row:**
   - Usually row 31 (skip 30 rows)
   - Script tries multiple skiprows if needed

---

## Expected Results

### Data Volume
- **Files:** ~90 monthly reports
- **Projects per file:** ~1,800-2,000
- **Total projects:** ~150,000-180,000 (with duplicates across months)
- **Unique projects:** ~5,000-10,000 (estimated)

### Output Size
- **CSV:** ~50-100 MB
- **JSON:** ~80-150 MB

---

## Troubleshooting

### Issue: "Worksheet not found"
- **Cause:** Older files use different sheet names
- **Solution:** Script automatically tries alternative sheet names

### Issue: "No data rows found"
- **Cause:** Header row detection failed
- **Solution:** Script tries multiple skiprows values

### Issue: "Download timeout"
- **Cause:** Page takes time to load
- **Solution:** Script has 120s timeout, increase if needed

---

## Next Steps

1. ✅ Download all files
2. ✅ Consolidate data
3. [ ] Geocode locations (county centroids)
4. [ ] Create GeoJSON
5. [ ] Integrate into map application
6. [ ] Add to legend

---

**Status:** Scripts ready, download in progress

