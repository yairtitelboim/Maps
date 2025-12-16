#!/usr/bin/env python3
"""
Merge parsed project data with geocoding and spatial enrichment.

Combines:
- Parsed individual project pages
- County geocoding
- Distance calculations
- Substation proximity (optional)
- Final JSON and GeoJSON generation
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
from math import radians, cos, sin, asin, sqrt

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from interconnection_fyi.ohio_county_centroids import get_county_centroid


def haversine_distance(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """
    Calculate haversine distance between two points in kilometers.
    
    Args:
        lon1, lat1: First point coordinates
        lon2, lat2: Second point coordinates
    
    Returns:
        Distance in kilometers
    """
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371  # Earth radius in km
    return c * r


def enrich_with_geography(projects: List[Dict]) -> List[Dict]:
    """Add geographic coordinates based on county centroids."""
    enriched = []
    
    for project in projects:
        county = project.get('county')
        state = project.get('state')
        
        # Only geocode if we have county and it's Ohio
        if county and state == 'OH':
            centroid = get_county_centroid(county)
            if centroid:
                lat, lng = centroid
                project['latitude'] = lat
                project['longitude'] = lng
                project['coordinates'] = [lng, lat]  # GeoJSON format (lng, lat)
            else:
                project['latitude'] = None
                project['longitude'] = None
                project['coordinates'] = None
        else:
            # Non-Ohio projects - skip geocoding for now
            project['latitude'] = None
            project['longitude'] = None
            project['coordinates'] = None
        
        enriched.append(project)
    
    return enriched


def calculate_distances_to_columbus(projects: List[Dict]) -> List[Dict]:
    """Calculate distances to Columbus center."""
    columbus_lat = 39.9612
    columbus_lng = -82.9988
    
    enriched = []
    for project in projects:
        if project.get('latitude') and project.get('longitude'):
            lat = project['latitude']
            lng = project['longitude']
            distance_km = haversine_distance(lng, lat, columbus_lng, columbus_lat)
            project['distance_to_columbus_center_km'] = round(distance_km, 2)
            project['is_near_columbus_10mi'] = distance_km <= 16.09  # 10 miles in km
        else:
            project['distance_to_columbus_center_km'] = None
            project['is_near_columbus_10mi'] = False
        
        enriched.append(project)
    
    return enriched


def find_nearest_substation(project: Dict, substations: List[Dict]) -> Optional[Dict]:
    """
    Find nearest substation to a project.
    
    Args:
        project: Project dictionary with lat/lng
        substations: List of substation dictionaries with lat/lng
    
    Returns:
        Nearest substation dict with distance, or None
    """
    if not project.get('latitude') or not project.get('longitude'):
        return None
    
    project_lat = project['latitude']
    project_lng = project['longitude']
    
    nearest = None
    min_distance = float('inf')
    
    for substation in substations:
        coords = substation.get('geometry', {}).get('coordinates', [])
        if not coords or len(coords) < 2:
            continue
        
        # GeoJSON format: [lng, lat]
        try:
            substation_lng = float(coords[0])
            substation_lat = float(coords[1])
        except (ValueError, TypeError, IndexError):
            continue
        
        if not isinstance(substation_lng, (int, float)) or not isinstance(substation_lat, (int, float)):
            continue
        
        distance = haversine_distance(project_lng, project_lat, substation_lng, substation_lat)
        
        if distance < min_distance:
            min_distance = distance
            nearest = {
                'substation_id': substation.get('properties', {}).get('id'),
                'substation_name': substation.get('properties', {}).get('name'),
                'voltage_kv': substation.get('properties', {}).get('voltage_kv'),
                'distance_km': round(distance, 2)
            }
    
    return nearest


def enrich_with_substations(projects: List[Dict], substations_file: Optional[Path] = None) -> List[Dict]:
    """Enrich projects with nearest substation information."""
    if not substations_file or not substations_file.exists():
        print("⚠️  Substations file not found, skipping substation enrichment")
        return projects
    
    # Load substations
    with open(substations_file, 'r') as f:
        substations_data = json.load(f)
    
    substations = substations_data.get('features', [])
    print(f"📡 Loaded {len(substations)} substations for proximity analysis")
    
    enriched = []
    for i, project in enumerate(projects):
        if (i + 1) % 10 == 0:
            print(f"   Processing project {i + 1}/{len(projects)}...")
        
        nearest = find_nearest_substation(project, substations)
        
        if nearest:
            project['nearest_substation_id'] = nearest['substation_id']
            project['nearest_substation_name'] = nearest['substation_name']
            project['nearest_substation_voltage_kv'] = nearest['voltage_kv']
            project['distance_to_nearest_substation_km'] = nearest['distance_km']
            project['is_within_5mi_substation'] = nearest['distance_km'] <= 8.05  # 5 miles in km
        else:
            project['nearest_substation_id'] = None
            project['nearest_substation_name'] = None
            project['nearest_substation_voltage_kv'] = None
            project['distance_to_nearest_substation_km'] = None
            project['is_within_5mi_substation'] = False
        
        enriched.append(project)
    
    return enriched


def generate_metadata(projects: List[Dict]) -> Dict:
    """Generate metadata summary."""
    status_breakdown = {}
    gen_type_breakdown = {}
    state_breakdown = {}
    total_capacity_min = 0
    total_capacity_max = 0
    ohio_count = 0
    geocoded_count = 0
    
    for project in projects:
        status = project.get('status', 'unknown')
        status_breakdown[status] = status_breakdown.get(status, 0) + 1
        
        gen_type = project.get('generation_type', 'unknown')
        gen_type_breakdown[gen_type] = gen_type_breakdown.get(gen_type, 0) + 1
        
        state = project.get('state', 'unknown')
        state_breakdown[state] = state_breakdown.get(state, 0) + 1
        
        if state == 'OH':
            ohio_count += 1
        
        if project.get('latitude') and project.get('longitude'):
            geocoded_count += 1
        
        if project.get('capacity_min_mw'):
            total_capacity_min += project['capacity_min_mw']
        if project.get('capacity_max_mw'):
            total_capacity_max += project['capacity_max_mw']
    
    return {
        'source': 'interconnection.fyi',
        'source_url': 'https://www.interconnection.fyi/?state=OH',
        'merged_at': datetime.now().isoformat(),
        'total_projects': len(projects),
        'ohio_projects': ohio_count,
        'geocoded_projects': geocoded_count,
        'status_breakdown': status_breakdown,
        'generation_type_breakdown': gen_type_breakdown,
        'state_breakdown': state_breakdown,
        'total_capacity_min_mw': round(total_capacity_min, 2),
        'total_capacity_max_mw': round(total_capacity_max, 2)
    }


def create_geojson(projects: List[Dict]) -> Dict:
    """Create GeoJSON FeatureCollection from projects."""
    features = []
    
    for project in projects:
        if not project.get('coordinates'):
            continue
        
        # Create feature properties (exclude geographic fields)
        properties = {
            k: v for k, v in project.items()
            if k not in ['coordinates', 'latitude', 'longitude']
        }
        
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': project['coordinates']
            },
            'properties': properties
        }
        features.append(feature)
    
    return {
        'type': 'FeatureCollection',
        'features': features
    }


def main():
    """Main merging function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Merge parsed project data with geocoding')
    parser.add_argument('--parsed-file', default='data/interconnection_fyi/parsed_projects.json',
                       help='Input file with parsed projects')
    parser.add_argument('--substations-file', default='public/osm/aep_ohio_substations.json',
                       help='Substations GeoJSON file for proximity analysis')
    parser.add_argument('--output-dir', default='data/interconnection_fyi',
                       help='Output directory for JSON files')
    parser.add_argument('--public-dir', default='public/data',
                       help='Public directory for GeoJSON files')
    parser.add_argument('--skip-substations', action='store_true',
                       help='Skip substation proximity analysis')
    
    args = parser.parse_args()
    
    # Load parsed projects
    parsed_file = Path(args.parsed_file)
    if not parsed_file.exists():
        print(f"❌ Parsed projects file not found: {parsed_file}")
        print(f"   Run: python3 scripts/interconnection_fyi/parse_individual_project.py")
        sys.exit(1)
    
    print(f"📖 Loading parsed projects from {parsed_file}...")
    with open(parsed_file, 'r') as f:
        parsed_data = json.load(f)
    
    projects = parsed_data.get('projects', [])
    print(f"   Loaded {len(projects)} projects")
    
    # Step 1: Geocode counties
    print("\n🗺️  Geocoding counties...")
    projects = enrich_with_geography(projects)
    geocoded = sum(1 for p in projects if p.get('coordinates'))
    print(f"   Geocoded {geocoded}/{len(projects)} projects")
    
    # Step 2: Calculate distances to Columbus
    print("\n📏 Calculating distances to Columbus...")
    projects = calculate_distances_to_columbus(projects)
    near_columbus = sum(1 for p in projects if p.get('is_near_columbus_10mi'))
    print(f"   {near_columbus} projects within 10 miles of Columbus")
    
    # Step 3: Enrich with substations (optional)
    if not args.skip_substations:
        substations_file = Path(args.substations_file)
        if substations_file.exists():
            print("\n📡 Enriching with substation proximity...")
            projects = enrich_with_substations(projects, substations_file)
        else:
            print(f"\n⚠️  Substations file not found: {substations_file}")
            print("   Skipping substation enrichment")
    
    # Step 4: Generate metadata
    print("\n📊 Generating metadata...")
    metadata = generate_metadata(projects)
    
    # Step 5: Create output structures
    output_data = {
        'metadata': metadata,
        'projects': projects
    }
    
    # Create GeoJSON
    geojson = create_geojson(projects)
    
    # Write files
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    public_dir = Path(args.public_dir)
    public_dir.mkdir(parents=True, exist_ok=True)
    
    json_path = output_dir / 'aep_ohio_interconnection_requests.json'
    geojson_path = public_dir / 'aep_ohio_interconnection_requests.geojson'
    
    print(f"\n💾 Writing JSON to {json_path}...")
    with open(json_path, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"💾 Writing GeoJSON to {geojson_path}...")
    with open(geojson_path, 'w') as f:
        json.dump(geojson, f, indent=2)
    
    # Final summary
    print(f"\n✅ Merge complete!")
    print(f"   Total projects: {len(projects)}")
    print(f"   Ohio projects: {metadata['ohio_projects']}")
    print(f"   Geocoded: {metadata['geocoded_projects']}")
    print(f"   Total capacity: {metadata['total_capacity_min_mw']:.1f} - {metadata['total_capacity_max_mw']:.1f} MW")
    print(f"   Generation types: {metadata['generation_type_breakdown']}")
    print(f"\n📋 Files created:")
    print(f"   {json_path}")
    print(f"   {geojson_path}")


if __name__ == '__main__':
    main()

