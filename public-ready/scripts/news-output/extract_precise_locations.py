#!/usr/bin/env python3
"""
Extract more precise locations for projects with overlapping coordinates.
Tries to find neighborhood/area-level locations instead of city-level.
"""

import sys
import re
import json
from pathlib import Path
import sqlite3
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
import time

# Texas neighborhoods and areas (common in data center contexts)
TEXAS_NEIGHBORHOODS = {
    'Dallas': ['uptown', 'downtown', 'plano', 'frisco', 'richardson', 'irving', 'garland', 'mesquite', 'carrollton', 'lewisville', 'midlothian', 'red oak', 'lancaster'],
    'Austin': ['taylor', 'jarrell', 'round rock', 'cedar park', 'georgetown', 'pflugerville', 'leander'],
    'Houston': ['sugar land', 'katy', 'the woodlands', 'cypress', 'pearland', 'league city'],
    'San Antonio': ['lytle', 'schertz', 'new braunfels', 'boerne'],
    'El Paso': ['northeast el paso', 'east el paso', 'west el paso'],
    'Fort Worth': ['alliance', 'keller', 'southlake', 'grapevine'],
}

# Directional indicators
DIRECTIONAL_PATTERNS = [
    r'(north|south|east|west|northeast|northwest|southeast|southwest)\s+(?:of|in|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
    r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(north|south|east|west|northeast|northwest|southeast|southwest)',
]

# Area/neighborhood patterns
AREA_PATTERNS = [
    r'(?:in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:area|region|district|neighborhood)',
    r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:suburb|community|town)',
    r'(?:near|close to|adjacent to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
]

def geocode_with_context(query: str, city_context: str = None) -> dict:
    """Geocode a location query, optionally with city context."""
    try:
        geocoder = Nominatim(user_agent="texas_data_center_precise_geocoding", timeout=10)
        
        # Try with Texas context first
        if city_context:
            full_query = f"{query}, {city_context}, Texas, USA"
        else:
            full_query = f"{query}, Texas, USA"
        
        location = geocoder.geocode(full_query, exactly_one=True)
        
        if location:
            # Check if result is in Texas
            if 25 <= location.latitude <= 37 and -107 <= location.longitude <= -93:
                # Determine confidence based on result type
                result_type = location.raw.get('type', '')
                address = location.raw.get('display_name', '')
                
                if 'neighbourhood' in result_type or 'suburb' in result_type:
                    confidence = 'neighborhood'
                elif 'city' in result_type or 'town' in result_type:
                    confidence = 'city'
                elif 'county' in result_type:
                    confidence = 'county'
                else:
                    confidence = 'area'
                
                return {
                    'lat': location.latitude,
                    'lng': location.longitude,
                    'confidence': confidence,
                    'address': address
                }
    except (GeocoderTimedOut, GeocoderServiceError) as e:
        print(f"   ⚠️  Geocoding error: {e}")
    except Exception as e:
        print(f"   ⚠️  Unexpected error: {e}")
    
    return None

def extract_precise_location(location_text: str, site_hint: str = None, raw_text: str = None) -> list:
    """Extract more precise location information from text."""
    candidates = []
    
    if not location_text and not site_hint and not raw_text:
        return candidates
    
    # Combine all text sources
    text = f"{location_text or ''} {site_hint or ''} {raw_text or ''}".strip()
    text_lower = text.lower()
    
    # Check for neighborhood mentions
    for city, neighborhoods in TEXAS_NEIGHBORHOODS.items():
        for neighborhood in neighborhoods:
            if neighborhood.lower() in text_lower:
                # Check if it's mentioned in context (not just part of another word)
                pattern = r'\b' + re.escape(neighborhood) + r'\b'
                if re.search(pattern, text_lower, re.IGNORECASE):
                    candidates.append({
                        'location': neighborhood.title(),
                        'city_context': city,
                        'source': 'neighborhood_list',
                        'confidence': 'high'
                    })
    
    # Extract directional patterns (e.g., "northeast of Dallas", "Taylor north")
    for pattern in DIRECTIONAL_PATTERNS:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            if len(match.groups()) == 2:
                direction, place = match.groups()
                candidates.append({
                    'location': f"{direction.title()} {place}",
                    'city_context': place if place in TEXAS_NEIGHBORHOODS else None,
                    'source': 'directional',
                    'confidence': 'medium'
                })
    
    # Extract area patterns
    for pattern in AREA_PATTERNS:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            if match.group(1):
                place = match.group(1)
                candidates.append({
                    'location': place,
                    'city_context': None,
                    'source': 'area_pattern',
                    'confidence': 'medium'
                })
    
    # Extract standalone city/town names (if they're not the main city)
    texas_towns = ['Taylor', 'Jarrell', 'Lytle', 'Midlothian', 'Red Oak', 'Lancaster', 
                   'Whitney', 'Schertz', 'New Braunfels', 'Boerne', 'Keller', 'Southlake']
    for town in texas_towns:
        if town.lower() in text_lower:
            pattern = r'\b' + re.escape(town) + r'\b'
            if re.search(pattern, text, re.IGNORECASE):
                candidates.append({
                    'location': town,
                    'city_context': None,
                    'source': 'town_name',
                    'confidence': 'high'
                })
    
    # Extract from site_hint if it contains location info
    if site_hint:
        # Look for city/town names in site_hint
        for town in texas_towns:
            if town.lower() in site_hint.lower():
                candidates.append({
                    'location': town,
                    'city_context': None,
                    'source': 'site_hint',
                    'confidence': 'high'
                })
    
    return candidates

def get_raw_text_from_mentions(mention_ids: str, cursor) -> str:
    """Get raw text from mention articles."""
    if not mention_ids:
        return ""
    
    try:
        mention_list = json.loads(mention_ids) if isinstance(mention_ids, str) else mention_ids
        if not mention_list:
            return ""
    except:
        return ""
    
    # Get raw text from first few mentions
    raw_texts = []
    for mention_id in mention_list[:3]:  # Limit to first 3 mentions
        cursor.execute("""
            SELECT raw_text, snippet, title
            FROM mentions
            WHERE mention_id = ?
        """, (mention_id,))
        result = cursor.fetchone()
        if result:
            raw_text, snippet, title = result
            if raw_text:
                raw_texts.append(raw_text)
            elif snippet:
                raw_texts.append(snippet)
            elif title:
                raw_texts.append(title)
    
    return " ".join(raw_texts)

def main():
    db_path = Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"
    
    if not db_path.exists():
        print(f"❌ Database not found: {db_path}")
        return
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Find projects with overlapping coordinates (city-level geocoding)
    print("🔍 Finding projects with overlapping coordinates...")
    cursor.execute("""
        SELECT 
            p.project_id,
            p.project_name,
            p.company,
            p.location_text,
            p.site_hint,
            p.lat,
            p.lng,
            p.geocode_confidence,
            p.mention_ids,
            COUNT(*) OVER (PARTITION BY p.lat, p.lng) as overlap_count
        FROM projects p
        WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL
        AND p.lat BETWEEN 25 AND 37 AND p.lng BETWEEN -107 AND -93
        AND EXISTS (
            SELECT 1 FROM projects p2
            WHERE p2.lat = p.lat AND p2.lng = p.lng
            AND p2.project_id != p.project_id
        )
        ORDER BY p.lat, p.lng, p.company
    """)
    
    projects = cursor.fetchall()
    
    if not projects:
        print("✅ No overlapping projects found")
        conn.close()
        return
    
    print(f"📊 Found {len(projects)} projects with overlapping coordinates\n")
    
    improved_count = 0
    processed = set()
    
    for i, (project_id, name, company, location_text, site_hint, lat, lng, confidence, mention_ids, overlap_count) in enumerate(projects):
        if project_id in processed:
            continue
        
        print(f"[{i+1}/{len(projects)}] {project_id}")
        print(f"   Company: {company or 'Unknown'}")
        print(f"   Current: ({lat:.6f}, {lng:.6f}) - {confidence or 'unknown'} confidence")
        print(f"   Location text: {location_text or 'N/A'}")
        print(f"   Site hint: {site_hint or 'N/A'}")
        print(f"   Overlap count: {overlap_count}")
        
        # Get raw text from mentions
        raw_text = get_raw_text_from_mentions(mention_ids, cursor)
        
        # Extract precise location candidates
        candidates = extract_precise_location(location_text, site_hint, raw_text)
        
        if not candidates:
            print(f"   ⚠️  No precise location candidates found")
            print()
            processed.add(project_id)
            continue
        
        # Try geocoding candidates (prefer high confidence)
        candidates.sort(key=lambda x: {'high': 0, 'medium': 1, 'low': 2}.get(x['confidence'], 3))
        
        improved = False
        for candidate in candidates:
            location = candidate['location']
            city_context = candidate.get('city_context')
            
            print(f"   🔍 Trying: '{location}'" + (f" (in {city_context})" if city_context else ""))
            
            coords = geocode_with_context(location, city_context)
            
            if coords:
                # Check if new coordinates are different and more precise
                lat_diff = abs(coords['lat'] - lat)
                lng_diff = abs(coords['lng'] - lng)
                
                # If coordinates are significantly different (> 0.01 degrees = ~1km), update
                if lat_diff > 0.01 or lng_diff > 0.01:
                    print(f"   ✅ Found more precise location: ({coords['lat']:.6f}, {coords['lng']:.6f})")
                    print(f"      Confidence: {coords['confidence']}")
                    print(f"      Address: {coords['address'][:80]}...")
                    
                    # Update database
                    cursor.execute("""
                        UPDATE projects
                        SET lat = ?, lng = ?, geocode_confidence = ?
                        WHERE project_id = ?
                    """, (coords['lat'], coords['lng'], coords['confidence'], project_id))
                    
                    improved_count += 1
                    improved = True
                    break
                else:
                    print(f"   ⚠️  Coordinates too similar to existing")
            else:
                print(f"   ❌ Could not geocode")
            
            # Rate limit
            time.sleep(1)
        
        if not improved:
            print(f"   ⚠️  Could not improve location")
        
        print()
        processed.add(project_id)
        
        # Commit every 10 projects
        if (i + 1) % 10 == 0:
            conn.commit()
            print(f"💾 Committed progress...\n")
    
    conn.commit()
    conn.close()
    
    print(f"\n✅ Improved {improved_count} project locations")
    print(f"📊 Processed {len(processed)} projects")

if __name__ == "__main__":
    main()

