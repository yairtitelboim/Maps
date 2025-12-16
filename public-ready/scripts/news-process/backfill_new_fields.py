#!/usr/bin/env python3
"""
Backfill new extraction fields (expected_completion_date, probability_score, size_acres)
to existing project_cards and projects.
"""
import sqlite3
import time
import signal
import argparse
from pathlib import Path
from typing import Dict, List
import json
import sys

# Add scripts to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import the extraction function
import importlib.util
spec = importlib.util.spec_from_file_location('extract_project_cards', 
    Path(__file__).parent / 'extract_project_cards.py')
extract_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extract_module)

# Timeout configuration
MAX_RUNTIME_SECONDS = 55
TIMEOUT_EXCEEDED = False

def timeout_handler(signum, frame):
    global TIMEOUT_EXCEEDED
    TIMEOUT_EXCEEDED = True
    print("\n⚠️  Timeout approaching - stopping gracefully...")
    raise TimeoutError("Script exceeded maximum runtime")

def health_check(start_time: float) -> bool:
    elapsed = time.time() - start_time
    if elapsed > MAX_RUNTIME_SECONDS:
        return False
    return True

def backfill_project_cards(db_path: Path, dry_run: bool = False):
    """Re-extract new fields for all existing project cards."""
    start_time = time.time()
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(MAX_RUNTIME_SECONDS)

    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Get all project cards with their mentions
        cursor.execute("""
            SELECT 
                pc.id,
                pc.project_id,
                pc.mention_id,
                m.title,
                m.snippet,
                m.published_at,
                m.url,
                m.canonical_url,
                m.raw_text
            FROM project_cards pc
            JOIN mentions m ON pc.mention_id = m.mention_id
            ORDER BY m.published_at DESC
        """)
        
        rows = cursor.fetchall()
        total = len(rows)
        
        print(f"📊 Found {total} project cards to update")
        print("=" * 80)
        
        if dry_run:
            print("🔍 DRY RUN MODE - No changes will be saved")
            print()
        
        updated_count = 0
        new_acres = 0
        new_expected_date = 0
        new_probability = 0
        
        for i, row in enumerate(rows):
            # Health check every 20 rows
            if i > 0 and i % 20 == 0:
                if not health_check(start_time):
                    print(f"\n⚠️  Stopping at {i}/{total} due to time limit")
                    break
            
            mention = {
                'mention_id': row['mention_id'],
                'title': row['title'] or '',
                'snippet': row['snippet'] or '',
                'published_at': row['published_at'],
                'url': row['url'] or '',
                'canonical_url': row['canonical_url'] or '',
                'raw_text': row['raw_text'] or ''
            }
            
            # Re-extract
            card = extract_module.extract_project_card(mention)
            
            # Check if we have new data
            has_new_data = (
                card.get('size_acres') is not None or
                card.get('expected_completion_date') is not None or
                card.get('probability_score') != 'unknown'
            )
            
            if has_new_data:
                if card.get('size_acres'):
                    new_acres += 1
                if card.get('expected_completion_date'):
                    new_expected_date += 1
                if card.get('probability_score') != 'unknown':
                    new_probability += 1
                
                if not dry_run:
                    cursor.execute("""
                        UPDATE project_cards
                        SET size_acres = ?,
                            expected_completion_date = ?,
                            probability_score = ?
                        WHERE id = ?
                    """, (
                        card.get('size_acres'),
                        card.get('expected_completion_date'),
                        card.get('probability_score'),
                        row['id']
                    ))
                    updated_count += 1
                else:
                    updated_count += 1
                    if updated_count <= 5:  # Show first 5 examples
                        print(f"  Would update: {row['title'][:60]}...")
                        if card.get('size_acres'):
                            print(f"    → Acres: {card['size_acres']}")
                        if card.get('expected_completion_date'):
                            print(f"    → Expected: {card['expected_completion_date']}")
                        if card.get('probability_score') != 'unknown':
                            print(f"    → Probability: {card['probability_score']}")
        
        if not dry_run:
            conn.commit()
            print(f"\n✅ Updated {updated_count} project cards")
        else:
            print(f"\n🔍 Would update {updated_count} project cards")
        
        print(f"   • New acres: {new_acres}")
        print(f"   • New expected dates: {new_expected_date}")
        print(f"   • New probability scores: {new_probability}")
        
        # Now update projects table (aggregated from project_cards)
        if not dry_run and updated_count > 0:
            print("\n📊 Updating projects table...")
            # Get all projects and update them one by one
            cursor.execute("SELECT project_id FROM projects")
            project_ids = [row[0] for row in cursor.fetchall()]
            
            projects_updated = 0
            for project_id in project_ids:
                # Get aggregated values from project_cards
                cursor.execute("""
                    SELECT 
                        AVG(size_acres) as avg_acres,
                        (SELECT expected_completion_date 
                         FROM project_cards 
                         WHERE project_id = ? AND expected_completion_date IS NOT NULL
                         ORDER BY created_at DESC LIMIT 1) as expected_date,
                        (SELECT probability_score 
                         FROM project_cards 
                         WHERE project_id = ? AND probability_score != 'unknown'
                         ORDER BY 
                             CASE probability_score 
                                 WHEN 'high' THEN 1 
                                 WHEN 'medium' THEN 2 
                                 WHEN 'low' THEN 3 
                                 ELSE 4 
                             END
                         LIMIT 1) as prob_score
                    FROM project_cards
                    WHERE project_id = ?
                """, (project_id, project_id, project_id))
                
                result = cursor.fetchone()
                if result:
                    avg_acres = result[0]
                    expected_date = result[1]
                    prob_score = result[2] or 'unknown'
                    
                    cursor.execute("""
                        UPDATE projects
                        SET size_acres = ?,
                            expected_completion_date = ?,
                            probability_score = ?
                        WHERE project_id = ?
                    """, (avg_acres, expected_date, prob_score, project_id))
                    projects_updated += 1
            
            conn.commit()
            print(f"✅ Updated {projects_updated} projects")
        
        conn.close()
        
    except TimeoutError:
        print("\n⚠️  Script timed out - partial update completed")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        signal.alarm(0)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Backfill new extraction fields')
    parser.add_argument('--dry-run', action='store_true', help='Dry run mode (no changes)')
    args = parser.parse_args()
    
    db_path = Path(__file__).parent.parent.parent / 'data' / 'news' / 'news_pipeline.db'
    
    if not db_path.exists():
        print(f"❌ Database not found: {db_path}")
        sys.exit(1)
    
    backfill_project_cards(db_path, dry_run=args.dry_run)

