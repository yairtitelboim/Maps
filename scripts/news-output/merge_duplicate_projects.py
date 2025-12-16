#!/usr/bin/env python3
"""
Merge duplicate projects that have the same company and coordinates.
This handles cases where entity resolution didn't catch duplicates.
"""

import sys
import json
from pathlib import Path
import sqlite3
from collections import defaultdict

def merge_projects(db_path: Path, dry_run: bool = False):
    """Merge duplicate projects in the database."""
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Find projects with same company and coordinates
    print("🔍 Finding duplicate projects...")
    cursor.execute("""
        SELECT 
            lat,
            lng,
            company,
            COUNT(*) as count,
            GROUP_CONCAT(project_id, ', ') as project_ids
        FROM projects
        WHERE lat IS NOT NULL AND lng IS NOT NULL
        AND lat BETWEEN 25 AND 37 AND lng BETWEEN -107 AND -93
        AND company IS NOT NULL AND company != 'Unknown'
        GROUP BY lat, lng, company
        HAVING count > 1
        ORDER BY count DESC
    """)
    
    duplicate_groups = cursor.fetchall()
    
    if not duplicate_groups:
        print("✅ No duplicate projects found")
        conn.close()
        return
    
    print(f"📊 Found {len(duplicate_groups)} duplicate groups\n")
    
    merged_count = 0
    deleted_count = 0
    
    for lat, lng, company, count, project_ids in duplicate_groups:
        project_list = project_ids.split(', ')
        
        print(f"📍 ({lat:.6f}, {lng:.6f}) - {company}: {count} projects")
        
        # Get full details for all projects in this group
        placeholders = ','.join(['?' for _ in project_list])
        cursor.execute(f"""
            SELECT 
                project_id,
                project_name,
                company,
                location_text,
                site_hint,
                size_mw,
                size_sqft,
                announced_date,
                extraction_confidence,
                mention_ids,
                source_urls,
                lat,
                lng,
                geocode_confidence
            FROM projects
            WHERE project_id IN ({placeholders})
            ORDER BY announced_date DESC, extraction_confidence DESC
        """, project_list)
        
        projects = cursor.fetchall()
        
        # Choose the "best" project as the primary (most recent, best confidence)
        primary_project = projects[0]
        primary_id = primary_project[0]
        
        # Merge data from all projects
        all_mention_ids = set()
        all_source_urls = set()
        best_project_name = primary_project[1]
        best_location_text = primary_project[3]
        best_site_hint = primary_project[4]
        best_size_mw = primary_project[5]
        best_size_sqft = primary_project[6]
        earliest_date = primary_project[7]
        best_confidence = primary_project[8]
        
        print(f"   Primary: {primary_id}")
        
        for proj in projects[1:]:
            proj_id = proj[0]
            print(f"   Merging: {proj_id}")
            
            # Collect mention IDs
            try:
                mentions = json.loads(proj[9]) if proj[9] else []
                all_mention_ids.update(mentions)
            except:
                pass
            
            # Collect source URLs
            try:
                urls = json.loads(proj[10]) if proj[10] else []
                all_source_urls.update(urls)
            except:
                pass
            
            # Use best values (non-null, more specific)
            if proj[1] and (not best_project_name or len(proj[1]) > len(best_project_name)):
                best_project_name = proj[1]
            if proj[3] and (not best_location_text or len(proj[3]) > len(best_location_text)):
                best_location_text = proj[3]
            if proj[4] and (not best_site_hint or len(proj[4]) > len(best_site_hint)):
                best_site_hint = proj[4]
            if proj[5] and (not best_size_mw or proj[5] > best_size_mw):
                best_size_mw = proj[5]
            if proj[6] and (not best_size_sqft or proj[6] > best_size_sqft):
                best_size_sqft = proj[6]
            if proj[7] and (not earliest_date or proj[7] < earliest_date):
                earliest_date = proj[7]
            if proj[8] and (not best_confidence or proj[8] in ['high', 'medium'] and best_confidence not in ['high']):
                best_confidence = proj[8]
        
        # Add primary project's data
        try:
            primary_mentions = json.loads(primary_project[9]) if primary_project[9] else []
            all_mention_ids.update(primary_mentions)
        except:
            pass
        
        try:
            primary_urls = json.loads(primary_project[10]) if primary_project[10] else []
            all_source_urls.update(primary_urls)
        except:
            pass
        
        if not dry_run:
            # Update primary project with merged data
            cursor.execute("""
                UPDATE projects
                SET project_name = ?,
                    location_text = ?,
                    site_hint = ?,
                    size_mw = ?,
                    size_sqft = ?,
                    announced_date = ?,
                    extraction_confidence = ?,
                    mention_ids = ?,
                    source_urls = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE project_id = ?
            """, (
                best_project_name,
                best_location_text,
                best_site_hint,
                best_size_mw,
                best_size_sqft,
                earliest_date,
                best_confidence,
                json.dumps(list(all_mention_ids)),
                json.dumps(list(all_source_urls)),
                primary_id
            ))
            
            # Delete duplicate projects
            for proj in projects[1:]:
                cursor.execute("DELETE FROM projects WHERE project_id = ?", (proj[0],))
                deleted_count += 1
            
            merged_count += 1
            print(f"   ✅ Merged {count} projects into {primary_id}")
        else:
            print(f"   [DRY RUN] Would merge {count} projects into {primary_id}")
            print(f"      Mentions: {len(all_mention_ids)} total")
            print(f"      URLs: {len(all_source_urls)} total")
            merged_count += 1
            deleted_count += count - 1
        
        print()
    
    if not dry_run:
        conn.commit()
        print(f"✅ Merged {merged_count} duplicate groups")
        print(f"🗑️  Deleted {deleted_count} duplicate projects")
    else:
        print(f"[DRY RUN] Would merge {merged_count} duplicate groups")
        print(f"[DRY RUN] Would delete {deleted_count} duplicate projects")
    
    conn.close()

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Merge duplicate projects')
    parser.add_argument('--db', type=str,
                       default=str(Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"),
                       help='Database path')
    parser.add_argument('--dry-run', action='store_true',
                       help='Show what would be merged without actually merging')
    
    args = parser.parse_args()
    
    db_path = Path(args.db)
    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        sys.exit(1)
    
    merge_projects(db_path, dry_run=args.dry_run)

if __name__ == "__main__":
    main()

