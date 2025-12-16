#!/usr/bin/env python3
"""
Download remaining OKC census tract buildings.

This script:
1. Checks which tracts have already been processed
2. Identifies remaining tracts that need buildings
3. Downloads buildings for only the missing tracts
4. Updates the index incrementally

Usage:
    python3 scripts/osm-tools/download_remaining_buildings.py
    
    # Process only first 10 remaining tracts (for testing)
    python3 scripts/osm-tools/download_remaining_buildings.py --limit 10
    
    # Resume from a specific tract
    python3 scripts/osm-tools/download_remaining_buildings.py --start-from 40143006703
"""

import json
import time
import argparse
from pathlib import Path
from shapely.geometry import shape, Polygon
import overpy

# Import helper functions from the main script
import sys
sys.path.insert(0, str(Path(__file__).parent))
from okc_tract_buildings_osm import (
    download_buildings_for_tract,
    calculate_bbox_from_geometry
)

def default_encoder(obj):
    """JSON encoder for Decimal types."""
    from decimal import Decimal
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

def get_processed_tracts(index_file):
    """Get set of already processed tract GEOIDs."""
    if not index_file.exists():
        return set()
    
    try:
        with open(index_file, 'r') as f:
            index = json.load(f)
        return set(index.keys())
    except:
        return set()

def get_all_tracts(tracts_file):
    """Get all tract GEOIDs from the census tracts file."""
    with open(tracts_file, 'r') as f:
        tracts_data = json.load(f)
    
    tracts = []
    for tract in tracts_data['features']:
        tract_id = tract['properties'].get('GEOID')
        if tract_id:
            tracts.append((tract_id, tract))
    
    return tracts

def update_index(index_file, tract_id, tract_name, building_count, file_path):
    """Update the index file with a new tract entry."""
    # Load existing index
    if index_file.exists():
        with open(index_file, 'r') as f:
            index = json.load(f)
    else:
        index = {}
    
    # Add or update entry
    index[tract_id] = {
        'name': tract_name,
        'building_count': building_count,
        'file_path': file_path
    }
    
    # Save updated index (write to temp, then rename for atomic operation)
    temp_file = index_file.with_suffix('.tmp')
    with open(temp_file, 'w') as f:
        json.dump(index, f, indent=2)
    temp_file.replace(index_file)

def download_remaining():
    """Download buildings for remaining tracts."""
    print("\n" + "="*80)
    print("🏗️  OKC CENSUS TRACT BUILDINGS - DOWNLOAD REMAINING")
    print("="*80)
    
    # Get paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    
    tracts_file = project_root / 'public' / 'okc_census_tracts.geojson'
    output_dir = project_root / 'public' / 'neighborhood_buildings'
    index_file = output_dir / 'neighborhood_index.json'
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    if not tracts_file.exists():
        print(f"❌ Census tracts file not found: {tracts_file}")
        return
    
    # Get processed and all tracts
    print("📊 Analyzing current progress...")
    processed = get_processed_tracts(index_file)
    all_tracts = get_all_tracts(tracts_file)
    
    print(f"   Total tracts: {len(all_tracts)}")
    print(f"   Already processed: {len(processed)}")
    
    # Find remaining tracts
    remaining = [(tract_id, tract) for tract_id, tract in all_tracts if tract_id not in processed]
    
    if not remaining:
        print("✅ All tracts have been processed!")
        return
    
    print(f"   Remaining: {len(remaining)}")
    print(f"   Progress: {len(processed) / len(all_tracts) * 100:.1f}%")
    
    # Parse arguments
    parser = argparse.ArgumentParser(description='Download remaining OKC tract buildings')
    parser.add_argument('--limit', type=int, help='Limit number of tracts to process (for testing)')
    parser.add_argument('--start-from', type=str, help='Start from this specific GEOID')
    args = parser.parse_args()
    
    # Filter remaining tracts
    if args.start_from:
        # Find the starting point
        start_idx = None
        for i, (tract_id, _) in enumerate(remaining):
            if tract_id == args.start_from:
                start_idx = i
                break
        if start_idx is not None:
            remaining = remaining[start_idx:]
            print(f"🎯 Starting from tract: {args.start_from}")
        else:
            print(f"⚠️  Tract {args.start_from} not found in remaining tracts")
    
    if args.limit:
        remaining = remaining[:args.limit]
        print(f"🧪 Processing first {args.limit} remaining tracts (testing mode)")
    
    print(f"\n🔍 Processing {len(remaining)} remaining tracts...")
    print(f"   (This may take a while)\n")
    
    # Initialize API
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')
    
    # Process remaining tracts
    total_buildings = 0
    processed_count = 0
    skipped_count = 0
    start_time = time.time()
    
    for i, (tract_id, tract) in enumerate(remaining):
        tract_name = tract['properties'].get('NAME', tract['properties'].get('NAMELSAD', 'Unnamed Tract'))
        
        print(f"[{i+1}/{len(remaining)}] Processing tract {tract_id} ({tract_name})...")
        
        try:
            buildings = download_buildings_for_tract(tract, tract_id, tract_name, api)
            
            if buildings:
                # Save buildings file
                buildings_file = output_dir / f"tract_{tract_id}_buildings.geojson"
                buildings_data = {
                    'type': 'FeatureCollection',
                    'features': buildings
                }
                
                # Write to temp file first, then rename (atomic operation)
                temp_file = buildings_file.with_suffix('.tmp')
                with open(temp_file, 'w') as f:
                    json.dump(buildings_data, f, default=default_encoder)
                temp_file.replace(buildings_file)
                
                # Update index incrementally
                file_path = f'/neighborhood_buildings/tract_{tract_id}_buildings.geojson'
                update_index(index_file, tract_id, tract_name, len(buildings), file_path)
                
                total_buildings += len(buildings)
                processed_count += 1
                print(f"  ✅ Found {len(buildings)} buildings (Total: {total_buildings:,})")
            else:
                # Still add to index with 0 buildings so we don't keep trying it
                file_path = f'/neighborhood_buildings/tract_{tract_id}_buildings.geojson'
                update_index(index_file, tract_id, tract_name, 0, file_path)
                
                # Create empty file to mark as processed
                buildings_file = output_dir / f"tract_{tract_id}_buildings.geojson"
                empty_data = {
                    'type': 'FeatureCollection',
                    'features': []
                }
                temp_file = buildings_file.with_suffix('.tmp')
                with open(temp_file, 'w') as f:
                    json.dump(empty_data, f)
                temp_file.replace(buildings_file)
                
                processed_count += 1
                skipped_count += 1
                print(f"  ⚠️  No buildings found (marked as processed)")
            
            # Rate limiting
            time.sleep(1)
            
        except KeyboardInterrupt:
            print(f"\n⚠️  Interrupted by user")
            print(f"   Processed {processed_count} tracts in this session")
            print(f"   Progress saved - you can resume later")
            break
        except Exception as e:
            print(f"  ❌ Error: {e}")
            skipped_count += 1
            continue
    
    end_time = time.time()
    duration = end_time - start_time
    
    # Final summary
    processed_after = get_processed_tracts(index_file)
    remaining_after = len(all_tracts) - len(processed_after)
    
    print(f"\n" + "="*80)
    print(f"📊 SESSION SUMMARY")
    print("="*80)
    print(f"⏱️  Duration: {duration:.1f} seconds")
    print(f"📁 Tracts processed this session: {processed_count}")
    print(f"⚠️  Tracts skipped: {skipped_count}")
    print(f"🏗️  Buildings downloaded: {total_buildings:,}")
    print(f"\n📊 OVERALL PROGRESS")
    print(f"   Processed: {len(processed_after)} / {len(all_tracts)}")
    print(f"   Remaining: {remaining_after}")
    print(f"   Progress: {len(processed_after) / len(all_tracts) * 100:.1f}%")
    print("="*80)
    
    if remaining_after > 0:
        print(f"\n💡 To continue downloading remaining tracts:")
        print(f"   python3 scripts/osm-tools/download_remaining_buildings.py")
    else:
        print(f"\n🎉 All tracts have been processed!")

if __name__ == '__main__':
    try:
        download_remaining()
    except KeyboardInterrupt:
        print("\n⚠️  Interrupted by user")
        exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

