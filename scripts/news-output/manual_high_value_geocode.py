#!/usr/bin/env python3
"""
Manual geocoding for high-value projects with known locations from articles.
"""

import sqlite3
from pathlib import Path

# Known locations from article analysis
MANUAL_GEOCODING = {
    'proj_bb58dfa6c724': {  # Google Texas AI
        'location': 'Armstrong County',
        'lat': 34.9667,
        'lng': -101.3500,
        'confidence': 'county',
        'note': 'Google announced campuses in Armstrong County and Haskell County - using Armstrong as primary'
    },
    'proj_5d353b34c2ec': {  # Vantage Frontier
        'location': 'Shackelford County',
        'lat': 32.7089,
        'lng': -99.3308,
        'confidence': 'county',
        'note': 'Vantage Frontier mega-campus in Shackelford County'
    },
    'proj_4867abff1592': {  # Vantage Frontier (duplicate)
        'location': 'Shackelford County',
        'lat': 32.7089,
        'lng': -99.3308,
        'confidence': 'county',
        'note': 'Vantage Frontier mega-campus in Shackelford County'
    },
    'proj_4573106dc8ed': {  # CyrusOne DFW10
        'location': 'Dallas',
        'lat': 32.7767,
        'lng': -96.7970,
        'confidence': 'city',
        'note': 'CyrusOne DFW10 campus - Dallas-Fort Worth area'
    },
    'proj_96ac0eafe063': {  # Calpine 190 MW hyperscale
        'location': 'Texas',
        'lat': None,  # Need to find specific location
        'lng': None,
        'confidence': 'unknown',
        'note': 'Calpine 190 MW agreement - need to find location from article'
    },
    'proj_14d55b09a2ea': {  # Oracle Texas Hyperscale
        'location': 'Texas',
        'lat': None,  # Need to find specific location
        'lng': None,
        'confidence': 'unknown',
        'note': 'Oracle Texas hyperscale site - need to find location from article'
    },
}

def main():
    db_path = Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    print("🎯 Manual Geocoding for High-Value Projects")
    print("=" * 60)
    print("")
    
    geocoded_count = 0
    
    for project_id, data in MANUAL_GEOCODING.items():
        if data['lat'] is None or data['lng'] is None:
            print(f"⏭️  {project_id}: {data['note']} - Skipping (needs research)")
            continue
        
        # Check if already geocoded
        cursor.execute("SELECT lat, lng FROM projects WHERE project_id = ?", (project_id,))
        result = cursor.fetchone()
        if result and result[0] is not None and result[1] is not None:
            print(f"✅ {project_id}: Already geocoded")
            continue
        
        # Get company name
        cursor.execute("SELECT company FROM projects WHERE project_id = ?", (project_id,))
        company_result = cursor.fetchone()
        company = company_result[0] if company_result else 'Unknown'
        
        print(f"📍 {company}: {project_id}")
        print(f"   Location: {data['location']}")
        print(f"   Coordinates: {data['lat']:.4f}, {data['lng']:.4f}")
        
        # Update database
        cursor.execute("""
            UPDATE projects
            SET lat = ?, lng = ?, geocode_confidence = ?, location_text = COALESCE(NULLIF(location_text, ''), ?)
            WHERE project_id = ?
        """, (data['lat'], data['lng'], data['confidence'], data['location'], project_id))
        
        geocoded_count += 1
        print(f"   ✅ Geocoded")
        print("")
    
    conn.commit()
    conn.close()
    
    print("=" * 60)
    print(f"✅ Manually geocoded {geocoded_count} high-value projects")

if __name__ == "__main__":
    main()

