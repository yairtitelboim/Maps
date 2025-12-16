#!/usr/bin/env python3
"""
Create continuous route GeoJSON connecting Pryor and Stillwater campuses in Oklahoma.

Uses OSRM (Open Source Routing Machine) to generate a driving route between:
- Pryor: 36.2411°N, 95.3301°W (GRDA, I-44 Northeast)
- Stillwater: 36.1156°N, 97.0584°W (OG&E, I-44 West)
"""

import json
import sys
import requests
from pathlib import Path

def get_osrm_route(waypoints):
    """
    Get continuous route using OSRM (Open Source Routing Machine).
    
    Args:
        waypoints: List of (lat, lon) tuples
    
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
        print(f"Requesting Pryor → Stillwater route from OSRM...")
        print(f"Waypoints: {len(waypoints)} points")
        for i, (lat, lon) in enumerate(waypoints):
            if i == 0:
                print(f"  Start: {lat:.4f}, {lon:.4f} (Pryor, OK)")
            elif i == len(waypoints) - 1:
                print(f"  End:   {lat:.4f}, {lon:.4f} (Stillwater, OK)")
            else:
                print(f"  Via:   {lat:.4f}, {lon:.4f}")
        
        response = requests.get(url, params=params, timeout=60)
        response.raise_for_status()
        
        data = response.json()
        
        if data['code'] != 'Ok':
            print(f"❌ OSRM error: {data.get('message', 'Unknown error')}")
            return None
        
        route = data['routes'][0]
        geometry = route['geometry']
        
        distance_miles = route['distance'] * 0.000621371  # meters to miles
        duration_hours = route['duration'] / 3600  # seconds to hours
        
        print(f"✅ Route found:")
        print(f"   Distance: {distance_miles:.1f} miles")
        print(f"   Duration: {duration_hours:.1f} hours")
        print(f"   Coordinates: {len(geometry['coordinates']):,} points")
        
        return geometry
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
        return None
    except (KeyError, IndexError) as e:
        print(f"❌ Unexpected response format: {e}")
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def main():
    # Route waypoints: Pryor → Stillwater
    # Coordinates from the table provided
    waypoints = [
        (36.2411, -95.3301),  # Pryor, OK (lat, lon)
        (36.1156, -97.0584)   # Stillwater, OK (lat, lon)
    ]
    
    print("Creating continuous route: Pryor → Stillwater")
    print(f"Waypoints: {waypoints}")
    
    # Get route from OSRM
    route_geometry = get_osrm_route(waypoints)
    
    if not route_geometry:
        print("❌ Failed to get route from OSRM")
        return False
    
    # Create GeoJSON feature
    feature = {
        "type": "Feature",
        "geometry": route_geometry,
        "properties": {
            "name": "Pryor → Stillwater Route",
            "description": "Continuous driving route connecting Google data center campuses in Oklahoma",
            "route_type": "continuous_navigation",
            "waypoints": ["Pryor, OK (GRDA, I-44 Northeast)", "Stillwater, OK (OG&E, I-44 West)"],
            "utility": "GRDA ↔ OG&E",
            "corridor": "I-44"
        }
    }
    
    # Create GeoJSON FeatureCollection
    geojson_data = {
        "type": "FeatureCollection",
        "features": [feature]
    }
    
    # Save to file
    script_dir = Path(__file__).parent
    output_file = script_dir.parent / 'public' / 'data' / 'okc_campuses' / 'pryor_to_stillwater.geojson'
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'w') as f:
        json.dump(geojson_data, f, separators=(',', ':'))
    
    print(f"✅ Saved continuous route to: {output_file}")
    
    # Show file size and coordinate count
    import os
    file_size = os.path.getsize(output_file)
    coord_count = len(route_geometry['coordinates'])
    
    print(f"📊 File size: {file_size:,} bytes")
    print(f"📍 Route coordinates: {coord_count:,} points")
    print(f"🛣️  Route type: {route_geometry['type']}")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

