#!/usr/bin/env python3
"""
Merge county aggregations with Texas county boundaries GeoJSON.
Matches counties by name and adds aggregated statistics.
"""

import json
from pathlib import Path
from difflib import SequenceMatcher

def similarity(a, b):
    """Calculate similarity ratio between two strings."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def normalize_county_name(name):
    """Normalize county name for matching."""
    if not name:
        return ''
    # Remove common suffixes and normalize
    name = name.replace(' County', '').replace(' county', '').strip()
    return name


def find_best_match(county_name, available_names, threshold=0.8):
    """Find best matching county name from available names."""
    normalized = normalize_county_name(county_name)
    
    best_match = None
    best_score = 0
    
    for available in available_names:
        score = similarity(normalized, normalize_county_name(available))
        if score > best_score:
            best_score = score
            best_match = available
    
    if best_score >= threshold:
        return best_match, best_score
    return None, best_score


def merge_county_data(
    boundaries_file: str = "public/data/texas/texas_counties.geojson",
    aggregations_file: str = "data/ercot/county_aggregations.json",
    output_file: str = "public/data/ercot/ercot_counties_aggregated.geojson"
):
    """
    Merge county aggregations with boundaries.
    
    Args:
        boundaries_file: Path to county boundaries GeoJSON
        aggregations_file: Path to county aggregations JSON
        output_file: Path to output merged GeoJSON
    """
    
    boundaries_path = Path(boundaries_file)
    aggregations_path = Path(aggregations_file)
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("Merging County Data")
    print("=" * 60)
    print(f"Boundaries: {boundaries_path}")
    print(f"Aggregations: {aggregations_path}")
    print(f"Output: {output_path}")
    print()
    
    # Load boundaries
    print("Loading county boundaries...")
    with open(boundaries_path, 'r') as f:
        boundaries_data = json.load(f)
    
    print(f"Total counties in boundaries: {len(boundaries_data['features']):,}")
    
    # Load aggregations
    print("Loading county aggregations...")
    with open(aggregations_path, 'r') as f:
        aggregations = json.load(f)
    
    print(f"Total counties with projects: {len(aggregations):,}")
    print()
    
    # Create lookup of aggregations by normalized name
    aggregations_lookup = {}
    for county_name, data in aggregations.items():
        normalized = normalize_county_name(county_name)
        aggregations_lookup[normalized] = (county_name, data)
    
    # Process each county boundary
    print("Merging data...")
    matched = 0
    unmatched = []
    low_confidence = []
    
    for feature in boundaries_data['features']:
        props = feature.get('properties', {})
        county_name = props.get('NAME', '')
        
        # Try exact match first
        normalized = normalize_county_name(county_name)
        matched_data = None
        
        if normalized in aggregations_lookup:
            # Exact match
            original_name, matched_data = aggregations_lookup[normalized]
            matched += 1
        else:
            # Try fuzzy matching
            best_match, score = find_best_match(county_name, aggregations.keys())
            if best_match and score >= 0.8:
                matched_data = aggregations[best_match]
                matched += 1
                if score < 0.95:
                    low_confidence.append((county_name, best_match, score))
            else:
                unmatched.append(county_name)
        
        # Add aggregated data to properties
        if matched_data:
            # Add all aggregation fields
            props['project_count'] = matched_data['project_count']
            props['total_capacity_mw'] = matched_data['total_capacity_mw']
            props['avg_capacity_mw'] = matched_data['avg_capacity_mw']
            props['has_projects'] = True
            
            # Add fuel breakdown (flattened for easier access)
            fuel_breakdown = matched_data.get('fuel_breakdown', {})
            
            # Individual fuel types
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
            
            # True "Other" (excludes storage, battery, and main fuel types)
            props['fuel_other_count'] = sum(
                v.get('count', 0) for k, v in fuel_breakdown.items() 
                if k not in ['SOL', 'WIN', 'GAS', 'BAT', 'STR', 'NUC']
            )
            props['fuel_other_capacity'] = sum(
                v.get('capacity', 0) for k, v in fuel_breakdown.items() 
                if k not in ['SOL', 'WIN', 'GAS', 'BAT', 'STR', 'NUC']
            )
            
            # NEW CATEGORIES: Baseload, Renewable, Storage
            props['baseload_capacity'] = props['fuel_gas_capacity'] + props['fuel_nuclear_capacity']
            props['baseload_count'] = props['fuel_gas_count'] + props['fuel_nuclear_count']
            
            props['renewable_capacity'] = props['fuel_solar_capacity'] + props['fuel_wind_capacity']
            props['renewable_count'] = props['fuel_solar_count'] + props['fuel_wind_count']
            
            props['storage_capacity'] = props['fuel_battery_capacity'] + props['fuel_storage_capacity']
            props['storage_count'] = props['fuel_battery_count'] + props['fuel_storage_count']
            
            # NORMALIZED METRICS (percentages)
            total_capacity = props.get('total_capacity_mw', 0)
            if total_capacity > 0:
                props['baseload_pct'] = round((props['baseload_capacity'] / total_capacity) * 100, 2)
                props['renewable_pct'] = round((props['renewable_capacity'] / total_capacity) * 100, 2)
                props['storage_pct'] = round((props['storage_capacity'] / total_capacity) * 100, 2)
                props['other_pct'] = round((props['fuel_other_capacity'] / total_capacity) * 100, 2)
            else:
                props['baseload_pct'] = 0
                props['renewable_pct'] = 0
                props['storage_pct'] = 0
                props['other_pct'] = 0
            
            # BASELOAD INDEX (reliability score: baseload / total)
            props['baseload_index'] = round(props['baseload_pct'] / 100, 3) if total_capacity > 0 else 0
            
            # Determine dominant fuel type (using new categories)
            fuel_capacities = {
                'SOL': props['fuel_solar_capacity'],
                'WIN': props['fuel_wind_capacity'],
                'GAS': props['fuel_gas_capacity'],
                'BAT': props['fuel_battery_capacity'],
                'STR': props['fuel_storage_capacity'],
                'OTH': props['fuel_other_capacity']
            }
            dominant_fuel = max(fuel_capacities.items(), key=lambda x: x[1])[0] if any(fuel_capacities.values()) else 'NONE'
            props['dominant_fuel_type'] = dominant_fuel
            
            # Determine dominant category (Baseload, Renewable, Storage, Other)
            category_capacities = {
                'BASELOAD': props['baseload_capacity'],
                'RENEWABLE': props['renewable_capacity'],
                'STORAGE': props['storage_capacity'],
                'OTHER': props['fuel_other_capacity']
            }
            dominant_category = max(category_capacities.items(), key=lambda x: x[1])[0] if any(category_capacities.values()) else 'NONE'
            props['dominant_category'] = dominant_category
            
            # Add status breakdown (sample)
            status_breakdown = matched_data.get('status_breakdown', {})
            props['status_breakdown'] = status_breakdown
            
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
            props['fuel_other_count'] = 0
            props['fuel_solar_capacity'] = 0
            props['fuel_wind_capacity'] = 0
            props['fuel_gas_capacity'] = 0
            props['fuel_battery_capacity'] = 0
            props['fuel_storage_capacity'] = 0
            props['fuel_nuclear_capacity'] = 0
            props['fuel_other_capacity'] = 0
            props['baseload_capacity'] = 0
            props['baseload_count'] = 0
            props['renewable_capacity'] = 0
            props['renewable_count'] = 0
            props['storage_capacity'] = 0
            props['storage_count'] = 0
            props['baseload_pct'] = 0
            props['renewable_pct'] = 0
            props['storage_pct'] = 0
            props['other_pct'] = 0
            props['baseload_index'] = 0
            props['dominant_fuel_type'] = 'NONE'
            props['dominant_category'] = 'NONE'
            props['status_breakdown'] = {}
    
    print(f"✅ Matched {matched:,} counties with project data")
    if unmatched:
        print(f"⚠️  {len(unmatched)} counties with no matching project data:")
        for county in unmatched[:10]:
            print(f"     - {county}")
        if len(unmatched) > 10:
            print(f"     ... and {len(unmatched) - 10} more")
    if low_confidence:
        print(f"⚠️  {len(low_confidence)} low-confidence matches:")
        for boundary, agg, score in low_confidence[:5]:
            print(f"     - '{boundary}' matched to '{agg}' (score: {score:.2f})")
    print()
    
    # Save merged GeoJSON
    print("Saving merged GeoJSON...")
    with open(output_path, 'w') as f:
        json.dump(boundaries_data, f, indent=2, default=str)
    
    file_size = output_path.stat().st_size
    print(f"✅ Merged GeoJSON saved: {file_size / 1024 / 1024:.2f} MB")
    print()
    
    # Statistics
    counties_with_projects = sum(1 for f in boundaries_data['features'] if f['properties'].get('has_projects', False))
    total_projects = sum(f['properties'].get('project_count', 0) for f in boundaries_data['features'])
    total_capacity = sum(f['properties'].get('total_capacity_mw', 0) for f in boundaries_data['features'])
    
    print("=" * 60)
    print("Merge Statistics")
    print("=" * 60)
    print(f"Total counties: {len(boundaries_data['features']):,}")
    print(f"Counties with projects: {counties_with_projects:,}")
    print(f"Counties without projects: {len(boundaries_data['features']) - counties_with_projects:,}")
    print(f"Total projects: {total_projects:,}")
    print(f"Total capacity: {total_capacity:,.0f} MW")
    print()
    
    print("=" * 60)
    print("✅ Merge complete!")
    print("=" * 60)
    
    return str(output_path)


if __name__ == "__main__":
    import sys
    
    boundaries_file = sys.argv[1] if len(sys.argv) > 1 else "public/data/texas/texas_counties.geojson"
    aggregations_file = sys.argv[2] if len(sys.argv) > 2 else "data/ercot/county_aggregations.json"
    output_file = sys.argv[3] if len(sys.argv) > 3 else "public/data/ercot/ercot_counties_aggregated.geojson"
    
    try:
        result = merge_county_data(boundaries_file, aggregations_file, output_file)
        print(f"\n✅ Success! Merged file: {result}")
    except Exception as e:
        print(f"\n❌ Failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

