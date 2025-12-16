#!/usr/bin/env python3
"""
Geocode ERCOT GIS Report data using Texas county centroids
"""

import pandas as pd
import json
from pathlib import Path
from datetime import datetime
import sys
import os

# Add script directory to path for imports
script_dir = Path(__file__).parent
sys.path.insert(0, str(script_dir))

from texas_county_centroids import get_county_centroid

def geocode_gis_reports(
    input_file: str = None,
    output_dir: str = "data/ercot/gis_reports/geocoded"
):
    """Geocode ERCOT GIS reports using county centroids."""
    
    # Find input file if not specified
    if input_file is None:
        # Try to find latest consolidated file
        consolidated_dir = Path("data/ercot/gis_reports/consolidated")
        json_files = list(consolidated_dir.glob("ercot_gis_reports_consolidated_*.json"))
        csv_files = list(consolidated_dir.glob("ercot_gis_reports_consolidated_*.csv"))
        
        if json_files:
            input_file = str(max(json_files, key=lambda p: p.stat().st_mtime))
        elif csv_files:
            input_file = str(max(csv_files, key=lambda p: p.stat().st_mtime))
        else:
            print("❌ No consolidated files found!")
            return None
    
    input_path = Path(input_file)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    if not input_path.exists():
        print(f"❌ Input file not found: {input_path}")
        return None
    
    print("=" * 60)
    print("ERCOT GIS Report Geocoding")
    print("=" * 60)
    print(f"Input file: {input_path}")
    print(f"Output directory: {output_path}")
    print()
    
    # Load consolidated data
    print("Loading consolidated data...")
    if str(input_file).endswith('.json'):
        with open(input_path, 'r') as f:
            data = json.load(f)
        df = pd.DataFrame(data)
    else:
        df = pd.read_csv(input_path, low_memory=False)
    
    print(f"Loaded {len(df):,} records")
    print()
    
    # Geocode by county
    print("Geocoding by county...")
    print("-" * 60)
    
    geocoded_count = 0
    failed_count = 0
    
    def geocode_row(row):
        nonlocal geocoded_count, failed_count
        
        county = row.get('County') if isinstance(row, dict) else row['County']
        lat, lng = get_county_centroid(county)
        
        if lat is not None and lng is not None:
            geocoded_count += 1
            return pd.Series({'lat': lat, 'lng': lng, 'geocoded': True, 'geocode_method': 'county_centroid'})
        else:
            failed_count += 1
            return pd.Series({'lat': None, 'lng': None, 'geocoded': False, 'geocode_method': None})
    
    # Apply geocoding
    geocode_results = df.apply(geocode_row, axis=1)
    
    # Merge results back into dataframe
    df['lat'] = geocode_results['lat']
    df['lng'] = geocode_results['lng']
    df['geocoded'] = geocode_results['geocoded']
    df['geocode_method'] = geocode_results['geocode_method']
    
    print(f"✅ Geocoded: {geocoded_count:,} records")
    print(f"❌ Failed: {failed_count:,} records")
    print(f"Success rate: {(geocoded_count / len(df) * 100):.1f}%")
    print()
    
    # Show failed counties
    if failed_count > 0:
        failed_df = df[df['geocoded'] == False]
        failed_counties = failed_df['County'].value_counts()
        print("Failed counties (top 10):")
        for county, count in failed_counties.head(10).items():
            print(f"  {county}: {count}")
        print()
    
    # Filter to geocoded records only
    df_geocoded = df[df['geocoded'] == True].copy()
    
    print(f"Geocoded records: {len(df_geocoded):,}")
    print()
    
    # Save geocoded data
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    print("=" * 60)
    print("Saving geocoded data...")
    print("=" * 60)
    
    # Save CSV
    csv_file = output_path / f"ercot_gis_reports_geocoded_{timestamp}.csv"
    df_geocoded.to_csv(csv_file, index=False)
    print(f"✅ CSV saved: {csv_file}")
    print(f"   Size: {csv_file.stat().st_size / 1024 / 1024:.2f} MB")
    
    # Save JSON
    json_file = output_path / f"ercot_gis_reports_geocoded_{timestamp}.json"
    records = df_geocoded.to_dict('records')
    with open(json_file, 'w') as f:
        json.dump(records, f, indent=2, default=str, ensure_ascii=False)
    print(f"✅ JSON saved: {json_file}")
    print(f"   Size: {json_file.stat().st_size / 1024 / 1024:.2f} MB")
    
    # Save latest versions
    latest_csv = output_path / "ercot_gis_reports_geocoded_latest.csv"
    df_geocoded.to_csv(latest_csv, index=False)
    print(f"✅ Latest CSV: {latest_csv}")
    
    latest_json = output_path / "ercot_gis_reports_geocoded_latest.json"
    with open(latest_json, 'w') as f:
        json.dump(records, f, indent=2, default=str, ensure_ascii=False)
    print(f"✅ Latest JSON: {latest_json}")
    
    print()
    
    # Generate summary
    summary = {
        'geocoding_date': datetime.now().isoformat(),
        'total_records': len(df),
        'geocoded_records': len(df_geocoded),
        'failed_records': failed_count,
        'success_rate_pct': float((geocoded_count / len(df)) * 100),
        'counties_geocoded': int(df_geocoded['County'].nunique()),
        'counties_failed': int(failed_df['County'].nunique()) if failed_count > 0 else 0
    }
    
    summary_file = output_path / f"geocoding_summary_{timestamp}.json"
    with open(summary_file, 'w') as f:
        json.dump(summary, f, indent=2, default=str)
    print(f"✅ Summary saved: {summary_file}")
    
    print()
    print("=" * 60)
    print("✅ Geocoding complete!")
    print("=" * 60)
    
    return summary

if __name__ == "__main__":
    import sys
    
    input_file = None
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    
    print("=" * 60)
    print("ERCOT GIS Report Geocoding")
    print("=" * 60)
    print("\nThis script will:")
    print("1. Load consolidated ERCOT GIS data")
    print("2. Geocode locations using Texas county centroids")
    print("3. Save geocoded CSV and JSON files")
    print("\n" + "=" * 60 + "\n")
    
    summary = geocode_gis_reports(input_file=input_file)
    
    if summary:
        print(f"\n✅ Successfully geocoded {summary['geocoded_records']:,} records")
        print(f"   Success rate: {summary['success_rate_pct']:.1f}%")
    else:
        print("\n❌ Geocoding failed")

