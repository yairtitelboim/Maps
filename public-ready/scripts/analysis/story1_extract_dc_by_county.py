#!/usr/bin/env python3
"""
Extract data center counts by county from texas_data_centers.geojson
Uses point-in-polygon to determine county from coordinates.
"""
import json
from pathlib import Path
from collections import Counter
import re

try:
    from shapely.geometry import Point, shape
    HAVE_SHAPELY = True
except ImportError:
    HAVE_SHAPELY = False
    print("⚠️  shapely not installed - using location text parsing only")
    print("   Install with: pip install shapely")

def extract_county_from_location(location_text):
    """Extract county name from location text."""
    if not location_text:
        return None
    
    # Pattern: "City, County" or "County" or "City County"
    patterns = [
        r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County",  # "Dallas County"
        r"([A-Z][a-z]+),\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County",  # "Dallas, Collin County"
    ]
    
    for pattern in patterns:
        match = re.search(pattern, location_text)
        if match:
            # Return the county part
            groups = match.groups()
            if len(groups) > 1:
                return groups[-1]  # County is last group
            return groups[0]
    
    return None

def get_county_from_coordinates(lng, lat, counties_data):
    """Use point-in-polygon to find county from coordinates."""
    if not HAVE_SHAPELY:
        return None
    
    point = Point(lng, lat)
    
    for feature in counties_data.get('features', []):
        county_name = feature.get('properties', {}).get('NAME', '')
        geometry = feature.get('geometry', {})
        
        if geometry and county_name:
            try:
                polygon = shape(geometry)
                if polygon.contains(point):
                    return county_name
            except:
                continue
    
    return None

def get_dc_by_county():
    """Count data centers by county."""
    base_path = Path(__file__).parent.parent.parent
    geojson_path = base_path / 'public/data/texas_data_centers.geojson'
    counties_path = base_path / 'public/data/texas/texas_counties.geojson'
    
    with open(geojson_path, 'r') as f:
        data = json.load(f)
    
    # Load county boundaries for point-in-polygon
    counties_data = None
    if HAVE_SHAPELY and counties_path.exists():
        with open(counties_path, 'r') as f:
            counties_data = json.load(f)
    
    county_counts = Counter()
    unlocated = 0
    location_details = []
    method_counts = {'coordinates': 0, 'location_text': 0, 'neither': 0}
    
    for feature in data.get('features', []):
        props = feature.get('properties', {})
        location = props.get('location', '')
        coords = feature.get('geometry', {}).get('coordinates', [])
        
        county = None
        method = None
        
        # Strategy 1: Try point-in-polygon with coordinates
        if coords and len(coords) == 2 and counties_data:
            county = get_county_from_coordinates(coords[0], coords[1], counties_data)
            if county:
                method = 'coordinates'
        
        # Strategy 2: Try parsing location text
        if not county:
            county = extract_county_from_location(location)
            if county:
                method = 'location_text'
        
        if county:
            county_counts[county] += 1
            location_details.append({
                'project_name': props.get('project_name', 'Unknown'),
                'county': county,
                'location_text': location,
                'method': method
            })
            method_counts[method] += 1
        else:
            unlocated += 1
            location_details.append({
                'project_name': props.get('project_name', 'Unknown'),
                'county': None,
                'location_text': location,
                'coordinates': coords if coords else None
            })
            method_counts['neither'] += 1
    
    # Convert to dict and sort
    result = dict(county_counts.most_common())
    
    print(f"📊 Data Centers by County:")
    print(f"   Total projects: {len(data.get('features', []))}")
    print(f"   Counties with DCs: {len(result)}")
    print(f"   Unlocated: {unlocated}")
    print(f"   Method: Coordinates={method_counts['coordinates']}, Text={method_counts['location_text']}, Neither={method_counts['neither']}")
    print(f"\n   Top 10 Counties:")
    for i, (county, count) in enumerate(list(result.items())[:10], 1):
        print(f"   {i}. {county}: {count} projects")
    
    if unlocated > 0:
        print(f"\n   ⚠️  Unlocated projects ({unlocated}):")
        for detail in location_details[:5]:
            if detail['county'] is None:
                print(f"      • {detail['project_name']}: {detail['location_text']}")
    
    return result, location_details

if __name__ == '__main__':
    dc_by_county, location_details = get_dc_by_county()
    
    # Save to file
    output_path = Path(__file__).parent.parent.parent / 'data/analysis/story1_dc_by_county.json'
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump({
            'county_counts': dc_by_county,
            'location_details': location_details
        }, f, indent=2)
    
    print(f"\n✅ Saved to {output_path}")

