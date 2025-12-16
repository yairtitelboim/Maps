#!/usr/bin/env python3
"""
Rebuild the neighborhood_index.json from existing building files.
Useful for tracking progress while the download script is running.
"""

import json
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
buildings_dir = project_root / 'public' / 'neighborhood_buildings'
index_file = buildings_dir / 'neighborhood_index.json'
tracts_file = project_root / 'public' / 'okc_census_tracts.geojson'

# Load tracts to get names
tract_names = {}
if tracts_file.exists():
    with open(tracts_file, 'r') as f:
        tracts_data = json.load(f)
    for tract in tracts_data['features']:
        tract_id = tract['properties'].get('GEOID')
        tract_name = tract['properties'].get('NAME', tract['properties'].get('NAMELSAD', 'Unnamed Tract'))
        if tract_id:
            tract_names[tract_id] = tract_name

# Rebuild index from existing building files
index = {}
total_buildings = 0

print("🔍 Scanning existing building files...")

for building_file in buildings_dir.glob('tract_*_buildings.geojson'):
    # Extract tract ID from filename: tract_40143006703_buildings.geojson
    tract_id = building_file.stem.replace('tract_', '').replace('_buildings', '')
    
    try:
        with open(building_file, 'r') as f:
            buildings_data = json.load(f)
        
        building_count = len(buildings_data.get('features', []))
        tract_name = tract_names.get(tract_id, tract_id)
        
        index[tract_id] = {
            'name': tract_name,
            'building_count': building_count,
            'file_path': f'/neighborhood_buildings/{building_file.name}'
        }
        
        total_buildings += building_count
        
    except Exception as e:
        print(f"⚠️  Error reading {building_file.name}: {e}")

# Save updated index
with open(index_file, 'w') as f:
    json.dump(index, f, indent=2)

print(f"\n✅ Index rebuilt!")
print(f"   Tracts: {len(index)}")
print(f"   Total buildings: {total_buildings:,}")

