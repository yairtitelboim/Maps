#!/usr/bin/env python3
"""
Create route GeoJSON files connecting Oklahoma infrastructure markers.

Generates routes between key infrastructure sites (Supply and Demand clusters)
using OSRM routing API.
"""

import json
import sys
import requests
from pathlib import Path

# Define all marker locations (lat, lon)
MARKERS = {
    # Infrastructure sites (red markers)
    'Pryor': (36.2411, -95.3301),
    'Stillwater': (36.1156, -97.0584),
    'Tulsa Suburbs': (36.0, -95.72),
    'OG&E Substation OKC': (35.4676, -97.5164),
    'Cimarron Link - Tulsa': (36.15, -95.99),
    'Cushing': (35.9851, -96.7670),
    'Tulsa Metro': (36.1539, -95.9925),
    'OKC Innovation District': (35.4676, -97.5164),
    'Ardmore': (34.1743, -97.1436),
    'Inola': (36.15, -95.52),
    'Tinker AFB': (35.4147, -97.4027),
    # GRDA Power Generation Facilities (blue/colored markers)
    'Pensacola Dam': (36.4675, -95.04139),
    'Robert S. Kerr Dam': (36.0831, -95.1167),
    'Salina Pumped Storage Project': (36.292, -95.152),
    'Wind Generation': (35.4676, -97.5164),  # Same location as OKC Innovation District
    'Redbud Power Plant': (36.2831, -95.1167),
}

# Define route connections (logical infrastructure connections)
ROUTES = [
    # Supply connections
    ('Pryor', 'Inola', 'Pryor → Inola (GRDA territory)'),
    ('Pryor', 'Tulsa Suburbs', 'Pryor → Tulsa Suburbs (I-44 corridor)'),
    ('Tulsa Suburbs', 'Tulsa Metro', 'Tulsa Suburbs → Tulsa Metro'),
    ('Tulsa Metro', 'Cimarron Link - Tulsa', 'Tulsa Metro → Cimarron Link'),
    ('Stillwater', 'OKC Innovation District', 'Stillwater → OKC Innovation District'),
    ('Cushing', 'OKC Innovation District', 'Cushing → OKC Innovation District'),
    ('OG&E Substation OKC', 'Tinker AFB', 'OG&E Substation → Tinker AFB'),
    ('OKC Innovation District', 'Tinker AFB', 'OKC Innovation District → Tinker AFB'),
    ('Ardmore', 'OKC Innovation District', 'Ardmore → OKC Innovation District'),
    # Additional connections
    ('Pryor', 'Cushing', 'Pryor → Cushing (I-44 corridor)'),
    ('Stillwater', 'Cushing', 'Stillwater → Cushing'),
    # GRDA Power Generation Facility connections
    ('Pryor', 'Pensacola Dam', 'Pryor → Pensacola Dam (GRDA)'),
    ('Pryor', 'Robert S. Kerr Dam', 'Pryor → Robert S. Kerr Dam (GRDA)'),
    ('Pryor', 'Salina Pumped Storage Project', 'Pryor → Salina Pumped Storage (GRDA)'),
    ('Pryor', 'Redbud Power Plant', 'Pryor → Redbud Power Plant (GRDA)'),
    ('Inola', 'Pensacola Dam', 'Inola → Pensacola Dam (GRDA)'),
    ('Inola', 'Robert S. Kerr Dam', 'Inola → Robert S. Kerr Dam (GRDA)'),
    ('Inola', 'Salina Pumped Storage Project', 'Inola → Salina Pumped Storage (GRDA)'),
    ('Inola', 'Redbud Power Plant', 'Inola → Redbud Power Plant (GRDA)'),
    # GRDA facilities to each other
    ('Pensacola Dam', 'Robert S. Kerr Dam', 'Pensacola Dam → Robert S. Kerr Dam'),
    ('Robert S. Kerr Dam', 'Salina Pumped Storage Project', 'Robert S. Kerr Dam → Salina Pumped Storage'),
    ('Salina Pumped Storage Project', 'Redbud Power Plant', 'Salina Pumped Storage → Redbud Power Plant'),
    # Wind Generation (same location as OKC Innovation District, so skip direct routes)
]

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
            marker_name = [k for k, v in MARKERS.items() if v == (lat, lon)]
            name = marker_name[0] if marker_name else f"Point {i+1}"
            print(f"    {i+1}. {name}: {lat:.4f}, {lon:.4f}")
        
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

def main():
    script_dir = Path(__file__).parent
    output_dir = script_dir.parent / 'public' / 'data' / 'okc_campuses'
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("Creating Oklahoma Infrastructure Routes")
    print("=" * 60)
    print()
    
    successful_routes = []
    failed_routes = []
    
    for start_name, end_name, route_description in ROUTES:
        if start_name not in MARKERS or end_name not in MARKERS:
            print(f"⚠️  Skipping {route_description}: marker not found")
            failed_routes.append((start_name, end_name, route_description))
            continue
        
        start_coords = MARKERS[start_name]
        end_coords = MARKERS[end_name]
        
        # Skip if start and end are the same (e.g., OG&E Substation and OKC Innovation District)
        if start_coords == end_coords:
            print(f"⚠️  Skipping {route_description}: same location")
            continue
        
        waypoints = [start_coords, end_coords]
        route_geometry = get_osrm_route(waypoints, route_description)
        
        if not route_geometry:
            failed_routes.append((start_name, end_name, route_description))
            print()
            continue
        
        # Create GeoJSON feature
        feature = {
            "type": "Feature",
            "geometry": route_geometry,
            "properties": {
                "name": route_description,
                "start": start_name,
                "end": end_name,
                "route_type": "infrastructure_connection"
            }
        }
        
        # Create GeoJSON FeatureCollection
        geojson_data = {
            "type": "FeatureCollection",
            "features": [feature]
        }
        
        # Create filename from route names
        filename = f"{start_name.lower().replace(' ', '_').replace('-', '_')}_to_{end_name.lower().replace(' ', '_').replace('-', '_')}.geojson"
        output_file = output_dir / filename
        
        with open(output_file, 'w') as f:
            json.dump(geojson_data, f, separators=(',', ':'))
        
        print(f"  💾 Saved to: {output_file.name}")
        print()
        
        successful_routes.append((start_name, end_name, filename))
    
    # Summary
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"✅ Successful routes: {len(successful_routes)}")
    print(f"❌ Failed routes: {len(failed_routes)}")
    print()
    
    if successful_routes:
        print("Generated route files:")
        for start, end, filename in successful_routes:
            print(f"  - {filename}")
    
    if failed_routes:
        print("\nFailed routes:")
        for start, end, desc in failed_routes:
            print(f"  - {desc}")
    
    return len(failed_routes) == 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

