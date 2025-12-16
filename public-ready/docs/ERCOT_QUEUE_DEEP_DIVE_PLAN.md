# ERCOT Interconnection Queue - Deep Dive Plan (Cost-Effective)

## Overview

This plan focuses on getting clean, verified ERCOT interconnection queue data from 2023 using **surgical Firecrawl usage** and **free data sources first**. It incorporates cost-effective strategies to minimize credit usage while maximizing data quality.

---

## Core Strategy

### Priority Order (Cost-Effective Approach)

1. **Free Sources First** (0 credits)
   - Direct downloads (CSV, Excel, XML)
   - Public APIs
   - Government data portals

2. **Browser Automation Tools** (0 credits, setup time)
   - Playwright / Selenium for dynamic content
   - When Firecrawl can't handle JavaScript
   - For pagination/interaction

3. **Surgical Firecrawl** (minimal credits)
   - Only when free source unavailable
   - Single high-value pages
   - Cached results

4. **Manual Collection** (0 credits, time cost)
   - For verification and spot checking
   - Screenshots for documentation
   - Small datasets (<20 entries)

---

## TOOL SELECTION & TRADEOFFS

### Available Tools Comparison

| Tool | Cost | Setup Time | Best For | Limitations |
|------|------|------------|----------|-------------|
| **Direct Download** | 0 credits | 0 min | Static files, exports | May not exist |
| **Playwright** | 0 credits | 30-60 min | Dynamic JS pages, pagination | Requires setup, slower |
| **Selenium** | 0 credits | 30-60 min | Complex interactions | Heavy, slower than Playwright |
| **Firecrawl** | 1 credit/page | 0 min | Quick scraping, PDFs | Limited JS support, costs credits |
| **Manual** | 0 credits | 0 min | Verification, small datasets | Time-consuming, not scalable |
| **Tabula** | 0 credits | 10 min | PDF tables | PDFs only, may need cleanup |

### Decision Matrix: Which Tool to Use?

**Use Direct Download if:**
- ✅ CSV/Excel/XML export button exists
- ✅ Data is static (doesn't change on interaction)
- ✅ No JavaScript required

**Use Playwright if:**
- ✅ Page requires JavaScript to load content
- ✅ Pagination needs clicking/scrolling
- ✅ Dynamic filters need interaction
- ✅ Dataset is large (50+ entries)
- ⚠️ Setup time acceptable (30-60 min)

**Use Selenium if:**
- ✅ Playwright not available
- ✅ Need complex browser automation
- ⚠️ Heavier than Playwright, slower

**Use Firecrawl if:**
- ✅ Page is static HTML (no JS needed)
- ✅ Single page contains all data
- ✅ Quick one-off scrape needed
- ⚠️ Credits available and limited

**Use Manual if:**
- ✅ Dataset is small (<20 entries)
- ✅ Verification/spot checking needed
- ✅ Screenshots for documentation
- ⚠️ Not scalable for large datasets

**Use Tabula if:**
- ✅ Data is in PDF tables
- ✅ Need structured extraction
- ⚠️ May need cleanup after extraction

### Hybrid Approach (Recommended)

**Best Practice:** Combine tools strategically

1. **Discovery Phase:** Manual inspection + screenshots
2. **Extraction Phase:** Automated tool (Playwright/Firecrawl)
3. **Verification Phase:** Manual spot checks + screenshots

---

## PHASE 1: DATA SOURCE DISCOVERY & ASSESSMENT

### Step 1: Identify All Possible Data Sources

**Goal:** Find every possible way to get ERCOT queue data without using Firecrawl.

#### 1.1 ERCOT Official Sources

**Primary URL:** https://www.ercot.com/services/comm/status

**Tasks:**
- [ ] **Manual inspection with screenshots** (no automation yet)
  - **Take screenshots:**
    - Full page screenshot
    - Table/list area screenshot
    - Any filter/export buttons screenshot
    - Save to: `docs/screenshots/ercot_page_structure.png`
  
  - **Document observations:**
    - Page type: [table/PDF/Excel download/interactive tool?]
    - JavaScript required? [Y/N - check if content loads after page load]
    - Pagination? [Y/N, how many pages?]
    - Filters available? [Y/N, what filters?]
    - Download/Export button? [Y/N, format?]
    - Login/registration required? [Y/N]
  
  - **Test interactions manually:**
    - Can you filter to 2023? [Y/N]
    - Can you see all entries on one page? [Y/N]
    - Does scrolling load more content? [Y/N]
    - Are there hidden columns? [Y/N]

- [ ] **Check for direct downloads**
  - Look for CSV/Excel/XML export links
  - Check for "Data" or "Downloads" section
  - Look for API documentation

- [ ] **Check ERCOT Data Portal**
  - https://www.ercot.com/mp/data-products
  - Search for "interconnection" or "queue"
  - Check for public datasets

**STOP HERE if:**
- Found direct download (CSV/Excel/XML) → **Use free source, skip Firecrawl**
- Found public API → **Use API, skip Firecrawl**
- Data requires paid access → **Document and assess cost vs value**

#### 1.2 Alternative Free Sources

**Check these before Firecrawl:**
- [ ] ERCOT FTP server (if exists)
- [ ] Texas PUC filings database
- [ ] FERC eLibrary (if ERCOT files there)
- [ ] State energy office datasets
- [ ] Academic/research datasets

**Document findings:**
```
Free Source Found: [Y/N]
Source Type: [Download/API/Other]
URL: [___]
Format: [CSV/Excel/XML/Other]
Last Updated: [date]
Coverage: [2023? Full history?]
```

---

## STEP 2: ASSESS DATA ACCESS METHOD

### 2.1 If Free Download Available

**✅ Best Case Scenario - No Firecrawl Needed**

**Process:**
1. Download file directly
2. Inspect format and structure
3. Proceed to Step 3 (Data Quality Assessment)

**Document:**
- File format: [CSV/Excel/PDF/XML]
- File size: [X MB]
- Download URL: [exact URL]
- Last updated: [date]

### 2.2 If Only Web Interface Available

**⚠️ May Need Automation (Choose Tool Based on Page Type)**

**Step 1: Assess Page Type**

**A. Static HTML Table (No JavaScript)**
- ✅ **Use Firecrawl** (1 credit, fastest)
- Page loads immediately with all data
- No interaction needed

**B. JavaScript-Loaded Content**
- ✅ **Use Playwright** (0 credits, 30-60 min setup)
- Content loads after page load
- Requires waiting for elements
- May need scrolling/pagination

**C. Simple Pagination (<10 pages)**
- ✅ **Option 1: Manual** (0 credits, 15-30 min)
  - Copy/paste each page
  - Combine in spreadsheet
- ✅ **Option 2: Playwright** (0 credits, if >5 pages)
  - Automate pagination clicks
  - Extract all pages

**D. Complex Pagination (10+ pages)**
- ✅ **Use Playwright** (0 credits, best for automation)
- Automate pagination
- Extract all data

**Step 2: Tool Selection Decision**

```python
def select_tool(page_analysis):
    """Select best tool based on page characteristics."""
    
    if page_analysis['has_download']:
        return 'direct_download'  # 0 credits, 0 setup
    
    if page_analysis['is_static_html']:
        return 'firecrawl'  # 1 credit, 0 setup
    
    if page_analysis['requires_js']:
        if page_analysis['pages'] < 5:
            return 'manual'  # 0 credits, 15-30 min
        else:
            return 'playwright'  # 0 credits, 30-60 min setup
    
    if page_analysis['pages'] > 10:
        return 'playwright'  # 0 credits, best for automation
    
    return 'manual'  # Default for small datasets
```

**Step 3: Identify Target Page**

- [ ] **Main queue table/list page** (not individual pages)
- [ ] **Page that shows multiple entries**
- [ ] **Page with filters for 2023 data**
- [ ] **Screenshot the target page** for reference

### 2.3 If PDF Only

**Assess PDF Structure:**
- [ ] Is it a table? (use Tabula - free, no credits)
- [ ] Is it text? (use PDF text extraction - free)
- [ ] Is it scanned images? (may need Firecrawl extract)

**Firecrawl Strategy (if needed):**
- Use `extract` endpoint with narrow prompt
- Extract only: filing_id, date, location, capacity, status
- Cache result

---

## STEP 3: DOWNLOAD & INSPECT RAW DATA

### 3.1 Get the Data (Tool Selection Based on Page Type)

**A. If Direct Download Available:**
```bash
# Download directly
curl -O https://ercot.com/path/to/data.csv

# Or use browser download
# Save to: data/ercot/raw/ercot_queue_raw.csv
```
**Cost:** 0 credits, 0 setup time

**B. If Static HTML Table (No JavaScript):**
```python
# Use Firecrawl (1 credit, fastest)
def get_ercot_static_data():
    cache_file = Path("data/ercot/raw/ercot_queue_cached.json")
    if cache_file.exists():
        return json.load(cache_file)
    
    result = firecrawl_scrape(
        url="https://www.ercot.com/services/comm/status",
        formats=["markdown"]
    )
    
    save_to_cache(cache_file, result)
    return result
```
**Cost:** 1 credit, 0 setup time

**C. If JavaScript-Loaded Content:**
```python
# Use Playwright (0 credits, requires setup)
from playwright.sync_api import sync_playwright

def get_ercot_dynamic_data():
    cache_file = Path("data/ercot/raw/ercot_queue_cached.json")
    if cache_file.exists():
        return json.load(cache_file)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Navigate to page
        page.goto("https://www.ercot.com/services/comm/status")
        
        # Wait for content to load
        page.wait_for_selector("table, .data-table, [role='table']", timeout=10000)
        
        # Handle pagination if needed
        all_data = []
        while True:
            # Extract current page data
            page_data = extract_table_data(page)
            all_data.extend(page_data)
            
            # Check for next page
            next_button = page.query_selector("button:has-text('Next'), .pagination-next")
            if not next_button or not next_button.is_enabled():
                break
            
            next_button.click()
            page.wait_for_timeout(2000)  # Wait for page load
        
        browser.close()
        
        result = {'data': all_data}
        save_to_cache(cache_file, result)
        return result
```
**Cost:** 0 credits, 30-60 min setup time

**D. If Simple Pagination (<5 pages):**
```python
# Option 1: Manual (0 credits, 15-30 min)
# Copy/paste each page into spreadsheet
# Combine manually

# Option 2: Playwright (0 credits, if automating)
# Use Playwright script above
```
**Cost:** 0 credits, 15-60 min depending on method

**E. If Complex Pagination (10+ pages):**
```python
# Use Playwright (0 credits, best for automation)
# Use Playwright script with pagination handling
```
**Cost:** 0 credits, 30-60 min setup, then automated

**Tool Selection Summary:**
- **Direct download:** 0 credits, 0 setup ✅ Best
- **Playwright:** 0 credits, 30-60 min setup ✅ Good for JS/pagination
- **Firecrawl:** 1 credit, 0 setup ✅ Good for static pages
- **Manual:** 0 credits, time varies ✅ Good for small datasets

### 3.2 Inspect Raw Data Structure

**First Pass Questions:**
- [ ] How many columns?
- [ ] Column headers: [list all]
- [ ] Total rows: [approximate]
- [ ] Data from 2023? [Y/N, count if yes]
- [ ] Location data present? [Y/N, format?]
- [ ] Capacity data present? [Y/N, unit?]
- [ ] Date data present? [Y/N, format?]

**Save:** Raw file as `data/ercot/raw/ercot_queue_raw.[extension]`

---

## STEP 4: DATA QUALITY ASSESSMENT

### 4.1 Check for 2023 Data

**Filter for 2023 entries:**
```python
# Pseudo-code
filtered_2023 = [row for row in raw_data if row['year'] == 2023]
count_2023 = len(filtered_2023)

if count_2023 == 0:
    print("❌ STOP: No 2023 data found")
    # Check if data covers different timeframe
elif count_2023 < 10:
    print("⚠️ WARNING: Only {count_2023} entries from 2023")
    # Continue but note sparse data
else:
    print("✅ Found {count_2023} entries from 2023")
    # Continue
```

**Decision Point:**
- 0 rows → **STOP**, data doesn't cover timeframe
- 1-10 rows → **WARNING**, very sparse, consider alternate year
- 10+ rows → **CONTINUE**

### 4.2 Check Location Data Quality

**Examine location fields:**
```python
# Sample 5 random entries
sample_entries = random.sample(filtered_2023, min(5, len(filtered_2023)))

for entry in sample_entries:
    location = entry.get('location_field')
    print(f"Entry {entry['id']}: {location}")
    # Document:
    # - Format: county/city/coordinates/zone/blank
    # - Completeness: full/partial/missing
```

**Location Data Assessment:**
- County names → **GOOD**, can geocode to centroids
- City names → **GOOD**, can geocode
- Coordinates → **EXCELLENT**, no geocoding needed
- Utility zones only → **POOR**, may need manual mapping
- Blank/missing → **PROBLEM**, can't geocode

### 4.3 Check Capacity Data Quality

**Examine capacity field:**
```python
# Filter for entries ≥100 MW
large_projects = [
    row for row in filtered_2023 
    if parse_capacity(row['capacity']) >= 100
]

print(f"Projects ≥100 MW: {len(large_projects)}")

# Check data quality
capacity_stats = {
    'has_data': sum(1 for r in large_projects if r['capacity']),
    'numeric': sum(1 for r in large_projects if is_numeric(r['capacity'])),
    'unit_consistent': check_units(large_projects),
    'nulls': sum(1 for r in large_projects if not r['capacity'])
}
```

**Capacity Data Assessment:**
- Unit: [MW/KW/other?]
- Format: [numeric/text?]
- Nulls: [X%]
- Range: [min to max MW]

---

## STEP 5: IDENTIFY CRITICAL PROBLEMS

### 5.1 Missing Data Assessment

**For 2023 entries ≥100 MW:**
```python
critical_fields = ['location', 'capacity', 'date']
missing_stats = {}

for field in critical_fields:
    missing = sum(1 for r in large_projects if not r.get(field))
    missing_stats[field] = {
        'count': missing,
        'percent': (missing / len(large_projects)) * 100
    }

print("Missing Data Assessment:")
for field, stats in missing_stats.items():
    print(f"  {field}: {stats['count']} ({stats['percent']:.1f}%)")
```

**Decision Matrix:**
- >50% missing → **STOP**, need alternate source
- 20-50% missing → **WORKABLE**, need manual fill for missing
- <20% missing → **GOOD**, proceed

### 5.2 Data Format Issues

**Check for common problems:**
- [ ] Merged cells (Excel)
- [ ] Multiple tables in one file
- [ ] Headers in wrong row
- [ ] Summary rows mixed with data
- [ ] Date formats inconsistent
- [ ] Encoding issues (special characters)

**Document each issue found.**

---

## STEP 6: MANUAL VERIFICATION & SPOT CHECKING

### 6.0 Screenshot Documentation Strategy

**Purpose:** Create visual documentation for verification and debugging

**Screenshots to Take:**
1. **Source Page Screenshot**
   - Full page view
   - Save: `docs/screenshots/ercot_source_page.png`
   - Annotate: Highlight data table area

2. **Sample Entry Screenshot**
   - Zoom in on 2-3 sample entries
   - Save: `docs/screenshots/ercot_sample_entries.png`
   - Annotate: Label fields (ID, date, location, capacity)

3. **Filter/Export Options Screenshot**
   - Show available filters
   - Show export/download options
   - Save: `docs/screenshots/ercot_filters.png`

4. **Extracted Data Screenshot**
   - Show cleaned data in spreadsheet/viewer
   - Save: `docs/screenshots/ercot_extracted_data.png`
   - Compare with source screenshot

**Screenshot Tools:**
- Browser DevTools (F12 → Screenshot)
- macOS: Cmd+Shift+4 (select area)
- Playwright: `page.screenshot()` (if using automation)
- Manual: Print screen + crop

### 6.1 Manual Verification (Sample)

### 6.1 Pick 3 Random Entries from 2023

**For each entry, manually verify:**

**Entry #1:**
- Filing ID: [___]
- Date: [___]
- Location: [___]
- Capacity: [___]

**Verification Steps:**
1. **Screenshot source entry** (if web interface)
   - Save: `docs/screenshots/verification_entry_1_source.png`
   
2. Search ERCOT site for filing ID
   - Document search method used
   - Screenshot search results
   
3. Can you find source document? (Y/N)
   - If yes, screenshot the document
   - Save: `docs/screenshots/verification_entry_1_document.png`
   
4. Does data match? (Y/N)
   - Compare extracted data vs source
   - Document any discrepancies
   - Screenshot comparison if helpful
   
5. Source URL: [___]

**Repeat for Entry #2 and Entry #3**

**Create Verification Report:**
```markdown
## Verification Report

### Entry #1: [Filing ID]
- Source Screenshot: `docs/screenshots/verification_entry_1_source.png`
- Document Found: [Y/N]
- Document Screenshot: `docs/screenshots/verification_entry_1_document.png`
- Data Match: [Y/N]
- Discrepancies: [list any]
- Source URL: [___]

### Entry #2: [Filing ID]
[Same format]

### Entry #3: [Filing ID]
[Same format]

### Overall Confidence: [high/medium/low]
```

### 6.2 Verification Results

**Confidence Assessment:**
- 3/3 verified → **HIGH CONFIDENCE**
- 2/3 verified → **MEDIUM CONFIDENCE**
- 1/3 or 0/3 verified → **LOW CONFIDENCE**

**If LOW CONFIDENCE:**
- Investigate data source
- Check if there's a better source
- Consider manual collection for small dataset

---

## STEP 7: GEOCODING FEASIBILITY

### 7.1 Test Geocoding Methods

**Pick 5 entries with location data**

**For each entry:**
```python
location_string = entry['location']
geocode_result = geocode_location(location_string)

# Methods to try (in order):
# 1. County centroid lookup (free, fast)
# 2. City geocoding (free API or local)
# 3. Address parsing + geocoding
# 4. Manual lookup (if small dataset)
```

**Document:**
- Location string: [___]
- Method used: [county/city/address/manual]
- Result: [lat, lon]
- Confidence: [high/medium/low]

### 7.2 Geocoding Success Rate

**Decision:**
- 5/5 geocoded → **GOOD**, proceed
- 3-4/5 geocoded → **WORKABLE**, may need manual for some
- <3/5 geocoded → **PROBLEM**, need better method or abandon spatial analysis

---

## STEP 8: CLEAN DATA EXTRACTION

### 8.1 Extract Usable Fields

**Only extract what you can verify and geocode:**

```python
def extract_clean_data(raw_data):
    """Extract only verified, geocodable entries."""
    cleaned_data = []
    
    for row in raw_data:
        # Filter criteria
        if not (row['year'] == 2023 and row['capacity'] >= 100):
            continue
        
        # Check data completeness
        if not (row.get('location') and row.get('capacity') and row.get('date')):
            continue  # Skip incomplete entries
        
        # Attempt geocoding
        geocode_result = geocode_location(row['location'])
        if not geocode_result:
            continue  # Skip if can't geocode
        
        # Extract clean entry
        entry = {
            'filing_id': row['id_field'],
            'date': parse_date(row['date_field']),
            'location_raw': row['location_field'],
            'lat': geocode_result['lat'],
            'lon': geocode_result['lon'],
            'capacity_mw': parse_capacity(row['capacity_field']),
            'status': row['status_field'],
            'source_url': construct_source_url(row['filing_id']),
            'geocode_confidence': geocode_result['confidence']
        }
        cleaned_data.append(entry)
    
    return cleaned_data
```

### 8.2 Output Clean Dataset

**Save as:** `data/ercot/processed/ercot_filings_2023_clean.json`

**Include metadata:**
```json
{
  "metadata": {
    "extraction_date": "2025-12-10",
    "source": "https://www.ercot.com/services/comm/status",
    "source_type": "direct_download|firecrawl|manual",
    "firecrawl_credits_used": 0,
    "total_raw_rows": 1000,
    "filtered_2023_rows": 150,
    "filtered_large_projects": 45,
    "cleaned_rows": 38,
    "geocoded_rows": 35,
    "success_rate": "92.1%",
    "data_quality": {
      "location_precision": "county|city|coordinates",
      "date_precision": "exact|month|quarter",
      "capacity_precision": "exact|approximate"
    },
    "notes": "Any issues encountered"
  },
  "projects": [...]
}
```

---

## DECISION POINTS & STOP CONDITIONS

### After Step 1 (Source Discovery):
```
If free download found:
  → USE FREE SOURCE (0 credits)
  → Skip Firecrawl entirely
  → Proceed to Step 3

If only web interface:
  → Identify ONE high-value page
  → Use surgical Firecrawl (1 credit max)
  → Cache result
  → Proceed to Step 3

If paid access required:
  → STOP
  → Assess cost vs value
  → Document decision
```

### After Step 3 (Data Quality):
```
If <10 filings from 2023 with capacity ≥100 MW:
  → STOP
  → REPORT: "Insufficient data, only found [X] filings"
  → RECOMMEND: Try different geography or year
```

### After Step 5 (Missing Data):
```
If >50% of data missing critical fields:
  → STOP
  → REPORT: "Data quality too poor"
  → RECOMMEND: Need alternate source or manual collection
```

### After Step 6 (Verification):
```
If manual verification fails (0-1 of 3 verified):
  → STOP
  → REPORT: "Cannot verify data accuracy"
  → INVESTIGATE: Is there a better source?
```

### After Step 8 (Extraction):
```
If <5 clean, geocoded entries:
  → STOP
  → REPORT: "Cannot build sufficient dataset"
  → RECOMMEND: Try different approach

If 5-20 clean entries:
  → CONTINUE with caution
  → NOTE: Small sample size

If 20+ clean entries:
  → SUCCESS, proceed to Phase 2
```

---

## TOOL IMPLEMENTATION GUIDES

### Playwright Setup & Usage

**Installation:**
```bash
pip install playwright
playwright install chromium
```

**Basic Script Template:**
```python
from playwright.sync_api import sync_playwright
import json
from pathlib import Path

def scrape_ercot_with_playwright():
    """Scrape ERCOT queue using Playwright."""
    
    # Check cache
    cache_file = Path("data/ercot/raw/ercot_queue_playwright.json")
    if cache_file.exists():
        return json.load(cache_file)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        try:
            # Navigate
            page.goto("https://www.ercot.com/services/comm/status", wait_until="networkidle")
            
            # Take screenshot for documentation
            page.screenshot(path="docs/screenshots/ercot_playwright_page.png")
            
            # Wait for table to load
            page.wait_for_selector("table, .data-table", timeout=10000)
            
            # Extract table data
            table_data = page.evaluate("""
                () => {
                    const table = document.querySelector('table');
                    if (!table) return [];
                    
                    const rows = Array.from(table.querySelectorAll('tr'));
                    return rows.map(row => {
                        const cells = Array.from(row.querySelectorAll('td, th'));
                        return cells.map(cell => cell.textContent.trim());
                    });
                }
            """)
            
            # Handle pagination if needed
            all_data = []
            page_num = 1
            
            while True:
                # Extract current page
                current_data = extract_table_from_page(page)
                all_data.extend(current_data)
                
                # Check for next page
                next_btn = page.query_selector("button:has-text('Next'), .next-page")
                if not next_btn or 'disabled' in next_btn.get_attribute('class', ''):
                    break
                
                # Click next and wait
                next_btn.click()
                page.wait_for_timeout(2000)
                page_num += 1
                
                # Screenshot each page for verification
                page.screenshot(path=f"docs/screenshots/ercot_page_{page_num}.png")
            
            browser.close()
            
            result = {
                'source': 'playwright',
                'pages_scraped': page_num,
                'total_entries': len(all_data),
                'data': all_data
            }
            
            # Save to cache
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            with open(cache_file, 'w') as f:
                json.dump(result, f, indent=2)
            
            return result
            
        except Exception as e:
            browser.close()
            print(f"❌ Playwright error: {e}")
            # Fallback to manual or Firecrawl
            raise
```

**Advantages:**
- ✅ 0 credits
- ✅ Handles JavaScript
- ✅ Can automate pagination
- ✅ Screenshots for verification

**Disadvantages:**
- ⚠️ Requires setup (30-60 min)
- ⚠️ Slower than Firecrawl
- ⚠️ More complex code

### Selenium Setup & Usage

**Installation:**
```bash
pip install selenium
# Download ChromeDriver or use webdriver-manager
```

**Basic Script Template:**
```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def scrape_ercot_with_selenium():
    """Scrape ERCOT queue using Selenium."""
    
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    driver = webdriver.Chrome(options=options)
    
    try:
        driver.get("https://www.ercot.com/services/comm/status")
        
        # Wait for table
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "table"))
        )
        
        # Extract data
        table = driver.find_element(By.TAG_NAME, "table")
        rows = table.find_elements(By.TAG_NAME, "tr")
        
        data = []
        for row in rows:
            cells = row.find_elements(By.TAG_NAME, "td")
            data.append([cell.text for cell in cells])
        
        return data
        
    finally:
        driver.quit()
```

**Advantages:**
- ✅ 0 credits
- ✅ Handles JavaScript
- ✅ Widely used

**Disadvantages:**
- ⚠️ Heavier than Playwright
- ⚠️ Slower
- ⚠️ More setup complexity

### Manual Collection with Screenshots

**Process:**
1. **Navigate to page manually**
2. **Take screenshots:**
   - Full page
   - Table area
   - Sample entries
3. **Copy data:**
   - Select table → Copy
   - Paste into spreadsheet
4. **Document:**
   - Screenshot filenames
   - Date/time accessed
   - Any filters applied

**When to Use:**
- Small datasets (<20 entries)
- One-time extraction
- Verification/spot checking
- Documentation purposes

**Screenshot Organization:**
```
docs/screenshots/
├── ercot/
│   ├── source_page_full.png
│   ├── source_page_table.png
│   ├── sample_entries.png
│   ├── filters_applied.png
│   ├── verification_entry_1.png
│   └── extracted_data_preview.png
```

## FIREcRAWL USAGE (If Needed)

### When to Use Firecrawl

**Only use Firecrawl if:**
1. No free download available
2. Web interface is the only source
3. Data is in a single high-value page (table/list)

**Never use Firecrawl for:**
- Individual project pages (too expensive)
- Broad crawling
- Pages we can access manually

### Firecrawl Strategy

**Single Surgical Scrape:**
```python
# ONE call only (1 credit)
result = firecrawl_scrape(
    url="https://www.ercot.com/services/comm/status",  # Main table page
    formats=["markdown"]  # Good for tables
)

# Cache immediately
save_to_cache("data/ercot/raw/ercot_queue_cached.json", result)

# Parse locally (no more Firecrawl calls)
parsed_data = parse_markdown_table(result['data']['markdown'])
```

**Cost:** 1 credit total (vs 100+ credits for individual pages)

### Health Check Before Scraping

```python
# Before using Firecrawl, check API health
health = check_firecrawl_api_health()
if not health['healthy']:
    print("⚠️ Firecrawl API unhealthy, waiting...")
    time.sleep(30)
    # Retry or use manual method
```

---

## TOOL SELECTION DECISION TREE

```
START: Need to extract ERCOT queue data

├─ Has direct download/export? 
│  └─ YES → Use direct download (0 credits, 0 setup) ✅
│
├─ Is page static HTML (no JavaScript)?
│  └─ YES → Use Firecrawl (1 credit, 0 setup) ✅
│
├─ Does page require JavaScript?
│  ├─ Small dataset (<20 entries)?
│  │  └─ YES → Manual collection (0 credits, 15-30 min) ✅
│  │
│  ├─ Simple pagination (<5 pages)?
│  │  ├─ Option 1: Manual (0 credits, 15-30 min) ✅
│  │  └─ Option 2: Playwright (0 credits, 30-60 min setup) ✅
│  │
│  └─ Complex pagination (10+ pages)?
│     └─ Use Playwright (0 credits, 30-60 min setup) ✅
│
├─ Is data in PDF?
│  ├─ Tabular format?
│  │  └─ YES → Use Tabula (0 credits, 10 min setup) ✅
│  │
│  └─ Text/image format?
│     └─ Use Firecrawl extract (1 credit, narrow prompt) ✅
│
└─ Unknown/Complex?
   └─ Manual inspection + screenshots first
      → Then decide on tool
```

## EXPECTED PROBLEMS & SOLUTIONS

### Problem 1: ERCOT data is in PDF tables

**Solution Options:**
1. **Tabula (Free, Recommended)**
   - Extract tables from PDF
   - 0 credits, 10 min setup
   - May need cleanup

2. **Firecrawl Extract (If Tabula fails)**
   - Use `extract` endpoint with narrow prompt
   - 1 credit per PDF
   - Better for complex layouts

3. **Manual Extraction (Small datasets)**
   - Copy/paste for <20 entries
   - 0 credits, time cost

**Recommendation:** Try Tabula first, fallback to Firecrawl if needed

**Solution (Free):**
- Use Tabula (free, no credits)
- Or manual extraction for small datasets
- Only use Firecrawl extract if Tabula fails

**Firecrawl Cost:** 0 credits (use Tabula)

### Problem 2: Location data is just "ERCOT Zone North"

**Solution:**
- Can't geocode precisely
- May need to abandon spatial matching
- Or use zone centroids (approximate)

**Firecrawl Cost:** 0 credits (not a Firecrawl problem)

### Problem 3: Dates are text like "Q1 2023"

**Solution:**
- Convert to approximate date (Q1 = March 31)
- Flag as imprecise in metadata
- Use in analysis with caution

**Firecrawl Cost:** 0 credits (parsing issue)

### Problem 4: Multiple project types mixed

**Solution:**
- Filter to most relevant types
- Document what was excluded
- Keep filter criteria in metadata

**Firecrawl Cost:** 0 credits (filtering issue)

### Problem 5: File hasn't been updated since 2023

**Solution:**
- Use available data
- Note date limitation in metadata
- Adjust expectations

**Firecrawl Cost:** 0 credits (data freshness issue)

### Problem 6: Web interface requires pagination

**Solution Options:**
1. **Try "Show All" option first** (0 credits)
   - Look for "Show All" or "Export All" button
   - May reveal direct download

2. **Manual pagination** (<5 pages, 0 credits)
   - Copy/paste each page
   - Combine in spreadsheet
   - 15-30 min for 5 pages

3. **Playwright automation** (5+ pages, 0 credits)
   - Automate pagination clicks
   - Extract all pages
   - 30-60 min setup, then automated

4. **Firecrawl with batching** (if static pages, 1 credit/page)
   - Only if pages are static (no JS)
   - Batch scrape multiple pages
   - 10-50 credits for 10-50 pages
   - ⚠️ Expensive, prefer Playwright

**Recommendation:**
- <5 pages: Manual (fastest)
- 5-20 pages: Playwright (best automation)
- 20+ pages: Playwright (only scalable option)
- Static pages: Firecrawl (if Playwright unavailable)

**Firecrawl Cost:** 0-50 credits (avoid if possible, use Playwright)

### Problem 7: Page requires login/registration

**Solution:**
- Check if registration is free
- If free: Create account, then use Playwright with credentials
- If paid: Assess cost vs value
- Consider: Is there a public API alternative?

**Tool:** Playwright (can handle login flows)

**Cost:** 0 credits (Playwright), or account cost if paid

### Problem 8: Content loads dynamically (infinite scroll)

**Solution:**
- Use Playwright
- Scroll to bottom until no more content loads
- Extract all loaded content
- Screenshot at intervals for verification

**Tool:** Playwright (best for dynamic content)

**Cost:** 0 credits

---

## SCREENSHOT & DOCUMENTATION CHECKLIST

### Required Screenshots

**Discovery Phase:**
- [ ] Source page full screenshot
- [ ] Table/data area screenshot
- [ ] Filter/export options screenshot
- [ ] Sample entries close-up

**Extraction Phase:**
- [ ] Tool in action (if using Playwright/Selenium)
- [ ] Each paginated page (if pagination)
- [ ] Extracted data preview

**Verification Phase:**
- [ ] Source entry screenshot (for each verified entry)
- [ ] Source document screenshot (if found)
- [ ] Comparison screenshot (source vs extracted)

**Screenshot Organization:**
```
docs/screenshots/ercot/
├── discovery/
│   ├── source_page_full.png
│   ├── source_page_table.png
│   ├── filters_export.png
│   └── sample_entries.png
├── extraction/
│   ├── tool_in_action.png
│   ├── page_1.png
│   ├── page_2.png
│   └── extracted_preview.png
└── verification/
    ├── entry_1_source.png
    ├── entry_1_document.png
    ├── entry_2_source.png
    └── comparison.png
```

### Documentation Requirements

**Tool Selection Documentation:**
- [ ] Why this tool was chosen
- [ ] Alternatives considered
- [ ] Tradeoffs documented
- [ ] Setup time recorded
- [ ] Credits used (if Firecrawl)

**Process Documentation:**
- [ ] Steps taken
- [ ] Issues encountered
- [ ] Solutions applied
- [ ] Time spent per phase

## DELIVERABLE: ERCOT DATA ASSESSMENT REPORT

**Report Format:**
```markdown
# ERCOT Interconnection Queue Data Assessment

## Source Information
- **Source URL:** [exact URL]
- **Source Type:** [direct_download|playwright|selenium|firecrawl|manual|tabula]
- **Tool Used:** [tool name and version]
- **Date Accessed:** [date]
- **Firecrawl Credits Used:** [X] (if applicable)
- **Setup Time:** [X minutes]
- **Extraction Time:** [X minutes]
- **Screenshots:** [list screenshot files]

## Raw Data Summary
- **Total Rows:** [X]
- **Rows from 2023:** [Y]
- **File Format:** [CSV/Excel/PDF/HTML]
- **File Size:** [X MB]

## Filtering Criteria
- **Year:** 2023
- **Capacity:** ≥100 MW
- **Location Data Required:** Yes

## Results
- **Filtered Entries:** [Z]
- **Clean Entries Extracted:** [W]
- **Successfully Geocoded:** [V]
- **Success Rate:** [V/W]%

## Data Quality Assessment
- **Location Precision:** [county/city/coordinates/zone]
- **Date Precision:** [exact/month/quarter]
- **Capacity Precision:** [exact/approximate]
- **Missing Data:** [X% location, Y% capacity, Z% date]

## Sample Entries
[Show 3-5 example entries with all fields]

## Verification Results
- **Manual Verification:** [X/3 verified]
- **Confidence Level:** [high/medium/low]

## Issues Encountered
1. [Issue description]
2. [Issue description]

## Recommendations
- **Proceed:** [Y/N]
- **Next Steps:** [if proceed]
- **Alternatives:** [if stop]

## Cost Summary
- **Firecrawl Credits Used:** [X]
- **Time Spent:** [X hours]
- **Data Quality:** [high/medium/low]
```

---

## TIME ESTIMATE (Realistic)

**With Efficient Approach (Tool-Dependent):**

**If Direct Download Available:**
- Steps 1-2: 30-45 min (includes checking free sources)
- Step 3: 5-10 min (download and inspect)
- Step 4: 30-45 min
- Step 5: 15-30 min
- Step 6: 30-60 min (manual verification + screenshots)
- Step 7: 30-45 min
- Step 8: 30-60 min
- **Total: 3-4 hours**
- **Cost: 0 credits**

**If Playwright Needed:**
- Steps 1-2: 30-45 min
- Step 3: 30-60 min (Playwright setup + extraction)
- Step 4: 30-45 min
- Step 5: 15-30 min
- Step 6: 30-60 min (manual verification + screenshots)
- Step 7: 30-45 min
- Step 8: 30-60 min
- **Total: 4-5 hours** (includes setup time)
- **Cost: 0 credits**

**If Firecrawl Needed:**
- Steps 1-2: 30-45 min
- Step 3: 5-10 min (Firecrawl scrape)
- Step 4: 30-45 min
- Step 5: 15-30 min
- Step 6: 30-60 min (manual verification + screenshots)
- Step 7: 30-45 min
- Step 8: 30-60 min
- **Total: 3-4 hours**
- **Cost: 1 credit**

**If Manual Collection:**
- Steps 1-2: 30-45 min
- Step 3: 15-30 min (copy/paste)
- Step 4: 30-45 min
- Step 5: 15-30 min
- Step 6: 30-60 min (verification + screenshots)
- Step 7: 30-45 min
- Step 8: 30-60 min
- **Total: 3-4 hours**
- **Cost: 0 credits**

**Screenshot Time:** Add 10-15 min for documentation screenshots

**Total Range: 3-5 hours** (depending on tool and dataset size)

**Cost Range: 0-1 credits** (vs potentially 100+ with inefficient approach)

---

## KEY IMPROVEMENTS OVER ORIGINAL PLAN

### 1. **Tool Selection Strategy**
- **Free Sources First:** Direct downloads, APIs (0 credits)
- **Browser Automation:** Playwright/Selenium for JS pages (0 credits)
- **Firecrawl:** Only for static pages (1 credit)
- **Manual:** For verification and small datasets (0 credits)
- **Decision tree** to choose right tool

### 2. **Screenshot Documentation**
- Visual documentation at every step
- Screenshots for verification
- Comparison screenshots (source vs extracted)
- Organized screenshot directory structure

### 3. **Manual Verification Enhanced**
- Screenshot each verified entry
- Document verification process
- Create verification report with images
- Spot check strategy for quality assurance

### 4. **Playwright Integration**
- Full Playwright script templates
- Handles JavaScript and pagination
- Screenshot capability built-in
- 0 credits, handles dynamic content

### 5. **Cost Tracking**
- Track tool used (not just Firecrawl)
- Document setup time
- Track credits used (if Firecrawl)
- Include in metadata

### 6. **Better Decision Points**
- Tool selection decision tree
- Clear stop conditions
- Cost-aware decisions
- Alternative strategies documented

### 7. **Comprehensive Metadata**
- Track source type (download/playwright/firecrawl/manual)
- Document tool used
- Document credits used
- Include screenshot references
- Include data quality metrics

### 8. **Hybrid Approach**
- Combine tools strategically
- Manual for verification
- Automation for extraction
- Screenshots for documentation

---

## NEXT STEPS AFTER PHASE 1

**If Phase 1 Successful:**
1. Integrate clean data into map visualization
2. Join with spatial data (substations, transmission lines)
3. Perform spatial analysis (clustering, proximity)
4. Visualize on map with appropriate styling

**If Phase 1 Fails:**
1. Document failure reasons
2. Assess alternate data sources
3. Consider manual collection for small datasets
4. Adjust scope/expectations

---

## Related Documentation

- `docs/FIRECRAWL_EFFICIENT_USAGE.md` - General Firecrawl efficiency guide
- `docs/FIRECRAWL_AEP_OHIO_README.md` - AEP Ohio specific plan
- `docs/COLUMBUS_PREPROCESSING_ANALYSIS.md` - Spatial analysis approach

