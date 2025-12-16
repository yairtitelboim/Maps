#!/usr/bin/env python3
"""
Fetch full text for unknown projects that don't have it yet.
"""

import sys
import time
import signal
import sqlite3
from pathlib import Path
from typing import Optional
import requests
import re
from html import unescape

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

def fetch_article_text(url: str, timeout: int = 10) -> Optional[str]:
    """
    Fetch full article text from URL.
    
    Returns:
        Full article text or None if fetch fails
    """
    if not url:
        return None
    
    try:
        # Strategy 1: Use readability-lxml
        try:
            from readability import Document
            
            response = requests.get(url, timeout=timeout, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            response.raise_for_status()
            
            doc = Document(response.text)
            article_text = doc.summary()
            
            # Clean HTML tags
            text = re.sub(r'<[^>]+>', '', article_text)
            text = unescape(text)
            text = re.sub(r'\s+', ' ', text).strip()
            
            if len(text) > 200:
                return text
        except ImportError:
            pass
        except Exception as e:
            print(f"  ⚠️  Readability failed: {e}")
        
        # Strategy 2: Use newspaper3k
        try:
            from newspaper import Article
            
            article = Article(url)
            article.download()
            article.parse()
            
            text = article.text.strip()
            if len(text) > 200:
                return text
        except ImportError:
            pass
        except Exception as e:
            print(f"  ⚠️  Newspaper3k failed: {e}")
        
        # Strategy 3: Basic requests with regex
        try:
            response = requests.get(url, timeout=timeout, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            response.raise_for_status()
            
            # Remove scripts and styles
            text = re.sub(r'<script[^>]*>.*?</script>', '', response.text, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r'<[^>]+>', '', text)
            text = unescape(text)
            text = re.sub(r'\s+', ' ', text).strip()
            
            if len(text) > 200:
                return text
        except Exception as e:
            print(f"  ⚠️  Basic fetch failed: {e}")
        
        return None
    
    except Exception as e:
        print(f"  ⚠️  Error fetching {url[:50]}...: {e}")
        return None


def fetch_unknown_projects_text(db_path: Path, dry_run: bool = False):
    """Fetch full text for unknown projects."""
    start_time = time.time()
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(MAX_RUNTIME_SECONDS)
    
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Find unknown projects without full text
        cursor.execute("""
            SELECT DISTINCT
                m.mention_id,
                m.title,
                m.url,
                m.raw_text,
                p.project_id
            FROM projects p
            JOIN project_cards pc ON p.project_id = pc.project_id
            JOIN mentions m ON pc.mention_id = m.mention_id
            WHERE (p.project_name LIKE '%Unknown%' OR p.project_name IS NULL OR p.project_name = '')
              AND (m.raw_text IS NULL OR m.raw_text = '' OR LENGTH(m.raw_text) < 500)
              AND m.url IS NOT NULL
              AND m.url != ''
            ORDER BY p.announced_date DESC
        """)
        
        articles = cursor.fetchall()
        
        if not articles:
            print("✅ No articles need full text fetching")
            conn.close()
            return
        
        print(f"📊 FETCHING FULL TEXT FOR {len(articles)} ARTICLES")
        print("=" * 80)
        print()
        
        fetched_count = 0
        failed_count = 0
        
        for i, article in enumerate(articles, 1):
            if not health_check(start_time):
                print(f"\n⚠️  Stopping at {i-1}/{len(articles)} due to time limit")
                break
            
            mention_id = article['mention_id']
            url = article['url']
            title = article['title'] or 'Unknown'
            
            print(f"[{i}/{len(articles)}] {title[:60]}...")
            print(f"   URL: {url[:70]}...")
            
            if not dry_run:
                # Fetch article text
                text = fetch_article_text(url)
                
                if text:
                    # Update database
                    cursor.execute("""
                        UPDATE mentions
                        SET raw_text = ?
                        WHERE mention_id = ?
                    """, (text, mention_id))
                    
                    fetched_count += 1
                    print(f"   ✅ Fetched {len(text):,} characters")
                else:
                    failed_count += 1
                    print(f"   ❌ Failed to fetch")
            else:
                print(f"   [DRY RUN] Would fetch from: {url[:70]}...")
            
            # Small delay to avoid rate limiting
            time.sleep(0.5)
        
        if not dry_run and fetched_count > 0:
            conn.commit()
            print(f"\n✅ COMMITTED {fetched_count} UPDATES")
        
        print(f"\n📊 SUMMARY:")
        print(f"   Articles processed: {i}")
        print(f"   Successfully fetched: {fetched_count}")
        print(f"   Failed: {failed_count}")
        
        conn.close()
        
    except TimeoutError:
        print("\n⚠️  Script timed out")
    finally:
        signal.alarm(0)


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Fetch full text for unknown projects")
    parser.add_argument('--dry-run', action='store_true', help="Run without making database changes")
    args = parser.parse_args()
    
    db_path = Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"
    
    if not db_path.exists():
        print(f"❌ Database not found: {db_path}")
        sys.exit(1)
    
    fetch_unknown_projects_text(db_path, dry_run=args.dry_run)


if __name__ == "__main__":
    main()

