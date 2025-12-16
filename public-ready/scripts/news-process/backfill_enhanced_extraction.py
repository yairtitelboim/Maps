#!/usr/bin/env python3
"""
Backfill script to apply enhanced extraction logic to all existing projects.

This script:
1. Re-extracts project names from all existing project_cards using enhanced logic
2. Updates project_cards table with new project names
3. Updates projects table with aggregated new project names
4. Re-exports GeoJSON file
"""

import sys
import time
import signal
import sqlite3
import json
from pathlib import Path
from extract_project_cards import extract_project_card

# Timeout configuration
MAX_RUNTIME_SECONDS = 300  # 5 minutes for backfill
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

def backfill_project_cards(db_path: Path, dry_run: bool = False):
    """Re-extract project names for all existing project_cards."""
    start_time = time.time()
    
    # Set up timeout signal handler
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(MAX_RUNTIME_SECONDS)
    
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get all project_cards with their source mentions
        cursor.execute("""
            SELECT 
                pc.id,
                pc.project_id,
                pc.mention_id,
                pc.project_name as old_project_name,
                pc.company as old_company,
                pc.location_text as old_location,
                m.title,
                m.snippet,
                m.published_at,
                COALESCE(m.canonical_url, m.url) as url
            FROM project_cards pc
            JOIN mentions m ON pc.mention_id = m.mention_id
            ORDER BY m.published_at DESC
        """)
        
        rows = cursor.fetchall()
        
        if not rows:
            print("✅ No project cards to backfill")
            conn.close()
            return
        
        print(f"📊 Backfilling {len(rows)} project cards with enhanced extraction...")
        print("=" * 80)
        
        updated_count = 0
        improved_count = 0
        unchanged_count = 0
        
        for i, row in enumerate(rows):
            # Health check every 50 cards
            if i > 0 and i % 50 == 0:
                if not health_check(start_time):
                    print(f"⚠️  Stopping at {i} cards due to time limit")
                    break
                elapsed = time.time() - start_time
                print(f"   Processed {i}/{len(rows)} cards ({elapsed:.1f}s)...")
            
            mention = {
                'mention_id': row['mention_id'],
                'title': row['title'] or '',
                'snippet': row['snippet'] or '',
                'published_at': row['published_at'],
                'url': row['url'] if 'url' in row.keys() and row['url'] else None,
                'canonical_url': row['url'] if 'url' in row.keys() and row['url'] else None
            }
            
            old_name = row['old_project_name'] or 'Unknown Project'
            old_company = row['old_company'] or 'Unknown'
            old_location = row['old_location'] or ''
            
            # Re-extract using enhanced logic
            new_card = extract_project_card(mention)
            new_name = new_card['project_name'] or 'Unknown Project'
            new_company = new_card['company'] or 'Unknown'
            new_location = new_card['location_text'] or ''
            
            # Check if improved
            was_unknown = (old_name == 'Unknown Project' or not old_name)
            is_unknown = (new_name == 'Unknown Project' or not new_name)
            
            if was_unknown and not is_unknown:
                improved_count += 1
            
            # Update if changed
            if new_name != old_name or new_company != old_company or new_location != old_location:
                if not dry_run:
                    cursor.execute("""
                        UPDATE project_cards
                        SET project_name = ?,
                            company = ?,
                            location_text = ?,
                            extraction_confidence = ?
                        WHERE id = ?
                    """, (
                        new_name if new_name != 'Unknown Project' else None,
                        new_company if new_company != 'Unknown' else None,
                        new_location if new_location else None,
                        new_card['extraction_confidence'],
                        row['id']
                    ))
                updated_count += 1
            else:
                unchanged_count += 1
        
        if not dry_run:
            conn.commit()
        
        conn.close()
        
        elapsed = time.time() - start_time
        print(f"\n✅ Backfill complete in {elapsed:.2f}s")
        print(f"   Updated: {updated_count}")
        print(f"   Improved (Unknown → Named): {improved_count}")
        print(f"   Unchanged: {unchanged_count}")
        
        if dry_run:
            print("\n⚠️  DRY RUN - No changes were saved to database")
        
        return {
            'updated': updated_count,
            'improved': improved_count,
            'unchanged': unchanged_count,
            'total': len(rows)
        }
        
    except TimeoutError:
        elapsed = time.time() - start_time
        print(f"⏱️  Timeout after {elapsed:.2f}s - partial backfill complete")
        if not dry_run:
            conn.commit()
        conn.close()
    except Exception as e:
        signal.alarm(0)
        raise
    finally:
        signal.alarm(0)

def update_projects_from_cards(db_path: Path, dry_run: bool = False):
    """Update projects table with aggregated data from updated project_cards."""
    start_time = time.time()
    
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    print(f"\n📊 Updating projects table from project_cards...")
    
    # Get all projects
    cursor.execute("SELECT project_id FROM projects")
    project_ids = [row[0] for row in cursor.fetchall()]
    
    updated_projects = 0
    
    for project_id in project_ids:
        # Get all project_cards for this project
        cursor.execute("""
            SELECT 
                project_name,
                company,
                location_text,
                site_hint,
                size_mw,
                size_sqft,
                announced_date,
                extraction_confidence
            FROM project_cards
            WHERE project_id = ?
            ORDER BY announced_date DESC
        """, (project_id,))
        
        cards = cursor.fetchall()
        
        if not cards:
            continue
        
        # Aggregate: use most recent/complete data
        # Prefer non-null, non-"Unknown" values
        best_name = None
        best_company = None
        best_location = None
        best_site_hint = None
        best_size_mw = None
        best_size_sqft = None
        best_date = None
        best_confidence = 'low'
        
        for card in cards:
            if not best_name and card['project_name'] and card['project_name'] != 'Unknown Project':
                best_name = card['project_name']
            if not best_company and card['company'] and card['company'] != 'Unknown':
                best_company = card['company']
            if not best_location and card['location_text']:
                best_location = card['location_text']
            if not best_site_hint and card['site_hint']:
                best_site_hint = card['site_hint']
            if not best_size_mw and card['size_mw']:
                best_size_mw = card['size_mw']
            if not best_size_sqft and card['size_sqft']:
                best_size_sqft = card['size_sqft']
            if not best_date and card['announced_date']:
                best_date = card['announced_date']
            if card['extraction_confidence'] in ['high', 'medium']:
                best_confidence = card['extraction_confidence']
        
        # Update project
        if not dry_run:
            cursor.execute("""
                UPDATE projects
                SET project_name = ?,
                    company = ?,
                    location_text = ?,
                    site_hint = ?,
                    size_mw = ?,
                    size_sqft = ?,
                    announced_date = ?,
                    extraction_confidence = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE project_id = ?
            """, (
                best_name,
                best_company,
                best_location,
                best_site_hint,
                best_size_mw,
                best_size_sqft,
                best_date,
                best_confidence,
                project_id
            ))
        
        updated_projects += 1
    
    if not dry_run:
        conn.commit()
    
    conn.close()
    
    elapsed = time.time() - start_time
    print(f"✅ Updated {updated_projects} projects in {elapsed:.2f}s")
    
    if dry_run:
        print("⚠️  DRY RUN - No changes were saved to database")

def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Backfill enhanced extraction to existing projects')
    parser.add_argument('--db', type=str, 
                       default=str(Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"),
                       help='Database path')
    parser.add_argument('--dry-run', action='store_true',
                       help='Run in dry-run mode (no database changes)')
    parser.add_argument('--skip-projects', action='store_true',
                       help='Skip updating projects table (only update project_cards)')
    parser.add_argument('--skip-export', action='store_true',
                       help='Skip GeoJSON export')
    
    args = parser.parse_args()
    
    db_path = Path(args.db)
    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        sys.exit(1)
    
    print("🔄 Starting backfill of enhanced extraction...")
    if args.dry_run:
        print("⚠️  DRY RUN MODE - No changes will be saved")
    print("=" * 80)
    
    # Step 1: Backfill project_cards
    stats = backfill_project_cards(db_path, dry_run=args.dry_run)
    
    # Step 2: Update projects table
    if not args.skip_projects:
        update_projects_from_cards(db_path, dry_run=args.dry_run)
    
    # Step 3: Re-export GeoJSON
    if not args.skip_export:
        print(f"\n📤 Re-exporting GeoJSON...")
        try:
            # Add news-output to path
            import sys
            output_path = Path(__file__).parent.parent / 'news-output'
            if str(output_path) not in sys.path:
                sys.path.insert(0, str(output_path))
            
            from export_projects_geojson import export_projects_to_geojson
            count = export_projects_to_geojson()
            print(f"✅ Exported {count} projects to GeoJSON")
        except Exception as e:
            print(f"⚠️  Failed to export GeoJSON: {e}")
            print("   You can manually run: python scripts/news-output/export_projects_geojson.py")
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 80)
    print("✅ Backfill complete!")
    if stats:
        print(f"\n📊 Summary:")
        print(f"   Total processed: {stats['total']}")
        print(f"   Updated: {stats['updated']}")
        print(f"   Improved (Unknown → Named): {stats['improved']}")
        print(f"   Unchanged: {stats['unchanged']}")

if __name__ == "__main__":
    main()

