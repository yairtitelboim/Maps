#!/usr/bin/env python3
"""
Enhanced location extraction for remaining projects without coordinates.
Handles:
- Non-Texas project filtering
- Better extraction from source articles
- Specific location patterns (West Texas Panhandle, etc.)
- Site hint usage
- Ambiguous city names with Texas context
"""

import sys
import re
import json
from pathlib import Path
import sqlite3
from geopy.geocoders import Nominatim
import time

# Non-Texas indicators
NON_TEXAS_KEYWORDS = [
    'oklahoma', 'iowa', 'charlotte', 'north carolina', 'nc', 'ohio', 'virginia',
    'new mexico', 'nm', 'santa teresa', 'cedar rapids', 'yukon oklahoma',
    'central ohio', 'johnstown ohio', 'dorrance twp', 'pennsylvania', 'pa'
]

# Texas-specific location patterns
TEXAS_LOCATION_PATTERNS = [
    r"West Texas Panhandle",
    r"Shackelford County",
    r"San Marcos",
    r"Taylor,?\s+Texas",
    r"Jarrell,?\s+Texas",
    r"Red Oak,?\s+Texas",
    r"(\d+)\s+acres?\s+(?:in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s+Texas",
    r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County,?\s+Texas",
    r"data center (?:in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s+Texas",
    r"El Paso,?\s+Texas",
    r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s+Texas",
]

# Major Texas cities (for disambiguation)
TEXAS_CITIES = [
    "Houston", "San Antonio", "Dallas", "Austin", "Fort Worth", "El Paso",
    "Arlington", "Corpus Christi", "Plano", "Laredo", "Lubbock", "Garland",
    "Irving", "Amarillo", "Grand Prairie", "Brownsville", "McKinney",
    "Frisco", "Pasadena", "Killeen", "Mesquite", "McAllen", "Carrollton",
    "Midland", "Denton", "Abilene", "Beaumont", "Round Rock", "Odessa",
    "Waco", "Richardson", "Lewisville", "Tyler", "College Station", "Pearland",
    "Sugar Land", "Wichita Falls", "Edinburg", "Temple", "Midlothian", "Lancaster",
    "Lacy Lakeview", "Whitney", "Taylor", "Jarrell", "San Marcos", "Red Oak"
]

def is_non_texas_project(location_text: str, source_urls: str, title: str, snippet: str) -> bool:
    """Check if project is non-Texas - be conservative, only filter clear cases."""
    # Only filter if location_text explicitly mentions non-Texas location
    if location_text:
        location_lower = location_text.lower()
        if any(keyword in location_lower for keyword in ['oklahoma', 'iowa', 'charlotte', 'north carolina', 'ohio', 'virginia', 'new mexico', 'pennsylvania', 'pa']):
            return True
    
    # Check URL for clear non-Texas indicators
    if source_urls:
        source_lower = str(source_urls).lower()
        if any(keyword in source_lower for keyword in ['okenergytoday.com', 'iowa.com', 'charlotte', 'ohio', 'virginia', 'pennsylvania']):
            return True
    
    # Check title/snippet for explicit non-Texas mentions in location context
    text = f"{title} {snippet}".lower()
    non_texas_patterns = [
        r'data center (?:in|at|near)\s+(?:yukon\s+)?oklahoma',
        r'data center (?:in|at|near)\s+iowa',
        r'data center (?:in|at|near)\s+charlotte',
        r'data center (?:in|at|near)\s+ohio',
        r'data center (?:in|at|near)\s+virginia',
        r'central ohio',
        r'johnstown,?\s+ohio',
        r'dorrance\s+twp',  # Pennsylvania
    ]
    
    return any(re.search(pattern, text) for pattern in non_texas_patterns)

def extract_locations_from_text(text: str) -> list:
    """Extract all Texas location mentions from text."""
    locations = []
    
    if not text:
        return locations
    
    text_lower = text.lower()
    
    # Check for Texas cities
    for city in TEXAS_CITIES:
        if city.lower() in text_lower:
            locations.append(city)
    
    # Check for Texas counties
    texas_counties = [
        "Harris County", "Dallas County", "Tarrant County", "Bexar County",
        "Travis County", "Collin County", "Fort Bend County", "Denton County",
        "Montgomery County", "Williamson County", "El Paso County", "Hidalgo County",
        "Cameron County", "Galveston County", "Brazoria County", "Jefferson County",
        "Bell County", "Hays County", "Medina County", "Ector County", "Bosque County",
        "Hill County", "Ellis County", "Shackelford County"
    ]
    
    for county in texas_counties:
        if county.lower() in text_lower:
            locations.append(county)
    
    # Pattern matching
    for pattern in TEXAS_LOCATION_PATTERNS:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            if len(match.groups()) > 0:
                place = match.group(len(match.groups()))
            else:
                place = match.group(0)
            
            if place and place.lower() not in ["the", "data", "center", "will", "build", "texas", "county", "deal", "secures", "power", "through", "for", "cloud", "ai", "expansion", "by", "announced", "future", "plans", "lone", "star", "state", "from", "their", "campus", "west", "panhandle"]:
                if len(place.split()) <= 4:  # Reasonable length
                    locations.append(place.strip())
    
    # Remove duplicates
    seen = set()
    unique = []
    for loc in locations:
        key = loc.lower()
        if key not in seen:
            seen.add(key)
            unique.append(loc)
    
    return unique

def geocode_with_texas_context(location: str) -> dict:
    """Geocode with Texas context for ambiguous names."""
    if not location:
        return None
    
    # Known Texas locations with specific coordinates
    known_locations = {
        "taylor": (30.5708, -97.4095),  # Taylor, TX (Williamson County)
        "jarrell": (30.8252, -97.6000),  # Jarrell, TX
        "san marcos": (29.8833, -97.9414),  # San Marcos, TX
        "red oak": (32.5182, -96.8047),  # Red Oak, TX
        "el paso": (31.7619, -106.4850),  # El Paso, TX
        "shackelford county": (32.7089, -99.3308),  # Shackelford County, TX
        "amarillo": (35.221997, -101.831298),  # Amarillo, TX (West Texas Panhandle)
    }
    
    location_lower = location.lower().strip()
    if location_lower in known_locations:
        lat, lng = known_locations[location_lower]
        return {
            "lat": lat,
            "lng": lng,
            "confidence": "city" if location_lower not in ["shackelford county"] else "county"
        }
    
    try:
        geocoder = Nominatim(user_agent="texas_data_center_tracker", timeout=10)
        
        # Try with Texas context first
        queries = [
            f"{location}, Texas, USA",
            f"{location}, TX, USA",
        ]
        
        for query in queries:
            try:
                location_obj = geocoder.geocode(query, exactly_one=True)
                if location_obj:
                    lat, lng = location_obj.latitude, location_obj.longitude
                    # Validate Texas bounds
                    if 25 <= lat <= 37 and -107 <= lng <= -93:
                        return {
                            "lat": lat,
                            "lng": lng,
                            "confidence": "city" if "city" in str(location_obj.raw.get("type", [])).lower() else "county"
                        }
            except:
                continue
    except Exception as e:
        pass
    
    return None

def handle_specific_cases(project_id: str, company: str, location_text: str, site_hint: str, title: str, snippet: str) -> str:
    """Handle specific known cases."""
    text = f"{title} {snippet}".lower()
    
    # Specific known cases
    if "shackelford" in text or ("frontier" in text.lower() and "vantage" in text.lower()):
        return "Shackelford County"
    
    if "el paso" in text and "texas" in text:
        return "El Paso"
    
    if "san marcos" in text:
        return "San Marcos"
    
    if "taylor" in text and ("texas" in text or "williamson" in text.lower()):
        return "Taylor"
    
    if "west texas panhandle" in text:
        # Look for county in text
        full_text = title + " " + snippet
        county_match = re.search(r"([A-Z][a-z]+)\s+County", full_text)
        if county_match:
            return county_match.group(1) + " County"
        return "Amarillo"  # Default to Amarillo area
    
    if "red oak" in text and "texas" in text:
        return "Red Oak"
    
    if site_hint and "plano" in site_hint.lower():
        return "Plano"
    
    # Check for Meta El Paso
    if company and company.lower() == "meta" and "el paso" in text:
        return "El Paso"
    
    return None

def main():
    db_path = Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Get projects without coordinates
    cursor.execute("""
        SELECT 
            p.project_id, 
            p.company, 
            p.location_text, 
            p.site_hint,
            p.mention_ids, 
            p.source_urls
        FROM projects p
        WHERE (p.lat IS NULL OR p.lng IS NULL)
        ORDER BY p.company, p.announced_date DESC
    """)
    
    projects = cursor.fetchall()
    
    print(f"🔍 Enhanced location extraction for {len(projects)} projects...")
    print("")
    
    geocoded_count = 0
    filtered_count = 0
    
    for project_id, company, location_text, site_hint, mention_ids_json, source_urls_json in projects:
        print(f"📍 {company or 'Unknown'}: {location_text or '(empty)'}")
        
        # Get source article text
        title = ""
        snippet = ""
        raw_text = None
        
        if mention_ids_json:
            try:
                mention_ids = json.loads(mention_ids_json)
                if mention_ids:
                    placeholders = ",".join("?" * len(mention_ids))
                    cursor.execute(f"""
                        SELECT title, snippet, raw_text FROM mentions
                        WHERE mention_id IN ({placeholders})
                        LIMIT 1
                    """, mention_ids)
                    
                    result = cursor.fetchone()
                    if result:
                        title = result[0] or ""
                        snippet = result[1] or ""
                        raw_text = result[2]
            except:
                pass
        
        # Check if non-Texas project
        source_urls_str = json.dumps(source_urls_json) if source_urls_json else ""
        if is_non_texas_project(location_text or "", source_urls_str, title, snippet):
            print(f"   🔴 Non-Texas project - marking as non_texas")
            cursor.execute("""
                UPDATE projects
                SET geocode_confidence = 'non_texas'
                WHERE project_id = ?
            """, (project_id,))
            filtered_count += 1
            print("")
            continue
        
        # Try specific case handling first
        best_location = handle_specific_cases(project_id, company, location_text, site_hint, title, snippet)
        
        # Extract from text if no specific case match
        if not best_location:
            text_to_search = raw_text or f"{title} {snippet}"
            locations = extract_locations_from_text(text_to_search)
            
            if locations:
                # Prefer specific city names
                specific = [loc for loc in locations if len(loc.split()) <= 2 and loc.lower() not in ["texas", "county"]]
                if specific:
                    best_location = specific[0]
                else:
                    best_location = locations[0]
        
        # Use site_hint as additional context
        if not best_location and site_hint:
            # Try to extract location from site_hint
            hint_locations = extract_locations_from_text(site_hint)
            if hint_locations:
                best_location = hint_locations[0]
        
        # Try geocoding
        if best_location:
            print(f"   ✅ Found location: '{best_location}'")
            coords = geocode_with_texas_context(best_location)
            if coords:
                cursor.execute("""
                    UPDATE projects
                    SET lat = ?, lng = ?, geocode_confidence = ?, location_text = COALESCE(NULLIF(location_text, ''), ?)
                    WHERE project_id = ?
                """, (coords["lat"], coords["lng"], coords["confidence"], best_location, project_id))
                geocoded_count += 1
                print(f"   ✅ Geocoded: {coords['lat']:.4f}, {coords['lng']:.4f}")
            else:
                print(f"   ❌ Could not geocode '{best_location}'")
        else:
            print(f"   ⚠️  No location found")
        
        print("")
        time.sleep(1)  # Rate limit
    
    conn.commit()
    conn.close()
    
    print(f"✅ Geocoded {geocoded_count} additional projects")
    print(f"🔴 Filtered {filtered_count} non-Texas projects")

if __name__ == "__main__":
    main()

