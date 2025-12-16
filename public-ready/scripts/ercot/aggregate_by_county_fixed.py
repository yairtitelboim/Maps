#!/usr/bin/env python3
"""
FIXED: Aggregate ERCOT GIS Report projects by county.
- Deduplicates by INR (takes most recent status per project)
- Filters to operational/signed projects only
- Properly handles capacity parsing
"""
import json
from pathlib import Path
from collections import defaultdict
from datetime import datetime
import re

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
            numbers = re.findall(r'-?\d+\.?\d*', str(capacity_str))
            if numbers:
                return float(numbers[0])
        except:
            pass
        return 0.0

def is_operational_status(status):
    """Check if status indicates operational or approved project."""
    if not status:
        return False
    
    status_lower = str(status).lower()
    
    # Operational indicators
    operational_keywords = [
        'operational',
        'ia signed',  # Interconnection Agreement signed
        'ia completed',
        'suspended-operational'
    ]
    
    # Exclude withdrawn/cancelled
    excluded_keywords = [
        'withdrawn',
        'cancelled',
        'terminated',
        'rejected'
    ]
    
    # Check exclusions first
    for keyword in excluded_keywords:
        if keyword in status_lower:
            return False
    
    # Check for operational indicators
    for keyword in operational_keywords:
        if keyword in status_lower:
            return True
    
    # Statuses that indicate approval but not necessarily operational
    # "IA" in status usually means Interconnection Agreement signed
    if 'ia' in status_lower and 'no ia' not in status_lower:
        # Check if it's a completed phase with IA
        if 'completed' in status_lower or 'fis completed' in status_lower:
            return True
    
    return False

def aggregate_by_county_fixed(
    input_file: str = "public/data/ercot/ercot_gis_reports.geojson",
    output_file: str = "data/ercot/county_aggregations_fixed.json"
):
    """
    Aggregate ERCOT projects by county with proper deduplication and filtering.
    
    Args:
        input_file: Path to ERCOT GIS reports GeoJSON
        output_file: Path to output JSON file with aggregations
    """
    
    input_path = Path(input_file)
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    print("=" * 80)
    print("FIXED: Aggregating ERCOT Projects by County")
    print("=" * 80)
    print(f"Input: {input_path}")
    print(f"Output: {output_path}")
    print()
    
    # Load GeoJSON
    print("Loading ERCOT GIS reports...")
    with open(input_path, 'r') as f:
        data = json.load(f)
    
    features = data.get('features', [])
    print(f"Total project records: {len(features):,}")
    print()
    
    # Step 1: Deduplicate by INR (keep most recent per project)
    print("Step 1: Deduplicating by INR...")
    projects_by_inr = {}
    
    for feature in features:
        props = feature.get('properties', {})
        inr = props.get('INR', '').strip()
        
        if not inr:
            continue
        
        # Get report date (if available) or use a default
        report_date = None
        date_str = props.get('Report Date', props.get('report_date', ''))
        if date_str:
            try:
                # Try various date formats
                for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%m/%d/%Y', '%Y']:
                    try:
                        report_date = datetime.strptime(str(date_str)[:10], fmt)
                        break
                    except:
                        continue
            except:
                pass
        
        # If no date, use a default old date
        if not report_date:
            report_date = datetime(2000, 1, 1)
        
        # Keep the most recent record for each INR
        if inr not in projects_by_inr:
            projects_by_inr[inr] = {
                'feature': feature,
                'date': report_date
            }
        else:
            if report_date > projects_by_inr[inr]['date']:
                projects_by_inr[inr] = {
                    'feature': feature,
                    'date': report_date
                }
    
    unique_projects = len(projects_by_inr)
    print(f"  Unique projects (by INR): {unique_projects:,}")
    print(f"  Duplicates removed: {len(features) - unique_projects:,}")
    print()
    
    # Step 2: Filter to operational projects only
    print("Step 2: Filtering to operational/signed projects...")
    operational_projects = []
    filtered_out = 0
    
    for inr, project_data in projects_by_inr.items():
        feature = project_data['feature']
        props = feature.get('properties', {})
        status = props.get('GIM Study Phase', '')
        
        if is_operational_status(status):
            operational_projects.append(feature)
        else:
            filtered_out += 1
    
    print(f"  Operational/signed projects: {len(operational_projects):,}")
    print(f"  Filtered out (proposals/withdrawn): {filtered_out:,}")
    print()
    
    # Step 3: Aggregate by county
    print("Step 3: Aggregating by county...")
    county_data = defaultdict(lambda: {
        'project_count': 0,
        'total_capacity_mw': 0.0,
        'projects': [],
        'fuel_breakdown': defaultdict(lambda: {'count': 0, 'capacity': 0.0}),
        'status_breakdown': defaultdict(int)
    })
    
    processed = 0
    skipped = 0
    
    for feature in operational_projects:
        props = feature.get('properties', {})
        county = props.get('County', '').strip()
        
        if not county or county == '':
            skipped += 1
            continue
        
        # Normalize county name
        county_normalized = county.replace(' County', '').replace(' county', '').strip()
        
        # Get capacity
        capacity = parse_capacity(props.get('Capacity (MW)'))
        
        # Get fuel type
        fuel = props.get('Fuel', 'OTH')
        if not fuel or fuel == '':
            fuel = 'OTH'
        
        # Identify storage projects
        project_name = (props.get('Project Name', '') or '').lower()
        is_storage = 'storage' in project_name or 'slf' in project_name
        if is_storage and fuel == 'OTH':
            fuel = 'STR'
        
        # Get status
        status = props.get('GIM Study Phase', 'Unknown')
        
        # Get project ID
        project_id = props.get('INR', props.get('Project Name', f'project_{processed}'))
        
        # Aggregate
        county_data[county_normalized]['project_count'] += 1
        county_data[county_normalized]['total_capacity_mw'] += capacity
        county_data[county_normalized]['projects'].append(project_id)
        county_data[county_normalized]['fuel_breakdown'][fuel]['count'] += 1
        county_data[county_normalized]['fuel_breakdown'][fuel]['capacity'] += capacity
        county_data[county_normalized]['status_breakdown'][status] += 1
        
        processed += 1
    
    print(f"✅ Processed {processed:,} operational projects")
    if skipped > 0:
        print(f"⚠️  Skipped {skipped:,} projects (no county data)")
    print()
    
    # Calculate totals
    total_capacity = sum(data['total_capacity_mw'] for data in county_data.values())
    print(f"Total operational capacity: {total_capacity:,.0f} MW ({total_capacity/1000:.1f} GW)")
    print(f"Expected ERCOT total: ~85 GW")
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
        
        aggregations[county] = {
            'project_count': project_count,
            'total_capacity_mw': round(total_capacity, 2),
            'avg_capacity_mw': round(total_capacity / project_count if project_count > 0 else 0, 2),
            'fuel_breakdown': fuel_breakdown,
            'status_breakdown': status_breakdown,
            'project_ids_sample': data['projects'][:10]
        }
    
    # Save aggregations
    print("Saving aggregations...")
    with open(output_path, 'w') as f:
        json.dump(aggregations, f, indent=2, default=str)
    
    file_size = output_path.stat().st_size
    print(f"✅ Aggregations saved: {file_size / 1024:.2f} KB")
    print()
    
    # Print summary statistics
    print("=" * 80)
    print("Summary Statistics (OPERATIONAL PROJECTS ONLY)")
    print("=" * 80)
    print(f"Total counties with operational projects: {len(aggregations):,}")
    print()
    
    # Top counties by capacity
    top_by_capacity = sorted(aggregations.items(), key=lambda x: x[1]['total_capacity_mw'], reverse=True)[:10]
    print("Top 10 counties by operational capacity:")
    for county, data in top_by_capacity:
        print(f"  {county}: {data['total_capacity_mw']:,.0f} MW ({data['project_count']:,} projects)")
    print()
    
    print("=" * 80)
    print("✅ Fixed aggregation complete!")
    print("=" * 80)
    
    return aggregations


if __name__ == "__main__":
    import sys
    
    input_file = sys.argv[1] if len(sys.argv) > 1 else "public/data/ercot/ercot_gis_reports.geojson"
    output_file = sys.argv[2] if len(sys.argv) > 2 else "data/ercot/county_aggregations_fixed.json"
    
    try:
        aggregations = aggregate_by_county_fixed(input_file, output_file)
        print(f"\n✅ Success! Aggregated {len(aggregations)} counties")
    except Exception as e:
        print(f"\n❌ Failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

