"""
Utility functions for news ingestion pipeline.
"""

from typing import Dict
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
import hashlib
from datetime import datetime

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
    canonical = canonicalize_url(url)
    return hashlib.sha256(canonical.encode()).hexdigest()

def create_mention_record(article: Dict) -> Dict:
    """Create normalized mention record from raw article."""
    canonical_url = canonicalize_url(article["url"])
    mention_id = generate_mention_id(canonical_url)
    
    return {
        "mention_id": mention_id,
        "url": article["url"],  # Keep original URL
        "canonical_url": canonical_url,  # Canonicalized version
        "title": article.get("title", ""),
        "publisher": article.get("publisher", ""),
        "published_at": article.get("published_at", ""),
        "query_matched": article.get("query_matched", ""),
        "raw_text": article.get("raw_text"),
        "snippet": article.get("snippet", ""),
        "ingested_at": datetime.utcnow().isoformat()
    }

