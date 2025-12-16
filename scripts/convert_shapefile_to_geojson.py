#!/usr/bin/env python3
"""
Convert OKC census tract shapefile to GeoJSON format.
Input: public/tl_2021_40_tract/tl_2021_40_tract.shp
Output: public/okc_census_tracts.geojson
"""

import geopandas as gpd
import json
import os
from pathlib import Path

def convert_shapefile_to_geojson():
    # Get the script directory and project root
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    # Define input and output paths
    input_shapefile = project_root / 'public' / 'tl_2021_40_tract' / 'tl_2021_40_tract.shp'
    output_geojson = project_root / 'public' / 'okc_census_tracts.geojson'
    
    print(f"Reading shapefile from: {input_shapefile}")
    
    if not input_shapefile.exists():
        raise FileNotFoundError(f"Shapefile not found at: {input_shapefile}")
    
    # Read the shapefile
    gdf = gpd.read_file(input_shapefile)
    
    # Ensure WGS84 coordinate system (EPSG:4326)
    if gdf.crs != 'EPSG:4326':
        print(f"Converting from {gdf.crs} to EPSG:4326...")
        gdf = gdf.to_crs('EPSG:4326')
    
    # Print info about the data
    print(f"Loaded {len(gdf)} census tracts")
    print(f"Columns: {list(gdf.columns)}")
    print(f"CRS: {gdf.crs}")
    
    # Check for GEOID column (standard census tract identifier)
    if 'GEOID' not in gdf.columns:
        print("Warning: GEOID column not found. Available columns:", list(gdf.columns))
        # Try to find alternative ID columns
        if 'GEOID20' in gdf.columns:
            gdf = gdf.rename(columns={'GEOID20': 'GEOID'})
        elif 'TRACTCE' in gdf.columns and 'COUNTYFP' in gdf.columns:
            gdf['GEOID'] = gdf['COUNTYFP'].astype(str) + gdf['TRACTCE'].astype(str)
    
    # Save to GeoJSON
    print(f"Writing GeoJSON to: {output_geojson}")
    gdf.to_file(output_geojson, driver='GeoJSON')
    
    # Verify the output
    file_size = os.path.getsize(output_geojson) / (1024 * 1024)  # Size in MB
    print(f"✓ Conversion complete!")
    print(f"  Output file: {output_geojson}")
    print(f"  File size: {file_size:.2f} MB")
    print(f"  Features: {len(gdf)}")
    
    # Print sample of GEOID values
    if 'GEOID' in gdf.columns:
        print(f"  Sample GEOIDs: {gdf['GEOID'].head(5).tolist()}")

if __name__ == '__main__':
    try:
        convert_shapefile_to_geojson()
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

