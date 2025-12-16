#!/usr/bin/env python3
"""
SerpAPI news fetcher with timeout and health checks.
Ensures script completes in <1 minute.
"""

import os
import sys
import time
import signal
from typing import List, Dict, Optional
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Import from same directory
from utils import create_mention_record
import sqlite3

# Load environment variables
load_dotenv(Path(__file__).parent.parent.parent / '.env.local')

# Timeout configuration
MAX_RUNTIME_SECONDS = 55  # Leave 5 seconds buffer
TIMEOUT_EXCEEDED = False

def timeout_handler(signum, frame):
    """Handle timeout signal."""
    global TIMEOUT_EXCEEDED
    TIMEOUT_EXCEEDED = True
    print("\n⚠️  Timeout approaching - stopping gracefully...")
    raise TimeoutError("Script exceeded maximum runtime")

def health_check(start_time: float) -> bool:
    """Check if script is still within time limit."""
    elapsed = time.time() - start_time
    if elapsed > MAX_RUNTIME_SECONDS:
        return False
    return True

def fetch_serpapi_news(query: str, api_key: Optional[str] = None, max_results: int = 50) -> List[Dict]:
    """
    Fetch news articles via SerpAPI with timeout protection.
    
    Args:
        query: Search query string (Google-style)
        api_key: SerpAPI key (defaults to SERP_API_KEY env var)
        max_results: Maximum number of results to fetch
    
    Returns:
        List of article dictionaries (metadata only)
    """
    start_time = time.time()
    
    # Get API key from env if not provided
    if api_key is None:
        api_key = os.getenv('SERP_API_KEY')
        if not api_key:
            raise ValueError("SERP_API_KEY not found in environment variables")
    
    # Set up timeout signal handler
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(MAX_RUNTIME_SECONDS)
    
    try:
        from serpapi import GoogleSearch
        
        # Health check before API call
        if not health_check(start_time):
            raise TimeoutError("Pre-flight health check failed")
        
        params = {
            "q": query,
            "tbm": "nws",  # News search
            "api_key": api_key,
            "num": min(max_results, 100),  # SerpAPI max is 100
            "hl": "en",
            "gl": "us"
        }
        
        print(f"🔍 Fetching news for query: '{query}'...")
        search = GoogleSearch(params)
        
        # Health check before getting results
        if not health_check(start_time):
            raise TimeoutError("Health check failed before API response")
        
        # Get results - may need to wait/paginate
        results = search.get_dict()
        
        # Check for API errors
        if "error" in results:
            raise ValueError(f"SerpAPI error: {results['error']}")
        
        articles = []
        news_results = results.get("news_results", [])
        
        if not news_results:
            # Check if we got results but in different format
            print(f"⚠️  No news_results found. Response keys: {list(results.keys())}")
            if "organic_results" in results:
                print(f"   Found {len(results.get('organic_results', []))} organic results")
                # Use organic results as fallback if they look like news
                for result in results.get("organic_results", [])[:max_results]:
                    if "link" in result and "title" in result:
                        news_results.append(result)
            return articles  # Return early if no results
        
        # Limit results based on time remaining
        for i, result in enumerate(news_results):
            # Health check every 10 results
            if i > 0 and i % 10 == 0:
                if not health_check(start_time):
                    print(f"⚠️  Stopping at {i} results due to time limit")
                    break
            
            article = {
                "url": result.get("link", ""),  # Use "url" key for consistency
                "title": result.get("title", ""),
                "publisher": result.get("source", ""),
                "published_at": result.get("published_at", result.get("date", "")),
                "snippet": result.get("snippet", ""),
                "query_matched": query,
                "raw_text": None,  # Fetched later in content extraction job
            }
            articles.append(article)
        
        elapsed = time.time() - start_time
        print(f"✅ Fetched {len(articles)} articles in {elapsed:.2f}s")
        
        return articles
        
    except TimeoutError:
        elapsed = time.time() - start_time
        print(f"⏱️  Timeout after {elapsed:.2f}s - returning partial results")
        return articles if 'articles' in locals() else []
    except Exception as e:
        signal.alarm(0)  # Cancel timeout
        raise
    finally:
        signal.alarm(0)  # Always cancel timeout

def save_to_database(articles: List[Dict], db_path: Path):
    """Save articles to SQLite database."""
    if not articles:
        return
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    saved_count = 0
    for article in articles:
        mention_record = create_mention_record(article)
        
        try:
            cursor.execute("""
                INSERT OR IGNORE INTO raw_articles 
                (mention_id, url, canonical_url, title, publisher, published_at, 
                 query_matched, snippet, ingested_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                mention_record["mention_id"],
                mention_record["url"],
                mention_record["canonical_url"],
                mention_record["title"],
                mention_record["publisher"],
                mention_record["published_at"],
                mention_record["query_matched"],
                mention_record["snippet"],
                mention_record["ingested_at"]
            ))
            saved_count += 1
        except sqlite3.IntegrityError:
            # Duplicate mention_id - skip
            pass
    
    conn.commit()
    conn.close()
    
    print(f"💾 Saved {saved_count} new articles to database")

def main():
    """Main function for testing."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Fetch news articles via SerpAPI')
    parser.add_argument('--query', type=str, default='data center Texas', 
                       help='Search query')
    parser.add_argument('--max-results', type=int, default=50,
                       help='Maximum number of results')
    parser.add_argument('--db', type=str, 
                       default=str(Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"),
                       help='Database path')
    
    args = parser.parse_args()
    
    start_time = time.time()
    
    try:
        # Fetch articles
        articles = fetch_serpapi_news(args.query, max_results=args.max_results)
        
        # Save to database
        db_path = Path(args.db)
        if db_path.exists():
            save_to_database(articles, db_path)
        else:
            print(f"⚠️  Database not found at {db_path}")
            print(f"   Run: python scripts/news-ingest/init_db.py")
            print(f"   Articles fetched but not saved: {len(articles)}")
        
        elapsed = time.time() - start_time
        print(f"\n✅ Completed in {elapsed:.2f}s")
        
        if elapsed > 60:
            print(f"⚠️  WARNING: Script exceeded 60 seconds!")
        
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"\n❌ Error after {elapsed:.2f}s: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

