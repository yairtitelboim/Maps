#!/usr/bin/env python3
"""
Aggregate ERCOT GIS Report projects by county.
Calculates project counts, capacity totals, and fuel type breakdowns.
"""

import json
from pathlib import Path
from collections import defaultdict
from datetime import datetime

def parse_capacity(capacity_str):
    """Parse capacity value, handling various formats."""
    if capacity_str is None:
        return 0.0
    
    try:
        # Try direct conversion
        return float(capacity_str)
    except (ValueError, TypeError):
        # Try extracting number from string
        try:
            import re
            numbers = re.findall(r'-?\d+\.?\d*', str(capacity_str))
            if numbers:
                return float(numbers[0])
        except:
            pass
        return 0.0


def aggregate_by_county(
    input_file: str = "public/data/ercot/ercot_gis_reports.geojson",
    output_file: str = "data/ercot/county_aggregations.json"
):
    """
    Aggregate ERCOT projects by county.
    
    Args:
        input_file: Path to ERCOT GIS reports GeoJSON
        output_file: Path to output JSON file with aggregations
    """
    
    input_path = Path(input_file)
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("Aggregating ERCOT Projects by County")
    print("=" * 60)
    print(f"Input: {input_path}")
    print(f"Output: {output_path}")
    print()
    
    # Load GeoJSON
    print("Loading ERCOT GIS reports...")
    with open(input_path, 'r') as f:
        data = json.load(f)
    
    features = data.get('features', [])
    print(f"Total projects: {len(features):,}")
    print()
    
    # Initialize aggregation structure
    county_data = defaultdict(lambda: {
        'project_count': 0,
        'total_capacity_mw': 0.0,
        'projects': [],  # Store project IDs for reference
        'fuel_breakdown': defaultdict(lambda: {'count': 0, 'capacity': 0.0}),
        'status_breakdown': defaultdict(int),
        'year_breakdown': defaultdict(int)
    })
    
    # Process each project
    print("Processing projects...")
    processed = 0
    skipped = 0
    
    for feature in features:
        props = feature.get('properties', {})
        county = props.get('County', '').strip()
        
        if not county or county == '':
            skipped += 1
            continue
        
        # Normalize county name (remove "County" suffix if present)
        county_normalized = county.replace(' County', '').replace(' county', '').strip()
        
        # Get capacity
        capacity = parse_capacity(props.get('Capacity (MW)'))
        
        # Get fuel type
        fuel = props.get('Fuel', 'OTH')
        if not fuel or fuel == '':
            fuel = 'OTH'
        
        # Identify storage projects and re-categorize
        # Storage projects are often marked as OTH but should be STR
        project_name = (props.get('Project Name', '') or '').lower()
        is_storage = 'storage' in project_name or 'slf' in project_name
        
        # If it's a storage project and currently marked as OTH, change to STR
        if is_storage and fuel == 'OTH':
            fuel = 'STR'
        
        # Get status/phase
        status = props.get('GIM Study Phase', 'Unknown')
        
        # Get projected COD year
        cod = props.get('Projected COD', '')
        year = None
        if cod:
            try:
                # Try to extract year from date string
                if isinstance(cod, str):
                    # Try various date formats
                    for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%m/%d/%Y', '%Y']:
                        try:
                            year = datetime.strptime(cod[:10], fmt).year
                            break
                        except:
                            continue
            except:
                pass
        
        # Get project ID
        project_id = props.get('INR', props.get('Project Name', f'project_{processed}'))
        
        # Aggregate
        county_data[county_normalized]['project_count'] += 1
        county_data[county_normalized]['total_capacity_mw'] += capacity
        county_data[county_normalized]['projects'].append(project_id)
        county_data[county_normalized]['fuel_breakdown'][fuel]['count'] += 1
        county_data[county_normalized]['fuel_breakdown'][fuel]['capacity'] += capacity
        county_data[county_normalized]['status_breakdown'][status] += 1
        
        if year:
            county_data[county_normalized]['year_breakdown'][year] += 1
        
        processed += 1
        
        if processed % 10000 == 0:
            print(f"  Processed {processed:,} projects...")
    
    print(f"✅ Processed {processed:,} projects")
    if skipped > 0:
        print(f"⚠️  Skipped {skipped:,} projects (no county data)")
    print()
    
    # Calculate averages and convert to regular dict
    aggregations = {}
    for county, data in county_data.items():
        project_count = data['project_count']
        total_capacity = data['total_capacity_mw']
        
        # Convert fuel breakdown to regular dict
        fuel_breakdown = {}
        for fuel, stats in data['fuel_breakdown'].items():
            fuel_breakdown[fuel] = {
                'count': stats['count'],
                'capacity': round(stats['capacity'], 2)
            }
        
        # Convert status breakdown to regular dict
        status_breakdown = dict(data['status_breakdown'])
        
        # Convert year breakdown to regular dict
        year_breakdown = dict(data['year_breakdown'])
        
        aggregations[county] = {
            'project_count': project_count,
            'total_capacity_mw': round(total_capacity, 2),
            'avg_capacity_mw': round(total_capacity / project_count if project_count > 0 else 0, 2),
            'fuel_breakdown': fuel_breakdown,
            'status_breakdown': status_breakdown,
            'year_breakdown': year_breakdown,
            'project_ids_sample': data['projects'][:10]  # Sample of project IDs
        }
    
    # Save aggregations
    print("Saving aggregations...")
    with open(output_path, 'w') as f:
        json.dump(aggregations, f, indent=2, default=str)
    
    file_size = output_path.stat().st_size
    print(f"✅ Aggregations saved: {file_size / 1024:.2f} KB")
    print()
    
    # Print summary statistics
    print("=" * 60)
    print("Summary Statistics")
    print("=" * 60)
    print(f"Total counties with projects: {len(aggregations):,}")
    print()
    
    # Top counties by project count
    top_by_count = sorted(aggregations.items(), key=lambda x: x[1]['project_count'], reverse=True)[:10]
    print("Top 10 counties by project count:")
    for county, data in top_by_count:
        print(f"  {county}: {data['project_count']:,} projects, {data['total_capacity_mw']:,.0f} MW")
    print()
    
    # Top counties by capacity
    top_by_capacity = sorted(aggregations.items(), key=lambda x: x[1]['total_capacity_mw'], reverse=True)[:10]
    print("Top 10 counties by total capacity:")
    for county, data in top_by_capacity:
        print(f"  {county}: {data['total_capacity_mw']:,.0f} MW ({data['project_count']:,} projects)")
    print()
    
    # Fuel type totals
    fuel_totals = defaultdict(lambda: {'count': 0, 'capacity': 0.0})
    for county_data in aggregations.values():
        for fuel, stats in county_data['fuel_breakdown'].items():
            fuel_totals[fuel]['count'] += stats['count']
            fuel_totals[fuel]['capacity'] += stats['capacity']
    
    print("Fuel type totals (across all counties):")
    for fuel in sorted(fuel_totals.keys()):
        stats = fuel_totals[fuel]
        print(f"  {fuel}: {stats['count']:,} projects, {stats['capacity']:,.0f} MW")
    print()
    
    # Storage breakdown summary
    storage_count = fuel_totals.get('STR', {}).get('count', 0)
    storage_capacity = fuel_totals.get('STR', {}).get('capacity', 0)
    other_count = fuel_totals.get('OTH', {}).get('count', 0)
    other_capacity = fuel_totals.get('OTH', {}).get('capacity', 0)
    if storage_count > 0:
        print("Storage projects (STR) extracted from Other:")
        print(f"  STR: {storage_count:,} projects, {storage_capacity:,.0f} MW")
        print(f"  OTH (remaining): {other_count:,} projects, {other_capacity:,.0f} MW")
    print()
    
    print("=" * 60)
    print("✅ Aggregation complete!")
    print("=" * 60)
    
    return aggregations


if __name__ == "__main__":
    import sys
    
    input_file = sys.argv[1] if len(sys.argv) > 1 else "public/data/ercot/ercot_gis_reports.geojson"
    output_file = sys.argv[2] if len(sys.argv) > 2 else "data/ercot/county_aggregations.json"
    
    try:
        aggregations = aggregate_by_county(input_file, output_file)
        print(f"\n✅ Success! Aggregated {len(aggregations)} counties")
    except Exception as e:
        print(f"\n❌ Failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

