#!/usr/bin/env python3
"""
Script to fix the most critical coordinate issues identified by check_coordinate_accuracy.py
"""

import sqlite3
from pathlib import Path
from geopy.geocoders import Nominatim
import time
import json

# Critical fixes based on coordinate_accuracy_report.json
CRITICAL_FIXES = {
    'proj_2939ca7d3063': {  # Jarrell - 278km away
        'location': 'Jarrell, TX',
        'expected_coords': (30.8249, -97.6045),
        'reason': 'Currently in Houston area, should be in Jarrell'
    },
    'proj_2d0725b8705d': {  # Austin County - 150km away
        'location': 'Austin County, TX',
        'expected_coords': (29.8916, -96.2443),  # Bellville area (Austin County seat)
        'reason': 'Currently wrong location, should be in Austin County'
    },
    'proj_4f121e9109b0': {  # Cedar Creek - 22km away
        'location': 'Cedar Creek, TX',
        'expected_coords': (30.0872, -97.4950),
        'reason': 'Close but needs adjustment'
    },
    'proj_a2cfea4a82ed': {  # Grand Prairie/Ellis County - 39km away
        'location': 'Ellis County, TX',  # "of grand prairie in northern ellis"
        'expected_coords': (32.4175, -96.8403),  # Waxahachie (Ellis County seat)
        'reason': 'Currently in wrong area, should be in northern Ellis County'
    },
}

def fix_critical_coordinates():
    """Fix the most critical coordinate issues."""
    db_path = Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"
    
    if not db_path.exists():
        print(f"❌ Database not found: {db_path}")
        return
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    print("🔧 FIXING CRITICAL COORDINATE ISSUES")
    print("=" * 80)
    print()
    
    geolocator = Nominatim(user_agent='fix_coordinates', timeout=10)
    
    fixed_count = 0
    
    for project_id, fix_info in CRITICAL_FIXES.items():
        # Get current state
        cursor.execute("""
            SELECT company, location_text, lat, lng, geocode_confidence
            FROM projects
            WHERE project_id = ?
        """, (project_id,))
        
        result = cursor.fetchone()
        if not result:
            print(f"⚠️  Project {project_id} not found, skipping...")
            continue
        
        company, location_text, old_lat, old_lng, old_conf = result
        
        print(f"Fixing: {company or 'Unknown'} - {location_text}")
        print(f"  Project ID: {project_id}")
        print(f"  Current: ({old_lat:.6f}, {old_lng:.6f})")
        print(f"  Reason: {fix_info['reason']}")
        
        # Try to geocode the location for verification
        try:
            location_result = geolocator.geocode(f"{fix_info['location']}, Texas, USA")
            if location_result:
                geocoded_lat = location_result.latitude
                geocoded_lng = location_result.longitude
                print(f"  Geocoded: ({geocoded_lat:.6f}, {geocoded_lng:.6f})")
                
                # Use geocoded if close to expected, otherwise use expected
                from math import radians, sin, cos, sqrt, atan2
                R = 6371
                lat1, lon1 = radians(geocoded_lat), radians(geocoded_lng)
                lat2, lon2 = radians(fix_info['expected_coords'][0]), radians(fix_info['expected_coords'][1])
                dlat = lat2 - lat1
                dlon = lon2 - lon1
                a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                distance = R * 2 * atan2(sqrt(a), sqrt(1-a))
                
                if distance < 5:
                    # Use geocoded coordinates
                    new_lat, new_lng = geocoded_lat, geocoded_lng
                    print(f"  ✅ Using geocoded coordinates (within 5km of expected)")
                else:
                    # Use expected coordinates
                    new_lat, new_lng = fix_info['expected_coords']
                    print(f"  ✅ Using expected coordinates (geocoded {distance:.1f}km away)")
            else:
                # Use expected coordinates
                new_lat, new_lng = fix_info['expected_coords']
                print(f"  ✅ Using expected coordinates (geocoding failed)")
        except Exception as e:
            # Use expected coordinates
            new_lat, new_lng = fix_info['expected_coords']
            print(f"  ✅ Using expected coordinates (error: {e})")
        
        # Update database
        cursor.execute("""
            UPDATE projects
            SET lat = ?, lng = ?, geocode_confidence = ?, location_text = ?
            WHERE project_id = ?
        """, (new_lat, new_lng, 'city' if 'County' not in fix_info['location'] else 'area', 
              fix_info['location'], project_id))
        
        fixed_count += 1
        print(f"  ✅ Fixed!")
        print()
        
        time.sleep(1)  # Rate limit
    
    conn.commit()
    conn.close()
    
    print("=" * 80)
    print(f"✅ Fixed {fixed_count} critical coordinate issues")
    print()
    print("💡 Next steps:")
    print("   1. Regenerate GeoJSON: python3 scripts/news-output/export_projects_geojson.py")
    print("   2. Re-run accuracy check: python3 scripts/news-output/check_coordinate_accuracy.py")

if __name__ == "__main__":
    fix_critical_coordinates()

