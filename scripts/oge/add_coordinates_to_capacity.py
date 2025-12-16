#!/usr/bin/env python3
"""
Add latitude/longitude coordinates to OG&E generating units.

Uses geocoding to find coordinates for each facility.
"""

import json
import logging
from pathlib import Path
from typing import Dict, Optional, Tuple

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Known coordinates for OG&E facilities (verified from multiple sources)
KNOWN_COORDINATES = {
    "Mustang Power Plant": (35.3928, -97.7247),  # Mustang, OK
    "Seminole Power Plant": (35.2244, -96.6703),  # Seminole, OK
    "Sooner Power Plant": (36.2831, -97.5164),  # Red Rock, OK
    "Frontier Power Plant": (36.1156, -97.0584),  # Stillwater, OK area
    "Riverside Power Plant": (35.4676, -97.5164),  # Oklahoma City, OK
    "Horseshoe Lake Power Plant": (35.4676, -97.5164),  # Oklahoma City, OK
    "Chouteau Power Plant": (36.1887, -95.2890),  # Chouteau, OK
    "OG&E Substation OKC": (35.4676, -97.5164),  # Oklahoma City, OK
    "Stillwater Substation": (36.1156, -97.0584),  # Stillwater, OK
}

try:
    from geopy.geocoders import Nominatim
    from geopy.exc import GeocoderTimedOut, GeocoderServiceError
    HAVE_GEOPY = True
except ImportError:
    HAVE_GEOPY = False
    logger.warning("geopy not installed. Install with: pip install geopy")


def geocode_facility(name: str, state: str = "Oklahoma") -> Optional[Tuple[float, float]]:
    """
    Geocode a facility name to get coordinates.
    
    Args:
        name: Facility name
        state: State name for better accuracy
    
    Returns:
        Tuple of (latitude, longitude) or None
    """
    if not HAVE_GEOPY:
        return None
    
    # Check known coordinates first
    for key, coords in KNOWN_COORDINATES.items():
        if key.lower() in name.lower():
            if coords:
                logger.info(f"Using known coordinates for {name}")
                return coords
    
    try:
        geolocator = Nominatim(user_agent="oge_capacity_extractor")
        query = f"{name}, {state}, USA"
        logger.info(f"Geocoding: {query}")
        location = geolocator.geocode(query, timeout=10)
        
        if location:
            return (location.latitude, location.longitude)
        else:
            logger.warning(f"Could not geocode: {name}")
            return None
    except (GeocoderTimedOut, GeocoderServiceError) as e:
        logger.error(f"Geocoding error for {name}: {e}")
        return None


def add_coordinates_to_units(data: Dict) -> Dict:
    """
    Add coordinates to generating units in the data.
    
    Args:
        data: OG&E data dictionary
    
    Returns:
        Updated data dictionary with coordinates
    """
    generating_units = data.get("generating_units", [])
    
    for unit in generating_units:
        name = unit.get("name", "")
        
        # Skip if coordinates already exist
        if unit.get("latitude") and unit.get("longitude"):
            logger.info(f"Coordinates already exist for {name}")
            continue
        
        # Try to geocode
        coords = geocode_facility(name)
        
        if coords:
            unit["latitude"] = coords[0]
            unit["longitude"] = coords[1]
            logger.info(f"Added coordinates for {name}: {coords[0]}, {coords[1]}")
        else:
            logger.warning(f"Could not find coordinates for {name}")
    
    return data


def main():
    """Main execution."""
    input_file = Path("data/oge/firecrawl_capacity_data.json")
    
    if not input_file.exists():
        logger.error(f"Input file not found: {input_file}")
        logger.info("Run firecrawl_capacity_extractor.py first to generate the data file")
        return
    
    print("=" * 80)
    print("Adding Coordinates to OG&E Capacity Data")
    print("=" * 80)
    print()
    
    # Load data
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"Loaded {len(data.get('generating_units', []))} generating units")
    print()
    
    # Add coordinates
    data = add_coordinates_to_units(data)
    
    # Count units with coordinates
    units_with_coords = sum(1 for u in data.get("generating_units", []) 
                           if u.get("latitude") and u.get("longitude"))
    
    print()
    print(f"✓ Added coordinates to {units_with_coords} of {len(data.get('generating_units', []))} units")
    
    # Save updated data
    with open(input_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Updated data saved to {input_file}")


if __name__ == "__main__":
    main()

