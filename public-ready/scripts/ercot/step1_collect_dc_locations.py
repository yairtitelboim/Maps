#!/usr/bin/env python3
"""
Step 1: Collect Real Data Center Locations in Texas
Uses real sources only - no synthetic data
"""

import csv
from pathlib import Path
import requests
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
import time

# Real data center locations from verified sources
# Sources: News articles, company announcements, datacentermap.com
REAL_DC_LOCATIONS = [
    # Microsoft Taylor (verified from news)
    {
        'name': 'Microsoft Taylor Data Center',
        'city': 'Taylor',
        'county': 'Williamson',
        'company': 'Microsoft',
        'source_url': 'https://www.microsoft.com/en-us/cloud-infrastructure',
        'notes': 'Major Microsoft data center campus in Taylor, TX'
    },
    # Google Midlothian (verified from news)
    {
        'name': 'Google Midlothian Data Center',
        'city': 'Midlothian',
        'county': 'Ellis',
        'company': 'Google',
        'source_url': 'https://www.reuters.com/business/google-invest-40-billion-new-data-centers-texas-bloomberg-news-reports-2025-11-14/',
        'notes': 'Google cloud campus expansion'
    },
    # Google Dallas (verified from news)
    {
        'name': 'Google Dallas Data Center',
        'city': 'Dallas',
        'county': 'Dallas',
        'company': 'Google',
        'source_url': 'https://www.reuters.com/business/google-invest-40-billion-new-data-centers-texas-bloomberg-news-reports-2025-11-14/',
        'notes': 'Google cloud campus'
    },
    # Vantage Frontier - Shackelford County (verified from Reuters)
    {
        'name': 'Vantage Frontier Data Center',
        'city': 'Albany',
        'county': 'Shackelford',
        'company': 'Vantage Data Centers',
        'source_url': 'https://www.reuters.com/business/vantage-data-centers-plans-25-billion-ai-campus-texas-2025-08-19/',
        'notes': '1.4 GW AI campus, 1,200 acres'
    },
    # OpenAI Stargate - Abilene (verified from AP News)
    {
        'name': 'OpenAI Stargate Data Center',
        'city': 'Abilene',
        'county': 'Taylor',
        'company': 'OpenAI',
        'source_url': 'https://apnews.com/article/0b3f4fa6e8d8141b4c143e3e7f41aba1',
        'notes': '900 MW AI supercluster, world\'s largest'
    },
    # Rowan Cinco - San Antonio area (verified from company)
    {
        'name': 'Rowan Cinco Data Center',
        'city': 'San Antonio',
        'county': 'Bexar',
        'company': 'Rowan Digital Infrastructure',
        'source_url': 'https://rowan.digital/news/cinco-data-center/',
        'notes': '300 MW hyperscale project'
    },
    # Google Armstrong County (announced)
    {
        'name': 'Google Armstrong County Data Center',
        'city': 'Claude',
        'county': 'Armstrong',
        'company': 'Google',
        'source_url': 'https://www.reuters.com/business/google-invest-40-billion-new-data-centers-texas-bloomberg-news-reports-2025-11-14/',
        'notes': 'Announced 2025, planned by 2027'
    },
    # Google Haskell County (announced - 2 sites)
    {
        'name': 'Google Haskell County Data Center 1',
        'city': 'Haskell',
        'county': 'Haskell',
        'company': 'Google',
        'source_url': 'https://www.reuters.com/business/google-invest-40-billion-new-data-centers-texas-bloomberg-news-reports-2025-11-14/',
        'notes': 'Announced 2025, planned by 2027'
    },
    {
        'name': 'Google Haskell County Data Center 2',
        'city': 'Haskell',
        'county': 'Haskell',
        'company': 'Google',
        'source_url': 'https://www.reuters.com/business/google-invest-40-billion-new-data-centers-texas-bloomberg-news-reports-2025-11-14/',
        'notes': 'Announced 2025, planned by 2027 (second site)'
    },
]

def geocode_location(city, county, state='Texas'):
    """Geocode a location using city and county."""
    geolocator = Nominatim(user_agent="ercot_dc_analysis")
    
    # Try city, county, Texas first
    query = f"{city}, {county} County, {state}"
    try:
        location = geolocator.geocode(query, timeout=10)
        if location:
            return location.latitude, location.longitude
    except (GeocoderTimedOut, GeocoderServiceError):
        pass
    
    # Try just city, Texas
    query = f"{city}, {state}"
    try:
        location = geolocator.geocode(query, timeout=10)
        if location:
            return location.latitude, location.longitude
    except (GeocoderTimedOut, GeocoderServiceError):
        pass
    
    # Try county seat if city doesn't work
    # Use county centroid as fallback (we'll use county centroids later)
    return None, None

def get_county_centroid(county_name, state='Texas'):
    """Get approximate county centroid using a simple lookup."""
    # Texas county centroids (approximate)
    # Using county seat coordinates as approximation
    TEXAS_COUNTY_CENTROIDS = {
        'Williamson': (30.5708, -97.4095),  # Georgetown (county seat)
        'Ellis': (32.3606, -96.7978),  # Waxahachie (county seat)
        'Dallas': (32.7767, -96.7970),  # Dallas
        'Shackelford': (32.7357, -99.2926),  # Albany (county seat)
        'Taylor': (32.4487, -99.7331),  # Abilene (county seat)
        'Bexar': (29.4241, -98.4936),  # San Antonio
        'Armstrong': (34.9681, -101.3575),  # Claude (county seat)
        'Haskell': (33.1576, -99.7340),  # Haskell (county seat)
    }
    
    return TEXAS_COUNTY_CENTROIDS.get(county_name, (None, None))

def collect_dc_locations(output_file="data/ercot/dc_locations.csv"):
    """Collect and geocode data center locations."""
    
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("Step 1: Collect Real Data Center Locations")
    print("=" * 60)
    print()
    print(f"Collecting {len(REAL_DC_LOCATIONS)} data center locations...")
    print()
    
    dc_data = []
    
    for idx, dc in enumerate(REAL_DC_LOCATIONS, 1):
        print(f"{idx}. {dc['name']}")
        print(f"   Location: {dc['city']}, {dc['county']} County, TX")
        print(f"   Company: {dc['company']}")
        
        # Try geocoding
        lat, lon = geocode_location(dc['city'], dc['county'])
        
        # If geocoding fails, use county centroid
        if lat is None or lon is None:
            print(f"   ⚠️  Geocoding failed, using county centroid...")
            lat, lon = get_county_centroid(dc['county'])
        
        if lat and lon:
            print(f"   ✅ Coordinates: {lat:.6f}, {lon:.6f}")
        else:
            print(f"   ❌ Could not get coordinates")
            continue
        
        dc_data.append({
            'dc_id': f"DC{idx:03d}",
            'name': dc['name'],
            'city': dc['city'],
            'county': dc['county'],
            'lat': lat,
            'lon': lon,
            'company': dc['company'],
            'source_url': dc['source_url'],
            'notes': dc.get('notes', '')
        })
        
        # Rate limiting
        time.sleep(1)
        print()
    
    # Save to CSV
    if dc_data:
        with open(output_path, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['dc_id', 'name', 'city', 'county', 'lat', 'lon', 'company', 'source_url', 'notes'])
            writer.writeheader()
            writer.writerows(dc_data)
        
        print(f"✅ Saved {len(dc_data)} data center locations to: {output_path}")
    else:
        print("❌ No data center locations collected")
    
    return dc_data

if __name__ == "__main__":
    try:
        dc_locations = collect_dc_locations()
        print()
        print(f"Total data centers collected: {len(dc_locations)}")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

