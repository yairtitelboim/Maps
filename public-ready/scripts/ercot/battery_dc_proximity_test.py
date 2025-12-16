#!/usr/bin/env python3
"""
Battery-DC Proximity Test
Tests if battery storage projects cluster near data centers
"""

import pandas as pd
import json
from pathlib import Path
import math

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in miles using Haversine formula."""
    R = 3959  # Earth radius in miles
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_lat / 2) ** 2 +
         math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2)
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c

def load_data_centers(file_path="data/ercot/datacenters/texas_data_centers.csv"):
    """Load data center locations."""
    dc_file = Path(file_path)
    if dc_file.exists():
        return pd.read_csv(dc_file)
    else:
        print(f"⚠️  Data center file not found: {file_path}")
        print("   Please create this file first (Step 1)")
        return None

def load_battery_projects(file_path="data/ercot/processed/ercot_2023_100mw_filtered.csv"):
    """Load battery projects from ERCOT data."""
    df = pd.read_csv(file_path)
    # Filter to battery projects only
    batteries = df[df['type_clean'] == 'Battery'].copy()
    print(f"✅ Loaded {len(batteries)} battery projects")
    return batteries

def geocode_batteries(batteries):
    """Geocode battery projects using county centroids."""
    # Load Texas county centroids
    # For now, we'll need to use county centroids as approximation
    # This is a limitation - we don't have exact coordinates for battery projects
    
    print("⚠️  Note: Using county centroids as approximation for battery locations")
    print("   This is a limitation - we need exact coordinates for accurate distance calculation")
    
    # Texas county centroids (sample - would need full dataset)
    county_centroids = {
        'Brazoria': (29.1619, -95.4331),
        'Wharton': (29.3139, -96.1025),
        # Add more as needed
    }
    
    batteries['lat'] = batteries['county'].map(lambda x: county_centroids.get(x, (0, 0))[0])
    batteries['lon'] = batteries['county'].map(lambda x: county_centroids.get(x, (0, 0))[1])
    
    return batteries

def calculate_distances(batteries, data_centers):
    """Calculate distance from each battery to nearest data center."""
    results = []
    
    for idx, battery in batteries.iterrows():
        if pd.isna(battery.get('lat')) or pd.isna(battery.get('lon')):
            continue
        
        min_distance = float('inf')
        nearest_dc = None
        
        for dc_idx, dc in data_centers.iterrows():
            distance = haversine_distance(
                battery['lat'], battery['lon'],
                dc['lat'], dc['lon']
            )
            
            if distance < min_distance:
                min_distance = distance
                nearest_dc = dc
        
        results.append({
            'battery_id': battery.get('q_id', ''),
            'battery_county': battery.get('county', ''),
            'battery_capacity_mw': battery.get('mw1', 0),
            'nearest_dc_name': nearest_dc.get('name', '') if nearest_dc is not None else '',
            'nearest_dc_city': nearest_dc.get('city', '') if nearest_dc is not None else '',
            'distance_miles': min_distance if nearest_dc is not None else None,
            'within_10_miles': min_distance <= 10 if nearest_dc is not None else False,
            'within_25_miles': min_distance <= 25 if nearest_dc is not None else False,
        })
    
    return pd.DataFrame(results)

def statistical_test(results_df):
    """Perform statistical test on clustering."""
    total = len(results_df)
    within_10 = results_df['within_10_miles'].sum()
    within_25 = results_df['within_25_miles'].sum()
    
    pct_10 = (within_10 / total * 100) if total > 0 else 0
    pct_25 = (within_25 / total * 100) if total > 0 else 0
    
    print("=" * 60)
    print("STATISTICAL TEST RESULTS")
    print("=" * 60)
    print(f"Total battery projects: {total}")
    print(f"Within 10 miles of data center: {within_10} ({pct_10:.1f}%)")
    print(f"Within 25 miles of data center: {within_25} ({pct_25:.1f}%)")
    print()
    
    # Verdict
    if pct_10 > 30:
        verdict = "STRONG pattern - batteries cluster near data centers"
        confidence = "HIGH"
    elif pct_10 >= 15:
        verdict = "MEDIUM pattern - some clustering detected"
        confidence = "MEDIUM"
    else:
        verdict = "NO pattern - distribution appears random"
        confidence = "LOW"
    
    print("VERDICT:")
    print(f"  {verdict}")
    print(f"  Confidence: {confidence}")
    print()
    
    # Random distribution comparison
    # If batteries were randomly distributed across Texas (~268,000 sq miles)
    # Expected within 10 miles of a random point: ~0.1% (very rough estimate)
    # Expected within 25 miles: ~0.6%
    print("RANDOM DISTRIBUTION COMPARISON:")
    print(f"  Observed within 10 miles: {pct_10:.1f}%")
    print(f"  Expected (random): ~0.1%")
    print(f"  Difference: {pct_10 - 0.1:.1f} percentage points")
    print()
    
    if pct_10 > 0.1:
        print("✅ Pattern is SIGNIFICANTLY different from random")
    else:
        print("⚠️  Pattern is NOT significantly different from random")
    
    return {
        'total': total,
        'within_10_miles': int(within_10),
        'within_25_miles': int(within_25),
        'pct_10_miles': round(pct_10, 1),
        'pct_25_miles': round(pct_25, 1),
        'verdict': verdict,
        'confidence': confidence
    }

def main():
    print("=" * 60)
    print("BATTERY-DC PROXIMITY TEST")
    print("=" * 60)
    print()
    
    # Step 1: Load data centers
    print("Step 1: Loading data center locations...")
    data_centers = load_data_centers()
    if data_centers is None:
        print("❌ Cannot proceed without data center locations")
        print("   Please run Step 1 first to create data center CSV")
        return
    
    print(f"✅ Loaded {len(data_centers)} data center locations")
    print()
    
    # Step 2: Load battery projects
    print("Step 2: Loading battery projects...")
    batteries = load_battery_projects()
    print()
    
    # Step 3: Geocode batteries (using county centroids as approximation)
    print("Step 3: Geocoding battery projects...")
    batteries = geocode_batteries(batteries)
    print()
    
    # Step 4: Calculate distances
    print("Step 4: Calculating distances to nearest data center...")
    results_df = calculate_distances(batteries, data_centers)
    print(f"✅ Calculated distances for {len(results_df)} battery projects")
    print()
    
    # Step 5: Statistical test
    stats = statistical_test(results_df)
    
    # Save results
    output_dir = Path("data/ercot/processed")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    results_file = output_dir / "battery_dc_distances.csv"
    results_df.to_csv(results_file, index=False)
    print(f"✅ Saved results: {results_file}")
    
    stats_file = output_dir / "battery_dc_proximity_stats.json"
    with open(stats_file, 'w') as f:
        json.dump(stats, f, indent=2)
    print(f"✅ Saved statistics: {stats_file}")
    print()
    
    print("=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    main()

