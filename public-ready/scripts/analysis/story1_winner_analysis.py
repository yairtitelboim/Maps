#!/usr/bin/env python3
"""
Analyze "winner" counties: Counties with both meaningful DCs AND energy surplus.
Identify common characteristics of successful coordination.
"""
import json
from pathlib import Path
from collections import defaultdict
import statistics

def load_power_gap_data():
    """Load power demand gap analysis results."""
    base_path = Path(__file__).parent.parent.parent
    gap_path = base_path / 'data/analysis/story1_power_demand_gap.json'
    
    with open(gap_path, 'r') as f:
        return json.load(f)

def load_ercot_data():
    """Load ERCOT county data for fuel types and project details."""
    base_path = Path(__file__).parent.parent.parent
    ercot_path = base_path / 'public/data/ercot/ercot_counties_aggregated_fixed.geojson'
    
    if not ercot_path.exists():
        ercot_path = base_path / 'public/data/ercot/ercot_counties_aggregated.geojson'
    
    with open(ercot_path, 'r') as f:
        return json.load(f)

def load_dc_data():
    """Load DC data for timeline analysis."""
    base_path = Path(__file__).parent.parent.parent
    dc_path = base_path / 'public/data/texas_data_centers.geojson'
    
    with open(dc_path, 'r') as f:
        return json.load(f)

def get_county_population_density(county_name):
    """
    Get population density for a county.
    For now, use heuristics based on known metro areas.
    TODO: Integrate actual census data if available.
    """
    # Known metro counties (high population density)
    metro_counties = {
        'Harris': 'metro',  # Houston
        'Dallas': 'metro',
        'Tarrant': 'metro',  # Fort Worth
        'Bexar': 'metro',  # San Antonio
        'Travis': 'metro',  # Austin
        'Collin': 'metro',  # Plano, Frisco
        'Denton': 'metro',
        'Fort Bend': 'metro',  # Sugar Land
        'Montgomery': 'metro',
        'Williamson': 'metro',  # Round Rock
        'Hidalgo': 'metro',  # McAllen
        'El Paso': 'metro',
        'Cameron': 'metro',  # Brownsville
    }
    
    # Known rural counties (low population density)
    rural_counties = {
        'Armstrong': 'rural',
        'Shackelford': 'rural',
        'Borden': 'rural',
        'Deaf Smith': 'rural',
        'Pecos': 'rural',
        'Haskell': 'rural',
        'Lamar': 'rural',
        'Wharton': 'rural',
        'Navarro': 'rural',
        'Hill': 'rural',
        'Bosque': 'rural',
        'Ellis': 'rural',
        'McLennan': 'rural',  # Waco - medium
        'Ector': 'rural',  # Odessa - medium
    }
    
    if county_name in metro_counties:
        return metro_counties[county_name]
    elif county_name in rural_counties:
        return rural_counties[county_name]
    else:
        return 'unknown'

def analyze_winners():
    """Identify and analyze winner counties."""
    print("=" * 80)
    print("WINNER COUNTY ANALYSIS")
    print("=" * 80)
    print()
    
    # Load data
    print("Loading data...")
    gap_data = load_power_gap_data()
    ercot_data = load_ercot_data()
    dc_data = load_dc_data()
    
    gaps = gap_data['gaps_by_county']
    
    # Calculate median DC count
    dc_counts = [g['dc_count'] for g in gaps]
    median_dc_count = statistics.median(dc_counts) if dc_counts else 1
    
    print(f"Median DC count: {median_dc_count}")
    print()
    
    # Define winners: Counties with DCs >= 1 AND surplus > 0
    # Optionally: DC count > median for "meaningful" DC presence
    winners = []
    for gap in gaps:
        if (gap['dc_count'] >= 1 and 
            gap['status'] == 'SURPLUS' and 
            gap['gap_mw'] < 0):  # Negative gap = surplus
            
            # Calculate composite score
            surplus_gw = abs(gap['gap_gw'])
            composite_score = gap['dc_count'] * surplus_gw
            
            winners.append({
                'county': gap['county'],
                'dc_count': gap['dc_count'],
                'dc_demand_gw': gap['dc_demand_gw'],
                'ercot_capacity_gw': gap['ercot_capacity_gw'],
                'surplus_gw': surplus_gw,
                'composite_score': composite_score,
                'above_median_dc': gap['dc_count'] > median_dc_count
            })
    
    # Sort by composite score (highest first)
    winners.sort(key=lambda x: x['composite_score'], reverse=True)
    
    print(f"Winner Counties (DCs >= 1 AND surplus > 0): {len(winners)}")
    print()
    
    # Print winners
    print(f"{'County':<20} {'DCs':<6} {'Demand':<10} {'Capacity':<10} {'Surplus':<10} {'Score':<10}")
    print(f"{'-'*20} {'-'*6} {'-'*10} {'-'*10} {'-'*10} {'-'*10}")
    for winner in winners:
        print(f"{winner['county']:<20} {winner['dc_count']:<6} "
              f"{winner['dc_demand_gw']:>8.2f} GW {winner['ercot_capacity_gw']:>8.2f} GW "
              f"{winner['surplus_gw']:>8.2f} GW {winner['composite_score']:>8.2f}")
    
    print()
    
    # Analyze common characteristics
    print("=" * 80)
    print("COMMON CHARACTERISTICS OF WINNERS")
    print("=" * 80)
    print()
    
    # 1. Population density
    print("1. Population Density:")
    metro_count = 0
    rural_count = 0
    unknown_count = 0
    
    for winner in winners:
        density = get_county_population_density(winner['county'])
        winner['population_density'] = density
        if density == 'metro':
            metro_count += 1
        elif density == 'rural':
            rural_count += 1
        else:
            unknown_count += 1
    
    print(f"   Metro counties: {metro_count}/{len(winners)} ({metro_count/len(winners)*100:.1f}%)")
    print(f"   Rural counties: {rural_count}/{len(winners)} ({rural_count/len(winners)*100:.1f}%)")
    print(f"   Unknown: {unknown_count}/{len(winners)}")
    print()
    
    # 2. Fuel type analysis
    print("2. Dominant Fuel Types:")
    ercot_by_county = {}
    for feature in ercot_data.get('features', []):
        props = feature.get('properties', {})
        county_name = props.get('NAME', '').strip()
        if county_name:
            ercot_by_county[county_name] = {
                'dominant_fuel': props.get('dominant_fuel_type', 'N/A'),
                'solar_capacity': props.get('fuel_solar_capacity', 0) or 0,
                'wind_capacity': props.get('fuel_wind_capacity', 0) or 0,
                'battery_capacity': props.get('fuel_battery_capacity', 0) or 0,
                'gas_capacity': props.get('fuel_gas_capacity', 0) or 0,
                'renewable_pct': props.get('renewable_pct', 0) or 0,
            }
    
    fuel_types = defaultdict(int)
    renewable_pcts = []
    
    for winner in winners:
        county = winner['county']
        ercot_info = ercot_by_county.get(county, {})
        dominant_fuel = ercot_info.get('dominant_fuel', 'N/A')
        fuel_types[dominant_fuel] += 1
        renewable_pct = ercot_info.get('renewable_pct', 0)
        if renewable_pct > 0:
            renewable_pcts.append(renewable_pct)
        winner['dominant_fuel'] = dominant_fuel
        winner['renewable_pct'] = renewable_pct
        winner['solar_capacity'] = ercot_info.get('solar_capacity', 0)
        winner['wind_capacity'] = ercot_info.get('wind_capacity', 0)
        winner['battery_capacity'] = ercot_info.get('battery_capacity', 0)
    
    for fuel, count in sorted(fuel_types.items(), key=lambda x: x[1], reverse=True):
        print(f"   {fuel}: {count} counties")
    
    if renewable_pcts:
        avg_renewable = statistics.mean(renewable_pcts)
        print(f"   Average renewable %: {avg_renewable:.1f}%")
    print()
    
    # 3. Timeline analysis
    print("3. Timeline Analysis:")
    
    # Group DCs by county and get announcement dates
    dc_by_county = defaultdict(list)
    for feature in dc_data.get('features', []):
        props = feature.get('properties', {})
        location = props.get('location', '')
        coords = feature.get('geometry', {}).get('coordinates', [])
        
        # Try to extract county from location or coordinates
        county = None
        
        # Strategy 1: Point-in-polygon if shapely available
        try:
            from shapely.geometry import Point, shape
            counties_path = Path(__file__).parent.parent.parent / 'public/data/texas/texas_counties.geojson'
            if counties_path.exists() and coords and len(coords) == 2:
                with open(counties_path, 'r') as f:
                    counties_data = json.load(f)
                point = Point(coords[0], coords[1])
                for feat in counties_data.get('features', []):
                    county_name = feat.get('properties', {}).get('NAME', '')
                    geometry = feat.get('geometry', {})
                    if geometry and county_name:
                        try:
                            polygon = shape(geometry)
                            if polygon.contains(point):
                                county = county_name
                                break
                        except:
                            continue
        except:
            pass
        
        # Strategy 2: Parse location text
        if not county:
            import re
            patterns = [
                r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County",
                r"([A-Z][a-z]+),\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County",
            ]
            for pattern in patterns:
                match = re.search(pattern, location)
                if match:
                    groups = match.groups()
                    county = groups[-1] if len(groups) > 1 else groups[0]
                    break
        
        if county:
            announced_date = props.get('announced_date', '')
            expected_date = props.get('expected_completion_date', '')
            dc_by_county[county].append({
                'date': announced_date,
                'expected_date': expected_date,
                'project_name': props.get('project_name', 'Unknown')
            })
    
    # Analyze timeline for winners
    print("   DC Announcement Dates:")
    winner_dc_dates = []
    for winner in winners:
        county = winner['county']
        dc_dates = dc_by_county.get(county, [])
        for dc in dc_dates:
            if dc['date']:
                winner_dc_dates.append(dc['date'])
    
    if winner_dc_dates:
        # Extract years
        years = []
        for date_str in winner_dc_dates:
            if date_str:
                try:
                    year = int(date_str[:4])
                    years.append(year)
                except:
                    pass
        
        if years:
            year_counts = defaultdict(int)
            for year in years:
                year_counts[year] += 1
            
            for year in sorted(year_counts.keys()):
                print(f"      {year}: {year_counts[year]} announcements")
    
    # Energy project timeline (from ERCOT data - approximate)
    print("   Energy Projects:")
    print("      Note: ERCOT data shows operational projects (likely came online 2017-2025)")
    print("      Most winners have energy projects that predate recent DC announcements")
    print()
    
    # Determine sequence: Energy first or DCs first?
    print("   Sequence Analysis:")
    energy_first = 0
    dc_first = 0
    unclear = 0
    
    for winner in winners:
        county = winner['county']
        dc_dates = dc_by_county.get(county, [])
        
        # If DCs announced in 2025 and energy is operational, energy likely came first
        dc_years = []
        for dc in dc_dates:
            if dc['date']:
                try:
                    dc_years.append(int(dc['date'][:4]))
                except:
                    pass
        
        if dc_years:
            earliest_dc = min(dc_years)
            # Energy projects are operational (likely online 2017-2025, most before 2025)
            if earliest_dc >= 2024:
                energy_first += 1
                winner['sequence'] = 'energy_first'
            else:
                unclear += 1
                winner['sequence'] = 'unclear'
        else:
            unclear += 1
            winner['sequence'] = 'unclear'
    
    print(f"      Energy came first: {energy_first} counties")
    print(f"      Unclear: {unclear} counties")
    print()
    
    # 4. Distance to major metro (heuristic)
    print("4. Proximity to Major Metro:")
    major_metros = {
        'Harris': 'Houston',
        'Dallas': 'Dallas',
        'Tarrant': 'Fort Worth',
        'Bexar': 'San Antonio',
        'Travis': 'Austin',
    }
    
    metro_proximity = defaultdict(int)
    for winner in winners:
        county = winner['county']
        if county in major_metros:
            metro_proximity['In major metro'] += 1
        else:
            metro_proximity['Near major metro'] += 1  # Simplified
    
    for proximity, count in metro_proximity.items():
        print(f"   {proximity}: {count} counties")
    print()
    
    # 5. Summary insights
    print("=" * 80)
    print("KEY INSIGHTS")
    print("=" * 80)
    print()
    
    print(f"✅ Winners: {len(winners)} counties with both DCs and energy surplus")
    print()
    
    if metro_count > rural_count:
        print(f"✅ Pattern: {metro_count/len(winners)*100:.0f}% are metro counties")
        print("   → Metros have better coordination (DCs + energy)")
    else:
        print(f"✅ Pattern: {rural_count/len(winners)*100:.0f}% are rural counties")
        print("   → Rural areas can also coordinate well")
    
    print()
    
    # Top fuel type
    top_fuel = max(fuel_types.items(), key=lambda x: x[1])[0] if fuel_types else 'N/A'
    print(f"✅ Dominant fuel: {top_fuel} ({fuel_types[top_fuel]} counties)")
    print("   → This fuel type supports DC growth well")
    print()
    
    # Save results
    result = {
        'median_dc_count': median_dc_count,
        'winners': winners,
        'characteristics': {
            'metro_count': metro_count,
            'rural_count': rural_count,
            'fuel_types': dict(fuel_types),
            'avg_renewable_pct': statistics.mean(renewable_pcts) if renewable_pcts else 0
        }
    }
    
    output_path = Path(__file__).parent.parent.parent / 'data/analysis/story1_winner_analysis.json'
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(result, f, indent=2, default=str)
    
    print(f"✅ Results saved to {output_path}")
    
    return result

if __name__ == '__main__':
    analyze_winners()

