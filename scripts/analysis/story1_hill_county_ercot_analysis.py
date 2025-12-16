#!/usr/bin/env python3
"""
Analyze ERCOT energy data for Hill County.
Shows what energy infrastructure exists and how it relates to data center demand.
"""
import json
from pathlib import Path

def analyze_hill_county_ercot():
    """Analyze ERCOT energy data for Hill County."""
    base_path = Path(__file__).parent.parent.parent
    
    print("=" * 80)
    print("HILL COUNTY - ERCOT ENERGY DATA ANALYSIS")
    print("=" * 80)
    print()
    
    # Load ERCOT aggregated data
    ercot_path = base_path / 'public/data/ercot/ercot_counties_aggregated_fixed.geojson'
    if not ercot_path.exists():
        ercot_path = base_path / 'public/data/ercot/ercot_counties_aggregated.geojson'
    
    with open(ercot_path, 'r') as f:
        data = json.load(f)
    
    # Find Hill County
    hill_county = None
    for feature in data['features']:
        props = feature.get('properties', {})
        if props.get('NAME', '').strip() == 'Hill':
            hill_county = props
            break
    
    if not hill_county:
        print("❌ Hill County not found in ERCOT data")
        return
    
    print("1. OVERVIEW")
    print("-" * 80)
    print(f"County: {hill_county.get('NAME', 'Hill')}")
    print(f"Has operational energy projects: {hill_county.get('has_projects', False)}")
    print()
    
    print("2. ENERGY PROJECT STATISTICS")
    print("-" * 80)
    project_count = hill_county.get('project_count', 0)
    total_capacity_mw = hill_county.get('total_capacity_mw', 0) or 0
    avg_capacity_mw = hill_county.get('avg_capacity_mw', 0) or 0
    
    print(f"Total operational projects: {project_count}")
    print(f"Total capacity: {total_capacity_mw:,.0f} MW ({total_capacity_mw/1000:.2f} GW)")
    print(f"Average project size: {avg_capacity_mw:,.0f} MW")
    print()
    
    print("3. FUEL TYPE BREAKDOWN")
    print("-" * 80)
    fuel_types = {
        'Solar': (hill_county.get('fuel_solar_count', 0) or 0, hill_county.get('fuel_solar_capacity', 0) or 0),
        'Wind': (hill_county.get('fuel_wind_count', 0) or 0, hill_county.get('fuel_wind_capacity', 0) or 0),
        'Battery': (hill_county.get('fuel_battery_count', 0) or 0, hill_county.get('fuel_battery_capacity', 0) or 0),
        'Gas': (hill_county.get('fuel_gas_count', 0) or 0, hill_county.get('fuel_gas_capacity', 0) or 0),
        'Storage': (hill_county.get('fuel_storage_count', 0) or 0, hill_county.get('fuel_storage_capacity', 0) or 0),
        'Nuclear': (hill_county.get('fuel_nuclear_count', 0) or 0, hill_county.get('fuel_nuclear_capacity', 0) or 0),
        'Other': (hill_county.get('fuel_other_count', 0) or 0, hill_county.get('fuel_other_capacity', 0) or 0),
    }
    
    for fuel, (count, capacity) in sorted(fuel_types.items(), key=lambda x: x[1][1], reverse=True):
        if count > 0:
            pct = (capacity / total_capacity_mw * 100) if total_capacity_mw > 0 else 0
            print(f"{fuel:12} {count:3} projects, {capacity:8,.0f} MW ({pct:5.1f}%)")
    print()
    
    print("4. ENERGY MIX")
    print("-" * 80)
    renewable_cap = hill_county.get('renewable_capacity', 0) or 0
    storage_cap = hill_county.get('storage_capacity', 0) or 0
    baseload_cap = hill_county.get('baseload_capacity', 0) or 0
    renewable_pct = hill_county.get('renewable_pct', 0) or 0
    storage_pct = hill_county.get('storage_pct', 0) or 0
    baseload_pct = hill_county.get('baseload_pct', 0) or 0
    
    print(f"Renewable (solar + wind): {renewable_cap:,.0f} MW ({renewable_pct:.1f}%)")
    print(f"Storage (battery + storage): {storage_cap:,.0f} MW ({storage_pct:.1f}%)")
    print(f"Baseload (gas + nuclear): {baseload_cap:,.0f} MW ({baseload_pct:.1f}%)")
    print()
    print(f"Dominant fuel type: {hill_county.get('dominant_fuel_type', 'N/A')}")
    print()
    
    print("5. COMPARISON WITH DATA CENTER DEMAND")
    print("-" * 80)
    # Get DC demand from power gap analysis
    gap_path = base_path / 'data/analysis/story1_power_demand_gap.json'
    dc_demand_mw = 0
    if gap_path.exists():
        with open(gap_path, 'r') as f:
            gap_data = json.load(f)
        for gap in gap_data.get('gaps_by_county', []):
            if gap['county'] == 'Hill':
                dc_demand_mw = gap['dc_demand_mw']
                break
    
    dc_demand_gw = dc_demand_mw / 1000
    ercot_capacity_gw = total_capacity_mw / 1000
    surplus_gw = ercot_capacity_gw - dc_demand_gw
    surplus_pct = (surplus_gw / ercot_capacity_gw * 100) if ercot_capacity_gw > 0 else 0
    
    print(f"Data center demand: {dc_demand_gw:.2f} GW ({dc_demand_mw:,.0f} MW)")
    print(f"ERCOT capacity: {ercot_capacity_gw:.2f} GW ({total_capacity_mw:,.0f} MW)")
    print(f"Energy surplus: {surplus_gw:.2f} GW ({surplus_pct:.1f}% of capacity)")
    print()
    
    if surplus_gw > 0:
        print(f"✅ Hill County has {surplus_gw:.2f} GW surplus capacity")
        print(f"   → Can support {surplus_gw / 0.1:.0f} more 100 MW data centers")
        print(f"   → Or {surplus_gw / 0.5:.0f} more 500 MW data centers")
    else:
        print(f"⚠️  Hill County has {abs(surplus_gw):.2f} GW shortfall")
    print()
    
    print("6. KEY INSIGHTS")
    print("-" * 80)
    
    # Insights based on data
    insights = []
    
    if renewable_pct > 50:
        insights.append(f"✅ Renewable-dominant ({renewable_pct:.0f}% renewable) - good for sustainability")
    
    if storage_cap > 0:
        insights.append(f"✅ Has {storage_cap:,.0f} MW storage - can provide backup power")
    
    if surplus_pct > 50:
        insights.append(f"✅ Large surplus ({surplus_pct:.0f}%) - plenty of room for growth")
    
    if project_count > 10:
        insights.append(f"✅ Active energy market ({project_count} projects) - infrastructure is being built")
    
    if baseload_pct > 50:
        insights.append(f"⚠️  Baseload-dominant ({baseload_pct:.0f}%) - less flexible, but reliable")
    
    if insights:
        for insight in insights:
            print(f"  {insight}")
    else:
        print("  No specific insights")
    
    print()
    print("=" * 80)
    print("✅ Analysis complete!")
    print("=" * 80)

if __name__ == '__main__':
    analyze_hill_county_ercot()

