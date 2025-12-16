# Interconnection.fyi Full Dataset Plan (256 Projects)

## Objective
Extract all 256 Ohio interconnection queue projects from interconnection.fyi with batching, health checks, and full map integration.

## Current Status
- ✅ Parser implemented and tested
- ✅ Extracted 11-12 projects from single Firecrawl scrape (first page only)
- ❌ Need remaining ~244 projects

---

## Strategy Options

### Option 1: Individual Project Page Scraping (Recommended)
**Approach:** Scrape each project's detail page individually
- **URL Pattern:** `https://www.interconnection.fyi/project/{project_id}`
- **Advantage:** Each page has complete project data
- **Disadvantage:** 256 API calls (costs credits)
- **Health Check:** Validate each response before proceeding

### Option 2: Airtable API Direct Access
**Approach:** Access underlying Airtable embed if exposed
- **Check:** Inspect network requests on interconnection.fyi page
- **Advantage:** Single API call for all data
- **Disadvantage:** May not be publicly accessible

### Option 3: Pagination Scraping
**Approach:** Scrape multiple pages of the table
- **Check:** If interconnection.fyi supports URL parameters for pagination
- **Advantage:** Fewer calls than individual pages
- **Disadvantage:** May not be supported

### Option 4: Firecrawl Crawl Feature
**Approach:** Use Firecrawl's crawl to follow pagination links
- **Advantage:** Automatic pagination handling
- **Disadvantage:** May not work with embedded Airtable

---

## Recommended Implementation: Option 1 (Individual Pages)

### Phase 1: Discover All Project IDs

**Step 1.1: Extract Project IDs from Current Scrape**
- Parse existing Firecrawl output for all project IDs
- Extract from URLs: `pjm-aj1-023`, `pjm-ai2-451`, etc.

**Step 1.2: Find Additional Project IDs**
- Check if interconnection.fyi has a project listing page
- Try: `https://www.interconnection.fyi/projects?state=OH`
- Extract all project IDs from listing

**Step 1.3: Generate Project URL List**
```python
project_ids = [
    "pjm-aj1-023",
    "pjm-aj1-008",
    "pjm-ai2-451",
    # ... 256 total
]

project_urls = [
    f"https://www.interconnection.fyi/project/{project_id}"
    for project_id in project_ids
]
```

---

### Phase 2: Batch Scraping with Health Checks

**Step 2.1: Batch Configuration**
```python
BATCH_SIZE = 10  # Process 10 projects per batch
DELAY_BETWEEN_BATCHES = 2  # seconds
MAX_RETRIES = 3
HEALTH_CHECK_INTERVAL = 5  # Check health every 5 batches
```

**Step 2.2: Health Check Function**
```python
def health_check(api_key: str) -> bool:
    """Verify Firecrawl API is responding."""
    # Make a lightweight test call
    # Check response status, rate limits, credit balance
    pass

def validate_scrape_result(result: dict) -> bool:
    """Validate that scrape result contains expected data."""
    required_fields = ['data', 'markdown']
    return all(field in result for field in required_fields)
```

**Step 2.3: Batch Processing Loop**
```python
def scrape_projects_in_batches(project_urls: List[str]) -> List[Dict]:
    all_projects = []
    failed_urls = []
    
    for batch_start in range(0, len(project_urls), BATCH_SIZE):
        batch = project_urls[batch_start:batch_start + BATCH_SIZE]
        batch_num = (batch_start // BATCH_SIZE) + 1
        
        # Health check every N batches
        if batch_num % HEALTH_CHECK_INTERVAL == 0:
            if not health_check(FIRECRAWL_API_KEY):
                print(f"⚠️  Health check failed at batch {batch_num}")
                time.sleep(30)  # Wait before retry
        
        print(f"\n📦 Batch {batch_num}: Processing {len(batch)} projects...")
        
        for url in batch:
            project_data = scrape_with_retry(url, max_retries=MAX_RETRIES)
            if project_data:
                all_projects.append(project_data)
            else:
                failed_urls.append(url)
        
        # Delay between batches
        if batch_start + BATCH_SIZE < len(project_urls):
            time.sleep(DELAY_BETWEEN_BATCHES)
    
    return all_projects, failed_urls
```

---

### Phase 3: Enhanced Parser for Individual Pages

**Step 3.1: Parse Individual Project Page**
Individual project pages may have more detailed data:
- Exact capacity (not just range)
- Developer name
- Interconnection point details
- Status history
- Network upgrade costs

**Step 3.2: Update Parser**
```python
def parse_individual_project_page(markdown: str, html: str) -> Dict:
    """Parse a single project detail page."""
    project = {}
    
    # Extract from structured sections
    # - Project name
    # - Developer
    # - Exact capacity
    # - Interconnection point
    # - Status timeline
    # - Network upgrades
    
    return project
```

---

### Phase 4: Data Merging and Deduplication

**Step 4.1: Merge Results**
- Combine data from initial scrape with individual page scrapes
- Handle duplicates (same project_id)

**Step 4.2: Enrichment**
- Geocode counties (already implemented)
- Calculate distances (already implemented)
- Add substation proximity (to be implemented)

---

### Phase 5: Map Integration

**Step 5.1: Load GeoJSON into OSMCall.jsx**
```javascript
// In OSMCall.jsx
const loadInterconnectionRequests = async () => {
  const response = await fetch('/data/aep_ohio_interconnection_requests.geojson');
  const geojson = await response.json();
  
  // Add as Mapbox layer
  map.addSource('aep-ohio-interconnection-requests', {
    type: 'geojson',
    data: geojson
  });
  
  // Add circle layer
  map.addLayer({
    id: 'aep-ohio-interconnection-points',
    type: 'circle',
    source: 'aep-ohio-interconnection-requests',
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        6, 3,
        10, 6,
        14, 10
      ],
      'circle-color': [
        'match',
        ['get', 'generation_type'],
        'solar', '#fbbf24',      // yellow
        'wind', '#60a5fa',       // blue
        'battery', '#a78bfa',    // purple
        'gas', '#f87171',        // red
        '#9ca3af'                // gray (default)
      ],
      'circle-opacity': 0.7,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#000000'
    }
  });
};
```

**Step 5.2: Add Popups**
- Show project details on click
- Display capacity, status, county, generation type

**Step 5.3: Add to Legend**
- Add interconnection requests layer to legend
- Group by generation type
- Filter by status, county, capacity range

---

## Implementation Steps

### Step 1: Create Batch Scraper Script
**File:** `scripts/interconnection_fyi/batch_scrape_projects.py`

**Features:**
- Load project IDs from initial scrape
- Discover additional project IDs (if possible)
- Batch scraping with health checks
- Retry logic for failed requests
- Progress tracking and logging
- Save intermediate results

### Step 2: Create Individual Page Parser
**File:** `scripts/interconnection_fyi/parse_individual_project.py`

**Features:**
- Parse detailed project page markdown/HTML
- Extract all available fields
- Handle missing data gracefully

### Step 3: Create Merger Script
**File:** `scripts/interconnection_fyi/merge_project_data.py`

**Features:**
- Merge initial scrape + individual pages
- Deduplicate by project_id
- Resolve conflicts (prefer individual page data)
- Generate final JSON and GeoJSON

### Step 4: Update Map Integration
**File:** `src/components/Map/components/Cards/OSMCall.jsx`

**Features:**
- Load full dataset GeoJSON
- Display as map layer
- Add popups with project details
- Integrate with legend

---

## Health Check Strategy

### 1. API Health Check
```python
def check_firecrawl_api_health() -> Dict:
    """Check Firecrawl API status."""
    # Make lightweight test call
    # Check:
    # - Response time
    # - Success rate
    # - Rate limit status
    # - Credit balance (if available)
    pass
```

### 2. Data Quality Check
```python
def validate_batch_results(results: List[Dict]) -> Dict:
    """Validate batch scraping results."""
    stats = {
        'total': len(results),
        'valid': 0,
        'invalid': 0,
        'missing_fields': []
    }
    
    for result in results:
        if validate_scrape_result(result):
            stats['valid'] += 1
        else:
            stats['invalid'] += 1
    
    return stats
```

### 3. Rate Limit Monitoring
```python
def monitor_rate_limits():
    """Monitor and respect rate limits."""
    # Track requests per minute
    # Add delays if approaching limits
    # Log warnings
    pass
```

---

## Cost Estimation

**Firecrawl Credits:**
- Individual project pages: 256 calls × 1 credit = 256 credits
- Health checks: ~25 calls × 1 credit = 25 credits
- **Total: ~281 credits**

**Alternative (if pagination works):**
- Paginated pages: ~26 pages × 1 credit = 26 credits
- **Total: ~26 credits** (much cheaper!)

---

## Risk Mitigation

### 1. Credit Limit Protection
- Set maximum credit budget (e.g., 300 credits)
- Stop if approaching limit
- Save progress before stopping

### 2. Rate Limit Protection
- Add delays between batches
- Monitor request rate
- Implement exponential backoff

### 3. Data Loss Protection
- Save results after each batch
- Create checkpoint files
- Resume from last checkpoint if interrupted

### 4. Error Handling
- Retry failed requests (max 3 attempts)
- Log all failures for manual review
- Continue processing even if some fail

---

## File Structure

```
scripts/interconnection_fyi/
  batch_scrape_projects.py          # Main batch scraper
  parse_individual_project.py       # Individual page parser
  merge_project_data.py             # Data merger
  health_check.py                   # Health check utilities
  project_id_discovery.py           # Find all project IDs

data/interconnection_fyi/
  raw/
    batch_001.json                  # Batch 1 results
    batch_002.json                  # Batch 2 results
    ...
  checkpoints/
    checkpoint_batch_010.json       # Resume point
  discovered_project_ids.json      # All discovered IDs
  merged_projects.json              # Final merged data

public/data/
  aep_ohio_interconnection_requests.geojson  # Final GeoJSON
```

---

## Execution Plan

### Phase 1: Discovery (Low Cost)
1. Extract project IDs from existing scrape
2. Try to find project listing page
3. Generate complete project ID list
4. **Cost: ~1-2 credits**

### Phase 2: Test Batch (Validation)
1. Scrape 10 test projects
2. Validate parser works on individual pages
3. Check data quality
4. **Cost: 10 credits**

### Phase 3: Full Batch Scraping
1. Scrape remaining projects in batches
2. Health checks every 5 batches
3. Save checkpoints
4. **Cost: ~245 credits**

### Phase 4: Merging and Integration
1. Merge all results
2. Generate final JSON/GeoJSON
3. Integrate into map
4. **Cost: 0 credits (local processing)**

---

## Next Steps

1. ✅ **Create batch scraper script** with health checks
2. ✅ **Test on 10 projects** to validate approach
3. ✅ **Discover all project IDs** (if possible, reduce cost)
4. ✅ **Run full batch scraping** with monitoring
5. ✅ **Merge and integrate** into map

---

## Questions to Resolve

1. **Can we discover all 256 project IDs without scraping each page?**
   - Check if interconnection.fyi has a listing/export
   - Inspect network requests for Airtable API calls

2. **Do individual project pages have more data?**
   - Test a few pages to see what's available
   - Compare with initial scrape data

3. **Is pagination supported?**
   - Check URL parameters
   - Try Firecrawl crawl feature

4. **What's the actual credit budget?**
   - Confirm available credits
   - Set safety limit

