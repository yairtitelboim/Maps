#!/usr/bin/env python3
"""
Extract better location data from source article text for projects without coordinates.
"""

import sys
import re
import json
from pathlib import Path
import sqlite3
from geopy.geocoders import Nominatim
import time

def extract_locations_from_text(text: str) -> list:
    """Extract all Texas location mentions from text."""
    locations = []
    
    if not text:
        return locations
    
    # Major Texas cities
    texas_cities = [
        "Houston", "San Antonio", "Dallas", "Austin", "Fort Worth", "El Paso",
        "Arlington", "Corpus Christi", "Plano", "Laredo", "Lubbock", "Garland",
        "Irving", "Amarillo", "Grand Prairie", "Brownsville", "McKinney",
        "Frisco", "Pasadena", "Killeen", "Mesquite", "McAllen", "Carrollton",
        "Midland", "Denton", "Abilene", "Beaumont", "Round Rock", "Odessa",
        "Waco", "Richardson", "Lewisville", "Tyler", "College Station", "Pearland",
        "Sugar Land", "Wichita Falls", "Edinburg", "Temple", "Midlothian", "Lancaster",
        "Lacy Lakeview", "Whitney", "Taylor"
    ]
    
    # Texas counties
    texas_counties = [
        "Harris County", "Dallas County", "Tarrant County", "Bexar County",
        "Travis County", "Collin County", "Fort Bend County", "Denton County",
        "Montgomery County", "Williamson County", "El Paso County", "Hidalgo County",
        "Cameron County", "Galveston County", "Brazoria County", "Jefferson County",
        "Bell County", "Hays County", "Medina County", "Ector County", "Bosque County",
        "Hill County", "Ellis County"
    ]
    
    text_lower = text.lower()
    
    # Check for cities
    for city in texas_cities:
        if city.lower() in text_lower:
            locations.append(city)
    
    # Check for counties
    for county in texas_counties:
        if county.lower() in text_lower:
            locations.append(county)
    
    # Pattern matching
    patterns = [
        r"\b(in|near|at|outside|southeast|northeast|southwest|northwest)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
        r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County",
        r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+Texas",
        r"data center (?:in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
    ]
    
    for pattern in patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            place = match.group(2) if len(match.groups()) > 1 else match.group(1)
            if place and place.lower() not in ["the", "data", "center", "will", "build", "texas", "county", "deal", "secures", "power", "through", "for", "cloud", "ai", "expansion", "by", "announced", "future", "plans", "lone", "star", "state", "from", "their", "campus"]:
                if len(place.split()) <= 3:  # Reasonable length
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

def geocode_safely(location: str) -> dict:
    """Geocode with Texas bounds validation."""
    if not location:
        return None
    
    try:
        geocoder = Nominatim(user_agent="texas_data_center_tracker", timeout=10)
        query = f"{location}, Texas, USA"
        location_obj = geocoder.geocode(query, exactly_one=True)
        
        if location_obj:
            lat, lng = location_obj.latitude, location_obj.longitude
            # Validate Texas bounds
            if 25 <= lat <= 37 and -107 <= lng <= -93:
                return {
                    "lat": lat,
                    "lng": lng,
                    "confidence": "city" if "city" in location_obj.raw.get("type", []) else "county"
                }
    except Exception as e:
        pass
    
    return None

def main():
    db_path = Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Get projects without coordinates
    cursor.execute("""
        SELECT p.project_id, p.company, p.location_text, p.mention_ids, p.source_urls
        FROM projects p
        WHERE (p.lat IS NULL OR p.lng IS NULL)
        AND p.location_text IS NOT NULL
        AND p.location_text != ''
        ORDER BY p.company
    """)
    
    projects = cursor.fetchall()
    
    print(f"🔍 Extracting locations from source articles for {len(projects)} projects...")
    print("")
    
    geocoded_count = 0
    
    for project_id, company, location_text, mention_ids_json, source_urls_json in projects:
        print(f"📍 {company or 'Unknown'}: {location_text}")
        
        best_location = None
        all_locations = []
        
        # Get source article text
        if mention_ids_json:
            try:
                mention_ids = json.loads(mention_ids_json)
                if mention_ids:
                    placeholders = ",".join("?" * len(mention_ids))
                    cursor.execute(f"""
                        SELECT title, snippet FROM mentions
                        WHERE mention_id IN ({placeholders})
                    """, mention_ids)
                    
                    for title, snippet in cursor.fetchall():
                        text = f"{title} {snippet}"
                        found = extract_locations_from_text(text)
                        all_locations.extend(found)
            except:
                pass
        
        # Use best location found
        if all_locations:
            # Prefer specific city names
            specific = [loc for loc in all_locations if len(loc.split()) <= 2]
            if specific:
                best_location = specific[0]
                print(f"   ✅ Found in source: '{best_location}'")
            else:
                best_location = all_locations[0]
                print(f"   ✅ Found in source: '{best_location}'")
        
        # Try geocoding
        if best_location:
            coords = geocode_safely(best_location)
            if coords:
                cursor.execute("""
                    UPDATE projects
                    SET lat = ?, lng = ?, geocode_confidence = ?
                    WHERE project_id = ?
                """, (coords["lat"], coords["lng"], coords["confidence"], project_id))
                geocoded_count += 1
                print(f"   ✅ Geocoded: {coords['lat']:.4f}, {coords['lng']:.4f}")
            else:
                print(f"   ❌ Could not geocode '{best_location}'")
        else:
            print(f"   ⚠️  No location found in source articles")
        
        print("")
        time.sleep(1)  # Rate limit
    
    conn.commit()
    conn.close()
    
    print(f"✅ Geocoded {geocoded_count} additional projects")

if __name__ == "__main__":
    main()

