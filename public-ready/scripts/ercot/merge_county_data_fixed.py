#!/usr/bin/env python3
"""
Merge fixed county aggregations with Texas county boundaries.
Uses the corrected aggregations (deduplicated, operational only).
"""
import json
from pathlib import Path

def merge_county_data_fixed(
    boundaries_file: str = "public/data/texas/texas_counties.geojson",
    aggregations_file: str = "data/ercot/county_aggregations_fixed.json",
    output_file: str = "public/data/ercot/ercot_counties_aggregated_fixed.geojson"
):
    """
    Merge fixed county aggregations with Texas county boundaries.
    
    Args:
        boundaries_file: Path to Texas county boundaries GeoJSON
        aggregations_file: Path to fixed county aggregations JSON
        output_file: Path to output merged GeoJSON
    """
    
    boundaries_path = Path(boundaries_file)
    aggregations_path = Path(aggregations_file)
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    print("=" * 80)
    print("Merging Fixed County Aggregations with Boundaries")
    print("=" * 80)
    print(f"Boundaries: {boundaries_path}")
    print(f"Aggregations: {aggregations_path}")
    print(f"Output: {output_path}")
    print()
    
    # Load boundaries
    print("Loading county boundaries...")
    with open(boundaries_path, 'r') as f:
        boundaries_data = json.load(f)
    
    print(f"  Loaded {len(boundaries_data.get('features', []))} counties")
    
    # Load aggregations
    print("Loading fixed aggregations...")
    with open(aggregations_path, 'r') as f:
        aggregations = json.load(f)
    
    print(f"  Loaded {len(aggregations)} county aggregations")
    print()
    
    # Merge data
    print("Merging data...")
    matched = 0
    unmatched = []
    
    for feature in boundaries_data.get('features', []):
        props = feature.get('properties', {})
        county_name = props.get('NAME', '').strip()
        
        if not county_name:
            continue
        
        # Try to match aggregation
        matched_data = None
        
        # Try exact match
        if county_name in aggregations:
            matched_data = aggregations[county_name]
        else:
            # Try with "County" suffix
            county_with_suffix = f"{county_name} County"
            if county_with_suffix in aggregations:
                matched_data = aggregations[county_with_suffix]
        
        if matched_data:
            matched += 1
            
            # Add aggregated data to properties
            props['project_count'] = matched_data['project_count']
            props['total_capacity_mw'] = matched_data['total_capacity_mw']
            props['avg_capacity_mw'] = matched_data['avg_capacity_mw']
            props['has_projects'] = True
            
            # Add fuel breakdown
            fuel_breakdown = matched_data.get('fuel_breakdown', {})
            
            props['fuel_solar_count'] = fuel_breakdown.get('SOL', {}).get('count', 0)
            props['fuel_wind_count'] = fuel_breakdown.get('WIN', {}).get('count', 0)
            props['fuel_gas_count'] = fuel_breakdown.get('GAS', {}).get('count', 0)
            props['fuel_battery_count'] = fuel_breakdown.get('BAT', {}).get('count', 0)
            props['fuel_storage_count'] = fuel_breakdown.get('STR', {}).get('count', 0)
            props['fuel_nuclear_count'] = fuel_breakdown.get('NUC', {}).get('count', 0)
            
            props['fuel_solar_capacity'] = fuel_breakdown.get('SOL', {}).get('capacity', 0)
            props['fuel_wind_capacity'] = fuel_breakdown.get('WIN', {}).get('capacity', 0)
            props['fuel_gas_capacity'] = fuel_breakdown.get('GAS', {}).get('capacity', 0)
            props['fuel_battery_capacity'] = fuel_breakdown.get('BAT', {}).get('capacity', 0)
            props['fuel_storage_capacity'] = fuel_breakdown.get('STR', {}).get('capacity', 0)
            props['fuel_nuclear_capacity'] = fuel_breakdown.get('NUC', {}).get('capacity', 0)
            
            props['fuel_other_count'] = sum(
                v.get('count', 0) for k, v in fuel_breakdown.items() 
                if k not in ['SOL', 'WIN', 'GAS', 'BAT', 'STR', 'NUC']
            )
            props['fuel_other_capacity'] = sum(
                v.get('capacity', 0) for k, v in fuel_breakdown.items() 
                if k not in ['SOL', 'WIN', 'GAS', 'BAT', 'STR', 'NUC']
            )
            
            # Calculate percentages
            total_cap = props['total_capacity_mw']
            if total_cap > 0:
                props['renewable_capacity'] = props['fuel_solar_capacity'] + props['fuel_wind_capacity']
                props['storage_capacity'] = props['fuel_battery_capacity'] + props['fuel_storage_capacity']
                props['baseload_capacity'] = props['fuel_gas_capacity'] + props['fuel_nuclear_capacity']
                
                props['renewable_pct'] = round((props['renewable_capacity'] / total_cap) * 100, 2)
                props['storage_pct'] = round((props['storage_capacity'] / total_cap) * 100, 2)
                props['baseload_pct'] = round((props['baseload_capacity'] / total_cap) * 100, 2)
            else:
                props['renewable_capacity'] = 0
                props['storage_capacity'] = 0
                props['baseload_capacity'] = 0
                props['renewable_pct'] = 0
                props['storage_pct'] = 0
                props['baseload_pct'] = 0
            
            # Dominant fuel type
            if fuel_breakdown:
                dominant_fuel = max(fuel_breakdown.items(), key=lambda x: x[1]['capacity'])[0]
                props['dominant_fuel_type'] = dominant_fuel
            else:
                props['dominant_fuel_type'] = 'N/A'
        else:
            # No projects in this county
            props['project_count'] = 0
            props['total_capacity_mw'] = 0
            props['avg_capacity_mw'] = 0
            props['has_projects'] = False
            props['fuel_solar_count'] = 0
            props['fuel_wind_count'] = 0
            props['fuel_gas_count'] = 0
            props['fuel_battery_count'] = 0
            props['fuel_storage_count'] = 0
            props['fuel_nuclear_count'] = 0
            props['fuel_solar_capacity'] = 0
            props['fuel_wind_capacity'] = 0
            props['fuel_gas_capacity'] = 0
            props['fuel_battery_capacity'] = 0
            props['fuel_storage_capacity'] = 0
            props['fuel_nuclear_capacity'] = 0
            props['fuel_other_count'] = 0
            props['fuel_other_capacity'] = 0
            props['renewable_capacity'] = 0
            props['storage_capacity'] = 0
            props['baseload_capacity'] = 0
            props['renewable_pct'] = 0
            props['storage_pct'] = 0
            props['baseload_pct'] = 0
            props['dominant_fuel_type'] = 'N/A'
    
    print(f"✅ Matched {matched} counties with aggregations")
    if unmatched:
        print(f"⚠️  {len(unmatched)} counties in aggregations not found in boundaries")
    
    # Save merged data
    print(f"\nSaving merged data to {output_path}...")
    with open(output_path, 'w') as f:
        json.dump(boundaries_data, f, indent=2)
    
    file_size = output_path.stat().st_size / (1024 * 1024)
    print(f"✅ Merged data saved: {file_size:.2f} MB")
    print()
    
    print("=" * 80)
    print("✅ Merge complete!")
    print("=" * 80)
    
    return boundaries_data


if __name__ == "__main__":
    import sys
    
    boundaries_file = sys.argv[1] if len(sys.argv) > 1 else "public/data/texas/texas_counties.geojson"
    aggregations_file = sys.argv[2] if len(sys.argv) > 2 else "data/ercot/county_aggregations_fixed.json"
    output_file = sys.argv[3] if len(sys.argv) > 3 else "public/data/ercot/ercot_counties_aggregated_fixed.geojson"
    
    try:
        merged_data = merge_county_data_fixed(boundaries_file, aggregations_file, output_file)
        print(f"\n✅ Success! Merged {len(merged_data.get('features', []))} counties")
    except Exception as e:
        print(f"\n❌ Failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

