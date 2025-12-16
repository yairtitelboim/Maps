#!/usr/bin/env python3
"""
Ohio county centroids lookup.

Coordinates are approximate centroids for each county in Ohio.
Source: Calculated from county boundaries or standard reference data.
"""

# Ohio county centroids (lat, lng)
OHIO_COUNTY_CENTROIDS = {
    'Adams': (38.8456, -83.4728),
    'Allen': (40.7714, -84.1086),
    'Ashland': (40.8567, -82.3161),
    'Ashtabula': (41.8967, -80.7667),
    'Athens': (39.3292, -82.0458),
    'Auglaize': (40.5611, -84.2211),
    'Belmont': (40.0167, -80.9833),
    'Brown': (38.9333, -83.8667),
    'Butler': (39.5000, -84.5667),
    'Carroll': (40.5833, -81.0833),
    'Champaign': (40.1333, -83.7667),
    'Clark': (39.9167, -83.7833),
    'Clermont': (39.0500, -84.1500),
    'Clinton': (39.4167, -83.8167),
    'Columbiana': (40.7667, -80.5667),
    'Coshocton': (40.2667, -81.8667),
    'Crawford': (40.8500, -82.9167),
    'Cuyahoga': (41.4333, -81.7000),
    'Darke': (40.1333, -84.6167),
    'Defiance': (41.2833, -84.3667),
    'Delaware': (40.2833, -83.0000),
    'Erie': (41.3500, -82.6833),
    'Fairfield': (39.7500, -82.6000),
    'Fayette': (39.5667, -83.4500),
    'Franklin': (39.9612, -82.9988),  # Columbus
    'Fulton': (41.6000, -84.1333),
    'Gallia': (38.8167, -82.2167),
    'Geauga': (41.5000, -81.1833),
    'Greene': (39.6833, -83.8833),
    'Guernsey': (40.0500, -81.5000),
    'Hamilton': (39.1833, -84.5333),  # Cincinnati
    'Hancock': (41.0000, -83.6667),
    'Hardin': (40.6667, -83.6667),
    'Harrison': (40.2833, -81.0833),
    'Henry': (41.3333, -84.0667),
    'Highland': (39.1833, -83.6000),
    'Hocking': (39.5000, -82.4833),
    'Holmes': (40.5667, -81.9167),
    'Huron': (41.1500, -82.6000),
    'Jackson': (39.0500, -82.6333),
    'Jefferson': (40.3833, -80.7667),
    'Knox': (40.4000, -82.4833),
    'Lake': (41.7333, -81.2333),
    'Lawrence': (38.6000, -82.5333),
    'Licking': (40.0833, -82.4833),
    'Logan': (40.3833, -83.7667),
    'Lorain': (41.1667, -82.0833),
    'Lucas': (41.6667, -83.5833),  # Toledo
    'Madison': (39.9000, -83.4000),
    'Mahoning': (41.0167, -80.7500),  # Youngstown
    'Marion': (40.5833, -83.1500),
    'Medina': (41.1333, -81.8667),
    'Meigs': (39.0833, -82.0167),
    'Mercer': (40.5333, -84.6333),
    'Miami': (40.0500, -84.2000),
    'Monroe': (39.7167, -81.0833),
    'Montgomery': (39.7500, -84.2833),  # Dayton
    'Morgan': (39.6167, -81.8500),
    'Morrow': (40.5167, -82.8000),
    'Muskingum': (39.9333, -81.9333),
    'Noble': (39.7667, -81.4667),
    'Ottawa': (41.5000, -83.0333),
    'Paulding': (41.1333, -84.5833),
    'Perry': (39.7333, -82.2333),
    'Pickaway': (39.5667, -83.0167),
    'Pike': (39.0833, -83.0667),
    'Portage': (41.1667, -81.2000),
    'Preble': (39.7333, -84.6667),
    'Putnam': (41.0167, -84.1333),
    'Richland': (40.7667, -82.5333),
    'Ross': (39.3333, -83.0667),
    'Sandusky': (41.3500, -83.1500),
    'Scioto': (38.8000, -82.9833),
    'Seneca': (41.1333, -83.1333),
    'Shelby': (40.3333, -84.2000),
    'Stark': (40.8000, -81.3667),  # Canton
    'Summit': (41.1167, -81.5333),  # Akron
    'Trumbull': (41.3000, -80.7500),
    'Tuscarawas': (40.4500, -81.4667),
    'Union': (40.3000, -83.3667),
    'Van Wert': (40.8667, -84.5833),
    'Vinton': (39.2500, -82.4833),
    'Warren': (39.4333, -84.1667),
    'Washington': (39.4500, -81.4833),
    'Wayne': (40.8333, -81.8833),
    'Williams': (41.5667, -84.5833),
    'Wood': (41.3667, -83.6167),
    'Wyandot': (40.8333, -83.3000),
}


def get_county_centroid(county_name: str) -> tuple:
    """
    Get centroid coordinates for an Ohio county.
    
    Args:
        county_name: County name (with or without "County" suffix)
    
    Returns:
        Tuple of (latitude, longitude) or None if not found
    """
    # Normalize county name
    county_name = county_name.strip()
    
    # Remove "County" suffix if present
    if county_name.endswith(' County'):
        county_name = county_name[:-7].strip()
    
    # Try exact match
    if county_name in OHIO_COUNTY_CENTROIDS:
        return OHIO_COUNTY_CENTROIDS[county_name]
    
    # Try case-insensitive match
    county_name_lower = county_name.lower()
    for key, value in OHIO_COUNTY_CENTROIDS.items():
        if key.lower() == county_name_lower:
            return value
    
    return None


def get_all_counties() -> list:
    """Get list of all Ohio county names."""
    return list(OHIO_COUNTY_CENTROIDS.keys())


if __name__ == '__main__':
    # Test
    print(f"Total counties: {len(OHIO_COUNTY_CENTROIDS)}")
    print(f"\nSample lookups:")
    print(f"  Franklin: {get_county_centroid('Franklin')}")
    print(f"  Franklin County: {get_county_centroid('Franklin County')}")
    print(f"  Licking: {get_county_centroid('Licking')}")
    print(f"  Unknown: {get_county_centroid('Unknown')}")

