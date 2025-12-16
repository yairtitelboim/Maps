#!/usr/bin/env python3
"""
Enhanced geocoding - extracts better location data from source articles
and geocodes all projects.
"""

import sys
import re
from pathlib import Path
import sqlite3
import json
import time
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError

def extract_location_from_text(text: str) -> list:
    """Extract all potential location mentions from text."""
    locations = []
    
    if not text:
        return locations
    
    text_lower = text.lower()
    
    # Texas cities (major ones)
    texas_cities = [
        "Houston", "San Antonio", "Dallas", "Austin", "Fort Worth", "El Paso",
        "Arlington", "Corpus Christi", "Plano", "Laredo", "Lubbock", "Garland",
        "Irving", "Amarillo", "Grand Prairie", "Brownsville", "McKinney",
        "Frisco", "Pasadena", "Killeen", "Mesquite", "McAllen", "Carrollton",
        "Midland", "Denton", "Abilene", "Beaumont", "Round Rock", "Odessa",
        "Waco", "Richardson", "Lewisville", "Tyler", "College Station", "Pearland",
        "Sugar Land", "Wichita Falls", "McKinney", "Edinburg", "Temple"
    ]
    
    # Texas counties
    texas_counties = [
        "Harris County", "Dallas County", "Tarrant County", "Bexar County",
        "Travis County", "Collin County", "Fort Bend County", "Denton County",
        "Montgomery County", "Williamson County", "El Paso County", "Hidalgo County",
        "Cameron County", "Galveston County", "Brazoria County", "Jefferson County",
        "Bell County", "Hays County", "Medina County", "Ector County", "Bosque County"
    ]
    
    # Check for cities
    for city in texas_cities:
        if city.lower() in text_lower:
            locations.append(city)
    
    # Check for counties
    for county in texas_counties:
        if county.lower() in text_lower:
            locations.append(county)
    
    # Pattern matching for "in [City]" or "[City], Texas"
    patterns = [
        r"\b(in|near|at|outside)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*,?\s*Texas",
        r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County",
        r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+Texas",
    ]
    
    for pattern in patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            place = match.group(2) if len(match.groups()) > 1 else match.group(1)
            if place and place.lower() not in ["the", "data", "center", "will", "build", "texas", "county"]:
                locations.append(place.strip())
    
    # Remove duplicates while preserving order
    seen = set()
    unique_locations = []
    for loc in locations:
        if loc.lower() not in seen:
            seen.add(loc.lower())
            unique_locations.append(loc)
    
    return unique_locations

def geocode_location(location_text: str, max_retries: int = 3) -> dict:
    """Geocode location with retry logic."""
    if not location_text:
        return None
    
    geocoder = Nominatim(user_agent="texas_data_center_tracker", timeout=10)
    
    # Try different query formats
    queries = [
        f"{location_text}, Texas, USA",
        f"{location_text}, TX, USA",
        location_text  # Sometimes works without suffix
    ]
    
    for query in queries:
        for attempt in range(max_retries):
            try:
                location = geocoder.geocode(query, exactly_one=True)
                if location:
                    return {
                        "lat": location.latitude,
                        "lng": location.longitude,
                        "confidence": "city" if "city" in location.raw.get("type", []) else "county",
                        "formatted": location.address
                    }
            except (GeocoderTimedOut, GeocoderServiceError) as e:
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
                    continue
                else:
                    print(f"   ⚠️  Geocoding failed for '{location_text}': {e}")
            except Exception as e:
                print(f"   ⚠️  Error geocoding '{location_text}': {e}")
                break
    
    return None

def main():
    db_path = Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Get projects without coordinates
    cursor.execute("""
        SELECT p.project_id, p.company, p.location_text, p.mention_ids
        FROM projects p
        WHERE (p.lat IS NULL OR p.lng IS NULL)
        ORDER BY p.company, p.announced_date DESC
    """)
    
    projects = cursor.fetchall()
    
    print(f"📊 Enhancing geocoding for {len(projects)} projects...")
    print("")
    
    geocoded_count = 0
    improved_count = 0
    
    for i, (project_id, company, location_text, mention_ids_json) in enumerate(projects):
        print(f"[{i+1}/{len(projects)}] {company or 'Unknown'}: {location_text or 'No location'}")
        
        # Try to get better location from source articles
        best_location = location_text
        locations_found = []
        
        if mention_ids_json:
            mention_ids = json.loads(mention_ids_json)
            if mention_ids:
                # Get snippets from source mentions
                placeholders = ",".join("?" * len(mention_ids))
                cursor.execute(f"""
                    SELECT title, snippet FROM mentions
                    WHERE mention_id IN ({placeholders})
                """, mention_ids)
                
                for title, snippet in cursor.fetchall():
                    text = f"{title} {snippet}"
                    found_locations = extract_location_from_text(text)
                    locations_found.extend(found_locations)
        
        # Use best location found
        if locations_found:
            # Prefer specific city names over vague terms
            specific_locations = [loc for loc in locations_found if len(loc.split()) <= 2 and loc.lower() not in ["texas", "north", "south", "central", "east", "west"]]
            if specific_locations:
                best_location = specific_locations[0]
                if best_location != location_text:
                    print(f"   📍 Improved: '{location_text}' → '{best_location}'")
                    improved_count += 1
        
        # Try to clean existing location if no improvement
        if not best_location or best_location == location_text:
            # Clean the location text
            if location_text:
                # Remove common prefixes/suffixes
                cleaned = re.sub(r"^(Texas|TX)\s+", "", location_text, flags=re.IGNORECASE)
                cleaned = re.sub(r"\s+(Texas|TX)$", "", cleaned, flags=re.IGNORECASE)
                cleaned = re.sub(r"\s+Meta will build.*$", "", cleaned, flags=re.IGNORECASE)
                cleaned = re.sub(r"^Northeast\s+", "", cleaned, flags=re.IGNORECASE)
                cleaned = cleaned.strip()
                
                if cleaned and cleaned != location_text:
                    best_location = cleaned
                    print(f"   🧹 Cleaned: '{location_text}' → '{best_location}'")
        
        # Geocode
        if best_location:
            coords = geocode_location(best_location)
            
            if coords:
                cursor.execute("""
                    UPDATE projects
                    SET lat = ?, lng = ?, geocode_confidence = ?
                    WHERE project_id = ?
                """, (coords["lat"], coords["lng"], coords["confidence"], project_id))
                geocoded_count += 1
                print(f"   ✅ Geocoded: {coords['lat']:.4f}, {coords['lng']:.4f} ({coords['confidence']})")
            else:
                print(f"   ❌ Could not geocode")
        else:
            print(f"   ⚠️  No location data available")
        
        # Rate limit
        time.sleep(1)
        
        print("")
    
    conn.commit()
    conn.close()
    
    print(f"✅ Geocoded {geocoded_count} projects")
    print(f"📈 Improved {improved_count} locations from source articles")

if __name__ == "__main__":
    main()

