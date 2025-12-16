#!/usr/bin/env python3
"""
Download Texas county boundaries from U.S. Census TIGER/Line files
and convert to GeoJSON format.
"""

import requests
import zipfile
import json
import geopandas as gpd
from pathlib import Path
import tempfile
import shutil

def download_texas_counties(
    output_file: str = "public/data/texas/texas_counties.geojson",
    year: int = 2023
):
    """
    Download Texas county boundaries from Census TIGER and convert to GeoJSON.
    
    Args:
        output_file: Path to output GeoJSON file
        year: TIGER data year (default: 2023)
    """
    
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("Downloading Texas County Boundaries")
    print("=" * 60)
    print(f"Year: {year}")
    print(f"Output: {output_path}")
    print()
    
    # TIGER/Line download URL
    # Format: https://www2.census.gov/geo/tiger/TIGER{YYYY}/COUNTY/tl_{YYYY}_us_county.zip
    tiger_url = f"https://www2.census.gov/geo/tiger/TIGER{year}/COUNTY/tl_{year}_us_county.zip"
    
    print(f"Downloading from: {tiger_url}")
    
    # Create temporary directory
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        zip_file = temp_path / "counties.zip"
        
        try:
            # Download the zip file
            print("Downloading TIGER/Line shapefile...")
            response = requests.get(tiger_url, stream=True, timeout=30)
            response.raise_for_status()
            
            # Save to temp file
            with open(zip_file, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            print(f"✅ Downloaded {zip_file.stat().st_size / 1024 / 1024:.2f} MB")
            print()
            
            # Extract zip file
            print("Extracting shapefile...")
            with zipfile.ZipFile(zip_file, 'r') as zip_ref:
                zip_ref.extractall(temp_path)
            
            # Find the .shp file
            shp_files = list(temp_path.glob("*.shp"))
            if not shp_files:
                raise FileNotFoundError("No .shp file found in zip archive")
            
            shp_file = shp_files[0]
            print(f"Found shapefile: {shp_file.name}")
            print()
            
            # Read shapefile with geopandas
            print("Reading shapefile...")
            gdf = gpd.read_file(shp_file)
            
            print(f"Total counties in dataset: {len(gdf):,}")
            print(f"Columns: {list(gdf.columns)}")
            print()
            
            # Filter for Texas (STATEFP == '48')
            print("Filtering for Texas (STATEFP == '48')...")
            texas_gdf = gdf[gdf['STATEFP'] == '48'].copy()
            
            print(f"Texas counties found: {len(texas_gdf):,}")
            print()
            
            # Verify we have the expected number (Texas has 254 counties)
            if len(texas_gdf) != 254:
                print(f"⚠️  Warning: Expected 254 Texas counties, found {len(texas_gdf)}")
            else:
                print("✅ All 254 Texas counties found!")
            print()
            
            # Ensure CRS is WGS84 (EPSG:4326)
            if texas_gdf.crs != 'EPSG:4326':
                print(f"Converting CRS from {texas_gdf.crs} to EPSG:4326...")
                texas_gdf = texas_gdf.to_crs('EPSG:4326')
            
            # Select and rename important columns
            columns_to_keep = [
                'GEOID',      # Geographic identifier
                'NAME',       # County name
                'STATEFP',    # State FIPS code
                'COUNTYFP',   # County FIPS code
                'geometry'    # Geometry column
            ]
            
            # Keep only columns that exist
            available_columns = [col for col in columns_to_keep if col in texas_gdf.columns]
            texas_gdf = texas_gdf[available_columns]
            
            # Save to GeoJSON
            print(f"Saving to GeoJSON: {output_path}")
            texas_gdf.to_file(output_path, driver='GeoJSON')
            
            file_size = output_path.stat().st_size
            print(f"✅ GeoJSON saved: {file_size / 1024 / 1024:.2f} MB")
            print()
            
            # Print sample county names
            print("Sample counties:")
            for name in sorted(texas_gdf['NAME'].head(10)):
                print(f"  - {name}")
            print()
            
            print("=" * 60)
            print("✅ Download and conversion complete!")
            print("=" * 60)
            
            return str(output_path)
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Error downloading file: {e}")
            print()
            print("Trying alternative: Direct state-level download...")
            return download_texas_counties_alternative(output_path, year)
        
        except Exception as e:
            print(f"❌ Error: {e}")
            raise


def download_texas_counties_alternative(
    output_path: Path,
    year: int
):
    """
    Alternative method: Try downloading Texas-specific file if available.
    """
    # Some years have state-specific files
    # Format: tl_{YYYY}_{STATEFP}_county.zip
    alt_url = f"https://www2.census.gov/geo/tiger/TIGER{year}/COUNTY/tl_{year}_48_county.zip"
    
    print(f"Trying alternative URL: {alt_url}")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        zip_file = temp_path / "counties.zip"
        
        try:
            response = requests.get(alt_url, stream=True, timeout=30)
            response.raise_for_status()
            
            with open(zip_file, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            print(f"✅ Downloaded {zip_file.stat().st_size / 1024 / 1024:.2f} MB")
            
            with zipfile.ZipFile(zip_file, 'r') as zip_ref:
                zip_ref.extractall(temp_path)
            
            shp_files = list(temp_path.glob("*.shp"))
            if not shp_files:
                raise FileNotFoundError("No .shp file found")
            
            shp_file = shp_files[0]
            gdf = gpd.read_file(shp_file)
            
            if gdf.crs != 'EPSG:4326':
                gdf = gdf.to_crs('EPSG:4326')
            
            gdf.to_file(output_path, driver='GeoJSON')
            
            print(f"✅ Saved {len(gdf)} counties to {output_path}")
            return str(output_path)
            
        except Exception as e:
            print(f"❌ Alternative method also failed: {e}")
            raise


if __name__ == "__main__":
    import sys
    
    output_file = sys.argv[1] if len(sys.argv) > 1 else "public/data/texas/texas_counties.geojson"
    year = int(sys.argv[2]) if len(sys.argv) > 2 else 2023
    
    try:
        result = download_texas_counties(output_file, year)
        print(f"\n✅ Success! File saved to: {result}")
    except Exception as e:
        print(f"\n❌ Failed: {e}")
        sys.exit(1)

