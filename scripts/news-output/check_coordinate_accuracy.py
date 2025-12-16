



#!/usr/bin/env python3
"""
Protocol to check all projects for incorrect coordinate status indicators.
Checks if coordinates match the location text and article context.
"""

import sys
import json
import sqlite3
from pathlib import Path
from math import radians, sin, cos, sqrt, atan2
import re

# Known city coordinates for verification
CITY_COORDS = {
    'Midlothian': (32.4824, -96.9944),
    'Plano': (33.0198, -96.6989),
    'Round Rock': (30.5083, -97.6789),
    'Taylor': (30.5708, -97.4092),
    'Lancaster': (32.5921, -96.7561),
    'Fort Worth': (32.7555, -97.3308),
    'Austin': (30.2672, -97.7431),
    'Dallas': (32.7767, -96.7970),
    'San Antonio': (29.4241, -98.4936),
    'Houston': (29.7604, -95.3698),
    'El Paso': (31.7619, -106.4850),
    'Irving': (32.8140, -96.9489),
    'Arlington': (32.7357, -97.1081),
    'Carrollton': (32.9537, -96.8903),
    'Red Oak': (32.5182, -96.8047),
    'Waxahachie': (32.3865, -96.8483),
    'Georgetown': (30.6333, -97.6772),
    'Jarrell': (30.8249, -97.6045),
    'Cedar Creek': (30.0872, -97.4950),
    'Lytle': (29.2333, -98.7967),
    'Wilmer': (32.5803, -96.6885),
    'Grand Prairie': (32.7459, -96.9978),
    'Ellis County': (32.4175, -96.8403),
    'Tarrant County': (32.7584, -97.3312),
    'Bexar County': (29.4484, -98.5200),
    'Travis County': (30.3072, -97.7559),
    'Denton County': (33.2148, -97.1301),
    'Collin County': (33.1972, -96.6397),
    'Austin County': (29.8916, -96.2443),  # Bellville area (Austin County seat)
    # Additional Texas cities
    'Frisco': (33.1507, -96.8236),
    'McKinney': (33.1972, -96.6397),
    'Richardson': (32.9483, -96.7299),
    'Lewisville': (33.0462, -96.9942),
    'Mesquite': (32.7668, -96.5992),
    'Garland': (32.9126, -96.6389),
    'Pasadena': (29.6911, -95.2091),
    'Corpus Christi': (27.8006, -97.3964),
    'Laredo': (27.5306, -99.4803),
    'Lubbock': (33.5779, -101.8552),
    'Amarillo': (35.2220, -101.8313),
    'Brownsville': (25.9018, -97.4975),
    'Abilene': (32.4487, -99.7331),
    'Beaumont': (30.0802, -94.1266),
    'Odessa': (31.8457, -102.3676),
    'Waco': (31.5493, -97.1467),
    'Tyler': (32.3513, -95.3011),
    'College Station': (30.6279, -96.3344),
    'Pearland': (29.5636, -95.2860),
    'Sugar Land': (29.6197, -95.6350),
    'Wichita Falls': (33.9137, -98.4934),
    'Edinburg': (26.3017, -98.1633),
    'Temple': (31.0982, -97.3428),
    'San Marcos': (29.8833, -97.9414),
    'Lacy Lakeview': (31.6303, -97.0989),
    'Whitney': (31.9518, -97.3214),
    'Elm Mott': (31.6671, -97.1032),
    # Additional Texas counties
    'Harris County': (29.7604, -95.3698),  # Houston area
    'Montgomery County': (30.3119, -95.4561),
    'Williamson County': (30.6333, -97.6772),  # Georgetown area
    'Fort Bend County': (29.6197, -95.6350),  # Sugar Land area
    'Hidalgo County': (26.3017, -98.1633),  # Edinburg area
    'Cameron County': (25.9018, -97.4975),  # Brownsville area
    'Galveston County': (29.3013, -94.7977),
    'Brazoria County': (29.0444, -95.4671),
    'Jefferson County': (30.0802, -94.1266),  # Beaumont area
    'Bell County': (31.0982, -97.3428),  # Temple area
    'Hays County': (29.8833, -97.9414),  # San Marcos area
    'Medina County': (29.3558, -99.1103),
    'Ector County': (31.8457, -102.3676),  # Odessa area
    'Bosque County': (31.8778, -97.6561),
    'Hill County': (31.9909, -97.1303),
    'Shackelford County': (32.7089, -99.3308),
    'Armstrong County': (34.9296, -101.3449),
    'Pecos County': (30.7857, -102.8065),
    'Cherokee County': (31.8693, -95.1655),
    'Bastrop County': (30.0541, -97.3888),
    'Haskell County': (33.1781, -99.7337),
    'McLennan County': (31.5493, -97.1467),  # Waco area
    # Additional cities from analysis
    'Allen': (33.1032, -96.6706),
    'Hutto': (30.5427, -97.5467),
    'Abilene': (32.4487, -99.7331),
    'West': (31.8035, -97.0933),  # West, TX
    'Santa Teresa': (31.8475, -106.5702),  # Near El Paso
    'The Colony': (33.0890, -96.8864),
    'Flower Mound': (33.0146, -97.0969),
    'Keller': (32.9343, -97.2517),
    'Southlake': (32.9412, -97.1342),
    'Grapevine': (32.9343, -97.0781),
    'Euless': (32.8371, -97.0820),
    'Bedford': (32.8440, -97.1431),
    'Pflugerville': (30.4394, -97.6200),
    'Leander': (30.5788, -97.8531),
    'Cedar Park': (30.5052, -97.8203),
    'Bastrop': (30.1105, -97.3153),
    'Lockhart': (29.8849, -97.6700),
    'Kyle': (29.9883, -97.8772),
    'New Braunfels': (29.7030, -98.1245),
    'Boerne': (29.7947, -98.7320),
    'Seguin': (29.5688, -97.9647),
    'Converse': (29.5180, -98.3161),
    'Schertz': (29.5670, -98.2700),
    'Universal City': (29.5480, -98.2911),
    'Live Oak': (29.5650, -98.3364),
    'Windcrest': (29.5155, -98.3803),
    'Helotes': (29.5780, -98.6897),
    'Fair Oaks Ranch': (29.7458, -98.6434),
    'Bee Cave': (30.3085, -97.9450),
    'Lakeway': (30.3747, -97.9797),
    'Dripping Springs': (30.1902, -98.0867),
    'Wimberley': (29.9977, -98.0986),
    'Canyon Lake': (29.8752, -98.2625),
}

def distance_km(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates in km."""
    R = 6371  # Earth radius in km
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))

def find_city_in_location(location_text):
    """Extract city name from location text."""
    if not location_text:
        return None
    
    location_lower = location_text.lower()
    
    # Normalize common variations
    location_lower = location_lower.replace('fort worth', 'fort worth')
    location_lower = location_lower.replace('ft worth', 'fort worth')
    location_lower = location_lower.replace('dfw', 'dallas')
    location_lower = location_lower.replace('dallas-fort worth', 'dallas')
    
    # Check for county FIRST - MUST check before city matching to avoid false matches
    # (e.g., "Austin County" should not match "Austin" city)
    if 'county' in location_lower:
        # Handle specific county matches first
        county_mappings = {
            'austin county': 'Austin County',  # Must check this first - different from Austin city
            'bexar county': 'Bexar County',
            'travis county': 'Travis County',
            'tarrant county': 'Tarrant County',
            'denton county': 'Denton County',
            'collin county': 'Collin County',
            'ellis county': 'Ellis County',
        }
        for key, county in county_mappings.items():
            if key in location_lower and county in CITY_COORDS:
                return county
        
        # Generic county matching
        county_name = location_lower.replace('county', '').strip()
        for city in CITY_COORDS.keys():
            if 'County' in city:  # Only match to county entries
                city_lower = city.lower()
                if city_lower.replace(' county', '') in county_name or county_name in city_lower.replace(' county', ''):
                    return city
    
    # Check for directional indicators (e.g., "south fort worth", "northeast el paso")
    directional_patterns = [
        (r'south\s+fort\s+worth', 'Fort Worth'),
        (r'north\s+fort\s+worth', 'Fort Worth'),
        (r'east\s+fort\s+worth', 'Fort Worth'),
        (r'west\s+fort\s+worth', 'Fort Worth'),
        (r'southeast\s+fort\s+worth', 'Fort Worth'),
        (r'northeast\s+el\s+paso', 'El Paso'),
        (r'north\s+austin', 'Austin'),
        (r'south\s+dallas', 'Dallas'),
        (r'north\s+dallas', 'Dallas'),
    ]
    
    for pattern, city in directional_patterns:
        if re.search(pattern, location_lower):
            return city
    
    # Check for partial matches in multi-word locations
    words = location_lower.split()
    for word in words:
        # Skip common words
        if word in ['in', 'of', 'the', 'and', 'or', 'near', 'at', 'on']:
            continue
        for city in CITY_COORDS.keys():
            city_lower = city.lower()
            if city_lower == word or (len(word) > 4 and city_lower.startswith(word)):
                return city
    
    # Special case: "Austin County" vs "Austin" city
    if 'austin county' in location_lower:
        # Austin County is a different location than Austin city
        # Austin County is near Bellville, TX
        if 'Austin County' in CITY_COORDS:
            return 'Austin County'
        return None  # Don't match to Austin city
    
    # Special case: "Cedar Rapids" is in Iowa, not Texas
    if 'cedar rapids' in location_lower:
        return None  # Don't match to Cedar Creek, TX
    
    return None

def check_coordinate_accuracy():
    """Check all projects for coordinate accuracy."""
    db_path = Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"
    
    if not db_path.exists():
        print(f"❌ Database not found: {db_path}")
        return
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    print("🔍 CHECKING ALL PROJECTS FOR COORDINATE ACCURACY")
    print("=" * 80)
    print()
    
    # Get all projects with coordinates
    cursor.execute("""
        SELECT 
            p.project_id,
            p.company,
            p.project_name,
            p.location_text,
            p.lat,
            p.lng,
            p.geocode_confidence,
            p.site_hint,
            p.mention_ids
        FROM projects p
        WHERE p.lat IS NOT NULL 
        AND p.lng IS NOT NULL
        AND p.lat BETWEEN 25 AND 37 
        AND p.lng BETWEEN -107 AND -93
        ORDER BY p.company, p.location_text
    """)
    
    projects = cursor.fetchall()
    
    print(f"📊 Checking {len(projects)} projects...")
    print()
    
    issues = {
        'incorrect': [],  # >20km from expected location
        'questionable': [],  # 5-20km from expected location
        'no_reference': []  # Can't verify (no city match)
    }
    
    for project in projects:
        (project_id, company, project_name, location_text, lat, lng, 
         confidence, site_hint, mention_ids) = project
        
        # Find matching city
        city = find_city_in_location(location_text)
        
        if city and city in CITY_COORDS:
            expected_lat, expected_lng = CITY_COORDS[city]
            distance = distance_km(lat, lng, expected_lat, expected_lng)
            
            status = None
            if distance > 20:
                status = 'incorrect'
                issues['incorrect'].append({
                    'project_id': project_id,
                    'company': company or 'Unknown',
                    'location': location_text,
                    'current_coords': (lat, lng),
                    'expected_city': city,
                    'expected_coords': (expected_lat, expected_lng),
                    'distance_km': distance,
                    'confidence': confidence,
                    'site_hint': site_hint
                })
            elif distance > 5:
                status = 'questionable'
                issues['questionable'].append({
                    'project_id': project_id,
                    'company': company or 'Unknown',
                    'location': location_text,
                    'current_coords': (lat, lng),
                    'expected_city': city,
                    'expected_coords': (expected_lat, expected_lng),
                    'distance_km': distance,
                    'confidence': confidence,
                    'site_hint': site_hint
                })
        else:
            # Can't verify - no matching city
            issues['no_reference'].append({
                'project_id': project_id,
                'company': company or 'Unknown',
                'location': location_text,
                'current_coords': (lat, lng),
                'confidence': confidence,
                'site_hint': site_hint
            })
    
    # Print results
    print("=" * 80)
    print("📊 RESULTS:")
    print("=" * 80)
    print(f"✅ Correct coordinates: {len(projects) - len(issues['incorrect']) - len(issues['questionable']) - len(issues['no_reference'])}")
    print(f"❌ Incorrect (>20km): {len(issues['incorrect'])}")
    print(f"⚠️  Questionable (5-20km): {len(issues['questionable'])}")
    print(f"❓ No reference city: {len(issues['no_reference'])}")
    print()
    
    # Show incorrect projects
    if issues['incorrect']:
        print("=" * 80)
        print("❌ INCORRECT COORDINATES (>20km from expected):")
        print("=" * 80)
        for issue in issues['incorrect']:
            print(f"\n{issue['company']} - {issue['location']}")
            print(f"  Project ID: {issue['project_id']}")
            print(f"  Current: ({issue['current_coords'][0]:.6f}, {issue['current_coords'][1]:.6f})")
            print(f"  Expected ({issue['expected_city']}): ({issue['expected_coords'][0]:.6f}, {issue['expected_coords'][1]:.6f})")
            print(f"  Distance: {issue['distance_km']:.2f} km")
            print(f"  Confidence: {issue['confidence']}")
            if issue['site_hint']:
                print(f"  Site hint: {issue['site_hint']}")
    
    # Show questionable projects
    if issues['questionable']:
        print("\n" + "=" * 80)
        print("⚠️  QUESTIONABLE COORDINATES (5-20km from expected):")
        print("=" * 80)
        for issue in issues['questionable'][:10]:  # Show first 10
            print(f"\n{issue['company']} - {issue['location']}")
            print(f"  Project ID: {issue['project_id']}")
            print(f"  Distance: {issue['distance_km']:.2f} km from {issue['expected_city']}")
            if issue['site_hint']:
                print(f"  Site hint: {issue['site_hint']} (may be correct for specific location)")
        if len(issues['questionable']) > 10:
            print(f"\n  ... and {len(issues['questionable']) - 10} more")
    
    # Save report
    report_path = Path(__file__).parent / "coordinate_accuracy_report.json"
    with open(report_path, 'w') as f:
        json.dump({
            'total_checked': len(projects),
            'correct': len(projects) - len(issues['incorrect']) - len(issues['questionable']) - len(issues['no_reference']),
            'incorrect': len(issues['incorrect']),
            'questionable': len(issues['questionable']),
            'no_reference': len(issues['no_reference']),
            'issues': issues
        }, f, indent=2)
    
    print(f"\n💾 Report saved to: {report_path}")
    
    conn.close()
    
    return issues

if __name__ == "__main__":
    check_coordinate_accuracy()

