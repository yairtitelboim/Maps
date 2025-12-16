#!/usr/bin/env python3
"""
Triage script for high-value projects - focuses on major companies first.
"""

import sys
import re
import json
from pathlib import Path
import sqlite3
from geopy.geocoders import Nominatim
import time

# High-value project IDs (Tier 1)
TIER_1_PROJECTS = [
    'proj_2527bab15f1b',  # Meta El Paso
    'proj_5d353b34c2ec',  # Vantage Frontier
    'proj_4867abff1592',  # Vantage Frontier (duplicate)
    'proj_bb58dfa6c724',  # Google Texas AI
    'proj_7c19a2e07bf0',  # Microsoft
    'proj_82db00db8d71',  # Google Permit
    'proj_14d55b09a2ea',  # Oracle Texas
    'proj_4573106dc8ed',  # CyrusOne Calpine
    'proj_96ac0eafe063',  # Calpine hyperscale (190 MW)
    'proj_cf274828cf57',  # West Texas Panhandle (500 MW)
    'proj_7ac3069f6d8e',  # West Texas Panhandle (500 MW)
    'proj_557567dbbc16',  # West Texas Panhandle (500 MW)
]

# Known locations from URLs/titles
KNOWN_LOCATIONS = {
    'el-paso': 'El Paso',
    'shackelford': 'Shackelford County',
    'frontier': 'Shackelford County',
    'san-marcos': 'San Marcos',
    'taylor': 'Taylor',
    'red-oak': 'Red Oak',
}

def extract_from_url(url: str) -> str:
    """Extract location hints from URL."""
    if not url:
        return None
    
    url_lower = url.lower()
    
    # Check for known location patterns in URL
    for key, location in KNOWN_LOCATIONS.items():
        if key in url_lower:
            return location
    
    # Check for city names in URL path
    city_match = re.search(r'/([a-z-]+)-texas', url_lower)
    if city_match:
        city = city_match.group(1).replace('-', ' ').title()
        if city in ['El Paso', 'San Marcos', 'Taylor', 'Red Oak']:
            return city
    
    return None

def extract_from_title(title: str, snippet: str) -> str:
    """Extract location from title/snippet."""
    if not title and not snippet:
        return None
    
    text = f"{title} {snippet}"
    text_lower = text.lower()
    
    # Specific patterns (case-insensitive)
    if 'el paso' in text_lower and 'texas' in text_lower:
        return 'El Paso'
    
    if 'shackelford' in text_lower or ('frontier' in text_lower and 'vantage' in text_lower):
        return 'Shackelford County'
    
    if 'san marcos' in text_lower:
        return 'San Marcos'
    
    if 'taylor' in text_lower and ('texas' in text_lower or 'williamson' in text_lower):
        return 'Taylor'
    
    if 'red oak' in text_lower and 'texas' in text_lower:
        return 'Red Oak'
    
    # Pattern: County names
    county_match = re.search(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County', text)
    if county_match:
        county = county_match.group(1) + " County"
        if county.lower() not in ['the', 'data', 'center', 'a', 'an']:
            return county
    
    # Pattern: "in [City], Texas" or "in [City] Texas" (but not "in Texas")
    city_match = re.search(r'\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),?\s+Texas\b', text, re.IGNORECASE)
    if city_match:
        city = city_match.group(1)
        if city.lower() not in ['the', 'data', 'center', 'a', 'an', 'texas'] and len(city.split()) <= 2:
            return city
    
    # Pattern: "[City], Texas" (standalone, not "in Texas")
    city_match = re.search(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),?\s+Texas\b', text, re.IGNORECASE)
    if city_match:
        city = city_match.group(1)
        if city.lower() not in ['the', 'data', 'center', 'a', 'an', 'texas'] and len(city.split()) <= 2:
            return city
    
    # Pattern: "at [City]" or "near [City]" (but avoid common words)
    city_match = re.search(r'\b(?:at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b', text, re.IGNORECASE)
    if city_match:
        city = city_match.group(1)
        excluded = ['the', 'data', 'center', 'a', 'an', 'texas', 'site', 'campus', 'facility', 'location']
        if city.lower() not in excluded and len(city.split()) <= 2:
            return city
    
    # Look for Texas cities in text
    texas_cities = ['Dallas', 'Austin', 'Houston', 'San Antonio', 'Fort Worth', 'Plano', 'Frisco', 'Round Rock', 'Cedar Park', 'Midlothian', 'Lancaster', 'Whitney', 'Bosque County', 'Armstrong County', 'Haskell County']
    for city in texas_cities:
        if city.lower() in text_lower:
            return city
    
    # Specific known cases from articles
    if 'armstrong county' in text_lower or 'haskell county' in text_lower:
        # Google project - prefer Armstrong County as primary
        if 'armstrong county' in text_lower:
            return 'Armstrong County'
        elif 'haskell county' in text_lower:
            return 'Haskell County'
    
    if 'dfw10' in text_lower or 'dfw 10' in text_lower:
        return 'Dallas'  # CyrusOne DFW10 is in Dallas area
    
    return None

def geocode_location(location: str) -> dict:
    """Geocode with known locations first."""
    if not location:
        return None
    
    # Known coordinates
    known_coords = {
        'el paso': (31.7619, -106.4850),
        'shackelford county': (32.7089, -99.3308),
        'san marcos': (29.8833, -97.9414),
        'taylor': (30.5708, -97.4095),
        'red oak': (32.5182, -96.8047),
        'armstrong county': (34.9667, -101.3500),  # Armstrong County, TX
        'haskell county': (33.1833, -99.7333),  # Haskell County, TX
        'dallas': (32.7767, -96.7970),
    }
    
    location_lower = location.lower()
    if location_lower in known_coords:
        lat, lng = known_coords[location_lower]
        return {
            'lat': lat,
            'lng': lng,
            'confidence': 'city' if 'county' not in location_lower else 'county'
        }
    
    # Try Nominatim with Texas context
    try:
        geocoder = Nominatim(user_agent="texas_data_center_tracker", timeout=10)
        query = f"{location}, Texas, USA"
        location_obj = geocoder.geocode(query, exactly_one=True)
        
        if location_obj:
            lat, lng = location_obj.latitude, location_obj.longitude
            if 25 <= lat <= 37 and -107 <= lng <= -93:
                return {
                    'lat': lat,
                    'lng': lng,
                    'confidence': 'city'
                }
    except:
        pass
    
    return None

def main():
    db_path = Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    print("🎯 Triage: High-Value Projects Geocoding")
    print("=" * 60)
    print("")
    
    # Get Tier 1 projects
    placeholders = ",".join("?" * len(TIER_1_PROJECTS))
    cursor.execute(f"""
        SELECT 
            p.project_id,
            p.company,
            p.location_text,
            p.site_hint,
            p.source_urls,
            p.mention_ids
        FROM projects p
        WHERE p.project_id IN ({placeholders})
        AND (p.lat IS NULL OR p.lng IS NULL)
        ORDER BY p.company
    """, TIER_1_PROJECTS)
    
    projects = cursor.fetchall()
    
    print(f"📊 Found {len(projects)} Tier 1 projects to geocode")
    print("")
    
    geocoded_count = 0
    
    for project_id, company, location_text, site_hint, source_urls_json, mention_ids_json in projects:
        print(f"📍 {company}: {project_id}")
        print(f"   Location: {location_text or '(empty)'}")
        
        best_location = None
        
        # Strategy 1: Extract from URL
        if source_urls_json:
            try:
                source_urls = json.loads(source_urls_json)
                if source_urls:
                    url_location = extract_from_url(source_urls[0])
                    if url_location:
                        best_location = url_location
                        print(f"   ✅ Found in URL: '{best_location}'")
            except:
                pass
        
        # Strategy 2: Extract from title/snippet
        if not best_location and mention_ids_json:
            try:
                mention_ids = json.loads(mention_ids_json)
                if mention_ids:
                    placeholders = ",".join("?" * len(mention_ids))
                    cursor.execute(f"""
                        SELECT title, snippet FROM mentions
                        WHERE mention_id IN ({placeholders})
                        LIMIT 1
                    """, mention_ids)
                    
                    result = cursor.fetchone()
                    if result:
                        title, snippet = result[0] or "", result[1] or ""
                        title_location = extract_from_title(title, snippet)
                        if title_location:
                            best_location = title_location
                            print(f"   ✅ Found in title/snippet: '{best_location}'")
            except:
                pass
        
        # Strategy 3: Use site_hint
        if not best_location and site_hint:
            if 'plano' in site_hint.lower():
                best_location = 'Plano'
                print(f"   ✅ Found in site_hint: '{best_location}'")
        
        # Geocode
        if best_location:
            coords = geocode_location(best_location)
            if coords:
                cursor.execute("""
                    UPDATE projects
                    SET lat = ?, lng = ?, geocode_confidence = ?, location_text = COALESCE(NULLIF(location_text, ''), ?)
                    WHERE project_id = ?
                """, (coords['lat'], coords['lng'], coords['confidence'], best_location, project_id))
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
    
    print("=" * 60)
    print(f"✅ Geocoded {geocoded_count} high-value projects")
    print(f"📊 Success rate: {geocoded_count}/{len(projects)} ({geocoded_count*100//len(projects) if projects else 0}%)")

if __name__ == "__main__":
    main()

