#!/usr/bin/env python3
"""
Extract ERCOT energy capacity by county from ercot_counties_aggregated.geojson
"""
import json
from pathlib import Path

def get_ercot_by_county():
    """Get ERCOT energy data by county (using FIXED operational-only data)."""
    # Try fixed data first, fallback to original
    base_path = Path(__file__).parent.parent.parent
    geojson_path = base_path / 'public/data/ercot/ercot_counties_aggregated_fixed.geojson'
    if not geojson_path.exists():
        geojson_path = base_path / 'public/data/ercot/ercot_counties_aggregated.geojson'
        print("⚠️  Using original data (fixed data not found)")
    
    with open(geojson_path, 'r') as f:
        data = json.load(f)
    
    counties = {}
    
    for feature in data.get('features', []):
        props = feature.get('properties', {})
        county_name = props.get('NAME', '')
        
        if not county_name:
            continue
        
        counties[county_name] = {
            'project_count': props.get('project_count', 0),
            'total_capacity_mw': props.get('total_capacity_mw', 0),
            'avg_capacity_mw': props.get('avg_capacity_mw', 0),
            'has_projects': props.get('has_projects', False),
            'fuel_solar_count': props.get('fuel_solar_count', 0),
            'fuel_wind_count': props.get('fuel_wind_count', 0),
            'fuel_battery_count': props.get('fuel_battery_count', 0),
            'fuel_solar_capacity': props.get('fuel_solar_capacity', 0),
            'fuel_wind_capacity': props.get('fuel_wind_capacity', 0),
            'fuel_battery_capacity': props.get('fuel_battery_capacity', 0),
            'dominant_fuel_type': props.get('dominant_fuel_type', 'N/A')
        }
    
    # Sort by total_capacity_mw (descending)
    sorted_counties = sorted(
        counties.items(),
        key=lambda x: x[1]['total_capacity_mw'],
        reverse=True
    )
    
    print(f"📊 ERCOT Energy by County:")
    print(f"   Total counties: {len(counties)}")
    print(f"   Counties with projects: {sum(1 for c in counties.values() if c['has_projects'])}")
    print(f"\n   Top 10 Counties by Capacity:")
    for i, (county, data) in enumerate(sorted_counties[:10], 1):
        print(f"   {i}. {county}: {data['total_capacity_mw']:,.0f} MW ({data['project_count']} projects)")
        print(f"      Dominant: {data['dominant_fuel_type']} | "
              f"Solar: {data['fuel_solar_capacity']:,.0f} MW | "
              f"Wind: {data['fuel_wind_capacity']:,.0f} MW | "
              f"Battery: {data['fuel_battery_capacity']:,.0f} MW")
    
    return dict(counties)

if __name__ == '__main__':
    ercot_by_county = get_ercot_by_county()
    
    # Save to file
    output_path = Path(__file__).parent.parent.parent / 'data/analysis/story1_ercot_by_county.json'
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(ercot_by_county, f, indent=2)
    
    print(f"\n✅ Saved to {output_path}")

