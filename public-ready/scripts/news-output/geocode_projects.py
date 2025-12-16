#!/usr/bin/env python3
"""
Geocode project locations to get lat/long coordinates.
Uses Nominatim (free) with caching to avoid re-geocoding.
Timeout protection: <60 seconds
"""

import sys
import time
import signal
from typing import Dict, Optional
from pathlib import Path
import sqlite3
import json

# Timeout configuration
MAX_RUNTIME_SECONDS = 55
TIMEOUT_EXCEEDED = False

def timeout_handler(signum, frame):
    """Handle timeout signal."""
    global TIMEOUT_EXCEEDED
    TIMEOUT_EXCEEDED = True
    print("\n⚠️  Timeout approaching - stopping gracefully...")
    raise TimeoutError("Script exceeded maximum runtime")

def health_check(start_time: float) -> bool:
    """Check if script is still within time limit."""
    elapsed = time.time() - start_time
    if elapsed > MAX_RUNTIME_SECONDS:
        return False
    return True

def geocode_location(location_text: str, cache: Dict = None) -> Optional[Dict]:
    """
    Geocode location text. Caches results to avoid re-geocoding.
    
    Args:
        location_text: City/county name
        cache: Dictionary cache of previous results
    
    Returns:
        {"lat": float, "lng": float, "confidence": str} or None
    """
    if cache is None:
        cache = {}
    
    # Check cache first
    cache_key = location_text.lower().strip()
    if cache_key in cache:
        return cache[cache_key]
    
    # Use Nominatim (free, rate limited to 1 req/sec)
    try:
        from geopy.geocoders import Nominatim
        geocoder = Nominatim(user_agent="texas_data_center_tracker", timeout=10)
        
        # Try with Texas, USA suffix
        query = f"{location_text}, Texas, USA"
        location = geocoder.geocode(query)
        
        if location:
            result = {
                "lat": location.latitude,
                "lng": location.longitude,
                "confidence": "city" if "city" in location.raw.get("type", []) else "county"
            }
            cache[cache_key] = result
            return result
    except Exception as e:
        print(f"   ⚠️  Geocoding failed for '{location_text}': {e}")
    
    return None

def geocode_all_projects(db_path: Path):
    """Geocode all projects that don't have coordinates yet."""
    start_time = time.time()
    
    # Set up timeout signal handler
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(MAX_RUNTIME_SECONDS)
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Check if lat/lng columns exist, add if not
        try:
            cursor.execute("SELECT lat FROM projects LIMIT 1")
        except sqlite3.OperationalError:
            print("📝 Adding lat/lng columns to projects table...")
            cursor.execute("ALTER TABLE projects ADD COLUMN lat REAL")
            cursor.execute("ALTER TABLE projects ADD COLUMN lng REAL")
            cursor.execute("ALTER TABLE projects ADD COLUMN geocode_confidence TEXT")
            conn.commit()
        
        # Fetch projects without coordinates
        cursor.execute("""
            SELECT project_id, location_text, lat, lng
            FROM projects
            WHERE location_text IS NOT NULL 
            AND location_text != ''
            AND (lat IS NULL OR lng IS NULL)
            ORDER BY announced_date DESC
        """)
        
        projects = cursor.fetchall()
        
        if not projects:
            print("✅ All projects already geocoded")
            conn.close()
            return
        
        print(f"📊 Geocoding {len(projects)} projects...")
        
        cache = {}
        geocoded_count = 0
        
        for i, (project_id, location_text, existing_lat, existing_lng) in enumerate(projects):
            # Health check every 10 projects
            if i > 0 and i % 10 == 0:
                if not health_check(start_time):
                    print(f"⚠️  Stopping at {i} projects due to time limit")
                    break
            
            # Skip if already geocoded
            if existing_lat and existing_lng:
                continue
            
            print(f"   [{i+1}/{len(projects)}] Geocoding: {location_text}")
            
            coords = geocode_location(location_text, cache)
            
            if coords:
                cursor.execute("""
                    UPDATE projects
                    SET lat = ?, lng = ?, geocode_confidence = ?
                    WHERE project_id = ?
                """, (
                    coords["lat"],
                    coords["lng"],
                    coords["confidence"],
                    project_id
                ))
                geocoded_count += 1
            
            # Rate limit: 1 request per second for Nominatim
            time.sleep(1)
        
        conn.commit()
        conn.close()
        
        elapsed = time.time() - start_time
        print(f"✅ Geocoded {geocoded_count} projects in {elapsed:.2f}s")
        
        if elapsed > 60:
            print(f"⚠️  WARNING: Script exceeded 60 seconds!")
        
    except TimeoutError:
        elapsed = time.time() - start_time
        print(f"⏱️  Timeout after {elapsed:.2f}s - partial geocoding complete")
    except Exception as e:
        signal.alarm(0)
        raise
    finally:
        signal.alarm(0)

def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Geocode project locations')
    parser.add_argument('--db', type=str, 
                       default=str(Path(__file__).parent.parent.parent / "data" / "news" / "news_pipeline.db"),
                       help='Database path')
    
    args = parser.parse_args()
    
    db_path = Path(args.db)
    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        sys.exit(1)
    
    geocode_all_projects(db_path)

if __name__ == "__main__":
    main()

