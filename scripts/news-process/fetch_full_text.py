#!/usr/bin/env python3
"""
Phase 4.4: Fetch Full-Text Articles

Fetches full article content for mentions that don't have raw_text.
Only fetches articles that need it (no company or no location).

Timeout protection: <60 seconds
"""

import sys
import time
import signal
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional
import urllib.parse
from urllib.parse import urlparse

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

def fetch_article_text(url: str, timeout: int = 5) -> Optional[str]:
    """
    Fetch full article text from URL using readability-lxml or newspaper3k.
    
    Returns:
        Full article text or None if fetch fails
    """
    if not url:
        return None
    
    try:
        # Try readability-lxml first (better for most news sites)
        try:
            from readability import Document
            import requests
            
            response = requests.get(url, timeout=timeout, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            response.raise_for_status()
            
            doc = Document(response.text)
            article_text = doc.summary()
            
            # Clean HTML tags
            from html import unescape
            import re
            # Remove HTML tags
            text = re.sub(r'<[^>]+>', '', article_text)
            # Decode HTML entities
            text = unescape(text)
            # Clean whitespace
            text = re.sub(r'\s+', ' ', text).strip()
            
            if len(text) > 200:  # Only return if we got meaningful content
                return text
        except ImportError:
            pass
        except Exception as e:
            print(f"  ⚠️  Readability failed for {url[:50]}...: {e}")
        
        # Fallback to newspaper3k
        try:
            from newspaper import Article
            
            article = Article(url)
            article.download()
            article.parse()
            
            text = article.text.strip()
            if len(text) > 200:  # Only return if we got meaningful content
                return text
        except ImportError:
            pass
        except Exception as e:
            print(f"  ⚠️  Newspaper3k failed for {url[:50]}...: {e}")
        
        # Last resort: try requests with basic parsing
        try:
            import requests
            from html import unescape
            import re
            
            response = requests.get(url, timeout=timeout, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            response.raise_for_status()
            
            # Basic HTML tag removal
            text = re.sub(r'<script[^>]*>.*?</script>', '', response.text, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r'<[^>]+>', '', text)
            text = unescape(text)
            text = re.sub(r'\s+', ' ', text).strip()
            
            if len(text) > 200:
                return text
        except Exception as e:
            print(f"  ⚠️  Basic fetch failed for {url[:50]}...: {e}")
        
        return None
        
    except Exception as e:
        print(f"  ⚠️  Error fetching {url[:50]}...: {e}")
        return None

def fetch_full_text_articles(db_path: Path, limit: int = 20, dry_run: bool = False):
    """
    Fetch full text for articles that need it.
    
    Args:
        db_path: Path to SQLite database
        limit: Maximum number of articles to fetch (to stay under timeout)
        dry_run: If True, only show what would be fetched
    """
    start_time = time.time()
    
    # Set up timeout signal handler
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(MAX_RUNTIME_SECONDS)
    
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Find articles that need full text:
        # Priority 1: project_announcement articles (highest priority)
        # Priority 2: Other articles with missing company/location
        # 1. No raw_text
        # 2. No company OR no location (beyond "Texas")
        # 3. Have a valid URL
        cursor.execute("""
            SELECT 
                m.mention_id,
                m.url,
                m.canonical_url,
                m.title,
                m.snippet,
                p.company,
                p.location_text,
                cm.classification
            FROM mentions m
            LEFT JOIN classified_mentions cm ON m.mention_id = cm.mention_id
            LEFT JOIN project_cards pc ON m.mention_id = pc.mention_id
            LEFT JOIN projects p ON pc.project_id = p.project_id
            WHERE (m.raw_text IS NULL OR m.raw_text = "")
              AND (COALESCE(m.canonical_url, m.url) IS NOT NULL AND COALESCE(m.canonical_url, m.url) != "")
              AND (
                (p.company IS NULL OR p.company = "Unknown")
                OR (p.location_text IS NULL OR p.location_text = "" OR p.location_text = "Texas")
              )
            ORDER BY 
                CASE WHEN cm.classification = "project_announcement" THEN 0 ELSE 1 END,
                CASE WHEN p.company IS NULL OR p.company = "Unknown" THEN 0 ELSE 1 END,
                CASE WHEN p.location_text IS NULL OR p.location_text = "" OR p.location_text = "Texas" THEN 0 ELSE 1 END
            LIMIT ?
        """, (limit,))
        
        articles = cursor.fetchall()
        
        if not articles:
            print("✅ No articles need full-text fetching")
            conn.close()
            return
        
        print(f"📊 Found {len(articles)} articles that need full-text fetching")
        if dry_run:
            print("🔍 DRY RUN - Would fetch:")
            for article in articles[:10]:
                print(f"   - {article['title'][:60]}... ({article['url'][:50] if article['url'] else 'N/A'}...)")
            conn.close()
            return
        
        print("=" * 80)
        
        fetched_count = 0
        failed_count = 0
        
        for i, article in enumerate(articles):
            # Health check every 5 articles
            if i > 0 and i % 5 == 0:
                if not health_check(start_time):
                    print(f"⚠️  Stopping at {i} articles due to time limit")
                    break
            
            url = article['canonical_url'] or article['url']
            mention_id = article['mention_id']
            
            print(f"\n[{i+1}/{len(articles)}] Fetching: {article['title'][:60]}...")
            print(f"  URL: {url[:80]}...")
            
            # Fetch article text
            article_text = fetch_article_text(url, timeout=5)
            
            if article_text:
                # Update database
                cursor.execute("""
                    UPDATE mentions
                    SET raw_text = ?
                    WHERE mention_id = ?
                """, (article_text, mention_id))
                conn.commit()
                
                print(f"  ✅ Fetched {len(article_text)} characters")
                fetched_count += 1
            else:
                print(f"  ❌ Failed to fetch")
                failed_count += 1
                # Mark as attempted (store empty string to avoid re-trying)
                cursor.execute("""
                    UPDATE mentions
                    SET raw_text = ?
                    WHERE mention_id = ?
                """, ("", mention_id))
                conn.commit()
            
            # Small delay to avoid rate limiting
            time.sleep(0.5)
        
        elapsed = time.time() - start_time
        print(f"\n✅ Fetching complete in {elapsed:.1f}s")
        print(f"   Fetched: {fetched_count}")
        print(f"   Failed: {failed_count}")
        
        conn.close()
        
    except TimeoutError:
        elapsed = time.time() - start_time
        print(f"\n⏱️  Timeout after {elapsed:.1f}s")
    except Exception as e:
        signal.alarm(0)
        raise
    finally:
        signal.alarm(0)

def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Fetch full-text articles for mentions")
    parser.add_argument(
        "--db-path",
        type=Path,
        default=Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db",
        help="Path to SQLite database"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="Maximum number of articles to fetch (default: 20)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be fetched without actually fetching"
    )
    
    args = parser.parse_args()
    
    if not args.db_path.exists():
        print(f"❌ Database not found: {args.db_path}")
        sys.exit(1)
    
    fetch_full_text_articles(args.db_path, limit=args.limit, dry_run=args.dry_run)

if __name__ == "__main__":
    main()

