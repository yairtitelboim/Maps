#!/usr/bin/env python3
"""
Test correlation between battery capacity and data center announcements by county
"""
import json
from pathlib import Path
from collections import defaultdict

def get_battery_dc_correlation():
    """Analyze correlation between battery capacity and DC count by county."""
    base_path = Path(__file__).parent.parent.parent
    
    # Load DC data
    dc_path = base_path / 'data/analysis/story1_dc_by_county.json'
    with open(dc_path, 'r') as f:
        dc_data = json.load(f)
        dc_by_county = dc_data.get('county_counts', {})
    
    # Load ERCOT data
    ercot_path = base_path / 'public/data/ercot/ercot_counties_aggregated.geojson'
    with open(ercot_path, 'r') as f:
        ercot_data = json.load(f)
    
    # Extract battery capacity by county
    battery_by_county = {}
    for feature in ercot_data.get('features', []):
        props = feature.get('properties', {})
        county = props.get('NAME', '')
        battery_capacity = props.get('fuel_battery_capacity', 0) or 0
        battery_count = props.get('fuel_battery_count', 0) or 0
        
        if county:
            battery_by_county[county] = {
                'capacity_mw': battery_capacity,
                'project_count': battery_count
            }
    
    # Combine data
    combined = []
    for county, dc_count in dc_by_county.items():
        battery_info = battery_by_county.get(county, {'capacity_mw': 0, 'project_count': 0})
        combined.append({
            'county': county,
            'dc_count': dc_count,
            'battery_capacity_mw': battery_info['capacity_mw'],
            'battery_project_count': battery_info['project_count']
        })
    
    # Sort by DC count
    combined.sort(key=lambda x: x['dc_count'], reverse=True)
    
    print("=" * 80)
    print("BATTERY CAPACITY vs DATA CENTER CORRELATION")
    print("=" * 80)
    print(f"\n📊 Counties with Data Centers:")
    print(f"   {'County':<20} {'DCs':<8} {'Battery MW':<15} {'Battery Projects':<18}")
    print(f"   {'-'*20} {'-'*8} {'-'*15} {'-'*18}")
    
    total_dc = 0
    total_battery = 0
    counties_with_both = 0
    
    for entry in combined[:20]:  # Top 20
        dc_count = entry['dc_count']
        battery_mw = entry['battery_capacity_mw']
        battery_projects = entry['battery_project_count']
        
        total_dc += dc_count
        total_battery += battery_mw
        if battery_mw > 0:
            counties_with_both += 1
        
        print(f"   {entry['county']:<20} {dc_count:<8} {battery_mw:>12,.0f} MW {battery_projects:>15}")
    
    # Correlation analysis
    print(f"\n🔍 Correlation Analysis:")
    print(f"   Counties with DCs: {len(combined)}")
    print(f"   Counties with both DCs and batteries: {counties_with_both}")
    print(f"   Counties with DCs but no batteries: {len(combined) - counties_with_both}")
    
    # Calculate correlation coefficient (simple Pearson)
    dc_values = [x['dc_count'] for x in combined]
    battery_values = [x['battery_capacity_mw'] for x in combined]
    
    if len(dc_values) > 1:
        import statistics
        mean_dc = statistics.mean(dc_values)
        mean_battery = statistics.mean(battery_values)
        
        numerator = sum((dc_values[i] - mean_dc) * (battery_values[i] - mean_battery) 
                       for i in range(len(dc_values)))
        denom_dc = sum((x - mean_dc) ** 2 for x in dc_values)
        denom_battery = sum((x - mean_battery) ** 2 for x in battery_values)
        
        if denom_dc > 0 and denom_battery > 0:
            correlation = numerator / ((denom_dc * denom_battery) ** 0.5)
            print(f"   Correlation coefficient: {correlation:.3f}")
            
            if abs(correlation) < 0.1:
                interpretation = "No correlation"
            elif abs(correlation) < 0.3:
                interpretation = "Weak correlation"
            elif abs(correlation) < 0.7:
                interpretation = "Moderate correlation"
            else:
                interpretation = "Strong correlation"
            
            direction = "positive" if correlation > 0 else "negative"
            print(f"   Interpretation: {interpretation} ({direction})")
    
    # Top battery counties without DCs
    print(f"\n📊 Top Battery Counties WITHOUT Data Centers:")
    battery_only = [
        {
            'county': county,
            'battery_capacity_mw': info['capacity_mw'],
            'battery_project_count': info['project_count'],
            'dc_count': dc_by_county.get(county, 0)
        }
        for county, info in battery_by_county.items()
        if info['capacity_mw'] > 0 and dc_by_county.get(county, 0) == 0
    ]
    battery_only.sort(key=lambda x: x['battery_capacity_mw'], reverse=True)
    
    for entry in battery_only[:10]:
        print(f"   {entry['county']:<20} {entry['battery_capacity_mw']:>12,.0f} MW ({entry['battery_project_count']} projects)")
    
    result = {
        'combined_data': combined,
        'correlation_analysis': {
            'counties_with_dcs': len(combined),
            'counties_with_both': counties_with_both,
            'counties_dc_only': len(combined) - counties_with_both,
            'correlation_coefficient': correlation if 'correlation' in locals() else None
        },
        'battery_only_counties': battery_only[:20]
    }
    
    return result

if __name__ == '__main__':
    result = get_battery_dc_correlation()
    
    # Save to file
    output_path = Path(__file__).parent.parent.parent / 'data/analysis/story1_battery_correlation.json'
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(result, f, indent=2)
    
    print(f"\n✅ Saved to {output_path}")

