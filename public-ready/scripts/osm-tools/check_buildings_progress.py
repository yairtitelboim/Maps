#!/usr/bin/env python3
"""
Quick script to check progress of OKC buildings download.
"""

import json
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
index_file = project_root / 'public' / 'neighborhood_buildings' / 'neighborhood_index.json'
tracts_file = project_root / 'public' / 'okc_census_tracts.geojson'

# Get total tracts
with open(tracts_file, 'r') as f:
    tracts_data = json.load(f)
total_tracts = len(tracts_data['features'])

# Get processed tracts
if index_file.exists():
    with open(index_file, 'r') as f:
        index = json.load(f)
    processed_tracts = len(index)
    total_buildings = sum(t['building_count'] for t in index.values())
    
    print(f"📊 OKC Buildings Download Progress")
    print(f"=" * 50)
    print(f"Total tracts: {total_tracts}")
    print(f"Processed: {processed_tracts}")
    print(f"Remaining: {total_tracts - processed_tracts}")
    print(f"Progress: {processed_tracts / total_tracts * 100:.1f}%")
    print(f"Total buildings: {total_buildings:,}")
    print(f"=" * 50)
    
    if processed_tracts > 0:
        avg_buildings = total_buildings / processed_tracts
        print(f"Average buildings per tract: {avg_buildings:.0f}")
        print(f"\nRecent tracts processed:")
        for tract_id, info in list(index.items())[-5:]:
            print(f"  {tract_id}: {info['name']} ({info['building_count']} buildings)")
else:
    print("❌ Index file not found. No tracts processed yet.")

