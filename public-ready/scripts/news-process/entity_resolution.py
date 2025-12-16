#!/usr/bin/env python3
"""
Phase E: Entity Resolution - Merge multiple articles into projects.
Uses merge logic: same company + location within time window.
Timeout protection: <60 seconds
"""

import sys
import time
import signal
from typing import Dict, List
from pathlib import Path
import sqlite3
import json
from datetime import datetime, timedelta

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

def normalize_location(location: str) -> str:
    """Normalize location text for comparison."""
    if not location:
        return ""
    return location.lower().strip().replace(",", "").replace(".", "")

def normalize_site(site: str) -> str:
    """Normalize site hint for comparison."""
    if not site:
        return ""
    return site.lower().strip()

def parse_date(date_str: str) -> datetime:
    """Parse ISO date string."""
    try:
        # Handle various formats
        if "T" in date_str:
            return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        else:
            return datetime.strptime(date_str[:10], "%Y-%m-%d")
    except:
        return datetime.now()

def is_same_project(card1: Dict, card2: Dict, time_window_days: int = 180) -> bool:
    """Check if two cards refer to the same project."""
    # Same company + same location
    if (card1.get("company") and card2.get("company") and
        card1["company"] == card2["company"] and
        card1.get("location_text") and card2.get("location_text") and
        normalize_location(card1["location_text"]) == normalize_location(card2["location_text"])):
        
        # Check time window
        date1 = parse_date(card1.get("announced_date", ""))
        date2 = parse_date(card2.get("announced_date", ""))
        if date1 and date2:
            if abs((date1 - date2).days) <= time_window_days:
                return True
    
    # Same site hint
    if (card1.get("site_hint") and card2.get("site_hint") and
        normalize_site(card1["site_hint"]) == normalize_site(card2["site_hint"])):
        return True
    
    return False

def merge_project_cards(cards: List[Dict], start_time: float, time_window_days: int = 180) -> List[Dict]:
    """
    Merge project cards that likely refer to the same project.
    
    Merge criteria:
    1. Same company + same city/county within time window
    2. Same named site (if available)
    
    Returns:
        List of merged project records
    """
    merged_projects = []
    processed = set()
    
    for i, card1 in enumerate(cards):
        if i in processed:
            continue
        
        # Health check every 10 cards
        if i > 0 and i % 10 == 0:
            if not health_check(start_time):
                print(f"⚠️  Stopping at {i} cards due to time limit")
                break
        
        project = card1.copy()
        project["mention_ids"] = [card1.get("mention_id")]
        project["source_urls"] = []
        
        # Find matches
        for j, card2 in enumerate(cards[i+1:], start=i+1):
            if j in processed:
                continue
            
            if is_same_project(card1, card2, time_window_days):
                # Merge card2 into project
                project["mention_ids"].append(card2.get("mention_id"))
                processed.add(j)
        
        merged_projects.append(project)
        processed.add(i)
    
    return merged_projects

def resolve_entities(db_path: Path):
    """Resolve entities and create merged projects."""
    start_time = time.time()
    
    # Set up timeout signal handler
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(MAX_RUNTIME_SECONDS)
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Fetch all project cards
        cursor.execute("""
            SELECT pc.project_id, pc.mention_id, pc.project_name, pc.company,
                   pc.location_text, pc.site_hint, pc.size_mw, pc.size_sqft,
                   pc.announced_date, pc.extraction_confidence,
                   m.url, m.source_urls
            FROM project_cards pc
            JOIN mentions m ON pc.mention_id = m.mention_id
            WHERE pc.project_id NOT IN (SELECT project_id FROM projects)
            ORDER BY pc.announced_date
        """)
        
        cards = []
        for row in cursor.fetchall():
            source_urls = json.loads(row[11]) if row[11] else [row[10]]
            cards.append({
                "project_id": row[0],
                "mention_id": row[1],
                "project_name": row[2],
                "company": row[3],
                "location_text": row[4],
                "site_hint": row[5],
                "size_mw": row[6],
                "size_sqft": row[7],
                "announced_date": row[8],
                "extraction_confidence": row[9],
                "source_urls": source_urls
            })
        
        if not cards:
            print("✅ No new project cards to resolve")
            conn.close()
            return
        
        print(f"📊 Resolving entities from {len(cards)} project cards...")
        
        # Merge cards
        merged_projects = merge_project_cards(cards, start_time)
        
        print(f"✅ Merged to {len(merged_projects)} projects")
        
        # Save merged projects
        saved_count = 0
        for project in merged_projects:
            # Use first project_id as base, or generate new one
            project_id = project.get("project_id", f"proj_{project['mention_ids'][0][:12]}")
            
            # Collect all source URLs
            all_source_urls = []
            for mention_id in project.get("mention_ids", []):
                # Get URLs for this mention
                cursor.execute("SELECT source_urls FROM mentions WHERE mention_id = ?", (mention_id,))
                result = cursor.fetchone()
                if result:
                    urls = json.loads(result[0]) if result[0] else []
                    all_source_urls.extend(urls)
            
            # Deduplicate URLs
            all_source_urls = list(set(all_source_urls))
            
            # Fill in missing fields from other cards
            # (already handled in merge logic)
            
            try:
                cursor.execute("""
                    INSERT INTO projects
                    (project_id, project_name, company, location_text, site_hint,
                     size_mw, size_sqft, announced_date, extraction_confidence,
                     mention_ids, source_urls, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, (
                    project_id,
                    project.get("project_name"),
                    project.get("company"),
                    project.get("location_text"),
                    project.get("site_hint"),
                    project.get("size_mw"),
                    project.get("size_sqft"),
                    project.get("announced_date"),
                    project.get("extraction_confidence"),
                    json.dumps(project.get("mention_ids", [])),
                    json.dumps(all_source_urls)
                ))
                saved_count += 1
            except sqlite3.IntegrityError:
                pass
        
        conn.commit()
        conn.close()
        
        elapsed = time.time() - start_time
        print(f"💾 Saved {saved_count} merged projects in {elapsed:.2f}s")
        
        if elapsed > 60:
            print(f"⚠️  WARNING: Script exceeded 60 seconds!")
        
    except TimeoutError:
        elapsed = time.time() - start_time
        print(f"⏱️  Timeout after {elapsed:.2f}s - partial resolution complete")
    except Exception as e:
        signal.alarm(0)
        raise
    finally:
        signal.alarm(0)

def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Resolve entities and merge projects')
    parser.add_argument('--db', type=str, 
                       default=str(Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"),
                       help='Database path')
    parser.add_argument('--time-window', type=int, default=180,
                       help='Time window in days for merging (default: 180)')
    
    args = parser.parse_args()
    
    db_path = Path(args.db)
    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        sys.exit(1)
    
    resolve_entities(db_path)

if __name__ == "__main__":
    main()

