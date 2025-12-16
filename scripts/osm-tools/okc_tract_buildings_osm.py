#!/usr/bin/env python3
"""
Download OSM buildings for OKC census tracts and organize by tract (GEOID).
Creates building GeoJSON files per tract and an index file for the OKCNeighborhoodsLayer component.

Usage:
    # Process all tracts (will take a long time - 1,205 tracts)
    python okc_tract_buildings_osm.py
    
    # Process only first 10 tracts (for testing)
    python okc_tract_buildings_osm.py --limit 10
    
    # Process specific tract by GEOID
    python okc_tract_buildings_osm.py --tract 40143006703
"""

import json
import os
import time
import math
import argparse
from pathlib import Path
from shapely.geometry import shape, Point, Polygon
import overpy

# OKC approximate bounding box (Oklahoma City metro area)
OKC_BBOX = {
    'lat_min': 35.2,
    'lat_max': 35.7,
    'lon_min': -97.8,
    'lon_max': -97.2
}

def calculate_bbox_from_geometry(geometry):
    """Calculate bounding box from a GeoJSON geometry."""
    if geometry['type'] == 'Polygon':
        coords = geometry['coordinates'][0]
    elif geometry['type'] == 'MultiPolygon':
        # Get all coordinates from all polygons
        coords = []
        for poly in geometry['coordinates']:
            coords.extend(poly[0])
    else:
        return None
    
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    
    return {
        'lat_min': min(lats),
        'lat_max': max(lats),
        'lon_min': min(lons),
        'lon_max': max(lons)
    }

def point_in_polygon(point, polygon_geom):
    """Check if a point is within a polygon using Shapely."""
    return polygon_geom.contains(point)

def download_buildings_for_tract(tract_geojson, tract_id, tract_name, api):
    """Download OSM buildings for a specific census tract."""
    geometry = tract_geojson['geometry']
    bbox = calculate_bbox_from_geometry(geometry)
    
    if not bbox:
        print(f"  ⚠️  Could not calculate bbox for tract {tract_id}")
        return []
    
    # Create Shapely geometry for filtering
    tract_polygon = shape(geometry)
    
    # Overpass query for buildings in the bounding box
    query = f"""
    [out:json][timeout:25];
    (
      way["building"]({bbox['lat_min']},{bbox['lon_min']},{bbox['lat_max']},{bbox['lon_max']});
      relation["building"]({bbox['lat_min']},{bbox['lon_min']},{bbox['lat_max']},{bbox['lon_max']});
    );
    out body;
    >;
    out skel qt;
    """
    
    max_retries = 3
    retry_delay = 5
    
    for attempt in range(max_retries):
        try:
            result = api.query(query)
            break
        except overpy.exception.OverpassGatewayTimeout:
            if attempt < max_retries - 1:
                print(f"    ⏳ Timeout, retrying in {retry_delay}s... (Attempt {attempt + 1}/{max_retries})")
                time.sleep(retry_delay)
                retry_delay *= 2
            else:
                print(f"    ❌ Failed after {max_retries} attempts")
                return []
        except Exception as e:
            print(f"    ❌ Error: {e}")
            return []
    
    # Process OSM data into GeoJSON features
    buildings = []
    nodes = {}
    
    # Index nodes (nodes are included in result when using 'out body; >;')
    for node in result.nodes:
        nodes[node.id] = [node.lon, node.lat]
    
    # Process ways (buildings)
    for way in result.ways:
        if not way.tags.get('building'):
            continue
        
        if not way.nodes or len(way.nodes) < 3:
            continue
        
        # Get coordinates for this way
        # way.nodes contains node objects when using 'out body; >;'
        coords = []
        for node_obj in way.nodes:
            # Node objects have .lon and .lat attributes
            if hasattr(node_obj, 'lon') and hasattr(node_obj, 'lat'):
                # Ensure coordinates are floats (not Decimal)
                coords.append([float(node_obj.lon), float(node_obj.lat)])
            elif hasattr(node_obj, 'id') and node_obj.id in nodes:
                # Fallback: use node ID lookup
                coord = nodes[node_obj.id]
                coords.append([float(coord[0]), float(coord[1])])
        
        if len(coords) < 3:
            continue
        
        # Close the polygon if needed
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        
        # Create polygon
        try:
            building_polygon = Polygon(coords)
        except Exception as e:
            print(f"    ⚠️  Invalid polygon for way {way.id}: {e}")
            continue
        
        # Check if building centroid is within tract boundary
        try:
            centroid = building_polygon.centroid
            if not tract_polygon.contains(centroid):
                # Also check if any part intersects
                if not tract_polygon.intersects(building_polygon):
                    continue
        except Exception as e:
            print(f"    ⚠️  Error checking building {way.id} against tract: {e}")
            continue
        
        # Extract height information
        height = None
        height_m = None
        levels = None
        
        if 'height' in way.tags:
            try:
                height_str = way.tags['height']
                # Remove units and convert
                if 'm' in height_str.lower():
                    height_m = float(height_str.lower().replace('m', '').strip())
                    height = height_m
                elif 'ft' in height_str.lower() or "'" in height_str:
                    height_ft = float(height_str.lower().replace('ft', '').replace("'", '').strip())
                    height_m = height_ft * 0.3048
                    height = height_m
                else:
                    # Assume meters if no unit
                    height_m = float(height_str)
                    height = height_m
            except:
                pass
        
        if 'building:levels' in way.tags:
            try:
                levels = int(way.tags['building:levels'])
                if not height_m:
                    # Estimate height from levels (3m per level)
                    height_m = levels * 3
            except:
                pass
        
        # Convert tags to JSON-serializable format (handle Decimal types)
        tags_serializable = {}
        for key, value in way.tags.items():
            # Convert Decimal to float/int
            if isinstance(value, (int, float, str, bool, type(None))):
                tags_serializable[key] = value
            else:
                # Convert Decimal or other types to string
                try:
                    tags_serializable[key] = float(value) if '.' in str(value) else int(value)
                except (ValueError, TypeError):
                    tags_serializable[key] = str(value)
        
        # Convert to GeoJSON
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Polygon',
                'coordinates': [coords]
            },
            'properties': {
                'osm_id': int(way.id),  # Ensure ID is int
                'building': str(way.tags.get('building', 'yes')),
                'name': str(way.tags.get('name', '')),
                'height': float(height) if height is not None else None,
                'height_m': float(height_m) if height_m is not None else None,
                'levels': int(levels) if levels is not None else None,
                'tract_id': str(tract_id),
                'tract_name': str(tract_name),
                'tags': tags_serializable
            }
        }
        
        buildings.append(feature)
    
    return buildings

def process_okc_tracts(limit=None, specific_tract=None):
    """Process OKC census tracts and download buildings.
    
    Args:
        limit: Maximum number of tracts to process (for testing)
        specific_tract: Process only this specific GEOID
    """
    print("\n" + "="*80)
    print("🏗️  OKC CENSUS TRACT BUILDINGS EXTRACTION")
    print("="*80)
    
    # Get script directory and project root
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    
    # Paths
    tracts_file = project_root / 'public' / 'okc_census_tracts.geojson'
    output_dir = project_root / 'public' / 'neighborhood_buildings'
    index_file = output_dir / 'neighborhood_index.json'
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    if not tracts_file.exists():
        print(f"❌ Census tracts file not found: {tracts_file}")
        print("   Run convert_shapefile_to_geojson.py first")
        return
    
    print(f"📂 Loading census tracts from: {tracts_file}")
    
    # Load census tracts
    with open(tracts_file, 'r') as f:
        tracts_data = json.load(f)
    
    tracts = tracts_data['features']
    
    # Filter tracts if needed
    if specific_tract:
        tracts = [t for t in tracts if t['properties'].get('GEOID') == specific_tract]
        if not tracts:
            print(f"❌ Tract {specific_tract} not found")
            return
        print(f"🎯 Processing specific tract: {specific_tract}")
    elif limit:
        tracts = tracts[:limit]
        print(f"🧪 Processing first {limit} tracts (testing mode)")
    
    print(f"📊 Processing {len(tracts)} census tracts")
    
    # Initialize Overpass API
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')
    
    # Process tracts and build index
    index = {}
    total_buildings = 0
    processed_tracts = 0
    skipped_tracts = 0
    
    # Batch writes to reduce file watcher triggers (write every 10 files)
    BATCH_SIZE = 10
    pending_writes = []
    
    print(f"\n🔍 Processing tracts and downloading buildings...")
    print(f"   (This may take a while - processing {len(tracts)} tracts)")
    print(f"   (Files will be written in batches of {BATCH_SIZE} to reduce reloads)\n")
    
    start_time = time.time()
    
    def default_encoder(obj):
        from decimal import Decimal
        if isinstance(obj, Decimal):
            return float(obj)
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
    
    def flush_pending_writes():
        """Write all pending building files at once"""
        for tract_id, buildings_data, buildings_file in pending_writes:
            try:
                # Write to temp file first, then rename (atomic operation)
                temp_file = buildings_file.with_suffix('.tmp')
                with open(temp_file, 'w') as f:
                    json.dump(buildings_data, f, default=default_encoder)
                temp_file.replace(buildings_file)
            except Exception as e:
                print(f"  ⚠️  Error writing {buildings_file.name}: {e}")
        pending_writes.clear()
    
    for i, tract in enumerate(tracts):
        tract_id = tract['properties'].get('GEOID', f"tract_{i}")
        tract_name = tract['properties'].get('NAME', tract['properties'].get('NAMELSAD', 'Unnamed Tract'))
        
        print(f"[{i+1}/{len(tracts)}] Processing tract {tract_id} ({tract_name})...")
        
        try:
            buildings = download_buildings_for_tract(tract, tract_id, tract_name, api)
            
            if buildings:
                # Prepare buildings file (but don't write yet - batch writes)
                buildings_file = output_dir / f"tract_{tract_id}_buildings.geojson"
                buildings_data = {
                    'type': 'FeatureCollection',
                    'features': buildings
                }
                
                # Add to pending writes (will be flushed in batches)
                pending_writes.append((tract_id, buildings_data, buildings_file))
                
                # Add to index
                index[tract_id] = {
                    'name': tract_name,
                    'building_count': len(buildings),
                    'file_path': f'/neighborhood_buildings/tract_{tract_id}_buildings.geojson'
                }
                
                total_buildings += len(buildings)
                processed_tracts += 1
                print(f"  ✅ Found {len(buildings)} buildings")
                
                # Flush writes in batches to reduce file watcher triggers
                if len(pending_writes) >= BATCH_SIZE:
                    flush_pending_writes()
                    print(f"  💾 Flushed batch of {BATCH_SIZE} files")
            else:
                skipped_tracts += 1
                print(f"  ⚠️  No buildings found")
            
            # Rate limiting - be nice to Overpass API
            time.sleep(1)
            
        except Exception as e:
            print(f"  ❌ Error processing tract {tract_id}: {e}")
            skipped_tracts += 1
            continue
    
    # Flush any remaining pending writes
    if pending_writes:
        flush_pending_writes()
        print(f"  💾 Flushed final batch of {len(pending_writes)} files")
    
    # Save index file (only at the end to minimize file watcher triggers)
    # Write to a temp file first, then rename (atomic operation)
    temp_index_file = index_file.with_suffix('.tmp')
    with open(temp_index_file, 'w') as f:
        json.dump(index, f, indent=2)
    temp_index_file.replace(index_file)
    
    end_time = time.time()
    duration = end_time - start_time
    
    print(f"\n" + "="*80)
    print(f"📊 EXTRACTION SUMMARY")
    print("="*80)
    print(f"⏱️  Duration: {duration:.1f} seconds")
    print(f"📁 Tracts processed: {processed_tracts}")
    print(f"⚠️  Tracts skipped (no buildings): {skipped_tracts}")
    print(f"🏗️  Total buildings: {total_buildings:,}")
    print(f"📂 Index file: {index_file}")
    print(f"📂 Buildings directory: {output_dir}")
    print(f"✅ Complete!")
    print("="*80)
    
    # Show sample of index
    if index:
        print(f"\n📋 Sample index entries (first 5):")
        for i, (tract_id, info) in enumerate(list(index.items())[:5]):
            print(f"   {tract_id}: {info['name']} ({info['building_count']} buildings)")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Download OSM buildings for OKC census tracts')
    parser.add_argument('--limit', type=int, help='Limit number of tracts to process (for testing)')
    parser.add_argument('--tract', type=str, help='Process only this specific GEOID')
    args = parser.parse_args()
    
    try:
        process_okc_tracts(limit=args.limit, specific_tract=args.tract)
    except KeyboardInterrupt:
        print("\n⚠️  Interrupted by user")
        exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

