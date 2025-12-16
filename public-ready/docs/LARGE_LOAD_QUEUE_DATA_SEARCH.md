# Large Load Queue Data Search Results

**Date:** 2025-12-11  
**Objective:** Find Large Load Interconnection Queue data sources  
**Time Spent:** ~60 minutes

---

## Search Results Summary

### ❌ LBL Dataset - NO Large Load Data

**Checked:** All 41 sheets in `lbnl_ix_queue_data_file_thru2024_v2.xlsx`

**Result:** 
- ✅ Confirmed: NO sheets with "load" or "large" in name
- ✅ Dataset focuses on **generation and storage** only
- ❌ Does NOT include large load interconnection requests

**Sheets Found:**
- 03. Complete Queue Data (generation/storage)
- Various analysis sheets (capacity, trends, completion rates)
- NO large load sheets

---

### ⚠️ ERCOT Website - PDF Reports Available (Limited)

**URL:** https://www.ercot.com/services/rq/large-load-integration

**Found:**
- ✅ Large Load Integration page exists
- ✅ PDF reports available (but need to check if downloadable)
- ⚠️ May require authentication for detailed data

**PDF Reports Found:**
1. **Large Load Interconnection Queue Status Update - 2024-09-06**
   - URL: https://www.ercot.com/files/docs/2024/09/09/05-lli-queue-status-update-2024-9-6.pdf
   - Status: Need to verify if downloadable
   - Content: Queue status, project categories

2. **Large Load Interconnection Queue Status Update - 2023-10-23**
   - URL: https://www.ercot.com/files/docs/2023/10/20/LLI%20Queue%20Status%20Update%20-%202023-10-23.pdf
   - Status: Need to verify if downloadable
   - Content: Historical queue data

**Limitations:**
- PDFs may not be machine-readable (tables in PDF format)
- May need to extract data manually or with PDF parsing
- May not have all fields we need (location, capacity, etc.)

**Next Steps:**
- [ ] Download PDFs and inspect structure
- [ ] Check if data is extractable (tables vs. text)
- [ ] Check if location/capacity data is included

---

### ❌ Other ISOs - Limited Public Data

**PJM:**
- ⚠️ No specific "large load" queue found in public searches
- ⚠️ May be included in general interconnection queue
- ⚠️ May require authentication

**MISO:**
- ⚠️ No specific "large load" queue found in public searches
- ⚠️ May be included in general interconnection queue

**CAISO:**
- ⚠️ No specific "large load" queue found in public searches
- ⚠️ May be included in general interconnection queue

**NYISO:**
- ⚠️ No specific "large load" queue found in public searches

**General Finding:**
- Large load queues are typically **not publicly available** in structured format
- Most ISOs don't separate large load from generation in public datasets
- May require direct ISO access or FOIA requests

---

### ✅ Academic/Research Sources - Found Some

**1. NERC Whitepaper:**
- **Title:** "Characteristics and Risks of Emerging Large Loads"
- **URL:** https://prod.nerc.com/globalassets/who-we-are/standing-committees/rstc/whitepaper-characteristics-and-risks-of-emerging-large-loads.pdf
- **Content:** Analysis of large load trends, but may not have specific queue data
- **Status:** Need to download and check

**2. LBL Dataset:**
- ❌ Confirmed: Does NOT include large load data
- ✅ Only generation/storage projects

**3. Other Research:**
- ⚠️ No other compiled datasets found in public searches
- ⚠️ Academic papers may reference data but not provide it

---

## Key Findings

### What We Found:

1. **ERCOT PDF Reports** ✅
   - Available but need to verify download/parsing
   - May have queue data but in PDF format
   - Need to check if includes location/capacity

2. **NERC Whitepaper** ✅
   - Available for download
   - May have analysis but not raw queue data

3. **Other ISOs** ❌
   - No public large load queue data found
   - May require authentication or FOIA

### What We Need:

1. **Structured Data:**
   - CSV/Excel format preferred
   - Location data (county, coordinates)
   - Capacity data (MW)
   - Status data
   - Date data

2. **2023-2024 Data:**
   - Match our generation queue timeframe
   - Enable comparison

3. **Machine-Readable:**
   - Not PDF tables (hard to parse)
   - Structured format

---

## Recommendations

### Option 1: Parse ERCOT PDFs (Recommended First Step)

**Action:**
1. Download ERCOT PDF reports
2. Extract tables using PDF parsing (Tabula, pdfplumber)
3. Check if data includes location/capacity
4. Convert to structured format

**Pros:**
- Official ERCOT source
- Likely has queue data
- Free

**Cons:**
- PDF parsing can be error-prone
- May not have all fields
- May need multiple PDFs for complete data

### Option 2: Request ERCOT Data (If PDFs Don't Work)

**Action:**
1. Contact ERCOT for structured data
2. Request Large Load queue in CSV/Excel format
3. May require FOIA request

**Pros:**
- Structured data
- Complete dataset
- Official source

**Cons:**
- May take time
- May require justification
- May have restrictions

### Option 3: Use News/Announcement Data (Current Approach)

**Action:**
1. Continue with news article data
2. Manually compile data center locations
3. Use for proximity analysis

**Pros:**
- Real data
- Available now
- Can start analysis

**Cons:**
- Incomplete (only announced projects)
- May miss many projects
- Not comprehensive

---

## Next Steps

### Immediate (Next 30 min):

1. [ ] Download ERCOT PDF: `05-lli-queue-status-update-2024-9-6.pdf`
2. [ ] Inspect PDF structure (tables, text, format)
3. [ ] Check if location/capacity data included
4. [ ] Test PDF parsing (Tabula or pdfplumber)
5. [ ] Download NERC whitepaper and check for data

### If PDFs Work:

1. [ ] Extract all ERCOT PDF reports
2. [ ] Parse into structured format
3. [ ] Merge with generation queue data
4. [ ] Proceed with proximity analysis

### If PDFs Don't Work:

1. [ ] Consider FOIA request to ERCOT
2. [ ] Or continue with news/announcement approach
3. [ ] Acknowledge data limitations

---

## Files Created

- `docs/LARGE_LOAD_QUEUE_DATA_SEARCH.md` - This document

---

## Status

**Current:** Found ERCOT PDF reports, need to verify if usable  
**Next:** Download and inspect PDFs  
**Confidence:** Medium - PDFs exist but format unknown

