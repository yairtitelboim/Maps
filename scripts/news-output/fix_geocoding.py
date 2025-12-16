#!/usr/bin/env python3
"""
Fix geocoding - remove non-Texas coordinates and improve remaining projects.
Texas bounds: lat 25-37°N, lng 93-107°W
"""

import sys
from pathlib import Path
import sqlite3

def is_texas_coordinate(lat: float, lng: float) -> bool:
    """Check if coordinates are within Texas bounds."""
    # Texas approximate bounds
    TEXAS_LAT_MIN = 25.0
    TEXAS_LAT_MAX = 37.0
    TEXAS_LNG_MIN = -107.0
    TEXAS_LNG_MAX = -93.0
    
    return (TEXAS_LAT_MIN <= lat <= TEXAS_LAT_MAX and 
            TEXAS_LNG_MIN <= lng <= TEXAS_LNG_MAX)

def main():
    db_path = Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Find non-Texas coordinates
    cursor.execute("""
        SELECT project_id, company, location_text, lat, lng
        FROM projects
        WHERE lat IS NOT NULL AND lng IS NOT NULL
    """)
    
    projects = cursor.fetchall()
    
    print(f"🔍 Checking {len(projects)} geocoded projects...")
    print("")
    
    fixed_count = 0
    
    for project_id, company, location_text, lat, lng in projects:
        if not is_texas_coordinate(lat, lng):
            print(f"❌ Non-Texas coordinates: {company or 'Unknown'} - {location_text}")
            print(f"   Coordinates: {lat}, {lng} (outside Texas bounds)")
            
            # Remove invalid coordinates
            cursor.execute("""
                UPDATE projects
                SET lat = NULL, lng = NULL, geocode_confidence = NULL
                WHERE project_id = ?
            """, (project_id,))
            fixed_count += 1
            print(f"   ✅ Removed invalid coordinates")
            print("")
    
    conn.commit()
    
    # Show final stats
    cursor.execute("""
        SELECT COUNT(*) FROM projects WHERE lat IS NOT NULL AND lng IS NOT NULL
    """)
    valid_count = cursor.fetchone()[0]
    
    cursor.execute("""
        SELECT COUNT(*) FROM projects 
        WHERE (lat IS NULL OR lng IS NULL) 
        AND location_text IS NOT NULL 
        AND location_text != ''
    """)
    needs_geocoding = cursor.fetchone()[0]
    
    conn.close()
    
    print(f"✅ Fixed {fixed_count} invalid coordinates")
    print(f"📊 Valid Texas coordinates: {valid_count}")
    print(f"📍 Still need geocoding: {needs_geocoding}")

if __name__ == "__main__":
    main()

