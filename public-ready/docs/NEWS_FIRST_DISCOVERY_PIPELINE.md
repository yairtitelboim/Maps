# News-First Data Center Discovery Pipeline

## Overview

This document outlines a **news-first discovery pipeline** for tracking data center projects, particularly in Texas/ERCOT territory. This approach prioritizes **realistic engineering practices** over perfect data, acknowledging that news sources are messy but valuable for early-stage project discovery before formal interconnection filings.

**Philosophy:** Start cheap & fast, upgrade only if it works. Treat news as probabilistic signals, not clean data.

**Target Use Case:** Discover Texas data center projects announced in news before they appear in ERCOT interconnection queues, enabling early tracking and analysis.

**MVP Success Criteria:** Produce 10–30 Texas project cards with evidence links and a map dot at city/county resolution—no ERCOT required.

---

## API Keys & Requirements

### ✅ **No API Keys Required (MVP - Free Path)**

You can run the entire MVP pipeline **without any API keys**:

1. **Google News RSS** - Free, no key needed
   - Direct RSS feed access
   - No authentication required
   - Rate limits: ~100 requests/day (informal)

2. **Nominatim Geocoding** - Free, no key needed
   - OpenStreetMap geocoding service
   - Rate limit: 1 request/second (enforced)
   - Usage policy: Must cache results, don't abuse

3. **Text Extraction** - Free libraries
   - `readability-lxml` - No API needed
   - `newspaper3k` - No API needed
   - Works offline on fetched HTML

4. **SQLite Database** - Local file, no API

**Total Cost: $0**

---

### 🔑 **Optional API Keys (For Better Performance)**

These are **optional upgrades** - only add if you hit limits or need better reliability:

1. **SerpAPI** ✅ **You have this key**
   - **Status:** Key available in `.env.local` (`SERP_API_KEY`)
   - **When to use:** More reliable than Google News RSS, better metadata
   - **Cost:** ~$50/month for 5,000 searches (check your plan)
   - **Usage:** Use SerpAPI instead of RSS for more stable results
   - **Config:** Load from `SERP_API_KEY` environment variable

2. **Mapbox Geocoding** (Optional - Free tier available)
   - **When to use:** If you already use Mapbox for maps
   - **Free tier:** 100,000 requests/month
   - **Get key:** https://account.mapbox.com/
   - **Usage:** Better than Nominatim for production

3. **GDELT API** (Optional - Free tier)
   - **When to use:** If you need global/historical news
   - **Free tier:** Limited requests
   - **Get key:** https://www.gdeltproject.org/
   - **Usage:** Alternative news source

**Recommendation:** Since you have SerpAPI, you can use it from the start for more reliable results. RSS is still fine for testing/prototyping.

---

## Executive Summary

### Approach
- **Phase A:** Ingest news articles via RSS/Search APIs
- **Phase B:** Normalize and deduplicate articles into "mentions"
- **Phase C:** Classify articles (Project Announcement vs Context vs Noise)
- **Phase D:** Extract structured "Project Cards" (probabilistic fields)
- **Phase E:** Entity resolution (merge multiple articles into one project)
- **Phase F:** Track "Alive vs Dead" status signals
- **Phase G:** Output products (map layer, timeline, CSV export)

### Key Principles
1. **Incremental Development:** Start with Texas-only, 10-30 projects
2. **Probabilistic Data:** Many fields will be null - that's expected
3. **Rules First, LLM Later:** Use regex/rules for classification initially
4. **Human Review Queue:** Keep merge suggestions for manual confirmation
5. **Realistic Expectations:** Full-text extraction will fail often (paywalls)

---

## Architecture Overview

### Data Flow

```
News Sources (RSS/Search API)
    ↓
Phase A: Ingest (collect articles)
    ↓
Phase B: Normalize + Deduplicate (create mentions)
    ↓
Phase C: Classify (Project Announcement / Context / Noise)
    ↓
Phase D: Extract Project Cards (structured fields)
    ↓
Phase E: Entity Resolution (merge articles → projects)
    ↓
Phase F: Status Tracking (alive vs dead signals)
    ↓
Phase G: Output Products (map, timeline, CSV)
```

### Technology Stack (MVP)

- **Ingest:** RSS fetcher (Python/Node cron job)
- **Store:** SQLite (upgrade to Postgres later)
- **Extract Text:** `readability-lxml` / `newspaper3k` (variable hit rate)
- **Classify:** Rules/regex first, LLM classifier later
- **Geocode:** Mapbox Geocoding API (if available) or Nominatim with caching (city-level initially)
- **UI:** Existing Mapbox map + filters

---

## Phase 0: Define Query Set (One-Time Setup)

### Objective
Create a reusable set of query templates for recurring searches.

### Query Templates

**Core Queries (Google-style, not boolean):**
```python
QUERY_TEMPLATES = [
    '"data center" Texas ERCOT',
    '"hyperscale" Texas',
    '"AI data center" Texas substation power megawatts',
    '"data center campus" Texas permit zoning abatement',
    '"cloud facility" Texas',
    '"server farm" Texas',
    '"compute campus" Texas',
]
```

**Company-Specific Queries:**
```python
COMPANY_QUERIES = [
    'Amazon "data center" Texas',
    'Google "data center" Texas',
    'Microsoft "data center" Texas',
    'Meta "data center" Texas',
    'Oracle "data center" Texas',
    'CoreWeave "data center" Texas',
    'Digital Realty Texas',
    'QTS Texas',
    'Switch Texas',
    'Aligned Texas',
]
```

**Negative Filters (separate tokens):**
```python
NEGATIVE_FILTERS = [
    '-jobs',
    '-hiring',
    '-colocation pricing',
    '-bitcoin',
    '-crypto mining',
    '-edge data center',  # Tune based on results
]
```

### Configuration File Structure

**File:** `config/news_queries.json`
```json
{
  "core_queries": [
    {
      "query": "\"data center\" Texas ERCOT",
      "region": "Texas",
      "enabled": true
    }
  ],
  "company_queries": [
    {
      "company": "Amazon",
      "query": "Amazon \"data center\" Texas",
      "enabled": true
    }
  ],
  "negative_filters": [
    "-jobs",
    "-hiring"
  ],
  "update_frequency_hours": 24
}
```

**Output:** Query configuration file ready for Phase A

---

## Phase A: Ingest (Collect Candidate Articles)

### Objective
Collect news articles from various sources using automated queries.

### Option 1: Google News RSS (Cheap & Fast)

**Pros:**
- Free (no API key)
- Fast to prototype
- RSS format is simple

**Cons:**
- Throttling risk
- Inconsistent metadata
- Sometimes missing full text
- Not officially supported (can break)

**Implementation:**

**File:** `scripts/news-ingest/google_news_rss.py`
```python
from typing import List, Dict
import feedparser
from datetime import datetime

def fetch_google_news_rss(query: str) -> List[Dict]:
    """
    Fetch Google News RSS feed for a query.
    
    IMPORTANT: Only fetches metadata (title, link, snippet). Full text
    extraction happens in a separate job after classification.
    
    Args:
        query: Search query string (Google-style, not boolean)
    
    Returns:
        List of article dictionaries (metadata only)
    """
    # Google News RSS format
    url = f"https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"
    
    feed = feedparser.parse(url)
    articles = []
    
    for entry in feed.entries:
        # Extract source safely (varies across feeds)
        source_title = ""
        if hasattr(entry, "source"):
            if isinstance(entry.source, dict):
                source_title = entry.source.get("title", "")
            elif hasattr(entry.source, "title"):
                source_title = entry.source.title
        
        article = {
            "title": entry.get("title", ""),
            "link": entry.get("link", ""),
            "published": entry.get("published", ""),
            "source": source_title,
            "snippet": entry.get("summary", ""),
            "query_matched": query,
            "ingested_at": datetime.utcnow().isoformat(),
            "raw_text": None,  # Fetched later in content extraction job
        }
        
        articles.append(article)
    
    return articles
```

**Scheduling:**
- Run daily via cron job or scheduled task
- Store results in SQLite database (metadata only)
- Full text extraction happens in separate job (see Phase C)

**Separate Content Fetch Job:**
```python
# scripts/news-ingest/fetch_content.py
# Run this AFTER classification, only for likely announcements
def fetch_full_text_batch(mention_ids: List[str], rate_limit: int = 10):
    """
    Fetch full text for mentions that passed classification.
    Rate limited to avoid blocking.
    """
    # Only fetch for mentions classified as "project_announcement"
    # Use caching to avoid re-fetching
    pass
```

---

### Option 2: SerpAPI / Search API (Paid, More Robust)

**Pros:**
- Stable JSON responses
- Better metadata (dates, sources)
- Easier deduplication
- More reliable

**Cons:**
- Costs money (check pricing)
- API rate limits
- Terms of service apply

**Implementation:**

**File:** `scripts/news-ingest/serpapi_news.py`
```python
from typing import List, Dict
from serpapi import GoogleSearch
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

def fetch_serpapi_news(query: str, api_key: str = None) -> List[Dict]:
    """
    Fetch news articles via SerpAPI.
    
    Args:
        query: Search query string (Google-style)
        api_key: SerpAPI key (defaults to SERP_API_KEY env var)
    
    Returns:
        List of article dictionaries (metadata only)
    """
    # Get API key from env if not provided
    if api_key is None:
        api_key = os.getenv('SERP_API_KEY')
        if not api_key:
            raise ValueError("SERP_API_KEY not found in environment variables")
    
    params = {
        "q": query,
        "tbm": "nws",  # News search
        "api_key": api_key,
        "num": 100,  # Max results
        "hl": "en",
        "gl": "us"
    }
    
    search = GoogleSearch(params)
    results = search.get_dict()
    
    articles = []
    for result in results.get("news_results", []):
        article = {
            "title": result.get("title", ""),
            "link": result.get("link", ""),
            "source": result.get("source", ""),
            "published": result.get("date", ""),
            "snippet": result.get("snippet", ""),
            "query_matched": query,
            "ingested_at": datetime.utcnow().isoformat(),
            "raw_text": None,  # Fetched later in content extraction job
        }
        articles.append(article)
    
    return articles

# Usage example:
# articles = fetch_serpapi_news('Amazon "data center" Texas')
# No need to pass api_key if SERP_API_KEY is in .env.local
```

**Recommendation:** Start with RSS (Option 1), upgrade to SerpAPI if RSS proves too brittle.

---

### Option 3: GDELT 2.1 (Robust + Free-ish)

**Pros:**
- Programmatic access
- Global coverage
- Long historical data
- Free tier available

**Cons:**
- Noisier data
- Requires more filtering
- Not "Google-quality" relevance

**When to Use:** Only if you need global scale or historical analysis.

**Implementation:** See GDELT API docs: https://www.gdeltproject.org/

---

### Data Storage Schema

**File:** `scripts/news-ingest/schema.sql`
```sql
CREATE TABLE IF NOT EXISTS raw_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mention_id TEXT UNIQUE,  -- Hash of canonical URL
    url TEXT NOT NULL,  -- Original URL
    canonical_url TEXT NOT NULL,  -- Canonicalized URL
    title TEXT,
    publisher TEXT,
    published_at TEXT,  -- ISO format
    query_matched TEXT,
    raw_text TEXT,  -- Fetched later, not at ingest time
    snippet TEXT,
    ingested_at TEXT,
    extraction_error TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mention_id ON raw_articles(mention_id);
CREATE INDEX idx_url ON raw_articles(url);
CREATE INDEX idx_published_at ON raw_articles(published_at);
```

**Output:** SQLite database with raw articles

---

## Phase B: Normalize + Deduplicate

### Objective
Turn articles into normalized "mention" records and remove duplicates.

### Normalization Steps

1. **Canonicalize URLs:**
   - Strip UTM parameters
   - Normalize domains (www vs non-www)
   - Remove tracking parameters

2. **Fuzzy Deduplication:**
   - Compare title + publisher + date
   - Use Levenshtein distance for title similarity
   - Cluster syndicated articles (AP/Reuters reposts)

**File:** `scripts/news-process/normalize_mentions.py`
```python
from typing import Dict
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
import hashlib

# Common tracking parameters to remove
TRACKING_PARAMS = {
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'ref', 'source', 'campaign', 'fbclid', 'gclid', 'mc_cid', 'mc_eid',
    'igshid', '_ga', '_gid', 'fb_action_ids', 'fb_action_types',
    'fb_source', 'twclid', 'mkt_tok'
}

def canonicalize_url(url: str) -> str:
    """
    Canonicalize URL by removing tracking parameters.
    Preserves original query ordering and encoding.
    """
    parsed = urlparse(url)
    
    if not parsed.query:
        return url
    
    # Parse query params (keeps original encoding)
    query_params = parse_qs(parsed.query, keep_blank_values=True)
    
    # Remove tracking params
    filtered_params = {
        k: v for k, v in query_params.items()
        if k.lower() not in TRACKING_PARAMS
    }
    
    # Rebuild query string (preserve order if possible)
    if filtered_params:
        # Use urlencode to rebuild query
        new_query = urlencode(filtered_params, doseq=True)
    else:
        new_query = ""
    
    # Rebuild URL
    new_parsed = parsed._replace(query=new_query)
    canonical = urlunparse(new_parsed)
    
    return canonical

def generate_mention_id(url: str) -> str:
    """Generate unique mention ID from canonicalized URL."""
    import hashlib
    canonical = canonicalize_url(url)
    return hashlib.sha256(canonical.encode()).hexdigest()

def create_mention_record(article: Dict) -> Dict:
    """Create normalized mention record from raw article."""
    from datetime import datetime
    canonical_url = canonicalize_url(article["url"])
    mention_id = generate_mention_id(canonical_url)
    
    return {
        "mention_id": mention_id,
        "url": article["url"],  # Keep original URL
        "canonical_url": canonical_url,  # Canonicalized version
        "title": article["title"],
        "publisher": article["publisher"],
        "published_at": article["published_at"],
        "query_matched": article["query_matched"],
        "raw_text": article.get("raw_text"),
        "snippet": article.get("snippet", ""),
        "created_at": datetime.utcnow().isoformat()
    }
```

### Deduplication Logic (Tiered Approach)

**File:** `scripts/news-process/deduplicate.py`
```python
from typing import List, Dict
from difflib import SequenceMatcher

def normalize_title(title: str) -> str:
    """Normalize title for comparison."""
    return title.lower().strip()

def deduplicate_mentions(mentions: List[Dict]) -> List[Dict]:
    """
    Remove duplicates using tiered approach (avoids O(n²) fuzzy matching).
    
    Tiers:
    1. Exact canonical_url match
    2. Exact (publisher, normalized_title) match
    3. Fuzzy match only within candidate set (same publisher OR same day)
    
    Returns:
        List of unique mentions (keeps earliest)
    """
    # Sort by date (keep earliest)
    mentions = sorted(mentions, key=lambda x: x.get("published_at", ""))
    
    seen_canonical = set()
    seen_publisher_title = set()
    unique_mentions = []
    
    for mention in mentions:
        canonical_url = mention.get("canonical_url", mention["url"])
        
        # Tier 1: Exact canonical URL
        if canonical_url in seen_canonical:
            continue
        
        # Tier 2: Exact publisher + normalized title
        publisher = mention.get("publisher", "").lower()
        normalized_title = normalize_title(mention.get("title", ""))
        publisher_title_key = (publisher, normalized_title)
        
        if publisher_title_key in seen_publisher_title:
            continue
        
        # Tier 3: Fuzzy match within candidate set
        # Only check against mentions from same publisher OR same day
        is_duplicate = False
        candidate_set = [
            m for m in unique_mentions
            if (m.get("publisher", "").lower() == publisher or
                m.get("published_at", "")[:10] == mention.get("published_at", "")[:10])
        ]
        
        for candidate in candidate_set:
            if fuzzy_match_articles(mention, candidate, threshold=0.85):
                is_duplicate = True
                # Merge source URLs
                candidate["source_urls"].append(mention["url"])
                break
        
        if not is_duplicate:
            mention["source_urls"] = [mention["url"]]
            seen_canonical.add(canonical_url)
            seen_publisher_title.add(publisher_title_key)
            unique_mentions.append(mention)
    
    return unique_mentions

def fuzzy_match_articles(article1: Dict, article2: Dict, threshold: float = 0.85) -> bool:
    """Check if two articles are likely duplicates (within candidate set only)."""
    title1 = normalize_title(article1.get("title", ""))
    title2 = normalize_title(article2.get("title", ""))
    
    if not title1 or not title2:
        return False
    
    similarity = SequenceMatcher(None, title1, title2).ratio()
    return similarity >= threshold
```

**Output:** Normalized mentions table in SQLite

---

## Phase C: Classify Articles

### Objective
Classify articles into 3 buckets: Project Announcement, Context/News, or Noise.

### Classification Rules (MVP - Rules-Based)

**File:** `scripts/news-process/classify_article.py`
```python
import re
from typing import Dict, List

# Expand keywords - data center not always mentioned explicitly
DATA_CENTER_KEYWORDS = [
    r"\b(data center|datacenter|hyperscale|campus)\b",
    r"\b(cloud facility|cloud campus)\b",
    r"\b(AI compute|AI campus|AI facility)\b",
    r"\b(server farm|server facility)\b",
    r"\b(compute facility|compute campus)\b",
]

CLASSIFICATION_RULES = {
    "project_announcement": {
        "required_keywords": DATA_CENTER_KEYWORDS,  # At least one must match
        "required_signals": 2,  # Need at least 2 of:
        "signals": [
            r"\b(city|county|site|location|address|parcel|industrial park)\b",
            r"\b(MW|megawatt|square feet|sqft|acre|acres|campus|multi-building)\b",
            r"\b(Amazon|Google|Microsoft|Meta|Oracle|CoreWeave|Digital Realty|QTS|Switch|Aligned)\b",
            r"\b(by 20\d{2}|breaking ground|groundbreaking|construction|permit|zoning|tax abatement)\b",
            r"\b(permit|zoning|tax abatement|approval|filing)\b",
        ]
    },
    "noise": {
        "keywords": [
            r"\b(jobs|hiring|careers|now hiring)\b",
            r"\b(colocation pricing|colocation rates)\b",
            r"\b(bitcoin|crypto mining|cryptocurrency)\b",
            r"\b(edge data center|edge computing)\b",  # Tune based on results
        ]
    }
}

def classify_article(mention: Dict) -> Dict:
    """
    Classify article into bucket: project_announcement, context, or noise.
    
    Returns:
        {
            "classification": "project_announcement" | "context" | "noise",
            "confidence": "low" | "medium" | "high",
            "matched_signals": List[str],
            "reasoning": str
        }
    """
    text = (mention.get("raw_text") or mention.get("snippet", "")).lower()
    title = mention.get("title", "").lower()
    full_text = f"{title} {text}"
    
    # Check for noise first
    for keyword in CLASSIFICATION_RULES["noise"]["keywords"]:
        if re.search(keyword, full_text, re.IGNORECASE):
            return {
                "classification": "noise",
                "confidence": "high",
                "matched_signals": [keyword],
                "reasoning": f"Matched noise keyword: {keyword}"
            }
    
    # Check for project announcement signals
    matched_signals = []
    for signal_pattern in CLASSIFICATION_RULES["project_announcement"]["signals"]:
        if re.search(signal_pattern, full_text, re.IGNORECASE):
            matched_signals.append(signal_pattern)
    
    # Check required keywords (at least one must match)
    has_required = any(
        re.search(pattern, full_text, re.IGNORECASE)
        for pattern in CLASSIFICATION_RULES["project_announcement"]["required_keywords"]
    )
    
    required_signals = CLASSIFICATION_RULES["project_announcement"]["required_signals"]
    
    if has_required and len(matched_signals) >= required_signals:
        confidence = "high" if len(matched_signals) >= 3 else "medium"
        return {
            "classification": "project_announcement",
            "confidence": confidence,
            "matched_signals": matched_signals,
            "reasoning": f"Matched {len(matched_signals)} signals"
        }
    
    # Default to context/news
    return {
        "classification": "context",
        "confidence": "low",
        "matched_signals": matched_signals,
        "reasoning": "General news, not specific project announcement"
    }
```

### Future Enhancement: LLM Classifier

Once you have examples, upgrade to LLM-based classification:

```python
def classify_with_llm(mention: Dict, examples: List[Dict]) -> Dict:
    """
    Classify using LLM with few-shot examples.
    
    Future enhancement - use OpenAI/Anthropic API.
    """
    # TODO: Implement LLM classification
    pass
```

**Output:** Classified mentions with confidence scores

---

## Phase D: Extract Project Cards

### Objective
Extract structured fields from project announcement articles (probabilistic extraction).

### Extraction Schema

**File:** `scripts/news-process/extract_project_card.py`
```python
import re
from typing import Dict, Optional

PROJECT_CARD_SCHEMA = {
    "project_name": Optional[str],
    "company": Optional[str],
    "location_text": Optional[str],  # City/county
    "site_hint": Optional[str],  # Industrial park, road, substation
    "size_mw": Optional[float],
    "size_sqft": Optional[int],
    "announced_date": Optional[str],  # ISO format
    "source_urls": List[str],
    "extraction_confidence": str,  # low/medium/high
}

def extract_project_card(mention: Dict) -> Dict:
    """
    Extract structured project card from classified mention.
    
    Returns:
        Project card dict (many fields may be null)
    """
    text = mention.get("raw_text") or mention.get("snippet", "")
    title = mention.get("title", "")
    full_text = f"{title} {text}"
    
    card = {
        "project_name": None,
        "company": None,
        "location_text": None,
        "site_hint": None,
        "size_mw": None,
        "size_sqft": None,
        "announced_date": mention.get("published_at"),
        "source_urls": mention.get("source_urls", [mention["url"]]),
        "extraction_confidence": "low"
    }
    
    # Extract company
    companies = [
        "Amazon", "Google", "Microsoft", "Meta", "Facebook", "Oracle",
        "CoreWeave", "Digital Realty", "QTS", "Switch", "Aligned",
        "Equinix", "CyrusOne", "Vantage", "STACK"
    ]
    for company in companies:
        if re.search(rf"\b{company}\b", full_text, re.IGNORECASE):
            card["company"] = company
            break
    
    # Extract location (free text first - handle various formats)
    # Patterns: "in [City]", "near [City]", "[City], Texas", "in unincorporated [County]"
    location_patterns = [
        r"\b(?:in|near|outside|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)(?:,\s+Texas)?",
        r"\bin\s+unincorporated\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County",
        r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+Texas",
        r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County",
        r"\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+industrial\s+park",
    ]
    
    # Try patterns first
    for pattern in location_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            card["location_text"] = match.group(1).strip()
            break
    
    # If no pattern match, treat as free text (extract any capitalized place-like text)
    # This is probabilistic - will be refined later
    if not card["location_text"]:
        # Fallback: look for "in [Place]" or "[Place], Texas" patterns more loosely
        loose_match = re.search(r"\b(?:in|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", full_text)
        if loose_match:
            card["location_text"] = loose_match.group(1)
    
    # Add geocoding confidence field (set later during geocoding)
    card["location_geocode_confidence"] = None
    
    # Extract size (MW)
    mw_patterns = [
        r"(\d+(?:\.\d+)?)\s*MW",
        r"(\d+(?:\.\d+)?)\s*megawatts?",
    ]
    for pattern in mw_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            try:
                card["size_mw"] = float(match.group(1))
            except ValueError:
                pass
            break
    
    # Extract size (sqft)
    sqft_patterns = [
        r"(\d+(?:,\d{3})*)\s*sq\.?\s*ft\.?",
        r"(\d+(?:,\d{3})*)\s*square\s+feet",
    ]
    for pattern in sqft_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            try:
                card["size_sqft"] = int(match.group(1).replace(",", ""))
            except ValueError:
                pass
            break
    
    # Extract site hint (substation, industrial park, road)
    site_patterns = [
        r"(substation\s+[A-Z0-9]+)",
        r"([A-Z][a-z]+\s+Industrial\s+Park)",
        r"([A-Z][a-z]+\s+(?:Road|Street|Avenue|Boulevard))",
    ]
    for pattern in site_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            card["site_hint"] = match.group(1)
            break
    
    # Calculate confidence
    filled_fields = sum(1 for v in card.values() if v is not None)
    if filled_fields >= 4:
        card["extraction_confidence"] = "high"
    elif filled_fields >= 2:
        card["extraction_confidence"] = "medium"
    
    return card
```

**Output:** Project cards table with structured fields (many null)

---

## Phase E: Entity Resolution (Merge Articles → Projects)

### Objective
Merge multiple articles about the same project into a single project record.

### Merge Logic

**File:** `scripts/news-process/entity_resolution.py`
```python
from typing import List, Dict
from datetime import datetime, timedelta

def merge_project_cards(cards: List[Dict], time_window_days: int = 180) -> List[Dict]:
    """
    Merge project cards that likely refer to the same project.
    
    Merge criteria:
    1. Same company + same city/county within time window
    2. Same named site (if available)
    3. Same parcel/industrial park reference
    
    Returns:
        List of merged project records
    """
    merged_projects = []
    processed = set()
    
    for i, card1 in enumerate(cards):
        if i in processed:
            continue
        
        project = card1.copy()
        project["source_urls"] = card1["source_urls"].copy()
        project["mention_ids"] = [card1.get("mention_id")]
        
        # Find matches
        for j, card2 in enumerate(cards[i+1:], start=i+1):
            if j in processed:
                continue
            
            if is_same_project(card1, card2, time_window_days):
                # Merge card2 into project
                merge_card_into_project(project, card2)
                processed.add(j)
        
        merged_projects.append(project)
        processed.add(i)
    
    return merged_projects

def is_same_project(card1: Dict, card2: Dict, time_window_days: int) -> bool:
    """Check if two cards refer to the same project."""
    # Same company + same location
    if (card1.get("company") and card2.get("company") and
        card1["company"] == card2["company"] and
        card1.get("location_text") and card2.get("location_text") and
        normalize_location(card1["location_text"]) == normalize_location(card2["location_text"])):
        
        # Check time window
        date1 = parse_date(card1.get("announced_date"))
        date2 = parse_date(card2.get("announced_date"))
        if date1 and date2:
            if abs((date1 - date2).days) <= time_window_days:
                return True
    
    # Same site hint
    if (card1.get("site_hint") and card2.get("site_hint") and
        normalize_site(card1["site_hint"]) == normalize_site(card2["site_hint"])):
        return True
    
    return False

def merge_card_into_project(project: Dict, card: Dict):
    """Merge card data into project record."""
    # Merge source URLs
    project["source_urls"].extend(card.get("source_urls", []))
    project["source_urls"] = list(set(project["source_urls"]))  # Dedupe
    
    # Merge mention IDs
    if "mention_ids" not in project:
        project["mention_ids"] = []
    project["mention_ids"].append(card.get("mention_id"))
    
    # Fill in missing fields
    for key in ["project_name", "company", "location_text", "site_hint", "size_mw", "size_sqft"]:
        if not project.get(key) and card.get(key):
            project[key] = card[key]
    
    # Use earliest announced date
    date1 = parse_date(project.get("announced_date"))
    date2 = parse_date(card.get("announced_date"))
    if date1 and date2 and date2 < date1:
        project["announced_date"] = card["announced_date"]
    
    # Update confidence (use highest)
    conf1 = project.get("extraction_confidence", "low")
    conf2 = card.get("extraction_confidence", "low")
    confidence_order = {"low": 0, "medium": 1, "high": 2}
    if confidence_order.get(conf2, 0) > confidence_order.get(conf1, 0):
        project["extraction_confidence"] = conf2
```

### Human Review Queue

**File:** `scripts/news-process/review_queue.py`
```python
def generate_review_suggestions(projects: List[Dict]) -> List[Dict]:
    """
    Generate merge suggestions for human review.
    
    Returns:
        List of "likely same project" suggestions
    """
    suggestions = []
    
    for i, proj1 in enumerate(projects):
        for proj2 in projects[i+1:]:
            similarity_score = calculate_similarity(proj1, proj2)
            
            if similarity_score >= 0.7:  # Threshold
                suggestions.append({
                    "project1_id": proj1["project_id"],
                    "project2_id": proj2["project_id"],
                    "similarity_score": similarity_score,
                    "reason": f"Same company ({proj1.get('company')}) and location ({proj1.get('location_text')})",
                    "project1": proj1,
                    "project2": proj2
                })
    
    return suggestions

def calculate_similarity(proj1: Dict, proj2: Dict) -> float:
    """Calculate similarity score between two projects (0-1)."""
    score = 0.0
    
    # Company match
    if proj1.get("company") == proj2.get("company"):
        score += 0.4
    
    # Location match
    if normalize_location(proj1.get("location_text", "")) == normalize_location(proj2.get("location_text", "")):
        score += 0.4
    
    # Site hint match
    if proj1.get("site_hint") and proj2.get("site_hint"):
        if normalize_site(proj1["site_hint"]) == normalize_site(proj2["site_hint"]):
            score += 0.2
    
    return score
```

**Output:** Merged projects table + review queue for manual confirmation

---

## Phase F: Status Tracking (Alive vs Dead)

### Objective
Track project status signals from news articles.

### Status Signals

**File:** `scripts/news-process/status_tracking.py`
```python
from typing import List, Dict
from datetime import datetime
import re

STATUS_SIGNALS = {
    "dead_candidate": [
        r"\b(paused|shelved|canceled|cancelled|scrapped|withdrawn)\b",
        r"\b(permit expired|tax abatement rescinded)\b",
        r"\b(land sold|site listed|property sold)\b",
        r"\b(market conditions|reconsidering|delayed indefinitely)\b",
    ],
    "revived": [
        r"\b(resumed|restarted|back on track|moving forward)\b",
        r"\b(permit renewed|tax abatement restored)\b",
    ],
    "uncertain": [
        r"\b(delayed|postponed|under review|pending)\b",
        r"\b(uncertain|unclear|may not proceed)\b",
    ],
    "active": [
        r"\b(breaking ground|groundbreaking|construction started|under construction)\b",
        r"\b(approved|permit granted|zoning approved)\b",
        r"\b(operational|online|completed)\b",
    ]
}

def update_project_status(project: Dict, mentions: List[Dict]) -> Dict:
    """
    Update project status based on latest mentions.
    Handles conflicts: newest "dead" beats "active" unless newer "construction started".
    
    Returns:
        Updated project with status fields and history
    """
    # Get latest mentions for this project
    project_mention_ids = project.get("mention_ids", [])
    project_mentions = [m for m in mentions if m.get("mention_id") in project_mention_ids]
    
    # Sort by date (newest first)
    project_mentions.sort(key=lambda x: x.get("published_at", ""), reverse=True)
    
    # Check for status signals
    status_evidence = {
        "dead_candidate": [],
        "revived": [],
        "uncertain": [],
        "active": []
    }
    
    for mention in project_mentions:
        text = (mention.get("raw_text") or mention.get("snippet", "")).lower()
        
        for status, patterns in STATUS_SIGNALS.items():
            for pattern in patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    status_evidence[status].append({
                        "url": mention["url"],
                        "published_at": mention["published_at"],
                        "signal": pattern
                    })
    
    # Determine status with conflict handling
    # Newest "dead" beats "active" unless newer "construction started" appears
    status_history = project.get("status_history", [])
    
    # Get most recent signals
    latest_dead = max(status_evidence["dead_candidate"], key=lambda x: x["published_at"]) if status_evidence["dead_candidate"] else None
    latest_active = max(status_evidence["active"], key=lambda x: x["published_at"]) if status_evidence["active"] else None
    latest_revived = max(status_evidence["revived"], key=lambda x: x["published_at"]) if status_evidence["revived"] else None
    
    # Conflict resolution
    if latest_revived:
        # Revival beats dead if revival is newer
        if latest_dead and latest_revived["published_at"] > latest_dead["published_at"]:
            status = "active"
            confidence = "high"
        else:
            status = "active"
            confidence = "medium"
    elif latest_active:
        # Active beats dead if active is newer
        if latest_dead and latest_active["published_at"] > latest_dead["published_at"]:
            status = "active"
            confidence = "high"
        elif latest_dead:
            status = "dead_candidate"
            confidence = "high"
        else:
            status = "active"
            confidence = "high"
    elif latest_dead:
        status = "dead_candidate"
        confidence = "high" if len(status_evidence["dead_candidate"]) >= 2 else "medium"
    elif status_evidence["uncertain"]:
        status = "uncertain"
        confidence = "medium"
    else:
        status = project.get("status", "active")  # Keep existing or default
        confidence = "low"
    
    # Update status history
    if status != project.get("status"):
        status_history.append({
            "status": status,
            "confidence": confidence,
            "updated_at": datetime.utcnow().isoformat(),
            "evidence": status_evidence.get(status, [])
        })
    
    project["status"] = status
    project["status_current"] = status
    project["status_confidence"] = confidence
    project["status_history"] = status_history
    project["status_evidence"] = status_evidence
    project["last_signal_at"] = max(
        [e["published_at"] for signals in status_evidence.values() for e in signals],
        default=project.get("last_signal_at")
    )
    project["status_updated_at"] = datetime.utcnow().isoformat()
    
    return project
```

**Output:** Projects with status tracking

---

## Phase G: Output Products

### Objective
Generate outputs for visualization and analysis.

### 1. Map Layer (GeoJSON)

**File:** `scripts/news-output/generate_map_layer.py`
```python
from typing import List, Dict
import json
import time

# Use Mapbox if available, fallback to Nominatim with caching
def geocode_location(location_text: str, use_mapbox: bool = True, cache: Dict = None) -> Dict:
    """
    Geocode location text. Caches results to avoid re-geocoding.
    
    Args:
        location_text: City/county name
        use_mapbox: Use Mapbox if available (recommended)
        cache: Dictionary cache of previous results
    
    Returns:
        {"lat": float, "lng": float, "confidence": str} or None
    """
    if cache and location_text in cache:
        return cache[location_text]
    
    if use_mapbox:
        # Use Mapbox Geocoding API (if you have access)
        # import mapbox
        # geocoder = mapbox.Geocoder(access_token=MAPBOX_TOKEN)
        # response = geocoder.forward(f"{location_text}, Texas, USA")
        # ... parse response
        pass
    
    # Fallback to Nominatim (with rate limiting)
    from geopy.geocoders import Nominatim
    geocoder = Nominatim(user_agent="texas_data_center_tracker", timeout=10)
    
    try:
        location = geocoder.geocode(f"{location_text}, Texas, USA")
        if location:
            result = {
                "lat": location.latitude,
                "lng": location.longitude,
                "confidence": "city" if "city" in location.raw.get("type", []) else "county"
            }
            if cache:
                cache[location_text] = result
            return result
    except Exception as e:
        print(f"Geocoding failed for {location_text}: {e}")
    
    return None

def generate_map_geojson(projects: List[Dict], geocode_cache: Dict = None) -> Dict:
    """
    Generate GeoJSON for map visualization.
    
    IMPORTANT: Only geocode city/county once. Cache results.
    Don't geocode at ingest time - do it in batch.
    
    Returns:
        GeoJSON FeatureCollection
    """
    if geocode_cache is None:
        geocode_cache = {}
    
    features = []
    
    for project in projects:
        location_text = project.get("location_text")
        if not location_text:
            continue
        
        # Geocode location (cached)
        coords = geocode_location(location_text, cache=geocode_cache)
        
        if coords:
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [coords["lng"], coords["lat"]]
                },
                "properties": {
                    "project_id": project.get("project_id"),
                    "project_name": project.get("project_name") or f"{project.get('company')} - {location_text}",
                    "company": project.get("company"),
                    "location": location_text,
                    "size_mw": project.get("size_mw"),
                    "status": project.get("status"),
                    "status_confidence": project.get("status_confidence"),
                    "announced_date": project.get("announced_date"),
                    "source_urls": project.get("source_urls", []),
                    "extraction_confidence": project.get("extraction_confidence"),
                    "geocode_confidence": coords.get("confidence", "unknown")
                }
            }
            features.append(feature)
        
        # Rate limit Nominatim (if using fallback)
        time.sleep(1)  # 1 request per second max
    
    return {
        "type": "FeatureCollection",
        "features": features
    }
```

### 2. Timeline View

**File:** `scripts/news-output/generate_timeline.py`
```python
def generate_timeline(project: Dict, mentions: List[Dict]) -> List[Dict]:
    """
    Generate timeline events for a project.
    
    Returns:
        List of timeline events
    """
    timeline = []
    
    # Get all mentions for this project
    project_mention_ids = project.get("mention_ids", [])
    project_mentions = [
        m for m in mentions 
        if m.get("mention_id") in project_mention_ids
    ]
    
    # Sort by date
    project_mentions.sort(key=lambda x: x.get("published_at", ""))
    
    for mention in project_mentions:
        timeline.append({
            "date": mention.get("published_at"),
            "event_type": "news_article",
            "title": mention.get("title"),
            "url": mention.get("url"),
            "source": mention.get("publisher")
        })
    
    # Add status changes
    status_evidence = project.get("status_evidence", {})
    for status, evidence_list in status_evidence.items():
        for evidence in evidence_list:
            timeline.append({
                "date": evidence["published_at"],
                "event_type": f"status_{status}",
                "signal": evidence["signal"],
                "url": evidence["url"]
            })
    
    timeline.sort(key=lambda x: x.get("date", ""))
    return timeline
```

### 3. CSV Export

**File:** `scripts/news-output/export_csv.py`
```python
import csv
from typing import List, Dict

def export_projects_csv(projects: List[Dict], output_path: str):
    """Export projects to CSV."""
    fieldnames = [
        "project_id",
        "project_name",
        "company",
        "location_text",
        "site_hint",
        "size_mw",
        "size_sqft",
        "status",
        "status_confidence",
        "announced_date",
        "extraction_confidence",
        "source_urls"
    ]
    
    with open(output_path, 'w', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        
        for project in projects:
            row = {field: project.get(field, "") for field in fieldnames}
            # Convert list to string
            if isinstance(row["source_urls"], list):
                row["source_urls"] = "; ".join(row["source_urls"])
            writer.writerow(row)
```

### 4. Evidence Pack (Per-Project)

**File:** `scripts/news-output/generate_evidence_pack.py`
```python
from typing import Dict, List
import json

def generate_evidence_pack(project: Dict, mentions: List[Dict]) -> Dict:
    """
    Generate evidence bundle for a project (for credibility/partnership).
    
    Returns:
        Evidence pack with URLs, snippets, and extracted quotes
    """
    project_mention_ids = project.get("mention_ids", [])
    project_mentions = [
        m for m in mentions
        if m.get("mention_id") in project_mention_ids
    ]
    
    # Sort by date
    project_mentions.sort(key=lambda x: x.get("published_at", ""))
    
    evidence = {
        "project_id": project.get("project_id"),
        "project_name": project.get("project_name"),
        "company": project.get("company"),
        "location": project.get("location_text"),
        "sources": []
    }
    
    for mention in project_mentions:
        # Extract relevant quotes/snippets
        snippet = mention.get("snippet", "")
        raw_text = mention.get("raw_text", "")
        
        # Find key quotes (mentions of size, location, company)
        quotes = []
        if project.get("company"):
            # Find quotes mentioning company
            import re
            company_mentions = re.findall(
                rf".{{0,100}}{re.escape(project['company'])}.{{0,100}}",
                raw_text or snippet,
                re.IGNORECASE
            )
            quotes.extend(company_mentions[:3])  # Top 3
        
        evidence["sources"].append({
            "url": mention["url"],
            "title": mention.get("title"),
            "publisher": mention.get("publisher"),
            "published_at": mention.get("published_at"),
            "snippet": snippet,
            "quotes": quotes[:3]  # Top 3 quotes
        })
    
    return evidence

def export_evidence_packs(projects: List[Dict], mentions: List[Dict], output_dir: str):
    """Export evidence packs for all projects."""
    import os
    os.makedirs(output_dir, exist_ok=True)
    
    for project in projects:
        evidence = generate_evidence_pack(project, mentions)
        output_path = os.path.join(output_dir, f"{project['project_id']}_evidence.json")
        
        with open(output_path, 'w') as f:
            json.dump(evidence, f, indent=2)
```

**Output:** GeoJSON map layer, timeline JSON, CSV export, evidence packs (per-project JSON)

---

## Implementation Checklist

### Phase 0: Setup
- [ ] Create `config/news_queries.json` with query templates
- [ ] Define company list and negative filters
- [ ] Test query syntax with Google News RSS

### Phase A: Ingest
- [ ] Implement Google News RSS fetcher (metadata only)
- [ ] **OR** Implement SerpAPI fetcher (using `SERP_API_KEY` from `.env.local`)
- [ ] Set up SQLite database schema
- [ ] Create cron job for daily ingestion
- [ ] Test with sample queries
- [ ] Create separate content fetch job (rate-limited)
- [ ] Load API keys from environment variables (`.env.local`)

### Phase B: Normalize
- [ ] Implement URL canonicalization
- [ ] Implement fuzzy deduplication
- [ ] Test with sample articles
- [ ] Create mentions table

### Phase C: Classify
- [ ] Implement rules-based classifier
- [ ] Test classification accuracy
- [ ] Tune noise filters based on results
- [ ] (Future) Collect examples for LLM classifier

### Phase D: Extract
- [ ] Implement field extraction (company, location, size)
- [ ] Test extraction accuracy
- [ ] Handle edge cases (multiple companies, ambiguous locations)
- [ ] Calculate confidence scores

### Phase E: Entity Resolution
- [ ] Implement merge logic
- [ ] Create review queue system
- [ ] Test merge accuracy
- [ ] Build UI for manual review (optional)

### Phase F: Status Tracking
- [ ] Implement status signal detection
- [ ] Test status updates
- [ ] Handle conflicting signals
- [ ] Update projects table

### Phase G: Output
- [ ] Implement GeoJSON generation
- [ ] Implement geocoding (city-level, with caching)
- [ ] Generate timeline view
- [ ] Create CSV export
- [ ] Generate evidence packs (per-project JSON)
- [ ] Integrate with existing map UI

---

## Risk Assessment

| Phase | Risk Level | Mitigation |
|-------|------------|------------|
| Phase A (Ingest) | Medium | Start with RSS, have SerpAPI fallback ready |
| Phase B (Normalize) | Low | Well-understood deduplication patterns |
| Phase C (Classify) | Medium | Start with rules, upgrade to LLM later |
| Phase D (Extract) | High | Many fields will be null - that's expected |
| Phase E (Entity Resolution) | High | Use human review queue for edge cases |
| Phase F (Status Tracking) | Medium | Status is probabilistic - show confidence |
| Phase G (Output) | Low | Standard geocoding and export patterns |

---

## Realistic Expectations

### What Will Work Well
- ✅ Collecting articles from Google News RSS (metadata)
- ✅ Basic deduplication (exact URL matches)
- ✅ Rules-based classification (surprisingly effective)
- ✅ Extracting company names and locations (free text)
- ✅ City-level geocoding (with caching)

### What Will Be Challenging
- ⚠️ Full-text extraction (paywalls, JavaScript sites) - fetch separately
- ⚠️ Entity resolution (merging articles about same project)
- ⚠️ Extracting precise locations (often vague in news - treat as free text)
- ⚠️ Status tracking (conflicting signals - handle explicitly)

### What to Accept
- ✅ Many fields will be null (probabilistic data)
- ✅ Some false positives in classification
- ✅ Manual review needed for entity resolution
- ✅ Status confidence will vary
- ✅ Location may be city/county level only (not precise coordinates)

---

## Next Steps

1. **Start Small:** Texas-only, 10-30 projects
2. **Prototype Phase A:** Get RSS ingestion working (metadata only)
3. **Test Classification:** See how rules perform on real articles
4. **Iterate:** Tune filters and rules based on results
5. **Build Evidence Packs:** For credibility and later partnership
6. **Scale Up:** Only after MVP proves valuable

**MVP Success = 10–30 Texas project cards with evidence links and a map dot at city/county resolution—no ERCOT required.**

---

## Environment Setup

### Required Environment Variables

Create or update `.env.local`:

```bash
# SerpAPI (optional but recommended if you have a key)
SERP_API_KEY=your_serpapi_key_here

# Mapbox (optional - if using Mapbox geocoding)
MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
```

**Note:** The pipeline works without any keys (uses RSS + Nominatim), but SerpAPI provides more reliable results.

### Python Dependencies

```bash
pip install feedparser python-dotenv serpapi readability-lxml newspaper3k geopy
```

---

## Resources

- **Google News RSS:** `https://news.google.com/rss/search?q=data+center+Texas+permit`
- **GDELT API:** https://www.gdeltproject.org/
- **SerpAPI:** https://serpapi.com/google-news-api
- **Nominatim Geocoding:** https://nominatim.org/

---

**Status:** Planning Phase  
**Last Updated:** [Current Date]  
**Focus:** News-first discovery before ERCOT integration

