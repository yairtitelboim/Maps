#!/usr/bin/env python3
"""
Clean location text and geocode projects.
Extracts city/county names from messy location_text fields.
"""

import sys
import re
from pathlib import Path
import sqlite3
import time
from geopy.geocoders import Nominatim

def clean_location_text(location_text: str) -> str:
    """Extract clean city/county name from messy location text."""
    if not location_text:
        return ""
    
    # Common Texas cities/counties
    texas_places = [
        "El Paso", "San Antonio", "Dallas", "Houston", "Austin", "Fort Worth",
        "Lancaster", "Lacy Lakeview", "Medina County", "Ector County", "Ector",
        "Bosque County", "Hay County", "Hays County", "North Texas", "Central Texas"
    ]
    
    # Try to find city/county names
    for place in texas_places:
        if place.lower() in location_text.lower():
            return place
    
    # Extract patterns like "in [City]" or "[City], Texas"
    patterns = [
        r"\b(in|near|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
        r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+Texas",
        r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, location_text, re.IGNORECASE)
        if match:
            place = match.group(2) if len(match.groups()) > 1 else match.group(1)
            # Filter out common words
            if place.lower() not in ["the", "data", "center", "will", "build", "texas"]:
                return place.strip()
    
    # If contains "El Paso", return that
    if "el paso" in location_text.lower():
        return "El Paso"
    
    # If contains "San Antonio", return that
    if "san antonio" in location_text.lower():
        return "San Antonio"
    
    # If contains "Dallas", return that
    if "dallas" in location_text.lower():
        return "Dallas"
    
    # If contains "Lancaster", return that
    if "lancaster" in location_text.lower():
        return "Lancaster"
    
    return ""

def geocode_clean_location(location_text: str) -> dict:
    """Geocode cleaned location."""
    if not location_text:
        return None
    
    try:
        geocoder = Nominatim(user_agent="texas_data_center_tracker", timeout=10)
        query = f"{location_text}, Texas, USA"
        location = geocoder.geocode(query)
        
        if location:
            return {
                "lat": location.latitude,
                "lng": location.longitude,
                "confidence": "city" if "city" in location.raw.get("type", []) else "county"
            }
    except Exception as e:
        print(f"   ⚠️  Geocoding failed for '{location_text}': {e}")
    
    return None

def main():
    db_path = Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Get projects without coordinates
    cursor.execute("""
        SELECT project_id, company, location_text, lat, lng
        FROM projects
        WHERE (lat IS NULL OR lng IS NULL)
        AND location_text IS NOT NULL
        AND location_text != ''
        ORDER BY company
    """)
    
    projects = cursor.fetchall()
    
    print(f"📊 Cleaning and geocoding {len(projects)} projects...")
    
    geocoded = 0
    
    for i, (project_id, company, location_text, lat, lng) in enumerate(projects):
        if lat and lng:
            continue
        
        cleaned = clean_location_text(location_text)
        
        if cleaned:
            print(f"   [{i+1}/{len(projects)}] {company}: '{location_text}' → '{cleaned}'")
            coords = geocode_clean_location(cleaned)
            
            if coords:
                cursor.execute("""
                    UPDATE projects
                    SET lat = ?, lng = ?, geocode_confidence = ?
                    WHERE project_id = ?
                """, (coords["lat"], coords["lng"], coords["confidence"], project_id))
                geocoded += 1
                print(f"      ✅ {coords['lat']:.4f}, {coords['lng']:.4f}")
            else:
                print(f"      ❌ Failed to geocode")
        else:
            print(f"   [{i+1}/{len(projects)}] {company}: '{location_text}' → (could not clean)")
        
        # Rate limit
        time.sleep(1)
    
    conn.commit()
    conn.close()
    
    print(f"\n✅ Geocoded {geocoded} projects")

if __name__ == "__main__":
    main()

