#!/usr/bin/env python3
"""
Analyze fuel mix correlation with data center presence.
Tests Hypothesis B: Counties with baseload (gas) power are more likely to have DCs.
"""
import json
import sqlite3
from pathlib import Path
from collections import defaultdict
import statistics

def analyze_fuel_mix_correlation():
    """Analyze fuel mix for top DC and energy counties."""
    base_path = Path(__file__).parent.parent.parent
    
    print("=" * 80)
    print("FUEL MIX CORRELATION ANALYSIS")
    print("Testing: Gas % → DC Count")
    print("=" * 80)
    print()
    
    # 1. Load ERCOT data
    ercot_path = base_path / 'public/data/ercot/ercot_counties_aggregated_fixed.geojson'
    if not ercot_path.exists():
        ercot_path = base_path / 'public/data/ercot/ercot_counties_aggregated.geojson'
    
    with open(ercot_path, 'r') as f:
        ercot_data = json.load(f)
    
    # 2. Load DC data
    gap_path = base_path / 'data/analysis/story1_power_demand_gap.json'
    with open(gap_path, 'r') as f:
        gap_data = json.load(f)
    
    # Build county data
    county_data = {}
    
    # Add ERCOT data
    for feature in ercot_data['features']:
        props = feature.get('properties', {})
        county_name = props.get('NAME', '').strip()
        if not county_name:
            continue
        
        total_cap = props.get('total_capacity_mw', 0) or 0
        gas_cap = props.get('fuel_gas_capacity', 0) or 0
        solar_cap = props.get('fuel_solar_capacity', 0) or 0
        wind_cap = props.get('fuel_wind_capacity', 0) or 0
        battery_cap = props.get('fuel_battery_capacity', 0) or 0
        storage_cap = props.get('fuel_storage_capacity', 0) or 0
        nuclear_cap = props.get('fuel_nuclear_capacity', 0) or 0
        
        if total_cap > 0:
            gas_pct = (gas_cap / total_cap * 100)
            solar_pct = (solar_cap / total_cap * 100)
            wind_pct = (wind_cap / total_cap * 100)
            renewable_pct = (solar_cap + wind_cap) / total_cap * 100
            baseload_pct = (gas_cap + nuclear_cap) / total_cap * 100
            
            county_data[county_name] = {
                'county': county_name,
                'total_capacity_mw': total_cap,
                'total_capacity_gw': total_cap / 1000,
                'gas_capacity_mw': gas_cap,
                'gas_pct': gas_pct,
                'solar_capacity_mw': solar_cap,
                'solar_pct': solar_pct,
                'wind_capacity_mw': wind_cap,
                'wind_pct': wind_pct,
                'renewable_pct': renewable_pct,
                'baseload_pct': baseload_pct,
                'nuclear_capacity_mw': nuclear_cap,
                'storage_capacity_mw': storage_cap + battery_cap,
                'dc_count': 0,
                'dc_demand_gw': 0,
                'has_dcs': False
            }
    
    # Add DC data
    for gap in gap_data.get('gaps_by_county', []):
        county_name = gap['county']
        if county_name in county_data:
            county_data[county_name]['dc_count'] = gap['dc_count']
            county_data[county_name]['dc_demand_gw'] = gap['dc_demand_gw']
            county_data[county_name]['has_dcs'] = gap['dc_count'] > 0
    
    # 3. Top 10 DC Counties
    print("1. TOP 10 DC COUNTIES - FUEL MIX")
    print("-" * 80)
    
    counties_with_dcs = [c for c in county_data.values() if c['dc_count'] > 0]
    top_dc_counties = sorted(counties_with_dcs, key=lambda x: x['dc_count'], reverse=True)[:10]
    
    print(f"{'County':<20} {'DC Count':<12} {'Energy GW':<12} {'Gas %':<10} {'Solar %':<10} {'Baseload %':<12} {'Has Gas?':<10}")
    print("-" * 80)
    
    for county in top_dc_counties:
        has_gas = "✅ Yes" if county['gas_pct'] > 0 else "❌ No"
        print(f"{county['county']:<20} {county['dc_count']:<12} {county['total_capacity_gw']:>10.2f} {county['gas_pct']:>8.1f}% {county['solar_pct']:>8.1f}% {county['baseload_pct']:>10.1f}% {has_gas:<10}")
    
    print()
    
    # Count how many have gas
    dc_counties_with_gas = sum(1 for c in top_dc_counties if c['gas_pct'] > 0)
    print(f"Counties with gas: {dc_counties_with_gas}/10 ({dc_counties_with_gas*10}%)")
    print()
    
    # 4. Top 10 Energy Counties
    print("2. TOP 10 ENERGY COUNTIES - FUEL MIX vs DC COUNT")
    print("-" * 80)
    
    counties_with_energy = [c for c in county_data.values() if c['total_capacity_gw'] > 0]
    top_energy_counties = sorted(counties_with_energy, key=lambda x: x['total_capacity_gw'], reverse=True)[:10]
    
    print(f"{'County':<20} {'Energy GW':<12} {'Gas %':<10} {'Solar %':<10} {'DC Count':<12} {'Has DCs?':<10}")
    print("-" * 80)
    
    for county in top_energy_counties:
        has_dcs = "✅ Yes" if county['dc_count'] > 0 else "❌ No"
        print(f"{county['county']:<20} {county['total_capacity_gw']:>10.2f} {county['gas_pct']:>8.1f}% {county['solar_pct']:>8.1f}% {county['dc_count']:<12} {has_dcs:<10}")
    
    print()
    
    # 5. Correlation Analysis
    print("3. CORRELATION: GAS % → DC COUNT")
    print("-" * 80)
    
    # Get all counties with energy
    all_counties = [c for c in county_data.values() if c['total_capacity_gw'] > 0]
    
    # Group by gas percentage ranges
    gas_ranges = {
        '0% (No Gas)': [],
        '1-25% Gas': [],
        '26-50% Gas': [],
        '51-75% Gas': [],
        '76-100% Gas': []
    }
    
    for county in all_counties:
        gas_pct = county['gas_pct']
        if gas_pct == 0:
            gas_ranges['0% (No Gas)'].append(county)
        elif gas_pct <= 25:
            gas_ranges['1-25% Gas'].append(county)
        elif gas_pct <= 50:
            gas_ranges['26-50% Gas'].append(county)
        elif gas_pct <= 75:
            gas_ranges['51-75% Gas'].append(county)
        else:
            gas_ranges['76-100% Gas'].append(county)
    
    print(f"{'Gas % Range':<20} {'Counties':<12} {'Avg DC Count':<15} {'Counties w/ DCs':<18} {'% w/ DCs':<12}")
    print("-" * 80)
    
    for range_name, counties in gas_ranges.items():
        if len(counties) == 0:
            continue
        
        avg_dc_count = statistics.mean([c['dc_count'] for c in counties])
        counties_with_dcs = sum(1 for c in counties if c['dc_count'] > 0)
        pct_with_dcs = (counties_with_dcs / len(counties) * 100) if len(counties) > 0 else 0
        
        print(f"{range_name:<20} {len(counties):<12} {avg_dc_count:>13.2f} {counties_with_dcs:>16} ({pct_with_dcs:>9.1f}%)")
    
    print()
    
    # 6. Detailed Correlation
    print("4. DETAILED CORRELATION ANALYSIS")
    print("-" * 80)
    
    # Counties with gas vs without gas
    counties_with_gas = [c for c in all_counties if c['gas_pct'] > 0]
    counties_without_gas = [c for c in all_counties if c['gas_pct'] == 0]
    
    print("Counties WITH gas:")
    print(f"  Total counties: {len(counties_with_gas)}")
    print(f"  Counties with DCs: {sum(1 for c in counties_with_gas if c['dc_count'] > 0)}")
    print(f"  % with DCs: {sum(1 for c in counties_with_gas if c['dc_count'] > 0) / len(counties_with_gas) * 100:.1f}%")
    print(f"  Avg DC count: {statistics.mean([c['dc_count'] for c in counties_with_gas]):.2f}")
    print(f"  Avg gas %: {statistics.mean([c['gas_pct'] for c in counties_with_gas]):.1f}%")
    print()
    
    print("Counties WITHOUT gas:")
    print(f"  Total counties: {len(counties_without_gas)}")
    print(f"  Counties with DCs: {sum(1 for c in counties_without_gas if c['dc_count'] > 0)}")
    print(f"  % with DCs: {sum(1 for c in counties_without_gas if c['dc_count'] > 0) / len(counties_without_gas) * 100:.1f}%")
    print(f"  Avg DC count: {statistics.mean([c['dc_count'] for c in counties_without_gas]):.2f}")
    print()
    
    # 7. Top DC Counties - Detailed Fuel Mix
    print("5. TOP 10 DC COUNTIES - DETAILED FUEL MIX")
    print("-" * 80)
    
    for county in top_dc_counties:
        print(f"\n{county['county']} ({county['dc_count']} DCs, {county['total_capacity_gw']:.2f} GW):")
        print(f"  Gas: {county['gas_capacity_mw']:,.0f} MW ({county['gas_pct']:.1f}%)")
        print(f"  Solar: {county['solar_capacity_mw']:,.0f} MW ({county['solar_pct']:.1f}%)")
        print(f"  Wind: {county['wind_capacity_mw']:,.0f} MW ({county['wind_pct']:.1f}%)")
        print(f"  Baseload (gas+nuclear): {county['baseload_pct']:.1f}%")
        print(f"  Renewable (solar+wind): {county['renewable_pct']:.1f}%")
    
    print()
    
    # 8. Hypothesis B Test
    print("6. HYPOTHESIS B TEST")
    print("-" * 80)
    
    print("Hypothesis B: Counties with baseload (gas) power are more likely to have DCs.")
    print()
    
    gas_dc_rate = sum(1 for c in counties_with_gas if c['dc_count'] > 0) / len(counties_with_gas) * 100 if counties_with_gas else 0
    no_gas_dc_rate = sum(1 for c in counties_without_gas if c['dc_count'] > 0) / len(counties_without_gas) * 100 if counties_without_gas else 0
    
    print(f"Counties WITH gas: {gas_dc_rate:.1f}% have DCs")
    print(f"Counties WITHOUT gas: {no_gas_dc_rate:.1f}% have DCs")
    print()
    
    if gas_dc_rate > no_gas_dc_rate:
        print(f"✅ Hypothesis B SUPPORTED: Counties with gas are {gas_dc_rate/no_gas_dc_rate:.1f}x more likely to have DCs")
    else:
        print(f"❌ Hypothesis B NOT SUPPORTED: No clear correlation")
    
    print()
    
    # 9. Save results
    results = {
        'top_dc_counties': [
            {
                'county': c['county'],
                'dc_count': c['dc_count'],
                'total_capacity_gw': c['total_capacity_gw'],
                'gas_pct': c['gas_pct'],
                'solar_pct': c['solar_pct'],
                'baseload_pct': c['baseload_pct'],
                'has_gas': c['gas_pct'] > 0
            }
            for c in top_dc_counties
        ],
        'top_energy_counties': [
            {
                'county': c['county'],
                'total_capacity_gw': c['total_capacity_gw'],
                'gas_pct': c['gas_pct'],
                'solar_pct': c['solar_pct'],
                'dc_count': c['dc_count'],
                'has_dcs': c['dc_count'] > 0
            }
            for c in top_energy_counties
        ],
        'correlation_by_gas_range': {
            range_name: {
                'counties': len(counties),
                'avg_dc_count': statistics.mean([c['dc_count'] for c in counties]) if counties else 0,
                'counties_with_dcs': sum(1 for c in counties if c['dc_count'] > 0),
                'pct_with_dcs': (sum(1 for c in counties if c['dc_count'] > 0) / len(counties) * 100) if counties else 0
            }
            for range_name, counties in gas_ranges.items()
        },
        'hypothesis_b_test': {
            'counties_with_gas': {
                'total': len(counties_with_gas),
                'with_dcs': sum(1 for c in counties_with_gas if c['dc_count'] > 0),
                'pct_with_dcs': gas_dc_rate,
                'avg_dc_count': statistics.mean([c['dc_count'] for c in counties_with_gas]) if counties_with_gas else 0
            },
            'counties_without_gas': {
                'total': len(counties_without_gas),
                'with_dcs': sum(1 for c in counties_without_gas if c['dc_count'] > 0),
                'pct_with_dcs': no_gas_dc_rate,
                'avg_dc_count': statistics.mean([c['dc_count'] for c in counties_without_gas]) if counties_without_gas else 0
            },
            'conclusion': 'SUPPORTED' if gas_dc_rate > no_gas_dc_rate else 'NOT SUPPORTED',
            'ratio': gas_dc_rate / no_gas_dc_rate if no_gas_dc_rate > 0 else 0
        }
    }
    
    output_path = base_path / 'data/analysis/story1_fuel_mix_correlation.json'
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"✅ Results saved to: {output_path}")
    print()
    print("=" * 80)
    print("✅ Analysis complete!")
    print("=" * 80)

if __name__ == '__main__':
    analyze_fuel_mix_correlation()

