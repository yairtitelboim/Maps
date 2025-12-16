#!/usr/bin/env python3
"""
Create GeoJSON from geocoded ERCOT GIS Report data
Adds jitter to spread out points that share the same county centroid
"""

import pandas as pd
import json
import random
from pathlib import Path
from datetime import datetime
from collections import defaultdict

def create_geojson(
    input_file: str = "data/ercot/gis_reports/geocoded/ercot_gis_reports_geocoded_latest.csv",
    output_file: str = "public/data/ercot/ercot_gis_reports.geojson"
):
    """Create GeoJSON from geocoded CSV data."""
    
    input_path = Path(input_file)
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("ERCOT GIS Report GeoJSON Creation")
    print("=" * 60)
    print(f"Input file: {input_path}")
    print(f"Output file: {output_path}")
    print()
    
    # Load geocoded data
    print("Loading geocoded data...")
    df = pd.read_csv(input_path, low_memory=False)
    
    # Filter to geocoded records only
    df_geocoded = df[df['geocoded'] == True].copy()
    
    print(f"Total records: {len(df):,}")
    print(f"Geocoded records: {len(df_geocoded):,}")
    print()
    
    # Create GeoJSON features with jitter to spread out overlapping points
    print("Creating GeoJSON features with jitter...")
    features = []
    
    # Track coordinates and add jitter for duplicates
    # Jitter scale: ~0.01 degrees ≈ 1km spread
    JITTER_SCALE = 0.01
    coordinate_counts = defaultdict(int)
    
    for idx, row in df_geocoded.iterrows():
        if pd.isna(row['lat']) or pd.isna(row['lng']):
            continue
        
        base_lng = float(row['lng'])
        base_lat = float(row['lat'])
        
        # Create a key for this coordinate
        coord_key = (round(base_lng, 6), round(base_lat, 6))
        coordinate_counts[coord_key] += 1
        count = coordinate_counts[coord_key]
        
        # Add jitter if this coordinate has been used before
        # Spread points in a random circular pattern around the base point
        if count > 1:
            # Random angle and distance for this duplicate
            angle = random.uniform(0, 2 * 3.14159)
            # Distance increases with count, but capped at JITTER_SCALE
            max_distance = min(count * 0.002, JITTER_SCALE)
            distance = random.uniform(0, max_distance)
            
            # Convert to lat/lng offsets (1 degree ≈ 111 km)
            # Account for latitude compression
            lat_offset = distance / 111.0
            lng_offset = distance / (111.0 * abs(3.14159 / 180 * base_lat))
            
            # Apply offsets based on angle
            final_lng = base_lng + lng_offset * (3.14159 / 2 - abs(angle - 3.14159 / 2)) / (3.14159 / 2) * (1 if angle < 3.14159 else -1)
            final_lat = base_lat + lat_offset * abs(3.14159 / 2 - abs(angle - 3.14159 / 2)) / (3.14159 / 2) * (1 if 0 < angle < 3.14159 else -1)
        else:
            # First point at this location - add tiny random offset to prevent exact stacking
            final_lng = base_lng + random.uniform(-0.0005, 0.0005)
            final_lat = base_lat + random.uniform(-0.0005, 0.0005)
        
        # Create feature properties (exclude lat/lng as they're in geometry)
        properties = {}
        for col in df_geocoded.columns:
            if col not in ['lat', 'lng', 'geocoded']:
                value = row[col]
                # Convert pandas types to native Python types
                if pd.isna(value):
                    properties[col] = None
                elif isinstance(value, (pd.Timestamp, datetime)):
                    properties[col] = value.isoformat()
                elif isinstance(value, (pd.Int64Dtype, pd.Float64Dtype)):
                    properties[col] = float(value) if pd.notna(value) else None
                else:
                    properties[col] = value
        
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [final_lng, final_lat]
            },
            "properties": properties
        }
        
        features.append(feature)
    
    # Report on jittering
    duplicate_locations = sum(1 for count in coordinate_counts.values() if count > 1)
    max_duplicates = max(coordinate_counts.values()) if coordinate_counts else 0
    print(f"   Locations with multiple projects: {duplicate_locations}")
    print(f"   Max projects at single location: {max_duplicates}")
    
    # Create GeoJSON structure
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    # Save GeoJSON
    print("Saving GeoJSON...")
    with open(output_path, 'w') as f:
        json.dump(geojson, f, indent=2, default=str, ensure_ascii=False)
    
    file_size = output_path.stat().st_size
    print(f"✅ GeoJSON saved: {output_path}")
    print(f"   Size: {file_size / 1024 / 1024:.2f} MB")
    print(f"   Features: {len(features):,}")
    print()
    
    # Summary statistics
    print("=" * 60)
    print("Summary Statistics")
    print("=" * 60)
    
    if len(df_geocoded) > 0:
        print(f"Unique projects (INR): {df_geocoded['INR'].nunique():,}")
        print(f"Counties: {df_geocoded['County'].nunique()}")
        print(f"Fuel types: {df_geocoded['Fuel'].nunique()}")
        print()
        print("Top 5 counties:")
        for county, count in df_geocoded['County'].value_counts().head(5).items():
            print(f"  {county}: {count:,} projects")
        print()
        print("Fuel type distribution:")
        for fuel, count in df_geocoded['Fuel'].value_counts().head(5).items():
            print(f"  {fuel}: {count:,} projects")
    
    print()
    print("=" * 60)
    print("✅ GeoJSON creation complete!")
    print("=" * 60)
    
    return geojson

if __name__ == "__main__":
    create_geojson()

