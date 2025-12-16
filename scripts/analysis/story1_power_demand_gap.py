#!/usr/bin/env python3
"""
Calculate power demand gap for each county with data centers.
Compares estimated DC power demand vs local ERCOT energy capacity.
"""
import json
from pathlib import Path
from collections import defaultdict

def estimate_dc_demand(feature, default_mw_per_dc=100, max_reasonable_mw=10000):
    """
    Estimate power demand for a data center project.
    
    Args:
        feature: GeoJSON feature with DC project data
        default_mw_per_dc: Default estimate if size_mw not available (MW)
        max_reasonable_mw: Maximum reasonable size for a single DC (MW)
                           Used to filter out data quality issues
    """
    props = feature.get('properties', {})
    
    # Use size_mw if available
    size_mw = props.get('size_mw')
    if size_mw and size_mw > 0:
        size_mw = float(size_mw)
        
        # Sanity check: if size_mw is unreasonably large, use default
        if size_mw > max_reasonable_mw:
            project_name = props.get('project_name', 'Unknown')
            print(f"  ⚠️  {project_name[:50]}: size_mw={size_mw} MW is unreasonably large, using default {default_mw_per_dc} MW")
            return default_mw_per_dc
        
        return size_mw
    
    # Fallback: use default estimate
    return default_mw_per_dc

def calculate_power_demand_gap():
    """Calculate power demand gap for each county with data centers."""
    base_path = Path(__file__).parent.parent.parent
    
    # Load DC data
    dc_path = base_path / 'public/data/texas_data_centers.geojson'
    print("Loading data center data...")
    with open(dc_path, 'r') as f:
        dc_data = json.load(f)
    
    # Load ERCOT data (fixed)
    ercot_path = base_path / 'public/data/ercot/ercot_counties_aggregated_fixed.geojson'
    if not ercot_path.exists():
        ercot_path = base_path / 'public/data/ercot/ercot_counties_aggregated.geojson'
        print("⚠️  Using original ERCOT data (fixed not found)")
    
    print("Loading ERCOT energy data...")
    with open(ercot_path, 'r') as f:
        ercot_data = json.load(f)
    
    # Create ERCOT capacity lookup by county
    ercot_by_county = {}
    for feature in ercot_data.get('features', []):
        props = feature.get('properties', {})
        county_name = props.get('NAME', '').strip()
        if county_name:
            ercot_by_county[county_name] = {
                'capacity_mw': props.get('total_capacity_mw', 0) or 0,
                'project_count': props.get('project_count', 0) or 0
            }
    
    # Aggregate DC demand by county
    print("\nCalculating DC demand by county...")
    dc_demand_by_county = defaultdict(lambda: {
        'dc_count': 0,
        'total_demand_mw': 0.0,
        'projects_with_size': 0,
        'projects_estimated': 0,
        'projects': []
    })
    
    # Use point-in-polygon if shapely available, otherwise use location text
    try:
        from shapely.geometry import Point, shape
        HAVE_SHAPELY = True
        
        # Load county boundaries for point-in-polygon
        counties_path = base_path / 'public/data/texas/texas_counties.geojson'
        if counties_path.exists():
            with open(counties_path, 'r') as f:
                counties_data = json.load(f)
        else:
            counties_data = None
            HAVE_SHAPELY = False
    except ImportError:
        HAVE_SHAPELY = False
        counties_data = None
    
    def get_county_from_coords(lng, lat, counties_data):
        """Get county from coordinates using point-in-polygon."""
        if not HAVE_SHAPELY or not counties_data:
            return None
        
        point = Point(lng, lat)
        for feature in counties_data.get('features', []):
            county_name = feature.get('properties', {}).get('NAME', '')
            geometry = feature.get('geometry', {})
            if geometry and county_name:
                try:
                    polygon = shape(geometry)
                    if polygon.contains(point):
                        return county_name
                except:
                    continue
        return None
    
    unlocated = 0
    
    for feature in dc_data.get('features', []):
        props = feature.get('properties', {})
        coords = feature.get('geometry', {}).get('coordinates', [])
        location_text = props.get('location', '')
        
        # Try to get county
        county = None
        
        # Strategy 1: Point-in-polygon
        if coords and len(coords) == 2 and counties_data:
            county = get_county_from_coords(coords[0], coords[1], counties_data)
        
        # Strategy 2: Parse location text
        if not county and location_text:
            import re
            # Pattern: "City, County" or "County"
            patterns = [
                r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County",
                r"([A-Z][a-z]+),\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County",
            ]
            for pattern in patterns:
                match = re.search(pattern, location_text)
                if match:
                    groups = match.groups()
                    if len(groups) > 1:
                        county = groups[-1]
                    else:
                        county = groups[0]
                    break
        
        if not county:
            unlocated += 1
            continue
        
        # Estimate demand
        demand_mw = estimate_dc_demand(feature)
        has_size = props.get('size_mw') and props.get('size_mw') > 0
        
        dc_demand_by_county[county]['dc_count'] += 1
        dc_demand_by_county[county]['total_demand_mw'] += demand_mw
        if has_size:
            dc_demand_by_county[county]['projects_with_size'] += 1
        else:
            dc_demand_by_county[county]['projects_estimated'] += 1
        dc_demand_by_county[county]['projects'].append({
            'name': props.get('project_name', 'Unknown'),
            'demand_mw': demand_mw,
            'has_size': has_size
        })
    
    if unlocated > 0:
        print(f"⚠️  {unlocated} projects could not be assigned to a county")
    
    # Calculate gaps
    print("\n" + "=" * 80)
    print("POWER DEMAND GAP ANALYSIS")
    print("=" * 80)
    
    gaps = []
    
    for county, dc_info in dc_demand_by_county.items():
        dc_count = dc_info['dc_count']
        dc_demand_mw = dc_info['total_demand_mw']
        ercot_info = ercot_by_county.get(county, {'capacity_mw': 0, 'project_count': 0})
        ercot_capacity_mw = ercot_info['capacity_mw']
        
        gap_mw = dc_demand_mw - ercot_capacity_mw
        gap_gw = gap_mw / 1000
        
        # Determine status
        if gap_mw > 0:
            status = "SHORTFALL"
            status_emoji = "🔴"
        elif gap_mw < -100:  # More than 100 MW surplus
            status = "SURPLUS"
            status_emoji = "🟢"
        else:
            status = "BALANCED"
            status_emoji = "🟡"
        
        gaps.append({
            'county': county,
            'dc_count': dc_count,
            'dc_demand_mw': dc_demand_mw,
            'dc_demand_gw': dc_demand_mw / 1000,
            'ercot_capacity_mw': ercot_capacity_mw,
            'ercot_capacity_gw': ercot_capacity_mw / 1000,
            'gap_mw': gap_mw,
            'gap_gw': gap_gw,
            'status': status,
            'projects_with_size': dc_info['projects_with_size'],
            'projects_estimated': dc_info['projects_estimated']
        })
    
    # Sort by gap (largest shortfall first)
    gaps.sort(key=lambda x: x['gap_mw'], reverse=True)
    
    # Print results
    print(f"\n{'County':<20} {'DCs':<6} {'DC Demand':<12} {'ERCOT Cap':<12} {'Gap':<12} {'Status':<12}")
    print(f"{'-'*20} {'-'*6} {'-'*12} {'-'*12} {'-'*12} {'-'*12}")
    
    total_demand = 0
    total_capacity = 0
    total_shortfall = 0
    counties_with_shortfall = 0
    
    for gap in gaps:
        county = gap['county']
        dc_count = gap['dc_count']
        dc_demand_gw = gap['dc_demand_gw']
        ercot_capacity_gw = gap['ercot_capacity_gw']
        gap_gw = gap['gap_gw']
        status = gap['status']
        
        emoji = "🔴" if status == "SHORTFALL" else "🟢" if status == "SURPLUS" else "🟡"
        
        print(f"{county:<20} {dc_count:<6} {dc_demand_gw:>10.2f} GW {ercot_capacity_gw:>10.2f} GW {gap_gw:>+10.2f} GW {emoji} {status}")
        
        total_demand += gap['dc_demand_mw']
        total_capacity += gap['ercot_capacity_mw']
        if gap['gap_mw'] > 0:
            total_shortfall += gap['gap_mw']
            counties_with_shortfall += 1
    
    print(f"\n{'='*80}")
    print("SUMMARY")
    print(f"{'='*80}")
    print(f"Total counties with DCs: {len(gaps)}")
    print(f"Total DC demand: {total_demand/1000:.2f} GW")
    print(f"Total ERCOT capacity (in DC counties): {total_capacity/1000:.2f} GW")
    print(f"Total shortfall: {total_shortfall/1000:.2f} GW")
    print(f"Counties with shortfall: {counties_with_shortfall}/{len(gaps)}")
    
    # Top shortfalls
    print(f"\n🔴 Top 10 Counties with SHORTFALL:")
    shortfalls = [g for g in gaps if g['status'] == 'SHORTFALL']
    shortfalls.sort(key=lambda x: x['gap_mw'], reverse=True)
    for i, gap in enumerate(shortfalls[:10], 1):
        print(f"   {i}. {gap['county']}: {gap['dc_count']} DCs × {gap['dc_demand_mw']/gap['dc_count']:.0f} MW = {gap['dc_demand_gw']:.2f} GW demand, "
              f"{gap['ercot_capacity_gw']:.2f} GW local = {gap['gap_gw']:.2f} GW shortfall")
    
    # Top surpluses
    print(f"\n🟢 Top 10 Counties with SURPLUS:")
    surpluses = [g for g in gaps if g['status'] == 'SURPLUS']
    surpluses.sort(key=lambda x: x['gap_mw'])  # Most negative first
    for i, gap in enumerate(surpluses[:10], 1):
        print(f"   {i}. {gap['county']}: {gap['dc_count']} DCs × {gap['dc_demand_mw']/gap['dc_count']:.0f} MW = {gap['dc_demand_gw']:.2f} GW demand, "
              f"{gap['ercot_capacity_gw']:.2f} GW local = {abs(gap['gap_gw']):.2f} GW surplus")
    
    # Data quality note
    total_with_size = sum(g['projects_with_size'] for g in gaps)
    total_estimated = sum(g['projects_estimated'] for g in gaps)
    print(f"\n📊 Data Quality:")
    print(f"   Projects with size_mw: {total_with_size}")
    print(f"   Projects estimated (100 MW default): {total_estimated}")
    if total_estimated > 0:
        print(f"   ⚠️  {total_estimated} projects using default 100 MW estimate")
    
    # Save results
    result = {
        'summary': {
            'total_counties': len(gaps),
            'total_dc_demand_gw': total_demand / 1000,
            'total_ercot_capacity_gw': total_capacity / 1000,
            'total_shortfall_gw': total_shortfall / 1000,
            'counties_with_shortfall': counties_with_shortfall,
            'projects_with_size': total_with_size,
            'projects_estimated': total_estimated
        },
        'gaps_by_county': gaps
    }
    
    output_path = base_path / 'data/analysis/story1_power_demand_gap.json'
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(result, f, indent=2)
    
    print(f"\n✅ Results saved to {output_path}")
    
    return result

if __name__ == '__main__':
    calculate_power_demand_gap()

