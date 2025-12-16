#!/usr/bin/env python3
"""
Phase B: Deduplication - Normalize and deduplicate articles into mentions.
Uses tiered approach to avoid O(n²) complexity.
Timeout protection: <60 seconds
"""

import sys
import time
import signal
from typing import List, Dict
from pathlib import Path
from difflib import SequenceMatcher
import sqlite3
import json

# Timeout configuration
MAX_RUNTIME_SECONDS = 55
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

def normalize_title(title: str) -> str:
    """Normalize title for comparison."""
    return title.lower().strip()

def fuzzy_match_articles(article1: Dict, article2: Dict, threshold: float = 0.85) -> bool:
    """Check if two articles are likely duplicates (within candidate set only)."""
    title1 = normalize_title(article1.get("title", ""))
    title2 = normalize_title(article2.get("title", ""))
    
    if not title1 or not title2:
        return False
    
    similarity = SequenceMatcher(None, title1, title2).ratio()
    return similarity >= threshold

def deduplicate_mentions(articles: List[Dict], start_time: float) -> List[Dict]:
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
    articles = sorted(articles, key=lambda x: x.get("published_at", ""))
    
    seen_canonical = set()
    seen_publisher_title = set()
    unique_mentions = []
    
    for i, article in enumerate(articles):
        # Health check every 100 articles
        if i > 0 and i % 100 == 0:
            if not health_check(start_time):
                print(f"⚠️  Stopping at {i} articles due to time limit")
                break
        
        canonical_url = article.get("canonical_url", article.get("url", ""))
        
        # Tier 1: Exact canonical URL
        if canonical_url in seen_canonical:
            continue
        
        # Tier 2: Exact publisher + normalized title
        publisher = article.get("publisher", "").lower()
        normalized_title = normalize_title(article.get("title", ""))
        publisher_title_key = (publisher, normalized_title)
        
        if publisher_title_key in seen_publisher_title:
            continue
        
        # Tier 3: Fuzzy match within candidate set
        # Only check against mentions from same publisher OR same day
        is_duplicate = False
        candidate_set = [
            m for m in unique_mentions
            if (m.get("publisher", "").lower() == publisher or
                m.get("published_at", "")[:10] == article.get("published_at", "")[:10])
        ]
        
        for candidate in candidate_set:
            if fuzzy_match_articles(article, candidate, threshold=0.85):
                is_duplicate = True
                # Merge source URLs
                if "source_urls" not in candidate:
                    candidate["source_urls"] = [candidate.get("url", "")]
                candidate["source_urls"].append(article.get("url", ""))
                break
        
        if not is_duplicate:
            article["source_urls"] = [article.get("url", "")]
            seen_canonical.add(canonical_url)
            seen_publisher_title.add(publisher_title_key)
            unique_mentions.append(article)
    
    return unique_mentions

def process_raw_articles(db_path: Path):
    """Process raw articles and create normalized mentions."""
    start_time = time.time()
    
    # Set up timeout signal handler
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(MAX_RUNTIME_SECONDS)
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Fetch raw articles that haven't been processed
        cursor.execute("""
            SELECT mention_id, url, canonical_url, title, publisher, published_at,
                   query_matched, snippet, ingested_at
            FROM raw_articles
            WHERE mention_id NOT IN (SELECT mention_id FROM mentions)
            ORDER BY published_at
        """)
        
        raw_articles = []
        for row in cursor.fetchall():
            raw_articles.append({
                "mention_id": row[0],
                "url": row[1],
                "canonical_url": row[2],
                "title": row[3],
                "publisher": row[4],
                "published_at": row[5],
                "query_matched": row[6],
                "snippet": row[7],
                "ingested_at": row[8]
            })
        
        if not raw_articles:
            print("✅ No new articles to process")
            conn.close()
            return
        
        print(f"📊 Processing {len(raw_articles)} raw articles...")
        
        # Deduplicate
        unique_mentions = deduplicate_mentions(raw_articles, start_time)
        
        print(f"✅ Deduplicated to {len(unique_mentions)} unique mentions")
        
        # Save to mentions table
        saved_count = 0
        for mention in unique_mentions:
            try:
                source_urls_json = json.dumps(mention.get("source_urls", [mention.get("url", "")]))
                
                cursor.execute("""
                    INSERT OR IGNORE INTO mentions
                    (mention_id, url, canonical_url, title, publisher, published_at,
                     query_matched, snippet, source_urls, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    mention["mention_id"],
                    mention["url"],
                    mention["canonical_url"],
                    mention.get("title", ""),
                    mention.get("publisher", ""),
                    mention.get("published_at", ""),
                    mention.get("query_matched", ""),
                    mention.get("snippet", ""),
                    source_urls_json,
                    mention.get("ingested_at", "")
                ))
                saved_count += 1
            except sqlite3.IntegrityError:
                pass
        
        conn.commit()
        conn.close()
        
        elapsed = time.time() - start_time
        print(f"💾 Saved {saved_count} mentions in {elapsed:.2f}s")
        
        if elapsed > 60:
            print(f"⚠️  WARNING: Script exceeded 60 seconds!")
        
    except TimeoutError:
        elapsed = time.time() - start_time
        print(f"⏱️  Timeout after {elapsed:.2f}s - partial processing complete")
    except Exception as e:
        signal.alarm(0)
        raise
    finally:
        signal.alarm(0)

def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Deduplicate raw articles into mentions')
    parser.add_argument('--db', type=str, 
                       default=str(Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"),
                       help='Database path')
    
    args = parser.parse_args()
    
    db_path = Path(args.db)
    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        print(f"   Run: python scripts/news-ingest/init_db.py")
        sys.exit(1)
    
    process_raw_articles(db_path)

if __name__ == "__main__":
    main()

