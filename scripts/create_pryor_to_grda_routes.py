#!/usr/bin/env python3
"""
Create route GeoJSON files connecting Pryor to GRDA power generation facilities.

Generates routes from Pryor campus to all GRDA power plants using OSRM routing API.
"""

import json
import sys
import requests
from pathlib import Path

# Pryor coordinates (MidAmerica Industrial Park)
PRYOR_COORDS = (36.2411, -95.3301)

def load_grda_facilities():
    """Load GRDA facilities from the JSON data file."""
    script_dir = Path(__file__).parent
    data_file = script_dir.parent / 'data' / 'grda' / 'firecrawl_capacity_data.json'
    
    try:
        with open(data_file, 'r') as f:
            data = json.load(f)
        return data.get('generating_units', [])
    except Exception as e:
        print(f"❌ Error loading GRDA data: {e}")
        return []

def get_osrm_route(waypoints, route_name):
    """
    Get continuous route using OSRM (Open Source Routing Machine).
    
    Args:
        waypoints: List of (lat, lon) tuples
        route_name: Name of the route for logging
    
    Returns:
        dict: Route geometry or None if failed
    """
    # Convert waypoints to OSRM format (lon,lat)
    coordinates = ";".join([f"{lon},{lat}" for lat, lon in waypoints])
    
    # OSRM routing URL
    url = f"http://router.project-osrm.org/route/v1/driving/{coordinates}"
    params = {
        'overview': 'full',  # Get full geometry
        'geometries': 'geojson',  # Return as GeoJSON
        'steps': 'false',  # We don't need turn-by-turn
        'alternatives': 'false'  # Just the best route
    }
    
    try:
        print(f"Requesting route: {route_name}")
        print(f"  Waypoints: {len(waypoints)} points")
        for i, (lat, lon) in enumerate(waypoints):
            if i == 0:
                print(f"    {i+1}. Pryor: {lat:.6f}, {lon:.6f}")
            else:
                print(f"    {i+1}. {route_name.split(' → ')[-1]}: {lat:.6f}, {lon:.6f}")
        
        response = requests.get(url, params=params, timeout=60)
        response.raise_for_status()
        
        data = response.json()
        
        if data['code'] != 'Ok':
            print(f"  ❌ OSRM error: {data.get('message', 'Unknown error')}")
            return None
        
        route = data['routes'][0]
        geometry = route['geometry']
        
        distance_miles = route['distance'] * 0.000621371  # meters to miles
        duration_hours = route['duration'] / 3600  # seconds to hours
        
        print(f"  ✅ Route found:")
        print(f"     Distance: {distance_miles:.1f} miles")
        print(f"     Duration: {duration_hours:.1f} hours")
        print(f"     Coordinates: {len(geometry['coordinates']):,} points")
        
        return geometry
        
    except requests.exceptions.RequestException as e:
        print(f"  ❌ Network error: {e}")
        return None
    except (KeyError, IndexError) as e:
        print(f"  ❌ Unexpected response format: {e}")
        return None
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return None

def sanitize_filename(name):
    """Convert facility name to safe filename."""
    return name.lower().replace(' ', '_').replace('-', '_').replace('&', 'and').replace('/', '_').replace('.', '')

def main():
    script_dir = Path(__file__).parent
    output_dir = script_dir.parent / 'public' / 'data' / 'okc_campuses'
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("Creating Pryor to GRDA Routes")
    print("=" * 60)
    print()
    
    # Load GRDA facilities
    facilities = load_grda_facilities()
    if not facilities:
        print("❌ No GRDA facilities found in data file")
        return False
    
    print(f"Found {len(facilities)} GRDA facilities")
    print(f"Pryor location: {PRYOR_COORDS[0]:.6f}, {PRYOR_COORDS[1]:.6f}")
    print()
    
    successful_routes = []
    failed_routes = []
    seen_coordinates = {}  # Track duplicate coordinates
    
    for facility in facilities:
        if not facility.get('latitude') or not facility.get('longitude'):
            print(f"⚠️  Skipping {facility.get('name', 'Unknown')}: missing coordinates")
            continue
        
        facility_name = facility.get('name', 'Unknown')
        facility_lat = facility['latitude']
        facility_lon = facility['longitude']
        facility_coords = (facility_lat, facility_lon)
        
        # Check if Pryor and facility are at same location
        if abs(facility_lat - PRYOR_COORDS[0]) < 0.0001 and abs(facility_lon - PRYOR_COORDS[1]) < 0.0001:
            print(f"⚠️  Skipping {facility_name}: same location as Pryor")
            continue
        
        # Handle duplicate coordinates (multiple facilities at same location)
        coord_key = f"{facility_lat:.4f},{facility_lon:.4f}"
        if coord_key in seen_coordinates:
            # Use existing route for this coordinate
            existing_name = seen_coordinates[coord_key]
            print(f"⚠️  Skipping {facility_name}: same location as {existing_name} (using existing route)")
            continue
        
        seen_coordinates[coord_key] = facility_name
        
        route_description = f"Pryor → {facility_name}"
        waypoints = [PRYOR_COORDS, facility_coords]
        
        route_geometry = get_osrm_route(waypoints, route_description)
        
        if not route_geometry:
            failed_routes.append((facility_name, route_description))
            print()
            continue
        
        # Create GeoJSON feature
        feature = {
            "type": "Feature",
            "geometry": route_geometry,
            "properties": {
                "name": route_description,
                "start": "Pryor",
                "end": facility_name,
                "route_type": "pryor_to_grda",
                "facility_type": facility.get('type', 'Unknown'),
                "fuel": facility.get('fuel', 'Unknown'),
                "capacity_mw": facility.get('net_MW', 0)
            }
        }
        
        # Create GeoJSON FeatureCollection
        geojson_data = {
            "type": "FeatureCollection",
            "features": [feature]
        }
        
        # Create filename
        filename = f"pryor_to_{sanitize_filename(facility_name)}.geojson"
        output_file = output_dir / filename
        
        with open(output_file, 'w') as f:
            json.dump(geojson_data, f, separators=(',', ':'))
        
        print(f"  💾 Saved to: {output_file.name}")
        print()
        
        successful_routes.append((facility_name, filename))
    
    # Summary
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"✅ Successful routes: {len(successful_routes)}")
    print(f"❌ Failed routes: {len(failed_routes)}")
    print()
    
    if successful_routes:
        print("Generated route files:")
        for facility_name, filename in successful_routes:
            print(f"  - {filename}")
    
    if failed_routes:
        print("\nFailed routes:")
        for facility_name, desc in failed_routes:
            print(f"  - {desc}")
    
    return len(failed_routes) == 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

