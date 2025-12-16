#!/usr/bin/env python3
"""
Analyze fuel mix (gas vs solar/wind) correlation with data centers
Tests hypothesis: Do counties with data centers have gas capacity?
"""
import json
from pathlib import Path
from collections import defaultdict
import statistics

try:
    from shapely.geometry import Point, shape
    HAVE_SHAPELY = True
except ImportError:
    HAVE_SHAPELY = False
    print("⚠️  shapely not installed")

def get_fuel_mix(county_name, ercot_data):
    """Get fuel mix for a county."""
    county_data = ercot_data.get(county_name, {})
    
    total_mw = county_data.get('total_capacity_mw', 0) or 0
    
    gas_mw = county_data.get('fuel_gas_capacity', 0) or 0
    solar_mw = county_data.get('fuel_solar_capacity', 0) or 0
    wind_mw = county_data.get('fuel_wind_capacity', 0) or 0
    battery_mw = county_data.get('fuel_battery_capacity', 0) or 0
    storage_mw = county_data.get('fuel_storage_capacity', 0) or 0
    nuclear_mw = county_data.get('fuel_nuclear_capacity', 0) or 0
    other_mw = county_data.get('fuel_other_capacity', 0) or 0
    
    # Calculate percentages
    gas_pct = (gas_mw / total_mw * 100) if total_mw > 0 else 0
    solar_pct = (solar_mw / total_mw * 100) if total_mw > 0 else 0
    wind_pct = (wind_mw / total_mw * 100) if total_mw > 0 else 0
    renewable_pct = ((solar_mw + wind_mw) / total_mw * 100) if total_mw > 0 else 0
    baseload_pct = ((gas_mw + nuclear_mw) / total_mw * 100) if total_mw > 0 else 0
    
    return {
        'total_mw': total_mw,
        'gas_mw': gas_mw,
        'solar_mw': solar_mw,
        'wind_mw': wind_mw,
        'battery_mw': battery_mw,
        'storage_mw': storage_mw,
        'nuclear_mw': nuclear_mw,
        'other_mw': other_mw,
        'gas_pct': gas_pct,
        'solar_pct': solar_pct,
        'wind_pct': wind_pct,
        'renewable_pct': renewable_pct,
        'baseload_pct': baseload_pct,
        'project_count': county_data.get('project_count', 0) or 0
    }

def get_dc_count(county_name, dc_data):
    """Get data center count for a county."""
    return dc_data.get(county_name, 0)

def correlate(x_values, y_values):
    """Calculate Pearson correlation coefficient."""
    if len(x_values) != len(y_values) or len(x_values) < 2:
        return None
    
    n = len(x_values)
    x_mean = statistics.mean(x_values)
    y_mean = statistics.mean(y_values)
    
    numerator = sum((x_values[i] - x_mean) * (y_values[i] - y_mean) for i in range(n))
    x_variance = sum((x - x_mean) ** 2 for x in x_values)
    y_variance = sum((y - y_mean) ** 2 for y in y_values)
    
    denominator = (x_variance * y_variance) ** 0.5
    
    if denominator == 0:
        return None
    
    return numerator / denominator

def main():
    base_path = Path(__file__).parent.parent.parent
    
    print('🔍 FUEL MIX vs DATA CENTER CORRELATION ANALYSIS')
    print('=' * 80)
    print()
    
    # Load ERCOT data
    ercot_path = base_path / 'public/data/ercot/ercot_counties_aggregated_fixed.geojson'
    if not ercot_path.exists():
        ercot_path = base_path / 'public/data/ercot/ercot_counties_aggregated.geojson'
    
    print(f'📊 Loading ERCOT data from: {ercot_path}')
    with open(ercot_path, 'r') as f:
        ercot_geojson = json.load(f)
    
    ercot_data = {}
    for feature in ercot_geojson.get('features', []):
        props = feature.get('properties', {})
        county_name = props.get('NAME', '').strip()
        if county_name:
            ercot_data[county_name] = props
    
    print(f'   Loaded {len(ercot_data)} counties with ERCOT data')
    print()
    
    # Load DC data
    dc_path = base_path / 'public/data/texas_data_centers.geojson'
    counties_path = base_path / 'public/data/texas/texas_counties.geojson'
    
    print(f'📊 Loading data centers from: {dc_path}')
    with open(dc_path, 'r') as f:
        dc_geojson = json.load(f)
    
    # Count DCs by county using point-in-polygon
    dc_counts = defaultdict(int)
    
    if HAVE_SHAPELY and counties_path.exists():
        with open(counties_path, 'r') as f:
            counties_geojson = json.load(f)
        
        county_polygons = {}
        for feature in counties_geojson.get('features', []):
            props = feature.get('properties', {})
            county_name = props.get('NAME', '').strip()
            if county_name:
                try:
                    county_polygons[county_name] = shape(feature.get('geometry', {}))
                except:
                    pass
        
        for feature in dc_geojson.get('features', []):
            coords = feature.get('geometry', {}).get('coordinates', [])
            if coords and len(coords) == 2:
                point = Point(coords[0], coords[1])
                for county_name, polygon in county_polygons.items():
                    if polygon.contains(point):
                        dc_counts[county_name] += 1
                        break
    
    print(f'   Found {sum(dc_counts.values())} data centers across {len(dc_counts)} counties')
    print()
    
    # Top 10 DC counties
    top_dc_counties = sorted(dc_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    top_dc_county_names = [name for name, _ in top_dc_counties]
    
    print('=' * 80)
    print('📊 TOP 10 DC COUNTIES - FUEL MIX ANALYSIS')
    print('=' * 80)
    print()
    
    dc_county_data = []
    
    for county_name, dc_count in top_dc_counties:
        fuel_mix = get_fuel_mix(county_name, ercot_data)
        
        print(f'{county_name}:')
        print(f'  DCs: {dc_count}')
        print(f'  Total capacity: {fuel_mix["total_mw"]:,.0f} MW ({fuel_mix["total_mw"]/1000:.2f} GW)')
        print(f'  Gas: {fuel_mix["gas_mw"]:,.0f} MW ({fuel_mix["gas_pct"]:.1f}%)')
        print(f'  Solar: {fuel_mix["solar_mw"]:,.0f} MW ({fuel_mix["solar_pct"]:.1f}%)')
        print(f'  Wind: {fuel_mix["wind_mw"]:,.0f} MW ({fuel_mix["wind_pct"]:.1f}%)')
        print(f'  Renewable (solar+wind): {fuel_mix["renewable_pct"]:.1f}%')
        print(f'  Baseload (gas+nuclear): {fuel_mix["baseload_pct"]:.1f}%')
        print(f'  Projects: {fuel_mix["project_count"]}')
        print()
        
        dc_county_data.append({
            'county': county_name,
            'dc_count': dc_count,
            **fuel_mix
        })
    
    # Analyze all counties with energy infrastructure
    print('=' * 80)
    print('📊 ALL COUNTIES WITH ENERGY INFRASTRUCTURE')
    print('=' * 80)
    print()
    
    all_county_data = []
    
    for county_name in ercot_data.keys():
        fuel_mix = get_fuel_mix(county_name, ercot_data)
        dc_count = get_dc_count(county_name, dc_counts)
        
        if fuel_mix['total_mw'] > 0:  # Only counties with energy infrastructure
            all_county_data.append({
                'county': county_name,
                'dc_count': dc_count,
                **fuel_mix
            })
    
    # Correlation analysis
    print('=' * 80)
    print('📈 CORRELATION ANALYSIS')
    print('=' * 80)
    print()
    
    # Prepare data for correlation
    gas_pcts = [d['gas_pct'] for d in all_county_data]
    solar_pcts = [d['solar_pct'] for d in all_county_data]
    renewable_pcts = [d['renewable_pct'] for d in all_county_data]
    baseload_pcts = [d['baseload_pct'] for d in all_county_data]
    dc_counts_list = [d['dc_count'] for d in all_county_data]
    total_mw_list = [d['total_mw'] for d in all_county_data]
    
    # Calculate correlations
    gas_dc_corr = correlate(gas_pcts, dc_counts_list)
    solar_dc_corr = correlate(solar_pcts, dc_counts_list)
    renewable_dc_corr = correlate(renewable_pcts, dc_counts_list)
    baseload_dc_corr = correlate(baseload_pcts, dc_counts_list)
    total_dc_corr = correlate(total_mw_list, dc_counts_list)
    
    print('Correlation Coefficients (Pearson):')
    print('-' * 80)
    if gas_dc_corr is not None:
        print(f'  Gas % vs DC count: {gas_dc_corr:.3f}')
        if gas_dc_corr > 0.3:
            print('    ✅ Positive correlation (more gas = more DCs)')
        elif gas_dc_corr < -0.3:
            print('    ❌ Negative correlation (more gas = fewer DCs)')
        else:
            print('    ⚠️  Weak/no correlation')
    
    if solar_dc_corr is not None:
        print(f'  Solar % vs DC count: {solar_dc_corr:.3f}')
        if solar_dc_corr > 0.3:
            print('    ✅ Positive correlation (more solar = more DCs)')
        elif solar_dc_corr < -0.3:
            print('    ❌ Negative correlation (more solar = fewer DCs)')
        else:
            print('    ⚠️  Weak/no correlation')
    
    if renewable_dc_corr is not None:
        print(f'  Renewable % vs DC count: {renewable_dc_corr:.3f}')
    
    if baseload_dc_corr is not None:
        print(f'  Baseload % vs DC count: {baseload_dc_corr:.3f}')
        if baseload_dc_corr > 0.3:
            print('    ✅ Positive correlation (more baseload = more DCs)')
    
    if total_dc_corr is not None:
        print(f'  Total capacity vs DC count: {total_dc_corr:.3f}')
    
    print()
    
    # Compare high DC vs low DC counties
    print('=' * 80)
    print('📊 HIGH DC vs LOW DC COUNTIES COMPARISON')
    print('=' * 80)
    print()
    
    counties_with_dcs = [d for d in all_county_data if d['dc_count'] > 0]
    counties_without_dcs = [d for d in all_county_data if d['dc_count'] == 0]
    
    if counties_with_dcs:
        avg_gas_pct_with_dc = statistics.mean([d['gas_pct'] for d in counties_with_dcs])
        avg_solar_pct_with_dc = statistics.mean([d['solar_pct'] for d in counties_with_dcs])
        avg_renewable_pct_with_dc = statistics.mean([d['renewable_pct'] for d in counties_with_dcs])
        avg_baseload_pct_with_dc = statistics.mean([d['baseload_pct'] for d in counties_with_dcs])
        avg_total_mw_with_dc = statistics.mean([d['total_mw'] for d in counties_with_dcs])
        
        print(f'Counties WITH data centers ({len(counties_with_dcs)}):')
        print(f'  Avg Gas %: {avg_gas_pct_with_dc:.1f}%')
        print(f'  Avg Solar %: {avg_solar_pct_with_dc:.1f}%')
        print(f'  Avg Renewable %: {avg_renewable_pct_with_dc:.1f}%')
        print(f'  Avg Baseload %: {avg_baseload_pct_with_dc:.1f}%')
        print(f'  Avg Total Capacity: {avg_total_mw_with_dc:,.0f} MW')
        print()
    
    if counties_without_dcs:
        avg_gas_pct_no_dc = statistics.mean([d['gas_pct'] for d in counties_without_dcs])
        avg_solar_pct_no_dc = statistics.mean([d['solar_pct'] for d in counties_without_dcs])
        avg_renewable_pct_no_dc = statistics.mean([d['renewable_pct'] for d in counties_without_dcs])
        avg_baseload_pct_no_dc = statistics.mean([d['baseload_pct'] for d in counties_without_dcs])
        avg_total_mw_no_dc = statistics.mean([d['total_mw'] for d in counties_without_dcs])
        
        print(f'Counties WITHOUT data centers ({len(counties_without_dcs)}):')
        print(f'  Avg Gas %: {avg_gas_pct_no_dc:.1f}%')
        print(f'  Avg Solar %: {avg_solar_pct_no_dc:.1f}%')
        print(f'  Avg Renewable %: {avg_renewable_pct_no_dc:.1f}%')
        print(f'  Avg Baseload %: {avg_baseload_pct_no_dc:.1f}%')
        print(f'  Avg Total Capacity: {avg_total_mw_no_dc:,.0f} MW')
        print()
        
        if counties_with_dcs:
            print('Comparison:')
            gas_ratio = avg_gas_pct_with_dc / avg_gas_pct_no_dc if avg_gas_pct_no_dc > 0 else 0
            solar_ratio = avg_solar_pct_with_dc / avg_solar_pct_no_dc if avg_solar_pct_no_dc > 0 else 0
            baseload_ratio = avg_baseload_pct_with_dc / avg_baseload_pct_no_dc if avg_baseload_pct_no_dc > 0 else 0
            
            print(f'  Gas % ratio (with DC / without DC): {gas_ratio:.2f}x')
            print(f'  Solar % ratio (with DC / without DC): {solar_ratio:.2f}x')
            print(f'  Baseload % ratio (with DC / without DC): {baseload_ratio:.2f}x')
            print()
    
    # Save results
    output_data = {
        'top_10_dc_counties': dc_county_data,
        'all_counties': all_county_data,
        'correlations': {
            'gas_pct_vs_dc_count': gas_dc_corr,
            'solar_pct_vs_dc_count': solar_dc_corr,
            'renewable_pct_vs_dc_count': renewable_dc_corr,
            'baseload_pct_vs_dc_count': baseload_dc_corr,
            'total_capacity_vs_dc_count': total_dc_corr
        },
        'averages': {
            'with_dcs': {
                'count': len(counties_with_dcs),
                'avg_gas_pct': avg_gas_pct_with_dc if counties_with_dcs else 0,
                'avg_solar_pct': avg_solar_pct_with_dc if counties_with_dcs else 0,
                'avg_renewable_pct': avg_renewable_pct_with_dc if counties_with_dcs else 0,
                'avg_baseload_pct': avg_baseload_pct_with_dc if counties_with_dcs else 0,
                'avg_total_mw': avg_total_mw_with_dc if counties_with_dcs else 0
            },
            'without_dcs': {
                'count': len(counties_without_dcs),
                'avg_gas_pct': avg_gas_pct_no_dc if counties_without_dcs else 0,
                'avg_solar_pct': avg_solar_pct_no_dc if counties_without_dcs else 0,
                'avg_renewable_pct': avg_renewable_pct_no_dc if counties_without_dcs else 0,
                'avg_baseload_pct': avg_baseload_pct_no_dc if counties_without_dcs else 0,
                'avg_total_mw': avg_total_mw_no_dc if counties_without_dcs else 0
            }
        }
    }
    
    output_path = base_path / 'data/analysis/story1_fuel_mix_dc_correlation.json'
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f'💾 Results saved to: {output_path}')
    print()
    
    # Summary
    print('=' * 80)
    print('💡 KEY INSIGHTS')
    print('=' * 80)
    print()
    
    if gas_dc_corr and gas_dc_corr > 0.3:
        print('✅ STRONG POSITIVE CORRELATION: Gas % and DC count')
        print('   → Counties with more gas capacity tend to have more data centers')
    elif gas_dc_corr and gas_dc_corr < -0.3:
        print('❌ STRONG NEGATIVE CORRELATION: Gas % and DC count')
        print('   → Counties with more gas capacity tend to have fewer data centers')
    else:
        print('⚠️  WEAK/NO CORRELATION: Gas % and DC count')
        print('   → Gas capacity does not strongly predict data center locations')
    
    print()
    
    if counties_with_dcs and counties_without_dcs:
        gas_ratio = avg_gas_pct_with_dc / avg_gas_pct_no_dc if avg_gas_pct_no_dc > 0 else 0
        if gas_ratio > 1.5:
            print(f'✅ Gas % is {gas_ratio:.2f}x higher in counties WITH data centers')
        elif gas_ratio < 0.67:
            print(f'❌ Gas % is {1/gas_ratio:.2f}x lower in counties WITH data centers')
        else:
            print(f'⚠️  Gas % is similar in counties with/without data centers')

if __name__ == '__main__':
    main()

