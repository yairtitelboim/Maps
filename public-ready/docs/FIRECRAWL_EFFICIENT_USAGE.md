# Firecrawl Efficient & Cost-Effective Usage Guide

## Overview

This document outlines strategies for using Firecrawl API efficiently and cost-effectively, with a focus on minimizing credit usage while maximizing data value.

---

## Core Principles

### 1. **Surgical Scraping, Not Broad Crawling**

**❌ Don't:**
- Use `crawl` feature to crawl entire websites
- Scrape pages we don't need
- Re-scrape the same URLs

**✅ Do:**
- Use `scrape` or `extract` for **single, curated URLs**
- Pre-identify high-value pages manually
- Cache everything to avoid re-scraping

### 2. **Always Cache Results**

**Strategy:**
- Save raw Firecrawl responses to `data/firecrawl/raw/*.json`
- Save cleaned/structured data to `public/data/*.json`
- **Never re-scrape a URL** unless data has clearly changed
- Check cache before making any API call

**Implementation:**
```python
# Before scraping, check cache
cache_file = Path(f"data/firecrawl/raw/{url_hash}.json")
if cache_file.exists():
    print("📂 Using cached data")
    return json.load(cache_file)

# After scraping, save to cache
with open(cache_file, 'w') as f:
    json.dump(result, f)
```

### 3. **Prefer Free/Public Data Sources**

**Priority Order:**
1. **Public APIs/Exports** (free, no credits)
   - PJM XML exports (`projectCostUpgrades.xml`)
   - Government data portals
   - Public CSV/JSON downloads

2. **Firecrawl** (costs credits)
   - Only when no free source exists
   - For dynamic/paginated content
   - For PDF extraction

**Example:** We use PJM XML for transmission upgrades instead of Firecrawl scraping PDFs.

### 4. **Batch Processing with Safety Limits**

**Configuration:**
```python
BATCH_SIZE = 10                    # Process 10 URLs per batch
DELAY_BETWEEN_BATCHES = 2          # Wait 2 seconds between batches
MAX_CREDITS = 300                  # Hard limit (safety rail)
HEALTH_CHECK_INTERVAL = 5          # Check health every 5 batches
```

**Benefits:**
- Prevents runaway credit usage
- Allows progress tracking
- Enables resume capability

### 5. **Health Checks Before Major Batches**

**When to Check:**
- Before starting a large batch
- Every N batches (default: every 5)
- After errors or timeouts

**What to Check:**
- API response time
- Success rate
- Error patterns
- Credit balance (if available)

**Implementation:**
```python
def check_firecrawl_api_health() -> Dict:
    """Lightweight health check using simple test URL."""
    # Use example.com or similar lightweight page
    # Measure response time
    # Validate response structure
    # Return health status
```

### 6. **Retry Logic with Exponential Backoff**

**Strategy:**
- Max 3 retries per failed request
- Exponential backoff: 5s, 10s, 15s
- Don't retry on 4xx errors (client errors)
- Retry on 5xx errors and timeouts

**Implementation:**
```python
MAX_RETRIES = 3
RETRY_DELAY = 5  # Base delay in seconds

for attempt in range(MAX_RETRIES):
    try:
        result = scrape_url(url)
        return result
    except TimeoutError:
        if attempt < MAX_RETRIES - 1:
            time.sleep(RETRY_DELAY * (attempt + 1))
            continue
        raise
```

### 7. **Checkpointing for Resume Capability**

**Why:**
- Large batches may fail partway through
- Credits may run out mid-batch
- Network issues can interrupt

**How:**
- Save checkpoint after each batch
- Track: processed URLs, failed URLs, remaining URLs
- Resume from last checkpoint on restart

**Checkpoint Structure:**
```json
{
  "batch_number": 5,
  "timestamp": "2025-12-10T...",
  "processed_urls": [...],
  "failed_urls": [...],
  "remaining_urls": [...],
  "credits_used": 50
}
```

### 8. **Narrow, Focused Prompts**

**❌ Don't:**
- Ask for everything on the page
- Extract data we won't use
- Use vague prompts

**✅ Do:**
- Extract only fields needed for analysis
- Use specific field names
- Structure output as JSON arrays

**Example:**
```json
{
  "prompt": "Extract a JSON array of interconnection projects with fields: project_id, mw, status, county, substation_name, voltage_kv, lat, lng"
}
```

### 9. **Maximize Data Per Credit**

**Strategies:**
- Scrape **list/table pages** that show multiple items
- Use pagination if available (fewer credits than individual pages)
- Extract structured data from single pages with many rows

**Example:**
- ❌ 256 individual project pages = 256 credits
- ✅ 1 paginated table page = 1 credit (if pagination works)
- ✅ 1 list page with 50 projects = 1 credit for 50 projects

### 10. **Credit Budgeting & Safety Rails**

**Default Limits:**
```python
MAX_CREDITS = 300  # Hard stop before hitting limit
```

**Tracking:**
- Log every API call
- Track credits used per batch
- Stop before limit is reached
- Save checkpoint before stopping

**Usage Log:**
```json
{
  "url": "https://...",
  "timestamp": "...",
  "endpoint": "scrape",
  "status": "success",
  "credits_used": 1
}
```

---

## Implementation Patterns

### Pattern 1: Single High-Value Page Scrape

**Use Case:** Scraping a table/list page with many items

```python
def scrape_table_page(url: str) -> Dict:
    """Scrape a single page that contains a table/list."""
    # Check cache first
    cache_file = get_cache_path(url)
    if cache_file.exists():
        return load_from_cache(cache_file)
    
    # Scrape with markdown format (good for tables)
    result = firecrawl_scrape(url, formats=["markdown"])
    
    # Save to cache
    save_to_cache(cache_file, result)
    
    return result
```

### Pattern 2: Batch Scraping with Checkpoints

**Use Case:** Scraping many individual pages

```python
def batch_scrape_with_checkpoints(urls: List[str]):
    """Scrape URLs in batches with checkpointing."""
    # Load checkpoint if resuming
    checkpoint = load_checkpoint()
    start_from = checkpoint.get('last_batch', 0)
    
    credits_used = 0
    
    for batch_num, batch in enumerate(batch_urls(urls, BATCH_SIZE), start_from):
        # Check credit limit
        if credits_used >= MAX_CREDITS:
            save_checkpoint(batch_num, processed, failed, remaining)
            break
        
        # Health check every N batches
        if batch_num % HEALTH_CHECK_INTERVAL == 0:
            health = check_firecrawl_api_health()
            if not health['healthy']:
                wait_and_retry()
        
        # Process batch
        results = []
        for url in batch:
            result = scrape_with_retry(url)
            if result:
                results.append(result)
                credits_used += 1
        
        # Save checkpoint
        save_checkpoint(batch_num, results, failed, remaining)
        
        # Delay between batches
        time.sleep(DELAY_BETWEEN_BATCHES)
```

### Pattern 3: Extract from PDFs

**Use Case:** Extracting structured data from PDFs

```python
def extract_from_pdf(pdf_url: str, prompt: str) -> Dict:
    """Extract structured data from PDF using extract endpoint."""
    # Check cache
    cache_file = get_cache_path(pdf_url)
    if cache_file.exists():
        return load_from_cache(cache_file)
    
    # Use extract endpoint with specific prompt
    result = firecrawl_extract(
        url=pdf_url,
        prompt=prompt  # Narrow, specific prompt
    )
    
    # Save to cache
    save_to_cache(cache_file, result)
    
    return result
```

---

## Cost Optimization Strategies

### Strategy 1: URL Curation Before Scraping

**Before using Firecrawl:**
1. Manually identify target URLs
2. Verify they contain needed data
3. Check if free alternative exists
4. Prioritize by data value

**Example:**
- ✅ Curate 10 high-value URLs = 10 credits
- ❌ Crawl entire site = 100+ credits

### Strategy 2: Use Test Mode First

**Always test with small batches:**
```bash
# Test with 3 URLs first
python3 batch_scrape_projects.py --test 3

# If successful, run full batch
python3 batch_scrape_projects.py
```

### Strategy 3: Prefer Pagination Over Individual Pages

**If pagination is available:**
- Scrape paginated list pages (1 credit per page)
- Parse all items from each page
- Much cheaper than individual page scraping

**Example:**
- Individual pages: 256 credits for 256 projects
- Paginated: ~26 credits for 256 projects (if 10 per page)

### Strategy 4: Cache Aggressively

**Cache everything:**
- Raw Firecrawl responses
- Parsed/cleaned data
- Intermediate processing results

**Never re-scrape:**
- Check cache before every API call
- Use cache if data is recent enough
- Only re-scrape if data source has changed

### Strategy 5: Credit Limit Protection

**Always set limits:**
```python
MAX_CREDITS = 300  # Adjust based on budget
```

**Stop before limit:**
- Check credits used after each batch
- Save checkpoint before stopping
- Resume later with remaining credits

---

## Health Check Strategy

### When to Run Health Checks

1. **Before starting large batches**
2. **Every N batches** (default: every 5)
3. **After errors or timeouts**
4. **Before resuming from checkpoint**

### What Health Checks Do

1. **API Connectivity:** Verify API is reachable
2. **Response Time:** Measure latency
3. **Success Rate:** Track recent success/failure
4. **Error Patterns:** Detect recurring issues

### Health Check Implementation

```python
def check_firecrawl_api_health() -> Dict:
    """Lightweight health check."""
    # Use simple test URL (example.com)
    # Measure response time
    # Validate response structure
    # Return health status with metrics
```

### Behavior on Health Check Failure

- Log warning
- Wait 30 seconds
- Continue processing (don't stop)
- Log to health check file for monitoring

---

## Error Handling & Retry Logic

### Retry Strategy

**Retry on:**
- Network timeouts
- 5xx server errors
- Rate limit errors (429)

**Don't retry on:**
- 4xx client errors (404, 403, etc.)
- Invalid API key errors
- Malformed request errors

### Exponential Backoff

```python
MAX_RETRIES = 3
BASE_DELAY = 5  # seconds

for attempt in range(MAX_RETRIES):
    try:
        return scrape_url(url)
    except RetryableError:
        if attempt < MAX_RETRIES - 1:
            delay = BASE_DELAY * (2 ** attempt)  # 5s, 10s, 20s
            time.sleep(delay)
            continue
        raise
```

---

## Monitoring & Logging

### What to Log

1. **Every API call:**
   - URL
   - Timestamp
   - Endpoint used
   - Success/failure
   - Credits used

2. **Health checks:**
   - Response time
   - Status
   - Errors

3. **Batch progress:**
   - Batch number
   - URLs processed
   - Success rate
   - Credits remaining

### Log Files

```
data/interconnection_fyi/
├── checkpoints/
│   ├── checkpoint_batch_001.json
│   ├── checkpoint_batch_002.json
│   └── health_checks.jsonl
└── raw/
    ├── batch_001.json
    └── batch_002.json
```

---

## Best Practices Summary

### ✅ Do

1. **Cache everything** - Never re-scrape
2. **Use free sources first** - Prefer APIs/exports over Firecrawl
3. **Set credit limits** - Hard stop before budget
4. **Batch process** - Group requests efficiently
5. **Health check regularly** - Monitor API status
6. **Checkpoint progress** - Enable resume capability
7. **Retry with backoff** - Handle transient failures
8. **Narrow prompts** - Extract only what's needed
9. **Test small first** - Validate before large batches
10. **Log everything** - Track usage and errors

### ❌ Don't

1. **Don't crawl broadly** - Use surgical scraping
2. **Don't skip caching** - Always check cache first
3. **Don't ignore free sources** - Check for APIs/exports
4. **Don't exceed credit limits** - Set and respect limits
5. **Don't skip health checks** - Monitor API health
6. **Don't lose progress** - Use checkpointing
7. **Don't retry forever** - Set max retries
8. **Don't extract everything** - Use narrow prompts
9. **Don't skip testing** - Test with small batches first
10. **Don't skip logging** - Track all usage

---

## Example Workflow

### Step 1: Manual URL Curation
```bash
# Identify target URLs manually
# Document in docs/FIRECRAWL_TARGET_URLS.md
```

### Step 2: Check for Free Alternatives
```bash
# Check if data is available via:
# - Public APIs
# - XML/CSV exports
# - Government data portals
```

### Step 3: Test with Small Batch
```bash
python3 batch_scrape_projects.py --test 3
```

### Step 4: Review Results
```bash
# Check data quality
# Verify fields extracted correctly
# Adjust prompts if needed
```

### Step 5: Run Full Batch (if test successful)
```bash
python3 batch_scrape_projects.py --max-credits 300
```

### Step 6: Monitor Progress
```bash
# Watch checkpoint files
# Monitor health check logs
# Track credit usage
```

### Step 7: Resume if Interrupted
```bash
python3 batch_scrape_projects.py --resume
```

---

## Cost Estimation Examples

### Example 1: Interconnection Queue (256 projects)

**Option A: Individual Pages**
- 256 pages × 1 credit = **256 credits**

**Option B: Paginated Table (if available)**
- ~26 pages × 1 credit = **26 credits** (90% savings!)

**Option C: Pattern Discovery + Targeted Scraping**
- Discover IDs via pattern testing (free)
- Scrape only discovered IDs = **83 credits** (68% savings)

### Example 2: Transmission Upgrades

**Option A: Firecrawl PDFs**
- 10 PDFs × 1 credit = **10 credits**

**Option B: PJM XML Export (free)**
- Download XML (free)
- Parse locally (free)
- **0 credits** (100% savings!)

### Example 3: County Land Transactions

**Option A: Individual Parcel Pages**
- 1000 parcels × 1 credit = **1000 credits** ❌

**Option B: Search Result Pages**
- 10 result pages × 1 credit = **10 credits** ✅
- Extract all parcels from each page

---

## Tools & Scripts

### Available Scripts

1. **`scripts/interconnection_fyi/batch_scrape_projects.py`**
   - Batch scraping with health checks
   - Checkpointing and resume
   - Credit limit protection

2. **`scripts/interconnection_fyi/health_check.py`**
   - API health monitoring
   - Response time tracking
   - Health check logging

3. **`scripts/interconnection_fyi/project_id_discovery.py`**
   - Pattern-based ID discovery
   - Reduces need for Firecrawl

### Usage Examples

```bash
# Test mode (3 projects)
python3 scripts/interconnection_fyi/batch_scrape_projects.py --test 3

# Full run with custom limits
python3 scripts/interconnection_fyi/batch_scrape_projects.py \
  --batch-size 10 \
  --max-credits 300

# Resume from checkpoint
python3 scripts/interconnection_fyi/batch_scrape_projects.py --resume
```

---

## Key Takeaways

1. **Credits are limited** - Use them surgically, not broadly
2. **Cache everything** - Never re-scrape the same URL
3. **Prefer free sources** - Use APIs/exports when available
4. **Set hard limits** - Stop before hitting credit limits
5. **Monitor health** - Check API status regularly
6. **Enable resume** - Use checkpointing for large batches
7. **Test first** - Validate with small batches
8. **Log everything** - Track usage and errors
9. **Maximize value** - Get multiple items per credit when possible
10. **Narrow focus** - Extract only what you need

---

## Related Documentation

- `docs/FIRECRAWL_AEP_OHIO_README.md` - AEP Ohio specific Firecrawl plan
- `docs/BATCH_SCRAPER_IMPLEMENTATION.md` - Batch scraper implementation details
- `docs/INTERCONNECTION_FYI_FULL_DATASET_PLAN.md` - Full dataset extraction plan

